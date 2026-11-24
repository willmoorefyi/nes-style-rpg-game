"""Geometry and fill helpers of chaos_orrery_orbs.py (pass EF-E; numpy only, no scipy / cv2, no model call).

Rings: an ellipse is {cx, cy, a, b, tilt} (art px, radians; a the semi-major axis, tilt its angle from +x, screen y
down); t is the parametric angle, the point is c + R(tilt) (a cos t, b sin t), so a constant dt/dclock is a circle in 3D
seen tilted. The near half (in front of the body) is sin t > 0 (below the major axis on screen).
"""
from __future__ import annotations

import numpy as np


def fit_conic(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """Fitzgibbon's direct least-squares ellipse: the conic (A, B, C, D, E, F)."""
    D = np.stack([x * x, x * y, y * y, x, y, np.ones_like(x)], 1)
    S = D.T @ D
    S1, S2, S3 = S[:3, :3], S[:3, 3:], S[3:, 3:]
    T = -np.linalg.solve(S3, S2.T)
    M = S1 + S2 @ T
    M = np.array([M[2] / 2, -M[1], M[0] / 2])
    _, v = np.linalg.eig(M)
    cond = 4 * v[0] * v[2] - v[1] ** 2
    a1 = v[:, np.where(cond > 0)[0][0]].real
    return np.concatenate([a1, T @ a1])


def ellipse_of(c: np.ndarray) -> dict:
    A, B, C, D, E, F = c
    M0 = np.array([[F, D / 2, E / 2], [D / 2, A, B / 2], [E / 2, B / 2, C]])
    M = np.array([[A, B / 2], [B / 2, C]])
    x0, y0 = np.linalg.solve(2 * M, [-D, -E])
    w, v = np.linalg.eigh(M)
    ax = np.sqrt(-np.linalg.det(M0) / np.linalg.det(M) / w)
    i = int(np.argmax(ax))
    ang = float(np.arctan2(v[1, i], v[0, i]))
    ang = ang - np.pi if ang > np.pi / 2 else ang + np.pi if ang < -np.pi / 2 else ang
    return {"cx": float(x0), "cy": float(y0), "a": float(ax[i]), "b": float(ax[1 - i]), "tilt": ang}


def point(e: dict, t):
    ct, st = np.cos(e["tilt"]), np.sin(e["tilt"])
    u, v = e["a"] * np.cos(t), e["b"] * np.sin(t)
    return e["cx"] + u * ct - v * st, e["cy"] + u * st + v * ct


def normal(e: dict, t):
    """The outward unit normal at t."""
    ct, st = np.cos(e["tilt"]), np.sin(e["tilt"])
    u, v = e["b"] * np.cos(t), e["a"] * np.sin(t)
    x, y = u * ct - v * st, u * st + v * ct
    n = np.hypot(x, y)
    return x / n, y / n


def locate(e: dict, x, y, iters: int = 6):
    """(t of the nearest curve point, signed offset along the outward normal) of each point (Newton)."""
    ct, st = np.cos(e["tilt"]), np.sin(e["tilt"])
    dx, dy = x - e["cx"], y - e["cy"]
    u, v = dx * ct + dy * st, -dx * st + dy * ct
    A, B = e["a"], e["b"]
    t = np.arctan2(v * A, u * B)
    for _ in range(iters):
        c, s = np.cos(t), np.sin(t)
        f = (A * A - B * B) * s * c - u * A * s + v * B * c
        fp = (A * A - B * B) * (c * c - s * s) - u * A * c - v * B * s
        t = t - f / np.where(np.abs(fp) < 1e-9, 1e-9, fp)
    d = np.hypot(u - A * np.cos(t), v - B * np.sin(t))
    inside = (u / A) ** 2 + (v / B) ** 2 < 1
    return np.arctan2(np.sin(t), np.cos(t)), np.where(inside, -d, d)


def fit_ring(xs: np.ndarray, ys: np.ndarray, seeds, keep=None, rounds: int = 8) -> dict:
    """Fit from hand seeds on the ring's centre line, then refine on the gold pixels within 16 / 10 px of the curve
    (`keep`: a mask of the candidate pixels allowed, e.g. not the armour trim)."""
    P = np.asarray(seeds, float)
    e = ellipse_of(fit_conic(P[:, 0], P[:, 1]))
    for i in range(rounds):
        _, off = locate(e, xs, ys)
        sel = np.abs(off) < (16 if i < 3 else 10)
        if keep is not None:
            sel &= keep
        e = ellipse_of(fit_conic(xs[sel], ys[sel]))
    return e


def bilinear(img: np.ndarray, x, y) -> np.ndarray:
    h, w = img.shape[:2]
    x = np.clip(x, 0, w - 1.001)
    y = np.clip(y, 0, h - 1.001)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = x - x0, y - y0
    if img.ndim == 3:
        fx, fy = fx[..., None], fy[..., None]
    return (img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x0 + 1] * fx * (1 - fy) + img[y0 + 1, x0] * (1 - fx) * fy
            + img[y0 + 1, x0 + 1] * fx * fy)


def goldness(rgba: np.ndarray) -> np.ndarray:
    """0..1: the ring's iron-gold (hue 20-60, saturated, not black); a semi-transparent far band (alpha >= 96) counts whole."""
    rgb = rgba[..., :3] / 255
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = np.maximum(mx - mn, 1e-6)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = (mx - mn) / np.maximum(mx, 1e-6)
    return ((h > 20) & (h < 60) & (s > 0.2) & (mx > 0.18)).astype(float) * np.clip(rgba[..., 3] / 96, 0, 1)


def band_profile(e: dict, gold: np.ndarray, ts: np.ndarray, reach: float = 30, thresh: float = 0.25):
    """Per t: (centre offset, half width) of the gold band across the normal, NaN where no band is found."""
    offs = np.arange(-reach, reach + 1, 1.0)
    px, py = point(e, ts)
    nx, ny = normal(e, ts)
    wv = bilinear(gold, px[:, None] + offs * nx[:, None], py[:, None] + offs * ny[:, None])
    c = np.full(len(ts), np.nan)
    hw = np.full(len(ts), np.nan)
    for i, row in enumerate(wv):
        on = np.nonzero(row > thresh)[0]
        if len(on) >= 4:
            # the run of the band nearest the curve (gaps up to 4 px inside a band are its streaks)
            runs = np.split(on, np.nonzero(np.diff(on) > 4)[0] + 1)
            run = min(runs, key=lambda r: np.abs(offs[r]).min())
            if len(run) >= 4:
                c[i] = (offs[run[0]] + offs[run[-1]]) / 2
                hw[i] = (offs[run[-1]] - offs[run[0]]) / 2 + 0.5
    return c, hw


def _slide(m: np.ndarray, r: int, op) -> np.ndarray:
    """A (2r+1)-square min / max filter of a bool mask (separable shifts, edges padded with the pixel itself)."""
    out = m
    for axis in (0, 1):
        pad = [(r, r) if a == axis else (0, 0) for a in range(2)]
        p = np.pad(out, pad, mode="edge")
        n = out.shape[axis]
        out = op.reduce([np.take(p, range(i, i + n), axis=axis) for i in range(2 * r + 1)])
    return out


def opened(m: np.ndarray, r: int) -> np.ndarray:
    """Morphological opening (erode, then dilate) by a (2r+1) square: parts thinner than 2r+1 px fall away."""
    return _slide(_slide(m, r, np.logical_and), r, np.logical_or)


def upsample2(img: np.ndarray, shape) -> np.ndarray:
    """Bilinear x2 (pixel centres) to `shape`."""
    h, w = shape
    ys = (np.arange(h) + 0.5) / 2 - 0.5
    xs = (np.arange(w) + 0.5) / 2 - 0.5
    X, Y = np.meshgrid(xs, ys)
    return bilinear(img, np.clip(X, 0, img.shape[1] - 1), np.clip(Y, 0, img.shape[0] - 1))


def push_pull(rgba: np.ndarray, valid: np.ndarray) -> np.ndarray:
    """Fill the invalid pixels of a premultiplied RGBA float image from the valid ones (pyramid push-pull)."""
    w = valid.astype(float)
    img = rgba * w[..., None]
    levels = [(img, w)]
    while min(img.shape[:2]) > 2:
        h2, w2 = (img.shape[0] + 1) // 2, (img.shape[1] + 1) // 2
        pi = np.zeros((h2 * 2, w2 * 2, img.shape[2]))
        pw = np.zeros((h2 * 2, w2 * 2))
        pi[:img.shape[0], :img.shape[1]] = img
        pw[:w.shape[0], :w.shape[1]] = w
        img = pi.reshape(h2, 2, w2, 2, -1).sum((1, 3))
        w = pw.reshape(h2, 2, w2, 2).sum((1, 3))
        img, w = img / np.maximum(w, 1e-9)[..., None] * np.minimum(w, 1)[..., None], np.minimum(w, 1)
        levels.append((img, w))
    up = levels[-1][0] / np.maximum(levels[-1][1], 1e-9)[..., None]
    for img, w in reversed(levels[:-1]):
        up = upsample2(up, img.shape[:2])
        col = img / np.maximum(w, 1e-9)[..., None]
        up = col * w[..., None] + up * (1 - w[..., None])
    return np.where(valid[..., None], rgba, up)
