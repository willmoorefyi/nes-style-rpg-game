"""Shared parts of the Ice Cavern floors (docs/WORLD_PLAN.md 4.4, stage S16; FIR-D2): materials, the encounter tables,
the chests and the floor writer. The floors are `ice_b1.py`, `ice_b2.py` and `ice_b3.py`.

  python3 -I assets-src/tools/layouts/fire/ice_b1.py   (and _b2, _b3)
  python3 -I assets-src/tools/build_map.py ice-cavern-b1 ice-cavern-b2 ice-cavern-b3

The cave is the `ice` remap (WORLD 4.9) of the stone floor; its walls are the same ice, darker. Sheet ice (`+`) is the
ice remap at a brighter shade; cracked ice (`%`, the temple rubble greyed) marks the pits of B2, each a one-way
transition (a meltwater spout) up into a pocket of B1. Meltwater pools are `≈` (the water material, dark blue-green).
Chests use `CHEST_FIR_D2_*`; the shelf on B2 opens on FIR_D2_SHELF (a patch, cutscene `fir_d2_shelf`); the eye's
fight sets EVIL_EYE_DEFEATED and `fir_evil_eye_falls` gives the levistone.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parents[2]))
from common import Room as BaseRoom  # noqa: E402
from kit import landmark_parts, remap  # noqa: E402

KITS = ["temple", "castle", "interior", "town"]
ICE = remap("ice")
# the remaps apply in order, so the later entries recolour the ice floor_stone once more only by shade
MATS = {"floor": {"from": "floor_stone", "sat": 0.25, "shade": 1.45},          # packed snow (`_`)
        "rubble": {"from": "temple_rubble", "sat": 0.2, "shade": 1.25},         # cracked ice (`%`)
        "floor_stone": ICE,
        "carpet": {"from": "floor_stone", "shade": 1.3},                        # sheet ice (`+`)
        "in_wall_top": {"from": "floor_stone", "shade": 0.38},
        "in_wall_face": {"from": "floor_stone", "shade": 0.72},
        "water": {"from": "water", "hue": -15, "sat": 0.6, "shade": 0.55}}       # meltwater (`≈`)
LEGEND = ("legend: W ice rock  F ice face  - frost floor  + sheet ice  % cracked ice (B2: a pit)  _ packed snow  "
          "≈ meltwater")
EXIT = {"map": "overworld", "entrance": "fir_ice"}
DONE = "EVIL_EYE_DEFEATED"
SHELF = "FIR_D2_SHELF"
RATE = {"min": 14, "max": 26}
BACKDROP = {"default": "ice_cave"}
FROST = "snow"                           # the part style that whitens a pillar or a floe


def group(*ids_counts) -> list[dict]:
    return [{"id": i, "min": lo, "max": hi} for i, lo, hi in ids_counts]


# the S16 roster (WORLD 3.2): wolves and the frost giant near the mouth, the dead and the casters deeper in
TABLES = {
    "b1": [{"groups": group(("winter_wolf", 2, 4)), "weight": 3},
           {"groups": group(("ice_gigas", 1, 1)), "weight": 2},
           {"groups": group(("specter", 2, 3)), "weight": 2},
           {"groups": group(("winter_wolf", 1, 2), ("remorazz", 1, 1)), "weight": 2}],
    "b2": [{"groups": group(("remorazz", 1, 2)), "weight": 3},
           {"groups": group(("specter", 2, 4)), "weight": 2},
           {"groups": group(("ice_gigas", 1, 1), ("winter_wolf", 1, 2)), "weight": 2},
           {"groups": group(("dark_wizard", 1, 2), ("winter_wolf", 0, 2)), "weight": 2},
           {"groups": group(("white_dragon", 1, 1)), "weight": 1}],
    "b3": [{"groups": group(("mindflayer", 1, 2)), "weight": 3},
           {"groups": group(("white_dragon", 1, 1), ("specter", 0, 2)), "weight": 2},
           {"groups": group(("dark_wizard", 2, 3)), "weight": 2},
           {"groups": group(("ice_gigas", 1, 1), ("specter", 1, 2)), "weight": 2},
           {"groups": group(("mindflayer", 1, 1), ("remorazz", 1, 1)), "weight": 1}],
}


def chest(cid: str, item: str, label: str, x: int, y: int) -> dict:
    return {"id": f"chest_fir_d2_{cid}", "sprite": "chest", "x": x, "y": y, "chestItem": item,
            "chestFlag": f"CHEST_FIR_D2_{cid.upper()}", "dialog": [f"You found {label}!"]}


def talk(*steps: tuple[str | None, list[str]]) -> list[dict]:
    """Conditional lines, first match wins: (flag, lines) pairs, the last one with flag None (the default)."""
    return [{"condition": f, "text": t} if f else {"text": t} for f, t in steps]


class Floor(BaseRoom):
    """One Ice Cavern floor: the shared materials, its encounter table and the exit; `roots` are the more entrances
    the reachability checks start from (B1's pockets, B2's hidden stair hall), and the compiler's chokepoint check
    (which walks from the first entrance only) is then left to `tests/quest/fire/fir_d2_ice.test.ts`."""

    def __init__(self, map_id: str, name: str, w: int, h: int):
        super().__init__(map_id, name, w, h)
        self.g.rect(0, 0, w - 1, h - 1, "W")

    def pillar(self, x: int, y: int) -> None:
        self.deco([["tpillar_top"], ["tpillar_bottom"]], x, y, style=FROST)

    def floe(self, x: int, y: int) -> None:
        self.deco(landmark_parts("ice_floe"), x, y)   # LM-INT: no frost style (the art is ice); solid, as the placeholder

    def write(self, table: str, header: str, entrances: dict, extra: dict | None = None, roots: list | None = None):
        quiet = {"encounterRate": RATE, "encounters": TABLES[table], "battleBackgrounds": BACKDROP,
                 **({} if roots else {"no_static_chokepoints": True}),
                 "no_unreachable_walkable": {"reach_roots": roots} if roots else True}
        return super().write(header, entrances, kits=KITS, mats=MATS, trim=None, quiet=quiet,
                             script=f"fire/ice_{table}.py", legend=LEGEND, music="dungeon",
                             extra={"exit": EXIT, **(extra or {})})
