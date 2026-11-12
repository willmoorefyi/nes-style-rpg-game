"""Second-generation monster painter (Pixel-Remaster-leaning tone).

MSpr extends art_helpers.Spr with: smooth 6-tone shading stored as float ramp indices (so later
passes can sculpt it), sparing ordered dither, bump/crease sculpting, contact shadows between
parts, hue-shifted ramps (`ramp6`) and selective coloured outlines (lighter on the lit
top-left, darker on the shaded side). Backgrounds keep using art_helpers.Spr unchanged.
"""
from __future__ import annotations

import numpy as np

from art_helpers import BAYER4, Spr, depth, shift
from snes_palette import c15

LIGHT = np.array([-0.55, -0.60, 0.58])


def ramp6(dark, mid, light, n: int = 6):
    """n-tone ramp from three 5-bit key colours (shadow hue-shifted cool, light warm)."""
    d, m, l = (np.array(k, float) for k in (dark, mid, light))
    out = []
    for i in range(n):
        t = i / (n - 1)
        c = d + (m - d) * (t / 0.5) if t <= 0.5 else m + (l - m) * ((t - 0.5) / 0.5)
        out.append(c15(*[int(min(31, max(0, round(v)))) for v in c]))
    return out


def _blur(v: np.ndarray, mask: np.ndarray) -> np.ndarray:
    m = mask.astype(float)
    num = np.zeros_like(v)
    den = np.zeros_like(v)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            num += shift(v * m, dx, dy)
            den += shift(m, dx, dy)
    return num / np.maximum(den, 1e-6)


class MSpr(Spr):
    def __init__(self, w: int, h: int) -> None:
        super().__init__(w, h)
        self.f = np.zeros((h, w))
        self.rid = np.full((h, w), -1, int)
        self.am = np.zeros((h, w))
        self.d1 = np.zeros((h, w, 3), np.uint8)
        self.ramps: list[np.ndarray] = []
        self.sil = np.zeros((h, w), bool)  # pixels excluded from the outline pass (glow, etc.)

    # ---- painting ---------------------------------------------------------
    def _rid(self, ramp) -> int:
        arr = np.array(ramp, np.uint8)
        for i, r in enumerate(self.ramps):
            if r.shape == arr.shape and (r == arr).all():
                return i
        self.ramps.append(arr)
        return len(self.ramps) - 1

    def _render(self, mask: np.ndarray) -> None:
        thr = BAYER4[self.ys % 4, self.xs % 4] - 0.5
        for k, lut in enumerate(self.ramps):
            m = mask & self.a & (self.rid == k)
            if not m.any():
                continue
            q = np.clip(np.floor(self.f + 0.5 + thr * self.am), 0, len(lut) - 1).astype(int)
            self.rgb[m] = lut[q][m]

    def paint(self, mask, ramp, tex=None, bias: float = 0.0, gain: float = 1.0, cap: int = 4,
              amp: float = 0.2, sep: bool = False, mid: float = 0.5, soft: int = 1, **_):
        if not mask.any():
            return mask
        n = len(ramp)
        tl = sum(depth(mask, dx, dy, cap) for dx, dy in ((-1, -1), (-1, 0), (0, -1))) / 3.0
        br = sum(depth(mask, dx, dy, cap) for dx, dy in ((1, 1), (1, 0), (0, 1))) / 3.0
        t = (br - tl) / (br + tl + 1e-6)
        idx = (n - 1) * mid + t * gain * (n - 1) * 0.62 + bias
        for _i in range(soft):
            idx = _blur(idx, mask)
        if tex is not None:
            idx = idx + tex
        prev = self.a.copy()
        k = self._rid(ramp)
        if sep:  # contact shadow on what was already there (down-right of this part)
            cast = shift(mask, -1, -1) & prev & ~mask
            cast |= shift(mask, -1, 0) & prev & ~mask & (self.xs % 2 == 0)
            self.f[cast] -= 0.9
            self._render(cast)
        self.f[mask] = idx[mask]
        self.rid[mask] = k
        self.am[mask] = amp
        self.a |= mask
        self.dark[mask] = ramp[0]
        self.d1[mask] = ramp[1]
        if sep:
            nb = np.zeros_like(mask)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nb |= shift(prev & ~mask, dx, dy)
            edge = mask & nb
            self.f[edge] -= 0.8
        self._render(mask)
        return mask

    def flat(self, mask, col, dark=None) -> None:
        self.rgb[mask] = np.array(col, np.uint8)
        self.dark[mask] = np.array(dark if dark else col, np.uint8)
        self.d1[mask] = self.dark[mask]
        self.rid[mask] = -1
        self.a |= mask

    def px(self, x, y, col) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self.rgb[y, x] = col
            self.a[y, x] = True
            self.rid[y, x] = -1
            if not self.dark[y, x].any():
                self.dark[y, x] = col
                self.d1[y, x] = col

    # ---- sculpting --------------------------------------------------------
    def adjust(self, weight: np.ndarray, delta: float) -> None:
        w = weight.astype(float) if weight.dtype == bool else weight
        m = self.a & (self.rid >= 0) & (w > 0)
        self.f[m] += delta * w[m]
        self._render(m)

    def bump(self, cx, cy, rx, ry, strength: float = 1.2, only_rid=None, rim: float = 0.0) -> None:
        """Dome of relief: lights its upper-left, shades its lower-right (muscle, plate, knuckle)."""
        u, v = (self.xs - cx) / rx, (self.ys - cy) / ry
        r2 = u * u + v * v
        inside = r2 < 1.0
        z = np.sqrt(np.clip(1 - r2, 0, 1))
        lam = LIGHT[0] * u + LIGHT[1] * v  # >0 where the dome faces the light (top-left)
        w = np.where(inside, lam * 1.3 + (z - 0.6) * 0.25, 0.0)
        if rim:
            w = w - rim * np.clip((r2 - 0.55) / 0.45, 0, 1) * inside
        m = self.a & (self.rid >= 0) & inside
        if only_rid is not None:
            m &= self.rid == only_rid
        self.f[m] += strength * w[m]
        self._render(m)

    def crease(self, pts, depth_: float = 1.3, lit: float = 0.6, width: int = 1) -> None:
        """Engraved separation line: darkens the path, lights the pixel above/left of it."""
        path = self.stroke(pts, width) & self.a & (self.rid >= 0)
        upl = (shift(path, 1, 0) | shift(path, 0, 1)) & ~path & self.a & (self.rid >= 0)
        self.f[path] -= depth_
        self.f[upl] += lit
        self._render(path | upl)

    def shade_ell(self, cx, cy, rx, ry, delta: float) -> None:
        """Soft elliptical tone shift (ambient occlusion pools, cheek light)."""
        r = np.sqrt(((self.xs - cx) / rx) ** 2 + ((self.ys - cy) / ry) ** 2)
        self.adjust(np.clip(1 - r, 0, 1) ** 0.7, delta)

    # ---- outline ----------------------------------------------------------
    def outline(self, col=None, diag: bool = False) -> None:
        """Selective coloured outline: soft mid-dark on the lit top/left, deep on the shaded side."""
        a = self.a & ~self.sil
        new = np.zeros_like(a)
        src = np.zeros((self.h, self.w, 3), float)
        for dx, dy in ((-1, 0), (0, -1), (1, 0), (0, 1)):
            nb = shift(a, dx, dy) & ~self.a & ~new
            # neighbour is at (x+dx, y+dy): outline lies on the opposite side of that pixel
            lit_side = (dx > 0) or (dy > 0)
            d0 = np.roll(np.roll(self.dark, -dy, axis=0), -dx, axis=1).astype(float)
            d1 = np.roll(np.roll(self.d1, -dy, axis=0), -dx, axis=1).astype(float)
            c = (d0 * 0.45 + d1 * 0.55) if lit_side else d0 * 0.8 + np.array([2, 1.5, 4]) * 3
            src[nb] = c[nb]
            new |= nb
        self.rgb[new] = np.array(col, np.uint8) if col else np.clip(src[new], 0, 255).astype(np.uint8)
        self.dark[new] = self.rgb[new]
        self.d1[new] = self.rgb[new]
        self.rid[new] = -1
        self.a |= new

    def hl(self, pts, col) -> None:
        """Hand-placed highlight/accent pixels (wet eyes, teeth, rivets)."""
        self.pxs(pts, col)


def tex_wrap(s: Spr, theta_deg: float, period: float, seed: int = 0, amp: float = 1.0, phase: float = 0.0) -> np.ndarray:
    """Bandage strips: 1px gap line, 1px shadow under it, lit lip on the next edge, per-strip tone."""
    import math
    th = math.radians(theta_deg)
    c = s.xs * math.cos(th) + s.ys * math.sin(th) + phase
    k = np.floor(c / period)
    f = c / period - k
    vals = (np.sin(k * 12.9898 + seed * 7.1) * 43758.5453) % 1.0
    out = (vals - 0.5) * 0.9 * amp
    g = 1.0 / period
    out = np.where(f < g, out - 1.7 * amp, out)
    out = np.where((f >= g) & (f < 2 * g), out - 0.7 * amp, out)
    out = np.where(f >= 1 - g, out + 0.55 * amp, out)
    return out
