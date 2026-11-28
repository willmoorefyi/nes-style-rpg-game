"""The Mirage Tower (docs/WORLD_PLAN.md 4.7, stage S27; WND-D1), original layouts -> assets-src/maps/mirage-*.yaml.

  python3 -I assets-src/tools/layouts/wind/mirage_floors.py && python3 -I assets-src/tools/build_map.py mirage-1f mirage-2f mirage-3f

  mirage-1f  the vestibule (the overworld door's `arrival`) and its chime door, a `keyItemGates` pair that wants the
             `chime` (beyond it, `inner`); then the spiral gallery: an outer and an inner ring round the shaft's foot,
             each blocked just short of where it is entered, so the walker winds the whole way round twice before the
             core; the core's stair up, and the sealed well at the shaft's foot (its own stair up, a chest, and the
             landing of the fall from 2F)
  mirage-2f  two half-floors either side of the open shaft, joined only by a bronze bridge; the west half runs from the
             arrival hall up a corridor to the north room (the stair down into the well) and the ledge to the bridge;
             one cracked span off the bridge
             drops the walker into the 1F well (one-way); the east half holds the stair up
  mirage-3f  the console room: a console of bronze dials with a square socket (`requiredItem: cube`, cutscene
             `mirage_ascent`, onceFlag SKY_FORTRESS_OPEN, which warps to `sky-castle-1f` `arrival`); the bronze ring
             in the floor before it lifts the party to the sky castle again once SKY_FORTRESS_OPEN is set
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wind.mirage_common import OPEN, Room, chest  # noqa: E402

RING = [[f"sky_ring_icon_{r}_{c}" for c in range(2)] for r in range(2)]   # kit.LANDMARKS' code-drawn placeholder
DOOR = ("A tall door of pale metal fills the arch, without handle or keyhole. Along its frame runs a row of small "
        "bronze cups, and it gives off a faint hum, as if it were waiting to hear one note.")

# ════════════════════════════ 1F: the vestibule, the spiral and the well ════════════════════════════
f1 = Room("mirage-1f", "Mirage Tower 1F", 38, 40, "1f")
g = f1.g
for x0, y0, x1, y1 in [(2, 3, 35, 4), (2, 27, 35, 28), (2, 3, 3, 28), (34, 3, 35, 28)]:
    g.carve(x0, y0, x1, y1)              # the outer ring
for x0, y0, x1, y1 in [(7, 8, 30, 9), (7, 22, 30, 23), (7, 8, 8, 23), (29, 8, 30, 23)]:
    g.carve(x0, y0, x1, y1)              # the inner ring
g.rect(15, 27, 16, 28, "W")              # the outer ring is blocked just west of the door's way in
g.rect(12, 22, 13, 23, "W")              # and the inner ring just east of its way in
g.carve(10, 24, 11, 26)                  # outer ring -> inner ring (the far end of the first turn)
g.carve(12, 13, 25, 19)                  # the core round the shaft's foot
g.rect(15, 13, 22, 17, "W")              # the well's walls
g.carve(16, 15, 21, 16, "%")             # the well: fallen masonry at the shaft's foot
g.carve(18, 20, 19, 21)                  # inner ring -> the core (the far end of the second turn)
g.carve(20, 5, 20, 6)                    # the outer ring's north spur (a dead end)
g.carve(32, 16, 33, 16)                  # the outer ring's east spur (a dead end)
g.carve(9, 16, 10, 16)                   # the inner ring's west spur (a dead end)
g.carve(13, 32, 24, 36)                  # the vestibule
g.carve(12, 34, 12, 34)                  # its two niches (dead ends)
g.carve(25, 34, 25, 34)
g.carve(18, 29, 19, 31, "+")             # the chime door's arch (its first row is the gate)
g.carve(18, 37, 19, 39)                  # the way out to the sands
g.faces(2)
f1.stairs_up(12, 11, "mirage-2f", "arrival")
f1.stairs_up(18, 13, "mirage-2f", "well")
f1.transitions += [{"x": x, "y": 39, "targetMap": "overworld", "targetEntrance": "wnd_mirage"} for x in (18, 19)]
for x in (14, 23):
    f1.statue(x, 33)
for x in (16, 21):
    f1.wall([["torch"]], x, 30)
for x in (6, 31):
    f1.wall([["banner"]], x, 1)
f1.wall([["banner"]], 18, 6)
f1.wall([["torch"]], 24, 11)
f1.deco([["globe"]], 24, 13)
f1.deco([["fallen_l", "fallen_r"]], 16, 15)
f1.npcs += [
    chest("outer_spur", "cabin", "a Cabin", 20, 6),
    chest("inner_spur", "phoenix_down", "a Phoenix Down", 10, 16),
    chest("well", "diamond_helm", "a Diamond Helm", 21, 15),
]
f1.write("Mirage Tower 1F: the vestibule and its chime door; the spiral gallery wound twice round the shaft's foot.",
         {"arrival": [18, 37], "inner": [18, 29], "up": [12, 13], "well": [18, 15], "shaft": [20, 16]},
         # the well is reached only from 2F (its stair down, or the fall): a reach root, and no chokepoint check (it
         # floods from the arrival alone; 1F's only static NPCs are the three chests, each at a dead end)
         extra={"no_unreachable_walkable": {"reach_roots": ["well"]}, "no_static_chokepoints": False,
                "keyItemGates": [{"x": x, "y": 31, "requiredItem": "chime", "permanent": False, "message": DOOR}
                                 for x in (18, 19)],
                "inspect": [{"x": 14, "y": 34, "text": [
                    "Words are cut into the statue's base: \"We built upward, one floor a night, until the ground let "
                    "go of us.\""]}]})

# ════════════════════════════ 2F: the two half-floors and the bridge ════════════════════════════
f2 = Room("mirage-2f", "Mirage Tower 2F", 40, 32, "2f")
g = f2.g
g.rect(16, 3, 23, 28, "x")               # the open shaft
g.carve(3, 22, 13, 27)                   # west half: the south hall (the arrival)
g.carve(3, 8, 4, 21)                     # the west corridor
g.carve(3, 5, 13, 9)                     # the north room
g.carve(10, 3, 10, 4)                    # its north spur (a dead end)
g.carve(5, 14, 6, 14)                    # the corridor's east spur (a dead end)
g.carve(13, 10, 14, 15)                  # the ledge down the shaft's west lip
g.carve(15, 14, 24, 15, "+")             # the bronze bridge over the shaft
g.carve(19, 16, 19, 16, "+")             # the cracked span off the bridge
g.set(19, 17, "%")                       # where it gives way
g.carve(25, 11, 36, 17)                  # east half: the hall at the shaft's east lip
g.carve(37, 14, 37, 14)                  # its east spur (a dead end)
g.carve(31, 8, 32, 10)                   # hall -> the north wing
g.carve(27, 4, 36, 7)                    # the north wing
g.carve(37, 5, 37, 5)                    # its end
g.carve(33, 18, 34, 21)                  # hall -> the south wing
g.carve(27, 22, 36, 27)                  # the south wing (the stair up)
g.carve(36, 28, 36, 28)                  # its south nook
g.faces(2)
f2.stairs_down(5, 26, "mirage-1f", "up")
f2.stairs_down(4, 6, "mirage-1f", "well")
f2.stairs_up(28, 20, "mirage-3f", "arrival")
f2.transitions.append({"x": 19, "y": 17, "targetMap": "mirage-1f", "targetEntrance": "shaft"})
for x, y in [(29, 12), (34, 12), (29, 16), (34, 16)]:
    f2.pillar(x, y)
for x in (8, 11):
    f2.wall([["banner"]], x, 3)
f2.wall([["torch"]], 30, 2)
f2.wall([["torch"]], 9, 20)
f2.npcs += [
    chest("north_spur", "ether", "an Ether", 10, 3),
    chest("north_wing", "diamond_armlet", "a Diamond Armlet", 37, 5),
    chest("south_nook_hammer", "thor_hammer", "a Thor Hammer", 36, 28),
]
f2.write("Mirage Tower 2F: two half-floors joined by a bronze bridge over the open shaft; a cracked span drops to 1F.",
         {"arrival": [4, 26], "well": [6, 6], "up": [28, 22]})

# ════════════════════════════ 3F: the console room ════════════════════════════
f3 = Room("mirage-3f", "Mirage Tower 3F", 28, 24, "3f")
g = f3.g
g.carve(6, 5, 21, 19)                    # the round chamber
g.carve(4, 7, 23, 17)
g.carve(11, 5, 16, 7, "+")               # the console's dais
g.carve(11, 20, 16, 21)                  # the stairwell's bay
g.carve(2, 12, 3, 12)                    # the west alcove (a dead end)
g.carve(24, 12, 25, 12)                  # the east alcove (a dead end)
g.carve(21, 3, 21, 4)                    # the lookout slot (a dead end)
g.faces(2)
f3.stairs_down(13, 20, "mirage-2f", "up")
f3.deco(RING, 13, 9, block=False)
f3.transitions += [{"x": x, "y": y, "targetMap": "sky-castle-1f", "targetEntrance": "arrival", "requiredFlag": OPEN}
                   for y in (9, 10) for x in (13, 14)]
f3.deco([["lectern"]], 14, 5)
for x in (11, 16):
    f3.deco([["globe"]], x, 5)
for x, y in [(7, 8), (20, 8), (7, 15), (20, 15)]:
    f3.pillar(x, y)
for x in (8, 19):
    f3.wall([["torch"]], x, 3)
f3.npcs += [
    chest("west_alcove", "white_robe", "a White Robe", 2, 12),
    chest("east_alcove", "defender", "a Defender", 25, 12),
    {"id": "mirage_console", "sprite": "chest", "tint": "#b48a48", "x": 13, "y": 5, "requiredItem": "cube",
     "cutscene": {"id": "mirage_ascent", "onceFlag": OPEN},
     "dialog": [{"condition": OPEN,
                 "text": ["The dials stand still now, every one of them pointing up. The bronze ring in the floor "
                          "glows; step onto it to rise."]},
                {"condition": "item:cube",
                 "text": ["Something in your pack grows warm and heavy as you near the console: the cube. Its faces "
                          "are cut with the same marks as the socket's rim."]},
                {"text": ["A console of bronze dials, waist-high, every needle lying flat. In its centre is a square "
                          "socket the size of a fist, its rim worn smooth by a hand that is long gone.",
                          "The ring of bronze set into the floor before it is cold and dark."]}]},
]
f3.write("Mirage Tower 3F: the console room; the cube wakes the console, and the ring before it lifts you to the sky.",
         # `ring`: the return point in front of the ring, for a way back down from the sky castle (WND-D2)
         {"arrival": [12, 20], "ring": [13, 11]})
print("mirage-1f, mirage-2f, mirage-3f written")
