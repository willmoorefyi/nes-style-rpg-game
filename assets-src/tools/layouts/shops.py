"""Cornelia's six shops and the inn (IN-5), each with its own counter layout; the keepers stand behind it."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from interiors_common import SHOP, keeper, shop, wood, STONE_FACE, SLATE_TOP  # noqa: E402


def build() -> list[Path]:
    out: list[Path] = []
    # weapon shop: an L counter closing the corner where the keeper stands among the racks
    r = shop("cornelia-weapon-shop", "Weapon Shop", 11, 9, [7], "weapon_shop")
    g = r.g
    g.carve(1, 3, 9, 7, "_")
    g.carve(1, 5, 4, 5, "c")
    g.carve(5, 3, 5, 5, "c")
    r.open_exit()
    g.faces(2)
    for x in (1, 2, 3, 4):
        r.wall([["weapon_rack"]], x, 1)
    r.wall([["weapon_rack"]], 8, 1)
    r.wall([["window_in"]], 7, 1)
    r.wall([["torch"]], 6, 1)
    r.thing("barrel", 1, 3)
    r.thing("crate", 4, 3)
    r.one("armor_stand", 9, 3)
    r.thing("barrel", 9, 7)
    keeper(r, "weapon-shop", "merchant", 2, 4, "Welcome to the Weapon Shop!", "cornelia_weapon")
    out.append(r.save("The weapon shop: an L-shaped counter round the keeper's corner, racks of blades behind it.",
                      {"floor": wood(0.9), "in_wall_face": {"from": "castle_face", "shade": 0.85}}, music=SHOP))

    # armor shop: a counter across the back, stands on display in the middle of the floor
    r = shop("cornelia-armor-shop", "Armor Shop", 10, 9, [4, 5], "armor_shop")
    g = r.g
    g.carve(1, 3, 8, 7)
    g.carve(2, 4, 7, 4, "c")
    r.open_exit()
    g.faces(2)
    r.wall([["tapestry"]], 2, 1)
    r.wall([["tapestry"]], 7, 1)
    r.wall([["window_in"]], 4, 1)
    r.wall([["banner"]], 5, 1)
    for x in (1, 8):
        r.one("armor_stand", x, 3)
    for (x, y) in [(2, 6), (7, 6)]:
        r.one("armor_stand", x, y)
    r.thing("crate", 1, 7)
    r.thing("crate", 8, 7)
    keeper(r, "armor-shop", "merchant", 4, 3, "Welcome to the Armor Shop!", "cornelia_armor")
    out.append(r.save("The armor shop: a counter across the back and armour stands on the shop floor.",
                      {"floor_stone": "floor_stone", "floor": wood(1.0), "in_wall_face": STONE_FACE}, music=SHOP))

    # item shop: a short counter in front of shelves of potions, barrels and crates by the door
    r = shop("cornelia-item-shop", "Item Shop", 9, 8, [4], "item_shop")
    g = r.g
    g.carve(1, 2, 7, 6, "_")
    g.carve(3, 4, 5, 4, "c")
    r.open_exit()
    g.faces(1)
    for x in (2, 3, 5, 6):
        r.wall([["potion_shelf"]], x, 1)
    r.tall("bookshelf", 1, 2)
    r.tall("bookshelf", 7, 2)
    r.one("plant", 4, 2)
    for (x, y) in [(1, 6), (7, 5)]:
        r.thing("barrel", x, y)
    r.thing("crate", 7, 6)
    keeper(r, "item-shop", "merchant", 4, 3, "Welcome to the Item Shop!", "cornelia_item")
    out.append(r.save("The item shop: a short counter before shelves of potions.", {"floor": wood(1.1)}, music=SHOP))

    # white magic: the counter guards an alcove of white orbs under an arched window
    r = shop("cornelia-white-magic", "White Magic Shop", 10, 9, [4, 5], "white_magic")
    g = r.g
    g.carve(1, 4, 8, 7, "-")
    g.carve(3, 3, 6, 3, "-")                     # the orb alcove
    g.carve(2, 5, 7, 5, "c")
    g.carve(3, 6, 6, 7, "+")
    r.open_exit("+")
    g.faces(2)
    r.one("orb_white", 3, 3)
    r.one("orb_white", 6, 3)
    r.wall([["arch_window_top"], ["arch_window_bottom"]], 4, 1)
    r.wall([["arch_window_top"], ["arch_window_bottom"]], 5, 1)
    r.one("plant", 1, 4)
    r.one("plant", 8, 4)
    r.one("plant", 1, 7)
    r.one("plant", 8, 7)
    keeper(r, "white-magic", "mage", 4, 4,
           "Welcome to the White Magic Shop! Healing arts, for those with the gift.", "cornelia_white")
    out.append(r.save("The white magic shop: a counter before an alcove of white orbs.",
                      {"floor_stone": "marble", "in_wall_face": STONE_FACE}, [200, 210, 230], music=SHOP))

    # black magic: a dark room, the counter on the east, black orbs in a west niche
    r = shop("cornelia-black-magic", "Black Magic Shop", 11, 9, [6], "black_magic")
    g = r.g
    g.carve(3, 3, 9, 7, "-")
    g.carve(1, 4, 2, 6, "-")                     # the orb niche
    g.carve(6, 4, 9, 4, "c")
    g.carve(3, 5, 4, 6, "+")
    r.open_exit("-")
    g.faces(2)
    r.one("orb_black", 1, 4)
    r.one("orb_black", 1, 6)
    r.wall([["torch"]], 1, 3)
    r.wall([["torch"]], 4, 1)
    r.wall([["potion_shelf"]], 7, 1)
    r.wall([["potion_shelf"]], 8, 1)
    r.tall("bookshelf", 3, 3)
    r.one("desk", 9, 3)
    r.thing("crate", 9, 7)
    keeper(r, "black-magic", "mage", 7, 3,
           "Welcome to the Black Magic Shop! Destructive arts, for those with the nerve.", "cornelia_black")
    out.append(r.save("The black magic shop: a dark room, a counter on the east side and black orbs in a niche.",
                      {"floor_stone": "floor_stone", "floor": wood(0.7),
                       "in_wall_face": {"from": "castle_face", "shade": 0.5}, "in_wall_top": SLATE_TOP},
                      [120, 60, 160], music=SHOP))

    # inn: a front room with the counter, and a back room of beds through a doorway
    r = shop("cornelia-inn", "Inn", 12, 11, [6], "inn")
    g = r.g
    g.carve(1, 3, 10, 5, "_")                         # the back room of beds
    g.carve(1, 7, 10, 9, "_")                         # the front room
    g.carve(9, 6, 9, 6, "_")                          # the doorway between them
    g.carve(1, 8, 4, 8, "c")
    g.carve(1, 5, 8, 5, "+")                     # a runner along the foot of the beds
    g.carve(6, 8, 8, 9, "+")                     # the doormat rug
    r.open_exit("+")
    g.faces(2)
    for x in (1, 3, 5, 7):
        r.tall("bed", x, 3)
    r.wall([["window_in"]], 2, 1)
    r.wall([["window_in"]], 6, 1)
    r.one("plant", 10, 3)
    r.one("table", 10, 5)
    r.thing("barrel", 10, 9)
    r.one("plant", 5, 7)
    r.one("table", 9, 8)
    r.one("plant", 10, 7)
    r.thing("barrel", 1, 9)
    keeper(r, "inn", "innkeeper", 2, 7, "Welcome to the Inn!", "cornelia_inn")
    out.append(r.save("The inn: a front counter, and a back room of beds through a doorway.",
                      {"floor": wood(0.95)}, music=SHOP))
    return out
