"""The larger fx glyphs, drawn procedurally: rings, the healing halo, the hex shield, the light beam, bursts, the
fireball, bolt segments, feathers, skull wisps, ink and dust puffs. See glyphs.py for the rules."""
from __future__ import annotations

import math

from pixel import Canvas

import glyph_draw as D

Color = tuple[int, int, int]


def ring(r: list[Color], f: int) -> Canvas:
    """An expanding ring: a hot core band with a darker rim, thinner and dimmer as it grows."""
    c = Canvas(32, 32)
    cx = cy = 16
    if f == 0:
        D.disc(c, cx, cy, 5, r[3])
        D.disc(c, cx, cy, 3.5, r[4])
        D.band(c, cx, cy, 6, 5, r[1])
        return c
    ro = (0, 9.5, 12.8, 15)[f]
    if f < 3:
        D.band(c, cx, cy, ro, ro - 1, r[1])
        D.band(c, cx, cy, ro - 1, ro - 2.2, r[4])
        D.band(c, cx, cy, ro - 2.2, ro - 3.2, r[3])
    else:
        D.band(c, cx, cy, ro, ro - 1, r[1], keep=lambda x, y: (x + y) % 3 != 0)
        D.band(c, cx, cy, ro - 1, ro - 2, r[3], keep=lambda x, y: (x + y) % 3 != 0)
    return c


def glow(r: list[Color], f: int) -> Canvas:
    """The healing halo: a 2-px elliptical ring in a 50 % checker of the ramp's lightest colour; it swells and its
    checker parity alternates."""
    c = Canvas(56, 68)
    rx = (19.5, 22.5, 25.5)[f]
    D.band(c, 28, 34, rx, rx - 2, r[4], ry_scale=1.2, keep=lambda x, y: (x + y + f) % 2 == 0)
    D.band(c, 28, 34, rx - 2, rx - 3, r[3], ry_scale=1.2, keep=lambda x, y: (x + y) % 4 == f % 4)
    return c


def _hex(cx: float, cy: float, rad: float) -> list[tuple[float, float]]:
    return [(cx + rad * math.cos(math.radians(a)), cy - rad * 1.15 * math.sin(math.radians(a)))
            for a in (90, 30, -30, -90, -150, 150)]


def shield(r: list[Color], f: int) -> Canvas:
    """A hex shield in the element's colours: forming (rim from the top), whole, then lit."""
    c = Canvas(48, 56)
    cx, cy = 24, 28
    outer = Canvas(48, 56)
    outer.poly(_hex(cx, cy, 21), r[3])
    inner = _hex(cx, cy, 18.5)
    outer.poly(inner, None)
    if f == 0:  # forming: only the upper half of the rim
        for y in range(cy, 56):
            for x in range(48):
                outer.set(x, y, None)
    c.paste(outer, 0, 0)
    # the rim's lit top-left facets
    for (xa, ya), (xb, yb) in zip(_hex(cx, cy, 19.8), _hex(cx, cy, 19.8)[1:] + _hex(cx, cy, 19.8)[:1]):
        if (xa + xb) / 2 <= cx + 1 and (ya + yb) / 2 <= cy + 2 and (f > 0 or max(ya, yb) <= cy):
            c.line(round(xa), round(ya), round(xb), round(yb), r[4])
    c.outline(r[1])
    fill = Canvas(48, 56)
    fill.poly(inner, r[2])
    for y in range(56):  # a sparse lattice inside, denser on the lit frame (the ally stays visible through it)
        for x in range(48):
            dot = (x % 4 == 0 and y % 4 == 0) if f < 2 else ((x + y) % 4 == 0 and y % 2 == 0)
            if fill.opaque(x, y) and not c.opaque(x, y) and dot and (f > 0 or y < cy):
                c.set(x, y, r[2] if f < 2 else r[3])
    return c


def beam(r: list[Color], f: int) -> Canvas:
    """A column of light that tiles vertically: a white core, coloured sides and dithered edges with motes."""
    c = Canvas(20, 32)
    for y in range(32):
        wob = (0, 0, 1, 1, 0, 0, -1, -1)[(y // 2 + f * 2) % 8]
        for x in range(20):
            d = abs(x + 0.5 - 10) - wob * 0.5
            if d < 2.5:
                c.set(x, y, r[4])
            elif d < 4.5:
                c.set(x, y, r[3])
            elif d < 6.5:
                c.set(x, y, r[2])
            elif d < 8 and (x + y + f) % 2 == 0:
                c.set(x, y, r[1])
    for i in range(4):
        my = (i * 8 + f * 4) % 32
        mx = (3, 15, 5, 14)[i]
        c.set(mx, my, r[4])
    return c


def burst(r: list[Color], f: int) -> Canvas:
    """A star burst: a hot flash, spikes, a broken ring, then scattered fragments."""
    c = Canvas(24, 24)
    cx = cy = 12
    spikes = [math.radians(a) for a in range(0, 360, 45)]
    if f == 0:
        D.disc(c, cx, cy, 4.5, r[3])
        D.disc(c, cx, cy, 3, r[4])
        c.outline(r[1])
    elif f == 1:
        for a in spikes:
            c.line(cx, cy, round(cx + 9 * math.cos(a)), round(cy + 9 * math.sin(a)), r[3])
        D.disc(c, cx, cy, 5, r[3])
        D.disc(c, cx, cy, 3.2, r[4])
        c.outline(r[1])
    elif f == 2:  # the spikes fly outward, the core cools
        for a in spikes:
            c.line(round(cx + 6 * math.cos(a)), round(cy + 6 * math.sin(a)),
                   round(cx + 9 * math.cos(a)), round(cy + 9 * math.sin(a)), r[3])
            c.set(round(cx + 9 * math.cos(a)), round(cy + 9 * math.sin(a)), r[4])
        D.disc(c, cx, cy, 3, r[2])
        D.disc(c, cx - 0.5, cy - 0.5, 1.5, r[3])
        c.outline(r[1])
    else:
        for a in spikes:
            x, y = round(cx - 1 + 9.5 * math.cos(a + 0.4)), round(cy - 1 + 9.5 * math.sin(a + 0.4))
            c.rect(x, y, x + 1, y + 1, r[2])
            c.set(x, y, r[3])
    return c


def fireball(r: list[Color], f: int) -> Canvas:
    """A breath fireball in 3 sizes (grows along its path); its flicker trail points left, back to the mouth."""
    c = Canvas(18, 16)
    cx, cy = 10.5, 8
    rad = (2.6, 4.0, 5.2)[f]
    for i in range(3):  # the trail
        tx = round(cx - rad - 1 - i * 1.6)
        ty = round(cy - 0.5 + (0, -1, 1)[(i + f) % 3])
        if tx >= 2:
            c.set(tx, ty, r[2] if i == 0 else r[1])
    D.disc(c, cx, cy, rad, r[2])
    D.disc(c, cx + 0.4, cy - 0.4, rad * 0.72, r[3])
    D.disc(c, cx + 0.6, cy - 0.6, rad * 0.4, r[4])
    c.outline(r[0])
    return c


def bolt(r: list[Color], f: int) -> Canvas:
    """A lightning segment that tiles vertically: it enters at the top centre and leaves at the bottom centre."""
    c = Canvas(12, 16)
    path = ([(6, 0), (4, 3), (8, 7), (3, 11), (6, 15)],
            [(6, 0), (8, 4), (4, 8), (7, 12), (6, 15)],
            [(6, 0), (3, 5), (7, 9), (5, 12), (6, 15)])[f]
    D.thick_path(c, path, r[3], 2)
    if f == 1:
        D.thick_path(c, [(4, 8), (2, 11)], r[3], 1)
    D.thick_path(c, path, r[4], 1)
    c.outline(r[1])
    return c


def feather(r: list[Color], f: int) -> Canvas:
    """A falling feather, tilted one way then the other."""
    c = Canvas(13, 17)
    x0, y0, x1, y1 = (8, 14, 4, 2) if f == 0 else (4, 14, 8, 2)
    for y in range(c.h):
        for x in range(c.w):
            t = (y + 0.5 - y0) / (y1 - y0)
            if not 0.05 <= t <= 1:
                continue
            sx = x0 + (x1 - x0) * t
            half = 2.2 * math.sin(math.pi * min(1.0, t * 1.1)) ** 0.6
            d = x + 0.5 - sx
            if abs(d) <= half:
                c.set(x, y, r[4] if d < -0.4 else r[3] if d < 0.6 else r[2])
    c.line(x0, y0, round(x0 + (x1 - x0) * 0.45), round(y0 + (y1 - y0) * 0.45), r[1])
    c.outline(r[1])
    return c


SKULL = [
    "............",
    "....0000....",
    "...034430...",
    "..03444430..",
    "..04444443..",
    "..40044003..",
    "..40044003..",
    "..34443433..",
    "...334433...",
    "....3.3.....",
    "....223.....",
    ".....221....",
    "....221.....",
    "....11......",
    "............",
]


def skull(r: list[Color], f: int) -> Canvas:
    """A skull wisp (FEAR): a small skull trailing a wavy tail that sways between frames."""
    c = Canvas(12, 15)
    rows = SKULL if f == 0 else SKULL[:10] + ["....322.....", "...122......", "....122.....", ".....11.....",
                                              "............"]
    D.plot(c, rows, {str(i): col for i, col in enumerate(r)})
    return c


def ink(r: list[Color], f: int) -> Canvas:
    """An ink puff (DARK): a dark cloud of three blobs with a dim top-left light."""
    c = Canvas(16, 14)
    grow = 0.6 * f
    for bx, by, br in ((6.5, 7.5, 2.6), (9.5, 6.5, 2.9), (8.5, 8.5, 2.4)):
        D.disc(c, bx, by, br + grow, r[1])
    D.disc(c, 7.4, 6.2, 1.4 + grow * 0.5, r[2])
    c.set(7, 5, r[3])
    c.outline(r[0])
    return c


def dust(r: list[Color], f: int) -> Canvas:
    """A dust puff at a slam: small, billowing, then breaking up."""
    c = Canvas(14, 12)
    if f < 2:
        for bx, by, br in ((4.5, 6.5, 2 + f), (8.5, 6.0, 2.4 + f), (6.5, 4.8 + f * 0.0, 1.8 + f)):
            D.disc(c, bx, by, br, r[2])
        D.disc(c, 5.5 + f, 4.6, 1.2 + f * 0.6, r[3])
        c.set(round(5 + f), 4, r[4])
        c.outline(r[1])
    else:
        for bx, by in ((2, 6), (5, 3), (9, 3), (11, 6), (6, 7)):
            c.rect(bx, by, bx + 1, by + 1, r[2])
            c.set(bx, by, r[3])
    return c


# name -> (cell, frames, draw, tile)
GLYPHS = {
    "ring": ((32, 32), 4, ring, None),
    "glow": ((56, 68), 3, glow, None),
    "shield": ((48, 56), 3, shield, None),
    "beam": ((20, 32), 2, beam, "v"),
    "burst": ((24, 24), 4, burst, None),
    "fireball": ((18, 16), 3, fireball, None),
    "bolt": ((12, 16), 3, bolt, "v"),
    "feather": ((13, 17), 2, feather, None),
    "skull": ((12, 15), 2, skull, None),
    "ink": ((16, 14), 2, ink, None),
    "dust": ((14, 12), 3, dust, None),
}
