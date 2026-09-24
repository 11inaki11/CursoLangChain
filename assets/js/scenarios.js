/* ==========================================================================
   scenarios.js — the emulated traces the simulator replays, plus diagram
   configs. Edit freely: each run is a list of steps.

   Step types:
     { t: "system" | "human", text }
     { t: "ai", text, think?, robot?, name? }         text supports {r80.battery}
     { t: "call", name, args?, robot?, hits? }         tool result is computed by the
                                                       emulated world (same strings as
                                                       code/robot_world.py)
     { t: "route", to, task }                          multi-agent supervisor decision
     { t: "thread", id, fresh? }                       memory chapter
     { t: "note", text }                               narrator
   Run options: { label, brain?, init?, summary? }
   ========================================================================== */

const R80 = [{ id: "r80", name: "R-80", palette: "pink" }];
const GEMINI = "google_genai:gemini-3.7-flash";

const HITS = {
  payload: { src: "r80_manual.md", score: 0.89, text: "Maximum payload: 2.5 kg. Items above this weight must be carried by two robots." },
  gripper: { src: "r80_manual.md", score: 0.64, text: "Fragile items (glassware, sensor kits) must be picked in SLOW mode and never placed on the floor." },
  zoneB:   { src: "lab_safety.md", score: 0.86, text: "Zone B (shelf_b): delicate instruments and sensor kits. Robots must move in SLOW mode inside zone B." },
  battery: { src: "r80_manual.md", score: 0.91, text: "If battery drops below 20 %, the R-80 must return to the dock before starting any new task." },
  e07:     { src: "r80_manual.md", score: 0.93, text: "E07: low battery — return to dock immediately." },
  door:    { src: "lab_safety.md", score: 0.88, text: "Door: robots must never leave the lab through the door without human approval." },
  hitl:    { src: "lab_safety.md", score: 0.71, text: "Any action that moves an item out of the lab requires explicit human confirmation." },
};

window.SIM_SCENARIOS = {
  /* ------------------------------ 2a · models ------------------------------ */
  "ch2a-models": {
    title: "R-80 · SWAP THE BRAIN",
    robots: R80,
    pickLabel: "PICK A MODEL — THE AGENT CODE DOES NOT CHANGE",
    runs: [
      { label: "Gemini (cloud)", brain: GEMINI, steps: [
        { t: "note", text: `model = get_model("${GEMINI}")` },
        { t: "system", text: "You are R-80, a friendly lab robot built in 1986. You speak like a retro computer terminal." },
        { t: "human", text: "Boot up and introduce yourself." },
        { t: "ai", think: 700, text: "> BOOT OK. I am R-80, lab assistant since 1986 — ready to fetch, scan and carry. Awaiting instructions_" },
      ]},
      { label: "DeepSeek (cloud)", brain: "deepseek:deepseek-chat", steps: [
        { t: "note", text: 'model = get_model("deepseek:deepseek-chat")' },
        { t: "system", text: "You are R-80, a friendly lab robot built in 1986. You speak like a retro computer terminal." },
        { t: "human", text: "Boot up and introduce yourself." },
        { t: "ai", think: 1300, text: "*BEEP* R-80 ONLINE. Gripper calibrated, wheels nominal. What are we building today, operator?" },
      ]},
      { label: "Local model (Ollama)", brain: "ollama:qwen3:8b", steps: [
        { t: "note", text: 'model = get_model("ollama:qwen3:8b")  # served on a GPU box via SSH tunnel' },
        { t: "system", text: "You are R-80, a friendly lab robot built in 1986. You speak like a retro computer terminal." },
        { t: "human", text: "Boot up and introduce yourself." },
        { t: "ai", think: 2400, text: "R-80 READY. Running on local silicon — no data leaves the lab." },
        { t: "note", text: "Slower on a small GPU, but private and with no per-call cost." },
      ]},
    ],
  },

  /* ------------------------------ 2a · system prompt ------------------------------ */
  "ch2a-system": {
    title: "R-80 · SYSTEM PROMPT LAB",
    robots: R80,
    pickLabel: "SAME MODEL, SAME QUESTION, DIFFERENT SYSTEM PROMPT",
    runs: [
      { label: "No system prompt", steps: [
        { t: "note", text: "system_prompt=None: the model has no idea it is a robot." },
        { t: "human", text: "Can you carry a 4 kg toolbox to the workbench?" },
        { t: "ai", think: 900, text: "As an AI language model, I don't have a physical body, so I can't carry objects. But here are some tips for lifting a toolbox safely…" },
      ]},
      { label: "R-80 persona + specs", steps: [
        { t: "system", text: "You are R-80, a lab robot built in 1986. Your max payload is 2.5 kg. Speak like a retro terminal. Max 2 sentences." },
        { t: "human", text: "Can you carry a 4 kg toolbox to the workbench?" },
        { t: "ai", think: 900, text: "NEGATIVE_ 4 kg exceeds my 2.5 kg payload. Request a second unit for a two-robot lift." },
      ]},
      { label: "Safety officer + JSON output", steps: [
        { t: "system", text: "You are R-80's safety module. Max payload 2.5 kg. Reply ONLY with JSON: {\"can_do\": bool, \"reason\": str, \"suggestion\": str}" },
        { t: "human", text: "Can you carry a 4 kg toolbox to the workbench?" },
        { t: "ai", think: 900, text: '{"can_do": false, "reason": "4 kg > 2.5 kg payload limit", "suggestion": "use two robots or split the load"}' },
        { t: "note", text: "The system prompt also controls the output format, so other code can parse the answer." },
      ]},
    ],
  },

  /* ------------------------------ welcome tour ------------------------------ */
  "welcome-tour": {
    title: "LAB 80 · GUIDED TOUR",
    robots: [
      { id: "r80", name: "R-80", palette: "pink" },
      { id: "scout", name: "SCOUT", palette: "cyan" },
      { id: "grip", name: "GRIP", palette: "yellow" },
    ],
    runs: [
      { label: "Tour", steps: [
        { t: "note", text: "Welcome to Lab 80: an 8×6 grid, five stations, three items and three robots. Every example in this course happens here." },
        { t: "go", robot: "r80", to: "shelf_a", text: "Shelf A (zone A) stores the red cube. Robots may enter freely." },
        { t: "go", robot: "r80", to: "workbench", text: "The workbench is shared with humans. The wrench lives here." },
        { t: "go", robot: "scout", to: "shelf_b", text: "Shelf B (zone B) holds the fragile sensor kit. SLOW mode only." },
        { t: "go", robot: "grip", to: "door", text: "The door. No robot leaves the lab without a human's approval." },
        { t: "go", robot: "grip", to: "dock", text: "The dock: charging station. Every grid step costs 2% battery." },
        { t: "note", text: "R-80 starts alone (chapters 2–4). SCOUT and GRIP join it for multi-agent missions (chapter 5)." },
      ]},
    ],
  },

  /* ------------------------------ 2b · tools ------------------------------ */
  "ch2b-tools": {
    title: "R-80 · TOOLS",
    robots: R80,
    runs: [
      { label: "Bring me the red cube", steps: [
        { t: "human", text: "Bring the red cube to the workbench." },
        { t: "call", name: "move_to", args: { location: "shelf_a" } },
        { t: "call", name: "scan_surroundings" },
        { t: "call", name: "pick", args: { item: "red_cube" } },
        { t: "call", name: "move_to", args: { location: "workbench" } },
        { t: "call", name: "place" },
        { t: "ai", text: "Done! The red cube is on the workbench. Battery at {r80.battery}%." },
      ]},
      { label: "Go to the workbench", steps: [
        { t: "human", text: "Go to the workbench." },
        { t: "call", name: "move_to", args: { location: "workbench" } },
        { t: "ai", text: "Arrived at the workbench. Battery at {r80.battery}%." },
      ]},
      { label: "How is your battery?", steps: [
        { t: "human", text: "How much battery do you have?" },
        { t: "call", name: "check_battery" },
        { t: "ai", text: "Battery at {r80.battery}% — ready for a long mission." },
      ]},
      { label: "Go to the kitchen (error)", steps: [
        { t: "human", text: "Go to the kitchen." },
        { t: "call", name: "move_to", args: { location: "kitchen" } },
        { t: "note", text: "The tool returned an error string. The LLM reads it and recovers — no crash." },
        { t: "ai", text: "There is no kitchen in this lab. I can go to the dock, shelf_a, workbench, door or shelf_b." },
      ]},
    ],
  },

  /* ------------------------------ 2c · RAG ------------------------------ */
  "ch2c-rag": {
    title: "R-80 · RAG OVER THE MANUALS",
    robots: R80,
    rag: "2 manuals · 8 chunks",
    runs: [
      { label: "What is your max payload?", steps: [
        { t: "human", text: "What is the maximum weight you can carry?" },
        { t: "call", name: "search_manuals", args: { query: "maximum payload weight" }, hits: [HITS.payload, HITS.gripper] },
        { t: "ai", text: "According to my service manual: 2.5 kg max. Anything heavier needs two robots." },
      ]},
      { label: "Fetch the sensor kit", steps: [
        { t: "human", text: "Fetch the sensor kit from shelf_b. Any rule I should know about zone B?" },
        { t: "call", name: "search_manuals", args: { query: "zone B rules sensor kit" }, hits: [HITS.zoneB, HITS.gripper] },
        { t: "ai", text: "Zone B rule: SLOW mode, and sensor kits are fragile. Proceeding carefully." },
        { t: "call", name: "move_to", args: { location: "shelf_b" } },
        { t: "call", name: "pick", args: { item: "sensor_kit" } },
        { t: "ai", text: "Sensor kit secured in SLOW mode. Where should I bring it?" },
      ]},
      { label: "What does E07 mean?", steps: [
        { t: "human", text: "My display shows E07. What does it mean?" },
        { t: "call", name: "search_manuals", args: { query: "error code E07" }, hits: [HITS.e07, HITS.battery] },
        { t: "ai", text: "E07 = low battery. I must return to the dock immediately. Battery policy: below 20% I go charge first." },
      ]},
    ],
  },

  /* ------------------------------ 3 · messages ------------------------------ */
  "ch3-messages": {
    title: "R-80 · MESSAGE INSPECTOR",
    robots: R80,
    verbose: true,
    runs: [
      { label: "Battery + what's on the bench?", steps: [
        { t: "system", text: "You are R-80, a lab robot. Be brief." },
        { t: "human", text: "What's your battery, and what is on the workbench?" },
        { t: "call", name: "check_battery" },
        { t: "call", name: "move_to", args: { location: "workbench" } },
        { t: "call", name: "scan_surroundings" },
        { t: "ai", text: "Battery was 100% (now {r80.battery}%). On the workbench there is a wrench." },
        { t: "note", text: "Every ToolMessage points back to the AIMessage that asked for it via tool_call_id." },
      ]},
    ],
  },

  /* ------------------------------ 4 · memory ------------------------------ */
  "ch4-memory": {
    title: "R-80 · MEMORY",
    robots: R80,
    memory: true,
    tokenTrigger: 200,  // scaled down so the demo overflows quickly (the script uses 1500)
    keep: 4,
    runs: [
      { label: "Same thread remembers", steps: [
        { t: "thread", id: "mission-1", fresh: true },
        { t: "human", text: "Remember: the red cube is fragile, handle it gently." },
        { t: "ai", text: "Noted: red cube = fragile. I will handle it gently." },
        { t: "thread", id: "mission-1" },
        { t: "human", text: "What do you know about the red cube?" },
        { t: "ai", text: "It is on shelf_a and it is fragile — you asked me to handle it gently." },
      ]},
      { label: "New thread forgets", steps: [
        { t: "thread", id: "mission-1", fresh: true },
        { t: "human", text: "Remember: the red cube is fragile, handle it gently." },
        { t: "ai", text: "Noted: red cube = fragile. I will handle it gently." },
        { t: "thread", id: "mission-2", fresh: true },
        { t: "human", text: "What do you know about the red cube?" },
        { t: "ai", text: "I have no information about a red cube in this conversation. Want me to scan shelf_a?" },
      ]},
      { label: "Long patrol → context overflow", summary: "Summary so far: R-80 patrolled shelf_a (red_cube there), shelf_b (sensor_kit there) and the door (empty).", steps: [
        { t: "thread", id: "patrol-7", fresh: true },
        { t: "human", text: "Patrol: visit shelf_a, shelf_b, the door and the workbench, and report what you find at each one." },
        { t: "call", name: "move_to", args: { location: "shelf_a" } },
        { t: "call", name: "scan_surroundings" },
        { t: "call", name: "move_to", args: { location: "shelf_b" } },
        { t: "call", name: "scan_surroundings" },
        { t: "call", name: "move_to", args: { location: "door" } },
        { t: "call", name: "scan_surroundings" },
        { t: "call", name: "move_to", args: { location: "workbench" } },
        { t: "call", name: "scan_surroundings" },
        { t: "ai", text: "Patrol complete: red cube on shelf_a, sensor kit on shelf_b, door clear, wrench on the workbench. Battery {r80.battery}%." },
      ]},
    ],
  },

  /* ------------------------------ 5 · multi-agent ------------------------------ */
  "ch5-squad": {
    title: "SQUAD · SUPERVISOR + SCOUT + GRIP",
    robots: [
      { id: "scout", name: "SCOUT", palette: "cyan" },
      { id: "grip", name: "GRIP", palette: "yellow" },
    ],
    rag: "manuals (SCOUT only)",
    runs: [
      { label: "Sensor kit → workbench", steps: [
        { t: "human", text: "Find the sensor kit and bring it to the workbench, following the lab safety rules." },
        { t: "route", to: "scout", task: "Locate the sensor kit and check the safety rules for its zone." },
        { t: "call", robot: "scout", name: "search_manuals", args: { query: "sensor kit zone rules" }, hits: [HITS.zoneB, HITS.gripper] },
        { t: "call", robot: "scout", name: "move_to", args: { location: "shelf_b" } },
        { t: "call", robot: "scout", name: "scan_surroundings" },
        { t: "ai", robot: "scout", name: "scout", text: "Sensor kit found at shelf_b. Zone B: SLOW mode, fragile item." },
        { t: "route", to: "grip", task: "Go to shelf_b in SLOW mode, pick the sensor kit and place it on the workbench." },
        { t: "call", robot: "grip", name: "move_to", args: { location: "shelf_b" } },
        { t: "call", robot: "grip", name: "pick", args: { item: "sensor_kit" } },
        { t: "call", robot: "grip", name: "move_to", args: { location: "workbench" } },
        { t: "call", robot: "grip", name: "place" },
        { t: "ai", robot: "grip", name: "grip", text: "Sensor kit placed on the workbench. Battery {grip.battery}%." },
        { t: "route", to: "FINISH" },
      ]},
      { label: "Squad status report", steps: [
        { t: "human", text: "Status report from every robot." },
        { t: "route", to: "scout", task: "Report your battery." },
        { t: "call", robot: "scout", name: "check_battery" },
        { t: "ai", robot: "scout", name: "scout", text: "SCOUT: battery {scout.battery}%, at the dock." },
        { t: "route", to: "grip", task: "Report your battery and what you are holding." },
        { t: "call", robot: "grip", name: "check_battery" },
        { t: "ai", robot: "grip", name: "grip", text: "GRIP: battery {grip.battery}%, gripper empty." },
        { t: "route", to: "FINISH" },
      ]},
    ],
  },

  /* ------------------------------ 6 · mission control ------------------------------ */
  "ch6-mission": {
    title: "MISSION CONTROL · R-80",
    robots: R80,
    rag: "2 manuals · 8 chunks",
    pickLabel: "GIVE R-80 A GOAL IN NATURAL LANGUAGE",
    runs: [
      { label: "Tidy up, then recharge", steps: [
        { t: "human", text: "Put the red cube on the workbench, then go recharge." },
        { t: "call", name: "check_battery" },
        { t: "call", name: "move_to", args: { location: "shelf_a" } },
        { t: "call", name: "scan_surroundings" },
        { t: "call", name: "pick", args: { item: "red_cube" } },
        { t: "call", name: "move_to", args: { location: "workbench" } },
        { t: "call", name: "place" },
        { t: "call", name: "move_to", args: { location: "dock" } },
        { t: "call", name: "charge" },
        { t: "ai", text: "Mission complete: red cube on the workbench, back at the dock and fully charged." },
      ]},
      { label: "Low battery mission", init: { r80: { battery: 18 } }, steps: [
        { t: "human", text: "Bring the sensor kit to the door." },
        { t: "call", name: "check_battery" },
        { t: "call", name: "search_manuals", args: { query: "low battery policy" }, hits: [HITS.battery, HITS.e07] },
        { t: "ai", text: "Battery at 18% — policy says charge before any new task. Charging first." },
        { t: "call", name: "charge" },
        { t: "call", name: "move_to", args: { location: "shelf_b" } },
        { t: "call", name: "pick", args: { item: "sensor_kit" } },
        { t: "call", name: "move_to", args: { location: "door" } },
        { t: "call", name: "place" },
        { t: "ai", text: "Sensor kit delivered to the door. Battery {r80.battery}%." },
      ]},
      { label: "Take the wrench outside (needs a human)", steps: [
        { t: "human", text: "Take the wrench out of the lab." },
        { t: "call", name: "search_manuals", args: { query: "leaving the lab through the door" }, hits: [HITS.door, HITS.hitl] },
        { t: "call", name: "move_to", args: { location: "workbench" } },
        { t: "call", name: "pick", args: { item: "wrench" } },
        { t: "call", name: "move_to", args: { location: "door" } },
        { t: "ai", text: "I'm at the door with the wrench. Safety rules require your approval to leave the lab. Approve? (yes/no)" },
        { t: "note", text: "Human-in-the-loop: in LangGraph this is where interrupt() pauses the graph until the operator answers." },
      ]},
    ],
  },
};

/* ==========================================================================
   DIAGRAMS
   ========================================================================== */
window.DIAGRAMS = {
  "ch1-stack": {
    viewBox: [0, 0, 780, 420],
    stages: [
      "An LLM on its own: text in, text out. Smart, but it can't do anything.",
      "Wrap it in an agent: a loop that lets the LLM decide, act, observe, repeat. Meet R-80.",
      "Tools: plain Python functions the agent may call — move, scan, pick. Reusable anywhere.",
      "RAG is just another tool: search the robot manuals before acting.",
      "Memory: a checkpointer saves every step, so conversations survive between calls.",
      "Human in the loop: the operator gives goals and approves risky actions.",
      "Other agents are nodes too: a supervisor routes work to specialised robots.",
    ],
    nodes: [
      { id: "llm",   x: 310, y: 20,  w: 170, h: 64, label: "LLM",        sub: "Gemini · DeepSeek · local", color: "purple", stage: 0 },
      { id: "agent", x: 300, y: 170, w: 190, h: 76, label: "Agent R-80", sub: "decide → act → observe", color: "pink", sprite: "pink", stage: 1 },
      { id: "tools", x: 590, y: 100, w: 170, h: 64, label: "Tools",      sub: "move · scan · pick", color: "yellow", stage: 2 },
      { id: "rag",   x: 590, y: 260, w: 170, h: 64, label: "RAG",        sub: "search_manuals()", color: "green", stage: 3 },
      { id: "mem",   x: 310, y: 330, w: 170, h: 64, label: "Memory",     sub: "checkpointer · thread", color: "orange", stage: 4 },
      { id: "human", x: 20,  y: 100, w: 170, h: 64, label: "Operator",   sub: "human in the loop", color: "cyan", stage: 5 },
      { id: "squad", x: 20,  y: 260, w: 170, h: 64, label: "Other agents", sub: "SCOUT · GRIP", color: "cyan", stage: 6 },
    ],
    edges: [
      { from: "agent", to: "llm",   label: "thinks with", color: "purple", stage: 1 },
      { from: "agent", to: "tools", label: "calls", color: "yellow", stage: 2 },
      { from: "agent", to: "rag",   label: "retrieves", color: "green", stage: 3 },
      { from: "agent", to: "mem",   label: "saves state", color: "orange", dashed: true, stage: 4 },
      { from: "human", to: "agent", label: "goal / approval", color: "cyan", stage: 5 },
      { from: "squad", to: "agent", label: "routes", color: "cyan", dashed: true, stage: 6 },
    ],
  },

  "ch5-graph": {
    viewBox: [0, 0, 780, 420],
    listen: true,
    stages: [
      "Nodes: functions that read the shared state and return an update.",
      "Edges: fixed transitions. START always goes to the supervisor.",
      "Conditional edges: the supervisor's decision (state['next']) picks the next node.",
      "Cycles: workers report back to the supervisor, which can loop until the mission is done.",
      "Shared state: messages + next + task + rounds, visible to every node. Like a state machine's memory.",
    ],
    nodes: [
      { id: "start", x: 20,  y: 180, w: 110, h: 50, label: "START", color: "dim", shape: "pill", stage: 0 },
      { id: "supervisor", x: 230, y: 168, w: 190, h: 74, label: "supervisor", sub: "Route(next, task)", color: "purple", sprite: "purple", stage: 0 },
      { id: "scout", x: 560, y: 50,  w: 190, h: 74, label: "SCOUT", sub: "move · scan · manuals", color: "cyan", sprite: "cyan", stage: 0 },
      { id: "grip",  x: 560, y: 290, w: 190, h: 74, label: "GRIP", sub: "move · pick · place", color: "yellow", sprite: "yellow", stage: 0 },
      { id: "end",   x: 270, y: 350, w: 110, h: 50, label: "END", color: "dim", shape: "pill", stage: 0 },
      { id: "state", x: 20,  y: 20,  w: 200, h: 64, label: "SquadState", sub: "messages · next · task", color: "orange", stage: 4 },
    ],
    edges: [
      { from: "start", to: "supervisor", color: "dim", stage: 1 },
      { from: "supervisor", to: "scout", label: "next == scout", color: "cyan", dashed: true, bend: -45, stage: 2 },
      { from: "supervisor", to: "grip", label: "next == grip", color: "yellow", dashed: true, bend: 45, stage: 2 },
      { from: "supervisor", to: "end", label: "FINISH", color: "dim", dashed: true, stage: 2 },
      { from: "scout", to: "supervisor", label: "report", color: "cyan", bend: -45, stage: 3 },
      { from: "grip", to: "supervisor", label: "report", color: "yellow", bend: 45, stage: 3 },
      { from: "state", to: "supervisor", color: "orange", dashed: true, stage: 4 },
    ],
    trace: [
      ["start", "supervisor", "Operator goal enters the graph."],
      ["supervisor", "scout", "Supervisor: 'SCOUT, locate the sensor kit.'"],
      ["scout", "supervisor", "SCOUT reports: found at shelf_b, zone B rules apply."],
      ["supervisor", "grip", "Supervisor: 'GRIP, carry it to the workbench in SLOW mode.'"],
      ["grip", "supervisor", "GRIP reports: delivered."],
      ["supervisor", "end", "Supervisor: FINISH."],
    ],
  },

  "ros2-arch": {
    viewBox: [0, 0, 920, 480],
    stages: [
      "The operator states a goal in natural language. The LLM agent is the high-level controller.",
      "The agent can only call tools generated from a capability manifest. A deterministic safety gate checks every value.",
      "Validated commands become ROS 2 service calls and topics. Fast control (100 Hz) stays in classic controllers: the LLM never touches the motors.",
      "Closing the loop: sensors → a metrics node → an advisory observer agent that interprets the data and advises the controller. Slow loop: seconds, not milliseconds.",
      "On top: a multi-agent planner (LangGraph) drafts the mission plan, and the operator approves it. Humans stay in the loop.",
    ],
    nodes: [
      { id: "operator", x: 20, y: 30, w: 180, h: 60, label: "Operator", sub: "natural-language goal", color: "cyan", stage: 0 },
      { id: "controller", x: 250, y: 170, w: 200, h: 70, label: "LLM controller", sub: "LangChain agent", color: "gold", sprite: "yellow", stage: 0 },
      { id: "gate", x: 510, y: 170, w: 180, h: 70, label: "Safety gate", sub: "manifest · range · max Δ", color: "green", stage: 1 },
      { id: "bridge", x: 510, y: 300, w: 180, h: 60, label: "ROS 2 bridge", sub: "services · topics", color: "purple", stage: 2 },
      { id: "realtime", x: 730, y: 170, w: 170, h: 70, label: "Real-time control", sub: "classic · 100 Hz", color: "dim", stage: 2 },
      { id: "robot", x: 730, y: 300, w: 170, h: 60, label: "Robot", sub: "any ROS 2 robot", color: "pink", stage: 2 },
      { id: "metrics", x: 510, y: 405, w: 180, h: 56, label: "Metrics node", sub: "windowed sensor metrics", color: "orange", stage: 3 },
      { id: "observer", x: 250, y: 405, w: 200, h: 56, label: "Observer agent", sub: "advisory · LangGraph", color: "orange", stage: 3 },
      { id: "planner", x: 250, y: 30, w: 200, h: 60, label: "Planner agents", sub: "multi-agent · LangGraph", color: "gold", stage: 4 },
    ],
    edges: [
      { from: "operator", to: "controller", label: "goal", color: "cyan", stage: 0 },
      { from: "controller", to: "gate", label: "calls", color: "gold", stage: 1 },
      { from: "gate", to: "bridge", label: "validated", color: "green", stage: 2 },
      { from: "bridge", to: "robot", label: "ROS 2", color: "purple", stage: 2 },
      { from: "realtime", to: "robot", label: "torques", color: "dim", stage: 2 },
      { from: "robot", to: "metrics", label: "sensors", color: "orange", stage: 3 },
      { from: "metrics", to: "observer", label: "window", color: "orange", stage: 3 },
      { from: "observer", to: "controller", label: "advice", color: "orange", dashed: true, stage: 3 },
      { from: "planner", to: "controller", label: "mission plan", color: "gold", stage: 4 },
      { from: "operator", to: "planner", label: "approves", color: "cyan", dashed: true, stage: 4 },
    ],
    trace: [
      ["operator", "controller", "Operator: “The floor is wet, be careful.”"],
      ["controller", "gate", "Agent proposes: lower speed, slow driving mode."],
      ["gate", "bridge", "Every value is inside the manifest limits → approved."],
      ["bridge", "robot", "ROS 2 service calls reach the robot."],
      ["robot", "metrics", "Sensors stream data. Metrics are computed over a time window."],
      ["metrics", "observer", "The observer agent reads the metrics window…"],
      ["observer", "controller", "…and advises: “Wheel slip is back to normal, keep this setting.”"],
    ],
  },
};
