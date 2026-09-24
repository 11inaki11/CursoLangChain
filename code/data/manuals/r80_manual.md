# R-80 Service Manual (rev. 1986)

## 1. Overview
The R-80 is a wheeled lab assistant robot built for small laboratories.
It moves on a grid, carries one item at a time with its magnetic gripper
and reports its state through onboard sensors.

## 2. Specifications
- Maximum payload: 2.5 kg. Items above this weight must be carried by two robots.
- Top speed: 0.8 m/s on flat floors.
- Battery: 48 V Li-ion pack. Each grid step consumes about 2 % of battery.
- Full charge time at the dock: 45 minutes.
- Operating temperature: 5 °C to 40 °C.

## 3. Gripper
The magnetic gripper works with metal parts and with the lab's red cubes,
which have a steel core. Fragile items (glassware, sensor kits) must be
picked in SLOW mode and never placed on the floor.

## 4. Battery policy
If battery drops below 20 %, the R-80 must return to the dock before
starting any new task. Never start a task that would drop the battery
below 10 %.

## 5. Error codes
- E01: path blocked — replan the route.
- E02: gripper overload — item exceeds payload.
- E07: low battery — return to dock immediately.
