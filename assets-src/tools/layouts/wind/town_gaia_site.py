"""Gaia's site on the world map (docs/WORLD_PLAN.md 4.7, 5.3), as plain constants in world cells.

Defaults from W1-0b. WND-T owns this file and edits it when it builds the town; WND-O's `world_wind.py` imports it
(whichever merges first), so the two never edit one file. A change here changes the generated world files: the
integrator regenerates them under the lock, never hand-merges (QUEST 4.0).
"""
TOWN = "gaia"
ANCHOR = "wnd_gaia"            # the land-gate entrance of the compiled overworld (assets/data/world-anchors.yaml)
GATE = (150, 14)               # the anchor's cell, its 2.2 target (+-2 per axis allowed): the arrival on leaving
ICON = [(x, y) for y in range(11, 14) for x in range(149, 152)]   # the town icon's cells (blocked art), 3x3
DOOR = (150, 13)               # the icon cell whose transition leads to the town map's `gate` entrance
DOCK = None                    # airship-only (WIND has no dock, 2.8); a landing meadow lies on the bowl's floor
SPAWN = None                   # no vehicle starts here
