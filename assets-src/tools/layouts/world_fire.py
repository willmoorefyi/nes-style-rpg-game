"""Region FIRE of the world (docs/WORLD_PLAN.md 2.4, 2.6-2.8, 4.4; FIR-O): the south-east continent.

Crescent Lake's shore holds the town (FIR-T's `fire/town_crescent_site.py`: icon, land gate, dock) and the crescent
lake; a mountain ring (barrier `crescent_ring`) walls it off from the south lands, which only the lake's two rivers
reach: R-volcano sinks in the ash fields by Gurgu Volcano (`fir_volcano`), R-ice beside the frost hollow of the Ice
Cavern (`fir_ice`); the dunes of the buried hull (`fir_desert`) are on foot from there. The south lands' north edge
is W_south's cliff (rows 146-147, both cavern mouths open south below it) and the south end of W_east. Ground:
`fire/world_fire_ground.py` (its docstring holds the design note); zones, hazards, landmarks and the hull's hatch:
`fire/world_fire_data.py`.
"""
from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent / "fire"))
import town_crescent_site as site  # noqa: E402
import world_fire_data as D  # noqa: E402
import world_fire_ground as G  # noqa: E402
from overworld_zones import row_rects  # noqa: E402
from world_api import BOXES, UNSET, Cell, RegionOut  # noqa: E402
from world_geom import bbox  # noqa: E402

WALK = frozenset(".fs,")
ENTRANCES = {site.ANCHOR: list(site.GATE), "fir_volcano": [G.VOLCANO[0] + 1, G.VOLCANO[1] + 2],
             "fir_ice": [G.ICE_MOUTH[0] + 1, G.ICE_MOUTH[1] + 2], "fir_desert": [D.HATCH[0], D.HATCH[1] + 1]}
TRANSITIONS = [{"x": site.DOOR[0], "y": site.DOOR[1], "targetMap": site.TOWN, "targetEntrance": "gate"},
               {"x": G.VOLCANO[0] + 1, "y": G.VOLCANO[1] + 1, "targetMap": "gurgu-b1", "targetEntrance": "arrival"},
               {"x": G.ICE_MOUTH[0] + 1, "y": G.ICE_MOUTH[1] + 1, "targetMap": "ice-cavern-b1",
                "targetEntrance": "arrival"}]


def _mine(band: set[Cell]) -> np.ndarray:
    m = np.zeros((G.WORLD_H, G.WORLD_W), bool)
    for r in BOXES["fire"]:
        m[r.y0:r.y1 + 1, r.x0:r.x1 + 1] = True
    for x, y in band:
        m[y, x] = False
    return m


def _flood(g: np.ndarray, seeds: list[Cell], blocked: set[Cell]) -> set[Cell]:
    seen, q = set(), deque()
    for s in seeds:
        seen.add(s)
        q.append(s)
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
    g, cells = G.ground(mine)
    objects = D.objects(site)
    blocked = {(o["x"] + i, o["y"] + j) for o in objects for j, row in enumerate(o["parts"]) for i, p in enumerate(row)
               if p and [i, j] not in (o.get("walk_cells") or [])}       # alpha decos counted as solid
    blocked.add(D.HATCH)
    south_roots = [tuple(ENTRANCES[a]) for a in ("fir_volcano", "fir_ice", "fir_desert")]
    north = _flood(g, [tuple(site.GATE)], blocked)
    south = _flood(g, south_roots, blocked)
    for y, x in zip(*np.nonzero(mine)):           # land no entrance reaches on foot: rock
        if g[y, x] in WALK and (x, y) not in north | south and (x, y) not in blocked:
            g[y, x] = "m"
    assert not north & south, "the ring leaks: Crescent's shore and the south lands meet on foot"
    by_zone: dict[str, set[Cell]] = {}
    for y, x in zip(*np.nonzero(mine)):
        z = D.zone_of(int(x), int(y), g[y, x], (x, y) in south)
        if z:
            by_zone.setdefault(z, set()).add((int(x), int(y)))
    for x, y in band:                              # band water in FIRE's box: the Aldi strip or the outer seas
        if any(r.contains(x, y) for r in BOXES["fire"]) and g[y, x] == "o":
            by_zone.setdefault(D.zone_of(x, y, "o", False), set()).add((x, y))
    b = bbox(BOXES["fire"])
    rows = ["".join(g[y, x] if mine[y, x] else UNSET for x in range(b.x0, b.x1 + 1)) for y in range(b.y0, b.y1 + 1)]
    a, s = G.RING_SEEDS
    checks = {"min_blob": {"mountain": 3, "sand": 3, "forest": 3, "ocean_inlet": 2}, "warp_leaves": True,
              "reach_roots": list(ENTRANCES), "unreachable_ok": list(ENTRANCES)}
    return RegionOut(
        ground=rows, objects=objects, npcs=[dict(D.HULL_NPC)], transitions=[dict(t) for t in TRANSITIONS],
        entrances={k: list(v) for k, v in ENTRANCES.items()}, docks=[dict(site.DOCK)], hazards=D.hazards(g, row_rects),
        encounterZones=D.zones(by_zone, row_rects), battleBackgrounds={"zones": D.backdrops()}, checks=checks,
        ambient=[dict(a) for a in D.SMOKE],
        barriers={"crescent_ring": (set(cells["ring"]), a, s)}, walls=cells["walls"],
        notes=[f"fire: shore {len(north)} cells, south lands {len(south)} cells, ring {len(cells['ring'])} cells"])
