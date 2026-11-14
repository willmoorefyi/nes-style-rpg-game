"""Shared pieces of the Cornelia interiors (`interiors.py`): the room class, materials and constructors."""
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


SHOP = "shop"                                    # the music of the shops and the inn


def keeper(r: Place, slug: str, sprite: str, x: int, y: int, greeting: str | list[str], shop_id: str) -> None:
    """The shopkeeper behind the counter; `greeting` is the line (or lines) said before the shop opens (IN-4)."""
    lines = [greeting] if isinstance(greeting, str) else list(greeting)
    r.npcs.append({"id": f"cornelia-{slug}-keeper", "x": x, "y": y, "sprite": sprite, "dialog": lines,
                   "shopId": shop_id})
