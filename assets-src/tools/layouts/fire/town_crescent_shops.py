"""Crescent Lake's five shops and the inn (docs/WORLD_PLAN.md 4.0.1, 4.4; FIR-T), original counter plans; the keepers
stand behind their counters and sell the `crescent_*` records of shops.yaml (FIR-T anchor; band B5). Each header
carries its design note. Written by `town_crescent_rooms.py`.
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))
from interiors_common import SHOP, STONE_FACE, SLATE_TOP, wood  # noqa: E402
from town_crescent_homes import CRESCENT, note, said  # noqa: E402

SHOP_ROOM = ("Topology: one room, no stairs: the door on the south wall; the keeper stands behind the counter, out "
             "of reach. No boss.")


def build() -> list[Path]:
    out: list[Path] = []
    # weapon shop: a counter across the north-west, blades on the wall, a whetstone bench by the door
    r = CRESCENT.shop("crescent-weapon-shop", "Weapon Shop", 12, 9, [8], "weapon_shop")
    g = r.g
    g.carve(1, 3, 10, 7, "-")
    g.carve(1, 5, 6, 5, "c")
    r.open_exit("-")
    g.faces(2)
    for x in (1, 2, 4, 5):
        r.wall([["weapon_rack"]], x, 1)
    r.wall([["window_in"]], 8, 1)
    r.one("armor_stand", 6, 3)                        # the stand and a crate close the keeper's corner
    r.thing("crate", 6, 4)
    r.one("table", 9, 3)
    r.thing("barrel", 10, 7)
    r.staff(1, 3, 5, 4)
    CRESCENT.keeper(r, "weapon-shop", "merchant", 3, 4, said(
        ["Steel for paddlers! A sword weighs less than you'd fear in a canoe. Mostly."],
        ["Flame-forged blades came in from the south traders this week. Fitting, with the volcano grumbling."],
        ["Scholars buy pen-knives. Pilgrims buy staves. You look like you'd buy something with an edge."]),
        "crescent_weapon")
    out.append(r.save(note("Crescent's weapon shop: a counter closes the north-west corner, racks of blades on the "
                           "wall behind it.",
                           "the keeper's corner closed by an armour stand and a crate; a testing table under the "
                           "east window; the door at the room's east end", SHOP_ROOM),
                      {"floor_stone": "floor_stone", "in_wall_face": {"from": "castle_face", "shade": 0.7}},
                      music=SHOP))

    # armor shop: an L of counters round the keeper, robes and mail on stands along the south wall
    r = CRESCENT.shop("crescent-armor-shop", "Armor Shop", 12, 9, [2], "armor_shop")
    g = r.g
    g.carve(1, 3, 10, 7, "_")
    g.carve(6, 5, 10, 5, "c")
    g.carve(6, 3, 6, 4, "c")
    r.open_exit()
    g.faces(2)
    for x in (7, 9):
        r.wall([["banner"]], x, 1)
    r.wall([["window_in"]], 3, 1)
    for x in (4, 6, 8, 10):
        r.one("armor_stand", x, 7)
    r.one("plant", 1, 3)
    r.staff(7, 3, 10, 4)
    CRESCENT.keeper(r, "armor-shop", "merchant", 8, 4, [
        "Mythril, robes for the gifted, armlets for the quick. The lake damp never gets into my stock."],
        "crescent_armor")
    out.append(r.save(note("Crescent's armour shop: an L of counters walls the keeper into the north-east corner; "
                           "stands of robes and mail along the south wall.",
                           "an L-shaped counter round the keeper's bay; four armour stands in a row by the door "
                           "wall; banners of the scholars' colleges above the counter", SHOP_ROOM),
                      {"floor": wood(0.8), "in_wall_face": STONE_FACE}, music=SHOP))

    # item shop: a counter down the middle, shelves of tonics on the back wall, barrels by the door
    r = CRESCENT.shop("crescent-item-shop", "Item Shop", 11, 9, [5], "item_shop")
    g = r.g
    g.carve(1, 3, 9, 7, "_")
    g.carve(1, 5, 9, 5, "c")
    r.open_exit()
    g.faces(2)
    for x in (2, 3, 7, 8):
        r.wall([["potion_shelf"]], x, 1)
    r.wall([["window_in"]], 5, 1)
    r.thing("barrel", 4, 7)
    r.thing("crate", 6, 7)
    r.one("plant", 2, 7)
    r.staff(1, 3, 9, 4)
    CRESCENT.keeper(r, "item-shop", "merchant", 5, 4, said(
        ["A cabin for the far shore? Potions for the river mouths? You'll want both, if you're going where I think."],
        ["Potions, ethers, a phoenix down for the brave. Business is brisk since the earth woke up."],
        ["Potions and ethers. The scholars buy ethers to stay awake over their books. It's not what they're for."]),
        "crescent_item")
    out.append(r.save(note("Crescent's item shop: a counter wall to wall across the room, tonic shelves behind it.",
                           "a counter that runs the full width of the room; shelves of tonics either side of the "
                           "window; stores in barrels by the door", SHOP_ROOM),
                      {"floor": wood(1.1), "in_wall_face": {"from": STONE_FACE, "shade": 1.1}}, music=SHOP))

    # white magic: a pale reading room, the keeper behind a counter under the arched window
    r = CRESCENT.shop("crescent-white-magic", "White Magic Shop", 11, 10, [5], "white_magic")
    g = r.g
    g.carve(1, 3, 9, 8, "-")
    g.carve(3, 5, 7, 5, "c")
    g.carve(1, 6, 9, 8, "+")
    r.open_exit("+")
    g.faces(2)
    r.wall([["arch_window_top"], ["arch_window_bottom"]], 5, 1)
    r.one("orb_white", 3, 3)
    r.one("orb_white", 7, 3)                          # the orbs close the counter's ends
    r.one("plant", 3, 4)
    r.one("plant", 7, 4)
    r.one("lectern", 1, 3)
    r.one("plant", 9, 3)
    r.staff(4, 3, 6, 4)
    CRESCENT.keeper(r, "white-magic", "white_mage", 5, 4, [
        "The deep healing, and the words that call the fallen back. Taught here to those the Circle would trust."],
        "crescent_white")
    out.append(r.save(note("Crescent's white magic shop: the keeper's bay between two white orbs under an arched "
                           "window, a carpet for the waiting pupils.",
                           "a short counter whose bay is closed by two white orbs and plants; a lectern of "
                           "spell-books on the customers' side; a wide carpet before the counter", SHOP_ROOM),
                      {"floor_stone": "marble", "in_wall_face": STONE_FACE}, [200, 200, 230], music=SHOP))

    # black magic: a dark room, the counter in the south-east, a ring of black orbs
    r = CRESCENT.shop("crescent-black-magic", "Black Magic Shop", 12, 9, [2], "black_magic")
    g = r.g
    g.carve(1, 3, 10, 7, "-")
    g.carve(6, 5, 10, 5, "c")
    r.open_exit("-")
    g.faces(2)
    r.wall([["torch"]], 3, 1)
    r.wall([["torch"]], 9, 1)
    r.one("orb_black", 6, 3)
    r.one("orb_black", 6, 4)                          # the orbs close the keeper's bay
    r.one("orb_black", 10, 3)
    r.tall("bookshelf", 1, 3)
    r.one("desk", 3, 3)
    r.thing("crate", 10, 7)
    r.staff(7, 3, 10, 4)
    CRESCENT.keeper(r, "black-magic", "black_mage", 8, 4, said(
        ["Fire's third word and the warp that takes you home. Use them on the far rivers, not on my shop."],
        ["Fire, the third and fiercest. The volcano woke, and suddenly everyone wants to fight fire with fire."],
        ["The third fire, slow time, the stone breath, the warp. Strong words. The sages make me check your eyes."]),
        "crescent_black")
    out.append(r.save(note("Crescent's black magic shop: a torch-lit room with the counter across its east half "
                           "and black orbs ringing the keeper.",
                           "two black orbs that close the keeper's bay, a third in its corner; a reading desk and "
                           "a bookshelf on the customers' side; torches for light", SHOP_ROOM),
                      {"floor_stone": "floor_stone", "floor": wood(0.6),
                       "in_wall_face": {"from": "castle_face", "shade": 0.45}, "in_wall_top": SLATE_TOP},
                      [90, 50, 140], music=SHOP))

    # the inn: a common room with the counter by the stair corner, a dormitory behind a partition
    r = CRESCENT.shop("crescent-inn", "Inn", 14, 11, [3], "inn")
    g = r.g
    g.carve(1, 3, 12, 5, "_")                         # the dormitory
    g.carve(1, 7, 12, 9, "_")                         # the common room
    g.carve(2, 6, 2, 6, "_")                          # the opening in the partition
    g.carve(8, 8, 12, 8, "c")
    g.carve(1, 8, 4, 9, "+")
    r.open_exit("+")
    g.faces(2)
    for x in (2, 4, 6, 8):
        r.tall("bed", x, 3)
    r.wall([["window_in"]], 5, 1)
    r.wall([["window_in"]], 10, 1)
    r.one("table", 2, 8)
    r.one("table", 3, 8)
    r.thing("barrel", 12, 3)
    r.thing("crate", 8, 7)                            # closes the keeper's side of the counter
    r.thing("barrel", 12, 9)
    r.staff(9, 7, 12, 7)
    CRESCENT.keeper(r, "inn", "innkeeper", 10, 7, said(
        ["The canoe-bearers! A bed is 300 G, as for anyone, but I'll put the lake view in for free."],
        ["300 G a night. Pilgrims fill the dormitory these days; I've kept the best beds for the likes of you."],
        ["A bed for 300 G. Quiet guaranteed: half my guests are scholars and the other half are asleep."]),
        "crescent_inn")
    r.npc("inn_scholar", "mage", 6, 9, said(
        ["Someone at the bar swore you'd been to the Circle and back. I said nonsense. Well. Here you are."],
        ["Drink to the earth crystal! Gently. This is Crescent Lake: we toast in whispers."],
        ["I came for a month of study three years ago. The inn's porridge keeps me."]))
    out.append(r.save(note("Crescent's inn: a common room with the counter in the east corner, and a dormitory "
                           "behind a partition with one opening.",
                           "a partition wall with a single opening at its west end into the dormitory; four beds in "
                           "a row; a carpeted corner by the door with a long table for the scholars",
                           "Topology: two rooms, no stairs: the door on the south wall into the common room; the "
                           "dormitory through the partition's west opening. No boss."),
                      {"floor": wood(0.85), "in_wall_face": "castle_face"}, [60, 90, 130], music=SHOP))
    return out
