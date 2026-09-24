"""
Chapter 3 — Talking to the robot: message types.

System  -> the robot's rules / personality (set by you, the developer)
Human   -> anything coming from OUTSIDE the agent: an operator... or another agent
AI      -> what this model answered, possibly with tool_calls
Tool    -> the result of running a tool, linked by tool_call_id
Run:  python ch3_messages.py
"""

from langchain.agents import create_agent
from langchain.messages import AIMessage, HumanMessage, SystemMessage

from ch2b_tools import make_robot_tools
from config import get_model
from robot_world import WORLD


def as_seen_by(agent_name: str, log: list[tuple[str, str]]) -> list:
    """Turn a shared multi-agent log into ONE agent's point of view.

    Its own lines are AIMessage; everyone else's are HumanMessage with a
    [FROM: ...] header, because for this agent they are external input.
    """
    return [
        AIMessage(text) if sender == agent_name else HumanMessage(f"[FROM: {sender}] {text}")
        for sender, text in log
    ]


if __name__ == "__main__":
    # --- 1. A single agent: the four message types ---
    WORLD.add_robot("r80")
    agent = create_agent(model=get_model(), tools=make_robot_tools("r80"))

    messages = [
        SystemMessage("You are R-80, a lab robot. Be brief."),
        HumanMessage("What's your battery, and what is on the workbench?"),
    ]
    result = agent.invoke({"messages": messages})

    print("=== Raw message history ===")
    for msg in result["messages"]:
        line = f"{type(msg).__name__:<14} | {msg.text[:70]!r}"
        if getattr(msg, "tool_calls", None):
            line += f" | tool_calls={[(c['name'], c['args']) for c in msg.tool_calls]}"
        if getattr(msg, "tool_call_id", None):
            line += f" | answers={msg.tool_call_id[:8]}..."
        print(line)

    # --- 2. Two agents talking: same log, two points of view (no LLM needed) ---
    log = [
        ("scout", "Sensor kit found at shelf_b. Zone B: SLOW mode."),
        ("grip", "Copy. Heading to shelf_b in SLOW mode."),
        ("scout", "Path is clear."),
    ]
    for robot in ("scout", "grip"):
        print(f"\n=== As seen by {robot.upper()} ===")
        for msg in as_seen_by(robot, log):
            print(f"{type(msg).__name__:<13}| {msg.text}")
