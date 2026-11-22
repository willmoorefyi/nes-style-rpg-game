"""Shared parts of Gurgu Volcano's floors (docs/WORLD_PLAN.md 4.4, stage S15; FIR-D1): the materials (basalt floor,
lava as the `lava` remap of the rubble `%`), the encounter tables, the design note every floor carries, the chest
helper and the lava hazard (`MapData.hazards`, damage 1 a step, one rect per row run of `%` cells).

gurgu_upper.py writes B1 and B2, gurgu_lower.py B3 to B5; both import this module.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parents[2]))
from common import Room as BaseRoom  # noqa: E402

KITS = ["temple", "castle", "interior", "town"]
MATS = {"floor_stone": {"from": "ar_cave", "sat": 0.6, "shade": 0.55},                     # dark basalt (AR-T2)
        "rubble": {"from": "ar_lava"},                                                    # the lava, `%` (AR-T2)
        "carpet": {"from": "ar_temple_floor_cool", "sat": 0.12, "shade": 1.15},                   # pale ash, `+`
        "in_wall_face": {"from": "temple_wall_face", "hue": -170, "sat": 1.3, "shade": 0.8},
        "in_wall_top": {"from": "temple_wall_top", "shade": 0.32}}
LEGEND = "legend: W rock top  F rock face  - basalt  % lava (hazard, 1 HP a step)  + ash"
EXIT = {"map": "overworld", "entrance": "fir_volcano"}
WON = "FIRE_CRYSTAL_LIT"
NOTE = ("Concept: a volcano hollowed by a sun cult that wanted to bottle the fire; its last priestess walked into the "
        "flame and the mountain has been hers since, ash falling like snow in the court where she waits.\n"
        "Distinct: a caldera rim you walk all the way round, its crater a sheer pit of rock; two lava galleries that "
        "cross one under the other, the upper one's far stair dropping into a sealed forge the lower one never "
        "reaches; on B4 a choice between a short wade across open lava and a dry corridor that doubles back round "
        "the field; lava streams that cross the upper gallery from wall to wall, each passable dry only at one ford "
        "of bare stone.\n"
        "Topology: B1 -> B2 (twin stairs: east to the arrival, west to the west landing) -> B3 (B2's east stair to "
        "the north gallery; its west stair to a dead-end forge) -> B4 (two routes, the short one over lava) -> "
        "B5 boss.")
UPPER = [{"groups": [{"id": "fire_lizard", "min": 1, "max": 2}], "weight": 3},
         {"groups": [{"id": "hellhound", "min": 1, "max": 2}], "weight": 3},
         {"groups": [{"id": "lava_worm", "min": 1}, {"id": "pyrolisk", "min": 0, "max": 2}], "weight": 2},
         {"groups": [{"id": "pyrolisk", "min": 2, "max": 4}], "weight": 2},
         {"groups": [{"id": "fire_elemental", "min": 1}], "weight": 1}]
LOWER = [{"groups": [{"id": "horned_devil", "min": 2, "max": 4}], "weight": 3},
         {"groups": [{"id": "fire_hydra", "min": 1, "max": 2}], "weight": 2},
         {"groups": [{"id": "fire_gigas", "min": 1}, {"id": "pyrolisk", "min": 0, "max": 2}], "weight": 2},
         {"groups": [{"id": "fire_elemental", "min": 1, "max": 2}], "weight": 2},
         {"groups": [{"id": "dragon", "min": 1}], "weight": 1}]


def quiet(table: list, bg: str) -> dict:
    return {"encounterRate": {"min": 18, "max": 30}, "encounters": table, "battleBackgrounds": {"default": bg},
            "no_static_chokepoints": True, "no_unreachable_walkable": True}


class Room(BaseRoom):
    def write(self, header: str, entrances: dict, *, table: list, bg: str, script: str,  # type: ignore[override]
              extra: dict | None = None):
        doc = {"exit": EXIT, **(extra or {})}
        lava = lava_rects(self.g)
        if lava:
            doc["hazards"] = [{"id": f"{self.id.replace('-', '_')}_lava", "damage": 1, "rects": lava}]
        return super().write(header + "\n" + NOTE, entrances, kits=KITS, mats=MATS, trim=None, quiet=quiet(table, bg),
                             script=script, legend=LEGEND, music="dungeon", extra=doc)


def lava_rects(g) -> list[list[int]]:
    """The `%` cells as inclusive [x0, y, x1, y] row runs, top to bottom, left to right."""
    out = []
    for y in range(g.h):
        x = 0
        while x < g.w:
            if g[x, y] == "%":
                x0 = x
                while x + 1 < g.w and g[x + 1, y] == "%":
                    x += 1
                out.append([x0, y, x, y])
            x += 1
    return out


def chest(cid: str, item: str, label: str, x: int, y: int) -> dict:
    return {"id": f"chest_{cid}", "sprite": "chest", "x": x, "y": y, "chestItem": item,
            "chestFlag": f"CHEST_FIR_D1_{cid.upper()}", "dialog": [f"You found {label}!"]}
