"""
Chapter 2a — Same robot, different brains.

The agent is identical; only the model string changes.
Run:  python3 ch2a_models.py             your model (ROBOT_MODEL, or the key you set)
      python3 ch2a_models.py --compare   every provider you have a key for (+ Ollama if running)
"""

import sys

from langchain.agents import create_agent

from config import DEFAULT_MODEL, available_models, get_model

SYSTEM_PROMPT = (
    "You are R-80, a friendly lab robot built in 1986. "
    "You speak like a retro computer terminal. Answer in at most 2 sentences."
)


def boot(brain: str) -> None:
    agent = create_agent(model=get_model(brain), system_prompt=SYSTEM_PROMPT)
    result = agent.invoke({"messages": [{"role": "user", "content": "Boot up and introduce yourself."}]})
    print(f"\n[{brain}]\n{result['messages'][-1].text}")


if __name__ == "__main__":
    brains = available_models() if "--compare" in sys.argv else [DEFAULT_MODEL]
    for brain in brains:
        try:
            boot(brain)
        except Exception as exc:  # wrong key, package not installed, Ollama model not pulled...
            print(f"\n[{brain}] failed -> {exc}")
