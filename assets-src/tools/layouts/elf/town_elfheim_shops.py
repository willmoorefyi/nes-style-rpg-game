"""Elfheim's five shops and its inn (docs/WORLD_PLAN.md 4.0.1, 4.2, 3.6 B3; ELF-T), original plans ->
assets-src/maps/elfheim-{weapon-shop,armor-shop,item-shop,white-magic,black-magic,inn}.yaml.

  python3 -I assets-src/tools/layouts/elf/town_elfheim_rooms.py

Each keeper stands behind a counter whose ends meet the walls, so the keeper's side is out of reach (M3/M4); the
records `elfheim_*` are in shops.yaml's ELF-T anchor (B3 stock, the inn at 100). The keepers' greetings change once
the prince wakes.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parent))
from interiors_common import SHOP, STONE_FACE, wood  # noqa: E402
from town_elfheim_homes import ELFHEIM, LEAF, note  # noqa: E402
from town_elfheim_people import AWAKE, ELF  # noqa: E402



def keeper(r, slug: str, sprite: str, x: int, y: int, line: str, awake: str, shop: str, **kw) -> None:
    ELFHEIM.keeper(r, slug, sprite, x, y, line, shop)
    r.npcs[-1].update({"dialog": [{"condition": AWAKE, "text": [awake]}, {"text": [line]}], "tint": ELF, **kw})


def build() -> list[Path]:
    out: list[Path] = []
    # weapons: blades laid on a long counter, racks behind the smith
    r = ELFHEIM.shop("elfheim-weapon-shop", "Weapon Shop", 11, 9, [5], "weapon_shop")
    g = r.g
    g.carve(1, 3, 9, 7, "-")
    g.carve(1, 5, 9, 5, "c")
    r.open_exit("-")
    g.faces(2)
    for x in (2, 5, 8):
        r.wall([["weapon_rack"]], x, 1)
    r.one("armor_stand", 1, 7)
    r.one("plant", 9, 7)
    r.staff(1, 3, 9, 4)
    keeper(r, "weapon", "warrior", 5, 4, "Mithril, folded and leaf-light. Elven steel bites deep and never rusts.",
           "Good blades for good days. The prince took the first sword I made this year.", "elfheim_weapon")
    out.append(r.save(note("the weapon shop, mithril blades laid on a counter across the room",
                           "three weapon racks behind the counter; an armour stand by the door"),
                      {"floor_stone": {"from": "floor_stone", "shade": 0.95}, **LEAF}, [150, 150, 170], music=SHOP))

    # armour: mail on stands to the west, the counter turned along the east wall
    r = ELFHEIM.shop("elfheim-armor-shop", "Armor Shop", 12, 9, [3], "armor_shop")
    g = r.g
    g.carve(1, 3, 10, 7, "_")
    g.carve(8, 3, 8, 7, "c")
    r.open_exit()
    g.faces(2)
    for x in (1, 3, 5):
        r.one("armor_stand", x, 3)
    r.wall([["window_in"]], 4, 1)
    r.one("plant", 1, 7)
    r.staff(9, 3, 10, 7)
    keeper(r, "armor", "knight", 9, 5, "Silver armlets, mithril mail, shields that ring like bells. Try them on.",
           "The castle guard re-armed this week. I sold out twice and stitched all night.", "elfheim_armor")
    out.append(r.save(note("the armour shop, mail on three stands, the counter along the east wall",
                           "a counter running north-south with the keeper behind it; stands in a row by the window"),
                      {"floor": wood(0.9), **LEAF}, [170, 160, 120], music=SHOP))

    # items: a narrow shop of shelves round a corner counter
    r = ELFHEIM.shop("elfheim-item-shop", "Item Shop", 10, 9, [6], "item_shop")
    g = r.g
    g.carve(1, 3, 8, 7, "_")
    g.carve(1, 5, 4, 5, "c")
    g.carve(4, 3, 4, 4, "c")
    r.open_exit()
    g.faces(2)
    for x in (6, 7, 8):
        r.wall([["potion_shelf"]], x, 1)
    r.thing("barrel", 8, 7)
    r.thing("crate", 1, 7)
    r.staff(1, 3, 3, 4)
    keeper(r, "item", "vendor_f", 2, 4, "Potions brewed in the spring's own water. Tents that pitch themselves, nearly.",
           "Business is brisk! Everyone's going on journeys now the prince is up.", "elfheim_item")
    out.append(r.save(note("the item shop, a corner counter boxing the keeper into the north-west",
                           "an L-shaped counter; three shelves of bottles on the east wall"),
                      {"floor": wood(1.1), **LEAF}, [180, 150, 90], music=SHOP))

    # white magic: a round-cornered room, a font of light behind the counter
    r = ELFHEIM.shop("elfheim-white-magic", "White Magic", 11, 10, [5], "white_magic")
    g = r.g
    g.carve(1, 3, 9, 8, "-")
    g.carve(1, 5, 9, 5, "c")
    g.carve(4, 6, 6, 8, "+")
    r.open_exit("+")
    g.faces(2)
    r.one("orb_white", 5, 3)
    r.wall([["arch_window_top"], ["arch_window_bottom"]], 2, 1)
    r.wall([["arch_window_top"], ["arch_window_bottom"]], 8, 1)
    r.one("plant", 1, 8)
    r.one("plant", 9, 8)
    r.staff(1, 3, 9, 4)
    keeper(r, "white-magic", "white_wizard", 3, 4, "Songs of mending, written in leaf-script. Learn them, and heal.",
           "I sang at the prince's bedside every night for a year. The witch's herb was quicker.", "elfheim_white")
    out.append(r.save(note("the white magic shop, a white orb on a plinth behind the counter",
                           "two arched windows framing the orb; a carpet run from the door to the counter"),
                      {"floor_stone": "marble", "in_wall_face": STONE_FACE}, [220, 230, 210], music=SHOP))

    # black magic: a low room, the counter set across a corner nook
    r = ELFHEIM.shop("elfheim-black-magic", "Black Magic", 11, 9, [2], "black_magic")
    g = r.g
    g.carve(1, 3, 9, 7, "-")
    g.carve(6, 3, 6, 5, "c")
    g.carve(7, 5, 9, 5, "c")
    r.open_exit("-")
    g.faces(2)
    r.one("orb_black", 9, 3)
    r.wall([["torch"]], 2, 1)
    r.tall("bookshelf", 3, 3)
    r.one("table", 1, 6)
    r.staff(7, 3, 9, 4)
    keeper(r, "black-magic", "black_wizard", 8, 4, "Words that burn and words that freeze. Use them on the dark, not the "
           "woods.", "A dark elf cursed our prince. Every spell I sell now, I sell with pleasure.", "elfheim_black")
    out.append(r.save(note("the black magic shop, a dim room with the keeper boxed into the north-east nook",
                           "a counter bent round a corner nook; a black orb glowing in the nook"),
                      {"floor_stone": "floor_stone", "in_wall_face": {"from": "castle_face", "shade": 0.5}},
                      [80, 90, 70], music=SHOP))

    # the inn: a taproom with a hearth, the beds through an inner doorway
    r = ELFHEIM.shop("elfheim-inn", "Inn", 14, 11, [4], "inn")
    g = r.g
    g.carve(1, 3, 7, 9, "_")                    # the taproom
    g.carve(9, 3, 12, 9, "_")                   # the bed room
    g.carve(8, 7, 8, 8, "_")
    g.carve(1, 5, 4, 5, "c")
    g.carve(2, 7, 6, 8, "+")
    r.open_exit()
    g.faces(2)
    r.fireplace(5, 1)
    for x in (10, 12):
        r.tall("bed", x, 3)
    r.tall("bed", 10, 6)
    r.one("table", 7, 3)
    r.one("plant", 12, 9)
    r.staff(1, 3, 4, 4)
    keeper(r, "inn", "innkeeper", 2, 4, "Beds of moss and linen, a hundred gold the night. You'll sleep like... well, not "
           "like the prince, I hope.", "A hundred gold the night, and I can joke about sleep again. Rest well!",
           "elfheim_inn", action="inn")
    r.npc("elfheim_inn_guest", "burgher", 11, 8, [
        {"condition": AWAKE, "text": ["I came for the prince's funeral, frankly. I'm staying for the feast."]},
        {"text": ["I'm waiting for a ship to Pravoka. The innkeeper says there hasn't been one in a year."]}])
    out.append(r.save(note("an inn of two rooms, a taproom with a hearth and a bed room beyond",
                           "a hearth on the taproom's back wall; a bed room through an inner doorway",
                           "two rooms joined by an inner doorway; the door is the only way in or out"),
                      {"floor": wood(1.0), **LEAF}, [150, 120, 80], music=SHOP))
    return out


if __name__ == "__main__":
    for p in build():
        print(p)
