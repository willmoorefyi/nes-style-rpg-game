"""The Temple of the Past, floors 1-3 (docs/WORLD_PLAN.md 4.8, stage S30; PST), original layouts ->
assets-src/maps/past-temple-1.yaml, -2.yaml, -3.yaml.

  python3 -I assets-src/tools/layouts/past/past_upper.py && python3 -I assets-src/tools/build_map.py past-temple-1 past-temple-2 past-temple-3

  past-temple-1  a ring of collapsed cloisters round an open garth: the time gate's stair arrives in a vestibule
                 south of the ring; the west walk has fallen in, leaving two blind stubs; the north walk opens into
                 the chapter house, where the Rime Sovereign waits between twin stairs down (west to floor 2's south
                 arm, east to its sealed east arm); four one-cell carrels hold chests
  past-temple-2  a cross: a square hub with four arms; the south arm (the arrival) is open, the hub's ward keeper
                 lifts the west arm's seal, the west arm's keeper lifts the north arm's; the Ashen Queen holds the
                 north arm before the stair down; the east arm never opens onto the hub and is reached only by floor
                 1's east stair
  past-temple-3  a nave flooded wall to wall: two aisles behind columns and two transepts are the only dry ways; the
                 Drowned Sovereign waits in the apse above the water, with the stair down behind him; chapels off the
                 aisles hold chests
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from past_common import LOWER, UPPER, Room, chest, ward  # noqa: E402

SCRIPT = "past/past_upper.py"

# ════════════════════════════ floor 1: the cloister ring ════════════════════════════
f1 = Room("past-temple-1", "Temple of the Past 1", 40, 40)
g = f1.g
g.carve(13, 3, 26, 8)                            # the chapter house
g.carve(19, 9, 20, 11)                           # its door onto the north walk
g.carve(3, 12, 36, 14)                           # the north walk
g.carve(3, 31, 36, 33)                           # the south walk
g.carve(3, 12, 5, 33)                            # the west walk ...
g.rect(3, 22, 5, 26, "W")                        # ... fallen in: two blind stubs
g.rect(3, 21, 5, 21, "%")
g.rect(3, 27, 5, 27, "%")
g.carve(34, 12, 36, 33)                          # the east walk
g.carve(10, 18, 29, 25)                          # the garth
g.carve(19, 15, 20, 17)                          # the garth's north arch
g.carve(19, 26, 20, 30)                          # and its south arch
g.carve(13, 37, 26, 38)                          # the vestibule (the time gate's stair)
g.carve(13, 34, 14, 36)                          # the vestibule's passage to the south walk
g.carve(1, 17, 2, 17)                            # carrels: west (blind)
g.carve(37, 27, 38, 27)                          # east (blind)
g.carve(9, 9, 9, 11)                             # north, west of the chapter house (blind)
g.carve(31, 9, 31, 11)                           # north, east of it (blind)
g.carve(19, 3, 20, 3, "+")
g.carve(19, 4, 20, 8, "+")                       # the runner to the dais
g.faces(2)
f1.stairs_up(19, 35, "temple-of-fiends", "time_gate")
f1.gated_stairs_down(14, 4, "past-temple-2", "arrival", "PAST_LICH_DEFEATED")
f1.gated_stairs_down(24, 4, "past-temple-2", "east", "PAST_LICH_DEFEATED")
for x in (16, 23):
    f1.deco([["brazier"]], x, 3)
f1.deco([["tpillar_top"], ["tpillar_bottom"]], 13, 18)
f1.deco([["tpillar_top"], ["tpillar_bottom"]], 28, 18)
f1.deco([["tpillar_broken_top"], ["tpillar_broken_bottom"]], 13, 23, collide="alpha")
f1.deco([["fallen_l", "fallen_r"]], 4, 28)
f1.deco([["skulls"]], 4, 20, block=False)
f1.npcs += [
    chest("cloister_west", "hi_potion", "a Hi-Potion", 1, 17),
    chest("cloister_east", "ether", "an Ether", 38, 27),
    chest("cloister_north_west", "phoenix_down", "a Phoenix Down", 9, 9),
    chest("cloister_north_east", "hi_potion", "a Hi-Potion", 31, 9),
]
lich = f1.boss({"id": "past_lich", "sprite": "old_man", "tint": "#9fc4e0", "x": 19, "y": 5,
                "dialog": ["A frost-rimed figure sits in the chapter house's high seat, his breath hanging in the "
                           "air like smoke from a snuffed candle.",
                           "Rime Sovereign: I remember you. You broke my seal under Melmond. Here the seal was never "
                           "set, and the cold has had longer to grow."]},
               ["lich_2", "death_knight", "death_knight"], "PAST_LICH_DEFEATED", "pst_lich_falls",
               "The high seat cracks in two as he stands. Two knights in black plate step out of the walls to "
               "flank him.")
f1.write("Temple of the Past 1: a ring of collapsed cloisters; the Rime Sovereign holds the chapter house.",
         {"arrival": [19, 37], "down": [15, 6], "down_east": [24, 6], "boss": [19, 7]}, table=UPPER, script=SCRIPT,
         extra={"scriptedEncounters": [lich]})

# ════════════════════════════ floor 2: the sealed cross ════════════════════════════
f2 = Room("past-temple-2", "Temple of the Past 2", 44, 44)
g = f2.g
g.carve(17, 17, 26, 26)                          # the hub
g.carve(19, 3, 24, 13)                           # the north arm
g.carve(21, 14, 22, 16)                          # ... its neck (sealed: PST_WARD_WEST)
g.carve(19, 30, 24, 35)                          # the south arm
g.carve(21, 27, 22, 29)                          # ... its neck (open)
g.carve(15, 36, 28, 39)                          # the south vestibule (from floor 1's west stair)
g.carve(3, 19, 13, 24)                           # the west arm
g.carve(14, 21, 16, 22)                          # ... its neck (sealed: PST_WARD_HUB)
g.carve(30, 19, 37, 24)                          # the east arm, never joined to the hub
g.carve(38, 17, 41, 26)                          # ... its vestibule (from floor 1's east stair)
g.carve(3, 25, 3, 28)                            # spurs: the west arm's (blind)
g.carve(33, 25, 33, 28)                          # the east arm's (blind)
g.carve(28, 38, 30, 38)                          # the south vestibule's (blind)
g.carve(21, 18, 22, 25, "+")                     # the hub's runner
g.faces(2)
f2.stairs_up(16, 34, "past-temple-1", "down")
f2.stairs_up(39, 15, "past-temple-1", "down_east")
f2.gated_stairs_down(21, 3, "past-temple-3", "arrival", "PAST_ASHEN_DEFEATED")
GATES2 = [
    *[{"x": 16, "y": y, "requiredFlags": ["PST_WARD_HUB"], "permanent": False,
       "message": "A ward of pale light fills the west arm's door. It hums when you come near."} for y in (21, 22)],
    *[{"x": x, "y": 15, "requiredFlags": ["PST_WARD_WEST"], "permanent": False,
       "message": "A ward of pale light fills the north arm's door. Heat beats against it from the far side."}
      for x in (21, 22)],
]
for x, y in [(17, 17), (26, 17), (17, 26), (26, 26)]:
    f2.deco([["brazier"]], x, y)
f2.deco([["fiend_statue_top"], ["fiend_statue_bottom"]], 19, 3)
f2.deco([["fiend_statue_top"], ["fiend_statue_bottom"]], 24, 3)
f2.npcs += [
    ward("hub", 24, 21, "PST_WARD_HUB", "pst_ward_hub",
         ["A stone acolyte stands in the hub with its palms flat against each other. Its lips are worn away.",
          "The acolyte's hands have parted. Its gaze rests on the west arm."]),
    ward("west", 4, 21, "PST_WARD_WEST", "pst_ward_west",
         ["A second acolyte kneels at the end of the west arm, its forehead to the floor.",
          "The kneeling acolyte has lifted its head toward the north arm."]),
    chest("cross_west", "soft", "a Soft", 3, 28),
    chest("cross_east", "hi_potion", "a Hi-Potion", 33, 28),
    chest("cross_east_vestibule", "ether", "an Ether", 41, 26),
    chest("cross_south", "phoenix_down", "a Phoenix Down", 30, 38),
]
queen = f2.boss({"id": "past_ashen_queen", "sprite": "princess", "tint": "#c4663f", "x": 21, "y": 8,
                 "dialog": ["A priestess in a robe of live coals waits at the head of the north arm. The stone "
                            "under her bare feet glows.",
                            "Ashen Queen: The fire you gave back to the mountain was mine. In this house it never "
                            "left me. Come and warm yourselves."]},
                ["ashen_queen_2", "rhyos"], "PAST_ASHEN_DEFEATED", "pst_ashen_falls",
                "Six arms unfold from her robe, and a horned lizard crawls out of the glowing stone beside her.")
f2.write("Temple of the Past 2: a cross of four sealed arms; ward keepers open the west and north arms in turn.",
         {"arrival": [16, 36], "east": [39, 17], "down": [23, 4], "boss": [21, 10]}, table=UPPER, script=SCRIPT,
         reach_roots=["east"],
         extra={"scriptedEncounters": [queen], "keyItemGates": GATES2})

# ════════════════════════════ floor 3: the flooded nave ════════════════════════════
f3 = Room("past-temple-3", "Temple of the Past 3", 32, 46)
g = f3.g
g.carve(9, 3, 22, 8)                             # the apse
g.carve(4, 9, 27, 38)                            # the nave and its aisles ...
g.rect(8, 10, 23, 38, "≈")                       # ... flooded between the column rows
for y in range(10, 39, 3):
    g.set(8, y, "W")                             # the columns
    g.set(23, y, "W")
for y in (20, 21, 31, 32):
    g.rect(4, y, 27, y, "-")                     # the two transepts, the only dry crossings
g.rect(9, 9, 22, 9, "-")                         # the apse's lip above the water
g.carve(4, 41, 27, 43)                           # the narthex (from floor 2)
g.carve(5, 39, 6, 40)                            # its doors to the aisles
g.carve(25, 39, 26, 40)
g.carve(1, 15, 3, 15)                            # chapels off the aisles (blind)
g.carve(28, 27, 30, 27)
g.carve(1, 35, 3, 35)
g.carve(15, 4, 16, 8, "+")
g.faces(2)
f3.stairs_up(15, 39, "past-temple-2", "down")
f3.gated_stairs_down(19, 3, "past-temple-4", "arrival", "PAST_DROWNED_DEFEATED")
for x in (10, 21):
    f3.deco([["tpillar_top"], ["tpillar_bottom"]], x, 3)
f3.npcs += [
    chest("nave_chapel_north", "dragon_armor", "Dragon Armor", 1, 15),
    chest("nave_chapel_east", "ether", "an Ether", 30, 27),
    chest("nave_chapel_south", "hi_potion", "a Hi-Potion", 1, 35),
]
sovereign = f3.boss({"id": "past_drowned_sovereign", "sprite": "king", "tint": "#4f8f9a", "x": 15, "y": 6,
                     "dialog": ["A king in sodden robes stands in the apse, water running from his sleeves into the "
                                "flood without a sound.",
                                "Drowned Sovereign: My shrine sank, and this nave sank with it, a hundred lifetimes "
                                "before your birth. Here the tide still comes in. Wade out to me."]},
                    ["drowned_sovereign_2"], "PAST_DROWNED_DEFEATED", "pst_drowned_falls",
                    "The flood behind him rises in a wall, and his robes tear open on a body of coils.")
f3.write("Temple of the Past 3: a nave flooded wall to wall; the Drowned Sovereign waits in the apse.",
         {"arrival": [15, 41], "down": [18, 4], "boss": [15, 8]}, table=LOWER, script=SCRIPT,
         extra={"scriptedEncounters": [sovereign]})
print("past-temple-1, past-temple-2, past-temple-3 written")
