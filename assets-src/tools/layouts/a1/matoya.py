"""Matoya's cave (docs/WORLD_PLAN.md 4.1, S3 and S7; A1-O): one floor inside the hillock of the north-west grove.

  python3 -I assets-src/tools/layouts/a1/matoya.py && python3 -I assets-src/tools/build_map.py matoya-cave

Matoya needs `crystal_eye`: talking to her while it is held plays `a1_matoya_sight` (it takes the eye, gives the
herb and sets A1_O_HERB_GIVEN). Her lines differ before, while the eye is held (`item:crystal_eye`) and after. Three
enchanted brooms wander the floor and change their tune once she sees again.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(1, str(Path(__file__).resolve().parents[2]))
from common import Room  # noqa: E402
from kit import remap  # noqa: E402

KITS = ["interior", "town", "castle", "temple"]
# earthen walls and a packed-earth floor: the temple stone recoloured brown (kit.REMAPS "cave", as the dwarf hall)
MATS = {"floor_stone": {"from": "ar_cave"}, "in_wall_top": remap("cave", "temple_wall_top"),
        "in_wall_face": remap("cave", "temple_wall_face")}
QUIET = {"encounterRate": {"min": 999, "max": 999}, "encounters": []}
LEGEND = "legend: W wall top  F wall face  - stone / earth floor  + carpet"
NOTE = """Concept: a witch's burrow scooped out of a mossy hillock: one lopsided chamber round a hearth, jars to the roof, a bed in a bay.
Distinct: a lit hearth between two torches as the room's heart, with a nook dug in under its wall; a sleeping bay off the east side with her bed; a lopsided, stepped chamber with two side bays instead of a square room
Topology: one floor; the door passage opens into the chamber, a north nook, a west bay and an east sleeping bay"""
SEEN = "A1_O_HERB_GIVEN"
EYE = "item:crystal_eye"
W, H = 18, 14
DOOR_X = 8


def matoya_lines() -> list[dict]:
    return [
        {"condition": SEEN, "text": [
            "Matoya: I can count the cobwebs again, and I don't care for the number.",
            "The prince of the elves sleeps under a curse in his own castle, south across the water. That herb will wake him.",
            "Off with you! And if you pass a well-mannered broom on your travels, send it my way."]},
        {"condition": EYE, "text": [
            "Matoya: Wait. Wait! Something in your pack is humming at me. I know that hum.",
            "That's mine. That is MY eye. Where did you... no, never mind where. Hand it over."]},
        {"text": [
            "Matoya: Who's there? Speak up, I'm half blind... no, wholly blind, since that thief took my eye.",
            "A crystal, round as a plum. I see through it, you understand, not with it. Without it I'm a mole in a bonnet.",
            "The thief wore a crown and talked like a king. Kings! Find it, and I'll make it worth your while."]},
    ]


def broom(n: int, x: int, y: int, before: str, after: str) -> dict:
    return {"id": f"broom_{n}", "sprite": "black_wizard", "tint": "#a07a48", "x": x, "y": y, "wander": True,
            "dialog": [{"condition": SEEN, "text": [after]}, {"text": [before]}]}


def build() -> Path:
    r = Room("matoya-cave", "Matoya's Cave", W, H)
    g = r.g
    g.carve(3, 4, 14, 10, "-")                     # the chamber
    g.carve(6, 3, 11, 3, "-")                      # the north nook under the hearth wall
    g.carve(2, 6, 2, 9, "-")                       # the west bay
    g.carve(15, 5, 16, 8, "-")                     # the sleeping bay
    g.carve(7, 7, 10, 8, "+")                      # a hearth rug
    g.carve(DOOR_X, 11, DOOR_X + 1, 12, "-")       # the door passage
    g.carve(DOOR_X, H - 1, DOOR_X, H - 1, "-")     # the crack in the hill
    g.faces(2)
    r.deco([["fireplace_0_0", "fireplace_0_1"], ["fireplace_1_0", "fireplace_1_1"]], 8, 1, on_wall=True)
    for x in (4, 13):
        r.wall([["potion_shelf"]], x, 2)
    r.wall([["torch"]], 6, 1)
    r.wall([["torch"]], 11, 1)
    r.tall("bookshelf", 3, 4)
    r.tall("bookshelf", 14, 4)
    r.tall("bed", 16, 5)
    r.deco([["table"]], 11, 5)
    r.deco([["orb_white"]], 6, 3)
    for x, y in ((12, 4), (2, 9), (3, 10), (16, 8)):
        r.deco([["plant"]], x, y)
    for x, y in ((14, 10), (13, 10), (4, 10)):
        r.objects.append({"type": "barrel" if x != 13 else "crate", "x": x, "y": y})
    r.npcs.append({"id": "matoya", "sprite": "vendor_f", "tint": "#b59ad6", "x": 9, "y": 5, "dialog": matoya_lines(),
                   "requiredItem": "crystal_eye", "cutscene": {"id": "a1_matoya_sight", "onceFlag": SEEN}})
    r.npcs += [
        broom(1, 5, 8, "The broom sweeps a circle round your feet, then sweeps the circle again, a little smaller.",
              "The broom stands to attention. Somewhere in its bristles, it is very pleased."),
        broom(2, 12, 9, "Swish. Swish. The broom knocks against a jar labelled EYE OF NEWT (NOT THAT EYE).",
              "Swish! The broom has found the dust under the bed at last, and it is thorough about it."),
        broom(3, 15, 7, "The broom leans close, as if to whisper. The mistress hasn't seen a thing in weeks, it seems to say.",
              "The broom is dancing. There is no other word for it."),
    ]
    r.transitions.append({"x": DOOR_X, "y": H - 1, "targetMap": "overworld", "targetEntrance": "a1_matoya"})
    return r.write(f"Matoya's cave (WORLD_PLAN 4.1).\n{NOTE}", {"arrival": [DOOR_X, H - 2]}, kits=KITS,
                   mats=MATS, trim=[120, 80, 150], quiet=QUIET,
                   script="a1/matoya.py", legend=LEGEND, music="town",
                   extra={"exit": {"map": "overworld", "entrance": "a1_matoya"}, "no_static_chokepoints": True,
                          "no_unreachable_walkable": True})


if __name__ == "__main__":
    print(build())
