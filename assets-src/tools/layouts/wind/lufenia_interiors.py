"""Lufenia's interiors (docs/WORLD_PLAN.md 4.0.1, 4.7; WND-O): the stargazer's, the elder's and the healer's houses,
the white and black magic shops and the inn -> assets-src/maps/lufenia-*.yaml.

  python3 -I assets-src/tools/layouts/wind/lufenia_interiors.py && python3 -I assets-src/tools/build_map.py lufenia-inn

The elder gives the chime through the cutscene `wnd_chime_given` (`requiredFlags: [LUFENIAN_LEARNED]`, onceFlag
CHIME_GIVEN, cutscenes.yaml WND-O anchor). Every keeper (the two magic shops, the inn, the healer's clinic) has
`showIf: LUFENIAN_LEARNED`: before the party can read Lufenian, nobody in Lufenia will trade with it (D-W4, GT-30).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parent))
from interiors_common import SHOP, STONE_FACE, Town, wood  # noqa: E402
from lufenia_people import LEARNED, OWN, TINT, talk  # noqa: E402

LUF = Town("lufenia", script="wind/lufenia_interiors.py")
PALE = {"in_wall_face": {"from": "castle_face", "shade": 1.15}, "in_wall_top": {"from": "slate", "shade": 0.9}}


def note(concept: str, distinct: str, topology: str = "one room; the door is the only way in or out") -> str:
    return f"Concept: {concept}\nDistinct: {distinct}\nTopology: {topology}"


def keeper(r, slug: str, sprite: str, x: int, y: int, line: str, shop: str, **kw) -> None:
    LUF.keeper(r, slug, sprite, x, y, line, shop)
    r.npcs[-1].update({"showIf": LEARNED, **({} if sprite in OWN else {"tint": TINT}), **kw})


def build() -> list[Path]:
    out: list[Path] = []
    # the stargazer: a round study under an open roof slit, a long telescope on its mount
    r = LUF.house("stargazer", "Stargazer's House", 11, 9, [5])
    g = r.g
    g.carve(1, 3, 9, 7, "_")
    g.carve(3, 4, 7, 6, "+")
    r.open_exit()
    g.faces(2)
    r.wall([["window_in"]], 3, 1)
    r.wall([["window_in"]], 7, 1)
    r.one("globe", 5, 3)
    r.one("lectern", 1, 3)
    r.one("desk", 9, 3)
    r.tall("bookshelf", 9, 5)
    r.one("plant", 1, 7)
    r.npc("lufenia_stargazer", "luf_senator", 7, 4, talk([
        "The castle above us is the one our makers flew. Its light went out when the wind stopped.",
        "Someone is inside it still. Something, I should say. It corrects the stars' courses, and it is getting worse."],
        12))
    r.npc("lufenia_apprentice", "mage", 3, 6, talk([
        "Master says I may look through the long glass when the clouds part. They never part now."], 13), tint=TINT)
    out.append(r.save(note("the stargazer's round study, a brass globe on a stand under the roof slit",
                           "a globe on a mount where the hearth would be; a reading lectern facing the north window"),
                      {"floor": wood(1.1), **PALE}, [150, 170, 220]))

    # the elder: a long hall with a dais at its head where the chime hangs; a side room for the attendant
    r = LUF.house("elder", "Elder's Hall", 14, 10, [7])
    g = r.g
    g.carve(1, 3, 9, 8, "-")
    g.carve(11, 5, 12, 8, "_")                   # the attendant's room
    g.carve(10, 7, 10, 8, "-")
    g.carve(3, 4, 7, 4, "+")                     # the dais carpet
    g.carve(5, 5, 5, 8, "+")
    r.open_exit("-")
    g.faces(2)
    r.wall([["tapestry"]], 2, 1)
    r.wall([["banner"]], 5, 1)
    r.wall([["tapestry"]], 8, 1)
    r.wall([["window_in"]], 12, 3)
    r.pillar(1, 5)
    r.pillar(9, 5)
    r.one("plant", 1, 3)
    r.one("plant", 9, 3)
    r.tall("bed", 12, 5)
    r.one("table", 11, 8)
    chime = {"id": "wnd_chime_given", "requiredFlags": [LEARNED], "onceFlag": "CHIME_GIVEN"}
    r.npc("lufenia_elder", "luf_senator", 5, 4, [
        {"condition": "CHIME_GIVEN", "text": [
            "The chime will hum as you near the Mirage. Strike it at the inner door, not before.",
            "When you stand in the sky, remember that our makers meant the castle to keep the wind, not cage it."]},
        {"condition": LEARNED, "text": [
            "You read our letters. Then you are the ones the slab was waiting for.",
            "Six hundred years we have kept one thing for the people who would climb the Mirage. Take it now."]},
        {"text": ["Sae'qat, ven doloth. Lun... thrim?"]}], cutscene=chime)
    r.npc("lufenia_attendant", "luf_citizen_f", 11, 6, talk([
        "The elder has not slept since the wind died. He listens for it at the window every night."], 14))
    out.append(r.save(note("the elder's long hall with a carpeted dais and two pillars, an attendant's room beside it",
                           "a dais under three hangings where the chime is kept; a side room off the hall's east end",
                           "two rooms joined by an inner doorway; the door is the only way in or out"),
                      {"floor_stone": "marble", "floor": wood(0.9), **PALE}, [120, 140, 200]))

    # the healer: a bright ward of cots and a herb table; the clinic (GAP-16)
    r = LUF.house("healer", "Healer's House", 12, 8, [3])
    g = r.g
    g.carve(1, 2, 10, 6, "-")
    g.carve(6, 3, 9, 5, "+")
    r.open_exit("-")
    g.faces(1)
    for x in (6, 8, 10):
        r.tall("bed", x, 2)
    r.wall([["potion_shelf"]], 2, 1)
    r.wall([["potion_shelf"]], 3, 1)
    r.one("table", 1, 2)
    r.one("plant", 1, 6)
    r.one("orb_white", 10, 6)
    r.npc("lufenia-healer-keeper", "luf_citizen_f", 3, 3,
          ["Fallen friends? Lay them here. The wind's breath can still be called back."],
          action="clinic", clinicPrice=150, showIf=LEARNED)       # GAP-16, B8: 150 G per level
    r.npc("lufenia_patient", "luf_citizen_m", 8, 5, talk([
        "I climbed the rim to look at the castle and fell. The healer says I was lucky. I was looking at the castle."],
        15))
    out.append(r.save(note("a healer's ward of cots under shelves of salves",
                           "three cots along the back wall; a white orb by the door that the healer calls on"),
                      {"floor_stone": "marble", **PALE}, [200, 215, 235]))

    # white magic: a high, pale room; the counter curves round a font of light
    r = LUF.shop("lufenia-white-magic", "White Magic", 10, 9, [5], "white_magic")
    g = r.g
    g.carve(1, 3, 8, 7, "-")
    g.carve(2, 5, 7, 5, "c")
    g.carve(4, 6, 6, 7, "+")
    r.open_exit("+")
    g.faces(2)
    r.one("orb_white", 2, 3)
    r.one("orb_white", 7, 3)
    r.one("plant", 4, 3)
    r.wall([["arch_window_top"], ["arch_window_bottom"]], 5, 1)
    r.one("plant", 1, 7)
    r.one("plant", 8, 7)
    r.staff(2, 3, 7, 4)
    keeper(r, "white-magic", "luf_citizen_f", 5, 4,
           "These are the last songs of healing our makers wrote. Learn them well; nobody writes new ones.",
           "lufenia_white")
    out.append(r.save(note("the white magic shop, a pale room with a counter across it and two white orbs",
                           "an arched window over the keeper; a carpet run from the door to the counter"),
                      {"floor_stone": "marble", "in_wall_face": STONE_FACE}, [220, 225, 240], music=SHOP))

    # black magic: a dim room under a starfield ceiling; the counter on the west
    r = LUF.shop("lufenia-black-magic", "Black Magic", 11, 9, [7], "black_magic")
    g = r.g
    g.carve(1, 3, 9, 7, "-")
    g.carve(1, 5, 4, 5, "c")
    g.carve(6, 4, 8, 6, "+")
    r.open_exit("-")
    g.faces(2)
    r.one("orb_black", 9, 3)
    r.one("orb_black", 9, 7)
    r.wall([["torch"]], 2, 1)
    r.wall([["potion_shelf"]], 6, 1)
    r.tall("bookshelf", 7, 3)
    r.staff(1, 3, 4, 4)
    keeper(r, "black-magic", "luf_citizen_m", 2, 4,
           "The makers' hardest words. Some of them unmake. Spend them only on what deserves it.", "lufenia_black")
    out.append(r.save(note("the black magic shop, dim, its counter set against the west wall",
                           "two black orbs on the east side; a carpet square before the shelves"),
                      {"floor_stone": "floor_stone", "in_wall_face": {"from": "castle_face", "shade": 0.55}},
                      [80, 70, 140], music=SHOP))

    # the inn: a hall of sleeping alcoves behind a low counter
    r = LUF.shop("lufenia-inn", "Inn", 13, 10, [6], "inn")
    g = r.g
    g.carve(1, 3, 11, 4, "_")                         # the alcoves
    g.carve(1, 6, 11, 8, "_")                         # the front hall
    g.carve(6, 5, 6, 5, "_")
    g.carve(8, 7, 11, 7, "c")
    g.carve(1, 7, 4, 8, "+")
    r.open_exit()
    g.faces(2)
    for x in (1, 3, 9, 11):
        r.tall("bed", x, 3)
    r.wall([["window_in"]], 6, 1)
    r.one("plant", 5, 3)
    r.one("plant", 7, 3)
    r.one("table", 1, 6)
    r.staff(8, 6, 11, 6)
    keeper(r, "inn", "innkeeper", 10, 6, "Rest under our domes. The air is thin, but it is quiet.", "lufenia_inn",
           action="inn")
    out.append(r.save(note("an inn of sleeping alcoves on the mesa, a low counter in the front hall",
                           "alcoves split by a central passage; the counter tucked in the east corner"),
                      {"floor": wood(1.0), **PALE}, [160, 170, 210], music=SHOP))
    return out


if __name__ == "__main__":
    for p in build():
        print(p)
