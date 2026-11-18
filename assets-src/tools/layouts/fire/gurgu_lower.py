"""Gurgu Volcano B3 to B5 (docs/WORLD_PLAN.md 4.4, stage S15; FIR-D1), original layouts -> assets-src/maps/gurgu-b3.yaml,
gurgu-b4.yaml, gurgu-b5.yaml.

  python3 -I assets-src/tools/layouts/fire/gurgu_lower.py && python3 -I assets-src/tools/build_map.py gurgu-b3 gurgu-b4 gurgu-b5

  gurgu-b3  the lower lava gallery, running north to south under B2's: three reaches, each half stone and half lava;
            two side cuts behind the lava hold chests; in the west, walled off from the gallery, the cult's forge
            (hearth, racks, an anvil altar), reached only by B2's west stair: a dead end with treasure
  gurgu-b4  the basalt maze: from the north-west landing a field of open lava, broken by basalt pillars, runs
            straight to the south-east stair (the short way, every step a burn); the dry way is a corridor round the
            north and down the east side that doubles back once (at most 1.5x the short way, WORLD 4.0.2)
  gurgu-b5  the queen's ash court (`canSave: false`): the stair arrives in the north, an ash runner leads due south
            between four lava pools to the Ashen Queen before the crystal's altar; her fall (`fir_ashen_falls`)
            relights the fire crystal (FIRE_CRYSTAL_LIT); two corner alcoves hold chests
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gurgu_common import LOWER, WON, Room, chest  # noqa: E402

SCRIPT = "fire/gurgu_lower.py"

# ════════════════════════════ B3: the lower lava gallery and the forge ════════════════════════════
b3 = Room("gurgu-b3", "Gurgu Volcano B3", 34, 46)
g = b3.g
g.carve(14, 4, 19, 8)                            # the north landing (from B2's east stair)
g.carve(12, 9, 20, 17)                           # the first reach
g.carve(16, 17, 25, 27)                          # the second reach, east of it
g.rect(22, 18, 25, 26, "%")                      # ... its east half lava
g.carve(9, 27, 18, 37)                           # the third reach, back west
g.rect(9, 28, 11, 36, "%")                       # ... its west edge lava
g.carve(14, 38, 15, 41)                          # the stair down to B4
g.carve(26, 21, 30, 21)                          # the east cut, behind the lava (blind)
g.carve(4, 33, 8, 33)                            # the west cut, behind the lava (blind)
g.carve(21, 11, 26, 11)                          # a dry cut off the first reach (blind)
g.carve(2, 14, 9, 22)                            # the forge, walled off from the gallery
g.carve(2, 23, 2, 25)                            # the forge's quench pit passage (blind)
g.faces(2)
b3.stairs_up(16, 2, "gurgu-b2", "down")
b3.stairs_up(4, 12, "gurgu-b2", "forge")
b3.stairs_down(14, 40, "gurgu-b4", "arrival")
b3.deco([["fireplace_0_0", "fireplace_0_1"], ["fireplace_1_0", "fireplace_1_1"]], 7, 12, on_wall=True)
b3.wall([["weapon_rack"]], 2, 13)
b3.deco([["armor_stand"]], 9, 15)
b3.deco([["altar_l", "altar_r"]], 5, 18)         # the anvil
b3.deco([["brazier"]], 13, 10)
b3.deco([["brazier"]], 17, 28)
b3.npcs += [
    chest("forge_anvil", "sun_blade", "a Sun Blade", 8, 21),
    chest("forge_pit", "opal_armlet", "an Opal Armlet", 2, 25),
    chest("gallery_east", "hi_potion", "a Hi-Potion", 30, 21),
    chest("gallery_west", "phoenix_down", "a Phoenix Down", 4, 33),
]
b3.write("Gurgu Volcano B3: the lower lava gallery, north to south; the sealed forge lies west of it.",
         {"arrival": [16, 5], "down": [14, 39], "forge": [4, 15]}, table=LOWER, bg="magma_temple", script=SCRIPT,
         # the forge is reached only by B2's west stair: a reach root, and no chokepoint check (it floods from the
         # arrival alone; fir_d1_sites.test.ts walks both parts round the static NPCs instead)
         extra={"no_unreachable_walkable": {"reach_roots": ["forge"]}, "no_static_chokepoints": False})

# ════════════════════════════ B4: the basalt maze ════════════════════════════
b4 = Room("gurgu-b4", "Gurgu Volcano B4", 40, 36)
g = b4.g
g.carve(2, 4, 7, 8)                              # the north-west landing (from B3)
g.carve(2, 9, 2, 12)                             # the landing's blind alcove
g.carve(8, 6, 37, 7)                             # the dry way: the north corridor ...
g.carve(36, 8, 37, 12)                           # ... down the east side ...
g.carve(28, 12, 37, 13)                          # ... doubling back west ...
g.carve(28, 14, 29, 19)
g.carve(28, 18, 37, 19)                          # ... and east again ...
g.carve(36, 20, 37, 27)                          # ... down to the stair hall
g.carve(20, 2, 20, 5)                            # a blind cut north of the corridor
g.carve(33, 14, 33, 16)                          # a blind cut in the doubling
g.carve(30, 27, 37, 32)                          # the stair hall
g.carve(9, 10, 26, 28, "%")                      # the lava field (the short way)
for x, y in [(12, 13), (18, 11), (23, 14), (14, 19), (20, 18), (11, 24), (24, 21), (17, 25), (21, 26)]:
    g.rect(x, y, x + 1, y + 1, "W")              # basalt pillars
g.carve(6, 9, 8, 10)                             # the stone ramp from the landing onto the field
g.carve(27, 27, 29, 28)                          # the stone lip from the field into the stair hall
g.faces(2)
b4.stairs_up(3, 2, "gurgu-b3", "down")
b4.stairs_down(34, 31, "gurgu-b5", "arrival")
b4.deco([["brazier"]], 31, 28)
b4.npcs += [
    chest("maze_north", "ether", "an Ether", 20, 2),
    chest("maze_doubling", "cabin", "a Cabin", 33, 16),
    chest("maze_alcove", "hi_potion", "a Hi-Potion", 2, 12),
    chest("lava_field", "opal_helm", "an Opal Helm", 17, 20),
]
b4.write("Gurgu Volcano B4: the basalt maze; the short way wades the lava field, the dry way winds round it.",
         {"arrival": [3, 5], "down": [34, 30]}, table=LOWER, bg="magma_temple", script=SCRIPT)

# ════════════════════════════ B5: the queen's ash court ════════════════════════════
b5 = Room("gurgu-b5", "Gurgu Volcano B5", 30, 32)
g = b5.g
g.carve(12, 4, 17, 7)                            # the stair landing (from B4)
g.carve(13, 8, 16, 11)                           # the approach
g.carve(4, 12, 25, 27)                           # the ash court
g.carve(14, 12, 15, 21, "+")                     # the ash runner, due south to the queen
for x0, y0, x1, y1 in [(5, 14, 8, 18), (21, 14, 24, 18), (5, 22, 7, 26), (22, 22, 24, 26)]:
    g.rect(x0, y0, x1, y1, "%")                  # four lava pools
g.carve(1, 25, 3, 25)                            # the west alcove (blind)
g.carve(26, 25, 28, 25)                          # the east alcove (blind)
g.faces(2)
b5.stairs_up(14, 2, "gurgu-b4", "down")
b5.deco([["altar_l", "altar_r"]], 14, 25)        # the fire crystal's altar
for x in (11, 18):
    b5.deco([["brazier"]], x, 24)
for x in (9, 20):
    b5.pillar(x, 12)
b5.npcs += [
    chest("court_west", "opal_armor", "Opal Armor", 1, 25),
    chest("court_east", "hi_potion", "a Hi-Potion", 28, 25),
    {"id": "ashen_queen", "sprite": "princess", "tint": "#b8573a", "x": 14, "y": 22, "hideIf": WON,
     "dialog": ["A woman in a scorched sun-priest's robe kneels before the altar, her back to you. Ash settles on her "
                "shoulders and does not melt.",
                "Ashen Queen: They built this house to keep the fire. I am the fire now. Come closer and be kept."]},
]
b5.write("Gurgu Volcano B5: the queen's ash court; she waits due south of the stair, before the crystal's altar.",
         {"arrival": [14, 5], "boss": [14, 20]}, table=LOWER, bg="throne_kary", script=SCRIPT,
         extra={"canSave": False,
                "inspect": [{"x": 14, "y": 25, "text": [
                    {"condition": WON, "text": ["The crystal on the altar burns clear and steady, a small sun that "
                                                "gives light without smoke."]},
                    {"text": ["A crystal sits on the altar, dull as a coal gone cold. Something has been drinking "
                              "its fire."]}]}],
                "scriptedEncounters": [{
                    "x": 14, "y": 22, "npc": "ashen_queen", "enemyIds": ["ashen_queen", "fire_lizard"], "flag": WON,
                    "isBoss": True, "postVictoryCutscene": "fir_ashen_falls",
                    "message": "She rises, and keeps rising: six arms unfold from the robe, a serpent's coil pours "
                               "out beneath it, and a salamander crawls from the altar's coals to her side."}]})
print("gurgu-b3, gurgu-b4, gurgu-b5 written")
