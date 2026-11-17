"""Pravoka's five shops and the inn (docs/WORLD_PLAN.md 4.0.1, 4.1; A1-T), original counter plans; the keepers stand
behind their counters and sell the `pravoka_*` records of shops.yaml (A1-T anchor). Each header carries its design
note. Written by `town_pravoka_rooms.py`.
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))
from interiors_common import SHOP, STONE_FACE, SLATE_TOP, wood  # noqa: E402
from town_pravoka_homes import PRAVOKA, note, said  # noqa: E402

SHOP_ROOM = ("Topology: one room, no stairs: the door on the south wall; the keeper stands behind the counter, out "
             "of reach. No boss.")


def build() -> list[Path]:
    out: list[Path] = []
    # weapon shop: a counter across the east half, cutlasses on the racks behind, a grindstone corner by the door
    r = PRAVOKA.shop("pravoka-weapon-shop", "Weapon Shop", 12, 9, [3], "weapon_shop")
    g = r.g
    g.carve(1, 3, 10, 7, "-")
    g.carve(6, 5, 10, 5, "c")
    r.open_exit("-")
    g.faces(2)
    for x in (6, 7, 9, 10):
        r.wall([["weapon_rack"]], x, 1)
    r.wall([["window_in"]], 2, 1)
    r.wall([["torch"]], 8, 1)
    r.one("armor_stand", 1, 3)
    r.one("armor_stand", 5, 3)                        # the stands close the keeper's corner
    r.one("armor_stand", 5, 4)
    r.thing("barrel", 1, 7)
    r.thing("crate", 10, 7)
    r.one("table", 3, 3)
    r.staff(6, 3, 10, 4)
    PRAVOKA.keeper(r, "weapon-shop", "merchant", 8, 4, [
        "Blades and axes, honest steel. The pirates buy here too, but they don't haggle as nicely as you."],
        "pravoka_weapon")
    out.append(r.save(note("Pravoka's weapon shop: a counter across the east half of the room, racks of blades "
                           "behind it.",
                           "a counter that closes the east half; a table by the window for testing edges; "
                           "two armour stands that close the keeper's corner", SHOP_ROOM),
                      {"floor_stone": "floor_stone", "in_wall_face": {"from": "castle_face", "shade": 0.75}},
                      music=SHOP))

    # armor shop: two short counters flank the keeper's bay; shields hung over the back wall
    r = PRAVOKA.shop("pravoka-armor-shop", "Armor Shop", 11, 9, [5], "armor_shop")
    g = r.g
    g.carve(1, 3, 9, 7, "_")
    g.carve(2, 4, 8, 4, "c")
    r.open_exit()
    g.faces(2)
    for x in (2, 4, 6, 8):
        r.wall([["banner"]], x, 1)
    r.wall([["window_in"]], 5, 1)
    for (x, y) in [(1, 3), (9, 3), (1, 6), (9, 6)]:
        r.one("armor_stand", x, y)
    r.thing("crate", 1, 7)
    r.staff(2, 3, 8, 3)
    PRAVOKA.keeper(r, "armor-shop", "merchant", 5, 3, said(
        ["Chain and shields for a crew that beat Bikke's nine! You'll be wanting the best."],
        ["Armour, friends? Chain mail turns a cutlass, mostly. Ask any pirate who's met the town watch. No, wait."]),
        "pravoka_armor")
    out.append(r.save(note("Pravoka's armour shop: the keeper's counter across the back, mail on stands down both "
                           "walls.",
                           "a counter across the back with stands in all four corners; banners of the old "
                           "harbour guilds on the back wall", SHOP_ROOM),
                      {"floor": wood(0.85), "in_wall_face": STONE_FACE}, music=SHOP))

    # item shop: a corner counter by the window, shelves of tonics, a sea chest of spares
    r = PRAVOKA.shop("pravoka-item-shop", "Item Shop", 10, 8, [2], "item_shop")
    g = r.g
    g.carve(1, 2, 8, 6, "_")
    g.carve(5, 4, 8, 4, "c")
    r.open_exit()
    g.faces(1)
    for x in (5, 6, 7, 8):
        r.wall([["potion_shelf"]], x, 1)
    r.wall([["window_in"]], 2, 1)
    r.one("plant", 1, 2)
    r.one("plant", 4, 2)                              # the plant and a crate close the counter's open end
    r.thing("crate", 4, 3)
    r.thing("barrel", 1, 6)
    r.thing("crate", 8, 6)
    r.thing("barrel", 7, 6)
    r.staff(5, 2, 8, 3)
    PRAVOKA.keeper(r, "item-shop", "merchant", 6, 3, [
        "Potions, antidotes, a tent for the road. Salt air rots most things, but not my stock."], "pravoka_item")
    out.append(r.save(note("Pravoka's item shop: a counter in the east corner before shelves of tonics.",
                           "a counter cut short to a corner bay; barrels of salted stores by the door; tonic "
                           "shelves over the counter", SHOP_ROOM),
                      {"floor": wood(1.1), "in_wall_face": {"from": STONE_FACE, "shade": 1.05}}, music=SHOP))

    # white magic: a pale chapel-shop, the counter before a single white orb, a lamp for sailors' prayers
    r = PRAVOKA.shop("pravoka-white-magic", "White Magic Shop", 10, 9, [3], "white_magic")
    g = r.g
    g.carve(1, 3, 8, 7, "-")
    g.carve(4, 5, 8, 5, "c")
    g.carve(1, 6, 3, 7, "+")
    r.open_exit("+")
    g.faces(2)
    r.wall([["arch_window_top"], ["arch_window_bottom"]], 6, 1)
    r.wall([["window_in"]], 2, 1)
    r.one("orb_white", 8, 3)
    r.one("plant", 3, 3)                              # two plants close the counter's west end
    r.one("plant", 3, 4)
    r.one("plant", 1, 3)
    r.staff(4, 3, 8, 4)
    PRAVOKA.keeper(r, "white-magic", "white_mage", 6, 4, [
        "Light and quiet, for those with the gift. Every sailor here learns one prayer before he learns to swim."],
        "pravoka_white")
    out.append(r.save(note("Pravoka's white magic shop: a pale room where the counter guards one white orb under "
                           "an arched window.",
                           "a counter that runs to the east wall; a single orb in the keeper's bay; a blue "
                           "rug in the waiting corner by the door", SHOP_ROOM),
                      {"floor_stone": "marble", "in_wall_face": STONE_FACE}, [180, 200, 230], music=SHOP))

    # black magic: a cellar-dark room, the counter to the west, black orbs on the far side
    r = PRAVOKA.shop("pravoka-black-magic", "Black Magic Shop", 11, 9, [7], "black_magic")
    g = r.g
    g.carve(1, 3, 9, 7, "-")
    g.carve(1, 5, 5, 5, "c")
    r.open_exit("-")
    g.faces(2)
    r.one("orb_black", 1, 3)
    r.one("orb_black", 5, 3)
    r.wall([["torch"]], 3, 1)
    r.wall([["torch"]], 8, 1)
    r.tall("bookshelf", 9, 3)
    r.one("desk", 6, 3)                               # the desk and a crate close the keeper's bay
    r.thing("crate", 6, 4)
    r.thing("crate", 9, 7)
    r.staff(1, 3, 5, 4)
    PRAVOKA.keeper(r, "black-magic", "black_mage", 3, 4, said(
        ["Ice and darkness, sold to the ones who beat the Captain. My best customers pay in deeds."],
        ["Frost for the hand, shadow for the eyes. Bikke's crew won't buy. They say spells are cheating."]),
        "pravoka_black")
    out.append(r.save(note("Pravoka's black magic shop: a dark room with the counter on the west side and black "
                           "orbs behind it.",
                           "two black orbs at either end of the keeper's bay; a reading desk and a bookshelf "
                           "on the customers' side; torches as the only light", SHOP_ROOM),
                      {"floor_stone": "floor_stone", "floor": wood(0.65),
                       "in_wall_face": {"from": "castle_face", "shade": 0.45}, "in_wall_top": SLATE_TOP},
                      [100, 60, 150], music=SHOP))

    # the inn: a taproom with the counter by the hearth, a row of bunks up a step in the loft room
    r = PRAVOKA.shop("pravoka-inn", "Inn", 13, 11, [9], "inn")
    g = r.g
    g.carve(1, 3, 11, 5, "_")                         # the bunk room
    g.carve(1, 7, 11, 9, "_")                         # the taproom
    g.carve(2, 6, 2, 6, "_")                          # the step up between them
    g.carve(8, 8, 11, 8, "c")
    g.carve(8, 9, 10, 9, "+")
    r.open_exit("+")
    g.faces(2)
    for x in (4, 6, 8, 10):
        r.tall("bed", x, 3)
    r.wall([["window_in"]], 3, 1)
    r.wall([["window_in"]], 7, 1)
    r.one("plant", 1, 3)
    r.one("table", 3, 8)
    r.one("table", 4, 8)
    r.thing("barrel", 1, 9)
    r.thing("barrel", 11, 7)
    r.thing("crate", 1, 7)
    r.thing("crate", 7, 7)                            # closes the keeper's side of the counter
    r.staff(8, 7, 10, 7)
    PRAVOKA.keeper(r, "inn", "innkeeper", 9, 7, said(
        ["The pirates' beds are free at last, and the sheets washed twice! 50 G a night, for heroes or anyone."],
        ["A bed for 50 G. The best beds are the Captain's crew's. You'll get the second best, and be glad of it."]),
        "pravoka_inn")
    r.npc("inn_patron", "villager", 4, 9, said(
        ["Drinks are on the house tonight! Well, the house says they're on you. Close enough."],
        ["Keep your voice down. Half the drinkers in here answer to Bikke."]))
    out.append(r.save(note("Pravoka's inn: a taproom with the counter in the east corner, and a bunk room up a "
                           "step behind it.",
                           "the counter in the taproom's east corner by the door; a bunk room reached up a "
                           "step at its west end; a long table where the crews drink",
                           "Topology: two rooms, no stairs: the door on the south wall into the taproom; the "
                           "bunk room up a step at the west end. No boss."),
                      {"floor": wood(0.8), "in_wall_face": "castle_face"}, [130, 60, 50], music=SHOP))
    return out
