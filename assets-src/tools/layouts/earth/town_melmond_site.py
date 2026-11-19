"""Melmond's site on the world map (docs/WORLD_PLAN.md 4.3, 5.3), as plain constants in world cells.

Defaults from W1-0b. ERT-T owns this file and edits it when it builds the town; ERT-O's `world_earth.py` imports it
(whichever merges first), so the two never edit one file. A change here changes the generated world files: the
integrator regenerates them under the lock, never hand-merges (QUEST 4.0).
"""
TOWN = "melmond"
ANCHOR = "ert_melmond"         # the land-gate entrance of the compiled overworld (assets/data/world-anchors.yaml)
GATE = (42, 112)               # the anchor's cell, its 2.2 target (+-2 per axis allowed): the arrival on leaving
# the town icon's cells (blocked art), 4x3: LM4-INT grew it one column west for the approved 4x3 icon
ICON = [(x, y) for y in range(111, 114) for x in range(38, 42)]
DOOR = (41, 112)               # the icon cell whose transition leads to the town map's `gate` entrance
DOCK = {"id": "ert_melmond", "x": 43, "y": 113, "basin": "ocean"}  # the harbour on the western strait
SPAWN = None                   # no vehicle starts here
