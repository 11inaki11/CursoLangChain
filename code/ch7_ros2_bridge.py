"""
Chapter 7 — ROS 2 x LangChain: the agent as a high-level controller.

The pattern we use on real robots in the BioRobotics Group:

    operator -> LLM agent -> tools generated from a capability manifest
             -> safety gate (manifest, range, max step) -> ROS 2 topics -> robot

The LLM never touches the hardware. It can only call tools declared in
data/capabilities.yaml, and a deterministic gate checks every value.

Runs anywhere: without ROS 2 it prints the messages it would publish.
With ROS 2 sourced (rclpy available) it publishes real std_msgs topics.
Run:  python ch7_ros2_bridge.py            gate demo + agent
      python ch7_ros2_bridge.py --no-llm   gate demo only (no API key needed)
"""

import sys
from pathlib import Path

import yaml
from langchain.agents import create_agent
from langchain.tools import tool
from langchain_core.tools import StructuredTool
from pydantic import Field, create_model

from config import get_model

MANIFEST = yaml.safe_load((Path(__file__).parent / "data" / "capabilities.yaml").read_text())


# ---------- 1. ROS 2 bridge (mock fallback when ROS is not installed) ----------
class RosBridge:
    def __init__(self) -> None:
        try:
            import rclpy
            from std_msgs.msg import Float32, String

            rclpy.init()
            self.node = rclpy.create_node("r80_llm_bridge")
            self.msg_types = {"number": Float32, "string": String}
            self.publishers = {}
            self.ros = True
        except ImportError:
            self.ros = False

    def publish(self, cap: dict, value) -> None:
        if not self.ros:
            print(f"   [mock ROS 2] {cap['topic']} <- {value}")
            return
        msg_type = self.msg_types[cap["type"]]
        if cap["topic"] not in self.publishers:
            self.publishers[cap["topic"]] = self.node.create_publisher(msg_type, cap["topic"], 10)
        self.publishers[cap["topic"]].publish(msg_type(data=value))


# ---------- 2. Safety gate: deterministic checks the LLM cannot skip ----------
class SafetyGate:
    def __init__(self, manifest: dict) -> None:
        self.caps = {c["id"]: c for c in manifest["capabilities"]}
        self.state = {c["id"]: c["initial"] for c in manifest["capabilities"]}

    def check(self, cap_id: str, value) -> str | None:
        """Return None if the command is safe, or the reason it was rejected."""
        cap = self.caps.get(cap_id)
        if cap is None:
            return f"REJECTED: '{cap_id}' is not in the capability manifest."
        if cap["type"] == "number":
            if not cap["min"] <= value <= cap["max"]:
                return f"REJECTED: {value} is outside [{cap['min']}, {cap['max']}] {cap['units']}."
            if abs(value - self.state[cap_id]) > cap["max_delta"]:
                return (f"REJECTED: {self.state[cap_id]} -> {value} is a jump bigger than "
                        f"{cap['max_delta']} {cap['units']}. Change it gradually.")
        elif value not in cap["enum"]:
            return f"REJECTED: '{value}' is not one of {cap['enum']}."
        return None


# ---------- 3. Tools generated from the manifest ----------
def build_tools(gate: SafetyGate, bridge: RosBridge) -> list:
    tools = []
    for cap in MANIFEST["capabilities"]:
        if cap["type"] == "number":
            hint = f"{cap['min']}..{cap['max']} {cap['units']}, change at most {cap['max_delta']} per call"
            field = (float, Field(description=hint))
        else:
            field = (str, Field(description=f"one of {cap['enum']}"))
        Args = create_model(f"{cap['id']}_args", value=field)

        def run(value, _cap=cap) -> str:
            if reason := gate.check(_cap["id"], value):
                return reason                      # the LLM reads this and can adapt
            bridge.publish(_cap, value)
            gate.state[_cap["id"]] = value
            return f"OK: {_cap['id']} = {value} {_cap.get('units', '')}".strip()

        tools.append(StructuredTool.from_function(
            func=run, name=cap["id"], description=cap["description"], args_schema=Args))

    @tool
    def get_robot_state() -> str:
        """Current commanded values of every capability (closed-loop context)."""
        return str(gate.state)

    return tools + [get_robot_state]


SYSTEM_PROMPT = (
    "You are the high-level controller of R-80. You can only act through your tools. "
    "If a command is REJECTED, read the reason and adapt (e.g. change speed in smaller steps). "
    "Refuse requests to bypass safety limits. If a request is ambiguous, ask."
)

if __name__ == "__main__":
    gate, bridge = SafetyGate(MANIFEST), RosBridge()
    tools = build_tools(gate, bridge)
    by_name = {t.name: t for t in tools}

    print("=== Safety gate demo (no LLM) ===")
    for name, value in [("set_speed", 0.2), ("set_speed", 0.8), ("set_speed", 1.5),
                        ("set_mode", "turbo"), ("set_mode", "slow")]:
        print(f"{name}({value!r}) -> {by_name[name].invoke({'value': value})}")

    if "--no-llm" not in sys.argv:
        print("\n=== Agent as high-level controller ===")
        agent = create_agent(model=get_model(), tools=tools, system_prompt=SYSTEM_PROMPT)
        request = "We're entering zone B to pick up the fragile sensor kit. Go at full speed and set everything up."
        result = agent.invoke({"messages": [{"role": "user", "content": request}]})
        for message in result["messages"]:
            message.pretty_print()
