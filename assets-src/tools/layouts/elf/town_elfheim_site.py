"""Elfheim's site on the world map (docs/WORLD_PLAN.md 4.2, 5.3), as plain constants in world cells.

Defaults from W1-0b. ELF-T owns this file and edits it when it builds the town; ELF-O's `world_elf.py` imports it
(whichever merges first), so the two never edit one file. A change here changes the generated world files: the
integrator regenerates them under the lock, never hand-merges (QUEST 4.0).
"""
TOWN = "elfheim"
ANCHOR = "elf_elfheim"         # the land-gate entrance of the compiled overworld (assets/data/world-anchors.yaml)
GATE = (82, 150)               # the anchor's cell, its 2.2 target (+-2 per axis allowed): the arrival on leaving
ICON = [(x, y) for y in range(151, 154) for x in range(81, 84)]   # the town icon's cells (blocked art), 3x3
DOOR = (82, 151)               # the icon cell whose transition leads to the town map's `gate` entrance
DOCK = {"id": "elf_port", "x": 84, "y": 147, "basin": "aldi"}      # the harbour on Elfland's north coast
SPAWN = None                   # no vehicle starts here
