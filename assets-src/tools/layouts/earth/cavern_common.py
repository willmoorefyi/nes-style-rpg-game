"""Shared parts of the Cavern of Earth floors (docs/WORLD_PLAN.md 4.3; ERT-D): the cave and frozen materials, the
design note (every floor's source opens with it), the encounter tables per floor, and small helpers. The floors are
written by `cavern_upper.py` (B1-B3, stage S11) and `cavern_lower.py` (B4-B5, stage S13).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parents[2]))
from common import Room as BaseRoom  # noqa: E402
from kit import remap  # noqa: E402

KITS = ["temple", "castle", "interior", "town"]
LEGEND = "legend: W rock  F rock face  - cave floor  % rubble  ~ cave water"
CAVE = {"floor_stone": {"from": "ar_cave", "shade": 0.8}, "rubble": {**remap("cave", "ar_temple_rubble_cool"), "shade": 1.2},
        "in_wall_top": {"from": "temple_wall_top", "shade": 0.3},
        "in_wall_face": {**remap("cave", "temple_wall_face"), "shade": 0.95}}
ICE = {"floor_stone": {"from": "ar_ice"}, "rubble": {**remap("ice", "ar_temple_rubble_cool"), "shade": 1.2},
       "in_wall_top": {"from": "temple_wall_top", "shade": 0.4},
       "in_wall_face": {**remap("ice", "temple_wall_face"), "shade": 0.9}}
EXIT = {"map": "overworld", "entrance": "ert_earth_cave"}
NOTE = ("Concept: a cavern under the grey badlands that the earth's rot drains into; the upper galleries are a "
        "vampire's larder, and under them lies the frozen undercroft of the Rime Sovereign's drowned-in-stone fortress.\n"
        "Distinct: an ore annex reached by its own stair from B1 and walled off from the rest of B2; a still cave lake "
        "with a rubble slide on its shore that dumps the careless back up on B1; a seal of fused stone that only "
        "Sarda's rod breaks, in a side chamber of the vampire's crypt; a frozen ring where one of two stairwells is "
        "a false pit into a sealed pocket; the Sovereign's shade kneeling at the crystal's altar after his fall.\n"
        "Topology: B1 -> B2 (2 stairs: the main way and the ore annex, a dead end) -> B3 boss (the vampire; the rod "
        "seal bars the stair down) -> B4 (a ring, 2 stairwells: one false, a one-way pit to a pocket) -> B5 boss "
        "(the Rime Sovereign, then the altar); one-way slide B2 -> B1.")


def table(*rows: tuple[int, list[tuple[str, int, int]]]) -> list[dict]:
    """Encounter rows: (weight, [(enemy id, min, max), ...])."""
    return [{"groups": [{"id": i, "min": lo, "max": hi} for i, lo, hi in g], "weight": w} for w, g in rows]


class Room(BaseRoom):
    def write_floor(self, header: str, entrances: dict, *, mats: dict, encounters: list, background: str = "cave",
                    can_save: bool = True, extra: dict | None = None) -> Path:
        quiet = {"encounterRate": {"min": 18, "max": 30}, "encounters": encounters,
                 "battleBackgrounds": {"default": background}, "no_static_chokepoints": True,
                 "no_unreachable_walkable": True}
        script = "earth/cavern_upper.py" if self.id[-1] in "123" else "earth/cavern_lower.py"
        return self.write(f"{header}\n{NOTE}", entrances, kits=KITS, mats=mats, trim=None, quiet=quiet, script=script,
                          legend=LEGEND, music="dungeon",
                          extra={"exit": EXIT, **(extra or {}), "canSave": can_save})

    def chest(self, cid: str, item: str, label: str, x: int, y: int) -> None:
        self.npcs.append({"id": f"chest_ert_d_{cid}", "sprite": "chest", "x": x, "y": y, "chestItem": item,
                          "chestFlag": f"CHEST_ERT_D_{cid.upper()}", "dialog": [f"You found {label}!"]})


def preview(r: Room) -> str:
    """The ground with NPCs (N), transitions (T) and entrances (E) marked, for checking a layout by eye."""
    rows = [list(row) for row in r.g.g]
    for t in r.transitions:
        rows[t["y"]][t["x"]] = "T"
    for n in r.npcs:
        rows[n["y"]][n["x"]] = "N"
    return "\n".join("".join(row) for row in rows)
