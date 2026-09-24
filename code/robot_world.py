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


class World:
    """Shared state of the lab: robots + where every item is."""

    def __init__(self) -> None:
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

    def get(self, name: str) -> Robot:
        if name not in self.robots:
            raise ValueError(f"Unknown robot '{name}'. Known: {list(self.robots)}")
        return self.robots[name]

    # ---------- actions (what tools will call) ----------
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

    def scan(self, robot_name: str) -> str:
        robot = self.get(robot_name)
        here = [item for item, loc in self.items.items() if loc == robot.position]
        others = [r.name for r in self.robots.values() if r.position == robot.position and r.name != robot.name]
        return (
            f"{robot.name} at {robot.position} {robot.xy}. "
            f"Items here: {here or 'none'}. Other robots here: {others or 'none'}. "
            f"Holding: {robot.holding or 'nothing'}."
        )

    def battery(self, robot_name: str) -> str:
        robot = self.get(robot_name)
        return f"{robot.name} battery: {robot.battery}%."

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

    def place(self, robot_name: str) -> str:
        robot = self.get(robot_name)
        if not robot.holding:
            return f"ERROR: {robot.name} is not holding anything."
        item, robot.holding = robot.holding, None
        self.items[item] = robot.position
        robot.log.append(f"placed {item} at {robot.position}")
        return f"{robot.name} placed {item} at {robot.position}."

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
    WORLD.add_robot("r80")
    print(WORLD.move_to("r80", "shelf_a"))
    print(WORLD.pick("r80", "red_cube"))
    print(WORLD.move_to("r80", "workbench"))
    print(WORLD.place("r80"))
    print(WORLD.scan("r80"))
    print(WORLD.render())
