# Robot Agents · LangChain & LangGraph

An interactive, retro-80s tutorial for building LLM agents with LangChain and LangGraph. Every example is a robot.
The website **emulates** each agent run (no LLM behind it); the scripts in [`code/`](code/) are the **real**, runnable versions.

## Run the website locally

It's a static site with no build step. Any static server works:

```bash
python -m http.server 8000     # then open http://localhost:8000
```

To deploy, turn on GitHub Pages for the repo root (`main` / `/`).

## Structure

```
index.html                 Landing page: hero, live demo, roadmap, crew
chapters/welcome.html      Course intro, cast, philosophy, LangChain copilot power-ups
chapters/00-…07-*.html     One page per course block (plain HTML, edit directly)
assets/css/theme.css       Theme: colours, fonts, components (tokens at the top)
assets/js/site.js          CONFIG (chapters, authors/portfolios), layout, code blocks
assets/js/scenarios.js     Emulated traces for each simulator + diagram definitions
assets/js/sim.js           Robot lab simulator engine (mirrors code/robot_world.py)
assets/js/diagram.js       Step-by-step node/edge diagrams
assets/js/widgets.js       Concept animations: tool wiring, RAG explorer
code/                      Real Python scripts, one per chapter (see code/README.md)
```

## How to edit

| I want to… | Edit |
|---|---|
| Change author names, roles or portfolio links | `AUTHORS` in `assets/js/site.js` |
| Rename or reorder chapters | `CHAPTERS` in `assets/js/site.js` |
| Change what a simulator does | its entry in `SIM_SCENARIOS` (`assets/js/scenarios.js`) |
| Add a simulator to a page | `<div class="sim" id="sim-x" data-scenario="key"></div>` |
| Add a diagram | `<div class="diagram" data-diagram="key"></div>` + an entry in `DIAGRAMS` |
| Add tabs (same `data-group` = synced + remembered) | `<div class="tabs" data-group="provider"><div class="tab-panel" data-tab="Gemini">…</div>…</div>` |
| Add an "Ask your AI copilot" prompt | `<div class="prompt-box"><div class="prompt-head"><span class="pixel">🤖 ASK YOUR AI COPILOT</span></div><div class="prompt-text">…</div></div>` |
| Add a concept animation | `<div class="widget tool-wire"></div>` or `<div class="widget rag-explorer"></div>` |
| Add a code block | `<div class="code" data-file="x.py" data-download="code/x.py" data-run="sim-x"><pre><code class="lang-python">…</code></pre></div>` |

Code blocks get syntax highlighting, a **Copy** button, a **Full script** download and, with `data-run`, a **▶ Run** button that plays the linked simulator.
Mark unfinished parts with `<div class="todo">…</div>`.

**Keep the web and the code in sync.** The simulator's world rules and tool output strings match `code/robot_world.py`. If you change one, change the other.

The copilot power-ups on the welcome page (docs MCP servers, Skills and their prompts) are made by LangChain: see [docs.langchain.com/use-these-docs](https://docs.langchain.com/use-these-docs) and [langchain-ai/langchain-skills](https://github.com/langchain-ai/langchain-skills).
