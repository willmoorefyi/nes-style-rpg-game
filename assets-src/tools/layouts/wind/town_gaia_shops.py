"""Gaia's five shops and the inn (docs/WORLD_PLAN.md 3.6 B7, 4.0.1, 4.7; WND-T), each with its own counter layout;
the keepers stand behind it and sell the `gaia_*` records (shops.yaml WND-T anchor: B7 gear, L7 magic, inn 700).
Written by `town_gaia_interiors.py`.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parent))
from interiors_common import SHOP, SLATE_TOP, STONE_FACE, wood  # noqa: E402
from town_gaia_homes import GAIA, HIGH, note  # noqa: E402
from town_gaia_people import FREED  # noqa: E402


def build() -> list[Path]:
    out: list[Path] = []
    # weapons: an L-shaped counter in the north-east corner, racks along the back wall, a grindstone by the door
    r = GAIA.shop("gaia-weapon-shop", "Weapon Shop", 11, 9, [2], "weapon_shop")
    g = r.g
    g.carve(1, 3, 9, 7, "-")
    g.carve(5, 5, 9, 5, "c")
    g.carve(5, 3, 5, 4, "c")
    r.open_exit("-")
    g.faces(2)
    for x in (6, 7, 9):
        r.wall([["weapon_rack"]], x, 2)
    r.wall([["torch"]], 2, 2)
    r.one("stone_bench", 1, 6)                        # the grindstone
    r.thing("barrel", 1, 3)
    r.staff(6, 3, 9, 4)
    GAIA.keeper(r, "weapon-shop", "merchant", 8, 4, ["Mountain steel, folded in the forge that the old mill wheel "
                "used to drive. Have a look."], "gaia_weapon")
    out.append(r.save(note("a weapon shop whose counter boxes in the north-east corner", "an L-shaped counter "
                           "round the keeper's corner; three weapon racks over it; a stone bench by the west wall"),
                      {**HIGH, "in_wall_face": {"from": "castle_face", "shade": 0.75}}, music=SHOP))

    # armour: a long counter across the room's middle, stands in front of it, a window over the keeper
    r = GAIA.shop("gaia-armor-shop", "Armor Shop", 12, 10, [8], "armor_shop")
    g = r.g
    g.carve(1, 4, 10, 8, "_")
    g.carve(2, 5, 8, 5, "c")
    r.open_exit()
    g.faces(2)
    r.wall([["window_in"]], 5, 3)
    r.wall([["banner"]], 3, 3)
    r.wall([["banner"]], 8, 3)
    for (x, y) in [(1, 7), (3, 7), (10, 5)]:
        r.one("armor_stand", x, y)
    r.thing("crate", 10, 8)
    r.staff(1, 4, 9, 4)
    GAIA.keeper(r, "armor-shop", "merchant", 5, 4, ["Diamond-studded mail, cut by the gem-cutters of the high "
                "passes. Light as wool, nearly."], "gaia_armor")
    out.append(r.save(note("an armour shop with a long counter across the middle of the room", "armour stands on "
                           "the shop floor in front of the counter; two banners and a window over the keeper"),
                      {"floor": wood(0.8), "in_wall_face": STONE_FACE}, music=SHOP))

    # items: a counter across the back's west half, a bench and a barrel in the customers' half
    r = GAIA.shop("gaia-item-shop", "Item Shop", 10, 9, [6], "item_shop")
    g = r.g
    g.carve(1, 3, 8, 7, "_")
    g.carve(1, 5, 5, 5, "c")
    r.open_exit()
    g.faces(2)
    for x in (1, 2, 4):
        r.wall([["potion_shelf"]], x, 2)
    r.wall([["window_in"]], 7, 2)
    r.one("plant", 8, 3)
    r.one("stone_bench", 8, 6)
    r.thing("barrel", 1, 7)
    r.staff(1, 3, 5, 4)
    GAIA.keeper(r, "item-shop", "merchant", 3, 4, [{"condition": FREED, "text": [
        "Tents, cabins, potions! With the wind back I can air the cabins out properly. Buy two."]},
        {"text": ["Tents and cabins for the high passes, potions for what the passes do to you."]}], "gaia_item")
    out.append(r.save(note("an item shop with its counter across the west half of the room", "three shelves of "
                           "tonics over the counter; a waiting bench by the east wall"),
                      {"floor": wood(1.05), "in_wall_face": {"from": "in_wall_face", "shade": 1.0}}, music=SHOP))

    # white magic: a round-ish shrine room, the counter before two white orbs, flowers along the walls
    r = GAIA.shop("gaia-white-magic", "White Magic Shop", 13, 10, [6], "white_magic")
    g = r.g
    g.carve(2, 4, 10, 8, "-")
    g.carve(1, 5, 1, 7, "-")
    g.carve(11, 5, 11, 7, "-")
    g.carve(4, 5, 8, 5, "c")
    g.carve(5, 6, 7, 8, "+")
    r.open_exit("+")
    g.faces(2)
    r.one("orb_white", 4, 4)
    r.one("orb_white", 8, 4)
    r.wall([["arch_window_top"], ["arch_window_bottom"]], 6, 2)
    for (x, y) in [(1, 5), (11, 5), (1, 7), (11, 7)]:
        r.thing("flowers", x, y)
    r.staff(5, 4, 7, 4)
    GAIA.keeper(r, "white-magic", "healer", 6, 4, ["The highest words of healing are taught only here, where "
                "the air is thin and the sky is near."], "gaia_white")
    out.append(r.save(note("a white magic shrine room with bays on either side and two white orbs by the counter",
                           "a white orb at each end of the counter under an arched window; flowers in the two "
                           "side bays"), {"floor_stone": "marble", "in_wall_face": STONE_FACE}, [220, 225, 240],
                      music=SHOP))

    # black magic: a narrow, deep room; the counter at the far end before a black orb and shelves of bone and ink
    r = GAIA.shop("gaia-black-magic", "Black Magic Shop", 9, 11, [3], "black_magic")
    g = r.g
    g.carve(1, 3, 7, 9, "-")
    g.carve(1, 5, 7, 5, "c")
    g.carve(3, 6, 4, 9, "+")
    r.open_exit("-")
    g.faces(2)
    r.one("orb_black", 6, 3)
    r.wall([["potion_shelf"]], 2, 2)
    r.wall([["torch"]], 4, 2)
    r.tall("bookshelf", 1, 7)
    r.thing("crate", 7, 9)
    r.staff(1, 3, 7, 4)
    GAIA.keeper(r, "black-magic", "scholar", 4, 4, ["Storm-words and doom-words. The mountain sharpens them. Do "
                "be careful where you point them."], "gaia_black")
    out.append(r.save(note("a narrow, deep black magic shop, the counter wall to wall at the far end",
                           "a black orb in the keeper's corner; a dark runner from the door to the counter; a "
                           "bookshelf on the west wall of the customers' side"),
                      {"floor_stone": "floor_stone", "in_wall_face": {"from": "castle_face", "shade": 0.5},
                       "in_wall_top": SLATE_TOP}, [90, 60, 130], music=SHOP))

    # the inn: the common room with a long table and the hearth, a sleeping loft (beds) on the east up a step
    r = GAIA.shop("gaia-inn", "Inn", 14, 10, [4], "inn")
    g = r.g
    g.carve(1, 3, 8, 8, "_")                          # the common room
    g.carve(10, 2, 12, 8, "_")                        # the sleeping room
    g.carve(9, 4, 9, 5, "_")
    g.carve(1, 5, 3, 5, "c")
    g.carve(5, 6, 7, 6, "+")
    r.open_exit()
    g.faces(1)
    for (x, y) in [(10, 2), (12, 2), (10, 5), (12, 5)]:
        r.tall("bed", x, y)
    r.fireplace(5, 1)
    r.deco([["banquet_l", "banquet_r"]], 5, 4)
    r.thing("barrel", 1, 8)
    r.thing("barrel", 8, 8)
    r.staff(1, 3, 3, 4)
    GAIA.keeper(r, "inn", "innkeeper", 2, 4, ["A warm bed, a hot stew, and a shutter that rattles. That's a mountain "
                "night. Stay?"], "gaia_inn")
    r.npcs[-1]["action"] = "inn"
    r.npc("gaia_inn_drover", "farmer", 6, 7, [
        {"condition": FREED, "text": ["The shutters are rattling! First time in a year I've been glad of a draughty "
                                      "inn."]},
        {"text": ["I came up for wool and found the fleeces damp and the sheep gone. So I'm drinking. Slowly."]}])
    out.append(r.save(note("an inn: a common room with a long table before the hearth, a sleeping room of four "
                           "beds beside it", "the counter on the common room's west wall; a long table "
                           "before the hearth; four beds in a room on the east", "two rooms joined by an inner "
                           "doorway; the door is the only way in or out"),
                      {"floor": wood(0.85), "in_wall_face": "castle_face"}, [140, 100, 60], music=SHOP))
    return out
