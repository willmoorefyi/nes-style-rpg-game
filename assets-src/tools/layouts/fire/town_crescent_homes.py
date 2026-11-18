"""Crescent Lake's six homes (docs/WORLD_PLAN.md 4.0.1, 4.4; FIR-T), original plans: the healer's house (the
clinic), the astronomer, the boatwright, the archivist, the potter and the tutor's school. Each header carries its
design note (Concept / Distinct / Topology). Written by `town_crescent_rooms.py`.
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from interiors_common import STONE_FACE, SLATE_TOP, Place, Town, wood  # noqa: E402

CRESCENT = Town("crescent", script="fire/town_crescent_rooms.py")
CANOE, LIT = "CANOE_GIVEN", "EARTH_CRYSTAL_LIT"
ONE_ROOM = "Topology: one room, no stairs: the door on the south wall is the only way in or out. No boss."
TWO_ROOMS = ("Topology: two rooms, no stairs: the door on the south wall into the first room, an open doorway "
             "to the second. No boss.")


def note(concept: str, distinct: str, topology: str = ONE_ROOM) -> str:
    return f"Concept: {concept}\nDistinct: {distinct}\n{topology}"


def chest(r: Place, key: str, item: str, label: str, x: int, y: int) -> None:
    r.npcs.append({"id": f"chest_fir_t_{key}", "sprite": "chest", "x": x, "y": y, "chestItem": item,
                   "chestFlag": f"CHEST_FIR_T_{key.upper()}", "dialog": [f"You found {label}!"]})


def said(canoe: list[str], lit: list[str], before: list[str]) -> list[dict]:
    """A line in three steps: after the canoe, after the earth crystal, and before both."""
    return [{"condition": CANOE, "text": canoe}, {"condition": LIT, "text": lit}, {"text": before}]


def build() -> list[Path]:
    out: list[Path] = []
    # ── the healer's house: a long infirmary of cots, the healer's herb table by the window ──
    r = CRESCENT.house("healer", "Healer's House", 13, 10, [6])
    g = r.g
    g.carve(1, 3, 11, 8, "-")
    g.carve(1, 3, 4, 8, "+")                          # the cots stand on a runner of carpet
    r.open_exit("-")
    g.faces(2)
    r.wall([["window_in"]], 3, 1)
    r.wall([["window_in"]], 10, 1)
    r.wall([["potion_shelf"]], 6, 1)
    r.wall([["potion_shelf"]], 7, 1)
    for y in (3, 5, 7):
        r.tall("bed", 1, y)
    r.one("table", 10, 3)
    r.one("table", 11, 3)
    r.one("plant", 11, 8)
    r.thing("barrel", 8, 3)
    r.npc("healer", "white_mage", 7, 4, [
        "Rest is the best healer, and I am the second best. Bring me your fallen and I'll bring them round.",
        "My fee is 60 G for each of their levels. The lake towns can't afford to do it for less."],
        action="clinic", clinicPrice=60, tint="#e0e8f0")
    r.npc("healer_aide", "villager_f", 4, 6, said(
        ["The healer says the town's grown healthier since you came. She credits the lake air. I credit you."],
        ["The fevers from the south have stopped. Now we get burns from people who walked too near the volcano."],
        ["Every patient this month has the same grey fever. The healer calls it earth-sickness."]))
    r.npc("patient", "villager", 2, 4, said(
        ["Up tomorrow, the healer says. I'll walk the causeway to thank the sages, then straight back to bed."],
        ["I can feel my feet again! I didn't know they'd gone until they came back."],
        ["Don't mind me. I'm just lying here being grey. It's very restful, the grey."]))
    out.append(r.save(note("the healer's house below the Sea Road: one long infirmary where the healer tends the "
                           "lake folk among cots and drying herbs.",
                           "three cots on a carpet runner along the west wall; two herb tables joined under the "
                           "east window; tonic shelves on the back wall between the windows"),
                      {"floor_stone": "marble", "in_wall_face": STONE_FACE}, [170, 190, 220]))

    # ── the astronomer: a study of charts, and her bedchamber through an arch ──
    r = CRESCENT.house("astronomer", "Astronomer's House", 12, 10, [3])
    g = r.g
    g.carve(1, 3, 6, 8, "_")                          # the study
    g.carve(8, 3, 10, 6, "+")                         # the bedchamber
    g.carve(7, 4, 7, 5, "_")                          # the arch between them
    r.open_exit()
    g.faces(2)
    r.wall([["window_in"]], 2, 1)
    r.wall([["window_in"]], 5, 1)
    r.wall([["banner"]], 9, 1)
    r.one("globe", 1, 3)
    r.one("map_table_l", 3, 4)
    r.one("map_table_r", 4, 4)
    r.one("lectern", 6, 3)
    r.tall("bed", 10, 3)
    r.tall("bookshelf", 8, 3)
    chest(r, "astronomer", "ether", "an Ether", 10, 6)
    r.npc("astronomer", "white_wizard", 2, 6, said(
        ["I watched your canoe cross the lake through the small glass. You paddle like scholars: earnestly.",
         "The rivers run out of the lake south and south-east. One ends in fire, the other in ice."],
        ["The earth crystal's light reached us on a clear night. A green star, low in the west. It was beautiful.",
         "Now two new lights show in the south: a red one that pulses, and a white one that never moves."],
        ["My charts show the stars dimming at the edges of the sky, one a season. The sages call it the decay.",
         "The worst of it lies west, under the land. The earth's own light is going out."]), tint="#d8c8f0")
    r.npc("astronomer_son", "villager", 5, 7, [
        "Mother stays up all night and sleeps all day. I've learned to cook breakfast at sunset."])
    out.append(r.save(note("the astronomer's house on the Star Terrace: a study of charts and a globe, her "
                           "bedchamber through an arch.",
                           "a chart table, a globe and a lectern in the study; a carpeted bedchamber with a "
                           "bookshelf through an archway; a star banner over the bed", TWO_ROOMS),
                      {"floor": wood(0.8), "in_wall_face": STONE_FACE, "in_wall_top": SLATE_TOP}, [70, 70, 150]))

    # ── the boatwright: a workshop with a hull on the stocks, the family's corner by the hearth ──
    r = CRESCENT.house("boatwright", "Boatwright's House", 14, 10, [6])
    g = r.g
    g.carve(1, 3, 12, 8, "-")
    g.carve(9, 3, 12, 5, "_")                         # the family's corner, on boards
    r.open_exit("-")
    g.faces(2)
    r.fireplace(10, 1)
    r.wall([["window_in"]], 2, 1)
    r.wall([["window_in"]], 6, 1)
    for x in range(2, 7):
        r.thing("crate", x, 5)                        # a hull on the stocks, its ribs crated in
    r.thing("barrel", 1, 8)
    r.thing("barrel", 12, 8)
    r.tall("bed", 12, 3)
    r.one("table", 9, 4)
    chest(r, "boatwright", "hi_potion", "a Hi-Potion", 1, 3)
    r.npc("boatwright", "farmer", 7, 4, said(
        ["The canoe the sages gave you? I re-tarred her keel last spring. Never knew who she was for.",
         "Keep her off the rocks at the river mouths and she'll outlast the four of you."],
        ["The sages sent word: have the old canoe ready. I asked whose it was. They said, 'Soon.'"],
        ["I build boats for a lake nobody sails. The rivers out of it run into the ring and nobody comes back."]))
    r.npc("boatwright_wife", "villager_f", 10, 6, [
        "He talks to the hulls. Says it makes the planks lie easy. I talk to him. It doesn't make him lie easy."])
    out.append(r.save(note("the boatwright's house on the lakeside: a workshop where a hull sits on the stocks, "
                           "the family's corner by the hearth.",
                           "a hull on the stocks across the workshop floor; a boarded family corner with the "
                           "hearth and a bed; an earth workshop floor for the tar"),
                      {"floor_stone": "dirt", "floor": wood(0.9), "in_wall_face": {"from": "in_wall_face", "shade": 0.8}}))

    # ── the archivist: a hall of shelves, the reading desk and the ledger room behind it ──
    r = CRESCENT.house("archivist", "Archive", 14, 11, [3])
    g = r.g
    g.carve(1, 3, 12, 9, "-")
    g.carve(1, 7, 12, 9, "+")                         # the reading carpet
    r.open_exit("+")
    g.faces(2)
    for x in (1, 3, 5, 8, 10, 12):
        r.tall("bookshelf", x, 3)
    r.wall([["window_in"]], 7, 1)
    r.one("desk", 7, 6)
    r.one("lectern", 11, 7)
    r.one("plant", 1, 9)
    chest(r, "archivist", "phoenix_down", "a Phoenix Down", 12, 9)
    r.npc("archivist", "old_man", 7, 5, said(
        ["I've begun a new volume: 'The Warriors and the Canoe'. Do you prefer 'valiant' or 'damp'?"],
        ["The record says the earth crystal last went dark four hundred years ago. It came back then too. Barely."],
        ["Every book on this wall speaks of the four crystals. Three are fading. The earth's fades fastest."]),
        tint="#c8b4a0")
    r.npc("copyist", "mage", 3, 8, said(
        ["I'm copying the prophecy again. My hand shakes now that I know the faces."],
        ["Fire, frost, fire, frost. The sages say nothing else these days. My wrist aches from it."],
        ["Quietly, please: I am copying a treatise on rot. It is extremely long and it smells of the cellar."]))
    out.append(r.save(note("the town's archive on the Star Terrace: one tall hall lined with shelves, a reading "
                           "carpet and the archivist's desk in the middle.",
                           "six bookshelves along the back wall broken by a single window; a reading carpet with "
                           "a lectern; the archivist's desk in the middle of the hall"),
                      {"floor_stone": "floor_stone", "in_wall_face": {"from": "castle_face", "shade": 0.8},
                       "in_wall_top": SLATE_TOP}, [120, 40, 50]))

    # ── the potter: a wheel room and a kiln room through a doorway ──
    r = CRESCENT.house("potter", "Potter's House", 12, 9, [3])
    g = r.g
    g.carve(1, 3, 5, 7, "_")                          # the wheel room
    g.carve(7, 3, 10, 7, "-")                         # the kiln room
    g.carve(6, 6, 6, 7, "_")                          # the doorway
    r.open_exit()
    g.faces(2)
    r.fireplace(8, 1)                                 # the kiln
    r.wall([["window_in"]], 2, 1)
    r.wall([["potion_shelf"]], 4, 1)                  # glazed pots on the shelf
    r.one("table", 3, 4)
    for (x, y) in [(10, 3), (10, 4), (7, 7), (1, 7)]:
        r.thing("barrel", x, y)
    r.one("plant", 5, 3)
    chest(r, "potter", "soft", "a Soft", 10, 7)
    r.npc("potter", "burgher", 2, 5, said(
        ["Made you a cup with a canoe painted on it. Don't take it with you, it'll break. Just know it exists."],
        ["The clay's good again! It rolls smooth, not gritty. The earth's well, my hands say so."],
        ["The clay's gone sour. My pots crack in the kiln. Even the mud is sick this year."]))
    r.npc("potter_girl", "villager_f", 8, 5, [
        "I keep the kiln fed. Too hot and the pots burst, too cool and they weep. It's like minding a dragon."])
    out.append(r.save(note("the potter's house on the Market Terrace: a wheel room on boards and an earth-floored kiln room "
                           "through a side doorway.",
                           "a kiln set into the back wall of an earth-floored room; barrels of clay in the corners; a "
                           "shelf of glazed pots over the wheel table", TWO_ROOMS),
                      {"floor": wood(1.05), "floor_stone": "dirt", "in_wall_face": STONE_FACE}, [150, 90, 60]))

    # ── the tutor's school: rows of desks before the tutor's lectern, a slate wall ──
    r = CRESCENT.house("tutor", "Tutor's School", 13, 10, [6])
    g = r.g
    g.carve(1, 3, 11, 8, "_")
    r.open_exit()
    g.faces(2)
    r.wall([["window_in"]], 2, 1)
    r.wall([["window_in"]], 10, 1)
    r.wall([["tapestry"]], 6, 1)                      # the slate wall
    r.one("lectern", 6, 3)
    for x in (3, 5, 7, 9):
        r.one("desk", x, 5)
    r.tall("bookshelf", 1, 3)
    r.tall("bookshelf", 11, 3)
    r.one("plant", 1, 8)
    r.npc("tutor", "red_mage", 6, 4, said(
        ["Today we study rivers, because of you. Last week we studied the earth crystal, also because of you."],
        ["Lesson eleven: what heals the earth may wake the fire. I wrote it for the sages. Now I teach it."],
        ["Lesson ten: the earth is sick, and the sick earth makes sick crops. My pupils know it better than I'd like."]),
        tint="#c8a0a0")
    r.npc("pupil_c", "villager", 4, 7, said(
        ["When I'm grown I'm going to paddle down every river on the map. Even the hot one."],
        ["The tutor drew a volcano on the slate. Then she drew it again, bigger."],
        ["I'm writing an essay on mould. It's my third. I'm very good at mould."]))
    r.npc("pupil_d", "villager_f", 9, 7, [
        "I sit at the back so I can see out of the window. The window's more interesting than geography."])
    out.append(r.save(note("the tutor's school on the Star Terrace: rows of desks facing the tutor's lectern and a "
                           "slate hung on the back wall.",
                           "four desks in a row facing a lectern; a slate tapestry between the windows; bookshelves "
                           "standing in both back corners"),
                      {"floor": wood(1.1), "in_wall_face": {"from": "in_wall_face", "shade": 1.05}}, [60, 120, 80]))
    return out
