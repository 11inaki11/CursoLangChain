"""
lab_viewer.py — watch the lab live in your browser while an agent runs.

The same idea as the simulator on the course website, but driven by the
REAL agent: every tool call, message and robot movement shows up live at
http://localhost:8765.

    from lab_viewer import start_viewer, watch, wait_to_close
    start_viewer()                        # opens the browser
    agent = watch(create_agent(...))      # stream the agent's messages to it
    ...
    wait_to_close()                       # keep the page alive until Enter

Disable it with --no-viewer or LAB_VIEWER=0 (e.g. over SSH without a browser).
Standard library only: no extra install.
"""

from __future__ import annotations

import json
import os
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from langchain_core.callbacks import BaseCallbackHandler

from robot_world import WORLD, World

PAGE = Path(__file__).parent / "viewer" / "index.html"
_server: ThreadingHTTPServer | None = None


def enabled() -> bool:
    return "--no-viewer" not in sys.argv and os.getenv("LAB_VIEWER", "1") != "0"


def start_viewer(world: World = WORLD, port: int = 8765, open_browser: bool = True) -> str | None:
    """Serve the live viewer on localhost and open it. Returns the URL (or None if disabled)."""
    global _server
    if not enabled():
        return None

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path.startswith("/state"):
                body, ctype = json.dumps(world.snapshot()).encode(), "application/json"
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


class ViewerCallback(BaseCallbackHandler):
    """Sends the agent's messages and tool calls to the viewer as they happen."""

    def __init__(self, world: World = WORLD) -> None:
        self.world = world

    def on_llm_end(self, response, **kwargs) -> None:
        for generation in response.generations[0]:
            message = getattr(generation, "message", None)
            if message is None:
                continue
            for call in getattr(message, "tool_calls", None) or []:
                args = ", ".join(f"{k}={v!r}" for k, v in call["args"].items())
                self.world.emit("call", f"{call['name']}({args})", robot=getattr(message, "name", None))
            if message.text.strip():
                self.world.emit("ai", message.text.strip(), robot=getattr(message, "name", None))


class watch:
    """Wrap an agent (or any LangGraph graph) so the viewer shows what it does."""

    def __init__(self, agent, world: World = WORLD) -> None:
        self._agent, self._world, self._callback = agent, world, ViewerCallback(world)

    def _prepare(self, inputs, config):
        messages = (inputs or {}).get("messages") or []
        if messages:
            last = messages[-1]
            text = last.get("content") if isinstance(last, dict) else getattr(last, "text", str(last))
            self._world.emit("human", str(text))
        config = dict(config or {})
        config["callbacks"] = list(config.get("callbacks") or []) + [self._callback]
        return config

    def invoke(self, inputs, config=None, **kwargs):
        return self._agent.invoke(inputs, self._prepare(inputs, config), **kwargs)

    def stream(self, inputs, config=None, **kwargs):
        return self._agent.stream(inputs, self._prepare(inputs, config), **kwargs)

    def __getattr__(self, name):  # everything else (get_graph, ...) goes to the agent
        return getattr(self._agent, name)
