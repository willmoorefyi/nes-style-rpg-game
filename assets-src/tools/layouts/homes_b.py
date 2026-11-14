"""Cornelia homes, part 2: the gardener, the family, the apprentice, the tavern and the shrine (CT-1)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from interiors_common import house, wood, SLATE_TOP, STONE_FACE  # noqa: E402


def build() -> list[Path]:
    out: list[Path] = []
    # (15,36) green / plaster: the gardener's lodge by the castle gardens, an L of potting room and parlour
    r = house("gardener", "Gardener's Lodge", 10, 9, [3])
    g = r.g
    g.carve(1, 3, 8, 5, "_")
    g.carve(1, 6, 5, 7, "_")
    g.carve(1, 3, 3, 7, "-")                     # the potting floor
    r.open_exit("-")
    g.faces(2)
    r.wall([["window_in"]], 4, 1)
    r.wall([["window_in"]], 7, 1)
    for (x, y) in [(1, 3), (2, 3), (1, 4)]:
        r.deco([["crops"]], x, y)
    for x in (5, 6):
        r.one("plant", x, 3)
    r.one("table", 6, 5)
    r.thing("barrel", 1, 7)
    for (x, y) in [(4, 7), (5, 7), (4, 6)]:
        r.thing("flowers", x, y)
    r.chest("gardener", "tent", "a Tent", 8, 5)
    r.npc("royal_gardener", "villager", 5, 5, [
        "Seedlings for the castle gardens. The princess chose every one herself.",
        "If you sleep out under the stars, a tent keeps the dew off. There's one in the chest. Go on."])
    out.append(r.save("The gardener's lodge by the castle gardens: a potting floor with seed racks, plants and flowers.",
                          {"floor": wood(1.1)}))

    # (14,63) red / white: a family home, a living room and a bedroom joined by an inner door
    r = house("family", "Family Home", 13, 10, [3])
    g = r.g
    g.carve(1, 3, 6, 8, "_")                          # living room
    g.carve(8, 3, 11, 8, "_")                         # bedroom
    g.carve(7, 7, 7, 8, "_")                          # inner doorway
    g.carve(9, 6, 10, 7, "+")
    g.carve(2, 6, 4, 7, "+")                     # the hearth rug
    r.open_exit()
    g.faces(2)
    r.wall([["window_in"]], 2, 1)
    r.wall([["window_in"]], 5, 1)
    r.wall([["window_in"]], 10, 1)
    r.fireplace(3, 1)
    r.one("table", 3, 5)
    r.one("table", 4, 5)
    r.one("plant", 1, 3)
    r.thing("barrel", 6, 3)
    r.tall("bed", 8, 3)
    r.tall("bed", 11, 3)
    r.tall("bookshelf", 10, 3)
    r.one("plant", 11, 8)
    r.npc("mother", "villager_f", 5, 7, [
        {"condition": "PRINCESS_RESCUED", "text": ["The children won't stop playing 'Warriors of Light' in the yard now."]},
        {"text": ["The children have been afraid of the dark since the princess was taken.",
                  "Bring her home, and maybe the whole city will sleep again."]}])
    r.npc("grandfather", "old_man", 9, 5, [
        "In my day the bridge to the north was always open. Ships came in, too, from the east.",
        "Mind you rest at the inn before a long road. Hurt is easier to mend than to carry."])
    out.append(r.save("A family home: a living room with a hearth and a bedroom beyond an inner door.",
                          {"floor": wood(0.9)}, [200, 160, 70]))

    # (6,41) teal / plaster: the apprentice mage's room, orbs in a niche
    r = house("apprentice", "Apprentice's Room", 9, 9, [4])
    g = r.g
    g.carve(1, 4, 7, 7, "_")
    g.carve(3, 3, 5, 3, "_")                          # the orb niche
    g.carve(3, 5, 5, 6, "+")                          # a teal casting rug
    r.open_exit()
    g.faces(2)
    r.one("orb_black", 3, 3)
    r.one("table", 4, 3)
    r.one("orb_white", 5, 3)
    r.wall([["potion_shelf"]], 1, 2)
    r.wall([["potion_shelf"]], 7, 2)
    r.wall([["arch_window_top"], ["arch_window_bottom"]], 4, 1)
    r.tall("bookshelf", 7, 4)
    r.one("desk", 1, 5)
    r.one("plant", 7, 7)
    r.chest("apprentice", "ether", "an Ether", 1, 7)
    r.npc("apprentice", "mage", 2, 4, [
        "A spell isn't cast from nothing. Each level has its own charges, and sleep restores them.",
        "Spend the strong ones on the strong foes. And an ether brings charges back, too. I keep one for emergencies."])
    out.append(r.save("An apprentice mage's room: a niche of orbs, potion shelves and a bookshelf.",
                          {"floor": wood(0.85), "in_wall_face": {"from": "castle_face", "shade": 0.6},
                           "in_wall_top": SLATE_TOP}, [90, 170, 170]))

    # (46,60) blue / ochre: the tavern, a bar along the west wall, banquet tables and a hearth
    r = house("tavern", "The Crystal Tankard", 14, 10, [6, 7])
    g = r.g
    g.carve(1, 3, 12, 8, "_")
    g.carve(1, 5, 4, 5, "c")                     # the bar
    r.open_exit()
    g.faces(2)
    for x in (1, 2, 3):
        r.wall([["potion_shelf"]], x, 1)
    r.fireplace(10, 1)
    r.wall([["window_in"]], 6, 1)
    r.wall([["banner"]], 8, 1)
    for (x, kind) in [(1, "barrel"), (3, "barrel"), (4, "crate")]:
        r.thing(kind, x, 3)
    g.carve(9, 3, 12, 4, "+")                    # a rug before the hearth
    for (x, y) in [(6, 4), (6, 7), (9, 7)]:
        r.deco([["banquet_l", "banquet_r"]], x, y)
    r.one("table", 12, 4)
    r.one("table", 1, 8)
    r.one("table", 3, 8)
    for (x, y, kind) in [(12, 8, "barrel"), (12, 7, "barrel"), (11, 8, "crate"), (5, 3, "barrel"), (5, 4, "crate")]:
        r.thing(kind, x, y)
    r.one("plant", 12, 3)
    r.npc("barkeep", "merchant", 2, 4, [
        "Welcome to the Crystal Tankard! Nothing's poured on credit, but the stories are free.",
        "Talk to the regulars. Half of what they say is true."])
    r.npc("patron_hunter", "villager", 8, 5, [
        "Out past the east bridge there's a clearing with an old stone tomb.",
        "Nobody knows who lies there. My grandfather swore it was a hero from before the crystals dimmed."])
    r.npc("patron_soldier", "guard", 11, 6, [
        {"condition": "INTRO_COMPLETE", "text": ["The King has the builders out at the north bridge. Won't be long now."]},
        {"text": ["Off duty. Don't tell the captain.",
                  "Garland's men say the temple to the north-west is crawling with wolves and worse."]}])
    out.append(r.save("The tavern: a bar with a barkeep behind it, banquet tables, barrels and a hearth.",
                          {"floor": wood(0.7)}))

    # (35,62) red / stone, 2 storeys: the wayside shrine, a runner between pillars to a statue
    r = house("shrine", "Wayside Shrine", 11, 10, [5])
    g = r.g
    g.carve(1, 3, 9, 8, "-")
    g.carve(5, 5, 5, 8, "+")
    r.open_exit("+")
    g.faces(2)
    r.statue(5, 3)
    r.wall([["arch_window_top"], ["arch_window_bottom"]], 5, 1)
    r.wall([["torch"]], 3, 1)
    r.wall([["torch"]], 7, 1)
    r.wall([["banner"]], 1, 1)
    r.wall([["banner"]], 9, 1)
    for (x, y) in [(2, 4), (8, 4), (2, 7), (8, 7)]:
        r.pillar(x, y)
    for x in (3, 7):
        r.one("stone_bench", x, 6)
    r.one("plant", 1, 3)
    r.one("plant", 9, 3)
    r.one("orb_white", 4, 3)
    r.npc("priestess", "white_mage", 6, 4, [
        "Rest here a moment, travellers. The light keeps no one waiting.",
        "Cure magic mends wounds, but a knocked-out friend needs more than that. The inn or a phoenix down will do."])
    out.append(r.save("A wayside shrine: a runner between pillars to a statue, torches and a priestess.",
                          {"floor_stone": "marble", "in_wall_face": STONE_FACE, "in_wall_top": SLATE_TOP},
                          [214, 170, 64]))
    return out
