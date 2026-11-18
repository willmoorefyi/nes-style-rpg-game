"""Shared parts of the Sea Shrine floors (docs/WORLD_PLAN.md 4.6, stage S24; WAT-D): materials, the encounter tables,
the chest and dialog helpers and the floor writer. The floors are `shrine_b1.py` ... `shrine_b5.py`.

  python3 -I assets-src/tools/layouts/water/shrine_b3.py   (and _b1, _b2, _b4, _b5)
  python3 -I assets-src/tools/build_map.py sea-shrine-b1 sea-shrine-b2 sea-shrine-b3 sea-shrine-b4 sea-shrine-b5

The shrine is the temple stone turned teal (the `coral` look). Sea water (`≈`, the `water` material turned sea-green) stands
in its pools and flooded halls; the boardwalks are wet planks (`_`); the kelp-dark rooms are the coral floor at shade
0.65 (`+`); `%` is broken coral. Chests use `CHEST_WAT_D_*`. The submarine from Onrac's dry dock berths in B3, the nave;
the Drowned Sovereign waits on B5's throne, and his fall (`wat_drowned_falls`) lights the water crystal and gives the
slab.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import Room as BaseRoom  # noqa: E402

KITS = ["temple", "castle", "interior", "town"]
# kit.py's `coral` preset turns its castle_face base by 150 degrees; the temple stone sits elsewhere on the wheel (150
# turns it crimson), so the temple parts take -35 to land on the same teal
TEAL = {"hue": -35, "sat": 2.2}
MATS = {"floor_stone": {"from": "temple_floor", **TEAL, "shade": 1.0},
        "carpet": {"from": "temple_floor", **TEAL, "shade": 0.62},
        "rubble": {"from": "temple_rubble", **TEAL, "shade": 1.1},
        "in_wall_top": {"from": "temple_wall_top", **TEAL, "shade": 0.3},
        "in_wall_face": {"from": "temple_wall_face", **TEAL, "shade": 0.85},
        "floor": {"from": "floor", "sat": 0.6, "shade": 0.7},                     # wet planks
        "water": {"from": "water", "hue": -40, "sat": 1.1, "shade": 1.0}}           # the sea-green water (`≈`)
LEGEND = ("legend: W rock  F wall face  - shrine flagstone  + kelp-dark floor  _ wet boardwalk  % broken coral  "
          "≈ sea water")
EXIT = {"map": "overworld", "entrance": "wat_onrac"}
DONE = "WATER_CRYSTAL_LIT"
RATE = {"min": 16, "max": 28}
SHRINE_BG = {"default": "water_temple"}
THRONE_BG = {"default": "throne_kraken"}
MERMAID = "#5fb8b0"                      # the tint of the grotto's sea folk (villager_f)
NOTE = ("Concept: a temple of the sea folk in a drowned cave under Onrac's bay, sunk with the kingdom whose king "
        "flooded it to save it, where the last mermaids keep the dry grotto at the top.\n"
        "Distinct: the submarine berths in a flooded pool in the middle floor, so the shrine splits up and down from "
        "the nave; a cloister whose garth is a sunken sea garden; a grotto of mermaids with no monsters in it; a "
        "sunken library whose stacks stand in the tide; the throne reached by a causeway over a drowned court, with "
        "the crystal's socket behind it.\n"
        "Topology: B3 nave (the submarine) -> up B2 cloister -> B1 grotto (a dead end); B3 -> down B4 flooded halls "
        "(two routes, two stairs) -> B5 boss.")


def group(*ids_counts) -> list[dict]:
    return [{"id": i, "min": lo, "max": hi} for i, lo, hi in ids_counts]


# the S24 roster (WORLD 3.2): the sea folk's foes in the upper floors, the drowned court and the tide below
TABLES = {
    "b2": [{"groups": group(("sahagin_prince", 2, 3)), "weight": 3},
           {"groups": group(("sea_scorpion", 1, 3)), "weight": 2},
           {"groups": group(("ghost", 1, 2)), "weight": 2},
           {"groups": group(("sea_snake", 1, 2), ("sahagin_prince", 0, 1)), "weight": 2}],
    "b3": [{"groups": group(("sahagin_prince", 2, 4)), "weight": 3},
           {"groups": group(("sea_snake", 1, 2)), "weight": 2},
           {"groups": group(("deepeyes", 1, 2)), "weight": 2},
           {"groups": group(("ghost", 1, 3)), "weight": 2},
           {"groups": group(("sea_scorpion", 1, 2), ("sahagin_prince", 0, 2)), "weight": 2}],
    "b4": [{"groups": group(("sea_troll", 1, 3)), "weight": 3},
           {"groups": group(("water_naga", 1, 2)), "weight": 2},
           {"groups": group(("ghost", 2, 3)), "weight": 2},
           {"groups": group(("water_elemental", 1, 1), ("sea_scorpion", 0, 2)), "weight": 2},
           {"groups": group(("deepeyes", 1, 1), ("sea_troll", 1, 2)), "weight": 1}],
    "b5": [{"groups": group(("water_elemental", 1, 2)), "weight": 3},
           {"groups": group(("sea_troll", 2, 3)), "weight": 2},
           {"groups": group(("water_naga", 1, 1), ("ghost", 1, 2)), "weight": 2},
           {"groups": group(("deepeyes", 1, 2)), "weight": 1}],
}


def chest(cid: str, item: str, label: str, x: int, y: int) -> dict:
    return {"id": f"chest_wat_d_{cid}", "sprite": "chest", "x": x, "y": y, "chestItem": item,
            "chestFlag": f"CHEST_WAT_D_{cid.upper()}", "dialog": [f"You found {label}!"]}


def talk(before: list[str], after: list[str]) -> list[dict]:
    """An NPC's lines: `after` once the water crystal is lit."""
    return [{"condition": DONE, "text": after}, {"text": before}]


class Floor(BaseRoom):
    """One Sea Shrine floor: the shared materials, its encounter table (none: the grotto), the exit."""

    def __init__(self, map_id: str, name: str, w: int, h: int):
        super().__init__(map_id, name, w, h)
        self.g.rect(0, 0, w - 1, h - 1, "W")

    def write(self, table: str | None, header: str, entrances: dict, extra: dict | None = None, throne: bool = False):
        quiet = {"encounterRate": RATE if table else {"min": 999, "max": 999},
                 "encounters": TABLES[table] if table else [],
                 "battleBackgrounds": THRONE_BG if throne else SHRINE_BG,
                 "no_static_chokepoints": True, "no_unreachable_walkable": True}
        name = self.id.split("-")[-1]
        return super().write(header, entrances, kits=KITS, mats=MATS, trim=None, quiet=quiet,
                             script=f"water/shrine_{name}.py", legend=LEGEND, music="dungeon",
                             extra={"exit": EXIT, **(extra or {})})
