"""Gurgu Volcano B1 and B2 (docs/WORLD_PLAN.md 4.4, stage S15; FIR-D1), original layouts -> assets-src/maps/gurgu-b1.yaml,
gurgu-b2.yaml.

  python3 -I assets-src/tools/layouts/fire/gurgu_upper.py && python3 -I assets-src/tools/build_map.py gurgu-b1 gurgu-b2

  gurgu-b1  the caldera rim: a walk all the way round a sheer crater of rock, entered from the volcano's south flank;
            two stairs down on opposite sides of the rim (east to B2's arrival, west to B2's west landing); a lava
            seam crosses the north arc (the south arcs reach both stairs dry); three blind fumarole spurs with chests
  gurgu-b2  the upper lava gallery, running west to east: two lava streams cross it from wall to wall, each with one
            ford of bare stone in its middle; its east stair goes on down to B3's north gallery, its west stair drops
            into B3's sealed forge; four blind side cuts, each with a chest
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(1, str(Path(__file__).resolve().parents[1]))
from common import polygon_mask  # noqa: E402
from gurgu_common import LOWER, UPPER, Room, chest  # noqa: E402,F401

SCRIPT = "fire/gurgu_upper.py"


def octagon(x0: int, y0: int, x1: int, y1: int, cut: int) -> list[tuple[int, int]]:
    """An octagon on the cell box [x0, x1) x [y0, y1) with corners cut by `cut` cells (polygon_mask points)."""
    return [(x0 + cut, y0), (x1 - cut, y0), (x1, y0 + cut), (x1, y1 - cut), (x1 - cut, y1), (x0 + cut, y1),
            (x0, y1 - cut), (x0, y0 + cut)]


# ════════════════════════════ B1: the caldera rim ════════════════════════════
b1 = Room("gurgu-b1", "Gurgu Volcano B1", 40, 34)
g = b1.g
outer = polygon_mask(g.w, g.h, octagon(3, 8, 37, 29, 4))
inner = polygon_mask(g.w, g.h, octagon(7, 12, 33, 25, 3))
for y in range(g.h):
    for x in range(g.w):
        if outer[y][x] and not inner[y][x]:
            g.set(x, y, "-")                     # the rim walk round the crater (the crater stays rock)
g.carve(19, 29, 20, 33)                          # the south flank passage, out to the overworld
g.carve(37, 16, 38, 19)                          # the east stair's niche
g.carve(1, 17, 2, 20)                            # the west stair's niche (one row lower: the rim is not a mirror)
g.rect(17, 8, 20, 11, "%")                       # the lava seam across the north arc
g.rect(30, 9, 31, 10, "%")                       # a lava weep in the north-east bend
for x, y0, y1 in [(24, 3, 7), (10, 4, 8)]:
    g.carve(x, y0, x, y1)                        # two north fumarole spurs (blind)
g.carve(9, 29, 9, 31)                            # the south-west spur (blind)
g.faces(2)
b1.stairs_down(37, 17, "gurgu-b2", "arrival")
b1.stairs_down(1, 18, "gurgu-b2", "west")
b1.transitions += [{"x": x, "y": 33, "targetMap": "overworld", "targetEntrance": "fir_volcano"} for x in (19, 20)]
for x in (14, 26):
    b1.deco([["brazier"]], x, 27)
b1.deco([["skulls"]], 5, 22)
b1.deco([["tpillar_broken_top"], ["tpillar_broken_bottom"]], 33, 21)
b1.npcs += [
    chest("rim_north", "ether", "an Ether", 24, 3),
    chest("rim_northwest_gauntlet", "silver_gauntlet", "a Silver Gauntlet", 10, 4),
    chest("rim_southwest", "phoenix_down", "a Phoenix Down", 9, 31),
]
b1.write("Gurgu Volcano B1: the caldera rim, walked round a sheer crater; stairs down on its east and west sides.",
         {"arrival": [19, 31], "down": [36, 18], "west": [3, 19]}, table=UPPER, bg="fire_temple", script=SCRIPT)

# ════════════════════════════ B2: the upper lava gallery ════════════════════════════
b2 = Room("gurgu-b2", "Gurgu Volcano B2", 48, 26)
g = b2.g
g.carve(3, 10, 23, 14)                           # the gallery's west reach
g.carve(22, 12, 44, 16)                          # its east reach, a step lower
g.carve(37, 6, 40, 11)                           # the east landing (from B1's east stair)
g.carve(5, 6, 8, 9)                              # the west landing (from B1's west stair)
g.carve(42, 17, 43, 20)                          # the stair down to B3's north gallery
g.carve(4, 15, 5, 19)                            # the stair down into B3's forge
g.rect(15, 10, 16, 14, "%")                      # the west lava stream, across the gallery's full height ...
g.rect(15, 12, 16, 12, "-")                      # ... but for a ford of bare stone in its middle
g.rect(30, 12, 31, 16, "%")                      # the east lava stream ...
g.rect(30, 14, 31, 14, "-")                      # ... and its ford
for x, y0, y1 in [(18, 5, 9), (27, 5, 11)]:
    g.carve(x, y0, x, y1)                        # two north side cuts (blind)
for x, y0, y1 in [(12, 15, 21), (34, 17, 22)]:
    g.carve(x, y0, x, y1)                        # two south side cuts (blind)
g.faces(2)
b2.stairs_up(38, 4, "gurgu-b1", "down")
b2.stairs_up(6, 4, "gurgu-b1", "west")
b2.stairs_down(42, 19, "gurgu-b3", "arrival")
b2.stairs_down(4, 18, "gurgu-b3", "forge")
for x in (10, 36):
    b2.deco([["brazier"]], x, 10 if x < 22 else 12)
b2.npcs += [
    chest("gallery_north_west", "hi_potion", "a Hi-Potion", 18, 5),
    chest("gallery_north_east", "opal_helm", "an Opal Helm", 27, 5),
    chest("gallery_south_west", "cabin", "a Cabin", 12, 21),
    chest("gallery_south_east", "ether", "an Ether", 34, 22),
]
b2.write("Gurgu Volcano B2: the upper lava gallery, west to east; two lava streams, each with one stone ford, cross it.",
         {"arrival": [38, 7], "west": [6, 7], "down": [42, 18], "forge": [4, 17]}, table=UPPER, bg="fire_temple",
         script=SCRIPT)
print("gurgu-b1, gurgu-b2 written")
