"""Act 1's promises as world checks on the NW world (docs/NATURAL_WORLD_PLAN.md 3.6.3; NW-0's pilot; NW-3 owns it).

- the tomb pocket is reachable on foot, only over the east footbridge;
- the temple door is reachable from Cornelia before BRIDGE_BUILT; Matoya and Pravoka after it;
- Pravoka's channel keeps at least 6 Water cells on every channel row;
- beyond the bridge the land walkable from `north_shore` is larger than the peninsula (OW-15);
- the boulders stand on grass; the act-1 roads are routed;
- `walks`: the four act-1 walks within +-10 % of today's (3.6.3's feel table), BFS on today's ground and the new.
Cells come from today's act-1 constants (`world_specs/a1_today.py`) by the pin rule.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from worldgen import spec as S  # noqa: E402
from worldgen.gates import joined, walk, with_patches  # noqa: E402
from worldgen.geom import bfs_dist, flood  # noqa: E402
from world_specs import a1_today as T  # noqa: E402

CHANNEL_MIN = 6
WALK_BAND = (0.9, 1.1)


def act1(g: np.ndarray, meta: dict) -> dict:
    E = meta["entrances"]
    on, off = with_patches(g, meta), with_patches(g, meta, bridge=False)
    r = {}
    tomb = S.a1_pin(T.TOMB_END)
    r["tomb_reachable"] = joined(walk(off), E["cornelia"], tomb)
    h = off.copy()
    for q in T.FOOTBRIDGE:
        x, y = S.a1_pin(q)
        h[y, x] = "r"
    r["tomb_only_over_footbridge"] = not joined(walk(h), E["cornelia"], tomb)
    r["temple_before_bridge"] = joined(walk(off), E["cornelia"], E["temple"])
    r["matoya_after_bridge"] = joined(walk(on), E["cornelia"], E["a1_matoya"])
    r["pravoka_after_bridge"] = joined(walk(on), E["cornelia"], E["a1_pravoka"])
    x0, y0, x1, y1 = T.CHANNEL
    rows = []
    for y in range(y0, y1 + 1):
        a, yy = S.a1_pin((x0, y))
        rows.append(sum(1 for x in range(a, a + 40) if all(on[yy, xx] == "o" for xx in range(a, x + 1))))
    r["channel_min_water"] = min(rows)
    pen = flood(walk(off), [E["cornelia"]]).sum()
    beyond = flood(walk(off), [E["north_shore"]]).sum()
    r["beyond_bridge_cells"], r["peninsula_cells"] = int(beyond), int(pen)
    r["boulders_on_grass"] = all(g[y, x] == "." for x, y in (S.a1_pin(q) for q in T.BOULDERS))
    r["roads_routed"] = meta["roads_ok"]
    ok = (r["tomb_reachable"] and r["tomb_only_over_footbridge"] and r["temple_before_bridge"]
          and r["matoya_after_bridge"] and r["pravoka_after_bridge"] and r["channel_min_water"] >= CHANNEL_MIN
          and beyond > pen and r["boulders_on_grass"] and all(r["roads_routed"]))
    return {"ok": bool(ok), **r}


def _walks(h_on, h_off, cells) -> dict:
    out = {}
    for name, a, b, br in cells:
        out[name] = int(bfs_dist(walk(h_on if br else h_off), [a])[b[1], b[0]])
    return out


def walks(g: np.ndarray, meta: dict) -> dict:
    tg = T.chars()
    t_on, t_off = tg.copy(), tg.copy()
    for x, y in T.BRIDGE_PATCH:
        t_on[y, x] = "="
    for x, y in T.BRIDGE_PATCH[:4]:
        t_off[y, x] = "o"
    E = T.entrances()
    tw = [("south gate -> bridge gate", tuple(E["cornelia"]), T.BRIDGE_GATE, False),
          ("Cornelia -> Temple door", tuple(E["cornelia"]), tuple(E["temple"]), False),
          ("bridge -> Pravoka gate", T.BRIDGE_GATE, tuple(E["a1_pravoka"]), True),
          ("bridge -> Matoya's door", T.BRIDGE_GATE, tuple(E["a1_matoya"]), True)]
    now = _walks(t_on, t_off, tw)
    new = _walks(with_patches(g, meta), with_patches(g, meta, bridge=False),
                 [(n, S.a1_pin(a), S.a1_pin(b), br) for n, a, b, br in tw])
    rows = {n: {"today": now[n], "new": new[n],
                "ratio": round(new[n] / now[n], 3) if now[n] > 0 and new[n] >= 0 else None} for n in now}
    ok = all(v["ratio"] is not None and WALK_BAND[0] <= v["ratio"] <= WALK_BAND[1] for v in rows.values())
    return {"ok": ok, **rows}
