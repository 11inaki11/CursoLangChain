"""
Chapter 5 — A robot squad with LangGraph.

    START -> supervisor --(conditional edge)--> scout | grip | END
                 ^                                 |
                 +---------------------------------+

- SCOUT: explores, reads sensors and the manuals.
- GRIP : moves items with its gripper.
- The supervisor reads the shared state and routes the next step.
Run:  python ch5_multiagent.py
"""

from typing import Literal

from langchain.agents import create_agent
from langchain.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph
from pydantic import BaseModel, Field

from ch2b_tools import make_robot_tools
from ch2c_rag import build_manual_tool
from config import get_model
from robot_world import WORLD

MAX_ROUNDS = 8


# ---------- 1. Shared state ----------
class SquadState(MessagesState):
    next: str       # who acts next
    task: str       # instruction for that robot
    rounds: int     # safety counter against infinite loops


# ---------- 2. Workers: plain agents that reuse chapter 2 tools ----------
WORLD.add_robot("scout")
WORLD.add_robot("grip")

scout_agent = create_agent(
    model=get_model(),
    tools=[t for t in make_robot_tools("scout") if t.name in {"move_to", "scan_surroundings", "check_battery"}]
    + [build_manual_tool()],
    system_prompt="You are SCOUT, a fast explorer robot. You cannot pick things up. Report findings briefly.",
)
grip_agent = create_agent(
    model=get_model(),
    tools=make_robot_tools("grip"),
    system_prompt="You are GRIP, a strong robot with a gripper. Execute the task and report briefly.",
)


def make_worker(name: str, agent):
    def node(state: SquadState) -> dict:
        # From the worker's point of view the supervisor is an external entity -> HumanMessage,
        # with a header so it knows who is talking.
        order = HumanMessage(f"[FROM: supervisor] {state['task']}")
        result = agent.invoke({"messages": [order]})
        return {"messages": [AIMessage(content=result["messages"][-1].text, name=name)]}

    return node


# ---------- 3. Supervisor: decides the next node ----------
class Route(BaseModel):
    next: Literal["scout", "grip", "FINISH"] = Field(description="Which robot acts next, or FINISH.")
    task: str = Field(description="Short, concrete instruction for that robot.")


SUPERVISOR_PROMPT = (
    "You coordinate two lab robots. SCOUT explores and reads manuals, GRIP carries items. "
    "Given the mission log, choose who acts next and give them one concrete task. "
    "Choose FINISH when the mission is complete."
)
router = get_model().with_structured_output(Route)


def supervisor(state: SquadState) -> dict:
    log = "\n".join(f"{m.name or m.type}: {m.text}" for m in state["messages"])
    decision = router.invoke(
        [SystemMessage(SUPERVISOR_PROMPT), HumanMessage(f"Mission log:\n{log}\n\nWho acts next?")]
    )
    rounds = state.get("rounds", 0) + 1
    print(f"  [supervisor] -> {decision.next}: {decision.task}")
    return {"next": "FINISH" if rounds > MAX_ROUNDS else decision.next, "task": decision.task, "rounds": rounds}


# ---------- 4. Wire the graph ----------
builder = StateGraph(SquadState)
builder.add_node("supervisor", supervisor)
builder.add_node("scout", make_worker("scout", scout_agent))
builder.add_node("grip", make_worker("grip", grip_agent))

builder.add_edge(START, "supervisor")
builder.add_conditional_edges(
    "supervisor",
    lambda state: state["next"],
    {"scout": "scout", "grip": "grip", "FINISH": END},
)
builder.add_edge("scout", "supervisor")  # cycles: workers always report back
builder.add_edge("grip", "supervisor")
squad = builder.compile()

if __name__ == "__main__":
    print(squad.get_graph().draw_mermaid())  # paste into mermaid.live to see the graph
    goal = "Find the sensor kit and bring it to the workbench, following the lab safety rules."
    final = squad.invoke({"messages": [HumanMessage(goal)]})
    for msg in final["messages"]:
        print(f"{(msg.name or msg.type).upper():>8}: {msg.text}")
    print("\n" + WORLD.render())
