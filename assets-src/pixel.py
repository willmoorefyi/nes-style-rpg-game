"""Shared pixel-art toolkit: a small RGBA canvas plus outline/shading passes.

All art modules draw at native resolution (1 canvas pixel = 1 SNES pixel) and the
build step upscales with nearest-neighbour. Colors come from snes_palette.
"""
from __future__ import annotations

import math
from typing import Iterable

from PIL import Image

Color = tuple[int, int, int]
CLEAR = (0, 0, 0, 0)


def _pixels(img: Image.Image):
    px = img.load()
    if px is None:
        raise RuntimeError('PIL returned no pixel access')
    return px


class Canvas:
    def __init__(self, w: int, h: int, fill: Color | None = None) -> None:
        self.w, self.h = w, h
        self.img = Image.new("RGBA", (w, h), CLEAR)
        self.px = _pixels(self.img)
        if fill is not None:
            self.fill(fill)

    # --- primitives -------------------------------------------------------
    def inside(self, x: int, y: int) -> bool:
        return 0 <= x < self.w and 0 <= y < self.h

    def set(self, x: int, y: int, col: Color | None) -> None:
        """Set a pixel; col=None erases."""
        if self.inside(x, y):
            self.px[x, y] = CLEAR if col is None else (*col, 255)

    def get(self, x: int, y: int) -> tuple[int, int, int, int]:
        if not self.inside(x, y):
            return CLEAR
        return self.px[x, y]

    def opaque(self, x: int, y: int) -> bool:
        return self.inside(x, y) and self.px[x, y][3] > 0

    def fill(self, col: Color) -> None:
        self.rect(0, 0, self.w - 1, self.h - 1, col)

    def rect(self, x0: int, y0: int, x1: int, y1: int, col: Color | None) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, col)

    def disc(self, cx: float, cy: float, r: float, col: Color | None) -> None:
        self.ellipse(cx, cy, r, r, col)

    def ellipse(self, cx: float, cy: float, rx: float, ry: float, col: Color | None) -> None:
        for y in range(self.h):
            for x in range(self.w):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                    self.set(x, y, col)

    def line(self, x0: int, y0: int, x1: int, y1: int, col: Color | None) -> None:
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.set(x0, y0, col)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def poly(self, pts: list[tuple[float, float]], col: Color | None) -> None:
        """Filled polygon (even-odd scanline), pixel-centre sampling."""
        n = len(pts)
        for y in range(self.h):
            xs: list[float] = []
            yc = y + 0.5
            for i in range(n):
                (xa, ya), (xb, yb) = pts[i], pts[(i + 1) % n]
                if (ya <= yc < yb) or (yb <= yc < ya):
                    xs.append(xa + (yc - ya) * (xb - xa) / (yb - ya))
            xs.sort()
            for a, b in zip(xs[0::2], xs[1::2]):
                for x in range(math.ceil(a - 0.5), math.floor(b - 0.5) + 1):
                    self.set(x, y, col)

    def paste(self, other: "Canvas", ox: int, oy: int) -> None:
        for y in range(other.h):
            for x in range(other.w):
                p = other.px[x, y]
                if p[3] > 0:
                    self.set(ox + x, oy + y, p[:3])

    def mirrored(self) -> "Canvas":
        out = Canvas(self.w, self.h)
        out.img = self.img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        out.px = _pixels(out.img)
        return out

    def speckle(self, rng, col: Color, count: int, mask_color: Color | None = None) -> None:
        """Scatter single pixels. If mask_color is given, only paint over that exact color."""
        for _ in range(count):
            x, y = rng.randrange(self.w), rng.randrange(self.h)
            if mask_color is None or self.get(x, y)[:3] == mask_color:
                self.set(x, y, col)

    # --- whole-sprite passes ---------------------------------------------
    def outline(self, col: Color, diagonals: bool = False) -> None:
        """Add a 1px outline around the opaque silhouette (drawn on transparent pixels only)."""
        added: list[tuple[int, int]] = []
        steps = [(1, 0), (-1, 0), (0, 1), (0, -1)]
        if diagonals:
            steps += [(1, 1), (-1, 1), (1, -1), (-1, -1)]
        for y in range(self.h):
            for x in range(self.w):
                if self.opaque(x, y):
                    continue
                if any(self.opaque(x + dx, y + dy) for dx, dy in steps):
                    added.append((x, y))
        for x, y in added:
            self.set(x, y, col)

    def sel_outline(self, ground: Color | None = None, darken: float = 0.32) -> None:
        """Selective outline: each outline pixel is a darkened, cooled copy of the colour it borders,
        so the silhouette reads as shaded form instead of a uniform black line. Pixels that only
        border the bottom edge of the sprite (feet) use `ground` when given."""
        todo: list[tuple[int, int, Color]] = []
        for y in range(self.h):
            for x in range(self.w):
                if self.opaque(x, y):
                    continue
                nb = [(x, y + 1), (x + 1, y), (x - 1, y), (x, y - 1)]
                src = next((self.px[a, b][:3] for a, b in nb if self.opaque(a, b)), None)
                if src is None:
                    continue
                below = self.opaque(x, y - 1) and not any(self.opaque(a, b) for a, b in nb[:3])
                if below and ground is not None:
                    todo.append((x, y, ground))
                    continue
                r, g, b = src
                todo.append((x, y, (int(r * darken), int(g * (darken - 0.02)), int(b * (darken + 0.12) + 6))))
        for x, y, col in todo:
            self.set(x, y, col)

    def inner_outline(self, col: Color) -> None:
        """Recolor silhouette-edge pixels (opaque pixels touching transparency) with col."""
        edge = [
            (x, y)
            for y in range(self.h)
            for x in range(self.w)
            if self.opaque(x, y)
            and any(not self.opaque(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        ]
        for x, y in edge:
            self.set(x, y, col)

    def rim_light(self, ramp: list[Color]) -> None:
        """Cheap SNES-style lighting: lift pixels on the upper-left silhouette edge one ramp step,
        and sink pixels on the lower-right edge one step. Pixels not in `ramp` are untouched."""
        lookup = {c: i for i, c in enumerate(ramp)}
        changes: list[tuple[int, int, Color]] = []
        for y in range(self.h):
            for x in range(self.w):
                if not self.opaque(x, y):
                    continue
                cur = self.px[x, y][:3]
                if cur not in lookup:
                    continue
                i = lookup[cur]
                if not self.opaque(x - 1, y) or not self.opaque(x, y - 1):
                    changes.append((x, y, ramp[min(i + 1, len(ramp) - 1)]))
                elif not self.opaque(x + 1, y) or not self.opaque(x, y + 1):
                    changes.append((x, y, ramp[max(i - 1, 0)]))
        for x, y, c in changes:
            self.set(x, y, c)

    def replace(self, mapping: dict[Color, Color]) -> None:
        for y in range(self.h):
            for x in range(self.w):
                p = self.px[x, y]
                if p[3] and p[:3] in mapping:
                    self.px[x, y] = (*mapping[p[:3]], 255)


def hflip_sheet_row(imgs: Iterable[Canvas]) -> list[Canvas]:
    return [c.mirrored() for c in imgs]


def scaled(img: Image.Image, k: int) -> Image.Image:
    return img.resize((img.width * k, img.height * k), Image.Resampling.NEAREST)
