"""Terrain checks for the map compiler: road ends, ground blobs, ocean inlets, rivers and ground contrast
(the `road_check`, `min_blob`, `river_check` and `contrast` options; see map_checks.py)."""
from __future__ import annotations

from typing import Iterable

import numpy as np

from map_checks_util import _cells, _touches
from map_graph import BLOCKED, DIRS, Cell, components

RIVER_SOURCES = ("water", "lake", "mountain")
LUMA_601 = np.array([0.299, 0.587, 0.114], np.float32)
CONTRAST_SAMPLE = 8                                 # px: the centre square of a cell that is sampled


# ───────────────────────────── road ends ─────────────────────────────

def road_caps(road: np.ndarray, cap_width: int = 2) -> list[list[Cell]]:
    """Ends of the road network: isolated road cells, 1-wide tips, and caps of roads up to cap_width wide (a run of
    cells across the road, all with road behind and none ahead, bounded by non-road on both sides)."""
    hgt, wid = road.shape
    r = lambda x, y: 0 <= x < wid and 0 <= y < hgt and bool(road[y, x])  # noqa: E731
    caps: list[list[Cell]] = []
    for y in range(hgt):
        for x in range(wid):
            if road[y, x] and not any(r(x + dx, y + dy) for dx, dy in DIRS):
                caps.append([(x, y)])
    for dx, dy in DIRS:
        px, py = abs(dy), abs(dx)                       # along the cap (perpendicular to the road)
        ok = lambda x, y: r(x, y) and not r(x + dx, y + dy) and r(x - dx, y - dy)  # noqa: E731
        done: set[Cell] = set()
        for y in range(hgt):
            for x in range(wid):
                if (x, y) in done or not ok(x, y) or ok(x - px, y - py):
                    continue                            # only start at the first cell of a run
                run = [(x, y)]
                while ok(run[-1][0] + px, run[-1][1] + py):
                    run.append((run[-1][0] + px, run[-1][1] + py))
                done.update(run)
                (ax, ay), (bx, by) = run[0], run[-1]
                if len(run) <= cap_width and not r(ax - px, ay - py) and not r(bx + px, by + py):
                    caps.append(run)
    return caps


def _road_check(src: dict, c, spec: dict) -> list[str]:
    errors = []
    mats = spec.get("materials", ["dirt"])
    road = np.isin(c.mat, list(mats)) | (c.mat == "bridge")
    islands_ok = {tuple(p) for p in spec.get("islands_ok") or []}
    comps = components(road)
    # a stub that is all bridge (a broken span's far half), or a listed island, is not a stray network
    comps = [cs for cs in comps if not (all(c.mat[y, x] == "bridge" for x, y in cs) or islands_ok & set(cs))] or comps[:1]
    if len(comps) > 1:
        comps.sort(key=len, reverse=True)
        errors.append(f"road_check: the roads form {len(comps)} separate networks; smaller ones at "
                      + ", ".join(f"({cs[0][0]}, {cs[0][1]}) [{len(cs)} cells]" for cs in comps[1:6]))
    allowed = np.zeros_like(road)
    marks = [(t["x"], t["y"]) for t in c.transitions] + [tuple(v) for v in c.entrances.values()]
    marks += [(g["x"], g["y"]) for g in src.get("keyItemGates") or []] + [tuple(e) for e in spec.get("ends") or []]
    for x, y in marks:
        if 0 <= x < c.width and 0 <= y < c.height:
            allowed[y, x] = True
    bad, stubs = [], []
    for cap in road_caps(road, spec.get("cap_width", 2)):
        if any(c.mat[y, x] == "bridge" or allowed[y, x] for x, y in cap):
            continue
        if _touches(allowed, cap):
            if spec.get("no_stubs"):             # NW 3.10: a road ends on its gate / end cell, never one cell off it
                stubs.append(cap[0])
            continue
        bad.append(cap[0])
    if bad:
        errors.append(f"road_check: dead ends that reach no gate, door, bridge or listed end: {_cells(bad, 10)}")
    if stubs:
        errors.append("road_check: stubs ending one cell off a gate, door or listed end (no_stubs): "
                      + _cells(stubs, 10))
    # icons hiding roads (opt-in: towns have stalls and fountains on cobble on purpose)
    under = [(x, y) for (x, y) in c.owner if road[y, x] and int(c.collision[y, x]) in BLOCKED] if spec.get("check_under") else []
    if under:
        errors.append(f"road_check: road cells under a blocked object: {_cells(under)}")
    return errors


def _min_blob(mat: np.ndarray, spec: dict) -> list[str]:
    errors = []
    for name, least in spec.items():
        if name == "ocean_inlet":
            bad = ocean_inlets(mat, int(least))
            if bad:
                errors.append(f"min_blob: ocean narrower than {least} cells (an inlet) at {_cells(bad)}")
            continue
        small = [cs for cs in components(mat == name) if len(cs) < least]
        if small:
            errors.append(f"min_blob: {name} patches smaller than {least} cells at "
                          + _cells([min(cs, key=lambda p: (p[1], p[0])) for cs in small]))
    return errors


def ocean_inlets(mat: np.ndarray, least: int) -> list[Cell]:
    """Ocean cells in a horizontal or vertical water run (ocean or bridge) shorter than `least` that is closed by
    non-water on both sides (the map edge counts as open water)."""
    water = np.isin(mat, ["ocean", "bridge"])
    ocean = mat == "ocean"
    bad = set()
    for transpose in (False, True):                   # rows, then columns
        w, o = (water.T, ocean.T) if transpose else (water, ocean)
        for line in range(w.shape[0]):
            row, n, i = w[line], w.shape[1], 0
            while i < n:
                if not row[i]:
                    i += 1
                    continue
                j = i
                while j + 1 < n and row[j + 1]:
                    j += 1
                if i > 0 and j < n - 1 and j - i + 1 < least:
                    bad.update(((line, k) if transpose else (k, line)) for k in range(i, j + 1) if o[line, k])
                i = j + 1
    return sorted(bad, key=lambda p: (p[1], p[0]))


def _river_check(mat: np.ndarray, sources: tuple[str, ...]) -> list[str]:
    errors = []
    river = mat == "river"
    bridge = mat == "bridge"
    over = np.zeros_like(river)
    bridges = [b for b in components(bridge) if _touches(river, b)]
    for b in bridges:
        for x, y in b:
            over[y, x] = True
    src_mask = np.isin(mat, list(sources))
    ocean = mat == "ocean"
    for comp in components(river | over):
        if not _touches(src_mask, comp):
            errors.append(f"river_check: the river at {_cells(comp[:1])} has no source ({', '.join(sources)})")
        if not _touches(ocean, comp):
            errors.append(f"river_check: the river at {_cells(comp[:1])} never reaches the ocean")
    hgt, wid = mat.shape
    for b in bridges:
        xs, ys = sorted({x for x, _ in b}), sorted({y for _, y in b})
        for axis, span, (lo, hi) in ((0, xs, (ys[0] - 1, ys[-1] + 1)), (1, ys, (xs[0] - 1, xs[-1] + 1))):
            # axis 0: the river runs north-south under the bridge (rows above / below); 1: east-west
            for side in (lo, hi):
                if axis == 0:
                    if not 0 <= side < hgt or not any(river[side, x] for x in span):
                        continue
                    run = _run(river[side, :], [x for x in span if river[side, x]][0])
                else:
                    if not 0 <= side < wid or not any(river[y, side] for y in span):
                        continue
                    run = _run(river[:, side], [y for y in span if river[y, side]][0])
                if run != span:
                    where = f"row {side}" if axis == 0 else f"column {side}"
                    errors.append(f"river_check: beside the bridge at {_cells(b[:1])} the river in {where} uses "
                                  f"{run[0]}..{run[-1]}, not the bridge span {span[0]}..{span[-1]}")
    return errors


def _run(line: np.ndarray, i: int) -> list[int]:
    a = b = i
    while a - 1 >= 0 and line[a - 1]:
        a -= 1
    while b + 1 < len(line) and line[b + 1]:
        b += 1
    return list(range(a, b + 1))


# ───────────────────────────── ground contrast ─────────────────────────────

def contrast_pairs(src: dict, c, a: str, b: str) -> tuple[set[Cell], set[Cell]]:
    """Cells of ground char `a` with a 4-neighbour of char `b`, and those neighbours; cells under object art are
    left out (they show the object, not the ground)."""
    rows = src["ground"].rstrip("\n").split("\n")
    bare = (lambda x, y: c.art_share is None or c.art_share[y, x] == 0)  # noqa: E731
    sa: set[Cell] = set()
    sb: set[Cell] = set()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != a or not bare(x, y):
                continue
            for dx, dy in DIRS:
                nx, ny = x + dx, y + dy
                if 0 <= ny < len(rows) and 0 <= nx < len(rows[ny]) and rows[ny][nx] == b and bare(nx, ny):
                    sa.add((x, y))
                    sb.add((nx, ny))
    return sa, sb


def cell_luma(c, cells: Iterable[Cell]) -> float:
    """Mean Rec. 601 luma (0-1) of the centre CONTRAST_SAMPLE px square of each cell in `c.below`."""
    t = c.below.shape[0] // c.height
    lo, hi = (t - CONTRAST_SAMPLE) // 2, (t + CONTRAST_SAMPLE) // 2
    vals = [float((c.below[y * t + lo:y * t + hi, x * t + lo:x * t + hi, :3].astype(np.float32) @ LUMA_601).mean())
            for x, y in sorted(cells)]
    return sum(vals) / len(vals) / 255.0


def contrast_errors(src: dict, c) -> list[str]:
    specs = src["contrast"]
    if not isinstance(specs, list):
        return [f"contrast: want a list of {{a, b, min}} entries, not {specs!r}"]
    errors = []
    for n, spec in enumerate(specs):
        a, b, need = (spec.get(k) for k in ("a", "b", "min")) if isinstance(spec, dict) else (None, None, None)
        if not (isinstance(a, str) and len(a) == 1 and isinstance(b, str) and len(b) == 1 and a != b
                and isinstance(need, (int, float)) and not isinstance(need, bool) and 0 < need <= 1
                and set(spec) == {"a", "b", "min"}):
            errors.append(f"contrast {n}: want {{a: <char>, b: <other char>, min: 0-1}}, not {spec!r}")
            continue
        sa, sb = contrast_pairs(src, c, a, b)
        if not sa:
            errors.append(f"contrast {n}: no bare {a!r} cell next to a bare {b!r} cell")
            continue
        la, lb = cell_luma(c, sa), cell_luma(c, sb)
        if abs(la - lb) < need:
            errors.append(f"contrast {n}: {a!r} cells (luma {la:.3f}) and the {b!r} cells next to them (luma "
                          f"{lb:.3f}) differ by {abs(la - lb):.3f}, under {need} (they read as one texture)")
    return errors
