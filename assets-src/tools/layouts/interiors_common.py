"""Shared pieces of the town interiors (`interiors.py` for Cornelia): the room class, materials and constructors.

Every constructor takes a `town` (default Cornelia): the map-id prefix of its houses and keepers and the map its exits
lead back to. A new town binds them once, `t = Town("elfheim", script="elfheim_interiors.py")`, then calls
`t.house(...)`, `t.shop(...)` and `t.keeper(...)`; the module-level `house`, `shop` and `keeper` default to Cornelia.
"""
from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import Room  # noqa: E402

KITS = ["interior", "town", "castle"]
QUIET = {"encounterRate": {"min": 999, "max": 999}, "encounters": []}
CHECKS = {"no_static_chokepoints": True, "no_unreachable_walkable": True}       # M4
LEGEND = "legend: W wall top  F wall face  _ wood floor  - stone / earth floor  + carpet  c counter"
TOWN = "cornelia"                                # the default town


@dataclass(frozen=True)
class Town:
    """A town's interiors: `prefix` starts their map ids (`<prefix>-house-<name>`) and keeper ids, `exit_map` is the
    outdoor map their exits lead to (default: the prefix), `script` the layout script named in each header."""
    prefix: str = TOWN
    exit_map: str | None = None
    script: str = "interiors.py"

    @property
    def outside(self) -> str:
        return self.exit_map or self.prefix

    def house(self, name: str, title: str, w: int, h: int, gap: list[int]) -> "Place":
        """A home: map `<prefix>-house-<name>`; its exits lead to the town's `house_<name>` entrance."""
        return Place(f"{self.prefix}-house-{name}", title, w, h, gap, f"house_{name}", town=self)

    def shop(self, map_id: str, title: str, w: int, h: int, gap: list[int], back: str) -> "Place":
        return Place(map_id, title, w, h, gap, back, town=self)

    def keeper(self, r: "Place", slug: str, sprite: str, x: int, y: int, greeting: str | list[str],
               shop_id: str) -> None:
        """The shopkeeper behind the counter; `greeting` is the line (or lines) said before the shop opens (IN-4)."""
        lines = [greeting] if isinstance(greeting, str) else list(greeting)
        r.npcs.append({"id": f"{self.prefix}-{slug}-keeper", "x": x, "y": y, "sprite": sprite, "dialog": lines,
                       "shopId": shop_id})


CORNELIA = Town()


def wood(shade: float) -> dict:
    return {"from": "floor", "shade": shade}


STONE_FACE = "castle_wall_in"
SLATE_TOP = {"from": "slate", "shade": 0.5}


class Place(Room):
    """A room in a town: exit gap cells on the bottom row lead back to `back` (the entrance in front of its door in
    town); the entrance `door` is the cell above the first gap cell."""

    def __init__(self, map_id: str, name: str, w: int, h: int, gap: list[int], back: str, town: Town = CORNELIA):
        super().__init__(map_id, name, w, h)
        self.gap, self.back, self.town = gap, back, town
        self.unreachable: list[list[int]] = []

    def open_exit(self, ch: str = "_") -> None:
        for x in self.gap:
            self.g.carve(x, self.g.h - 1, x, self.g.h - 1, ch)

    def thing(self, kind: str, x: int, y: int) -> None:     # barrel, crate, bench, flowers: town kit object types
        self.objects.append({"type": kind, "x": x, "y": y})

    def one(self, part: str, x: int, y: int, **kw) -> None:
        self.deco([[part]], x, y, **kw)

    def staff(self, x0: int, y0: int, x1: int, y1: int) -> None:
        """M3/M4: the floor behind a counter (the keeper's side) is visible but not reachable from the door."""
        self.unreachable += [[x, y] for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]

    def fireplace(self, x: int, y: int) -> None:
        self.deco([["fireplace_0_0", "fireplace_0_1"], ["fireplace_1_0", "fireplace_1_1"]], x, y, on_wall=True)

    def chest(self, key: str, item: str, label: str, x: int, y: int) -> None:
        self.npcs.append({"id": f"chest_house_{key}", "sprite": "chest", "x": x, "y": y, "chestItem": item,
                          "chestFlag": f"CHEST_HOUSE_{key.upper()}", "dialog": [f"You found {label}!"]})

    def npc(self, npc_id: str, sprite: str, x: int, y: int, dialog: list, **kw) -> None:
        self.npcs.append({"id": npc_id, "sprite": sprite, "x": x, "y": y, "dialog": dialog, **kw})

    def save(self, header: str, mats: dict | None, trim: list | None = None, music: str = "town") -> Path:
        self.transitions += [{"x": x, "y": self.g.h - 1, "targetMap": self.town.outside, "targetEntrance": self.back}
                             for x in self.gap]
        return self.write(header, {"door": [self.gap[0], self.g.h - 2]}, kits=KITS, mats=mats, trim=trim,
                          quiet=QUIET, script=self.town.script, legend=LEGEND, music=music,
                          extra={**CHECKS, **({"unreachable_ok": self.unreachable} if self.unreachable else {})})


def house(name: str, title: str, w: int, h: int, gap: list[int], town: Town = CORNELIA) -> Place:
    return town.house(name, title, w, h, gap)


def shop(map_id: str, title: str, w: int, h: int, gap: list[int], back: str, town: Town = CORNELIA) -> Place:
    return town.shop(map_id, title, w, h, gap, back)


SHOP = "shop"                                    # the music of the shops and the inn


def keeper(r: Place, slug: str, sprite: str, x: int, y: int, greeting: str | list[str], shop_id: str) -> None:
    """The shopkeeper behind the counter, named after the room's town (Town.keeper)."""
    r.town.keeper(r, slug, sprite, x, y, greeting, shop_id)
