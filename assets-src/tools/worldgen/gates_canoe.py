"""NW2's canoe-gate checks (docs/NW2_EDITS_PLAN.md 8; NW2-0): `canoe_gates`, `gorges`, `relations`, `duergar_south`.

Each runs over the records the specs declare (`bundle.Gorge`, `Relation`, `Apart`) and nothing else, so with none
declared it is `OK (none declared)` and the code lands before the geography (plan 14):

- **canoe_gates** (all on): for each gorge site, over every start of its stage (prewalk's starts, the glossary's
  "from every start" = from any of them): (i) unreachable on foot; (ii) reachable on foot+canoe; (iii) with the
  record's `dock` withheld from the starts, unreachable on foot+canoe too.
- **gorges** (all on): on (ii)'s least-canoe path (fewest canoe steps, then fewest steps, over the starts): forced
  canoe steps >= GORGE_M, pass cells >= GORGE_N, and E_canoe = sum over its canoe steps of MODE_RATE.canoe / mean
  zone rate >= E_CANOE_MIN, at the rates `world_balance` wrote. A **pass cell**: a canoe cell of the path with no
  walkable 4-neighbour and a Mountain cell within 2 cells on both sides perpendicular to its flow (the path's step
  into the next cell; the last cell takes the step into it).
- **relations** (patches off): each `Relation`'s rule on the entrance cells (`canal`: the canal patch).
- **duergar_south** (canal off unless the record says on, bridge on): each `Apart` pair joined neither on foot nor
  on foot+canoe.

`zone_means` (the per-mode mean step of each cell's zone, as `EncounterSystem` picks it: the first zone whose rects
hold the cell and whose `modes` hold the mode) is shared with `gates_hike`.
"""
from __future__ import annotations

import heapq
import math

import numpy as np

from . import spec as _spec  # noqa: F401  (puts layouts/ on the path, for world_api)
from world_api import E_CANOE_MIN, GORGE_M, GORGE_N, MODE_RATE  # noqa: E402
from . import prewalk  # noqa: E402
from .gates import canoe, cells, joined, walk, with_patches
from .geom import flood

WET = ("r", "≈")
DEFAULT_MODES = ("walking", "canoe")         # EncounterSystem.DEFAULT_ZONE_MODES
D4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def none_declared(**extra) -> dict:
    return {"ok": True, "note": "none declared", "why": [], **extra}


def zone_means(doc: dict, shape) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    """mode -> (zone id per cell, "" for the map's own table; its mean step count)."""
    r = doc["encounterRate"]
    base = (r["min"] + r["max"]) / 2
    out = {}
    for mode in DEFAULT_MODES:
        zid, mean = np.full(shape, "", object), np.full(shape, base, float)
        for z in reversed(doc.get("encounterZones") or []):        # the first zone listed wins
            if mode not in (z.get("modes") or DEFAULT_MODES):
                continue
            zr = z.get("encounterRate") or r
            for x0, y0, x1, y1 in z["rects"]:
                zid[y0:y1 + 1, x0:x1 + 1] = z["id"]
                mean[y0:y1 + 1, x0:x1 + 1] = (zr["min"] + zr["max"]) / 2
        out[mode] = (zid, mean)
    return out


def fights(h: np.ndarray, path: list, zm: dict) -> tuple[float, list]:
    """(expected fights over the steps of `path`, its cells in no zone): MODE_RATE[mode] / mean step per cell entered,
    the mode the step ends in (canoe on River / Lake)."""
    e, loose = 0.0, []
    for x, y in path[1:]:
        mode = "canoe" if h[y, x] in WET else "walking"
        zid, mean = zm[mode]
        e += MODE_RATE[mode] / mean[y, x]
        if not zid[y, x]:
            loose.append((x, y))
    return e, loose


def least_canoe(h: np.ndarray, starts, goal) -> list | None:
    """The path over foot+canoe cells minimising canoe steps first and steps second (Dijkstra on that pair)."""
    ok, wet = canoe(h), np.isin(h, WET)
    H, W = h.shape
    best = {}
    heap = []
    for c in dict.fromkeys(tuple(s) for s in starts):
        if ok[c[1], c[0]]:
            best[c] = (0, 0)
            heapq.heappush(heap, (0, 0, c, None))
    prev = {}
    while heap:
        k, n, c, p = heapq.heappop(heap)
        if c in prev or best.get(c, (k, n)) < (k, n):
            continue
        prev[c] = p
        if c == tuple(goal):
            out = [c]
            while prev[out[-1]] is not None:
                out.append(prev[out[-1]])
            return out[::-1]
        for dx, dy in D4:
            x, y = c[0] + dx, c[1] + dy
            if 0 <= x < W and 0 <= y < H and ok[y, x] and (x, y) not in prev:
                v = (k + int(wet[y, x]), n + 1)
                if v < best.get((x, y), (1 << 30, 0)):
                    best[(x, y)] = v
                    heapq.heappush(heap, (*v, (x, y), c))
    return None


def pass_cells(h: np.ndarray, path: list) -> list:
    w, H, W = walk(h), h.shape[0], h.shape[1]
    out = []

    def rock(x, y):
        return 0 <= x < W and 0 <= y < H and h[y, x] == "m"
    for i, (x, y) in enumerate(path):
        if h[y, x] not in WET or any(0 <= x + dx < W and 0 <= y + dy < H and w[y + dy, x + dx] for dx, dy in D4):
            continue
        a, b = (path[i], path[i + 1]) if i + 1 < len(path) else (path[i - 1], path[i])
        px, py = -(b[1] - a[1]), b[0] - a[0]
        if any(rock(x + k * px, y + k * py) for k in (1, 2)) and any(rock(x - k * px, y - k * py) for k in (1, 2)):
            out.append((x, y))
    return out


def _starts(g, meta, stages, sid, spots, withhold=()) -> list:
    return prewalk.starts_of(g, meta, stages, sid, spots, withhold=withhold)["cells"]


def canoe_gates(g, meta, gorges: list, spots: dict, stages: dict | None = None) -> dict:
    if not gorges:
        return none_declared()
    stages = stages or prewalk.load_stages()
    h, S = with_patches(g, meta), meta["entrances"]
    why, res = [], {}
    for r in gorges:
        x, y = S[r.site]
        st = _starts(g, meta, stages, r.stage, spots)
        foot, boat = bool(flood(walk(h), st)[y, x]), bool(flood(canoe(h), st)[y, x])
        res[r.site] = {"stage": r.stage, "foot": foot, "canoe": boat}
        if foot:
            why.append(f"canoe gate {r.site} {cells(meta, [(x, y)])}: reached on foot from {r.stage}'s starts")
        if not boat:
            why.append(f"canoe gate {r.site} {cells(meta, [(x, y)])}: not reached on foot+canoe from {r.stage}'s "
                       "starts")
        if r.dock:
            cut = bool(flood(canoe(h), _starts(g, meta, stages, r.stage, spots, (r.dock,)))[y, x])
            res[r.site]["without_" + r.dock] = cut
            if cut:
                why.append(f"canoe gate {r.site}: still reached on foot+canoe with dock {r.dock} withheld")
    note = "; ".join(f"{k} {v['stage']}: foot {'yes' if v['foot'] else 'no'}, canoe {'yes' if v['canoe'] else 'no'}"
                     for k, v in res.items())
    return {"ok": not why, "note": note, **res, "why": why}


def gorges(g, meta, recs: list, spots: dict, doc: dict, stages: dict | None = None) -> dict:
    if not recs:
        return none_declared()
    stages = stages or prewalk.load_stages()
    h, S, zm = with_patches(g, meta), meta["entrances"], zone_means(doc, g.shape)
    why, res = [], {}
    for r in recs:
        path = least_canoe(h, _starts(g, meta, stages, r.stage, spots), S[r.site])
        if path is None:
            why.append(f"gorge {r.site} ({r.route}): no foot+canoe path from {r.stage}'s starts")
            continue
        wet = [c for c in path[1:] if h[c[1], c[0]] in WET]
        pc = pass_cells(h, path)
        e = sum(MODE_RATE["canoe"] / zm["canoe"][1][y, x] for x, y in wet)
        res[r.site] = {"steps": len(path) - 1, "canoe": len(wet), "pass": len(pc), "E": round(e, 2)}
        if len(wet) < GORGE_M or len(pc) < GORGE_N or e < E_CANOE_MIN:
            why.append(f"gorge {r.site} ({r.route}, {r.stage}): {len(wet)} forced canoe steps (want >= {GORGE_M}), "
                       f"{len(pc)} pass cells (want >= {GORGE_N}), E_canoe {e:.2f} (want >= {E_CANOE_MIN}); "
                       f"its canoe cells {cells(meta, wet)}")
    note = "; ".join(f"{k} {v['canoe']} canoe steps of {v['steps']}, {v['pass']} pass cells, E {v['E']}"
                     for k, v in res.items())
    return {"ok": not why, "note": note, **res, "why": why}


def _at(meta, name: str, low: bool = False) -> tuple[float, float]:
    if name != "canal":
        return tuple(meta["entrances"][name])
    cs = meta["canal"]
    return (sum(c[0] for c in cs) / len(cs), min(c[1] for c in cs) if low else sum(c[1] for c in cs) / len(cs))


def relations(meta, recs: list) -> dict:
    if not recs:
        return none_declared()
    why, res = [], {}
    for r in recs:
        (ax, ay), (bx, by) = _at(meta, r.a), _at(meta, r.b, low=r.kind == "north_of")
        if r.kind == "north_of":
            v, ok = ay - by, ay <= by - r.value
            want = f"{r.a}.y <= {r.b}.y - {r.value:g}"
        elif r.kind == "bearing":
            brg = math.degrees(math.atan2(ax - bx, by - ay)) % 360
            v = min(abs(brg - r.deg) % 360, 360 - abs(brg - r.deg) % 360)
            ok, want = v <= r.value, f"{r.a}'s bearing from {r.b} within {r.value:g} of {r.deg:g}"
        elif r.kind == "min_dist":
            v = math.hypot(ax - bx, ay - by)
            ok, want = v >= r.value, f"dist({r.a}, {r.b}) >= {r.value:g}"
        else:
            v, ok, want = 0, False, f"a known kind (north_of, bearing, min_dist), not {r.kind!r}"
        res[f"{r.a}-{r.b} {r.kind}"] = round(v, 1)
        if not ok:
            why.append(f"relation {r.a} {cells(meta, [tuple(meta['entrances'][r.a])])} {r.kind}: {v:.1f}; want {want}")
    return {"ok": not why, "note": ", ".join(f"{k} {v}" for k, v in res.items()), "figures": res, "why": why}


def duergar_south(g, meta, recs: list) -> dict:
    if not recs:
        return none_declared()
    S, why, res = meta["entrances"], [], {}
    for r in recs:
        h = with_patches(g, meta, bridge=True, canal=r.canal)
        foot, boat = joined(walk(h), S[r.a], S[r.b]), joined(canoe(h), S[r.a], S[r.b])
        res[r.name] = {"foot": foot, "canoe": boat}
        if foot or boat:
            why.append(f"{r.name}: {r.a} {cells(meta, [S[r.a]])} and {r.b} {cells(meta, [S[r.b]])} join "
                       f"{'on foot' if foot else 'on foot+canoe'} (canal {'on' if r.canal else 'off'}, bridge on)")
    return {"ok": not why, "note": ", ".join(f"{k} apart" for k in res), **res, "why": why}
