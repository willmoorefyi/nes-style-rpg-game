"""Organic roads: a track drawn along the road network's centre line instead of filled cells.

The road cells (and the bridges they lead onto) form a graph. Each road cell draws its share of the centre line:
straight through, a rounded corner (a quadratic curve from one edge midpoint to the other, bent at the cell centre),
or, inside a staircase of alternating turns (a diagonal road on the cell grid), a curve pulled toward the chord, so
the steps read as one smooth diagonal. Junctions widen a little; 2x2 blocks fill their middle; a dead end runs to
its cell's far edge (a gate, a door, the tomb). The track is ROAD_HALF px wide either side with a noisy edge, a
dithered fringe and a slightly darker rim. Only the art changes: collision still comes from the cells.
"""
from __future__ import annotations

import numpy as np

import kit as K
from .base import ROADS, T, _bayer, _dist, _shade, _tile, _up, _vnoise
from .ecotone import tex_name

ROAD_HALF = 14.0               # px either side of the centre line (a 28 px track in a 48 px cell)
ROAD_WOBBLE = 2.0              # px: the edge wanders this much (value noise)
ROAD_SOFT = 3                  # px: dithered fringe outside the edge
STAIR_PULL = 0.75              # inside a staircase, how far a turn's bend moves from the cell centre to the chord
JUNCTION = 3.0                 # px: a junction's disc is this much wider than the track
OPEN_GROUND = ("grass", "sand", "forest") + ROADS     # the track may spill a few px onto these, never onto water
DIRS = ((1, 0), (-1, 0), (0, 1), (0, -1))


def centre_line(mat: np.ndarray) -> tuple[list[tuple[int, int, np.ndarray]], list[tuple[float, float, float]]]:
    """The road network's centre line in px: polylines (the cell's top-left px x, y and an N x 2 array of x, y
    relative to it, so the curve's float arithmetic is the same in every window) and discs (x, y, radius)."""
    hgt, wid = mat.shape
    road = np.isin(mat, ROADS)
    node = road | (mat == "bridge")
    at = lambda x, y: 0 <= x < wid and 0 <= y < hgt and bool(node[y, x])  # noqa: E731
    nbrs = {(x, y): [(dx, dy) for dx, dy in DIRS if at(x + dx, y + dy)]
            for y in range(hgt) for x in range(wid) if node[y, x]}
    is_l = lambda c: c in nbrs and len(nbrs[c]) == 2 and nbrs[c][0][0] != -nbrs[c][1][0]  # noqa: E731
    lines: list[np.ndarray] = []
    discs: list[tuple[float, float, float]] = []
    h = T / 2
    for y in range(hgt):
        for x in range(wid):
            if not road[y, x]:
                continue
            ds = nbrs[(x, y)]
            cx, cy = h, h                                    # relative to the cell's top-left px
            add = lambda pts: lines.append((x * T, y * T, pts))  # noqa: E731
            mid = lambda d: np.array([cx + d[0] * h, cy + d[1] * h])  # noqa: E731
            if not ds:
                discs.append((x * T + h, y * T + h, ROAD_HALF + JUNCTION))
            elif len(ds) == 1:                               # a dead end: on to the far edge (round cap at the edge)
                d = ds[0]
                far = np.array([cx - d[0] * (h - ROAD_HALF), cy - d[1] * (h - ROAD_HALF)])
                add(_segment(far, mid(d)))
            elif is_l((x, y)) and not _in_block(at, x, y, ds):
                a, b = ds
                m1, m2 = mid(a), mid(b)
                c = np.array([cx, cy])
                if _stair(nbrs, is_l, (x, y), a, b):
                    c = c + STAIR_PULL * ((m1 + m2) / 2 - c)
                add(_bezier(m1, c, m2))
            else:                                            # straight on, a junction or a 2x2 block: spokes
                for d in ds:
                    add(_segment(np.array([cx, cy]), mid(d)))
                if len(ds) > 2:
                    discs.append((x * T + h, y * T + h, ROAD_HALF + JUNCTION))
            if at(x + 1, y) and at(x, y + 1) and at(x + 1, y + 1):  # the middle of a 2x2 block of road cells
                discs.append(((x + 1) * T, (y + 1) * T, h))
    return lines, discs


def _in_block(at, x: int, y: int, ds) -> bool:
    (ax, ay), (bx, by) = ds
    return at(x + ax + bx, y + ay + by)


def _stair(nbrs, is_l, c, a, b) -> bool:
    """c is a turn inside a staircase: the neighbour beyond `b` (or `a`) turns back the other way."""
    u = (-a[0], -a[1])                                   # the direction of travel into c (from the a side)
    nb = (c[0] + b[0], c[1] + b[1])
    na = (c[0] + a[0], c[1] + a[1])
    if is_l(nb) and any(d == u for d in nbrs[nb]):       # leaving b the road heads the way it entered c
        return True
    v = (-b[0], -b[1])
    return is_l(na) and any(d == v for d in nbrs[na])


def _segment(p: np.ndarray, q: np.ndarray) -> np.ndarray:
    n = max(2, int(np.hypot(*(q - p))) + 1)
    t = np.linspace(0, 1, n)[:, None]
    return p * (1 - t) + q * t


def _bezier(p: np.ndarray, c: np.ndarray, q: np.ndarray) -> np.ndarray:
    n = max(3, int(np.hypot(*(c - p)) + np.hypot(*(q - c))) + 1)
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 2 * p + 2 * (1 - t) * t * c + t * t * q


def paint_roads(below: np.ndarray, mat: np.ndarray, kit: K.Kit, seed: int) -> None:
    """Draw every road material along the network's centre line (see the module docstring)."""
    H, W = below.shape[:2]
    for m in ROADS:
        if not (mat == m).any():
            continue
        lines, discs = centre_line(np.where(np.isin(mat, ROADS) & (mat != m), "grass", mat))
        ys, xs = np.nonzero(mat == m)
        reach = int(ROAD_HALF + ROAD_WOBBLE + ROAD_SOFT + 2)
        y0, y1 = max(0, ys.min() * T - T), min(H, (ys.max() + 2) * T)
        x0, x1 = max(0, xs.min() * T - T), min(W, (xs.max() + 2) * T)
        line = np.zeros((y1 - y0, x1 - x0), bool)
        for ox, oy, pts in lines:
            px = np.clip(np.round(pts[:, 0]).astype(int) + ox - x0, 0, x1 - x0 - 1)
            py = np.clip(np.round(pts[:, 1]).astype(int) + oy - y0, 0, y1 - y0 - 1)
            line[py, px] = True
        d = _dist(line, reach)
        yy, xx = np.mgrid[y0:y1, x0:x1]
        for cx, cy, r in discs:                              # discs: distance to the disc, as if it were a line
            d = np.minimum(d, np.maximum(np.hypot(xx - cx, yy - cy) - (r - ROAD_HALF), 0).astype(np.float32))
        r = ROAD_HALF + ROAD_WOBBLE * _vnoise(H, W, 20, seed + 19)[y0:y1, x0:x1]
        bayer = _bayer(H, W)[y0:y1, x0:x1]
        allow = _up(np.isin(mat, OPEN_GROUND))[y0:y1, x0:x1]
        solid = d <= r
        fringe = (d > r) & (d <= r + ROAD_SOFT) & (np.clip((r + ROAD_SOFT + 0.5 - d) / (ROAD_SOFT + 1), 0, 1) > bayer)
        show = (solid | fringe) & allow
        rim = solid & (d > r - 1.5) & allow
        sub = below[y0:y1, x0:x1]
        sub[show] = _tile(kit.material(tex_name(kit, m)), H, W)[y0:y1, x0:x1][show]
        _shade(sub, rim, 0.85)
