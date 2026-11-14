"""Rotsprite sampler for rigid monster parts (docs/ENEMY_ANIM_PLAN.md 4.2; split from rig_render.py, which
re-exports it): Scale2x three times, nearest rotate (and the F2 part scale), then an 8x8 block mode-downsample."""
from __future__ import annotations

import math

import numpy as np

U32_MAX = np.iinfo(np.uint32).max


def _pack(a: np.ndarray) -> np.ndarray:
    p = (a[..., 0].astype(np.uint32) << 24) | (a[..., 1].astype(np.uint32) << 16) | (a[..., 2].astype(np.uint32) << 8) | a[..., 3]
    return np.where(a[..., 3] > 0, p, 0).astype(np.uint32)


def _unpack(p: np.ndarray) -> np.ndarray:
    return np.stack([(p >> 24) & 255, (p >> 16) & 255, (p >> 8) & 255, p & 255], -1).astype(np.uint8)


def scale2x(p: np.ndarray) -> np.ndarray:
    """EPX / Scale2x on a packed colour array (edges replicated)."""
    pad = np.pad(p, 1, mode="edge")
    A, B, C, D, E = pad[:-2, 1:-1], pad[1:-1, 2:], pad[1:-1, :-2], pad[2:, 1:-1], p
    out = np.empty((p.shape[0] * 2, p.shape[1] * 2), p.dtype)
    out[0::2, 0::2] = np.where((C == A) & (C != D) & (A != B), A, E)
    out[0::2, 1::2] = np.where((A == B) & (A != C) & (B != D), B, E)
    out[1::2, 0::2] = np.where((D == C) & (D != B) & (C != A), C, E)
    out[1::2, 1::2] = np.where((B == D) & (B != A) & (D != C), D, E)
    return out


def block_mode(samples: np.ndarray, centre: np.ndarray) -> np.ndarray:
    """Per row: the most frequent packed colour (transparent = 0 counts as a colour); ties go to the centre sample's
    colour, then to the lowest RGBA value."""
    counts = (samples[:, :, None] == samples[:, None, :]).sum(2)
    mx = counts.max(1)
    centre_n = (samples == centre[:, None]).sum(1)
    lowest = np.where(counts == mx[:, None], samples, U32_MAX).min(1)
    return np.where(centre_n == mx, centre, lowest).astype(np.uint32)


def rotsprite(arr: np.ndarray, mask: np.ndarray, sj0, tj0, rot: float, size, gaps: np.ndarray | None = None, k: int = 8,
              scale: float = 1.0):
    """Scale2x three times (8x), nearest rotate, then mode-downsample every 8x8 block (`gaps` as in rigid). With
    `scale` < 1 (F2) the 8x8 samples of an output pixel spread over its 1/scale-wide source footprint, so the block
    mode is a mode-downsample of the part: source colours only, binary alpha."""
    from gen import rig_render as RR
    part = _pack(np.where(mask[..., None], arr, 0))
    up = scale2x(scale2x(scale2x(part)))
    h, w = size
    c, s = math.cos(-rot), math.sin(-rot)
    off = (np.arange(k) - (k - 1) / 2) / k
    gy, gx = np.mgrid[0:h, 0:w]
    out = np.zeros(h * w, np.uint32)
    oy, ox = np.meshgrid(off, off, indexing="ij")
    ox, oy = ox.ravel(), oy.ravel()
    fx, fy = gx.ravel().astype(float), gy.ravel().astype(float)
    for lo in range(0, h * w, 2048):
        X = fx[lo:lo + 2048, None] + np.concatenate([[0.0], ox])[None, :] - tj0[0]
        Y = fy[lo:lo + 2048, None] + np.concatenate([[0.0], oy])[None, :] - tj0[1]
        if scale != 1.0:
            X, Y = X / scale, Y / scale
        sx, sy = c * X - s * Y + sj0[0], s * X + c * Y + sj0[1]
        ux, uy = np.floor(sx * k + k / 2).astype(int), np.floor(sy * k + k / 2).astype(int)
        ok = (ux >= 0) & (ux < up.shape[1]) & (uy >= 0) & (uy < up.shape[0])
        val = np.zeros(ux.shape, np.uint32)
        val[ok] = up[uy[ok], ux[ok]]
        out[lo:lo + 2048] = block_mode(val[:, 1:], val[:, 0])
    out = out.reshape(h, w)
    if gaps is not None:
        return _unpack(out), out != 0, RR._src_gap(gaps, *RR._rigid_map(arr, sj0, tj0, rot, size, scale))
    return _unpack(out), out != 0
