# Runnable code — Robot Agents with LangChain / LangGraph

Every script here is the real version of the emulated demos on the website.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in ONE key (the provider you'll use); leave the rest empty
python3 robot_world.py         # sanity check, no LLM needed: opens the live viewer
python3 ch2b_tools.py          # first robot agent with tools
```

| File | Chapter |
|---|---|
| `robot_world.py` | The simulated lab every chapter controls (pure Python) |
| `lab_viewer.py` + `viewer/` | Live viewer at http://localhost:8765: the real agent's messages, tool calls and robot moves |
| `config.py` | Loads `.env`, picks the model from the key you set, builds models and embeddings |
| `ch2a_models.py` | Your model; `--compare` runs every provider you have a key for |
| `ch2b_tools.py` | Python functions → tools (`move_to`, `pick`, `scan_surroundings`…) |
| `ch2c_rag.py` | Robot manuals → embeddings → `search_manuals` tool |
| `ch3_messages.py` | System / Human / AI / Tool messages, plus how each agent sees the others (`as_seen_by`) |
| `ch4_memory.py` | Checkpointer threads + summarization middleware |
| `ch5_multiagent.py` | Supervisor + SCOUT + GRIP as a LangGraph graph |
| `ch6_robot_control.py` | Interactive mission control with live streaming |
| `ch7_ros2_bridge.py` | ★ ROS 2 bridge: tools from a capability manifest + safety gate (works with or without ROS 2) |

Drop your own PDFs into `data/manuals/` and chapter 2c will index them too.

## One key is enough

You only need the API key of the provider you want to use. With `ROBOT_MODEL` empty,
every script uses the provider whose key it finds. RAG (chapter 2c) uses Gemini or
OpenAI embeddings if you have that key, and otherwise a local keyword search that
needs no key at all.

## Live viewer

Every script opens http://localhost:8765 in your browser and shows the lab as the agent
works. Keep that tab open: the next script reuses it and resets the lab to its initial
state. Press Enter in the terminal to close the viewer when a script ends.
Add `--no-viewer` (or `LAB_VIEWER=0`) to run in the terminal only.
