"""The sky castle 1F and 2F (docs/WORLD_PLAN.md 4.7, stage S28; WND-D2), original layouts -> assets-src/maps/
sky-castle-1f.yaml, sky-castle-2f.yaml.

  python3 -I assets-src/tools/layouts/wind/sky_lower.py && python3 -I assets-src/tools/build_map.py sky-castle-1f sky-castle-2f

  sky-castle-1f  the dock ring: an octagonal walk round a well of open sky, four spokes over the air to a central
                 hub whose north stair climbs to 2F's arrival island; the Mirage console's beam sets the party down
                 on the south berth (entrance `arrival`), whose tip drops back to the Mirage Tower's top; the east
                 berth holds a second stair up (to 2F's east island), three blind berths a chest each
  sky-castle-2f  the light-bridge maze: six floating islands over the sky, joined by narrow light-bridges and by
                 amber conveyor belts that carry the walker one way only (B to D, C to F, D to the stair island E, and
                 E back to C); the stair up stands on E, reached only by a belt; three blind bridge stubs hold chests
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(1, str(Path(__file__).resolve().parents[1]))
from common import polygon_mask  # noqa: E402
from sky_common import LOWER, Room, chest  # noqa: E402

SCRIPT = "wind/sky_lower.py"


def octagon(x0: int, y0: int, x1: int, y1: int, cut: int) -> list[tuple[int, int]]:
    """An octagon on the cell box [x0, x1) x [y0, y1) with corners cut by `cut` cells (polygon_mask points)."""
    return [(x0 + cut, y0), (x1 - cut, y0), (x1, y0 + cut), (x1, y1 - cut), (x1 - cut, y1), (x0 + cut, y1),
            (x0, y1 - cut), (x0, y0 + cut)]


# ════════════════════════════ 1F: the dock ring ════════════════════════════
f1 = Room("sky-castle-1f", "Sky Castle 1F", 40, 38)
g = f1.g
outer = polygon_mask(g.w, g.h, octagon(5, 6, 35, 32, 5))
inner = polygon_mask(g.w, g.h, octagon(8, 9, 32, 29, 4))
for y in range(g.h):
    for x in range(g.w):
        if outer[y][x] and not inner[y][x]:
            g.set(x, y, "-")                     # the ring walk round the well of sky
g.carve(16, 15, 24, 23)                          # the hub
g.carve(21, 9, 22, 14, "+")                      # the north spoke (light-bridge over the sky)
g.carve(19, 24, 20, 28, "+")                     # the south spoke
g.carve(8, 18, 15, 19, "+")                      # the west spoke
g.carve(25, 20, 31, 21, "+")                     # the east spoke
g.carve(19, 32, 20, 36)                          # the south berth: the beam's landing, its tip the beam down
g.carve(35, 20, 38, 21)                          # the east berth, its stair up to 2F's east island
g.carve(20, 1, 20, 5)                            # the north berth (blind)
g.carve(1, 18, 4, 18)                            # the west berth (blind)
g.carve(35, 26, 38, 26)                          # the south-east berth (blind)
g.faces(2)
f1.stairs_up(17, 13, "sky-castle-2f", "arrival")
f1.stairs_up(36, 18, "sky-castle-2f", "east")
f1.transitions += [{"x": x, "y": 36, "targetMap": "mirage-3f", "targetEntrance": "ring"} for x in (19, 20)]
f1.deco([["map_table_l", "map_table_r"]], 19, 19)  # the berth chart on the hub
for x, y in [(16, 22), (24, 22), (24, 15)]:
    f1.deco([["brazier"]], x, y)
for x in (13, 26):
    f1.statue(x, 29)
f1.npcs += [
    chest("berth_north", "hi_potion", "a Hi-Potion", 20, 1),
    chest("berth_west", "phoenix_down", "a Phoenix Down", 1, 18),
    chest("berth_southeast", "ether", "an Ether", 38, 26),
]
f1.write("Sky Castle 1F: the dock ring round a well of sky; four spokes to the hub, whose stair climbs to 2F.",
         {"arrival": [19, 34], "up": [17, 16], "up_east": [37, 21]}, table=LOWER, bg="sky_palace", script=SCRIPT,
         # the berth's ward opens for those the console sent up (it is always open in play: mirage_ascent sets the
         # flag before its warp; in assume mode it keeps S28's requirement load-bearing, proof (b))
         extra={"keyItemGates": [{"x": x, "y": 32, "requiredFlag": "SKY_FORTRESS_OPEN", "permanent": True,
                                  "message": "A ward of still air closes the berth. Only the Mirage's console can "
                                             "open the castle."} for x in (19, 20)],
                "inspect": [{"x": 19, "y": 19, "text": [
             "A chart of the castle's berths is cut into the table. Every berth is marked with a ship's name, and every "
             "name has been scratched through."]}]})

# ════════════════════════════ 2F: the light-bridge maze ════════════════════════════
f2 = Room("sky-castle-2f", "Sky Castle 2F", 46, 34)
g = f2.g
g.carve(3, 24, 11, 30)                           # A, the arrival island (1F's hub stair)
g.carve(34, 24, 42, 30)                          # B, the east island (1F's east berth stair)
g.carve(3, 5, 11, 12)                            # C, the north-west island
g.carve(17, 4, 30, 8)                            # E, the stair island
g.carve(29, 13, 37, 19)                          # D, the east-centre island
g.carve(16, 12, 23, 18)                          # F, the centre island
g.carve(12, 27, 33, 27, "+")                     # A - B, the long south bridge
g.carve(22, 28, 22, 31, "+")                     # ... and its blind stub
g.carve(7, 13, 7, 23, "+")                       # A - C
g.carve(8, 18, 10, 18, "+")                      # ... and its blind stub
g.carve(24, 16, 28, 16, "+")                     # F - D
g.carve(38, 14, 41, 14, "+")                     # a blind stub off D
g.faces(2)
f2.belt([(35, y) for y in range(20, 24)], "d_belt")        # B => D
f2.belt([(x, 12) for x in range(12, 16)], "f_belt")        # C => F
f2.belt([(30, y) for y in range(9, 13)], "e_belt")         # D => E
f2.belt([(x, 6) for x in range(12, 17)], "c_belt")         # E => C
f2.stairs_down(5, 28, "sky-castle-1f", "up")
f2.stairs_down(38, 28, "sky-castle-1f", "up_east")
f2.stairs_up(21, 2, "sky-castle-3f", "arrival")
for x, y in [(4, 25), (10, 25), (34, 25), (42, 25), (17, 13), (23, 13)]:
    f2.deco([["brazier"]], x, y)
f2.npcs += [
    chest("bridge_south", "diamond_helm", "a Diamond Helm", 22, 31),
    chest("bridge_west", "cabin", "a Cabin", 10, 18),
    chest("bridge_east", "hi_potion", "a Hi-Potion", 41, 14),
]
f2.write("Sky Castle 2F: the light-bridge maze; islands over the sky, joined by bridges and one-way belts.",
         {"arrival": [8, 26], "east": [36, 26], "up": [21, 5], "c_belt": [7, 8], "d_belt": [31, 15],
          "e_belt": [24, 6], "f_belt": [19, 15]}, table=LOWER, bg="sky_palace", script=SCRIPT,
         extra={"no_unreachable_walkable": {"reach_roots": ["east"]}})
print("sky-castle-1f, sky-castle-2f written")
