# Runnable code — Robot Agents with LangChain / LangGraph

Every script here is the real version of the emulated demos on the website.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # set ROBOT_MODEL + the key of your provider
python robot_world.py         # sanity check, no LLM needed
python ch2b_tools.py          # first robot agent with tools
```

| File | Chapter |
|---|---|
| `robot_world.py` | The simulated lab every chapter controls (pure Python) |
| `config.py` | Loads `.env`, builds any model or embeddings from a `"provider:model"` string |
| `ch2a_models.py` | Same agent, three brains: Gemini, DeepSeek, local Ollama |
| `ch2b_tools.py` | Python functions → tools (`move_to`, `pick`, `scan_surroundings`…) |
| `ch2c_rag.py` | Robot manuals → embeddings → `search_manuals` tool |
| `ch3_messages.py` | System / Human / AI / Tool messages, plus how each agent sees the others (`as_seen_by`) |
| `ch4_memory.py` | Checkpointer threads + summarization middleware |
| `ch5_multiagent.py` | Supervisor + SCOUT + GRIP as a LangGraph graph |
| `ch6_robot_control.py` | Interactive mission control with live streaming |
| `ch7_ros2_bridge.py` | ★ ROS 2 bridge: tools from a capability manifest + safety gate (works with or without ROS 2) |

Drop your own PDFs into `data/manuals/` and chapter 2c will index them too.
