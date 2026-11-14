"""Cornelia homes, part 1: the scholar, the fisher, the farm, the retired knight and the weaver (CT-1)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from interiors_common import house, wood, SLATE_TOP, STONE_FACE  # noqa: E402


def build() -> list[Path]:
    out: list[Path] = []
    # (46,36) blue, 2 storeys: the scholar's study, with a reading alcove in the west wall
    r = house("scholar", "Scholar's Study", 12, 10, [6])
    g = r.g
    g.carve(3, 3, 10, 8, "_")                         # the study
    g.carve(1, 5, 2, 8, "_")                          # the reading alcove, set back under a lower wall
    g.carve(5, 6, 8, 7, "+")                     # a blue reading rug
    r.open_exit()
    g.faces(2)
    for x in (3, 4, 9, 10):
        r.tall("bookshelf", x, 3)
    r.wall([["window_in"]], 5, 1)
    r.wall([["tapestry"]], 7, 1)
    r.wall([["window_in"]], 8, 1)
    r.wall([["torch"]], 1, 3)
    r.tall("bookshelf", 1, 5)
    r.one("table", 2, 5)
    r.one("plant", 1, 8)
    r.one("desk", 6, 4)
    r.one("desk", 7, 4)
    r.one("orb_white", 10, 8)
    r.one("plant", 3, 8)
    r.npc("scholar", "old_man", 8, 4, [
        {"condition": "PRINCESS_RESCUED",
         "text": ["The princess safe, and Garland beaten! The old books did say the Warriors would come in four.",
                  "Light the crystals one by one. Earth first, I should think: it lies nearest."]},
        {"text": ["Earth, water, fire and wind. Four crystals hold them in balance.",
                  "All four have dimmed. My instruments show it plainly.",
                  "Each of you carries an orb, dark as the crystals now. When a crystal wakes, its orb shines again."]}])
    out.append(r.save("A scholar's study: bookshelves, writing desks, a tapestry and a reading alcove.",
                          {"floor": wood(0.8), "in_wall_face": {"from": "castle_face", "shade": 0.8}},
                          [70, 110, 190]))

    # (52,37) green / white: the fisher's cottage, one room
    r = house("fisher", "Fisher's Cottage", 9, 8, [4])
    g = r.g
    g.carve(1, 2, 7, 6, "_")
    r.open_exit()
    g.faces(1)
    r.tall("bed", 1, 2)
    r.wall([["window_in"]], 3, 1)
    r.wall([["potion_shelf"]], 5, 1)
    r.one("table", 4, 3)
    for (x, y) in [(7, 2), (7, 3), (6, 6)]:
        r.thing("barrel", x, y)
    for (x, y) in [(6, 2), (1, 6)]:
        r.thing("crate", x, y)
    r.chest("fisher", "potion", "a Potion", 1, 4)
    r.npc("fisher_wife", "villager_f", 5, 4, [
        "My husband is down at the river bend again. He swears the big ones only bite at dusk.",
        "Take the potion in the chest, if you need it. He never remembers to use them."])
    out.append(r.save("The fisher's cottage: one room with a bed, a table, barrels and crates.", {"floor": wood(1.05)}))

    # (50,49) red / ochre: the farmhouse by the crops, earth floor and a hearth
    r = house("farm", "Farmhouse", 11, 9, [3])
    g = r.g
    g.carve(1, 3, 5, 7, "-")                     # the kitchen, round the hearth
    g.carve(6, 5, 9, 7, "-")                     # the store, under a lower roof
    r.open_exit("-")
    g.faces(2)
    r.fireplace(2, 1)
    r.wall([["window_in"]], 5, 1)
    r.wall([["window_in"]], 8, 3)
    r.one("table", 3, 4)
    for (x, y) in [(9, 5), (9, 6), (8, 5)]:
        r.thing("barrel", x, y)
    for (x, y) in [(7, 5), (1, 3)]:
        r.thing("crate", x, y)
    r.deco([["crops"]], 9, 7)
    r.chest("farm", "antidote", "an Antidote", 1, 7)
    r.npc("farmer", "villager", 6, 6, [
        {"condition": "GARLAND_DEFEATED",
         "text": ["The wolves have been bolder since the dark came. Lost two hens last week.",
                  "Keep an antidote handy out there. Some beasts bite worse than wolves."]},
        {"text": ["Wolves came right up to the fence last night. Bold as you like.",
                  "If you're heading out, travel together. They pick off stragglers.",
                  "There's an antidote in the chest by the door. Take it, take it."]}])
    out.append(r.save("The farmhouse by the crops: an earth floor, a hearth, sacks and crates in the store.",
                          {"floor_stone": "dirt", "in_wall_face": {"from": "castle_face", "shade": 0.95}}))

    # (44,56) slate / white, 2 storeys: the retired knight's house, a hall and an armoury through an inner door
    r = house("knight", "Retired Knight's House", 13, 9, [4])
    g = r.g
    g.carve(1, 3, 7, 7, "-")                     # the hall
    g.carve(9, 3, 11, 7, "-")                    # the armoury
    g.carve(8, 6, 8, 7, "-")                     # the inner doorway
    g.carve(3, 5, 5, 7, "+")                     # a runner to the hearth
    r.open_exit("+")
    g.faces(2)
    r.fireplace(3, 1)
    r.wall([["tapestry"]], 1, 1)
    r.wall([["tapestry"]], 6, 1)
    for x in (9, 10, 11):
        r.wall([["weapon_rack"]], x, 1)
    r.one("armor_stand", 9, 3)
    r.one("armor_stand", 11, 3)
    r.tall("bed", 7, 3)
    r.one("table", 6, 3)
    r.tall("bookshelf", 1, 3)
    r.one("plant", 1, 7)
    r.one("desk", 7, 7)
    r.one("armor_stand", 11, 5)
    r.thing("crate", 11, 7)
    r.chest("knight", "wooden_nunchaku", "Wooden Nunchaku", 9, 7)
    r.npc("old_knight", "guard", 2, 4, [
        {"condition": "GARLAND_DEFEATED",
         "text": ["So Garland fell to you. I trained beside him for twenty years.",
                  "He always dropped his guard after a big swing. I hope that is how you beat him."]},
        {"text": ["I served the King's guard with Garland, before my knees gave out.",
                  "He fights with great two-handed sweeps. Strike when the blade is still coming round.",
                  "Take what is in the chest in my armoury. An old man has no use for it now."]}])
    out.append(r.save("A retired knight's house: a hall with a hearth and tapestries, and an armoury beyond an inner door.",
                          {"floor_stone": "floor_stone", "in_wall_face": STONE_FACE, "in_wall_top": SLATE_TOP},
                          [190, 196, 206]))

    # (50,56) brown / rose: the weaver's shop-home, carpets laid out for sale
    r = house("weaver", "Weaver's House", 12, 8, [6])
    g = r.g
    g.carve(1, 3, 10, 6, "_")
    g.carve(2, 4, 4, 5, "+")
    g.carve(7, 4, 9, 5, "+")
    r.open_exit()
    g.faces(2)
    for x in (2, 5, 8):
        r.wall([["tapestry"]], x, 1)
    r.wall([["banner"]], 10, 1)
    r.wall([["window_in"]], 6, 1)
    r.one("plant", 1, 3)
    r.one("plant", 10, 3)
    r.one("table", 5, 4)
    r.one("table", 6, 4)
    r.thing("crate", 10, 6)
    r.thing("barrel", 10, 5)
    r.one("plant", 1, 6)
    r.npc("weaver", "villager_f", 3, 3, [
        "Every rug in this room took me a season. That blue one took two.",
        "Garland bought a cloak from me once. Paid in full, and polite as a prince. I can't believe what they say."])
    out.append(r.save("The weaver's shop-home: rugs laid out on the floor, hangings on every wall.",
                          {"floor": wood(0.95)}, [150, 60, 110]))
    return out
