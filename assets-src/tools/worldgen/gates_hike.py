"""NW2's `hikes` check (docs/NW2_EDITS_PLAN.md 7, 8; NW2-0), over the `bundle.Hike` records the specs declare (none
before NW2-W / NW2-N: `OK (none declared)`).

With every patch on, for each declared hike (the bounds and modes from `world-anchors.yaml`'s `hike:` block, the
one source, D-NW2-12):
- **floor:** no landing cell (`LANDING`, not taken) within K steps of the site's arrival cell on foot+canoe (the
  canoe is held from S14, before every north stage); the figure is the nearest landing's distance, and the line
  also gives the minimum over the declared sites;
- **cap:** the hike's `landing` spot is a landing cell within U steps in the site's mode (`sites`: walking or canoe,
  foot+canoe), measured on the shortest path in that mode;
- **zones:** every cell of that path is in an encounter zone (not the map's own table);
- **E_hike** = sum over the path's steps of MODE_RATE[mode] / mean zone rate >= E_HIKE_MIN (`gates_canoe.fights`).
"""
from __future__ import annotations

from collections import deque

import numpy as np

from . import spec as _spec  # noqa: F401  (puts layouts/ on the path, for world_api)
from world_api import E_HIKE_MIN  # noqa: E402
from .gates import LANDING, canoe, cells, walk, with_patches  # noqa: E402
from .gates_canoe import D4, fights, none_declared, zone_means  # noqa: E402
from .geom import bfs_dist  # noqa: E402


def path_to(passable: np.ndarray, start, goal) -> list | None:
    """A shortest 4-connected path from `start` to `goal` over `passable` (BFS, D4 order), or None."""
    H, W = passable.shape
    prev, q = {tuple(start): None}, deque([tuple(start)])
    while q:
        c = q.popleft()
        if c == tuple(goal):
            out = [c]
            while prev[out[-1]] is not None:
                out.append(prev[out[-1]])
            return out[::-1]
        for dx, dy in D4:
            n = (c[0] + dx, c[1] + dy)
            if 0 <= n[0] < W and 0 <= n[1] < H and passable[n[1], n[0]] and n not in prev:
                prev[n] = c
                q.append(n)
    return None


def hikes(g, meta, recs: list, hike: dict, spots: dict, doc: dict, taken: set = frozenset()) -> dict:
    if not recs:
        return none_declared()
    h = with_patches(g, meta)
    K, U = hike["floor"], hike["cap"]
    land = np.isin(h, LANDING)
    for x, y in set(taken) | {tuple(v) for v in meta["entrances"].values()}:
        land[y, x] = False
    zm, S, why, res = zone_means(doc, g.shape), meta["entrances"], [], {}
    for r in recs:
        ex, ey = S[r.site]
        dist = bfs_dist(canoe(h), [(ex, ey)])
        near = dist[land & (dist >= 0)]
        floor = int(near.min()) if near.size else None
        mode = hike["sites"].get(r.site, "walking")
        sp = spots.get(r.landing)
        if sp is None:
            why.append(f"hike {r.site}: no spot {r.landing}")
            continue
        lx, ly = sp["at"]
        path = path_to(canoe(h) if mode == "canoe" else walk(h), (ex, ey), (lx, ly))
        cap = len(path) - 1 if path else None
        e, loose = fights(h, path, zm) if path else (0.0, [])
        res[r.site] = {"floor": floor, "cap": cap, "mode": mode, "E": round(e, 2), "no_zone": len(loose)}
        if floor is not None and floor < K:
            why.append(f"hike {r.site} {cells(meta, [(ex, ey)])}: a landing {floor} steps away on foot+canoe "
                       f"(want >= {K})")
        if not land[ly, lx]:
            why.append(f"hike {r.site}: its landing {r.landing} {cells(meta, [(lx, ly)])} is not a free landing cell")
        if cap is None or cap > U:
            why.append(f"hike {r.site}: its landing {r.landing} is " + (f"{cap} steps" if path else "unreachable")
                       + f" away {'on foot' if mode == 'walking' else 'on foot+canoe'} (want <= {U})")
        if loose:
            why.append(f"hike {r.site}: its path crosses cells in no zone at {cells(meta, loose)}")
        if path and e < E_HIKE_MIN:
            why.append(f"hike {r.site}: E_hike {e:.2f} over {cap} steps (want >= {E_HIKE_MIN})")
    floors = [v["floor"] for v in res.values() if v["floor"] is not None]
    note = "; ".join(f"{k} d {v['floor']} / {v['cap']} ({v['mode']}), E {v['E']}" for k, v in res.items())
    return {"ok": not why, "note": note + (f"; floor min {min(floors)}" if floors else ""), **res, "why": why}
