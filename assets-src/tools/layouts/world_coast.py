"""Organic coasts on the 192x192 world grid (FX-D, docs/PLAYTEST_FIX_PLAN.md G-1): the act-1 method (layouts/
overworld.py: polygons bent by seeded value noise, overworld_noise.py) on world cells, for the region modules whose
land was drawn from rects and straight spans.

  fbm(seed)                          smooth noise, about -0.5..0.5, over the world grid
  signed_distance(pts)               per cell: distance to the polygon outline, positive inside
  wobble(seed, n, step, amp)         a smooth 1-D offset per index (a coast column or row), whole cells
  organic(poly, amp, seed, ...)      a land mask: the polygon bent by the noise, kept inside a mask, with forced land
                                     and water, then tidied (no 1-cell inlet, no islet, no enclosed pond)

numpy only, no `random`, no `hash()`; every loop runs in row-major order, so a rerun is byte-identical.
"""
from __future__ import annotations

from collections import deque

import numpy as np

from world_api import WORLD_H, WORLD_W

DIRS = ((1, 0), (-1, 0), (0, 1), (0, -1))


def value_noise(cell: float, seed: int) -> np.ndarray:
    """Smooth value noise in 0..1 on the world grid (bilinear knots with smoothstep)."""
    r = np.random.default_rng(seed)
    gw, gh = int(WORLD_W / cell) + 3, int(WORLD_H / cell) + 3
    g = r.random((gh, gw))
    yy, xx = np.mgrid[0:WORLD_H, 0:WORLD_W].astype(np.float64)
    fy, fx = (yy + 0.5) / cell, (xx + 0.5) / cell
    y0, x0 = fy.astype(int), fx.astype(int)
    ty, tx = fy - y0, fx - x0
    ty, tx = ty * ty * (3 - 2 * ty), tx * tx * (3 - 2 * tx)
    a, b, c, d = g[y0, x0], g[y0, x0 + 1], g[y0 + 1, x0], g[y0 + 1, x0 + 1]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def fbm(seed: int) -> np.ndarray:
    """Three octaves (cells 10, 5, 2.5), centred on 0 (about -0.5..0.5): bays and headlands a few cells deep."""
    return value_noise(10, seed) * 0.55 + value_noise(5, seed + 1) * 0.33 + value_noise(2.5, seed + 2) * 0.12 - 0.5


def wobble(seed: int, n: int, step: float, amp: float) -> list[int]:
    """n smooth offsets in whole cells, -amp..amp (knots every `step` indices, smoothstep between)."""
    knots = np.random.default_rng(seed).random(int(n / step) + 3) * 2 - 1
    out = []
    for i in range(n):
        f = i / step
        k = int(f)
        t = f - k
        t = t * t * (3 - 2 * t)
        out.append(int(round(amp * (knots[k] * (1 - t) + knots[k + 1] * t))))
    return out


def signed_distance(pts: list[tuple[float, float]]) -> np.ndarray:
    """Per cell centre: distance to the closed polygon's outline, positive inside (even-odd rule)."""
    yy, xx = np.mgrid[0:WORLD_H, 0:WORLD_W].astype(np.float64)
    px, py = xx + 0.5, yy + 0.5
    best = np.full((WORLD_H, WORLD_W), np.inf)
    inside = np.zeros((WORLD_H, WORLD_W), bool)
    for i in range(len(pts)):
        (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
        dx, dy = x1 - x0, y1 - y0
        t = np.clip(((px - x0) * dx + (py - y0) * dy) / max(dx * dx + dy * dy, 1e-9), 0, 1)
        best = np.minimum(best, np.hypot(px - (x0 + t * dx), py - (y0 + t * dy)))
        if y0 != y1:
            inside ^= ((y0 > py) != (y1 > py)) & (px < x0 + (py - y0) * dx / dy)
    return np.where(inside, best, -best)


def components(mask: np.ndarray) -> list[list[tuple[int, int]]]:
    """4-connected components of a mask as (x, y) lists, found in row-major order."""
    seen = np.zeros_like(mask, dtype=bool)
    out = []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        comp, q = [], deque([(int(x), int(y))])
        seen[y, x] = True
        while q:
            cx, cy = q.popleft()
            comp.append((cx, cy))
            for dx, dy in DIRS:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < WORLD_W and 0 <= ny < WORLD_H and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((nx, ny))
        out.append(comp)
    return out


def _inlets(land: np.ndarray, mine: np.ndarray) -> np.ndarray:
    """Water cells of `mine` in a 1-cell horizontal or vertical run between two land cells."""
    water = ~land
    out = np.zeros_like(land)
    out[:, 1:-1] |= water[:, 1:-1] & land[:, :-2] & land[:, 2:]
    out[1:-1, :] |= water[1:-1, :] & land[:-2, :] & land[2:, :]
    return out & mine


def organic(poly: list[tuple[float, float]], amp: float, seed: int, mine: np.ndarray,
            keep_land: np.ndarray | None = None, keep_water: np.ndarray | None = None,
            min_island: int = 8) -> np.ndarray:
    """Land where the polygon's signed distance plus `amp` x fbm is positive, inside `mine`, with the forced cells
    applied last and kept through the tidy: 1-cell inlets filled, islets under `min_island` cells and enclosed ponds
    (water of `mine` that reaches no water outside it) removed."""
    keep_land = np.zeros_like(mine) if keep_land is None else keep_land & mine
    keep_water = np.zeros_like(mine) if keep_water is None else keep_water & mine
    land = (signed_distance(poly) + amp * fbm(seed) > 0) & mine
    land = (land | keep_land) & ~keep_water
    for _ in range(4):
        fill = _inlets(land, mine) & ~keep_water
        if not fill.any():
            break
        land |= fill
    for comp in components(land):
        if len(comp) < min_island and not any(keep_land[y, x] for x, y in comp):
            for x, y in comp:
                land[y, x] = False
    for comp in components(~land & mine):
        open_sea = any(not mine[y + dy, x + dx] for x, y in comp for dx, dy in DIRS
                       if 0 <= x + dx < WORLD_W and 0 <= y + dy < WORLD_H)
        if not open_sea and not any(keep_water[y, x] for x, y in comp):
            for x, y in comp:
                land[y, x] = True
    return land


def tidy(g: dict, fill: str, chars: str = "fsm", least: int = 3) -> None:
    """min_blob on a {(x, y): char} ground: a forest, sand or mountain patch under `least` cells becomes `fill`,
    twice, row-major (deterministic)."""
    for _ in range(2):
        for ch in chars:
            mask = np.zeros((WORLD_H, WORLD_W), bool)
            for (x, y), c in g.items():
                mask[y, x] = c == ch
            for comp in components(mask):
                if len(comp) < least:
                    for c in comp:
                        g[c] = fill
