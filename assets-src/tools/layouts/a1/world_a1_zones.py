"""A1's encounter zones beyond act 1 (docs/WORLD_PLAN.md 3.2 S2 / S4 rosters, 4.0.3, 4.1; A1-O).

- `a1_mainland` (walking): every walkable cell the north shore reaches on foot, the bridge closed (the mainland north
  of the bridge; no act-1 zone holds any of it). The S2 roster at band 3-6.
- `a1_aldi` (ship): every Water cell of the A1 box (bands included) in the Aldi basin, the S4 sea roster.
- `a1_north_sea` (ship): the other Water cells of the box, the outer water north of X_west and X_east and east of
  the range.

The Aldi is flooded inside the box from its seed, with the band cells as the composer fills them (ocean, or a seam's
mountain); the composer checks the basins of the whole world again.
"""
from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from overworld_zones import row_rects  # noqa: E402
from world_api import BASIN_SEEDS, BOXES, SEAMS, WATER, Cell  # noqa: E402

WALK = set(".fs,=")


def _g(enemy: str, lo: int, hi: int | None = None) -> dict:
    return {"id": enemy, "min": lo, "max": lo if hi is None else hi}


# S2 (band 3-6): the mainland's hills and woods. Heavier packs are rare; the werewolf and the grey wolves travel alone
MAINLAND = [{"groups": [_g("black_widow", 2, 4)], "weight": 4},
            {"groups": [_g("zombie", 2, 4)], "weight": 4},
            {"groups": [_g("crazy_horse", 1, 2)], "weight": 3},
            {"groups": [_g("gigas_worm", 1)], "weight": 3},
            {"groups": [_g("ghoul", 1), _g("zombie", 1, 2)], "weight": 2},
            {"groups": [_g("gr_wolf", 1), _g("black_widow", 0, 2)], "weight": 2},
            {"groups": [_g("werewolf", 1)], "weight": 1}]
# S4 (band 5-9): the Aldi's open water
ALDI = [{"groups": [_g("sahagin", 2, 4)], "weight": 5},
        {"groups": [_g("bigeyes", 2, 4)], "weight": 3},
        {"groups": [_g("buccaneer", 1, 3)], "weight": 3},
        {"groups": [_g("sahagin", 1, 2), _g("buccaneer", 1)], "weight": 2},
        {"groups": [_g("shark", 1)], "weight": 1}]
# the outer water: a later sea, met only by a ship that has left the Aldi (after CANAL_OPEN)
NORTH_SEA = [{"groups": [_g("sahagin_chief", 1, 3)], "weight": 4},
             {"groups": [_g("shark", 1, 2)], "weight": 3},
             {"groups": [_g("bigeyes", 3, 5)], "weight": 2},
             {"groups": [_g("sahagin_chief", 1), _g("sahagin", 2, 3)], "weight": 2}]


def _flood(ok, start: Cell) -> set[Cell]:
    seen, q = {start}, deque([start])
    while q:
        x, y = q.popleft()
        for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if n not in seen and ok(n):
                seen.add(n)
                q.append(n)
    return seen


def zones(ground: dict[Cell, str], band: set[Cell], north_shore: Cell) -> list[dict]:
    """`ground`: the A1 box's cells after the edits (band cells as the region leaves them)."""
    box = BOXES["a1"][0]
    seam = {c for s in SEAMS.values() for c in s.rect.cells()}

    def at(c: Cell) -> str | None:
        if not box.contains(*c):
            return None
        if c in seam:
            return "m"
        return WATER if c in band else ground[c]

    land = _flood(lambda c: at(c) in WALK, north_shore)
    water = {c for c in box.cells() if at(c) == WATER}
    aldi = _flood(lambda c: c in water, BASIN_SEEDS["aldi"])
    return [
        {"id": "a1_mainland", "name": "Northern Mainland", "rects": row_rects(land), "encounters": MAINLAND},
        {"id": "a1_aldi", "name": "Aldi Sea", "modes": ["ship"], "rects": row_rects(aldi), "encounters": ALDI},
        {"id": "a1_north_sea", "name": "Northern Sea", "modes": ["ship"], "rects": row_rects(water - aldi),
         "encounters": NORTH_SEA},
    ]
