"""Onrac's site on the world map (docs/WORLD_PLAN.md 4.6, 5.3), as plain constants in world cells.

Defaults from W1-0b. WAT-T owns this file and edits it when it builds the town; WAT-O's `world_water.py` imports it
(whichever merges first), so the two never edit one file. A change here changes the generated world files: the
integrator regenerates them under the lock, never hand-merges (QUEST 4.0).

WAT-T (built): the defaults stand. The town map `onrac` (`town_onrac.py`) is no longer a stub, so WAT-O's module now
compiles the icon's door transition (DOOR -> `onrac` entrance `gate`); leaving the town by its cliff gate arrives at
GATE, the meadow cell south of the icon. The submarine is inside the town (the dry dock), not on the world map.
"""
TOWN = "onrac"
ANCHOR = "wat_onrac"           # the land-gate entrance of the compiled overworld (assets/data/world-anchors.yaml)
GATE = (28, 39)                # the anchor's cell, its 2.2 target (+-2 per axis allowed): the arrival on leaving
ICON = [(x, y) for y in range(36, 39) for x in range(27, 30)]     # the town icon's cells (blocked art), 3x3
DOOR = (28, 38)                # the icon cell whose transition leads to the town map's `gate` entrance
DOCK = None                    # airship-only (WATER has no dock, 2.8); the submarine is inside the town map
SPAWN = None                   # no vehicle starts here
