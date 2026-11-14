"""Cornelia's house, shop and inn interiors (original layouts) -> assets-src/maps/cornelia-house-*.yaml and the six
cornelia-*shop*, -magic and -inn maps.

  python3 -I assets-src/tools/layouts/interiors.py && python3 -I assets-src/tools/build_map.py

Ten houses (CT-1), each with a purpose, its own plan and its own material aliases, and the six shops and the inn
(IN-5), each with its own counter layout; the keepers stay behind their counters, so you talk to them across it.
Every exit returns to the cell in front of the door it was entered by (`cornelia.py` names the house `house_<name>`
and the inn and shops by their old names). Homes play the town music; shops and the inn the shop music.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import Room  # noqa: E402

KITS = ["interior", "town", "castle"]
QUIET = {"encounterRate": {"min": 999, "max": 999}, "encounters": []}
CHECKS = {"no_static_chokepoints": True}
LEGEND = "legend: W wall top  F wall face  _ wood floor  - stone / earth floor  + carpet  c counter"
TOWN = "cornelia"


def wood(shade: float) -> dict:
    return {"from": "floor", "shade": shade}


STONE_FACE = "castle_wall_in"
SLATE_TOP = {"from": "slate", "shade": 0.5}


class Place(Room):
    """A room in Cornelia: exit gap cells on the bottom row lead back to `back` (the entrance in front of its
    door in town); the entrance `door` is the cell above the first gap cell."""

    def __init__(self, map_id: str, name: str, w: int, h: int, gap: list[int], back: str):
        super().__init__(map_id, name, w, h)
        self.gap, self.back = gap, back

    def open_exit(self, ch: str = "_") -> None:
        for x in self.gap:
            self.g.carve(x, self.g.h - 1, x, self.g.h - 1, ch)

    def thing(self, kind: str, x: int, y: int) -> None:     # barrel, crate, bench, flowers: town kit object types
        self.objects.append({"type": kind, "x": x, "y": y})

    def one(self, part: str, x: int, y: int, **kw) -> None:
        self.deco([[part]], x, y, **kw)

    def tall(self, part: str, x: int, y: int) -> None:      # a two-cell part: <part>_top over <part>_bottom
        self.deco([[f"{part}_top"], [f"{part}_bottom"]], x, y)

    def fireplace(self, x: int, y: int) -> None:
        self.deco([["fireplace_0_0", "fireplace_0_1"], ["fireplace_1_0", "fireplace_1_1"]], x, y, on_wall=True)

    def chest(self, key: str, item: str, label: str, x: int, y: int) -> None:
        self.npcs.append({"id": f"chest_house_{key}", "sprite": "chest", "x": x, "y": y, "chestItem": item,
                          "chestFlag": f"CHEST_HOUSE_{key.upper()}", "dialog": [f"You found {label}!"]})

    def npc(self, npc_id: str, sprite: str, x: int, y: int, dialog: list, **kw) -> None:
        self.npcs.append({"id": npc_id, "sprite": sprite, "x": x, "y": y, "dialog": dialog, **kw})

    def save(self, header: str, mats: dict | None, trim: list | None = None, music: str = "town") -> Path:
        self.transitions += [{"x": x, "y": self.g.h - 1, "targetMap": TOWN, "targetEntrance": self.back}
                             for x in self.gap]
        return self.write(header, {"door": [self.gap[0], self.g.h - 2]}, kits=KITS, mats=mats, trim=trim,
                          quiet=QUIET, script="interiors.py", legend=LEGEND, music=music, extra=CHECKS)


def house(name: str, title: str, w: int, h: int, gap: list[int]) -> Place:
    return Place(f"cornelia-house-{name}", title, w, h, gap, f"house_{name}")


def shop(map_id: str, title: str, w: int, h: int, gap: list[int], back: str) -> Place:
    return Place(map_id, title, w, h, gap, back)


written: list[Path] = []

# ════════════════════════════ the ten houses (CT-1) ════════════════════════════

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
written.append(r.save("A scholar's study: bookshelves, writing desks, a tapestry and a reading alcove.",
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
written.append(r.save("The fisher's cottage: one room with a bed, a table, barrels and crates.", {"floor": wood(1.05)}))

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
written.append(r.save("The farmhouse by the crops: an earth floor, a hearth, sacks and crates in the store.",
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
written.append(r.save("A retired knight's house: a hall with a hearth and tapestries, and an armoury beyond an inner door.",
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
written.append(r.save("The weaver's shop-home: rugs laid out on the floor, hangings on every wall.",
                      {"floor": wood(0.95)}, [150, 60, 110]))

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
written.append(r.save("The gardener's lodge by the castle gardens: a potting floor with seed racks, plants and flowers.",
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
written.append(r.save("A family home: a living room with a hearth and a bedroom beyond an inner door.",
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
written.append(r.save("An apprentice mage's room: a niche of orbs, potion shelves and a bookshelf.",
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
written.append(r.save("The tavern: a bar with a barkeep behind it, banquet tables, barrels and a hearth.",
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
written.append(r.save("A wayside shrine: a runner between pillars to a statue, torches and a priestess.",
                      {"floor_stone": "marble", "in_wall_face": STONE_FACE, "in_wall_top": SLATE_TOP},
                      [214, 170, 64]))

# ════════════════════════════ the shops and the inn (IN-5) ════════════════════════════
SHOP = "shop"


def keeper(r: Place, slug: str, sprite: str, x: int, y: int, title: str, shop_id: str) -> None:
    r.npcs.append({"id": f"cornelia-{slug}-keeper", "x": x, "y": y, "sprite": sprite,
                   "dialog": [f"Welcome to the {title}!"], "shopId": shop_id})


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
keeper(r, "weapon-shop", "merchant", 2, 4, "Weapon Shop", "cornelia_weapon")
written.append(r.save("The weapon shop: an L-shaped counter round the keeper's corner, racks of blades behind it.",
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
keeper(r, "armor-shop", "merchant", 4, 3, "Armor Shop", "cornelia_armor")
written.append(r.save("The armor shop: a counter across the back and armour stands on the shop floor.",
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
keeper(r, "item-shop", "merchant", 4, 3, "Item Shop", "cornelia_item")
written.append(r.save("The item shop: a short counter before shelves of potions.", {"floor": wood(1.1)}, music=SHOP))

# white magic: the counter guards an alcove of white orbs under an arched window
r = shop("cornelia-white-magic", "White Magic", 10, 9, [4, 5], "white_magic")
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
keeper(r, "white-magic", "mage", 4, 4, "White Magic", "cornelia_white")
written.append(r.save("The white magic shop: a counter before an alcove of white orbs.",
                      {"floor_stone": "marble", "in_wall_face": STONE_FACE}, [200, 210, 230], music=SHOP))

# black magic: a dark room, the counter on the east, black orbs in a west niche
r = shop("cornelia-black-magic", "Black Magic", 11, 9, [6], "black_magic")
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
keeper(r, "black-magic", "mage", 7, 3, "Black Magic", "cornelia_black")
written.append(r.save("The black magic shop: a dark room, a counter on the east side and black orbs in a niche.",
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
keeper(r, "inn", "innkeeper", 2, 7, "Inn", "cornelia_inn")
written.append(r.save("The inn: a front counter, and a back room of beds through a doorway.",
                      {"floor": wood(0.95)}, music=SHOP))

for p in written:
    print(p)
