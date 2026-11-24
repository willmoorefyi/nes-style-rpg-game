"""EF-G G2 helpers for gen/monster_hr_puppet.py: backward-mapped mesh warps of an RGBA part (a rigid part's inverse
affine, or a cloth part's base transform plus a Gaussian-RBF residual through its control pins), drawn by Pillow's
MESH transform on premultiplied RGBA over a 16 px destination grid (piecewise bilinear), and the dilation fill of
exposed joint gaps. Pure numpy + Pillow (scipy is not installed here, so a fixed grid mesh stands in for a Delaunay
triangulation, and a Shepard interpolation the residual; the mesh is drawn on the overlay). Deterministic: the mesh coordinates are rounded to 1/16 px."""
from __future__ import annotations

import math

import numpy as np
from PIL import Image

CELL = 16


def affine(rot: float = 0.0, sx: float = 1.0, sy: float = 1.0, dx: float = 0.0, dy: float = 0.0,
           pivot: tuple[float, float] = (0.0, 0.0)) -> np.ndarray:
    """3x3 forward map: scale and rotate (degrees, + clockwise on screen) about `pivot`, then move by (dx, dy)."""
    a = math.radians(rot)
    px, py = pivot
    r = np.array([[math.cos(a), -math.sin(a), 0], [math.sin(a), math.cos(a), 0], [0, 0, 1]])
    s = np.diag([sx, sy, 1.0])
    t0 = np.array([[1, 0, -px], [0, 1, -py], [0, 0, 1]], float)
    t1 = np.array([[1, 0, px + dx], [0, 1, py + dy], [0, 0, 1]], float)
    return t1 @ r @ s @ t0


def apply(m: np.ndarray, pts: np.ndarray) -> np.ndarray:
    p = np.c_[pts, np.ones(len(pts))]
    with np.errstate(all="ignore"):           # Accelerate BLAS raises spurious matmul warnings
        return (p @ m.T)[:, :2]


def rbf_residual(dst: np.ndarray, res: np.ndarray, sigma: float):
    """r(q): Shepard interpolation of the pin residuals `res` (weights 1 / (d^2 + h^2), h = sigma / 10): near-exact
    at each pin, smooth between them, the pins' weighted mean far away (a cloth follows its pins; an exact Gaussian
    RBF overshot by ~1000 px between nearly collinear pins)."""
    if not len(dst):
        return lambda q: np.zeros_like(q)
    h2 = (sigma / 10.0) ** 2

    def r(q: np.ndarray) -> np.ndarray:
        w = 1.0 / (((q[:, None] - dst[None]) ** 2).sum(-1) + h2)
        w /= w.sum(1, keepdims=True)
        with np.errstate(all="ignore"):           # Accelerate BLAS raises spurious matmul warnings
            return w @ res
    return r


def backward(base: np.ndarray, pins_src: np.ndarray | None = None, pins_dst: np.ndarray | None = None,
             sigma: float = 150.0):
    """dest -> source map: the inverse of `base`, plus (cloth) the residual that sends each pin's destination back to
    its master position."""
    inv = np.linalg.inv(base)
    if pins_src is None or not len(pins_src):
        return lambda q: apply(inv, q)
    r = rbf_residual(pins_dst, pins_src - apply(inv, pins_dst), sigma)
    return lambda q: apply(inv, q) + r(q)


def warp(img: Image.Image, back, size: int, box: tuple[int, int, int, int] | None = None) -> Image.Image:
    """`img` (RGBA, master coords) drawn into a size x size canvas through the dest -> source map `back`, over the
    16 px cells of `box` (default the whole canvas); binary alpha (> 127)."""
    x0, y0, x1, y1 = box or (0, 0, size, size)
    xs = np.arange(x0 - x0 % CELL, x1 + CELL, CELL)
    ys = np.arange(y0 - y0 % CELL, y1 + CELL, CELL)
    gx, gy = np.meshgrid(xs, ys)
    src = np.round(back(np.c_[gx.ravel(), gy.ravel()].astype(float)) * 16) / 16
    sx, sy = src[:, 0].reshape(gx.shape), src[:, 1].reshape(gx.shape)
    mesh = []
    for j in range(len(ys) - 1):
        for i in range(len(xs) - 1):
            quad = (sx[j, i], sy[j, i], sx[j + 1, i], sy[j + 1, i], sx[j + 1, i + 1], sy[j + 1, i + 1],
                    sx[j, i + 1], sy[j, i + 1])
            mesh.append(((int(xs[i]), int(ys[j]), int(xs[i + 1]), int(ys[j + 1])), tuple(float(v) for v in quad)))
    out = img.convert("RGBa").transform((size, size), Image.Transform.MESH, mesh, Image.Resampling.BICUBIC)
    a = np.asarray(out.convert("RGBA")).copy()
    a[..., 3] = np.where(a[..., 3] > 127, 255, 0)
    a[a[..., 3] == 0] = 0
    return Image.fromarray(a)


def mesh_lines(back, box: tuple[int, int, int, int], step: int = 48) -> list[list[tuple[float, float]]]:
    """Destination grid lines of a warped part (drawn on the overlay)."""
    x0, y0, x1, y1 = box
    lines = []
    for x in range(x0, x1 + 1, step):
        lines.append([(x, y) for y in range(y0, y1 + 1, 8)])
    for y in range(y0, y1 + 1, step):
        lines.append([(x, y) for x in range(x0, x1 + 1, 8)])
    return lines


def shift(m: np.ndarray, dy: int, dx: int) -> np.ndarray:
    out = np.zeros_like(m)
    h, w = m.shape[:2]
    out[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = m[max(0, -dy):h + min(0, -dy), max(0, -dx):w + min(0, -dx)]
    return out


def dilate(m: np.ndarray, n: int = 1) -> np.ndarray:
    for _ in range(n):
        m = m | shift(m, 1, 0) | shift(m, -1, 0) | shift(m, 0, 1) | shift(m, 0, -1)
    return m


def nearest_fill(rgba: np.ndarray, holes: np.ndarray, rounds: int = 200) -> np.ndarray:
    """Fill `holes` from the nearest opaque px: grow the known colours one ring at a time (the mean of the known
    4-neighbours), so a gap takes its own part's pixels."""
    a = rgba.astype(float).copy()
    known = a[..., 3] > 0
    todo = holes & ~known
    for _ in range(rounds):
        if not todo.any():
            break
        acc, cnt = np.zeros(a.shape[:2] + (3,)), np.zeros(a.shape[:2])
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            k = shift(known, dy, dx)
            acc += np.where(k[..., None], shift(a[..., :3], dy, dx), 0)
            cnt += k
        ring = todo & (cnt > 0)
        a[ring, :3] = acc[ring] / cnt[ring, None]
        a[ring, 3] = 255
        known |= ring
        todo &= ~ring
    out = np.clip(a.round(), 0, 255).astype(np.uint8)
    if holes.any():                                   # the ring growth leaves streaks: smooth the filled px only
        from PIL import ImageFilter
        soft = np.asarray(Image.fromarray(out[..., :3]).filter(ImageFilter.BoxBlur(4)))
        out[holes & (out[..., 3] > 0), :3] = soft[holes & (out[..., 3] > 0)]
    return out
