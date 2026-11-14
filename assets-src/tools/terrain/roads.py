"""Roads for the organic terrain painter."""
from __future__ import annotations

import numpy as np

import kit as K
from .base import ROADS, _edge, _inner_depth, _shade, _tile, _up, _vnoise


def paint_roads(below: np.ndarray, mat: np.ndarray, kit: K.Kit, seed: int) -> None:
    """Roads: their own cells, with a small ragged edge (the partition put grass under them)."""
    H, W = below.shape[:2]
    for m in ROADS:
        cells = _up(mat == m)
        if not cells.any():
            continue
        inset = (_vnoise(H, W, 6, seed + 17 + ROADS.index(m)) * 0.5 + 0.5) * 4
        show = cells & (_inner_depth(cells, 5) > inset)
        below[show] = _tile(kit.material(m), H, W)[show]
        _shade(below, _edge(show) & ~_edge(cells), 0.85)
