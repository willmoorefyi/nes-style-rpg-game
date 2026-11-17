"""Crescent Lake's site on the world map (docs/WORLD_PLAN.md 4.4, 5.3), as plain constants in world cells.

Defaults from W1-0b. FIR-T owns this file and edits it when it builds the town; FIR-O's `world_fire.py` imports it
(whichever merges first), so the two never edit one file. A change here changes the generated world files: the
integrator regenerates them under the lock, never hand-merges (QUEST 4.0).
"""
TOWN = "crescent"
ANCHOR = "fir_crescent"        # the land-gate entrance of the compiled overworld (assets/data/world-anchors.yaml)
GATE = (148, 124)              # the anchor's cell, its 2.2 target (+-2 per axis allowed): the arrival on leaving
ICON = [(x, y) for y in range(123, 126) for x in range(149, 152)]  # the town icon's cells (blocked art), 3x3
DOOR = (149, 124)              # the icon cell whose transition leads to the town map's `gate` entrance
DOCK = {"id": "fir_crescent", "x": 146, "y": 124, "basin": "ocean"}  # the harbour on the outer channel (x 142-147)
SPAWN = None                   # the canoe is an ability (QUEST 3.3), not a spawn
