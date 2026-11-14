"""Seeded value noise and distance fields on the overworld grid (layouts/overworld.py); numpy only, no `random`."""
from __future__ import annotations

import numpy as np

from overworld_consts import DY, H, W


def value_noise(cell: float, seed: int) -> np.ndarray:
    """Smooth value noise in 0..1 on the cell grid (bilinear with smoothstep). The knots of the T3c map (the rows
    below the DY added ones) are drawn as before, so the old land keeps its shapes; the new rows get knots of their own."""
    r = np.random.default_rng(seed)
    gw, gh = int(W / cell) + 3, int((H - DY) / cell) + 3
    pad = int(np.ceil(DY / cell)) + 1
    g = np.vstack([np.random.default_rng(seed + 7919).random((pad, gw)), r.random((gh, gw))])
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    fy, fx = (yy - DY + 0.5) / cell + pad, (xx + 0.5) / cell
    y0, x0 = fy.astype(int), fx.astype(int)
    ty, tx = fy - y0, fx - x0
    ty, tx = ty * ty * (3 - 2 * ty), tx * tx * (3 - 2 * tx)
    a, b, c, d = g[y0, x0], g[y0, x0 + 1], g[y0 + 1, x0], g[y0 + 1, x0 + 1]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def fbm(seed: int) -> np.ndarray:
    """Two-and-a-bit octaves, centred on 0 (about -0.5..0.5)."""
    return value_noise(7, seed) * 0.6 + value_noise(3.5, seed + 1) * 0.3 + value_noise(1.7, seed + 2) * 0.1 - 0.5


def signed_distance(pts: list[tuple[float, float]]) -> np.ndarray:
    """Per cell centre: distance to the polygon outline, positive inside."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    px, py = xx + 0.5, yy + 0.5
    best = np.full((H, W), np.inf)
    inside = np.zeros((H, W), bool)
    n = len(pts)
    for i in range(n):
        (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
        dx, dy = x1 - x0, y1 - y0
        t = np.clip(((px - x0) * dx + (py - y0) * dy) / max(dx * dx + dy * dy, 1e-9), 0, 1)
        best = np.minimum(best, np.hypot(px - (x0 + t * dx), py - (y0 + t * dy)))
        if y0 != y1:
            cross = ((y0 > py) != (y1 > py)) & (px < x0 + (py - y0) * dx / dy)
            inside ^= cross
    return np.where(inside, best, -best)


def polyline_distance(pts: list[tuple[float, float]]) -> np.ndarray:
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    px, py = xx + 0.5, yy + 0.5
    best = np.full((H, W), np.inf)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        dx, dy = x1 - x0, y1 - y0
        t = np.clip(((px - x0) * dx + (py - y0) * dy) / max(dx * dx + dy * dy, 1e-9), 0, 1)
        best = np.minimum(best, np.hypot(px - (x0 + t * dx), py - (y0 + t * dy)))
    return best


def blob(cx: float, cy: float, rx: float, ry: float) -> np.ndarray:
    """Ellipse field: > 0 inside (about 1 at the centre)."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    return 1 - np.hypot((xx + 0.5 - cx) / rx, (yy + 0.5 - cy) / ry)
