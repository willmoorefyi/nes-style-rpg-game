"""Outdoor helpers for town layout scripts (extracted from `cornelia.py`, W1-D): placed objects and the common
town-kit decos. A script makes one `Outdoor`, places its objects through it and writes `outdoor.objects` into its
map source:

    town = Outdoor()
    obj, deco, oak, lamp, fir = town.obj, town.deco, town.oak, town.lamp, town.fir
    oak(12, 22)
    obj(type="facade", ..., parts=[win(5, 2), flag(7, 2)])
"""
from __future__ import annotations

# a 2x3 corner tower (castle kit): turrets on wall bends, beside gates and on facades
TURRET = [["tower_0_0", "tower_0_1"], ["tower_1_0", "tower_1_1"], ["tower_2_0", "tower_2_1"]]


class Outdoor:
    """The objects of one outdoor map, in placement order (the order is part of the generated source)."""

    def __init__(self) -> None:
        self.objects: list[dict] = []

    def obj(self, **o) -> None:
        self.objects.append(o)

    def deco(self, parts, x, y, **kw) -> None:
        self.obj(type="deco", parts=parts, x=x, y=y, **kw)

    def oak(self, x, y) -> None:                 # 2x3 broadleaf tree; (x, y) is its top-left (crown row walkable)
        self.deco([["oak_0_0", "oak_0_1"], ["oak_1_0", "oak_1_1"], ["oak_2_0", "oak_2_1"]], x, y, above_rows=1)

    def lamp(self, x, y) -> None:                # (x, y) is the lamp head (walkable, drawn over characters)
        self.deco([["lamp_top"], ["lamp_bottom"]], x, y, above_rows=1)

    def fir(self, x, y) -> None:                 # (x, y) is the trunk; the crown is the cell above
        self.obj(type="tree", x=x, y=y)


def win(x, y) -> dict:                           # an arched window: a part of a facade's `parts`
    return {"parts": [["arch_window_top"], ["arch_window_bottom"]], "x": x, "y": y}


def flag(x, y) -> dict:                          # a flag on a facade
    return {"parts": [["flag_top"], ["flag_bottom"]], "x": x, "y": y}
