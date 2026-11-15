"""Small raster helpers for the fx glyphs (native pixels, binary alpha, colours from one ramp)."""
from __future__ import annotations

import math

from pixel import Canvas

Color = tuple[int, int, int]


def teardrop(c: Canvas, cx: float, top: float, bottom: float, half: float, col: Color, sway: float = 0.0,
             round_from: float = 0.7) -> None:
    """A flame-like drop: a point at `top` (shifted `sway` px sideways), widest near `round_from`, round at `bottom`."""
    for y in range(c.h):
        t = (y + 0.5 - top) / (bottom - top)
        if not 0 <= t <= 1:
            continue
        hw = half * t ** 0.75
        if t > round_from:
            u = (t - round_from) / (1 - round_from)
            hw *= math.sqrt(max(0.0, 1 - u * u))
        mid = cx + sway * (1 - t) ** 2
        for x in range(c.w):
            if abs(x + 0.5 - mid) <= hw:
                c.set(x, y, col)


def thick_path(c: Canvas, pts: list[tuple[int, int]], col: Color, width: int = 1) -> None:
    """A polyline; `width` 2 doubles it to the right (a 2-px stroke on the pixel grid)."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        for dx in range(width):
            c.line(x0 + dx, y0, x1 + dx, y1, col)


def band(c: Canvas, cx: float, cy: float, r_out: float, r_in: float, col: Color, ry_scale: float = 1.0,
         keep=None) -> None:
    """Pixels whose (elliptical) distance from the centre lies in [r_in, r_out); `keep(x, y)` filters (dither)."""
    for y in range(c.h):
        for x in range(c.w):
            d = math.hypot(x + 0.5 - cx, (y + 0.5 - cy) / ry_scale)
            if r_in <= d < r_out and (keep is None or keep(x, y)):
                c.set(x, y, col)


def disc(c: Canvas, cx: float, cy: float, r: float, col: Color) -> None:
    band(c, cx, cy, r, -1, col)


def shade_by_light(c: Canvas, ramp: list[Color], lo: int, hi: int) -> None:
    """Recolour opaque pixels in ramp[lo..hi]: one step lighter on the top-left edge, one darker on the bottom-right."""
    lookup = {col: i for i, col in enumerate(ramp)}
    changes = []
    for y in range(c.h):
        for x in range(c.w):
            if not c.opaque(x, y):
                continue
            i = lookup.get(c.px[x, y][:3])
            if i is None or not lo <= i <= hi:
                continue
            if not c.opaque(x - 1, y) or not c.opaque(x, y - 1):
                changes.append((x, y, ramp[min(i + 1, hi)]))
            elif not c.opaque(x + 1, y) or not c.opaque(x, y + 1):
                changes.append((x, y, ramp[max(i - 1, lo)]))
    for x, y, col in changes:
        c.set(x, y, col)


def plot(c: Canvas, rows: list[str], palette: dict[str, Color | None], ox: int = 0, oy: int = 0) -> None:
    """Draw a character map: each character is a palette key (`.` is clear)."""
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != "." and ch in palette:
                c.set(ox + x, oy + y, palette[ch])
