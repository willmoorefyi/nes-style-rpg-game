"""The Western Keep (docs/WORLD_PLAN.md 4.2, stage S6; ELF-O), original layouts -> assets-src/maps/western-keep-*.yaml.

  python3 -I assets-src/tools/layouts/elf/keep.py && python3 -I assets-src/tools/build_map.py western-keep-1f western-keep-2f

  western-keep-1f  the courtyard between two wings; a hall of mirrors across the north joins the wings' stair rooms,
                   so 1F is one loop (courtyard, west wing, mirror hall, east wing); two dead-end store passages
  western-keep-2f  the false king's throne room between two galleries, each reached by its own stair from 1F; two
                   thrones, two kings: one is the real false king, the other his reflection

The false king asks for the crown from the Marsh Cave (he is on his throne once the Marsh Cave's guard has fallen).
His cutscene `elf_o_crown_taken` takes it, pays the party off with an Ether and sets ELF_O_CROWN_GIVEN; then Astos
stands in his place, and talking to him starts the fight (astos and his three gargoyle sentinels). His postVictoryCutscene `elf_astos_unmasked` gives the crystal eye (D-W14).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import Room as BaseRoom  # noqa: E402

KITS = ["castle", "interior", "town"]
MATS = {"floor_stone": {"from": "ar_marble", "shade": 0.78}, "in_wall_face": {"from": "castle_wall_in", "shade": 0.8},
        "in_wall_top": {"from": "slate", "shade": 0.42}, "floor": {"from": "floor", "shade": 0.7}}
TRIM = [120, 150, 110]                        # tarnished elven green-gold
LEGEND = "legend: W wall top  F wall face  - flagstone  _ wood floor  + mirror-hall runner  % rubble"
NOTE = ("Concept: an elven border keep taken by a dark elf in the king's shape, whose courtiers half-know it.\n"
        "Distinct: a hall of mirrors that loops the two wings together; twin stairs that each reach their own "
        "gallery; a throne room with two thrones and two kings, one of them a reflection; gargoyle sentinels on "
        "the dais that wake with the false king.\n"
        "Topology: 1F -> 2F (twin stairs from the two wings, so 1F's loop closes through 2F too) -> 2F boss.")
ENCOUNTERS = [{"groups": [{"id": "gargoyle", "min": 1, "max": 2}], "weight": 3},
              {"groups": [{"id": "bloodbones", "min": 1, "max": 2}], "weight": 3},
              {"groups": [{"id": "ghast", "min": 1, "max": 2}, {"id": "bloodbones", "min": 0, "max": 1}], "weight": 2},
              {"groups": [{"id": "ogre_chief", "min": 1}], "weight": 1}]
QUIET = {"encounterRate": {"min": 16, "max": 28}, "encounters": ENCOUNTERS, "battleBackgrounds": {"default": "palace"},
         "no_static_chokepoints": True, "no_unreachable_walkable": True}
EXIT = {"map": "overworld", "entrance": "elf_keep"}
SUSPECT = "ASTOS_DEFEATED"


class Room(BaseRoom):
    def write(self, header: str, entrances: dict, extra: dict | None = None):
        return super().write(header, entrances, kits=KITS, mats=MATS, trim=TRIM, quiet=QUIET, script="elf/keep.py",
                             legend=LEGEND, music="dungeon", extra={"exit": EXIT, **(extra or {})})


def talk(before: list[str], after: list[str], away: list[str] | None = None) -> list[dict]:
    """A courtier's lines: `after` once the false king has fallen; `before` once he sits the throne (the marsh guard
    is down and the crown is on its way); `away` (the default) while the throne is still empty."""
    lines = [{"condition": SUSPECT, "text": after}]
    if away:
        lines += [{"condition": "MARSH_GUARD_DEFEATED", "text": before}, {"text": away}]
    else:
        lines.append({"text": before})
    return lines


def chest(cid: str, item: str, label: str, x: int, y: int) -> dict:
    return {"id": f"chest_{cid}", "sprite": "chest", "x": x, "y": y, "chestItem": item,
            "chestFlag": f"CHEST_ELF_O_{cid.upper()}", "dialog": [f"You found {label}!"]}


# ════════════════════════════ 1F: courtyard, wings, the hall of mirrors ════════════════════════════
f1 = Room("western-keep-1f", "Western Keep 1F", 36, 31)
g = f1.g
g.carve(11, 6, 24, 9, "+")               # the hall of mirrors (north), a runner down its length
g.carve(2, 6, 9, 11)                     # the west stair room
g.carve(26, 6, 33, 11)                   # the east stair room
g.carve(10, 7, 10, 8, "+")               # mirror hall <-> west stair room
g.carve(25, 7, 25, 8, "+")               # mirror hall <-> east stair room
g.carve(2, 14, 9, 23, "_")               # the west wing: the guard hall
g.carve(26, 14, 33, 23)                  # the east wing: the chapel
g.carve(5, 12, 6, 13)                    # west stair room <-> guard hall
g.carve(29, 12, 30, 13)                  # east stair room <-> chapel
g.carve(12, 14, 23, 23)                  # the courtyard
g.carve(10, 18, 11, 19)                  # courtyard <-> guard hall
g.carve(24, 18, 25, 19)                  # courtyard <-> chapel
g.carve(16, 24, 19, 28)                  # the gatehouse passage
g.carve(17, 29, 18, 30)                  # the gate, out to the moor
g.carve(3, 24, 3, 27, "_")               # the west store passage (a dead end)
g.carve(32, 24, 32, 27)                  # the east store passage (a dead end)
for x, y in [(14, 15), (15, 15), (21, 21), (20, 22), (13, 22), (22, 16)]:
    g.set(x, y, "%")                     # the courtyard's broken flags
g.faces(2)
f1.stairs_up(4, 4, "western-keep-2f", "arrival")          # the west wing's stair
f1.stairs_up(30, 4, "western-keep-2f", "arrival_east")    # the east wing's stair
f1.transitions += [{"x": x, "y": 30, "targetMap": "overworld", "targetEntrance": "elf_keep"} for x in (17, 18)]
for x in (12, 15, 18, 21, 24):           # the mirrors: tall panes between banners on the hall's north face
    f1.wall([["arch_window_top"], ["arch_window_bottom"]], x, 4)
for x in (14, 20):
    f1.wall([["banner"]], x, 4)
for x in (13, 23):
    f1.wall([["torch"]], x, 4)
for (x, y) in [(12, 14), (23, 14), (12, 22), (23, 22)]:
    f1.pillar(x, y)
f1.statue(17, 13 + 1)                    # a toppled king's statue faces the gate
f1.deco([["urn"]], 16, 24)
f1.deco([["urn"]], 19, 24)
for x in (2, 9):
    f1.deco([["weapon_rack"]], x, 14)
f1.deco([["table"]], 5, 18)
f1.deco([["armor_stand"]], 8, 21)
f1.wall([["tapestry"]], 28, 12)
f1.deco([["lectern"]], 29, 15)
f1.deco([["plant"]], 26, 14)
f1.deco([["plant"]], 33, 14)
f1.npcs += [
    chest("courier", "phoenix_down", "a Phoenix Down", 3, 27),
    chest("chapel", "ether", "an Ether", 32, 27),
    {"id": "gate_warden", "sprite": "guard", "tint": "#8fb08a", "x": 19, "y": 26,
     "dialog": talk(["The keep is open to the king's subjects. Both wings climb to the throne; take whichever stair "
                     "you like.", "The king has not left his chair since he came back from the fens."],
                    ["I held this gate for a stranger in a borrowed face. I will hold it better for the true heir."],
                    ["The keep is open to the king's subjects. Both wings climb to the throne room; take whichever "
                     "stair you like.", "You will find the chair empty. The king rode to the fens and has not "
                     "come back."])},
    {"id": "courtier_vell", "sprite": "burgher", "tint": "#b7a46a", "x": 15, "y": 19,
     "dialog": talk(["The king rode south-west to the fens and came back laughing at nothing.",
                     "He lost his crown there, he says. He will see no one who comes without it."],
                    ["The man on the throne was never our king. I bowed to him for a season. I won't forget it."],
                    ["The king rode south-west to the fens and has not been seen since.",
                     "They say he lost his crown there. Until it is found, the throne upstairs stays empty."])},
    {"id": "chapel_keeper", "sprite": "villager_f", "x": 27, "y": 20,
     "dialog": talk(["The candles bend toward the stairs at night, as if something up there drinks the air.",
                     "If you go to the Marsh Cave, keep to the boardwalks. The peat burns the careless."],
                    ["The candles burn straight again. Whatever sat upstairs was not of the elves."])},
    {"id": "mirror_steward", "sprite": "old_man", "x": 18, "y": 8,
     "dialog": talk(["Count the kings in the throne room, travellers. Then count their shadows.",
                     "These mirrors were hung to show the old lords their faces. Lately they show other things."],
                    ["The mirrors show only us again. I may even polish them."])},
    {"id": "guard_sorrel", "sprite": "guard", "tint": "#7fa07a", "x": 6, "y": 16,
     "dialog": talk(["We drill for a war the king won't name. He sends no orders, only laughter down the stairs."],
                    ["No more drills. The elves of Elfheim will want word of this keep."],
                    ["We drill for a war nobody has named. The king left no orders when he rode out."])},
]
f1.write("Western Keep 1F: the courtyard between the guard hall and the chapel; the hall of mirrors joins the two "
         "stair rooms.\n" + NOTE,
         {"arrival": [17, 28], "up": [4, 6], "up_east": [30, 6]}, extra={"canSave": False})

# ════════════════════════════ 2F: the galleries and the throne room ════════════════════════════
f2 = Room("western-keep-2f", "Western Keep 2F", 34, 26)
g = f2.g
g.carve(2, 6, 7, 22, "_")                # the west gallery
g.carve(26, 6, 31, 22, "_")              # the east gallery
g.carve(11, 5, 22, 17)                   # the throne room
g.carve(14, 6, 19, 17, "+")              # the royal runner to the dais
g.carve(8, 14, 10, 15)                   # west gallery <-> throne room
g.carve(23, 14, 25, 15)                  # east gallery <-> throne room
g.carve(4, 3, 4, 5, "_")                 # the west gallery's reliquary niche (a dead end)
g.carve(29, 3, 29, 5, "_")               # the east gallery's armoury niche (a dead end)
g.carve(15, 18, 18, 21)                  # the antechamber below the throne room (its south end is a dead end)
g.faces(2)
f2.stairs_down(3, 20, "western-keep-1f", "up")            # back to the west wing
f2.stairs_down(29, 20, "western-keep-1f", "up_east")      # back to the east wing
f2.deco([["throne_0_0", "throne_0_1"], ["throne_1_0", "throne_1_1"]], 13, 5, fit=True)    # the false king's throne
f2.deco([["throne_0_0", "throne_0_1"], ["throne_1_0", "throne_1_1"]], 19, 5, fit=True)    # its mirror image
for x in (12, 21):
    f2.wall([["arch_window_top"], ["arch_window_bottom"]], x, 3)
for x in (16, 17):
    f2.wall([["banner"]], x, 3)
for (x, y) in [(11, 9), (22, 9), (11, 13), (22, 13)]:
    f2.statue(x, y)                      # the gargoyle sentinels' plinths
for (x, y) in [(13, 16), (20, 16)]:
    f2.pillar(x, y)
f2.deco([["gold_heap"]], 7, 6)
f2.deco([["crown_cushion"]], 26, 6)
f2.npcs += [
    chest("reliquary", "gold_armlet", "a Gold Armlet", 4, 3),
    chest("armoury", "hi_potion", "a Hi-Potion", 29, 3),
    # the false king takes the crown (his cutscene `elf_o_crown_taken`, behind the crown, takes it and sets
    # ELF_O_CROWN_GIVEN, which hides him); Astos then stands in his place and talking to him starts the fight. A boss
    # NPC must not be talkable before its stage's needs hold (the verifier's no-skip proof counts a talkable boss as
    # reached), hence two NPCs on one cell; and the take is a cutscene, so the false king stays a quest event even
    # with his crown requirement removed (mutation GT-7).
    {"id": "false_king", "sprite": "king", "x": 14, "y": 7, "showIf": "MARSH_GUARD_DEFEATED", "hideIf": "ELF_O_CROWN_GIVEN",
     "requiredItem": "crown", "cutscene": {"id": "elf_o_crown_taken", "onceFlag": "ELF_O_CROWN_GIVEN"},
     "dialog": [
         {"condition": "item:crown", "text": ["King: My crown! You found it in the fens. Give it here, faithful ones."]},
         {"text": ["King: You come before your king with empty hands?",
                   "My crown was lost in the fens to the south-west, when the marsh swallowed my escort.",
                   "Bring it to me, and the keep will remember you."]}]},
    {"id": "astos", "sprite": "king", "tint": "#9a86c4", "x": 14, "y": 7, "showIf": "ELF_O_CROWN_GIVEN",
     "hideIf": "ASTOS_DEFEATED",
     "dialog": ["The crowned figure's eyes have gone black from lid to lid.",
                "Astos: You brought my crown home. Now kneel, and let me see how loyal subjects die."]},
    {"id": "mirror_king", "sprite": "king", "tint": "#cfd8e8", "x": 20, "y": 7, "hideIf": "ASTOS_DEFEATED",
     "dialog": ["The second king lifts his hand a breath after you lift yours.",
                "It is a pane of old elven glass, set in a throne. There is no one in it."]},
    {"id": "page_ilse", "sprite": "villager_f", "tint": "#c7b28f", "x": 16, "y": 20,
     "dialog": talk(["The king sits on the left throne. The right one only copies him.",
                     "He says the stone sentinels on the plinths are loyal. I think they are listening."],
                    ["The stone sentinels are only stone now. I swept the ash from the dais myself."])},
]
f2.objects.append({"type": "flowers", "x": 17, "y": 21})
f2.write("Western Keep 2F: the throne room between the west and east galleries; the false king waits on the left "
         "throne.\n" + NOTE,
         {"arrival": [3, 19], "arrival_east": [29, 19], "boss": [14, 8]},
         extra={"canSave": False,
                "scriptedEncounters": [{
                    "x": 14, "y": 7, "npc": "astos", "enemyIds": ["astos", "gargoyle", "gargoyle", "gargoyle"],
                    "flag": "ASTOS_DEFEATED", "requiredFlags": ["MARSH_GUARD_DEFEATED", "ELF_O_CROWN_GIVEN"],
                    "isBoss": True, "postVictoryCutscene": "elf_astos_unmasked",
                    "message": "His face runs like wet wax, and the stone sentinels on the plinths stir and spread wings. "
                               "Astos: The crown, and the keep, and now your lives. A fair trade!"}]})
print("western-keep-1f, western-keep-2f written")
