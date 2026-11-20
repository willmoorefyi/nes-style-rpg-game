"""The one noise of the NW generator (docs/NATURAL_WORLD_PLAN.md 3.2, 2.4, 2.5): value noise, fbm, ridged noise and
the domain warp, on global cells of the 256x256 world, seeded numpy generators only.

It replaces the five copies of `fbm` of pass W (`overworld_noise.py`, `world_coast.py`, `ordeal/world_ordeal_ground.py`,
`fire/world_fire_ground.py`, `elf/world_land.py`), which go with their region grounds at NW-5. The math is NW-0's
pilot noise unchanged (`~/temp/ff-game/worldplan/nw0/scripts/noise.py`), so NW-2 reproduces preset B's figures at seed
1987 (3.10). Determinism (2.5): `np.random.default_rng(seed)` only, no `random`, no `hash()`, no set iteration; the
same seed gives the same field under any PYTHONHASHSEED.
"""
from __future__ import annotations

import numpy as np

N = 256                                      # world_api_v2.WORLD_W (the grids below are N x N)
YY, XX = np.mgrid[0:N, 0:N].astype(float)
STD = 0.3          # every fbm field is normalised to this standard deviation (so an amplitude is in cells)


def vnoise(cell: float, seed: int, px: np.ndarray | None = None, py: np.ndarray | None = None) -> np.ndarray:
    """Smooth value noise with lattice spacing `cell`, sampled at (px, py) (default the cell centres)."""
    px = XX + .5 if px is None else px
    py = YY + .5 if py is None else py
    m = int(N / cell) + 8
    g = np.random.default_rng(seed).random((m, m))
    fx, fy = px / cell + 2, py / cell + 2
    fx = np.clip(fx, 0, m - 2.001)
    fy = np.clip(fy, 0, m - 2.001)
    x0, y0 = fx.astype(int), fy.astype(int)
    tx, ty = fx - x0, fy - y0
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    a, b, c, d = g[y0, x0], g[y0, x0 + 1], g[y0 + 1, x0], g[y0 + 1, x0 + 1]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def fbm(seed: int, cells: tuple[float, ...] = (40, 20, 10, 5, 2.5), gain: float = 0.55,
        px: np.ndarray | None = None, py: np.ndarray | None = None) -> np.ndarray:
    """Sum of octaves (lattice spacings `cells`, amplitude x `gain` per octave), centred on 0, std STD."""
    out, amp, tot = 0.0, 1.0, 0.0
    for i, c in enumerate(cells):
        out = out + amp * vnoise(c, seed * 31 + i, px, py)
        tot += amp
        amp *= gain
    out = out / tot
    return (out - out.mean()) / (out.std() + 1e-9) * STD


def ridged(seed: int, cells: tuple[float, ...] = (12, 6, 3)) -> np.ndarray:
    """1 on crests, 0 in the folds (spurs, crags and saddles along a ridge, 2.4 rule 3)."""
    return np.clip(1 - np.abs(2 * fbm(seed, cells)), 0, 1)


def warp(seed_x: int, seed_y: int, amp: float, cells: tuple[float, ...] = (48, 24, 12),
         gain: float = 0.55) -> tuple[np.ndarray, np.ndarray]:
    """A domain warp: the cell grid displaced by `amp` x fbm per axis (2.4 rule 1: continent scale at cells
    48 / 24 / 12; the small second warp of the fjords at 14 / 7 / 3.5). Returns (wx, wy), in cells."""
    return XX + amp * fbm(seed_x, cells, gain), YY + amp * fbm(seed_y, cells, gain)
