"""Shape rasteriser for chunky, high-contrast pixel figures.

Shapes are drawn as masks at SS x resolution (round, organic silhouettes), then:
  1. the mask is blurred into a soft height field ("inflated" form),
  2. its gradient is lit from the top-left and quantised to a few tones,
  3. native pixels are sampled from the result, so edges stay crisp,
  4. an optional 1px stroke separates the layer from whatever it overlaps.
The look is deliberately flat/contrasty: few tones per material, dark separations.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SS = 8
Color = tuple[int, int, int]

# Light comes from the upper left: gradient weights toward the light.
LIGHT = (0.6, 0.8)


class Shape:
    """A mask built from primitives in native float coordinates (pixel i covers [i, i+1))."""

    def __init__(self, w: int, h: int) -> None:
        self.w, self.h = w, h
        self.img = Image.new("L", (w * SS, h * SS), 0)
        self._d = ImageDraw.Draw(self.img)

    def ellipse(self, cx: float, cy: float, rx: float, ry: float, angle: float = 0.0, fill: int = 255) -> "Shape":
        if angle == 0.0:
            self._d.ellipse([(cx - rx) * SS, (cy - ry) * SS, (cx + rx) * SS, (cy + ry) * SS], fill=fill)
            return self
        ca, sa = math.cos(math.radians(angle)), math.sin(math.radians(angle))
        pts = []
        for i in range(48):
            t = 2 * math.pi * i / 48
            x, y = rx * math.cos(t), ry * math.sin(t)
            pts.append(((cx + x * ca - y * sa) * SS, (cy + x * sa + y * ca) * SS))
        self._d.polygon(pts, fill=fill)
        return self

    def circle(self, cx: float, cy: float, r: float, fill: int = 255) -> "Shape":
        return self.ellipse(cx, cy, r, r, fill=fill)

    def capsule(self, p0: tuple[float, float], p1: tuple[float, float], r0: float, r1: float | None = None, fill: int = 255) -> "Shape":
        """Tapered capsule between two joints."""
        r1 = r0 if r1 is None else r1
        dist = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
        n = max(6, int(dist * 3))
        for i in range(n + 1):
            t = i / n
            self.circle(p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, r0 + (r1 - r0) * t, fill=fill)
        return self

    def poly(self, pts: list[tuple[float, float]], fill: int = 255) -> "Shape":
        self._d.polygon([(x * SS, y * SS) for x, y in pts], fill=fill)
        return self

    def rect(self, x0: float, y0: float, x1: float, y1: float, fill: int = 255) -> "Shape":
        self._d.rectangle([x0 * SS, y0 * SS, x1 * SS - 1, y1 * SS - 1], fill=fill)
        return self

    def erase(self) -> "Shape":
        """Return a view whose drawing calls carve holes instead of adding."""
        s = Shape.__new__(Shape)
        s.w, s.h, s.img, s._d = self.w, self.h, self.img, self._d
        return s

    def native(self) -> np.ndarray:
        """Boolean coverage >= 50% per native pixel."""
        a = np.asarray(self.img, dtype=np.float32) / 255.0
        a = a.reshape(self.h, SS, self.w, SS).mean(axis=(1, 3))
        return a >= 0.5


def _shift(m: np.ndarray, dx: int, dy: int) -> np.ndarray:
    out = np.zeros_like(m)
    h, w = m.shape
    ys, yd = (slice(0, h - dy), slice(dy, h)) if dy >= 0 else (slice(-dy, h), slice(0, h + dy))
    xs, xd = (slice(0, w - dx), slice(dx, w)) if dx >= 0 else (slice(-dx, w), slice(0, w + dx))
    out[yd, xd] = m[ys, xs]
    return out


class Stage:
    def __init__(self, w: int, h: int, outline: Color = (6, 4, 10)) -> None:
        self.w, self.h = w, h
        self.rgb = np.zeros((h, w, 3), np.uint8)
        self.a = np.zeros((h, w), bool)
        self.outline_color = outline

    def shape(self) -> Shape:
        return Shape(self.w, self.h)

    def paint(
        self,
        shape: Shape,
        ramp: list[Color],
        *,
        sigma: float = 1.3,
        ring: Color | bool | None = True,
        bias: float = 0.0,
        tones: int = 4,
        clip: np.ndarray | None = None,
    ) -> np.ndarray:
        """Fill `shape` with shaded colour from `ramp` (6 steps, darkest first).

        sigma: inflation softness in native px (bigger = broader light/shadow bands).
        ring:  1px separation line drawn around the shape where it overlaps earlier art
               (True = darkest ramp tone, or pass a colour).
        bias:  shifts lighting brighter (+) or darker (-).
        tones: 3 gives flat light/base/shadow; 4 adds a highlight tone.
        """
        mask = shape.native()
        if clip is not None:
            mask = mask & clip
        blur = shape.img.filter(ImageFilter.GaussianBlur(radius=sigma * SS))
        hgt = np.asarray(blur, dtype=np.float32) / 255.0
        gy, gx = np.gradient(hgt)
        s = (LIGHT[0] * gx + LIGHT[1] * gy) / (0.4 / (sigma * SS))
        # sample at native pixel centres
        c = SS // 2
        sn = s[c::SS, c::SS] + bias
        idx = np.full(sn.shape, 3, np.int8)             # base
        idx[sn > 0.28] = 4                               # light
        if tones >= 4:
            idx[sn > 0.8] = 5                            # highlight
        else:
            idx[sn > 0.28] = 4
        idx[sn < -0.28] = 2                              # mid shadow
        idx[sn < -0.75] = 1                              # deep shadow
        prev = self.a.copy()
        lut = np.array(ramp, dtype=np.uint8)
        self.rgb[mask] = lut[idx[mask]]
        self.a |= mask
        if ring:
            col = ramp[0] if ring is True else ring
            edge = (_shift(mask, 1, 0) | _shift(mask, -1, 0) | _shift(mask, 0, 1) | _shift(mask, 0, -1)) & ~mask
            edge &= prev
            self.rgb[edge] = col
        return mask

    def flat(self, mask: np.ndarray, color: Color) -> None:
        self.rgb[mask] = color
        self.a |= mask

    def stamp(self, x: int, y: int, rows: list[str], colors: dict[str, Color]) -> None:
        """Hand-placed pixels. Spaces are skipped."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != " " and ch in colors and 0 <= x + i < self.w and 0 <= y + j < self.h:
                    self.rgb[y + j, x + i] = colors[ch]
                    self.a[y + j, x + i] = True

    def finish(self, ground_shadow: bool = False) -> Image.Image:
        sil = self.a
        edge = (_shift(sil, 1, 0) | _shift(sil, -1, 0) | _shift(sil, 0, 1) | _shift(sil, 0, -1)) & ~sil
        self.rgb[edge] = self.outline_color
        out = np.zeros((self.h, self.w, 4), np.uint8)
        out[..., :3] = self.rgb
        out[..., 3] = np.where(sil | edge, 255, 0)
        return Image.fromarray(out, "RGBA")
