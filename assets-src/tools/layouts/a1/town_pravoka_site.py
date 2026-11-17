"""Pravoka's site on the world map (docs/WORLD_PLAN.md 4.1, 5.3), as plain constants in world cells.

Defaults from W1-0b. A1-T owns this file and edits it when it builds the town; A1-O's `world_a1.py` imports it
(whichever merges first), so the two never edit one file. A change here changes the generated world files: the
integrator regenerates them under the lock, never hand-merges (QUEST 4.0).
"""
TOWN = "pravoka"
ANCHOR = "a1_pravoka"          # the land-gate entrance of the compiled overworld (assets/data/world-anchors.yaml)
GATE = (131, 101)              # the anchor's cell, its 2.2 target (+-2 per axis allowed): the arrival on leaving
ICON = [(130, 99), (131, 99), (130, 100), (131, 100)]          # the town icon's cells (blocked art)
DOOR = (131, 100)              # the icon cell whose transition leads to the town map's `gate` entrance
# the quay, in the channel; at least 6 Water cells must stay between the quay and the range (4.1, rows 92-110)
DOCK = {"id": "a1_pravoka", "x": 132, "y": 102, "basin": "aldi"}
SPAWN = {"type": "ship", "x": 132, "y": 102, "requiredFlag": "BIKKE_DEFEATED"}   # the brig, parked on the quay
