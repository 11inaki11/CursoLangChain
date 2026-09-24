/* ==========================================================================
   widgets.js — concept animations.
     <div class="widget tool-wire"></div>     functions get @tool and plug into the agent
     <div class="widget rag-explorer"></div>  index manuals, embed a query, retrieve top-k
   ========================================================================== */

(() => {
  const NS = "http://www.w3.org/2000/svg";
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const el = (tag, attrs = {}, html = "") => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (html) e.innerHTML = html;
    return e;
  };

  /* ============================ TOOL WIRING ============================ */
  const FUNCS = [
    { name: "move_to", sig: "move_to(location: str)", doc: "Drive the robot to a location." },
    { name: "scan_surroundings", sig: "scan_surroundings()", doc: "Look around this location." },
    { name: "check_battery", sig: "check_battery()", doc: "Read the battery level (%)." },
    { name: "pick", sig: "pick(item: str)", doc: "Pick up an item." },
    { name: "place", sig: "place()", doc: "Place the held item here." },
    { name: "_calibrate_motors", sig: "_calibrate_motors()", doc: "Internal helper, not for the LLM.", helper: true },
  ];

  class ToolWire {
    constructor(root) {
      this.root = root;
      root.innerHTML = `
        <div class="widget-bar"><span class="title">PLUG TOOLS INTO THE AGENT</span>
          <button class="btn reset">↺ Unplug</button><button class="btn primary go">▶ Plug in</button></div>
        <svg viewBox="0 0 560 430"></svg>
        <div class="tw-schema"><div class="head">WHAT THE LLM SEES · tools=[…]</div><div class="rows"><span style="color:var(--dim)">Nothing yet: the LLM can only talk.</span></div></div>
        <div class="caption">Six plain Python functions. Press <b>Plug in</b> to turn them into tools.</div>`;
      this.svg = root.querySelector("svg");
      root.querySelector(".go").addEventListener("click", () => this.play());
      root.querySelector(".reset").addEventListener("click", () => this.reset());
      this.reset();
    }

    reset() {
      this.token = (this.token || 0) + 1;
      const s = this.svg;
      s.innerHTML = "";
      this.wires = el("g"); s.appendChild(this.wires);
      this.cards = FUNCS.map((f, i) => {
        const y = 14 + i * 69;
        const g = el("g", { class: "tw-card" });
        g.innerHTML = `
          <rect class="box" x="8" y="${y}" width="244" height="56" rx="10"/>
          <text x="22" y="${y + 23}"><tspan fill="#ff2a6d">def</tspan> ${f.sig}</text>
          <text class="doc" x="22" y="${y + 42}">"""${f.doc}"""</text>
          <text class="tw-badge" x="244" y="${y - 3}" text-anchor="end">@tool</text>`;
        s.appendChild(g);
        return { g, y: y + 28, f };
      });
      const agent = el("g", { class: "tw-agent" });
      agent.innerHTML = `
        <rect x="370" y="140" width="176" height="150" rx="16"/>
        <svg x="428" y="152" width="60" height="60" viewBox="0 0 12 12" shape-rendering="crispEdges">${RobotSprite.rects("pink")}</svg>
        <text x="458" y="236">Agent R-80</text>
        <text class="small" x="458" y="256">create_agent(model,</text>
        <text class="small count" x="458" y="272">tools=[ ] )</text>`;
      s.appendChild(agent);
      this.count = agent.querySelector(".count");
      this.root.querySelector(".rows").innerHTML = `<span style="color:var(--dim)">Nothing yet: the LLM can only talk.</span>`;
      this.caption("Six plain Python functions. Press <b>Plug in</b> to turn them into tools.");
      this.root.querySelector(".go").disabled = false;
    }

    caption(html) { this.root.querySelector(".caption").innerHTML = html; }

    wire(y, cls = "tw-wire") {
      const d = `M252,${y} C316,${y} 316,215 370,215`;
      const p = el("path", { d, class: cls });
      this.wires.appendChild(p);
      const L = p.getTotalLength();
      p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
      p.getBoundingClientRect();
      p.style.transition = "stroke-dashoffset .6s ease-out";
      p.style.strokeDashoffset = 0;
      return p;
    }

    async play() {
      this.reset();
      const tk = this.token;
      this.root.querySelector(".go").disabled = true;
      const rows = this.root.querySelector(".rows");
      rows.innerHTML = "";
      const names = [];
      for (const c of this.cards) {
        if (tk !== this.token) return;
        if (c.f.helper) {
          c.g.classList.add("off");
          this.caption(`<b>${c.f.name}</b> stays unplugged. You decide which functions the LLM is allowed to reach.`);
          await wait(1400);
          continue;
        }
        c.g.classList.add("on");
        this.caption(`<b>@tool</b> reads the name, type hints and docstring of <b>${c.f.name}</b>…`);
        await wait(550);
        this.wire(c.y);
        await wait(650);
        names.push(c.f.name);
        this.count.textContent = `tools=[${names.length}] )`;
        rows.insertAdjacentHTML("beforeend", `<div class="row"><b>${c.f.sig}</b> — ${c.f.doc}</div>`);
      }
      if (tk !== this.token) return;
      this.caption("Plugged in. Now the LLM <b>chooses</b> which tool to call. Operator: <i>“Go to shelf A”</i>…");
      await wait(1200);
      const w = this.wire(this.cards[0].y, "tw-wire fire");
      await wait(700);
      if (tk !== this.token) return;
      this.caption(`LLM → <b>move_to(location="shelf_a")</b>. The function runs in <i>your</i> code, and its return value goes back to the LLM.`);
      this.root.querySelector(".go").disabled = false;
    }
  }

  /* ============================ RAG EXPLORER ============================ */
  const DOC_COLORS = { "r80_manual.md": "#ff2a6d", "lab_safety.md": "#05d9e8" };
  const CHUNKS = [
    { src: "r80_manual.md", x: 60,  y: 58,  text: "Overview: wheeled lab robot, moves on a grid, carries one item at a time." },
    { src: "r80_manual.md", x: 112, y: 92,  text: "Specs: max payload 2.5 kg. Heavier items need two robots. 2% battery per step." },
    { src: "r80_manual.md", x: 196, y: 66,  text: "Gripper: fragile items (sensor kits) must be picked in SLOW mode." },
    { src: "r80_manual.md", x: 88,  y: 188, text: "Battery policy: below 20% return to the dock before any new task." },
    { src: "r80_manual.md", x: 142, y: 218, text: "Error codes: E01 path blocked · E02 overload · E07 low battery." },
    { src: "lab_safety.md", x: 272, y: 110, text: "Zone B (shelf_b): delicate instruments. Robots move in SLOW mode." },
    { src: "lab_safety.md", x: 302, y: 198, text: "Door: robots never leave the lab without human approval." },
    { src: "lab_safety.md", x: 222, y: 236, text: "Emergencies: on fire alarm, return to dock and power down grippers." },
  ];
  const QUERIES = [
    { q: "What is your max payload?", x: 140, y: 78 },
    { q: "Any rules for zone B?", x: 250, y: 98 },
    { q: "My display shows E07", x: 120, y: 206 },
    { q: "Can I take the wrench outside?", x: 286, y: 184 },
  ];
  const K = 2;

  class RagExplorer {
    constructor(root) {
      this.root = root;
      root.innerHTML = `
        <div class="widget-bar"><span class="title">RAG, STEP BY STEP</span>
          <button class="btn reset">↺ Reset</button><button class="btn primary build">▶ 1 · Build the index</button></div>
        <div class="rag-stages">
          <span class="phase">INDEX (ONCE)</span>
          <span class="rag-stage" data-s="load">Load</span><span class="rag-arrow">→</span>
          <span class="rag-stage" data-s="split">Split</span><span class="rag-arrow">→</span>
          <span class="rag-stage" data-s="embed">Embed</span><span class="rag-arrow">→</span>
          <span class="rag-stage" data-s="store">Store</span>
          <span class="phase" style="margin-left:14px">QUERY (EVERY QUESTION)</span>
          <span class="rag-stage" data-s="qembed">Embed query</span><span class="rag-arrow">→</span>
          <span class="rag-stage" data-s="search">Top-${K} search</span><span class="rag-arrow">→</span>
          <span class="rag-stage" data-s="augment">Augment prompt</span><span class="rag-arrow">→</span>
          <span class="rag-stage" data-s="generate">Generate</span>
        </div>
        <div class="sim-prompts queries"><span class="label">2 · ASK R-80 (AFTER BUILDING THE INDEX)</span>
          ${QUERIES.map((q, i) => `<button class="prompt-chip" data-i="${i}" disabled>${q.q}</button>`).join("")}</div>
        <div class="rag-body">
          <div><svg class="rag-space" viewBox="0 0 360 270"></svg></div>
          <div class="rag-panel"><h5 class="ph">WHAT GOES INTO THE LLM</h5><div class="rag-prompt"></div></div>
        </div>
        <div class="caption">Two manuals R-80 has never seen. Build the index first.</div>`;
      this.svg = root.querySelector("svg");
      root.querySelector(".build").addEventListener("click", () => this.build());
      root.querySelector(".reset").addEventListener("click", () => this.reset());
      root.querySelectorAll(".queries .prompt-chip").forEach((b) => b.addEventListener("click", () => this.ask(Number(b.dataset.i))));
      this.reset();
    }

    stage(name, cls = "on") {
      this.root.querySelectorAll(".rag-stage").forEach((s) => {
        if (s.dataset.s === name) { s.classList.remove("done"); s.classList.add(cls); }
        else if (s.classList.contains("on")) { s.classList.remove("on"); s.classList.add("done"); }
      });
    }
    caption(h) { this.root.querySelector(".caption").innerHTML = h; }

    reset() {
      this.token = (this.token || 0) + 1;
      this.built = false;
      this.root.querySelectorAll(".rag-stage").forEach((s) => s.classList.remove("on", "done"));
      this.root.querySelectorAll(".queries .prompt-chip").forEach((b) => { b.disabled = true; b.classList.remove("active"); });
      this.root.querySelector(".build").disabled = false;
      this.svg.innerHTML = `
        <rect x="0.5" y="0.5" width="359" height="269" rx="10" fill="none" stroke="#2e2270"/>
        <text x="10" y="262">vector space (2D projection of ~768 dims)</text>
        <circle cx="16" cy="14" r="4" fill="#ff2a6d"/><text x="24" y="17">r80_manual.md</text>
        <circle cx="106" cy="14" r="4" fill="#05d9e8"/><text x="114" y="17">lab_safety.md</text>
        <g class="links"></g><g class="dots"></g><g class="q"></g>
        <g class="docs">
          <g transform="translate(120,110)"><rect width="46" height="58" rx="4" fill="#170e3a" stroke="#ff2a6d"/><text x="23" y="34" text-anchor="middle" fill="#ff2a6d">R-80</text></g>
          <g transform="translate(196,110)"><rect width="46" height="58" rx="4" fill="#170e3a" stroke="#05d9e8"/><text x="23" y="34" text-anchor="middle" fill="#05d9e8">SAFETY</text></g>
        </g>`;
      this.root.querySelector(".rag-prompt").innerHTML = `<span style="color:var(--dim)">Without RAG the LLM only gets the question. It would have to guess R-80's payload.</span>`;
      this.caption("Two manuals R-80 has never seen. Build the index first.");
    }

    async build() {
      this.reset();
      const tk = this.token;
      this.root.querySelector(".build").disabled = true;
      this.stage("load");
      this.caption("<b>Load</b>: read the documents (Markdown, PDF, web pages…).");
      await wait(1000); if (tk !== this.token) return;
      this.stage("split");
      this.caption("<b>Split</b>: cut them into small chunks (~400 characters) so each one is about one thing.");
      const docs = this.svg.querySelector(".docs");
      docs.style.transition = "opacity .6s"; docs.style.opacity = 0;
      await wait(900); if (tk !== this.token) return;
      this.stage("embed");
      this.caption("<b>Embed</b>: an embeddings model turns each chunk into a vector. Similar meaning → nearby points.");
      const dots = this.svg.querySelector(".dots");
      for (const c of CHUNKS) {
        const d = el("circle", { class: "rag-dot", cx: c.x, cy: c.y, r: 0, fill: DOC_COLORS[c.src] });
        d.appendChild(el("title", {}, c.text));
        dots.appendChild(d);
        await wait(40);
        d.setAttribute("r", 7);
        await wait(180); if (tk !== this.token) return;
      }
      this.stage("store");
      this.caption("<b>Store</b>: vectors + text go into a vector store. This is done once, offline. <b>Now ask a question →</b>");
      await wait(700); if (tk !== this.token) return;
      this.built = true;
      this.root.querySelectorAll(".queries .prompt-chip").forEach((b) => (b.disabled = false));
    }

    async ask(i) {
      if (!this.built) return;
      this.token++;
      const tk = this.token, Q = QUERIES[i];
      this.root.querySelectorAll(".queries .prompt-chip").forEach((b) => b.classList.toggle("active", Number(b.dataset.i) === i));
      ["qembed", "search", "augment", "generate"].forEach((s) => this.root.querySelector(`[data-s="${s}"]`).classList.remove("on", "done"));
      const links = this.svg.querySelector(".links"), qg = this.svg.querySelector(".q");
      links.innerHTML = ""; qg.innerHTML = "";
      this.svg.querySelectorAll(".rag-dot").forEach((d) => { d.setAttribute("r", 7); d.style.opacity = 1; });
      const out = this.root.querySelector(".rag-prompt");
      out.innerHTML = "";

      this.stage("qembed");
      this.caption(`<b>Embed the question</b> with the same model, so it lands in the same space.`);
      qg.innerHTML = `<circle cx="${Q.x}" cy="${Q.y}" r="0" fill="#f9c80e" style="transition:r .4s"/><text x="${Q.x + 10}" y="${Q.y - 8}" fill="#f9c80e">query</text>`;
      await wait(60); qg.querySelector("circle").setAttribute("r", 8);
      await wait(900); if (tk !== this.token) return;

      this.stage("search");
      const ranked = CHUNKS.map((c, idx) => ({ ...c, idx, d: Math.hypot(c.x - Q.x, c.y - Q.y) })).sort((a, b) => a.d - b.d);
      const top = ranked.slice(0, K);
      this.caption(`<b>Search</b>: find the ${K} nearest chunks. Distance ≈ difference in meaning.`);
      const dotEls = this.svg.querySelectorAll(".rag-dot");
      dotEls.forEach((d, idx) => { if (!top.some((t) => t.idx === idx)) d.style.opacity = 0.25; });
      for (const t of top) {
        links.appendChild(el("line", { class: "rag-link", x1: Q.x, y1: Q.y, x2: t.x, y2: t.y }));
        dotEls[t.idx].setAttribute("r", 10);
        await wait(350);
      }
      await wait(600); if (tk !== this.token) return;

      this.stage("augment");
      this.caption("<b>Augment</b>: paste the retrieved chunks into the prompt, next to the question.");
      const seg = (label, color, text) => out.insertAdjacentHTML("beforeend", `<span class="seg" style="--c:${color}"><small>${label}</small>${text}</span>`);
      seg("SystemMessage", "var(--msg-system)", "You are R-80. Answer using the manual excerpts.");
      await wait(350);
      for (const t of top) {
        const score = 1 / (1 + t.d / 60);
        seg(`retrieved · ${t.src} · score ${score.toFixed(2)}`, "var(--msg-retrieval)", t.text);
        await wait(450); if (tk !== this.token) return;
      }
      seg("HumanMessage", "var(--msg-human)", Q.q);
      await wait(700); if (tk !== this.token) return;

      this.stage("generate");
      this.caption("<b>Generate</b>: the LLM answers from facts it was just handed, not from memory. Fewer hallucinations, and you can cite the source.");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".tool-wire").forEach((e) => new ToolWire(e));
    document.querySelectorAll(".rag-explorer").forEach((e) => new RagExplorer(e));
  });
})();
