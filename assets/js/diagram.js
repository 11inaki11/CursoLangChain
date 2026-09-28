/* ==========================================================================
   diagram.js — node/edge diagrams that build up layer by layer, with an
   optional "trace" that sends a pulse along a path of edges.

   Usage:  <div class="diagram" data-diagram="ch1-stack"></div>
   Config: window.DIAGRAMS in scenarios.js
   ========================================================================== */

(() => {
  const NS = "http://www.w3.org/2000/svg";
  const COLORS = { pink: "#ff2a6d", cyan: "#05d9e8", yellow: "#f9c80e", purple: "#b967ff", green: "#3dfc9b", orange: "#ff8a3d", gold: "#ffcf40", dim: "#6f68a3" };

  function anchor(n, tx, ty) {
    // point on the border of node n in the direction of (tx, ty)
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2, dx = tx - cx, dy = ty - cy;
    const t = Math.min(Math.abs(n.w / 2 / (dx || 1e-6)), Math.abs(n.h / 2 / (dy || 1e-6)));
    return [cx + dx * t, cy + dy * t];
  }

  class Diagram {
    constructor(el) {
      this.el = el;
      this.cfg = (window.DIAGRAMS || {})[el.dataset.diagram];
      if (!this.cfg) return;
      this.stage = this.cfg.startAt ?? 0;
      this.build();
      this.show(this.stage);
      if (this.cfg.listen) document.addEventListener("sim:route", (e) => this.pulse(e.detail.to === "FINISH" ? "end" : e.detail.to));
    }

    build() {
      const c = this.cfg, stages = c.stages.length;
      this.el.innerHTML = `
        <div class="diagram-controls">
          <span class="step"></span>
          <span class="caption"></span>
          <button class="btn prev">◀</button>
          <button class="btn next">Next ▶</button>
          ${c.trace ? `<button class="btn run trace">▶ Trace a run</button>` : ""}
        </div>
        <svg viewBox="${c.viewBox.join(" ")}"></svg>
        ${c.state ? `<div class="d-state"><div class="d-state-head"><span>${c.state.name} · live</span><span class="d-state-by"></span></div><div class="d-state-rows"></div></div>` : ""}`;
      const svg = (this.svg = this.el.querySelector("svg"));
      const byId = Object.fromEntries(c.nodes.map((n) => [n.id, n]));
      this.byId = byId;

      const defs = document.createElementNS(NS, "defs");
      defs.innerHTML = Object.entries(COLORS).map(([k, v]) =>
        `<marker id="arr-${k}-${this.el.dataset.diagram}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${v}"/></marker>`).join("");
      svg.appendChild(defs);

      // zoom: { stage, scale, dx, dy } shrinks every earlier layer into one cluster
      const z = c.zoom;
      const inWorld = (item) => z && (item.stage ?? 0) < z.stage;
      const layer = () => { const g = document.createElementNS(NS, "g"); return g; };
      this.world = layer(); this.world.setAttribute("class", "d-world");
      const worldEdges = layer(), worldNodes = layer(), topEdges = layer(), topNodes = layer();
      this.world.append(worldEdges, worldNodes);
      svg.append(this.world, topEdges, topNodes);
      const tag = (g, item) => {
        g.dataset.stage = item.stage ?? 0;
        if (item.until != null) g.dataset.until = item.until;
        if (item.delay) g.style.transitionDelay = `${item.delay}s`;
      };

      this.edgeEls = {};
      c.edges.forEach((e) => {
        const a = byId[e.from], b = byId[e.to];
        const [ax, ay] = anchor(a, b.x + b.w / 2, b.y + b.h / 2);
        const [bx, by] = anchor(b, a.x + a.w / 2, a.y + a.h / 2);
        const bend = e.bend || 0, mx = (ax + bx) / 2, my = (ay + by) / 2;
        const len = Math.hypot(bx - ax, by - ay) || 1;
        const qx = mx - ((by - ay) / len) * bend, qy = my + ((bx - ax) / len) * bend;
        // label sits at the curve's midpoint, pushed out along the normal so it never sits on the line
        const nx = -(by - ay) / len, ny = (bx - ax) / len, side = bend ? Math.sign(bend) : -1;
        const lx = (mx + qx) / 2 + nx * side * 14, ly = (my + qy) / 2 + ny * side * 14 + 4;
        const col = e.color || "dim";
        const g = document.createElementNS(NS, "g");
        g.setAttribute("class", `d-edge${e.dashed ? " dashed" : ""}${e.thin ? " thin" : ""}`);
        tag(g, e);
        const marker = `url(#arr-${col}-${this.el.dataset.diagram})`;
        g.innerHTML = `<path d="M${ax},${ay} Q${qx},${qy} ${bx},${by}" stroke="${COLORS[col]}" ${e.arrow === false ? "" : `marker-end="${marker}"`} ${e.both ? `marker-start="${marker}"` : ""}/>
          ${e.label ? `<text x="${lx}" y="${ly}" text-anchor="middle">${e.label}</text>` : ""}`;
        (inWorld(e) ? worldEdges : topEdges).appendChild(g);
        this.edgeEls[`${e.from}>${e.to}`] = g;
      });

      this.nodeEls = {};
      c.nodes.forEach((n) => {
        if (n.virtual) return;                        // anchor-only node (e.g. a spot inside a zoomed cluster)
        const col = COLORS[n.color || "cyan"];
        const g = document.createElementNS(NS, "g");
        tag(g, n);
        if (n.shape === "zone") {                     // dashed boundary around an agent's own nodes
          g.setAttribute("class", "d-zone");
          g.style.color = col;
          g.innerHTML = `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="18" stroke="${col}"/>`;
          (inWorld(n) ? worldNodes : topNodes).appendChild(g);
          return;
        }
        g.setAttribute("class", `d-node${n.small ? " small" : ""}`);
        g.style.color = col;
        const round = n.shape === "pill" ? n.h / 2 : n.small ? 8 : 12;
        g.innerHTML = `
          <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${round}" stroke="${col}"/>
          ${n.sprite ? `<svg x="${n.x + 10}" y="${n.y + n.h / 2 - 14}" width="28" height="28" viewBox="0 0 12 12" shape-rendering="crispEdges">${RobotSprite.rects(n.sprite)}</svg>` : ""}
          <text x="${n.x + n.w / 2 + (n.sprite ? 14 : 0)}" y="${n.y + n.h / 2 + (n.sub ? -3 : 5)}">${n.label}</text>
          ${n.sub ? `<text class="sub" x="${n.x + n.w / 2 + (n.sprite ? 14 : 0)}" y="${n.y + n.h / 2 + 14}">${n.sub}</text>` : ""}`;
        (inWorld(n) ? worldNodes : topNodes).appendChild(g);
        this.nodeEls[n.id] = g;
      });

      if (c.state) this.resetState();
      this.el.querySelector(".prev").addEventListener("click", () => this.show(this.stage - 1));
      this.el.querySelector(".next").addEventListener("click", () => this.show(this.stage + 1));
      this.el.querySelector(".trace")?.addEventListener("click", () => this.trace());
    }

    show(i) {
      const max = this.cfg.stages.length - 1;
      this.stage = Math.max(0, Math.min(max, i));
      this.svg.querySelectorAll("[data-stage]").forEach((g) => g.classList.toggle("d-hidden",
        Number(g.dataset.stage) > this.stage || (g.dataset.until != null && this.stage >= Number(g.dataset.until))));
      const z = this.cfg.zoom;
      if (z) this.world.style.transform = this.stage >= z.stage ? `translate(${z.dx}px, ${z.dy}px) scale(${z.scale})` : "";
      // pulse what just appeared
      this.svg.querySelectorAll(`.d-node[data-stage="${this.stage}"]`).forEach((g) => { g.classList.remove("pulse"); void g.getBBox(); g.classList.add("pulse"); });
      this.el.querySelector(".step").textContent = `LAYER ${this.stage + 1}/${max + 1}`;
      this.el.querySelector(".caption").textContent = this.cfg.stages[this.stage];
      this.el.querySelector(".prev").disabled = this.stage === 0;
      this.el.querySelector(".next").disabled = this.stage === max;
    }

    /* ---------- live state panel (optional: cfg.state) ----------
       cfg.state = { name, fields: [{ key, type, merge }], initial: {...} }
       trace steps may carry a 4th element: { by, set: {key: value}, append: {key: item} } */
    resetState() {
      this.stateValues = JSON.parse(JSON.stringify(this.cfg.state.initial));
      this.renderState();
      this.el.querySelector(".d-state-by").textContent = "";
    }

    renderState(changed = []) {
      const fmt = (v) => Array.isArray(v)
        ? (v.length ? v.map((m) => `<span class="d-chip">${m}</span>`).join("") : `<span class="d-empty">[ ]</span>`)
        : `<code>${JSON.stringify(v)}</code>`;
      this.el.querySelector(".d-state-rows").innerHTML = this.cfg.state.fields.map((f) => `
        <div class="d-row${changed.includes(f.key) ? " changed" : ""}">
          <span class="d-key">${f.key}</span><span class="d-type">${f.type}</span>
          <span class="d-val">${fmt(this.stateValues[f.key])}</span><span class="d-merge">${f.merge}</span>
        </div>`).join("");
    }

    applyWrite(w) {
      const changed = [];
      for (const [k, v] of Object.entries(w.set || {})) { this.stateValues[k] = v; changed.push(k); }
      for (const [k, v] of Object.entries(w.append || {})) { this.stateValues[k] = [...this.stateValues[k], v]; changed.push(k); }
      this.renderState(changed);
      this.el.querySelector(".d-state-by").innerHTML = `written by <b>${w.by}</b>: ${changed.join(", ")}`;
    }

    pulse(id) {
      const g = this.nodeEls[id];
      if (!g) return;
      g.classList.remove("pulse"); void g.getBBox(); g.classList.add("pulse");
    }

    async trace() {
      this.show(this.cfg.stages.length - 1);
      const btn = this.el.querySelector(".trace");
      btn.disabled = true;
      if (this.cfg.state) this.resetState();
      for (const [from, to, note, write] of this.cfg.trace) {
        const edge = this.edgeEls[`${from}>${to}`];
        if (!edge) continue;
        if (note) this.el.querySelector(".caption").textContent = note;
        if (write && this.cfg.state) {       // the node that just ran writes to the state…
          this.pulse(from);
          this.applyWrite(write);
          await new Promise((r) => setTimeout(r, 1400));
        }                                      // …then the edge carries control to the next node
        const path = edge.querySelector("path"), L = path.getTotalLength();
        const dot = document.createElementNS(NS, "circle");
        dot.setAttribute("r", 7); dot.setAttribute("fill", "#fff");
        dot.style.filter = "drop-shadow(0 0 6px #ff2a6d)";
        this.svg.appendChild(dot);
        const t0 = performance.now(), dur = 900;
        await new Promise((res) => {
          const tick = (t) => {
            const k = Math.min(1, (t - t0) / dur), p = path.getPointAtLength(k * L);
            dot.setAttribute("cx", p.x); dot.setAttribute("cy", p.y);
            k < 1 ? requestAnimationFrame(tick) : res();
          };
          requestAnimationFrame(tick);
        });
        dot.remove();
        this.pulse(to);
        await new Promise((r) => setTimeout(r, 500));
      }
      btn.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", () =>
    document.querySelectorAll(".diagram[data-diagram]").forEach((el) => new Diagram(el)));
})();
