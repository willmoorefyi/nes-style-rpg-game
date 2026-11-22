"""AR-T2: the land's transition bands (ecotones), cold ranges and the relief light, for paint_soft.

Pairs (receiving side <- neighbour: what shows, band width px at 48 native):
  grass <- sand: dry grass (12), sand clusters (6); sand <- grass: grass tufts (8)
  grass <- snow: drifts (14); snow <- grass: grass (7); taiga <- snow: drifts (12); snow <- taiga: taiga (5)
  mountain <- snow: drifts climbing a cold range (40)
  grass / sand / snow <- mountain: scree (26; taiga / forest 10), the rock lifted to the local ground's luma (W14)
  grass <- swamp: a mud fringe (7); swamp <- grass: grass tufts (8)
Cold ranges: mountain px within COLD cells of snow or taiga draw `mountain_cold` (grey rock), mixed in by clusters
at the edge of that zone. Relief light: mountain and taiga get a lit north-west rim and cast a shadow to the
south-east (forest clumps cast their own, outline._forest).
"""
from __future__ import annotations

import numpy as np

from .base import FOOT_FLOOR, FOOT_FLOOR_R, T, _blur, _dist, _low_dist, _luma, _up
from .ecotone import band, bbox, cluster, put, sample, shade, snap15, tex_name

COLD = 6                     # cells: a mountain this close to snow or taiga is a cold range
SCREE = {"grass": 26, "sand": 26, "snow": 26, "taiga": 10, "forest": 10}


def cold_cells(mat: np.ndarray) -> np.ndarray:
    """Mountain cells within COLD cells (Chebyshev) of a snow or taiga cell."""
    c = np.isin(mat, ("snow", "taiga"))
    out = c.copy()
    for _ in range(COLD):
        p = np.pad(out, 1)
        out = out | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:] | p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:]
    return out & (mat == "mountain")


def cold_px(mat: np.ndarray, mountain: np.ndarray, seed: int) -> np.ndarray:
    """The mountain px drawn as cold rock: the cold cells, softened over a cell and broken up in clusters."""
    cells = cold_cells(mat)
    if not cells.any():
        return np.zeros_like(mountain)
    f = _blur(_up(cells).astype(np.float32), T // 2)
    return mountain & (f > cluster(*mountain.shape, seed + 41, 10))


def _lift(below: np.ndarray, ground: np.ndarray, m: np.ndarray, px: np.ndarray) -> np.ndarray:
    """W14: rock px on open ground lifted to at least FOOT_FLOOR of the local ground's luma (no black dots); the
    blur runs on m's bounding box plus its radius (the px outside it do not reach m)."""
    ys, xs = bbox(m)
    r, (H, W) = FOOT_FLOOR_R + 1, m.shape
    box = (slice(max(0, ys.start - r), min(H, ys.stop + r)), slice(max(0, xs.start - r), min(W, xs.stop + r)))
    w = ground[box].astype(np.float32)
    local = (_blur(_luma(below[box]) * w, FOOT_FLOOR_R) / np.maximum(_blur(w, FOOT_FLOOR_R), 1e-3))[m[box]]
    k = np.maximum(1.0, FOOT_FLOOR * local / np.maximum(_luma(px.astype(np.float32)), 1.0))
    return snap15(np.clip(px.astype(np.float32) * k[:, None], 0, 255))


def land_bands(below: np.ndarray, get, kit, seed: int, open_px: np.ndarray, cold: np.ndarray) -> None:
    """Every land ecotone of the module docstring; `open_px`: px that may take a band (not roads, beaches)."""
    H, W = below.shape[:2]
    tx = lambda m: kit.material(tex_name(kit, m))  # noqa: E731
    grass, sand, snow, taiga, swamp, mountain = (get(m) for m in ("grass", "sand", "snow", "taiga", "swamp", "mountain"))
    dist = {}

    def d(name: str, mask: np.ndarray, w: int) -> np.ndarray:
        if name not in dist:
            dist[name] = _dist(mask, w) if w <= 16 else _low_dist(mask, w)
        return dist[name]

    def eco(recv, src_name, src, tex, width, s, gamma=1.0, cell=6, top=0.8, cap=16):
        if not (recv.any() and src.any()):
            return
        m = band(recv & open_px, d(src_name, src, cap), width, seed + s, gamma, cell, top)
        if callable(tex):
            if m.any():
                below[m] = tex(m)
        else:
            put(below, m, tex)

    if sand.any() and grass.any():
        gt, st = tx("grass"), tx("sand")
        eco(grass, "sand", sand, lambda m: snap15(sample(gt, m) * 0.7 + sample(st, m) * 0.3), 12, 2, 1.0, 7)
        eco(grass, "sand", sand, st, 6, 3, 1.3, 4)
        eco(sand, "grass", grass, gt, 8, 4, 0.8, 5, top=0.65)
    if snow.any():
        nt = tx("snow")
        eco(grass, "snow", snow, nt, 14, 5)
        eco(snow, "grass", grass, tx("grass"), 7, 6, 0.8, 5, top=0.65)
        eco(taiga, "snow", snow, nt, 12, 7, 1.2, 5)
        eco(snow, "taiga", taiga, tx("taiga"), 5, 8, 1.5, 4)
        eco(mountain, "snow40", snow, nt, 40, 13, 0.7, 10, top=0.9, cap=48)
    if mountain.any():
        mt, ct = tx("mountain"), tx("mountain_cold")
        near_cold = _blur(cold.astype(np.float32), T // 2) > 0.02 if cold.any() else None
        for recv, w in SCREE.items():
            r = get(recv)
            if not r.any():
                continue
            m = band(r & open_px, d("mountain26", mountain, 34), w, seed + 9, 1.0, 9)
            if m.any():
                rock = sample(mt, m)
                if near_cold is not None:              # scree under a cold range is grey rock too
                    rock = np.where(near_cold[m][:, None], sample(ct, m), rock)
                below[m] = _lift(below, r, m, rock)
    if swamp.any():
        sw, dt = tx("swamp"), tx("dirt")
        eco(grass, "swamp", swamp, lambda m: snap15(sample(dt, m) * 0.55 + sample(sw, m) * 0.45), 7, 10)
        eco(swamp, "grass", grass, tx("grass"), 8, 11, 0.8, 5, top=0.65)


def relief(below: np.ndarray, get, land: np.ndarray) -> None:
    """A lit north-west rim on mountain and taiga, their cast shadow to the south-east."""
    H, W = below.shape[:2]
    for m, k, f in (("mountain", 2, 1.18), ("taiga", 1, 1.15)):
        M = get(m)
        if not M.any():
            continue
        rim = M & ~np.pad(M, ((k, 0), (k, 0)), constant_values=False)[:H, :W]
        shade(below, rim, f, 8)
        sh = np.zeros_like(M)
        for j in range(1, 5):
            sh[j:, j:] |= M[:-j, :-j]
        shade(below, sh & ~M & land, 0.8)
