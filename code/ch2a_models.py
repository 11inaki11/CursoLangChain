"""
Chapter 2a — Same robot, different brains.

The agent is identical; only the model string changes.
Run:  python ch2a_models.py
"""

from langchain.agents import create_agent

from config import DEFAULT_MODEL, LOCAL_MODEL, get_model

SYSTEM_PROMPT = (
    "You are R-80, a friendly lab robot built in 1986. "
    "You speak like a retro computer terminal. Answer in at most 2 sentences."
)

BRAINS = [
    DEFAULT_MODEL,             # Gemini (cloud)
    "deepseek:deepseek-chat",  # DeepSeek (cloud)
    LOCAL_MODEL,               # Ollama (local / SSH tunnel)
]

if __name__ == "__main__":
    for brain in BRAINS:
        try:
            agent = create_agent(model=get_model(brain), system_prompt=SYSTEM_PROMPT)
            result = agent.invoke(
                {"messages": [{"role": "user", "content": "Boot up and introduce yourself."}]}
            )
            print(f"\n[{brain}]\n{result['messages'][-1].text}")
        except Exception as exc:  # missing key, Ollama not running...
            print(f"\n[{brain}] skipped -> {exc}")
