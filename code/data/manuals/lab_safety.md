# Lab 80 — Safety Rules for Robots and Humans

## Zones
- Zone A (shelf_a): storage of cubes and metal parts. Robots may enter freely.
- Zone B (shelf_b): delicate instruments and sensor kits. Humans must wear
  safety glasses. Robots must move in SLOW mode inside zone B.
- Workbench: shared area. A robot must announce itself before placing items
  on the workbench if a human is present.
- Door: robots must never leave the lab through the door without human approval.

## Human-in-the-loop
Any action that moves an item out of the lab, or that involves more than
one robot lifting the same item, requires explicit human confirmation.

## Emergencies
In case of fire alarm all robots return to the dock and power down
their grippers.
