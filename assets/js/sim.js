/* ==========================================================================
   sim.js — emulated robot lab. No LLM here: each run is a scripted trace
   (see scenarios.js) replayed step by step. The world rules and tool result
   strings mirror code/robot_world.py, so what you see matches the real code.

   Usage:  <div class="sim" id="sim-tools" data-scenario="ch2b-tools"></div>
   ========================================================================== */

(() => {
  const CELL = 56, GW = 8, GH = 6, STEP_COST = 2;
  const LOC = { dock: [0, 0], shelf_a: [7, 0], workbench: [3, 3], door: [0, 5], shelf_b: [7, 5] };
  const STATIONS = {
    dock:      { label: "DOCK",    color: "#3dfc9b" },
    shelf_a:   { label: "SHELF A", color: "#05d9e8" },
    workbench: { label: "BENCH",   color: "#f9c80e" },
    door:      { label: "DOOR",    color: "#b967ff" },
    shelf_b:   { label: "SHELF B", color: "#ff2a6d" },
  };
  const ITEMS = {
    red_cube:   { color: "#ff3b3b", w: 12, h: 12, rx: 2 },
    sensor_kit: { color: "#05d9e8", w: 16, h: 10, rx: 4 },
    wrench:     { color: "#f9c80e", w: 16, h: 5,  rx: 2 },
  };
  const INITIAL_ITEMS = { red_cube: "shelf_a", sensor_kit: "shelf_b", wrench: "workbench" };
  const pyList = (xs) => (xs.length ? `[${xs.map((x) => `'${x}'`).join(", ")}]` : "none");
  const CANCEL = Symbol("cancel");

  /* ---------------- World: same rules/strings as robot_world.py ---------------- */
  class World {
    constructor(robots, init = {}) {
      this.items = { ...INITIAL_ITEMS, ...(init.items || {}) };
      this.robots = {};
      robots.forEach((r) => {
        this.robots[r.id] = { id: r.id, name: r.name || r.id, palette: r.palette || "pink", position: r.at || "dock", battery: 100, holding: null, ...(init[r.id] || {}) };
      });
    }
    move_to(id, { location }) {
      const r = this.robots[id];
      if (!(location in LOC)) return `ERROR: unknown location '${location}'. Valid: ${pyList(Object.keys(LOC))}`;
      const [x0, y0] = LOC[r.position], [x1, y1] = LOC[location];
      const steps = Math.abs(x1 - x0) + Math.abs(y1 - y0), cost = steps * STEP_COST;
      if (cost > r.battery) return `ERROR: not enough battery (${r.battery}%) for ${steps} steps.`;
      r.battery -= cost; r.position = location;
      return `${id} arrived at ${location} after ${steps} steps. Battery: ${r.battery}%.`;
    }
    scan_surroundings(id) {
      const r = this.robots[id], [x, y] = LOC[r.position];
      const here = Object.keys(this.items).filter((k) => this.items[k] === r.position);
      const others = Object.values(this.robots).filter((o) => o.position === r.position && o.id !== id).map((o) => o.id);
      return `${id} at ${r.position} (${x}, ${y}). Items here: ${pyList(here)}. Other robots here: ${pyList(others)}. Holding: ${r.holding || "nothing"}.`;
    }
    check_battery(id) { return `${id} battery: ${this.robots[id].battery}%.`; }
    pick(id, { item }) {
      const r = this.robots[id];
      if (r.holding) return `ERROR: ${id} is already holding ${r.holding}.`;
      if (this.items[item] !== r.position) return `ERROR: ${item} is not at ${r.position}.`;
      this.items[item] = `robot:${id}`; r.holding = item;
      return `${id} picked up ${item}.`;
    }
    place(id) {
      const r = this.robots[id];
      if (!r.holding) return `ERROR: ${id} is not holding anything.`;
      const item = r.holding; r.holding = null; this.items[item] = r.position;
      return `${id} placed ${item} at ${r.position}.`;
    }
    charge(id) {
      const r = this.robots[id];
      if (r.position !== "dock") return `ERROR: ${id} must be at the dock to charge.`;
      r.battery = 100; return `${id} fully charged: 100%.`;
    }
  }

  /* ------------------------------ Simulator ------------------------------ */
  class RobotSim {
    constructor(el) {
      this.el = el;
      this.cfg = (window.SIM_SCENARIOS || {})[el.dataset.scenario];
      if (!this.cfg) { el.innerHTML = `<p style="padding:1rem">Unknown scenario "${el.dataset.scenario}"</p>`; return; }
      this.speed = 1;
      this.token = 0;
      this.active = 0;
      this.render();
      this.reset();
    }

    /* ---------- DOM skeleton ---------- */
    render() {
      const c = this.cfg;
      this.el.innerHTML = `
        <div class="sim-bar">
          <span class="led"></span>
          <span class="title">${c.title}</span>
          <span class="brain-badge" title="Model driving the agent">🧠 <span class="brain"></span></span>
          <span class="spacer"></span>
          <button class="btn speed" title="Playback speed">1×</button>
          <button class="btn reset">↺ Reset</button>
          <button class="btn primary play">▶ Run</button>
        </div>
        ${c.runs.length > 1 ? `<div class="sim-prompts"><span class="label">${c.pickLabel || "PICK A REQUEST"}</span>
          ${c.runs.map((r, i) => `<button class="prompt-chip" data-i="${i}">${r.label}</button>`).join("")}</div>` : ""}
        <div class="sim-body">
          <div class="sim-world"><svg viewBox="-6 -6 ${GW * CELL + 12} ${GH * CELL + 12}"></svg><div class="sim-hud"></div></div>
          <div class="sim-console">
            <div class="console-head"><span>AGENT CONSOLE · state["messages"]</span><span class="count">0 msgs</span></div>
            <div class="console-log"></div>
          </div>
        </div>`;
      this.$ = (s) => this.el.querySelector(s);
      this.svg = this.$("svg");
      this.log = this.$(".console-log");
      this.$(".play").addEventListener("click", () => this.play(this.active));
      this.$(".reset").addEventListener("click", () => this.reset());
      this.$(".speed").addEventListener("click", (e) => {
        this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
        e.target.textContent = `${this.speed}×`;
      });
      this.el.querySelectorAll(".prompt-chip").forEach((b) =>
        b.addEventListener("click", () => this.play(Number(b.dataset.i))));
    }

    select(i) {
      this.active = i;
      this.el.querySelectorAll(".prompt-chip").forEach((b) => b.classList.toggle("active", Number(b.dataset.i) === i));
      this.$(".brain").textContent = this.cfg.runs[i].brain || this.cfg.brain || "google_genai:gemini-3.7-flash";
    }

    reset(i = this.active) {
      this.token++;
      this.select(i);
      const run = this.cfg.runs[i];
      this.world = new World(this.cfg.robots, run.init || {});
      this.tokens = 0; this.summarized = false; this.callN = 0;
      this.$(".led").classList.remove("on");
      this.$(".play").disabled = false;
      this.log.innerHTML = `<div class="console-empty"><span class="pixel">READY_</span>Pick a request and press ▶ Run.<br>Everything here is emulated — the real code is right above.</div>`;
      this.drawWorld();
      this.drawHud();
      this.updateCount();
    }

    /* ---------- world drawing ---------- */
    cellCenter(loc) { const [x, y] = LOC[loc]; return [x * CELL + CELL / 2, y * CELL + CELL / 2]; }

    drawWorld() {
      let s = `<defs><filter id="glow-${this.el.id}"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++)
        s += `<rect class="w-cell" x="${x * CELL}" y="${y * CELL}" width="${CELL}" height="${CELL}"/>`;
      for (const [k, st] of Object.entries(STATIONS)) {
        const [x, y] = LOC[k];
        s += `<rect class="w-station" x="${x * CELL + 3}" y="${y * CELL + 3}" width="${CELL - 6}" height="${CELL - 6}" rx="8" stroke="${st.color}" filter="url(#glow-${this.el.id})" opacity=".9"/>
              <text class="w-label" x="${x * CELL + CELL / 2}" y="${y * CELL + CELL - 8}" fill="${st.color}">${st.label}</text>`;
      }
      s += `<g class="items"></g><g class="robots"></g><g class="fx"></g>`;
      this.svg.innerHTML = s;
      this.itemEls = {};
      for (const [k, it] of Object.entries(ITEMS)) {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "w-item");
        g.innerHTML = `<rect x="${-it.w / 2}" y="${-it.h / 2}" width="${it.w}" height="${it.h}" rx="${it.rx}" fill="${it.color}" stroke="#0b0620" stroke-width="1.5"/>`;
        this.svg.querySelector(".items").appendChild(g);
        this.itemEls[k] = g;
      }
      this.robotEls = {};
      Object.values(this.world.robots).forEach((r, i) => {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "w-robot");
        g.innerHTML = `
          <circle class="halo" r="24" fill="none" stroke="${RobotSprite.PALETTES[r.palette].h}" stroke-width="2" stroke-dasharray="4 4"/>
          <g class="bob"><svg x="-17" y="-22" width="34" height="34" viewBox="0 0 12 12" shape-rendering="crispEdges">${RobotSprite.rects(r.palette)}</svg></g>
          <g class="carry" transform="translate(0,-28)"></g>
          <g class="w-bubble" opacity="0" transform="translate(0,-44)"><rect rx="5" height="16" y="-8" fill="#ece8ff"/><text y="3" text-anchor="middle"></text></g>`;
        this.svg.querySelector(".robots").appendChild(g);
        this.robotEls[r.id] = g;
        g.dataset.slot = i;
      });
      this.placeAll(true);
    }

    robotXY(r) {
      const [cx, cy] = this.cellCenter(r.position);
      const n = Object.keys(this.world.robots).length;
      const slot = Number(this.robotEls[r.id].dataset.slot);
      return [cx + (n > 1 ? (slot - (n - 1) / 2) * 20 : 0), cy - 4];
    }

    placeAll(instant) {
      const byLoc = {};
      for (const [k, where] of Object.entries(this.world.items)) {
        const g = this.itemEls[k];
        if (where.startsWith("robot:")) { g.style.opacity = 0; continue; }
        byLoc[where] = (byLoc[where] || 0) + 1;
        const [cx, cy] = this.cellCenter(where);
        const off = (byLoc[where] - 1) * 14 - 8;
        g.style.opacity = 1;
        g.style.transform = `translate(${cx + off}px, ${cy + 8}px)`;
      }
      for (const r of Object.values(this.world.robots)) {
        const g = this.robotEls[r.id];
        if (instant) g.style.setProperty("--dur", "0s");
        const [x, y] = this.robotXY(r);
        g.style.transform = `translate(${x}px, ${y}px)`;
        const it = r.holding && ITEMS[r.holding];
        g.querySelector(".carry").innerHTML = it
          ? `<rect x="${-it.w / 2}" y="${-it.h / 2}" width="${it.w}" height="${it.h}" rx="${it.rx}" fill="${it.color}" stroke="#0b0620" stroke-width="1.5"/>` : "";
      }
      if (instant) requestAnimationFrame(() => Object.values(this.robotEls).forEach((g) => g.style.removeProperty("--dur")));
    }

    async animateMove(id, from, to, tk) {
      const g = this.robotEls[id], r = this.world.robots[id];
      const [x0, y0] = LOC[from], [x1, y1] = LOC[to];
      const legs = [[x1, y0, Math.abs(x1 - x0)], [x1, y1, Math.abs(y1 - y0)]];
      const [ox, oy] = [this.robotXY(r)[0] - this.cellCenter(to)[0], -4];
      for (const [lx, ly, cells] of legs) {
        if (!cells) continue;
        const dur = (cells * 170) / this.speed;
        g.style.setProperty("--dur", `${dur}ms`);
        g.style.transform = `translate(${lx * CELL + CELL / 2 + ox}px, ${ly * CELL + CELL / 2 + oy}px)`;
        await this.sleep(dur + 40, tk);
      }
      g.style.removeProperty("--dur");
    }

    bubble(id, text, on = true) {
      const b = this.robotEls[id]?.querySelector(".w-bubble");
      if (!b) return;
      if (on) {
        const t = text.length > 28 ? text.slice(0, 27) + "…" : text;
        b.querySelector("text").textContent = t;
        const w = t.length * 5.6 + 14;
        b.querySelector("rect").setAttribute("width", w);
        b.querySelector("rect").setAttribute("x", -w / 2);
      }
      b.setAttribute("opacity", on ? 1 : 0);
    }

    scanFx(id) {
      const [x, y] = this.robotXY(this.world.robots[id]);
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("class", "w-scan"); c.setAttribute("cx", x); c.setAttribute("cy", y);
      c.setAttribute("fill", "none"); c.setAttribute("stroke", "#05d9e8"); c.setAttribute("stroke-width", 2);
      this.svg.querySelector(".fx").appendChild(c);
      setTimeout(() => c.remove(), 1100);
    }

    setActive(id) {
      Object.entries(this.robotEls).forEach(([k, g]) => g.classList.toggle("active", k === id));
      this.el.querySelectorAll(".hud-card[data-robot]").forEach((c) => c.classList.toggle("active", c.dataset.robot === id));
    }

    /* ---------- HUD ---------- */
    drawHud() {
      const c = this.cfg;
      let h = Object.values(this.world.robots).map((r) => `
        <div class="hud-card" data-robot="${r.id}">${r.name} · <b class="pos">${r.position}</b>
          <div>🔋 <b class="bat">${r.battery}%</b> · ✋ <b class="hold">${r.holding || "—"}</b></div>
          <div class="hud-bar"><i style="width:${r.battery}%"></i></div></div>`).join("");
      if (c.rag) h += `<div class="hud-card" data-rag>📚 Vector store<div><b>${c.rag}</b></div></div>`;
      if (c.memory) h += `<div class="hud-card" data-thread>🧵 thread_id<div><b class="thread">—</b></div></div>`;
      if (c.tokenTrigger) h += `<div class="hud-card" data-tokens>🪙 Context tokens<div><b class="tok">0</b> / trigger ${c.tokenTrigger}</div><div class="hud-bar tokens"><i style="width:0%"></i></div></div>`;
      this.$(".sim-hud").innerHTML = h;
    }

    updateHud() {
      Object.values(this.world.robots).forEach((r) => {
        const card = this.el.querySelector(`.hud-card[data-robot="${r.id}"]`);
        card.querySelector(".pos").textContent = r.position;
        card.querySelector(".bat").textContent = `${r.battery}%`;
        card.querySelector(".hold").textContent = r.holding || "—";
        card.querySelector(".hud-bar i").style.width = `${r.battery}%`;
      });
      if (this.cfg.tokenTrigger) {
        this.$(".tok").textContent = this.tokens;
        const bar = this.$(".hud-bar.tokens i");
        bar.style.width = `${Math.min(100, (this.tokens / this.cfg.tokenTrigger) * 100)}%`;
      }
    }

    /* ---------- console ---------- */
    msg(kind, label, body, extra = "") {
      this.log.querySelector(".console-empty")?.remove();
      const d = document.createElement("div");
      d.className = `msg ${kind}`;
      d.innerHTML = `<div class="kind">${label}</div><div class="body"></div>${extra}`;
      d.querySelector(".body").textContent = body || "";
      this.log.appendChild(d);
      this.log.scrollTop = this.log.scrollHeight;
      if (!["note", "route", "thread"].includes(kind)) this.addTokens(body + extra.replace(/<[^>]+>/g, ""));
      this.updateCount();
      return d;
    }
    raw(text) { return this.cfg.verbose ? `<pre>${escapeHtml(text)}</pre>` : ""; }
    addTokens(text) { this.tokens += Math.ceil((text || "").length / 4) + 6; this.updateHud(); }
    updateCount() { this.$(".count").textContent = `${this.log.querySelectorAll(".msg:not(.note):not(.route):not(.collapsed)").length} msgs`; }

    async typeInto(el, text, tk) {
      el.textContent = "";
      const chunk = Math.max(1, Math.round(2 * this.speed));
      for (let i = 0; i < text.length; i += chunk) {
        el.textContent = text.slice(0, i + chunk);
        this.log.scrollTop = this.log.scrollHeight;
        await this.sleep(14, tk);
      }
    }

    fill(text) { return (text || "").replace(/\{(\w+)\.(\w+)\}/g, (m, r, k) => this.world.robots[r]?.[k] ?? m); }

    sleep(ms, tk) {
      return new Promise((res, rej) => setTimeout(() => (tk !== this.token ? rej(CANCEL) : res()), ms / this.speed));
    }

    async maybeSummarize(run, tk) {
      const trig = this.cfg.tokenTrigger;
      if (!trig || this.summarized || this.tokens < trig || !run.summary) return;
      this.summarized = true;
      this.msg("note", "⚙ SummarizationMiddleware", `Context passed ${trig} tokens → summarizing old messages, keeping the last ${this.cfg.keep || 2}.`);
      await this.sleep(700, tk);
      const all = [...this.log.querySelectorAll(".msg:not(.note)")];
      all.slice(0, Math.max(0, all.length - (this.cfg.keep || 2))).forEach((m) => m.classList.add("collapsed"));
      await this.sleep(600, tk);
      this.tokens = 0;
      const keep = all.slice(-(this.cfg.keep || 2));
      keep.forEach((m) => this.addTokens(m.textContent));
      this.msg("summary", "HumanMessage · summary of earlier conversation", this.fill(run.summary));
      await this.sleep(700, tk);
    }

    /* ---------- playback ---------- */
    async play(i = this.active) {
      this.reset(i);
      const tk = this.token, run = this.cfg.runs[i];
      this.$(".led").classList.add("on");
      this.$(".play").disabled = true;
      try {
        for (const step of run.steps) await this.exec(step, run, tk);
        this.setActive(null);
      } catch (e) { if (e !== CANCEL) throw e; return; }
      this.$(".led").classList.remove("on");
      this.$(".play").disabled = false;
      this.$(".play").textContent = "▶ Replay";
    }

    async exec(s, run, tk) {
      const first = Object.keys(this.world.robots)[0];
      const robot = s.robot || first;
      const rName = this.world.robots[robot]?.name || robot;
      switch (s.t) {
        case "note":
          this.msg("note", "// note", s.text); await this.sleep(s.ms || 900, tk); break;

        case "system":
          this.msg("system", "SystemMessage", s.text, this.raw(`SystemMessage(content=${JSON.stringify(s.text)})`));
          await this.sleep(500, tk); break;

        case "human":
          this.msg("human", "HumanMessage · operator", s.text, this.raw(`HumanMessage(content=${JSON.stringify(s.text)})`));
          await this.sleep(600, tk); break;

        case "thread":
          this.$(".thread") && (this.$(".thread").textContent = s.id);
          if (s.fresh) { this.log.querySelectorAll(".msg").forEach((m) => m.classList.add("collapsed")); this.tokens = 0; }
          this.msg("note", `🧵 thread_id="${s.id}"`, s.fresh ? "New thread → the checkpointer has no history for it. Memory starts empty." : "Same thread → the checkpointer reloads previous messages.");
          await this.sleep(900, tk); break;

        case "route": {
          this.setActive(s.to === "FINISH" ? null : s.to);
          const target = s.to === "FINISH" ? "END" : (this.world.robots[s.to]?.name || s.to);
          this.msg("route", `supervisor → ${target}`, s.task || "Mission complete.");
          document.dispatchEvent(new CustomEvent("sim:route", { detail: { to: s.to } }));
          await this.sleep(1000, tk); break;
        }

        case "ai": {
          await this.maybeSummarize(run, tk);
          this.setActive(robot);
          const label = s.name ? `AIMessage · name="${s.name}"` : `AIMessage · ${rName}`;
          const d = this.msg("ai", label, "");
          d.querySelector(".body").innerHTML = `<span class="thinking"><i></i><i></i><i></i></span>`;
          await this.sleep(s.think || 900, tk);
          const text = this.fill(s.text);
          await this.typeInto(d.querySelector(".body"), text, tk);
          this.addTokens(text);
          if (this.cfg.verbose) d.insertAdjacentHTML("beforeend", this.raw(`AIMessage(content=${JSON.stringify(text)})`));
          this.bubble(robot, "💬", true); await this.sleep(500, tk); this.bubble(robot, "", false);
          break;
        }

        case "call": {
          await this.maybeSummarize(run, tk);
          this.setActive(robot);
          const args = s.args || {};
          const id = `call_${String(++this.callN).padStart(2, "0")}`;
          const argStr = Object.entries(args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ");
          const d = this.msg("ai", `AIMessage · tool_call${this.cfg.verbose ? ` · id=${id}` : ""}`, "");
          d.querySelector(".body").innerHTML = `<span class="thinking"><i></i><i></i><i></i></span>`;
          await this.sleep(s.think || 700, tk);
          d.querySelector(".body").innerHTML = `<span class="call">${escapeHtml(s.name)}(${escapeHtml(argStr)})</span>`;
          if (this.cfg.verbose) d.insertAdjacentHTML("beforeend", this.raw(`AIMessage(content="", tool_calls=[{"name": "${s.name}", "args": ${JSON.stringify(args)}, "id": "${id}"}])`));
          this.bubble(robot, `${s.name}()`, true);
          await this.sleep(400, tk);

          // --- execute the tool on the emulated world ---
          let result, extra = "";
          if (s.name === "search_manuals") {
            const rag = this.el.querySelector(".hud-card[data-rag]");
            rag && rag.classList.add("active");
            await this.sleep(900, tk);
            rag && rag.classList.remove("active");
            result = (s.hits || []).map((h) => `[${h.src}] ${h.text}`).join("\n\n");
            extra = (s.hits || []).map((h) => `<div class="hit"><b>${h.src} · score ${h.score.toFixed(2)}</b><br>${escapeHtml(h.text)}</div>`).join("");
            this.bubble(robot, "", false);
            this.msg("retrieval", `ToolMessage · search_manuals${this.cfg.verbose ? ` · tool_call_id=${id}` : ""}`, `${(s.hits || []).length} chunks retrieved for "${args.query}"`, extra);
          } else {
            const from = this.world.robots[robot].position;
            result = s.result || (this.world[s.name] ? this.world[s.name](robot, args) : `ok`);
            if (s.name === "move_to" && !result.startsWith("ERROR")) await this.animateMove(robot, from, args.location, tk);
            if (s.name === "scan_surroundings") { this.scanFx(robot); await this.sleep(600, tk); }
            this.placeAll(false);
            this.updateHud();
            this.bubble(robot, "", false);
            this.msg("tool", `ToolMessage · ${s.name}${this.cfg.verbose ? ` · tool_call_id=${id}` : ""}`, result,
              this.raw(`ToolMessage(content=${JSON.stringify(result)}, tool_call_id="${id}")`));
          }
          await this.sleep(500, tk);
          break;
        }

        case "go": { // guided tour: move without an agent turn, narrate
          this.setActive(robot);
          const from = this.world.robots[robot].position;
          this.world.move_to(robot, { location: s.to });
          await this.animateMove(robot, from, s.to, tk);
          this.placeAll(false); this.updateHud();
          this.msg("note", `📍 ${s.to}`, s.text);
          await this.sleep(s.ms || 1300, tk);
          break;
        }

        case "wait":
          await this.sleep(s.ms || 600, tk); break;
      }
    }
  }

  window.SIMS = window.SIMS || {};
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".sim[data-scenario]").forEach((el, i) => {
      if (!el.id) el.id = `sim-${i}`;
      window.SIMS[el.id] = new RobotSim(el);
    });
  });
})();
