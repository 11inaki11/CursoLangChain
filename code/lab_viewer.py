"""
lab_viewer.py — watch the lab live in your browser while an agent runs.

The same idea as the simulator on the course website, but driven by the
REAL agent: every tool call, message and robot movement shows up live at
http://localhost:8765.

    from lab_viewer import start_viewer, watch, wait_to_close
    start_viewer("Chapter 2b · Tools", model=DEFAULT_MODEL)   # reuses an open tab, or opens one
    agent = watch(create_agent(...), system=SYSTEM_PROMPT)     # stream the agent's messages to it
    ...
    wait_to_close()                       # keep the page alive until Enter

Each run is a new session: a tab left open from a previous run resets itself
to the initial lab and follows the new script. A new tab only opens if none
is connected. Disable it with --no-viewer or LAB_VIEWER=0 (e.g. over SSH).
Standard library only: no extra install.
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from langchain_core.callbacks import BaseCallbackHandler

from robot_world import WORLD, World

PAGE = Path(__file__).parent / "viewer" / "index.html"
_server: ThreadingHTTPServer | None = None
_last_poll = 0.0  # when an open tab last asked for the state


def enabled() -> bool:
    return "--no-viewer" not in sys.argv and os.getenv("LAB_VIEWER", "1") != "0"


def start_viewer(title: str = "Lab 80", model: str = "", world: World = WORLD,
                 port: int = 8765, open_browser: bool = True) -> str | None:
    """Serve the live viewer on localhost. Reuses an open tab, else opens one. Returns the URL."""
    global _server
    if not enabled():
        return None
    session = {"id": uuid.uuid4().hex[:8], "title": title, "model": model}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            global _last_poll
            if self.path.startswith("/state"):
                _last_poll = time.monotonic()
                body, ctype = json.dumps({"session": session, **world.snapshot()}).encode(), "application/json"
            else:
                body, ctype = PAGE.read_bytes(), "text/html; charset=utf-8"
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):  # keep the terminal clean
            pass

    for candidate in range(port, port + 10):  # next free port if 8765 is busy
        try:
            _server = ThreadingHTTPServer(("127.0.0.1", candidate), Handler)
            break
        except OSError:
            continue
    else:
        print("[viewer] no free port, running without the live viewer")
        return None

    threading.Thread(target=_server.serve_forever, daemon=True).start()
    world.realtime = True  # movements take time so you can watch them
    url = f"http://localhost:{_server.server_address[1]}"
    # A tab left open from a previous run keeps polling this port: give it a moment to reconnect.
    started = time.monotonic()
    while time.monotonic() - started < 1.5 and _last_poll < started:
        time.sleep(0.1)
    if _last_poll >= started:
        print(f"[viewer] live lab at {url} (reusing the open tab)")
    else:
        print(f"[viewer] live lab at {url}")
        if open_browser:
            webbrowser.open(url)
    return url


def wait_to_close() -> None:
    """Keep the viewer alive after the script ends, until you press Enter."""
    if _server:
        try:
            input("\n[viewer] Done. Press Enter to close the live viewer... ")
        except (EOFError, KeyboardInterrupt):
            pass


def show_retrieval(query: str, hits: list, world: World = WORLD) -> None:
    """Show a RAG search in the viewer: the query and each retrieved chunk with its score."""
    world.emit("retrieval", f'{len(hits)} chunks retrieved for "{query}"', hits=[
        {"source": doc.metadata.get("source", "?"), "score": round(float(score), 2), "text": doc.page_content}
        for doc, score in hits
    ])
    if world.realtime:
        time.sleep(0.8)


class ViewerCallback(BaseCallbackHandler):
    """Sends the agent's messages and tool calls to the viewer as they happen."""

    def __init__(self, world: World = WORLD) -> None:
        self.world = world
        self._speaker: dict = {}  # model run id -> agent that is speaking

    def on_chat_model_start(self, serialized, messages, *, run_id, metadata=None, **kwargs) -> None:
        # create_agent(name="scout") tags its model calls with lc_agent_name; a plain graph
        # node (like the supervisor) is identified by its node name.
        metadata = metadata or {}
        speaker = metadata.get("lc_agent_name") or metadata.get("langgraph_node")
        self._speaker[run_id] = None if speaker in (None, "model") else speaker

    def on_llm_end(self, response, *, run_id, **kwargs) -> None:
        speaker = self._speaker.pop(run_id, None)
        for generation in response.generations[0]:
            message = getattr(generation, "message", None)
            if message is None:
                continue
            who = speaker or getattr(message, "name", None)
            for call in getattr(message, "tool_calls", None) or []:
                args = ", ".join(f"{k}={v!r}" for k, v in call["args"].items())
                self.world.emit("call", f"{call['name']}({args})", robot=who)
            if message.text.strip():
                self.world.emit("ai", message.text.strip(), robot=who)


class watch:
    """Wrap an agent (or any LangGraph graph) so the viewer shows what it does."""

    def __init__(self, agent, system: str | None = None, world: World = WORLD) -> None:
        self._agent, self._world, self._callback = agent, world, ViewerCallback(world)
        self._system = system  # shown once, like the SystemMessage in the web simulator

    def _prepare(self, inputs, config):
        if self._system:
            self._world.emit("system", self._system)
            self._system = None
        for msg in (inputs or {}).get("messages") or []:
            role = msg.get("role", "user") if isinstance(msg, dict) else getattr(msg, "type", "human")
            text = msg.get("content") if isinstance(msg, dict) else getattr(msg, "text", str(msg))
            self._world.emit("system" if role == "system" else "human", str(text))
        config = dict(config or {})
        config["callbacks"] = list(config.get("callbacks") or []) + [self._callback]
        return config

    def invoke(self, inputs, config=None, **kwargs):
        return self._agent.invoke(inputs, self._prepare(inputs, config), **kwargs)

    def stream(self, inputs, config=None, **kwargs):
        return self._agent.stream(inputs, self._prepare(inputs, config), **kwargs)

    def __getattr__(self, name):  # everything else (get_graph, ...) goes to the agent
        return getattr(self._agent, name)
