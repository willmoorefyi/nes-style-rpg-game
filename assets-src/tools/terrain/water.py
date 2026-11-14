"""Water edges: the automatic beach, river and lake banks, shallow water and broken foam."""
from __future__ import annotations

import numpy as np

from .base import BANK, BEACH, CYAN, MARGIN, SHALLOW, SHALLOW_TINT, T, _dist, _vnoise


def beach(below: np.ndarray, ocean: np.ndarray, grass: np.ndarray, sand: np.ndarray, core: np.ndarray,
          road_cells: np.ndarray, bayer: np.ndarray, sand_tex: np.ndarray, seed: int) -> tuple[np.ndarray, np.ndarray]:
    """Ocean meeting grass grows a 6-10 px sand strip on the land side (never into a grass cell's centre).
    Returns the updated (grass, sand) pixel masks."""
    if not (ocean.any() and grass.any()):
        return grass, sand
    H, W = below.shape[:2]
    d = _dist(ocean, BEACH[1] + 8)
    width = BEACH[0] + (BEACH[1] - BEACH[0]) * (_vnoise(H, W, 40, seed + 11) * 0.5 + 0.5)
    n = np.clip(0.5 + 0.5 * _vnoise(H, W, 24, seed + 12) + 0.35 * _vnoise(H, W, 8, seed + 14), 0, 1)
    width = _steer(d, width, n)                     # keep the inner edge off cell lines and cell centres
    p = np.clip((width - d) / 3.0, 0, 1)
    strip = grass & ~core & ~road_cells & (p > bayer)
    below[strip] = sand_tex[strip]
    return grass & ~strip, sand | strip


def banks(below: np.ndarray, fresh: np.ndarray, grass: np.ndarray, sand: np.ndarray, core: np.ndarray,
          bayer: np.ndarray, soil: np.ndarray) -> np.ndarray:
    """Rivers and lakes: 3 px dithered earth banks on the land side. Returns the updated grass mask."""
    if not fresh.any():
        return grass
    d = _dist(fresh, BANK + 1)
    bank = (grass | sand) & ~core & (d <= BANK) & (np.clip((BANK + 1.0 - d) / (BANK + 0.5), 0, 1) > bayer)
    below[bank] = soil[bank]
    return grass & ~bank


def _steer(d: np.ndarray, width: np.ndarray, n: np.ndarray) -> np.ndarray:
    """Band widths for a band drawn as `d <= width` (d: distance from the band's outer edge, dithered over a 3 px
    ramp). Where the band would reach the clamped cell centre (and follow the centre squares) it narrows to a 2.5-4
    px strip that follows its outer edge; an inner edge that would run within 6 px of a cell line parallel to it
    moves to 6-9.5 px past the line (n in 0..1 picks where). Along the band's normal, s - d is constant (s: signed offset
    from the nearest parallel cell line), so every pixel of a normal makes the same choice."""
    H, W = d.shape
    gy, gx = np.zeros_like(d), np.zeros_like(d)
    gy[1:-1], gx[:, 1:-1] = d[2:] - d[:-2], d[:, 2:] - d[:, :-2]
    ry = (np.arange(H, dtype=np.float32) - T * np.round(np.arange(H) / T))[:, None] + 0.5
    rx = (np.arange(W, dtype=np.float32) - T * np.round(np.arange(W) / T))[None, :] + 0.5
    horiz = np.abs(gy) >= np.abs(gx)
    s = np.where(horiz, ry * np.sign(gy), rx * np.sign(gx))
    edge = s - d + width - 1.5                           # offset of the inner edge from the line
    width = np.where(edge > MARGIN - 1, 2.5 + 1.5 * n, width)   # deep: a thin strip that follows the coast
    edge = s - d + width - 1.5
    target = 6.0 + (MARGIN - 6.5) * n
    return np.where(np.abs(edge) < 6.0, width + target - edge, width)


def shallows(below: np.ndarray, layers: list[np.ndarray], by: dict[str, np.ndarray], bayer: np.ndarray, seed: int) -> None:
    """Shallow water (ocean and lakes within 10 px of land tinted 35 % toward cyan, dithered) and a foam line
    broken by noise."""
    water = np.logical_or.reduce(layers)
    if not water.any() or water.all():
        return
    H, W = water.shape
    d = _dist(~water, SHALLOW + 1)
    deep = by["ocean"] | by["lake"]
    shallow = deep & (d <= SHALLOW) & (np.clip((SHALLOW + 1 - d) / SHALLOW, 0, 1) > bayer)
    px = below[shallow].astype(np.float32)
    below[shallow] = (px * (1 - SHALLOW_TINT) + CYAN * SHALLOW_TINT).astype(np.uint8)
    n = _vnoise(H, W, 10, seed + 23)
    foam = water & (d <= 1.0) & (n > -0.25)
    below[foam] = np.minimum(below[foam].astype(np.int32) + 70, 255).astype(np.uint8)
    spray = water & (d > 1.0) & (d <= 2.5) & (n > 0.35) & (bayer < 0.5)
    below[spray] = np.minimum(below[spray].astype(np.int32) + 40, 255).astype(np.uint8)
