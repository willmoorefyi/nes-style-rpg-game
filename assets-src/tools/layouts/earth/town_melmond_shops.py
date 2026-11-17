"""Melmond's five shops and the inn (docs/WORLD_PLAN.md 4.0.1, 4.3; ERT-T), each with its own counter layout; the
keepers stand behind it and sell the `melmond_*` records (shops.yaml ERT-T anchor). Written by
`town_melmond_interiors.py`.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parent))
from interiors_common import SHOP, SLATE_TOP, STONE_FACE, wood  # noqa: E402
from town_melmond_homes import EARTH, MEL, note  # noqa: E402


def build() -> list[Path]:
    out: list[Path] = []
    # weapons: a smithy's counter across the front, racks of farm-forged blades and a cold anvil behind
    r = MEL.shop("melmond-weapon-shop", "Weapon Shop", 10, 8, [6], "weapon_shop")
    g = r.g
    g.carve(1, 2, 8, 6, "-")
    g.carve(1, 4, 6, 4, "c")
    r.open_exit("-")
    g.faces(1)
    for x in (1, 2, 4):
        r.wall([["weapon_rack"]], x, 1)
    r.wall([["torch"]], 6, 1)
    r.one("stone_bench", 5, 2)                        # the anvil
    r.one("armor_stand", 8, 2)
    r.thing("barrel", 8, 6)
    r.staff(1, 2, 6, 3)
    MEL.keeper(r, "weapon-shop", "merchant", 3, 3, ["Blades forged from ploughshares. Nobody's ploughing, so I've "
               "plenty."], "melmond_weapon")
    out.append(r.save(note("a smithy turned weapon shop, its counter across the front of the room", "a cold anvil "
                           "behind the counter; racks of blades beaten from old ploughshares"),
                      {**EARTH, "in_wall_face": {"from": "castle_face", "shade": 0.8}}, music=SHOP))

    # armour: a counter across the back's east half, stands on the shop floor in front of the west wall
    r = MEL.shop("melmond-armor-shop", "Armor Shop", 11, 9, [3], "armor_shop")
    g = r.g
    g.carve(1, 3, 9, 7, "_")
    g.carve(5, 4, 9, 4, "c")
    r.open_exit()
    g.faces(2)
    r.wall([["banner"]], 2, 1)
    r.wall([["window_in"]], 4, 1)
    r.wall([["tapestry"]], 8, 1)
    for (x, y) in [(1, 3), (3, 3), (1, 5)]:
        r.one("armor_stand", x, y)
    r.thing("crate", 1, 7)
    r.thing("barrel", 9, 7)
    r.staff(5, 3, 9, 3)
    MEL.keeper(r, "armor-shop", "merchant", 7, 3, ["Mail and plate, oiled against the dust. Try it on; the mirror's "
               "honest."], "melmond_armor")
    out.append(r.save(note("an armour shop with its counter across the back of the east half", "armour stands "
                           "lined up against the bare west wall; a banner and a tapestry over the keeper"),
                      {"floor": wood(0.85), "in_wall_face": STONE_FACE}, music=SHOP))

    # items: a counter wall to wall in front of jars of salves and dried roots
    r = MEL.shop("melmond-item-shop", "Item Shop", 9, 8, [2], "item_shop")
    g = r.g
    g.carve(1, 2, 7, 6, "_")
    g.carve(1, 4, 7, 4, "c")
    r.staff(1, 2, 7, 3)
    r.open_exit()
    g.faces(1)
    for x in (1, 3, 4, 6):
        r.wall([["potion_shelf"]], x, 1)
    r.one("plant", 7, 2)
    r.thing("barrel", 7, 6)
    r.thing("crate", 6, 6)
    MEL.keeper(r, "item-shop", "merchant", 4, 3, ["Tonics and remedies. The herbs come from the dwarves now; ours "
               "won't grow."], "melmond_item")
    out.append(r.save(note("an item shop with a counter from wall to wall before shelves of jars", "the dwarves' "
                           "sealed crates of herbs by the door; a single potted plant on the keeper's side"),
                      {"floor": wood(1.05), "in_wall_face": {"from": STONE_FACE, "shade": 1.05}}, music=SHOP))

    # white magic: a quiet chapel room, the counter before an alcove with a white orb
    r = MEL.shop("melmond-white-magic", "White Magic Shop", 11, 9, [5], "white_magic")
    g = r.g
    g.carve(1, 4, 9, 7, "-")
    g.carve(4, 3, 6, 3, "-")                          # the orb alcove
    g.carve(2, 5, 8, 5, "c")
    g.carve(4, 6, 6, 7, "+")
    r.open_exit("+")
    g.faces(2)
    r.one("orb_white", 5, 3)
    r.wall([["arch_window_top"], ["arch_window_bottom"]], 2, 2)
    r.wall([["arch_window_top"], ["arch_window_bottom"]], 8, 2)
    r.one("plant", 1, 7)
    r.one("plant", 9, 7)
    r.staff(2, 3, 8, 4)
    MEL.keeper(r, "white-magic", "white_mage", 6, 4, ["Healing words, for a town that needs them. Learn them well."],
               "melmond_white")
    out.append(r.save(note("a white magic shop like a small chapel, a white orb in an alcove", "two arched windows "
                           "on either side of the orb's alcove; a carpet from the door to the counter"),
                      {"floor_stone": "marble", "in_wall_face": STONE_FACE}, [210, 215, 230], music=SHOP))

    # black magic: a low, dark room; the counter in the north-west corner, shelves of ink and bone
    r = MEL.shop("melmond-black-magic", "Black Magic Shop", 10, 9, [7], "black_magic")
    g = r.g
    g.carve(1, 3, 8, 7, "-")
    g.carve(1, 5, 4, 5, "c")
    g.carve(6, 5, 7, 6, "+")
    r.open_exit("-")
    g.faces(2)
    r.wall([["torch"]], 6, 1)
    r.wall([["potion_shelf"]], 2, 1)
    r.one("orb_black", 8, 3)
    r.tall("bookshelf", 7, 3)
    r.tall("bookshelf", 4, 3)                         # closes the keeper's corner above the counter's east end
    r.thing("crate", 1, 7)
    r.staff(1, 3, 3, 4)
    MEL.keeper(r, "black-magic", "black_mage", 2, 4, ["The rot has made folk curious about darker arts. Choose "
               "carefully."], "melmond_black")
    out.append(r.save(note("a black magic shop, low and dark, its counter boxing in the north-west corner",
                           "a bookshelf that closes the keeper's corner; a black orb beside a second tall bookshelf"),
                      {"floor_stone": "floor_stone", "in_wall_face": {"from": "castle_face", "shade": 0.5},
                       "in_wall_top": SLATE_TOP}, [110, 60, 140], music=SHOP))

    # the inn: a taproom with the counter by the door, a dormitory of beds through an inner doorway on the west
    r = MEL.shop("melmond-inn", "Inn", 13, 10, [8], "inn")
    g = r.g
    g.carve(1, 3, 4, 8, "_")                          # the dormitory
    g.carve(6, 3, 11, 8, "_")                         # the taproom
    g.carve(5, 6, 5, 7, "_")
    g.carve(9, 5, 11, 5, "c")
    g.carve(6, 7, 8, 8, "+")
    r.open_exit()
    g.faces(2)
    for (x, y) in [(1, 3), (3, 3), (1, 6), (3, 6)]:
        r.tall("bed", x, y)
    r.wall([["window_in"]], 10, 1)
    r.fireplace(6, 1)
    r.one("table", 7, 4)
    r.thing("barrel", 11, 8)
    r.thing("barrel", 11, 7)
    r.staff(9, 3, 11, 4)
    MEL.keeper(r, "inn", "innkeeper", 10, 4, ["Beds are clean and the soup is mostly turnip. Stay the night?"],
               "melmond_inn")
    r.npcs[-1]["action"] = "inn"
    r.npc("melmond_inn_drinker", "burgher", 8, 6, [
        {"condition": "EARTH_CRYSTAL_LIT", "text": ["Drink up! The vintner's opened his last good cask to celebrate."]},
        {"text": ["Nothing to do but sit. The fields don't need us when nothing grows in them."]}])
    out.append(r.save(note("an inn: a taproom with a hearth and the counter, a dormitory through a doorway",
                           "four beds in a west dormitory; the counter tucked in the taproom's north-east corner",
                           "two rooms joined by an inner doorway; the door is the only way in or out"),
                      {"floor": wood(0.9), "in_wall_face": "castle_face"}, [150, 110, 50], music=SHOP))
    return out
