"""Helpers for 480x270 SNES-style battle backdrops (see backgrounds.py)."""
from __future__ import annotations

import math
import random

import numpy as np
from PIL import Image, ImageDraw

from art_helpers import BAYER4, Spr, depth

W, H, HZ = 480, 270, 116


class Bg:
    def __init__(self) -> None:
        self.a = np.zeros((H, W, 3), float)
        self.ys, self.xs = np.mgrid[0:H, 0:W]
        self.bay = BAYER4[self.ys % 4, self.xs % 4]

    # -- fills ---------------------------------------------------------------
    def vgrad(self, y0: int, y1: int, cols, width: float = 0.4) -> None:
        """Banded vertical gradient; neighbouring bands blend through a narrow ordered dither."""
        n = len(cols)
        cols = np.array(cols, float)
        for y in range(y0, min(y1, H)):
            t = (y - y0) / max(1, y1 - y0 - 1) * (n - 1)
            i = min(int(t), n - 2)
            f2 = float(np.clip((t - i - 0.5) / width + 0.5, 0, 1))
            pick = f2 > self.bay[y]
            self.a[y] = np.where(pick[:, None], cols[i + 1], cols[i])

    def paint(self, mask: np.ndarray, col) -> None:
        self.a[mask] = np.array(col, float)

    def mix(self, amt: np.ndarray, col, levels: int = 4) -> None:
        """Blend toward col by amt (0..1), quantised to `levels` dithered steps."""
        q = amt * levels
        base = np.floor(q)
        lvl = base + ((q - base) > self.bay)
        a = np.clip(lvl / levels, 0, 1)[..., None]
        self.a = self.a * (1 - a) + np.array(col, float) * a

    def glow(self, cx, cy, rx, ry, col, amount: float = 0.7, levels: int = 4) -> None:
        d = np.sqrt(((self.xs - cx) / rx) ** 2 + ((self.ys - cy) / ry) ** 2)
        self.mix(np.clip(1 - d, 0, 1) ** 1.2 * amount, col, levels)

    def ridge_fill(self, rdg: np.ndarray, bottom: int, rp, body=(2, 1), rim: bool = True) -> None:
        r = rdg[self.xs]
        d = self.ys - r
        mask = (d >= 0) & (self.ys < bottom)
        t = np.clip(d / np.maximum(bottom - r, 1), 0, 1)
        idx = np.where(t + (self.bay - 0.5) * 0.5 < 0.5, body[0], body[1])
        if rim:
            idx = np.where(d < 1, len(rp) - 1, np.where(d < 3, len(rp) - 2, idx))
        lut = np.array(rp, float)
        self.a[mask] = lut[idx][mask]

    def layer(self, spr: Spr) -> None:
        self.a[spr.a] = spr.rgb[spr.a].astype(float)

    def pil_layer(self, img: Image.Image) -> None:
        arr = np.array(img)
        m = arr[..., 3] > 0
        self.a[m] = arr[..., :3][m].astype(float)

    def finish(self) -> Image.Image:
        v5 = np.clip(np.rint(self.a / 255 * 31), 0, 31).astype(np.uint8)
        out = (v5 << 3) | (v5 >> 2)
        return Image.fromarray(out)


def ridge(base: float, comps, seed: str) -> np.ndarray:
    r = random.Random(seed)
    xs = np.arange(W)
    y = np.full(W, float(base))
    for amp, freq in comps:
        y += amp * np.sin(2 * math.pi * freq * xs / W + r.random() * 6.283)
    return np.rint(y).astype(int)


def cloud(b: Bg, cx, cy, w, h, rng, hi, mid, lo) -> None:
    m = np.zeros((H, W), bool)
    n = int(w / (h * 0.8)) + 3
    for i in range(n):
        px = cx - w / 2 + (i + 0.5) * w / n + rng.uniform(-3, 3)
        pr = h * (0.45 + 0.45 * math.sin(math.pi * (i + 0.5) / n)) * rng.uniform(0.85, 1.1)
        m |= ((b.xs - px) / pr) ** 2 + ((b.ys - (cy - pr * 0.3)) / (pr * 0.9)) ** 2 <= 1
    m &= b.ys <= cy + h * 0.2
    up, dn = depth(m, 0, -1, 6), depth(m, 0, 1, 4)
    col = np.where(up <= 2, 0, 1)
    col = np.where((dn <= 1) | ((dn <= 2) & (b.bay > 0.5)), 2, col)
    lut = np.array([hi, mid, lo], float)
    b.a[m] = lut[col][m]


def poly_mask(pts) -> np.ndarray:
    im = Image.new("L", (W, H), 0)
    ImageDraw.Draw(im).polygon([(float(x), float(y)) for x, y in pts], fill=255)
    return np.array(im) > 0


def lines_img(draw_fn) -> Image.Image:
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(im))
    return im


def stripes(b: Bg, y0: int, vp_y: float, k: float, c0, c1) -> None:
    """Perspective-correct alternating ground bands (hard-edged, one dithered edge pixel row)."""
    z = k / np.maximum(b.ys - vp_y, 1.0)
    band = np.floor(z)
    f = z - band
    par = (band % 2).astype(int)
    par = np.where((f < 0.08) & (b.bay > 0.5), 1 - par, par)
    lut = np.array([c0, c1], float)
    m = b.ys >= y0
    b.a[m] = lut[par][m]
