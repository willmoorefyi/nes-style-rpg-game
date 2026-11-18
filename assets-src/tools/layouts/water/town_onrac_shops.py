"""Onrac's five shops and the inn (docs/WORLD_PLAN.md 4.0.1, 4.6; WAT-T), each with its own counter layout; the
keepers stand behind it and sell the `onrac_*` records (shops.yaml WAT-T anchor: B6 arms, L6 magic, inn 500).
Written by `town_onrac_interiors.py`.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parent))
from interiors_common import SHOP, SLATE_TOP, STONE_FACE, wood  # noqa: E402
from town_onrac_homes import COLD, ONR, TAR, note  # noqa: E402
from town_onrac_people import LIT  # noqa: E402


def build() -> list[Path]:
    out: list[Path] = []
    # weapons: the counter down the east side, a rack of harpoons and blades on the back wall, a grindstone
    r = ONR.shop("onrac-weapon-shop", "Weapon Shop", 11, 9, [3], "weapon_shop")
    g = r.g
    g.carve(1, 3, 9, 7, "-")
    g.carve(6, 3, 6, 7, "c")
    r.open_exit("-")
    g.faces(2)
    for x in (2, 4):
        r.wall([["weapon_rack"]], x, 1)
    r.wall([["torch"]], 8, 1)
    r.one("stone_bench", 1, 3)                        # the grindstone
    r.thing("barrel", 1, 7)
    r.staff(7, 3, 9, 7)
    ONR.keeper(r, "weapon-shop", "merchant", 7, 4, ["Harpoon steel and storm-forged blades. In Onrac a weapon has to "
               "cut through ice first."], "onrac_weapon")
    out.append(r.save(note("a weapon shop with its counter down the east side, the keeper's floor behind it",
                           "a counter running north to south instead of across; a grindstone by the west wall under "
                           "the harpoon racks"), {**COLD, "in_wall_face": {"from": "castle_face", "shade": 0.7}},
                      music=SHOP))

    # armour: sealskin-lined mail on stands, the counter across the middle with a gap at the west end
    r = ONR.shop("onrac-armor-shop", "Armor Shop", 12, 9, [8], "armor_shop")
    g = r.g
    g.carve(1, 3, 10, 7, "_")
    g.carve(1, 5, 10, 5, "c")
    r.open_exit()
    g.faces(2)
    r.wall([["window_in"]], 2, 1)
    r.wall([["banner"]], 6, 1)
    for x in (4, 8, 10):
        r.one("armor_stand", x, 3)
    r.thing("crate", 9, 7)
    r.thing("crate", 10, 7)
    r.staff(1, 3, 10, 4)
    ONR.keeper(r, "armor-shop", "merchant", 6, 4, ["Opal mail, lined with sealskin. Keeps out a blade and the north "
               "wind both."], "onrac_armor")
    out.append(r.save(note("an armour shop whose counter crosses the whole room, mail stands on the keeper's side",
                           "armour stands behind the counter against the back wall; a pair of crates just east of "
                           "the door"), {**TAR, "in_wall_face": STONE_FACE},
                      music=SHOP))

    # items: a narrow shop, shelves floor to ceiling, the counter by the door
    r = ONR.shop("onrac-item-shop", "Item Shop", 9, 9, [2], "item_shop")
    g = r.g
    g.carve(1, 3, 7, 7, "_")
    g.carve(2, 5, 7, 5, "c")
    r.open_exit()
    g.faces(2)
    for x in (1, 2, 5, 6, 7):
        r.wall([["potion_shelf"]], x, 1)
    for y in (3, 4, 5):
        r.thing("barrel", 1, y)
    r.staff(2, 3, 7, 4)
    ONR.keeper(r, "item-shop", "merchant", 6, 4, ["Tents that stand in a gale, potions that don't freeze. What'll it "
               "be?"], "onrac_item")
    out.append(r.save(note("a narrow item shop, shelves along the back wall and a counter from the oil barrels to the east wall",
                           "barrels of lamp oil stacked by the west wall; five shelves of jars over the counter"),
                      {"floor": wood(0.95), "in_wall_face": {"from": STONE_FACE, "shade": 0.95}}, music=SHOP))

    # white magic: a pale room, the counter before a white orb, a carpet from the door
    r = ONR.shop("onrac-white-magic", "White Magic Shop", 11, 9, [5], "white_magic")
    g = r.g
    g.carve(1, 3, 9, 7, "-")
    g.carve(1, 4, 9, 4, "c")
    g.carve(5, 5, 5, 7, "+")
    r.open_exit("+")
    g.faces(2)
    r.one("orb_white", 5, 3)
    r.wall([["arch_window_top"], ["arch_window_bottom"]], 2, 1)
    r.wall([["arch_window_top"], ["arch_window_bottom"]], 8, 1)
    r.one("plant", 1, 7)
    r.one("plant", 9, 7)
    r.staff(1, 3, 9, 3)
    ONR.keeper(r, "white-magic", "white_mage", 3, 3, ["Words for the deep: one to lift the dead to the surface, one "
               "to walk you home from anywhere."], "onrac_white")
    out.append(r.save(note("a pale white magic shop, the counter in front of a white orb, a runner from the door",
                           "a single carpet runner straight from the door to the counter; arched windows either side "
                           "of the orb"), {"floor_stone": "marble", "in_wall_face": STONE_FACE}, [200, 215, 235],
                      music=SHOP))

    # black magic: a cellar-dark room, the counter round the keeper's south-east corner
    r = ONR.shop("onrac-black-magic", "Black Magic Shop", 10, 9, [2], "black_magic")
    g = r.g
    g.carve(1, 3, 8, 7, "-")
    g.carve(5, 5, 8, 5, "c")
    g.carve(5, 6, 5, 7, "c")
    r.open_exit("-")
    g.faces(2)
    r.wall([["torch"]], 2, 1)
    r.wall([["potion_shelf"]], 6, 1)
    r.tall("bookshelf", 1, 3)
    r.one("orb_black", 8, 3)
    r.staff(6, 6, 8, 7)
    ONR.keeper(r, "black-magic", "black_mage", 7, 6, ["Thunder, quake and stillness. Spells the sea itself would "
               "fear."], "onrac_black")
    out.append(r.save(note("a dark black magic shop with the counter boxing in its south-east corner",
                           "the keeper's corner by the floor's south-east wall, not the back; a black orb on the "
                           "customers' side of the counter"),
                      {"floor_stone": "floor_stone", "in_wall_face": {"from": "castle_face", "shade": 0.45},
                       "in_wall_top": SLATE_TOP}, [100, 60, 130], music=SHOP))

    # the inn: a common room round a great stove, the counter by the stair wall, beds in a long dormitory east
    r = ONR.shop("onrac-inn", "Inn", 14, 10, [4], "inn")
    g = r.g
    g.carve(1, 3, 7, 8, "_")                          # the common room
    g.carve(9, 3, 12, 8, "_")                         # the dormitory
    g.carve(8, 6, 8, 7, "_")
    g.carve(1, 5, 3, 5, "c")
    g.carve(4, 3, 4, 5, "c")
    g.carve(4, 7, 5, 8, "+")
    r.open_exit()
    g.faces(2)
    r.fireplace(5, 1)
    r.wall([["window_in"]], 2, 1)
    for (x, y) in [(9, 3), (11, 3), (9, 6), (12, 6)]:
        r.tall("bed", x, y)
    r.one("table", 6, 5)
    r.thing("barrel", 1, 8)
    r.staff(1, 3, 3, 4)
    ONR.keeper(r, "inn", "innkeeper", 2, 4, ["A bed by the stove and fish stew till you burst. Five hundred, and worth "
               "every coin in this cold."], "onrac_inn")
    r.npcs[-1]["action"] = "inn"
    r.npc("onrac_inn_skipper", "warrior", 7, 7, [
        {"condition": LIT, "text": ["The harbour's calm as a millpond. I'm sailing at dawn, and I'll be sober for it. Mostly."]},
        {"text": ["Thirty years I've skippered out of Onrac. Never once past the stacks. I like being alive."]}])
    out.append(r.save(note("an inn: a common room round a stove with the counter in its north-west corner, a "
                           "dormitory through a doorway", "the counter boxed into the corner under the window; four "
                           "beds in an east dormitory", "two rooms joined by an inner doorway; the door is the only "
                           "way in or out"), {"floor": wood(0.8), "in_wall_face": "castle_face"}, [140, 90, 50],
                      music=SHOP))
    return out
