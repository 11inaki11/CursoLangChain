"""
Chapter 2b — Tools: give the robot hands and sensors.

A tool is just a Python function with a docstring. The @tool decorator
turns it into something the LLM can decide to call.
Run:  python ch2b_tools.py
"""

from langchain.agents import create_agent
from langchain.tools import tool

from config import get_model
from robot_world import WORLD


def make_robot_tools(robot: str) -> list:
    """Build the toolset for one robot. Reused by every later chapter."""

    @tool
    def move_to(location: str) -> str:
        """Drive the robot to a location. Valid: dock, shelf_a, workbench, door, shelf_b."""
        return WORLD.move_to(robot, location)

    @tool
    def scan_surroundings() -> str:
        """Look around: items and robots at the current location."""
        return WORLD.scan(robot)

    @tool
    def check_battery() -> str:
        """Read the battery level (%)."""
        return WORLD.battery(robot)

    @tool
    def pick(item: str) -> str:
        """Pick up an item at the current location with the gripper."""
        return WORLD.pick(robot, item)

    @tool
    def place() -> str:
        """Place the item being held at the current location."""
        return WORLD.place(robot)

    @tool
    def charge() -> str:
        """Charge the battery to 100%. Only works at the dock."""
        return WORLD.charge(robot)

    return [move_to, scan_surroundings, check_battery, pick, place, charge]


SYSTEM_PROMPT = (
    "You are R-80, a lab robot. Use your tools to act in the lab. "
    "Always scan before picking something up. Be brief."
)

if __name__ == "__main__":
    WORLD.add_robot("r80")
    agent = create_agent(
        model=get_model(),
        tools=make_robot_tools("r80"),
        system_prompt=SYSTEM_PROMPT,
    )
    result = agent.invoke(
        {"messages": [{"role": "user", "content": "Bring the red cube to the workbench."}]}
    )
    for message in result["messages"]:
        message.pretty_print()
    print("\n" + WORLD.render())
