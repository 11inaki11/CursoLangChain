/* ==========================================================================
   site.js — shared layout (top bar, sidebar, footer, pager), code blocks,
   pixel robot sprites and scroll animations. Edit the CONFIG block below.
   ========================================================================== */

/* ---------------------------- CONFIG ---------------------------------- */
const SITE = {
  title: "ROBOT AGENTS",
  repo: "https://github.com/11inaki11/CursoLangChain",
};

const CHAPTERS = [
  { slug: "welcome",          num: "▶",  title: "Welcome to the lab",      sub: "What you'll learn · power-ups",    builds: "meet the robots and power up your AI assistant", time: "5 min" },
  { slug: "00-setup",         num: "00", title: "Boot sequence",           sub: "Setup, API keys, first run",       builds: "robot_world.py — the lab, no AI yet", time: "10 min" },
  { slug: "01-concepts",      num: "01", title: "What is LangChain?",      sub: "Everything is a node",             builds: "the mental model: everything is a node", time: "25 min" },
  { slug: "02-first-agent",   num: "02", title: "Your first robot agent",  sub: "Models · Tools · RAG",             builds: "R-80 gets a brain, hands and a manual", time: "55 min" },
  { slug: "03-messages",      num: "03", title: "Talking to the robot",    sub: "System, Human, AI, Tool",          builds: "read R-80's conversation, message by message", time: "15 min" },
  { slug: "04-memory",        num: "04", title: "Robot memory",            sub: "Threads, tokens, summaries",       builds: "R-80 remembers across turns", time: "25 min" },
  { slug: "05-multi-agent",   num: "05", title: "The robot squad",         sub: "Multi-agent graphs",               builds: "SCOUT + GRIP coordinated by a supervisor", time: "45 min" },
  { slug: "06-robot-control", num: "06", title: "Mission control",         sub: "Natural language → robot actions", builds: "natural-language missions, end to end", time: "40 min" },
  { slug: "07-discussion",    num: "07", title: "Debrief",                 sub: "Open questions",                   builds: "where this fits in your own robots", time: "30 min" },
];

// TODO: fill in real roles.
const AUTHORS = [
  { name: "Iñaki Dellibarda", role: "Robotics · AI", url: "https://www.inakidellibarda.com/", palette: "pink" },
  { name: "Pablo Romero",     role: "Robotics · AI", url: "https://www.linkedin.com/in/pablo-romero-sorozabal/", palette: "yellow" },
  { name: "Rafael Sendra",    role: "Robotics · AI", url: "https://www.linkedin.com/in/rafael-sendra-arranz/", palette: "green" },
  { name: "Matheus Loureiro", role: "Robotics · AI", url: "https://www.linkedin.com/in/matheuspenido/", palette: "cyan" },
];

/* ------------------------- PIXEL ROBOT SPRITES ------------------------- */
const RobotSprite = (() => {
  const MAP = [
    ".....aa.....",
    "......a.....",
    "..hhhhhhhh..",
    "..hwwhhwwh..",
    "..hwehhweh..",
    "..hhhhhhhh..",
    "..hhmmmmhh..",
    "....bbbb....",
    ".abbbbbbbba.",
    ".a.bbyybb.a.",
    "...bbbbbb...",
    "..tt....tt..",
  ];
  const PALETTES = {
    pink:   { h: "#ff2a6d", b: "#b967ff", w: "#ffffff", e: "#0b0620", a: "#f9c80e", y: "#05d9e8", m: "#0b0620", t: "#3a2a8a" },
    cyan:   { h: "#05d9e8", b: "#2b6cb0", w: "#ffffff", e: "#0b0620", a: "#ff2a6d", y: "#f9c80e", m: "#0b0620", t: "#3a2a8a" },
    yellow: { h: "#f9c80e", b: "#ff8a3d", w: "#ffffff", e: "#0b0620", a: "#05d9e8", y: "#ff2a6d", m: "#0b0620", t: "#3a2a8a" },
    green:  { h: "#3dfc9b", b: "#1f8a70", w: "#ffffff", e: "#0b0620", a: "#b967ff", y: "#f9c80e", m: "#0b0620", t: "#3a2a8a" },
    purple: { h: "#b967ff", b: "#6a2cc9", w: "#ffffff", e: "#0b0620", a: "#3dfc9b", y: "#ff2a6d", m: "#0b0620", t: "#3a2a8a" },
  };
  /** Returns the inner <rect>s of a 12x12 sprite. */
  function rects(palette = "pink") {
    const p = PALETTES[palette] || PALETTES.pink;
    let out = "";
    MAP.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== ".") out += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${p[ch]}"/>`;
    }));
    return out;
  }
  function svg(palette, cls = "") {
    return `<svg class="${cls}" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">${rects(palette)}</svg>`;
  }
  return { rects, svg, PALETTES };
})();

/* ------------------------- SYNTAX HIGHLIGHTING ------------------------- */
const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function highlight(src, lang = "python") {
  const rules = lang === "python"
    ? /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|\b[rfbu]{0,2}"(?:\\.|[^"\\\n])*"|\b[rfbu]{0,2}'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(@[\w.]+)|\b(\d+(?:\.\d+)?)\b|\b(def|class|return|if|elif|else|for|while|in|not|and|or|import|from|as|with|try|except|finally|raise|lambda|yield|pass|break|continue|None|True|False|is|async|await)\b|\b(self)\b|\b([A-Z]\w*)\b|\b([a-z_]\w*)(?=\()/g
    : /(#[^\n]*)|("(?:\\.|[^"\\])*"|'[^']*')|(^|\n)(\s*[\w.-]+)/g;
  let out = "", last = 0, m;
  while ((m = rules.exec(src))) {
    out += escapeHtml(src.slice(last, m.index));
    const t = escapeHtml(m[0]);
    if (lang !== "python") {
      if (m[1]) out += `<span class="tk-com">${t}</span>`;
      else if (m[2]) out += `<span class="tk-str">${t}</span>`;
      else out += escapeHtml(m[3]) + `<span class="tk-fn">${escapeHtml(m[4])}</span>`;
    } else {
      const cls = m[1] ? "com" : m[2] ? "str" : m[3] ? "dec" : m[4] ? "num" : m[5] ? "kw" : m[6] ? "self" : m[7] ? "cls" : "fn";
      out += `<span class="tk-${cls}">${t}</span>`;
    }
    last = m.index + m[0].length;
  }
  return out + escapeHtml(src.slice(last));
}

/* ------------------------------ HELPERS -------------------------------- */
const ROOT = document.body.dataset.root || ".";
const url = (path) => `${ROOT}/${path}`;

function buildTopbar() {
  const el = document.getElementById("topbar");
  if (!el) return;
  el.className = "topbar";
  el.innerHTML = `
    ${document.getElementById("sidebar") ? `<button class="menu-btn" aria-label="Open menu">☰</button>` : ""}
    <a class="brand" href="${url("index.html")}">
      ${RobotSprite.svg("pink", "logo")}<span>${SITE.title}</span>
    </a>
    <span class="spacer"></span>
    <a class="top-link" href="${url("index.html")}#roadmap">Roadmap</a>
    <a class="top-link" href="${url("chapters/" + CHAPTERS[0].slug + ".html")}">Start</a>
    <a class="top-link" href="${url("index.html")}#crew">Crew</a>
    <a class="btn" href="${SITE.repo}" target="_blank" rel="noopener">GitHub ↗</a>`;
  const btn = el.querySelector(".menu-btn");
  if (btn) btn.addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
}

function buildSidebar(current) {
  const el = document.getElementById("sidebar");
  if (!el) return;
  const toc = [...document.querySelectorAll("main h2[id]")]
    .map((h) => `<li><a href="#${h.id}">${h.textContent}</a></li>`).join("");
  el.innerHTML = `
    <div class="side-title">// COURSE MAP</div>
    <ol>${CHAPTERS.map((c) => `
      <li>
        <a href="${url("chapters/" + c.slug + ".html")}" class="${c.slug === current ? "active" : ""}">
          <span class="num">${c.num}</span><span>${c.title}<small>${c.sub}</small></span>
        </a>
        ${c.slug === current && toc ? `<ol class="toc">${toc}</ol>` : ""}
      </li>`).join("")}
    </ol>`;
  el.querySelectorAll(".toc a").forEach((a) => a.addEventListener("click", () => el.classList.remove("open")));
}

function buildChapterHeader(current) {
  const idx = CHAPTERS.findIndex((c) => c.slug === current);
  const head = document.querySelector(".chapter-head");
  if (idx < 0 || !head) return;
  const c = CHAPTERS[idx];
  const label = /\d/.test(c.num) ? `Chapter ${c.num}` : "Start here";
  head.insertAdjacentHTML("afterbegin", `<div class="eyebrow">${label} · ${c.time}</div>`);
}

function buildPager(current) {
  const idx = CHAPTERS.findIndex((c) => c.slug === current);
  const inner = document.querySelector(".content-inner");
  if (idx < 0 || !inner) return;
  const prev = CHAPTERS[idx - 1], next = CHAPTERS[idx + 1];
  inner.insertAdjacentHTML("beforeend", `
    <nav class="pager">
      ${prev ? `<a class="prev" href="${url("chapters/" + prev.slug + ".html")}"><small>◀ PREV · ${prev.num}</small>${prev.title}</a>` : "<span></span>"}
      ${next ? `<a class="next" href="${url("chapters/" + next.slug + ".html")}"><small>NEXT · ${next.num} ▶</small>${next.title}</a>` : ""}
    </nav>`);
}

function buildFooter() {
  const el = document.getElementById("footer");
  if (!el) return;
  el.className = "site-footer";
  el.innerHTML = `
    <div class="inner" id="crew">
      <div class="eyebrow">// THE CREW</div>
      <h3>Built by four robotics engineers</h3>
      <p class="footer-note">Liked the tutorial? Check out our work.</p>
      <div class="authors">
        ${AUTHORS.map((a) => `
          <a class="author" href="${a.url}" ${a.url === "#" ? 'title="Portfolio coming soon"' : 'target="_blank" rel="noopener"'}>
            ${RobotSprite.svg(a.palette)}
            <b>${a.name}</b><small>${a.role}</small><span class="go">${a.url.includes("linkedin.com") ? "LinkedIn" : "portfolio"} ↗</span>
          </a>`).join("")}
      </div>
      <p class="footer-note">© ${new Date().getFullYear()} · Code under the repository license ·
        <a href="${SITE.repo}" target="_blank" rel="noopener">Source on GitHub</a></p>
    </div>`;
}

/* ---------------------------- CODE BLOCKS ------------------------------ */
function enhanceCodeBlocks() {
  document.querySelectorAll(".code").forEach((block) => {
    const codeEl = block.querySelector("code");
    if (!codeEl) return;
    const lang = codeEl.className.replace("lang-", "") || "python";
    const raw = codeEl.textContent.replace(/^\n/, "").replace(/\s+$/, "");
    codeEl.innerHTML = highlight(raw, lang);

    const file = block.dataset.file || lang;
    const head = document.createElement("div");
    head.className = "code-head";
    head.innerHTML = `<span class="dots"><i></i><i></i><i></i></span><span class="fname">${file}</span>`;
    if (block.dataset.run) {
      const run = document.createElement("button");
      run.className = "btn run";
      run.innerHTML = "▶ Run";
      run.title = "Emulated run in the simulator below";
      run.addEventListener("click", () => {
        const sim = window.SIMS && window.SIMS[block.dataset.run];
        if (!sim) return;
        sim.el.scrollIntoView({ behavior: "smooth", block: "center" });
        sim.play(Number(block.dataset.runIndex || 0));
      });
      head.appendChild(run);
    }
    if (block.dataset.download) {
      const dl = document.createElement("a");
      dl.className = "btn";
      dl.href = url(block.dataset.download);
      dl.setAttribute("download", "");
      dl.textContent = "⬇ Full script";
      head.appendChild(dl);
    }
    const copy = document.createElement("button");
    copy.className = "btn";
    copy.textContent = "Copy";
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(raw); copy.textContent = "Copied ✓"; }
      catch { copy.textContent = "Select + Ctrl-C"; }
      setTimeout(() => (copy.textContent = "Copy"), 1600);
    });
    head.appendChild(copy);
    block.prepend(head);

    // highlighted lines: data-hl="3-5,9" (drawn as an overlay so spans never break)
    if (block.dataset.hl) {
      const pre = block.querySelector("pre");
      pre.style.position = "relative";
      const lh = parseFloat(getComputedStyle(pre).lineHeight);
      const pad = parseFloat(getComputedStyle(pre).paddingTop);
      block.dataset.hl.split(",").forEach((part) => {
        const [a, b = a] = part.split("-").map(Number);
        const bar = document.createElement("span");
        bar.className = "hl-line";
        Object.assign(bar.style, { position: "absolute", left: 0, right: 0, top: `${pad + (a - 1) * lh}px`, height: `${(b - a + 1) * lh}px`, pointerEvents: "none" });
        pre.appendChild(bar);
      });
    }
  });
}

/* -------------------------------- TABS ---------------------------------
   <div class="tabs" data-group="provider">
     <div class="tab-panel" data-tab="Gemini">…</div> …
   </div>
   Tabs sharing a data-group stay in sync across the page and are remembered. */
function setupTabs() {
  const KEY = "robot-agents-tabs";
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch {}
  const groups = document.querySelectorAll(".tabs");
  function select(group, name) {
    document.querySelectorAll(`.tabs[data-group="${group}"]`).forEach((t) => activate(t, name));
    try { saved[group] = name; localStorage.setItem(KEY, JSON.stringify(saved)); } catch {}
  }
  function activate(tabs, name) {
    const panels = [...tabs.querySelectorAll(":scope > .tab-panel")];
    if (!panels.some((p) => p.dataset.tab === name)) return;
    panels.forEach((p) => (p.hidden = p.dataset.tab !== name));
    tabs.querySelectorAll(":scope > .tab-list button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  }
  groups.forEach((tabs) => {
    const panels = [...tabs.querySelectorAll(":scope > .tab-panel")];
    const list = document.createElement("div");
    list.className = "tab-list";
    list.setAttribute("role", "tablist");
    panels.forEach((p) => {
      const b = document.createElement("button");
      b.dataset.tab = p.dataset.tab;
      b.innerHTML = p.dataset.label || p.dataset.tab;
      b.addEventListener("click", () => (tabs.dataset.group ? select(tabs.dataset.group, p.dataset.tab) : activate(tabs, p.dataset.tab)));
      list.appendChild(b);
    });
    tabs.prepend(list);
    const g = tabs.dataset.group;
    activate(tabs, (g && saved[g]) || panels[0].dataset.tab);
  });
}

/* ---------------------------- PROMPT BOXES ----------------------------- */
function setupPromptBoxes() {
  document.querySelectorAll(".prompt-box").forEach((box) => {
    const text = box.querySelector(".prompt-text").innerText.trim();
    const btn = document.createElement("button");
    btn.className = "btn primary";
    btn.textContent = "Copy prompt";
    btn.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(text); btn.textContent = "Copied ✓"; }
      catch { btn.textContent = "Select + Ctrl-C"; }
      setTimeout(() => (btn.textContent = "Copy prompt"), 1600);
    });
    box.querySelector(".prompt-head").appendChild(btn);
  });
}

/* ------------------------------ REVEAL --------------------------------- */
function setupReveal() {
  const targets = document.querySelectorAll(".reveal, .content-inner > .sim, .content-inner > .diagram, .content-inner > .code, .content-inner > .wide, .content-inner > .briefing, .prompt-box, .takeaways, .card, .stage, .feature");
  targets.forEach((t) => t.classList.add("reveal"));
  if (!("IntersectionObserver" in window)) return targets.forEach((t) => t.classList.add("in"));
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  targets.forEach((t) => io.observe(t));
}

/* ------------------------------- BOOT ---------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const current = document.body.dataset.chapter;
  buildTopbar();
  buildSidebar(current);
  buildChapterHeader(current);
  buildPager(current);
  buildFooter();
  enhanceCodeBlocks();
  setupTabs();
  setupPromptBoxes();
  document.querySelectorAll("[data-sprite]").forEach((el) => (el.innerHTML = RobotSprite.svg(el.dataset.sprite)));
  setupReveal();
});
