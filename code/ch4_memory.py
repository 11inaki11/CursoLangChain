"""
Chapter 4 — Robot memory.

1. A checkpointer stores each conversation (thread) so the robot remembers.
2. SummarizationMiddleware compresses old messages before the context overflows.
Run:  python ch4_memory.py
"""

from langchain.agents import create_agent
from langchain.agents.middleware import SummarizationMiddleware
from langgraph.checkpoint.memory import InMemorySaver

from ch2b_tools import make_robot_tools
from config import get_model
from robot_world import WORLD


def ask(agent, text: str, thread: str) -> None:
    config = {"configurable": {"thread_id": thread}}
    result = agent.invoke({"messages": [{"role": "user", "content": text}]}, config)
    print(f"[{thread}] OPERATOR: {text}\n[{thread}] R-80: {result['messages'][-1].text}\n")


if __name__ == "__main__":
    WORLD.add_robot("r80")
    agent = create_agent(
        model=get_model(),
        tools=make_robot_tools("r80"),
        system_prompt="You are R-80, a lab robot. Be brief.",
        checkpointer=InMemorySaver(),  # swap for SqliteSaver/PostgresSaver to persist on disk
        middleware=[
            SummarizationMiddleware(
                model=get_model(),
                trigger=("tokens", 1500),  # summarize when history gets this big...
                keep=("messages", 6),      # ...but keep the last 6 messages verbatim
            )
        ],
    )

    ask(agent, "Remember: the red cube is fragile, handle it gently.", thread="mission-1")
    ask(agent, "What do you know about the red cube?", thread="mission-1")  # remembers
    ask(agent, "What do you know about the red cube?", thread="mission-2")  # new thread: forgets
