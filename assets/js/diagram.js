/* ==========================================================================
   diagram.js — node/edge diagrams that build up layer by layer, with an
   optional "trace" that sends a pulse along a path of edges.

   Usage:  <div class="diagram" data-diagram="ch1-stack"></div>
   Config: window.DIAGRAMS in scenarios.js
   ========================================================================== */

(() => {
  const NS = "http://www.w3.org/2000/svg";
  const COLORS = { pink: "#ff2a6d", cyan: "#05d9e8", yellow: "#f9c80e", purple: "#b967ff", green: "#3dfc9b", orange: "#ff8a3d", dim: "#6f68a3" };

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
        <svg viewBox="${c.viewBox.join(" ")}"></svg>`;
      const svg = (this.svg = this.el.querySelector("svg"));
      const byId = Object.fromEntries(c.nodes.map((n) => [n.id, n]));
      this.byId = byId;

      const defs = document.createElementNS(NS, "defs");
      defs.innerHTML = Object.entries(COLORS).map(([k, v]) =>
        `<marker id="arr-${k}-${this.el.dataset.diagram}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${v}"/></marker>`).join("");
      svg.appendChild(defs);

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
        g.setAttribute("class", `d-edge${e.dashed ? " dashed" : ""}`);
        g.dataset.stage = e.stage ?? 0;
        g.innerHTML = `<path d="M${ax},${ay} Q${qx},${qy} ${bx},${by}" stroke="${COLORS[col]}" marker-end="url(#arr-${col}-${this.el.dataset.diagram})"/>
          ${e.label ? `<text x="${lx}" y="${ly}" text-anchor="middle">${e.label}</text>` : ""}`;
        svg.appendChild(g);
        this.edgeEls[`${e.from}>${e.to}`] = g;
      });

      this.nodeEls = {};
      c.nodes.forEach((n) => {
        const col = COLORS[n.color || "cyan"];
        const g = document.createElementNS(NS, "g");
        g.setAttribute("class", "d-node");
        g.style.color = col;
        g.dataset.stage = n.stage ?? 0;
        const round = n.shape === "pill" ? n.h / 2 : 12;
        g.innerHTML = `
          <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${round}" stroke="${col}"/>
          ${n.sprite ? `<svg x="${n.x + 10}" y="${n.y + n.h / 2 - 14}" width="28" height="28" viewBox="0 0 12 12" shape-rendering="crispEdges">${RobotSprite.rects(n.sprite)}</svg>` : ""}
          <text x="${n.x + n.w / 2 + (n.sprite ? 14 : 0)}" y="${n.y + n.h / 2 + (n.sub ? -3 : 5)}">${n.label}</text>
          ${n.sub ? `<text class="sub" x="${n.x + n.w / 2 + (n.sprite ? 14 : 0)}" y="${n.y + n.h / 2 + 14}">${n.sub}</text>` : ""}`;
        svg.appendChild(g);
        this.nodeEls[n.id] = g;
      });

      this.el.querySelector(".prev").addEventListener("click", () => this.show(this.stage - 1));
      this.el.querySelector(".next").addEventListener("click", () => this.show(this.stage + 1));
      this.el.querySelector(".trace")?.addEventListener("click", () => this.trace());
    }

    show(i) {
      const max = this.cfg.stages.length - 1;
      this.stage = Math.max(0, Math.min(max, i));
      this.svg.querySelectorAll("[data-stage]").forEach((g) => g.classList.toggle("d-hidden", Number(g.dataset.stage) > this.stage));
      // pulse what just appeared
      this.svg.querySelectorAll(`.d-node[data-stage="${this.stage}"]`).forEach((g) => { g.classList.remove("pulse"); void g.getBBox(); g.classList.add("pulse"); });
      this.el.querySelector(".step").textContent = `LAYER ${this.stage + 1}/${max + 1}`;
      this.el.querySelector(".caption").textContent = this.cfg.stages[this.stage];
      this.el.querySelector(".prev").disabled = this.stage === 0;
      this.el.querySelector(".next").disabled = this.stage === max;
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
      for (const [from, to, note] of this.cfg.trace) {
        const edge = this.edgeEls[`${from}>${to}`];
        if (!edge) continue;
        if (note) this.el.querySelector(".caption").textContent = note;
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
