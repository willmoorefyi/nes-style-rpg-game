"""Bahamut's cave and lair (docs/WORLD_PLAN.md 4.5, stage S19, optional; ORD-O), original layouts
-> assets-src/maps/bahamut-cave.yaml, bahamut-lair.yaml.

  python3 -I assets-src/tools/layouts/ordeal/bahamut.py && python3 -I assets-src/tools/build_map.py bahamut-cave bahamut-lair

  bahamut-cave  a short throat of rock from the horseshoe isle's cave mouth, past a side grotto where the tide comes
                in under the island, up to the stair down into the lair; two blind spurs
  bahamut-lair  the dragons' hall below the isle: an antechamber at the stair, the hall with six dragons in borrowed
                shapes, and Bahamut on the dais; given the ordeal seal (cutscene `ord_bahamut_trial`, which takes it
                and sets CLASS_UPGRADED) he names the party anew: `action: classUpgrade` on CLASS_UPGRADED
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import Room as BaseRoom  # noqa: E402

KITS = ["castle", "interior", "temple", "town"]
MATS = {"floor_stone": {"from": "temple_rubble", "shade": 0.85, "hue": 12, "sat": 0.8},
        "rubble": {"from": "temple_rubble", "shade": 0.7, "hue": 12},
        "in_wall_face": {"from": "temple_wall_face", "shade": 0.7, "hue": 18, "sat": 0.7},
        "in_wall_top": {"from": "slate", "shade": 0.3}}
TRIM = [200, 160, 70]                         # the dais's tarnished gold
LEGEND = "legend: W wall top  F wall face  - cave floor  % loose stone  ~ tide pool  + the dais's cloth"
NOTE_CAVE = ("Concept: the throat of a sea cave on a horseshoe isle, worn smooth by the dragons coming and going.\n"
             "Distinct: a tide grotto where the sea comes in under the island, its pool in the middle of the floor; "
             "two blind spurs where young dragons once slept, one strewn with the bones of their meals.\n"
             "Topology: one floor, the mouth -> the grotto (side branch) -> the stair down to the lair; no boss.")
NOTE_LAIR = ("Concept: a dragons' hall where the old wyrms receive visitors in the shapes of men, and the eldest judges "
             "who may be given a new name.\n"
             "Distinct: six dragons in borrowed human shapes, each with its own temper; a gold-cloth dais "
             "where the seal is laid before Bahamut; hoard heaps that nobody guards.\n"
             "Topology: one floor, the stair up -> the antechamber -> the hall -> the dais; no boss.")
CAVE_FIGHTS = [{"groups": [{"id": "wyrm", "min": 1}], "weight": 2},
               {"groups": [{"id": "basilisk", "min": 1, "max": 2}], "weight": 3},
               {"groups": [{"id": "wyvern", "min": 1, "max": 2}], "weight": 2}]
EXIT = {"map": "overworld", "entrance": "ord_bahamut"}
DONE = "CLASS_UPGRADED"


class Room(BaseRoom):
    def write(self, header: str, entrances: dict, quiet: dict, extra: dict | None = None):
        return super().write(header, entrances, kits=KITS, mats=MATS, trim=TRIM, quiet=quiet, script="ordeal/bahamut.py",
                             legend=LEGEND, music="dungeon", extra={"exit": EXIT, **(extra or {})})


def dragon(did: str, sprite: str, tint: str, x: int, y: int, before: list[str], after: list[str]) -> dict:
    return {"id": did, "sprite": sprite, "tint": tint, "x": x, "y": y,
            "dialog": [{"condition": DONE, "text": after}, {"text": before}]}


# ════════════════════════════ the cave ════════════════════════════
cave = Room("bahamut-cave", "Bahamut's Cave", 28, 26)
g = cave.g
g.line([(12, 22), (8, 18), (9, 13), (14, 9), (19, 6)], "-", 2)        # the throat, winding up from the mouth
g.carve(12, 22, 13, 25)                                                # the mouth
g.carve(16, 3, 23, 7)                                                  # the stair chamber
g.line([(10, 14), (17, 15)], "-", 2)                                   # the passage into the grotto
g.carve(17, 12, 24, 18)                                                # the tide grotto
g.rect(19, 14, 22, 16, "~")                                            # its pool
g.carve(4, 17, 7, 18)                                                  # the west spur (a dead end)
g.carve(4, 12, 4, 16)
g.carve(24, 6, 26, 6)                                                  # the north-east spur (a dead end)
for x, y in [(9, 16), (13, 10), (18, 13), (23, 17), (12, 20)]:
    g.set(x, y, "%")
g.faces(2)
cave.transitions += [{"x": x, "y": 25, "targetMap": "overworld", "targetEntrance": "ord_bahamut"} for x in (12, 13)]
cave.stairs_down(20, 4, "bahamut-lair", "arrival")
cave.deco([["skulls"]], 6, 17)
cave.deco([["vines"]], 24, 12)
cave.npcs += [{"id": "chest_grotto", "sprite": "chest", "x": 24, "y": 18, "chestItem": "diamond_armlet",
               "chestFlag": "CHEST_ORD_O_GROTTO", "dialog": ["You found a Diamond Armlet!"]}]
cave.write("Bahamut's Cave: the throat from the horseshoe isle's mouth, the tide grotto, the stair down.\n" + NOTE_CAVE,
           {"arrival": [12, 24], "down": [19, 4]},
           {"encounterRate": {"min": 24, "max": 36}, "encounters": CAVE_FIGHTS,
            "battleBackgrounds": {"default": "cave"}, "no_static_chokepoints": True, "no_unreachable_walkable": True})

# ════════════════════════════ the lair ════════════════════════════
lair = Room("bahamut-lair", "Bahamut's Lair", 32, 22)
g = lair.g
g.carve(2, 6, 7, 17)                     # the antechamber at the stair
g.carve(8, 12, 9, 13)                    # antechamber <-> hall
g.carve(10, 5, 29, 18)                   # the hall
g.carve(15, 5, 24, 9, "+")               # the dais
g.carve(3, 18, 3, 19)                    # the antechamber's niche
g.faces(2)
lair.stairs_up(3, 4, "bahamut-cave", "down")
lair.deco([["gold_heap"]], 11, 6)
lair.deco([["gold_heap"]], 28, 6)
lair.deco([["crown_cushion"]], 12, 17)
for x in (14, 25):
    lair.pillar(x, 6)
for x in (11, 28):
    lair.deco([["brazier"]], x, 10)
lair.npcs += [
    {"id": "bahamut", "sprite": "garland_npc", "tint": "#d8b450", "x": 19, "y": 6, "hideIf": DONE,
     "requiredItem": "ordeal_seal", "cutscene": {"id": "ord_bahamut_trial", "onceFlag": DONE},
     "action": "classUpgrade", "actionFlag": DONE,
     "dialog": [{"condition": "item:ordeal_seal",
                 "text": ["Bahamut: That seal is cut from the citadel's own door. You climbed it, then. Lay it here."]},
                {"text": ["Bahamut: Little ones, in my hall, and empty-handed.",
                          "Bahamut: On the plateau to the west stands a citadel that tests whoever climbs it. "
                          "Bring me its seal and I will name you as you deserve."]}]},
    {"id": "bahamut_after", "sprite": "garland_npc", "tint": "#d8b450", "x": 19, "y": 6, "showIf": DONE,
     "dialog": ["Bahamut: Your new names fit you. Wear them where the light has gone out of the world."]},
    dragon("dragon_ember", "knight", "#c86a4a", 12, 8,
           ["I am wearing a man's shape for your sake. Do not stare; the scales show at the wrists."],
           ["Even in this shape I can smell the change on you. You burn hotter now."]),
    dragon("dragon_tide", "mage", "#4a8ec8", 27, 8,
           ["We came here when the sea still remembered the sky. Bahamut came first."],
           ["The tide will carry the news of you to every shore. That is how dragons gossip."]),
    dragon("dragon_moss", "old_man", "#7aa05a", 12, 15,
           ["The citadel was built by people who wanted proof of courage they could hold in a hand. Bahamut humours them."],
           ["You held it, and you let it go. That is the part the builders never understood."]),
    dragon("dragon_ash", "monk", "#8a8a8a", 27, 15,
           ["I sleep on the gold. Not for greed. It is warm, and it does not argue."],
           ["Do not touch the gold. Now that you are named, I would have to argue."]),
    dragon("dragon_frost", "white_mage", "#b8d8e8", 16, 17,
           ["The guardian in the citadel was one of us once. It forgot when to stop guarding."],
           ["If you brought down the old guardian, then it can rest. Thank you for that."]),
    dragon("dragon_storm", "black_mage", "#6a5aa0", 23, 17,
           ["Hatchlings dream of flying through the clouds above the plateau. The old ones dream of quiet."],
           ["Go well. When the four lights are lit again, come and tell us how the sky looks."]),
]
lair.write("Bahamut's Lair: the antechamber, the hall of the six dragons, Bahamut's dais.\n" + NOTE_LAIR,
           {"arrival": [3, 6]},
           {"encounterRate": {"min": 999, "max": 999}, "encounters": [], "battleBackgrounds": {"default": "cave"},
            "no_static_chokepoints": True, "no_unreachable_walkable": True})
print("bahamut-cave, bahamut-lair written")
