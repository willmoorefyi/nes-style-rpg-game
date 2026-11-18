"""Gaia's six homes (docs/WORLD_PLAN.md 4.0.1, 4.7; WND-T): the windmiller's, the ropemaker's long house, the
spinner's, the healer's house (the clinic, GAP-16, 120 G per level), the beekeeper's and the shepherd's ->
assets-src/maps/gaia-house-*.yaml. Written by `town_gaia_interiors.py`.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parent))
from interiors_common import SLATE_TOP, STONE_FACE, Town, wood  # noqa: E402
from town_gaia_people import BOTTLE, FREED, when  # noqa: E402

GAIA = Town("gaia", script="wind/town_gaia_interiors.py")
HIGH = {"floor_stone": {"from": "floor_stone", "sat": 0.55, "shade": 0.9}}    # the grey mountain flagstones


def note(concept: str, distinct: str, topology: str = "one room; the door is the only way in or out") -> str:
    return f"Concept: {concept}\nDistinct: {distinct}\nTopology: {topology}"


def chest(r, key: str, item: str, label: str, x: int, y: int) -> None:
    r.npcs.append({"id": f"wnd_t_chest_{key}", "sprite": "chest", "x": x, "y": y, "chestItem": item,
                   "chestFlag": f"CHEST_WND_T_{key.upper()}", "dialog": [f"You found {label}!"]})


def windmiller(out: list[Path]) -> None:
    """The windmiller's house: a long room of grain sacks (crates) and a wind chart on the table, a bed alcove."""
    r = GAIA.house("windmiller", "Windmiller's House", 12, 9, [4])
    g = r.g
    g.carve(1, 3, 10, 7, "_")
    g.carve(8, 2, 10, 2, "_")                         # the bed alcove under the eaves
    r.open_exit()
    g.faces(1)
    r.tall("bed", 9, 2)
    r.fireplace(2, 1)
    r.wall([["window_in"]], 5, 2)
    r.wall([["window_in"]], 7, 2)
    r.deco([["map_table_l", "map_table_r"]], 4, 4)    # the wind chart
    for (x, y) in [(1, 6), (1, 7), (2, 7), (10, 6), (10, 7)]:
        r.thing("crate", x, y)
    r.thing("barrel", 6, 7)
    chest(r, "windmiller", "ether", "an Ether", 8, 7)
    r.npc("gaia_windmiller", "farmer", 6, 4, when(
        (FREED, ["Hear the sails? Every one of them pulling! Bring me all the grain in the bowl; I'll grind it by "
                 "nightfall."]),
        default=["Brann, the windmiller. That chart on the table is every gust that came over the bowl for thirty "
                 "years.", "The last line on it is a year old. I keep the pen in the ink, just in case."]))
    r.npc("gaia_windmiller_wife", "villager_f", 3, 6, when(
        (FREED, ["He's out on the sails like a boy. I'll have to go and fetch him in for supper."]),
        default=["We grind by hand now, a cupful at a time. Brann can't bear to watch, so I do it."]))
    out.append(r.save(note("a windmiller's long room: crates of grain stacked at both ends, a wind chart on the table",
                           "thirty years of gusts charted on a map table in the middle of the room; a bed tucked in "
                           "an alcove under the eaves at the back"),
                      {"floor": wood(0.8), "in_wall_face": {"from": "in_wall_face", "shade": 0.85}}, [130, 80, 50]))


def ropemaker(out: list[Path]) -> None:
    """The ropemaker's long house: the rope walk down the whole length of the room, coils (barrels) at the far end."""
    r = GAIA.house("ropemaker", "Ropemaker's House", 15, 8, [2])
    g = r.g
    g.carve(1, 3, 13, 6, "-")
    g.carve(1, 5, 13, 5, "_")                         # the rope walk: a plank run down the room
    g.carve(11, 2, 13, 2, "-")
    r.open_exit("-")
    g.faces(1)
    for x in (11, 12, 13):
        r.thing("barrel", x, 2)                       # finished coils
    r.thing("crate", 13, 6)
    r.wall([["window_in"]], 4, 2)
    r.wall([["window_in"]], 8, 2)
    r.one("table", 6, 3)
    r.one("stone_bench", 1, 3)
    r.npc("gaia_ropemaker", "burgher", 7, 5, when(
        (FREED, ["Every bridge in Gaia sings in the wind again. I'd forgotten how a good rope sounds under a gust."]),
        default=["Fifteen paces of plank: that's our rope walk. You twist the hemp walking backwards, all day.",
                 "Without the wind the bridges don't sway, so they don't wear, so nobody needs new rope. Sad trade."]))
    r.npc("gaia_rope_apprentice", "thief", 10, 6, when(
        (BOTTLE, ["You've got a bottle that's glowing in your pack. That's not normal, is it? Is it?"]),
        default=["I can tie forty knots. The master says thirty-nine of them are the same knot."]), wander=True)
    out.append(r.save(note("a ropemaker's long house with a plank rope walk running down its length",
                           "a rope walk of planks laid down the middle of a long stone floor; three barrels of finished "
                           "rope in a nook at the east end"),
                      {**HIGH, "floor": wood(0.95), "in_wall_face": STONE_FACE}))


def spinner(out: list[Path]) -> None:
    """The spinner's house: her weaving room with tapestries on every wall, a sleeping room up a step."""
    r = GAIA.house("spinner", "Spinner's House", 11, 10, [5])
    g = r.g
    g.carve(1, 4, 9, 8, "_")                          # the weaving room
    g.carve(1, 2, 4, 3, "_")                          # the sleeping room behind
    g.carve(2, 4, 6, 6, "+")                          # a rug of her own weave
    r.open_exit()
    g.faces(2)
    r.wall([["tapestry"]], 6, 2)
    r.wall([["tapestry"]], 8, 2)
    r.tall("bed", 1, 2)
    r.one("plant", 4, 2)
    r.one("table", 7, 5)
    for (x, y) in [(9, 4), (9, 5), (1, 8)]:
        r.thing("crate", x, y)                        # bales of wool
    chest(r, "spinner", "phoenix_down", "a Phoenix Down", 9, 8)
    r.npc("gaia_spinner", "vendor_f", 5, 5, when(
        (FREED, ["Wool dries in an hour in this wind. I'll weave the whole winter's cloth before the snow."]),
        default=["Hilde. I spin and weave; those hangings are mine, all of them. The wool won't dry in dead air.",
                 "Damp wool felts on the wheel. I've spun nothing fit to sell since last spring."]))
    r.npc("gaia_spinner_father", "old_man", 2, 7, when(
        (FREED, ["The draught under the door's back. I've never been so glad to have cold feet."]),
        default=["When I was a boy the spring sang. You could hear it from this room on a quiet night."]))
    out.append(r.save(note("a spinner's weaving room hung with her tapestries, a small sleeping room behind",
                           "two tapestries of her own weave on the back wall; crates of damp wool by the east wall; a "
                           "sleeping room opening off the north-west corner", "two rooms open to each other; the "
                           "door is the only way in or out"),
                      {"floor": wood(1.0), "in_wall_face": {"from": "in_wall_face", "shade": 0.95}}, [170, 70, 110]))


def healer(out: list[Path]) -> None:
    """The healer's house (the shrine sign): the treatment room with the clinic at the orb, a ward of cots beside."""
    r = GAIA.house("healer", "Healer's House", 12, 10, [3])
    g = r.g
    g.carve(1, 4, 6, 8, "-")                          # the treatment room
    g.carve(8, 3, 10, 8, "-")                         # the ward
    g.carve(7, 6, 7, 7, "-")                          # the doorway between them
    r.open_exit("-")
    g.faces(2)
    for y in (3, 6):
        r.tall("bed", 10, y)
    r.wall([["potion_shelf"]], 2, 2)
    r.wall([["potion_shelf"]], 4, 2)
    r.one("orb_white", 1, 4)
    r.one("table", 5, 4)
    r.one("plant", 8, 8)
    r.npc("gaia_healer", "white_mage", 3, 5,
          ["Bring your fallen here, to the light. I can call them back, for a price that pays for the oil."],
          action="clinic", clinicPrice=120)           # GAP-16: 120 G per level of each fallen member (B7)
    r.npc("gaia_patient", "burgher", 9, 4, when(
        (FREED, ["The fever's breaking, the healer says. It's the clean air. I could have told her that."]),
        default=["Dead air sits in the chest. Half the town wheezes. I'm the half that complains."]))
    r.npc("gaia_healer_novice", "mage", 4, 7, when(
        (FREED, ["The healer says I can take the cots outside to air. In the wind! Like we used to!"]),
        default=["We burn sage to keep the air moving in here. It isn't the same as a window and a breeze."]))
    out.append(r.save(note("a healer's house: a treatment room round a white orb and a ward of two cots",
                           "the white orb in the treatment room's corner where the fallen are called back; a ward "
                           "of cots along the east wall through an inner doorway", "two rooms joined by an inner "
                           "doorway; the door is the only way in or out"),
                      {**HIGH, "in_wall_face": STONE_FACE}, [200, 220, 235]))


def beekeeper(out: list[Path]) -> None:
    """The beekeeper's house: shelves of honey jars, honey barrels, a table, the bed by the hearth."""
    r = GAIA.house("beekeeper", "Beekeeper's House", 10, 9, [7])
    g = r.g
    g.carve(1, 3, 8, 7, "_")
    r.open_exit()
    g.faces(2)
    r.fireplace(1, 1)
    r.wall([["potion_shelf"]], 4, 2)
    r.wall([["potion_shelf"]], 5, 2)
    r.wall([["window_in"]], 7, 2)
    r.tall("bed", 1, 4)
    for (x, y) in [(8, 3), (8, 4)]:
        r.thing("barrel", x, y)                       # honey
    r.one("table", 4, 5)
    r.one("plant", 1, 7)
    r.npc("gaia_beekeeper", "farmer", 5, 4, when(
        (FREED, ["The hives emptied out in one roar this morning. The whole bowl's buzzing. Best sound there is."]),
        default=["Bees ride the wind to the high flowers. No wind, no ride. They sit at home and eat my profits.",
                 "Those jars on the shelf are last year's. When they're gone, they're gone."]))
    r.npc("gaia_beekeeper_daughter", "villager_f", 3, 6, when(
        (FREED, ["I got stung four times today. Father says that's luck. Father's never been stung, he says."]),
        default=["I talk to the bees so they don't get lonely. They don't answer. They're sulking."]))
    out.append(r.save(note("a beekeeper's house with two shelves of bottles on the back wall",
                           "two shelves of coloured bottles on the back wall; two honey barrels in the north-east "
                           "corner; the bed beside the hearth"),
                      {"floor": wood(0.85), "in_wall_face": {"from": "in_wall_face", "shade": 0.9}}))


def shepherd(out: list[Path]) -> None:
    """The shepherd's cottage: a wide low room, fleeces (crates) in the corner, two beds, the shepherd's crook rack."""
    r = GAIA.house("shepherd", "Shepherd's House", 13, 8, [9])
    g = r.g
    g.carve(1, 2, 11, 6, "-")
    g.carve(2, 4, 4, 5, "+")
    r.open_exit("-")
    g.faces(1)
    r.tall("bed", 1, 2)
    r.tall("bed", 3, 2)
    r.fireplace(6, 0)
    r.wall([["weapon_rack"]], 9, 1)                   # crooks and staves
    for (x, y) in [(11, 2), (11, 3), (10, 2)]:
        r.thing("crate", x, y)                        # fleeces
    r.one("table", 7, 4)
    r.npc("gaia_shepherd", "old_man", 6, 3, when(
        (FREED, ["Rain's coming, I can smell it on the wind. The high grass will be green in a week. Up we go."]),
        default=["Sheep follow the wind to the sweet grass. With no wind they stand about bleating at me.",
                 "I've walked them down to the lower bowl. My boy minds the empty fold for luck."]))
    r.npc("gaia_shepherd_wife", "villager_f", 9, 5, when(
        (FREED, ["He's whistling. Thirty years married and I didn't know he could whistle."]),
        default=["Mind the fleeces. They're all I have to spin for Hilde until the sheep come back."]))
    out.append(r.save(note("a shepherd's wide low cottage, crates of fleece in the corner, two beds by the hearth",
                           "a weapon rack on the back wall east of the hearth; three crates of fleece in the north-east corner; a "
                           "small rug before the two beds"),
                      {**HIGH, "in_wall_face": {"from": "in_wall_face", "shade": 0.75}, "in_wall_top": SLATE_TOP}))


def build() -> list[Path]:
    out: list[Path] = []
    for f in (windmiller, ropemaker, spinner, healer, beekeeper, shepherd):
        f(out)
    return out
