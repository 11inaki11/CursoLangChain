"""
Chapter 6 — Mission control: talk to R-80 in natural language, live.

Streams every tool call as it happens and redraws the lab map.
Run:  python ch6_robot_control.py      (type 'quit' to exit)
"""

from langchain.agents import create_agent
from langgraph.checkpoint.memory import InMemorySaver

from ch2b_tools import make_robot_tools
from ch2c_rag import build_manual_tool
from config import get_model
from robot_world import WORLD

SYSTEM_PROMPT = (
    "You are R-80, a lab robot. Turn the operator's goal into a sequence of tool calls. "
    "Check battery before long trips, follow the manuals, and report when done."
)

if __name__ == "__main__":
    WORLD.add_robot("r80")
    agent = create_agent(
        model=get_model(),
        tools=make_robot_tools("r80") + [build_manual_tool()],
        system_prompt=SYSTEM_PROMPT,
        checkpointer=InMemorySaver(),
    )
    config = {"configurable": {"thread_id": "mission-control"}}
    print(WORLD.render())

    while (goal := input("\nOPERATOR > ").strip()) not in {"quit", "exit"}:
        inputs = {"messages": [{"role": "user", "content": goal}]}
        for chunk in agent.stream(inputs, config, stream_mode="updates"):
            for update in chunk.values():
                for msg in (update or {}).get("messages", []):
                    if getattr(msg, "tool_calls", None):
                        for call in msg.tool_calls:
                            print(f"  >> {call['name']}({call['args']})")
                    elif msg.type == "tool":
                        print(f"  << {msg.text}")
                    elif msg.text:
                        print(f"R-80 > {msg.text}")
        print(WORLD.render())
