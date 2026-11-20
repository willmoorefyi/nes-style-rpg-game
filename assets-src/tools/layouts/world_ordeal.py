"""Region ORDEAL of the world (docs/WORLD_PLAN.md 2.4, 2.8, 4.5; ORD-O): the Citadel plateau and the Cardia isles.

An airship-only region (no dock): a high plateau ringed by peaks holds the Citadel of Trials (`ord_citadel`, door
into `citadel-1f`) above its landing meadow; east of it six isles, Bahamut's horseshoe isle with the cave into
`bahamut-cave` (`ord_bahamut`) and the hermit's isle among them. Each isle has a named landing cell
(`ord_isle_<name>`), so every walkable cell of the region is reached from a root. Ground: `ordeal/world_ordeal_ground.py`
(its docstring holds the design note); zones, landmarks, the hermit's slate and the doors: `ordeal/world_ordeal_data.py`.
"""
from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent / "ordeal"))
import world_ordeal_data as D  # noqa: E402
import world_ordeal_ground as G  # noqa: E402
from overworld_zones import row_rects  # noqa: E402
from world_api import BOXES, UNSET, Cell, RegionOut  # noqa: E402
from world_geom import bbox  # noqa: E402

WALK = frozenset(".fs,")
# NW-1 (docs/NATURAL_WORLD_PLAN.md 5.2): the places quest.yaml and the scenarios name (a stage entry, the airship)
SPOTS = {
    "ord_s_citadel": {"at": [75, 31], "kind": "land"},          # below the Citadel's gate: S19
    "ord_s_citadel_airship": {"at": [75, 32], "kind": "landing"},   # the meadow below it: S19
    "ord_s_bahamut_airship": {"at": [106, 55], "kind": "landing"},  # by Bahamut's cave: scenario w_s19_start
}


def _mine(band: set[Cell]) -> np.ndarray:
    m = np.zeros((G.WORLD_H, G.WORLD_W), bool)
    for r in BOXES["ordeal"]:
        m[r.y0:r.y1 + 1, r.x0:r.x1 + 1] = True
    for x, y in band:
        m[y, x] = False
    return m


def _flood(g: np.ndarray, seeds: list[Cell], blocked: set[Cell]) -> set[Cell]:
    seen, q = set(seeds), deque(seeds)
    while q:
        x, y = q.popleft()
        for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if n not in seen and n not in blocked and 0 <= n[0] < G.WORLD_W and 0 <= n[1] < G.WORLD_H \
                    and g[n[1], n[0]] in WALK:
                seen.add(n)
                q.append(n)
    return seen


def build(band: set[Cell]) -> RegionOut:
    mine = _mine(band)
    g, masses = G.ground(mine)
    objects = D.objects()
    blocked = {(o["x"] + i, o["y"] + j) for o in objects for j, row in enumerate(o["parts"]) for i, p in enumerate(row)
               if p and [i, j] not in (o.get("walk_cells") or [])}
    reached = _flood(g, [tuple(v) for v in D.ENTRANCES.values()], blocked)
    for y, x in zip(*np.nonzero(mine)):           # land no landing reaches on foot: rock
        if g[y, x] in WALK and (x, y) not in reached and (x, y) not in blocked:
            g[y, x] = "m"
    mass_of = {c: k for k, cells in masses.items() for c in cells}
    by_zone: dict[str, set[Cell]] = {}
    for y, x in zip(*np.nonzero(mine)):
        z = D.zone_of(g[y, x], mass_of.get((int(x), int(y))))
        if z:
            by_zone.setdefault(z, set()).add((int(x), int(y)))
    for x, y in band:                              # band water in ORDEAL's box: the sound
        if any(r.contains(x, y) for r in BOXES["ordeal"]):
            by_zone.setdefault("ord_sea", set()).add((x, y))
    b = bbox(BOXES["ordeal"])
    rows = ["".join(g[y, x] if mine[y, x] else UNSET for x in range(b.x0, b.x1 + 1)) for y in range(b.y0, b.y1 + 1)]
    checks = {"min_blob": {"mountain": 3, "forest": 3, "ocean_inlet": 2}, "warp_leaves": True,
              "reach_roots": list(D.ENTRANCES), "unreachable_ok": list(D.ENTRANCES)}
    sizes = ", ".join(f"{k} {len([c for c in v if c in reached])}" for k, v in masses.items())
    return RegionOut(
        ground=rows, objects=objects, inspect=[dict(i) for i in D.INSPECT], transitions=[dict(t) for t in D.TRANSITIONS],
        entrances={k: list(v) for k, v in D.ENTRANCES.items()}, encounterZones=D.zones(by_zone, row_rects),
        battleBackgrounds={"zones": D.backdrops()}, checks=checks, notes=[f"ordeal: walkable cells {sizes}"],
        spots={k: dict(v) for k, v in SPOTS.items()})
