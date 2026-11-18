"""Ice Cavern B2 (docs/WORLD_PLAN.md 4.4, stage S16; FIR-D2) -> assets-src/maps/ice-cavern-b2.yaml.

  python3 -I assets-src/tools/layouts/fire/ice_b2.py && python3 -I assets-src/tools/build_map.py ice-cavern-b2

A field of sheet ice in three bands (south, middle, north), split by two ridges of ice rock with necks between them.
Cracked ice (`%`) does not hold: the hot spring under it throws whoever breaks through up a meltwater spout, a
one-way pit into a pocket of B1 (west of x 22 the west pocket, east of it the north-east one), whose stair comes back
down to this floor's arrival. The direct necks are
cracked; the safe ones are far round. The north band ends at the ice shelf, a wall of old ice with the hidden stair
hall behind it: talking to Hesk the ice-cutter plays `fir_d2_shelf`, which sets FIR_D2_SHELF, and the patch
`fir_d2_shelf` turns the shelf's cells into floor for good. Four chests: three in the field's blind spurs, one in the
stair hall.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ice_b1 import NOTE  # noqa: E402
from ice_common import SHELF, Floor, chest, talk  # noqa: E402

W, H = 44, 38
SHELF_CELLS = [(x, y) for y in (7, 8) for x in (20, 21)]          # the ice shelf, between the hall and the north band
NECK_CRACKS = [(20, 13), (21, 13), (20, 14), (21, 14),          # the direct neck under the shelf
               (10, 19), (11, 19), (10, 20), (11, 20),          # the west neck of the south ridge
               (36, 19), (37, 19), (36, 20), (37, 20)]          # its east neck
LOOSE_CRACKS = [(14, 16), (15, 17), (29, 16), (12, 10), (27, 11), (8, 23), (31, 22)]
SPLIT = 22                               # cracks west of this x drop to B1's west pocket, the rest to its north-east one


def build() -> Floor:
    f = Floor("ice-cavern-b2", "Ice Cavern B2", W, H)
    g = f.g
    g.rect(16, 2, 25, 6, "-")            # the hidden stair hall, behind the shelf
    g.rect(4, 9, 39, 12, "+")            # the north band
    g.rect(1, 10, 3, 10, "_")            # its west alcove (a dead end)
    for x0 in (5, 20, 34):               # the north ridge's necks: west and east safe, the middle one cracked
        g.rect(x0, 13, x0 + 1, 14, "+")
    g.rect(4, 15, 39, 18, "+")           # the middle band
    g.rect(40, 16, 42, 16, "_")          # its east spur (a dead end)
    for x0 in (10, 22, 36):              # the south ridge's necks: the middle one safe, both sides cracked
        g.rect(x0, 19, x0 + 1, 20, "+")
    g.rect(4, 21, 39, 25, "+")           # the south band
    g.rect(1, 23, 3, 23, "_")            # its west spur (a dead end)
    for x0, y0, x1, y1 in ((9, 16, 10, 17), (25, 15, 27, 16), (33, 22, 34, 24), (17, 10, 18, 11)):
        g.rect(x0, y0, x1, y1, "W")      # ice rock standing in the field
    g.rect(16, 26, 17, 30, "-")          # the way up from the arrival room
    g.rect(13, 31, 27, 35, "-")          # the arrival room
    for x, y in NECK_CRACKS + LOOSE_CRACKS:
        g.set(x, y, "%")
    g.faces(2)
    f.stairs_up(22, 29, "ice-cavern-b1", "down")             # back up to B1's stair chamber
    f.stairs_down(20, 3, "ice-cavern-b3", "arrival")         # the true way down, behind the shelf
    f.transitions += [{"x": x, "y": y, "targetMap": "ice-cavern-b1",
                       "targetEntrance": "pocket_w" if x < SPLIT else "pocket_e"} for x, y in NECK_CRACKS + LOOSE_CRACKS]
    f.floe(6, 16)
    f.floe(30, 23)
    f.floe(37, 10)
    f.pillar(16, 3)
    f.pillar(25, 3)
    f.deco([["skulls"]], 24, 33)
    f.npcs += [
        chest("b2_alcove", "phoenix_down", "a Phoenix Down", 1, 10),
        chest("b2_spur", "opal_armlet", "an Opal Armlet", 42, 16),
        chest("b2_south", "hi_potion", "a Hi-Potion", 1, 23),
        chest("b2_hall", "ice_brand", "an Ice Brand", 17, 5),
        {"id": "fir_d2_hesk", "sprite": "old_man", "tint": "#d8e8f4", "x": 23, "y": 9,
         "cutscene": {"id": "fir_d2_shelf", "onceFlag": SHELF}, "dialog": talk(
             (SHELF, ["Hesk: There's your stair, and good riddance to the secret. Go carefully. The eye below has "
                      "never once blinked in my lifetime."]),
             (None, ["An old man in a coat of white furs sits on an upturned bucket, an ice pick across his knees.",
                     "Hesk: Knock on that shelf and hear it ring. Hollow as a drum. My guild sealed our stair behind "
                     "it when the eye moved in, and I'm the last who knows where to strike."]))},
    ]
    return f


def main() -> None:
    f = build()
    inspect = [{"x": x, "y": 8, "text": [
        {"condition": SHELF, "text": ["The broken shelf's edges are sharp and clean, cut by a skilled hand."]},
        {"text": ["A shelf of old grey ice, smoother than the rest. When you knock, it rings hollow."]}]}
        for x in (20, 21)]
    patch = {"id": "fir_d2_shelf", "flag": SHELF, "cells": [list(c) for c in SHELF_CELLS], "ground": "-"}
    print(f.write("b2", "Ice Cavern B2: three bands of cracked sheet ice; the true stair hides behind the ice shelf.\n"
                        + NOTE,
                  {"arrival": [22, 32], "down": [20, 5]},
                  extra={"canSave": False, "inspect": inspect, "patches": [patch]}, roots=["down"]))


if __name__ == "__main__":
    main()
