"""Numpy-backed pixel-art painter used by monsters.py and backgrounds.py.

`Spr` keeps an RGB + coverage array. Shapes are boolean masks (polygon, ellipse,
tube, rect) that are *painted* with a colour ramp: the painter measures how far
each pixel is from the part's upper-left edge versus its lower-right edge and
maps that to a ramp index, with light ordered dithering at band boundaries.
This gives the rounded, top-left-lit look of SNES sprites without hand-placing
every pixel. All colours come from 5-bit ramps (see snes_palette / monster_palette).
"""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw

Color = tuple[int, int, int]
BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
LIGHT_DIRS = ((-1, -1), (-1, 0), (0, -1))
SHADE_DIRS = ((1, 1), (1, 0), (0, 1))


def shift(mask: np.ndarray, dx: int, dy: int) -> np.ndarray:
    """out[y, x] = mask[y + dy, x + dx], False outside."""
    h, w = mask.shape
    out = np.zeros_like(mask)
    ys0, ys1 = max(0, -dy), min(h, h - dy)
    xs0, xs1 = max(0, -dx), min(w, w - dx)
    if ys0 < ys1 and xs0 < xs1:
        out[ys0:ys1, xs0:xs1] = mask[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx]
    return out


def depth(mask: np.ndarray, dx: int, dy: int, cap: int) -> np.ndarray:
    cur = mask.copy()
    dep = np.zeros(mask.shape, float)
    for k in range(1, cap + 1):
        cur &= shift(mask, k * dx, k * dy)
        dep += cur
    return dep


class Spr:
    def __init__(self, w: int, h: int) -> None:
        self.w, self.h = w, h
        self.rgb = np.zeros((h, w, 3), np.uint8)
        self.a = np.zeros((h, w), bool)
        self.dark = np.zeros((h, w, 3), np.uint8)
        self.ys, self.xs = np.mgrid[0:h, 0:w]

    # ---- masks -----------------------------------------------------------
    def _draw(self, fn) -> np.ndarray:
        im = Image.new("L", (self.w, self.h), 0)
        fn(ImageDraw.Draw(im))
        return np.array(im) > 0

    def poly(self, pts) -> np.ndarray:
        pts = [(float(x), float(y)) for x, y in pts]
        return self._draw(lambda d: d.polygon(pts, fill=255))

    def ell(self, cx, cy, rx, ry) -> np.ndarray:
        return ((self.xs - cx) / rx) ** 2 + ((self.ys - cy) / ry) ** 2 <= 1.0

    def rect(self, x0, y0, x1, y1) -> np.ndarray:
        return (self.xs >= x0) & (self.xs <= x1) & (self.ys >= y0) & (self.ys <= y1)

    def tube(self, pts) -> np.ndarray:
        """pts = [(x, y, radius), ...] -> union of discs along the polyline."""
        m = np.zeros((self.h, self.w), bool)
        for (x0, y0, r0), (x1, y1, r1) in zip(pts, pts[1:]):
            n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
            for i in range(n + 1):
                t = i / n
                m |= self.ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 + (r1 - r0) * t + 0.01,
                              r0 + (r1 - r0) * t + 0.01)
        return m

    def stroke(self, pts, width: int = 1) -> np.ndarray:
        pts = [(float(x), float(y)) for x, y in pts]
        return self._draw(lambda d: d.line(pts, fill=255, width=width))

    # ---- painting --------------------------------------------------------
    def paint(self, mask: np.ndarray, ramp: list[Color], tex=None, bias: float = 0.0,
              gain: float = 1.0, cap: int = 4, amp: float = 0.5, sep: bool = False,
              mid: float = 0.55) -> np.ndarray:
        """Shade `mask` with `ramp` (dark -> light). Returns the mask."""
        if not mask.any():
            return mask
        n = len(ramp)
        tl = sum(depth(mask, dx, dy, cap) for dx, dy in LIGHT_DIRS) / 3.0
        br = sum(depth(mask, dx, dy, cap) for dx, dy in SHADE_DIRS) / 3.0
        t = (br - tl) / (br + tl + 1e-6)
        idx = (n - 1) * mid + t * gain * (n - 1) * 0.5 + bias
        if tex is not None:
            idx = idx + tex
        thr = BAYER4[self.ys % 4, self.xs % 4] - 0.5
        q = np.clip(np.floor(idx + 0.5 + thr * amp), 0, n - 1).astype(int)
        lut = np.array(ramp, np.uint8)
        if sep:
            prev = self.a.copy()
            edge = mask & ~(shift(mask, 1, 0) & shift(mask, -1, 0) & shift(mask, 0, 1) & shift(mask, 0, -1))
            nb = shift(prev & ~mask, 1, 0) | shift(prev & ~mask, -1, 0) | shift(prev & ~mask, 0, 1) | shift(prev & ~mask, 0, -1)
            q = np.where(edge & nb, 0, q)
        self.rgb[mask] = lut[q][mask]
        self.dark[mask] = np.array(ramp[0], np.uint8)
        self.a |= mask
        return mask

    def flat(self, mask: np.ndarray, col: Color, dark: Color | None = None) -> None:
        self.rgb[mask] = np.array(col, np.uint8)
        self.dark[mask] = np.array(dark if dark else col, np.uint8)
        self.a |= mask

    def px(self, x: int, y: int, col: Color) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self.rgb[y, x] = col
            self.a[y, x] = True
            if not self.dark[y, x].any():
                self.dark[y, x] = col

    def pxs(self, pts, col: Color) -> None:
        for x, y in pts:
            self.px(x, y, col)

    def recolor(self, mask: np.ndarray, col: Color, where: np.ndarray | None = None) -> None:
        """Recolour already-opaque pixels inside mask (keeps coverage)."""
        m = mask & self.a
        if where is not None:
            m &= where
        self.rgb[m] = np.array(col, np.uint8)

    def erase(self, mask: np.ndarray) -> None:
        self.a &= ~mask
        self.rgb[mask] = 0

    # ---- passes ----------------------------------------------------------
    def outline(self, col: Color | None = None, diag: bool = False) -> None:
        """Selective outline: each new pixel takes the darkest shade of the material it touches."""
        a = self.a
        new = np.zeros_like(a)
        src = np.zeros((self.h, self.w, 3), np.uint8)
        dirs = [(1, 0), (0, 1), (-1, 0), (0, -1)] + ([(1, 1), (-1, 1), (1, -1), (-1, -1)] if diag else [])
        for dx, dy in dirs:
            nb = shift(a, dx, dy) & ~a & ~new
            nd = np.roll(np.roll(self.dark, -dy, axis=0), -dx, axis=1)
            src[nb] = nd[nb]
            new |= nb
        self.rgb[new] = np.array(col, np.uint8) if col else src[new]
        self.dark[new] = self.rgb[new]
        self.a |= new

    def specks(self, mask: np.ndarray, col: Color, rng, count: int) -> None:
        ys, xs = np.nonzero(mask & self.a)
        if len(ys) == 0:
            return
        for _ in range(count):
            i = rng.randrange(len(ys))
            self.rgb[ys[i], xs[i]] = col

    def shadow(self, cx, cy, rx, ry, col: Color) -> None:
        """Dithered ground contact shadow, only on empty pixels."""
        core = self.ell(cx, cy, rx, ry)
        ring = self.ell(cx, cy, rx + 2, ry + 1) & ~core
        chk = (self.xs + self.ys) % 2 == 0
        m = (core | (ring & chk)) & ~self.a
        self.rgb[m] = np.array(col, np.uint8)
        self.a |= m

    def image(self) -> Image.Image:
        arr = np.zeros((self.h, self.w, 4), np.uint8)
        arr[..., :3] = self.rgb
        arr[..., 3] = np.where(self.a, 255, 0)
        arr[~self.a, :3] = 0
        return Image.fromarray(arr)


# ---- texture generators (return float offsets in ramp-index units) ----------
def tex_noise(s: Spr, rng, amp: float) -> np.ndarray:
    return (np.array([[rng.random() for _ in range(s.w)] for _ in range(s.h)]) - 0.5) * 2 * amp


def tex_scales(s: Spr, size: int, amp: float) -> np.ndarray:
    row = s.ys // size
    u = (s.xs + (row % 2) * (size // 2)) % size
    v = s.ys % size
    out = np.zeros((s.h, s.w))
    out[v == size - 1] -= amp
    out[(v == 0) & (u > 0) & (u < size - 1)] += amp * 0.7
    out[(u == size - 1) & (v > 0)] -= amp * 0.4
    return out


def tex_rows(s: Spr, period: int, amp: float, phase: int = 0) -> np.ndarray:
    out = np.zeros((s.h, s.w))
    out[(s.ys + phase) % period == period - 1] -= amp
    out[(s.ys + phase) % period == 0] += amp * 0.4
    return out


def tex_diag(s: Spr, period: int, amp: float, phase: int = 0, slope: int = 1) -> np.ndarray:
    out = np.zeros((s.h, s.w))
    k = (s.xs * slope + s.ys + phase) % period
    out[k == 0] -= amp
    out[k == 1] += amp * 0.5
    return out


def tex_fur(s: Spr, amp: float) -> np.ndarray:
    out = np.zeros((s.h, s.w))
    k = (s.xs * 2 + s.ys * 3) % 7
    out[k == 0] -= amp
    out[k == 3] += amp * 0.6
    return out


def tex_bricks(s: Spr, bw: int, bh: int, amp: float) -> np.ndarray:
    out = np.zeros((s.h, s.w))
    row = s.ys // bh
    u = (s.xs + (row % 2) * (bw // 2)) % bw
    out[(s.ys % bh) == bh - 1] -= amp
    out[u == bw - 1] -= amp
    out[((s.ys % bh) == 0) & (u != bw - 1)] += amp * 0.5
    return out


def tex_checker(s: Spr, amp: float) -> np.ndarray:
    return np.where((s.xs + s.ys) % 2 == 0, amp, -amp)


def save_scaled(img: Image.Image, path, k: int) -> None:
    img.resize((img.width * k, img.height * k), Image.NEAREST).save(path)
