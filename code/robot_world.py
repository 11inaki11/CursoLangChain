"""
robot_world.py — a tiny, dependency-free robot lab.

This is the "hardware" every chapter talks to. There is no LLM here: just
plain Python that keeps track of where the robots are, what they carry and
how much battery they have left. The agents in later chapters control it
through tools.

    y
    0  DOCK . . . . . . SHELF_A
    1  .    . . . . . . .
    2  .    . . . . . . .
    3  .    . . WORKBENCH . . .
    4  .    . . . . . . .
    5  DOOR . . . . . . SHELF_B
       0    1 2 3 4 5 6 7   x
"""

from __future__ import annotations

import functools
import threading
import time
from dataclasses import dataclass, field

GRID_W, GRID_H = 8, 6

LOCATIONS: dict[str, tuple[int, int]] = {
    "dock": (0, 0),
    "shelf_a": (7, 0),
    "workbench": (3, 3),
    "door": (0, 5),
    "shelf_b": (7, 5),
}

BATTERY_PER_STEP = 2  # % of battery used per grid cell travelled


@dataclass
class Robot:
    name: str
    position: str = "dock"
    battery: int = 100
    holding: str | None = None
    log: list[str] = field(default_factory=list)

    @property
    def xy(self) -> tuple[int, int]:
        return LOCATIONS[self.position]


def action(pause: float):
    """Log every action for the live viewer and, when it is open, take some
    "physical" time so movements can be watched (see lab_viewer.py)."""
    def decorate(method):
        @functools.wraps(method)
        def wrapper(self, robot_name, *args):
            result = method(self, robot_name, *args)
            self.emit("world", result, robot=robot_name)
            if self.realtime:
                time.sleep(pause)
            return result
        return wrapper
    return decorate


class World:
    """Shared state of the lab: robots + where every item is."""

    def __init__(self) -> None:
        self.realtime = False            # set by lab_viewer.start_viewer()
        self.events: list[dict] = []     # what the live viewer displays
        self._lock = threading.Lock()
        self.robots: dict[str, Robot] = {}
        self.items: dict[str, str] = {
            "red_cube": "shelf_a",
            "sensor_kit": "shelf_b",
            "wrench": "workbench",
        }

    # ---------- setup ----------
    def add_robot(self, name: str, position: str = "dock") -> Robot:
        robot = Robot(name=name, position=position)
        self.robots[name] = robot
        return robot

    def emit(self, kind: str, text: str, robot: str | None = None, **extra) -> None:
        with self._lock:
            self.events.append({"id": len(self.events), "kind": kind, "text": text, "robot": robot, **extra})

    def snapshot(self) -> dict:
        """Everything the viewer needs, as plain JSON-able data."""
        with self._lock:
            return {
                "grid": [GRID_W, GRID_H],
                "locations": LOCATIONS,
                "robots": [{"name": r.name, "position": r.position, "battery": r.battery, "holding": r.holding}
                           for r in self.robots.values()],
                "items": dict(self.items),
                "events": list(self.events),
            }

    def get(self, name: str) -> Robot:
        if name not in self.robots:
            raise ValueError(f"Unknown robot '{name}'. Known: {list(self.robots)}")
        return self.robots[name]

    # ---------- actions (what tools will call) ----------
    @action(pause=1.0)
    def move_to(self, robot_name: str, location: str) -> str:
        robot = self.get(robot_name)
        if location not in LOCATIONS:
            return f"ERROR: unknown location '{location}'. Valid: {list(LOCATIONS)}"
        (x0, y0), (x1, y1) = robot.xy, LOCATIONS[location]
        steps = abs(x1 - x0) + abs(y1 - y0)
        cost = steps * BATTERY_PER_STEP
        if cost > robot.battery:
            return f"ERROR: not enough battery ({robot.battery}%) for {steps} steps."
        robot.battery -= cost
        robot.position = location
        robot.log.append(f"moved to {location}")
        return f"{robot.name} arrived at {location} after {steps} steps. Battery: {robot.battery}%."

    @action(pause=0.6)
    def scan(self, robot_name: str) -> str:
        robot = self.get(robot_name)
        here = [item for item, loc in self.items.items() if loc == robot.position]
        others = [r.name for r in self.robots.values() if r.position == robot.position and r.name != robot.name]
        return (
            f"{robot.name} at {robot.position} {robot.xy}. "
            f"Items here: {here or 'none'}. Other robots here: {others or 'none'}. "
            f"Holding: {robot.holding or 'nothing'}."
        )

    @action(pause=0.3)
    def battery(self, robot_name: str) -> str:
        robot = self.get(robot_name)
        return f"{robot.name} battery: {robot.battery}%."

    @action(pause=0.5)
    def pick(self, robot_name: str, item: str) -> str:
        robot = self.get(robot_name)
        if robot.holding:
            return f"ERROR: {robot.name} is already holding {robot.holding}."
        if self.items.get(item) != robot.position:
            return f"ERROR: {item} is not at {robot.position}."
        self.items[item] = f"robot:{robot.name}"
        robot.holding = item
        robot.log.append(f"picked {item}")
        return f"{robot.name} picked up {item}."

    @action(pause=0.5)
    def place(self, robot_name: str) -> str:
        robot = self.get(robot_name)
        if not robot.holding:
            return f"ERROR: {robot.name} is not holding anything."
        item, robot.holding = robot.holding, None
        self.items[item] = robot.position
        robot.log.append(f"placed {item} at {robot.position}")
        return f"{robot.name} placed {item} at {robot.position}."

    @action(pause=0.6)
    def charge(self, robot_name: str) -> str:
        robot = self.get(robot_name)
        if robot.position != "dock":
            return f"ERROR: {robot.name} must be at the dock to charge."
        robot.battery = 100
        return f"{robot.name} fully charged: 100%."

    # ---------- debugging ----------
    def render(self) -> str:
        """ASCII map, handy to print after each run."""
        grid = [["." for _ in range(GRID_W)] for _ in range(GRID_H)]
        symbols = {"dock": "D", "shelf_a": "A", "workbench": "W", "door": "X", "shelf_b": "B"}
        for name, (x, y) in LOCATIONS.items():
            grid[y][x] = symbols[name]
        for robot in self.robots.values():
            x, y = robot.xy
            grid[y][x] = robot.name[0].lower()
        return "\n".join(" ".join(row) for row in grid)


# One shared world for the whole course. Chapters import it.
WORLD = World()


if __name__ == "__main__":
    from lab_viewer import start_viewer, wait_to_close

    WORLD.add_robot("r80")
    start_viewer("Boot sequence · robot_world.py")
    print(WORLD.move_to("r80", "shelf_a"))
    print(WORLD.pick("r80", "red_cube"))
    print(WORLD.move_to("r80", "workbench"))
    print(WORLD.place("r80"))
    print(WORLD.scan("r80"))
    print(WORLD.render())
    wait_to_close()
