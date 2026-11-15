"""The battle-fx glyphs (docs/FEEDBACK_PLAN_2026-11-14.md §3.4): small native-pixel particles, 1-4 frames each.

Each glyph is drawn from one 5-colour ramp (fx_palette.RAMPS, darkest -> lightest) and baked once per ramp it is
used in. Binary alpha, every pixel on the ramp, a clear 1-px border (tileable glyphs may touch the tiled edges).
Small glyphs are hand-pixelled maps (`0`-`4` = ramp index); the larger ones are drawn in glyphs_big.py.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

from pixel import Canvas

import fx_palette as P
import glyph_draw as D
import glyphs_big as BIG
import glyphs_icons as ICONS

Color = tuple[int, int, int]
Draw = Callable[[list[Color], int], Canvas]


@dataclass(frozen=True)
class Glyph:
    cell: tuple[int, int]
    frames: int
    draw: Draw
    # 'v': tiles vertically (may touch the top and bottom edges)
    tile: str | None = None
    # the only ramp the glyph exists in (icons, the heat shimmer), or None for any ramp
    fixed: str | None = None
    ramps: tuple[str, ...] = field(default_factory=tuple)


def maps(*frames: list[str]) -> Draw:
    """A glyph from hand-pixelled frames; digits index the ramp."""
    def draw(r: list[Color], f: int) -> Canvas:
        rows = frames[f]
        c = Canvas(len(rows[0]), len(rows))
        D.plot(c, rows, {str(i): col for i, col in enumerate(r)})
        return c
    return draw


def flame(r: list[Color], f: int) -> Canvas:
    """A flame tongue rising from a round base; the tip sways and splits between frames."""
    c = Canvas(12, 18)
    sway = (0.0, 2.2, -2.0)[f]
    D.teardrop(c, 6, 2.0 + (f == 1), 16, 4.6, r[1], sway)
    D.teardrop(c, 6, 5.0, 15.6, 3.4, r[2], sway * 0.7)
    D.teardrop(c, 6 - 0.4, 8.0 + f % 2, 15.2, 2.3, r[3], sway * 0.4)
    D.teardrop(c, 6 - 0.6, 11.0, 14.8, 1.2, r[4])
    if f == 2:  # a split second tongue on the right
        D.teardrop(c, 8.6, 4.0, 10.0, 1.0, r[2], 0.6)
    c.outline(r[0])
    return c


def shard(r: list[Color], f: int) -> Canvas:
    """An ice shard falling point-down: a lit left face, a shaded right face, a glint that travels."""
    rows = [
        "..........",
        "....00....",
        "...0430...",
        "..043210..",
        "..043210..",
        ".04432210.",
        ".04332110.",
        ".04322110.",
        "..432110..",
        "..432110..",
        "..43210...",
        "...4210...",
        "...4210...",
        "....310...",
        "....30....",
        "....0.....",
        "..........",
    ]
    c = maps(rows)(r, 0)
    gx, gy = ((4, 3), (3, 8))[f]
    c.set(gx, gy, r[4])
    c.set(gx + 1, gy + 1, r[4])
    return c


SPARK = maps(
    [".......", "...3...", "...4...", ".34443.", "...4...", "...3...", "......."],
    [".......", ".3...3.", "..3.3..", "...4...", "..3.3..", ".3...3.", "......."],
)

SPARKLE = maps(
    [".........", ".........", "....2....", "....3....", "..23432..", "....3....", "....2....", ".........",
     "........."],
    [".........", "....2....", "....3....", "....4....", ".2344432.", "....4....", "....3....", "....2....",
     "........."],
    [".........", ".........", "..2...2..", "...3.3...", "....4....", "...3.3...", "..2...2..", ".........",
     "........."],
)

BUBBLE = maps(
    ["........", "..1111..", ".143221.", ".132221.", ".122221.", ".122211.", "..1111..", "........"],
    ["........", ".3....3.", "..2..2..", "........", "........", "..2..2..", ".3....3.", "........"],
)

Z_GLYPH = maps(
    ["...........", "...........", "...........", "...........", "....000....", "....440....", ".....40....",
     "....40.....", "....440....", "....000....", "..........."],
    ["...........", "...........", "...........", "..000000...", "..444440...", "......40...", ".....40....",
     "....40.....", "...444440..", "...000000..", "..........."],
    ["...........", ".00000000..", ".44444440..", ".......40..", "......40...", ".....40....", "....40.....",
     "...40......", "..44444440.", "..00000000.", "..........."],
)

STAR = maps(
    [".........", "....4....", "....4....", ".3344433.", "..34443..", "...434...", "..43.34..", "..3...3..",
     "........."],
    [".........", "...3.3...", "....4....", "..34443..", ".3444443.", "..34443..", "....4....", "...3.3...",
     "........."],
)

SWEAT = maps(["......", "...0..", "..030.", ".0430.", ".0430.", ".0330.", "..00..", "......"])

CHEVRON_UP = maps(
    ["...........", ".....0.....", "....040....", "...04340...", "..0432340..", ".043202340.", ".0320.0230.",
     "..00...00..", "..........."],
    ["...........", ".....0.....", "....040....", "...04440...", "..0443440..", ".044302440.", ".0430.0340.",
     "..00...00..", "..........."],
)


def chevron_down(r: list[Color], f: int) -> Canvas:
    up = CHEVRON_UP(r, f)
    out = Canvas(up.w, up.h)
    for y in range(up.h):
        for x in range(up.w):
            p = up.px[x, up.h - 1 - y]
            if p[3]:
                out.set(x, y, p[:3])
    return out


GLINT = maps(
    ["...........", "...........", "...........", "...........", ".....4.....", "....444....", ".....4.....",
     "...........", "...........", "...........", "..........."],
    ["...........", "...........", ".....3.....", ".....4.....", "....444....", "..3444443..", "....444....",
     ".....4.....", ".....3.....", "...........", "..........."],
    ["...........", ".....2.....", "..2..3..2..", "...3.4.3...", "....444....", ".234444432.", "....444....",
     "...3.4.3...", "..2..3..2..", ".....2.....", "..........."],
    ["...........", "...........", "...........", ".....3.....", "....3.3....", "...3.4.3...", "....3.3....",
     ".....3.....", "...........", "...........", "..........."],
)

ORB = maps(
    ["........", "..1111..", ".123321.", ".134431.", ".134431.", ".123321.", "..1111..", "........"],
    ["........", "...11...", "..2332..", ".134431.", ".134431.", "..2332..", "...11...", "........"],
)


def shimmer(r: list[Color], f: int) -> Canvas:
    """Heat shimmer: 1-px wavy vertical lines in the fire ramp's two lightest colours (tiles vertically)."""
    c = Canvas(12, 16)
    wave = (0, 1, 1, 0, 0, -1, -1, 0)
    for i, x0 in enumerate((2, 6, 9)):
        for y in range(16):
            if (y + i * 3) % 8 in (6, 7):
                continue
            dx = wave[(y + f * 2 + i * 3) % 8]
            c.set(x0 + dx, y, r[4] if (y + i) % 3 else r[3])
    return c


GLYPHS: dict[str, Glyph] = {
    "flame": Glyph((12, 18), 3, flame),
    "shard": Glyph((10, 17), 2, shard),
    "spark": Glyph((7, 7), 2, SPARK),
    "sparkle": Glyph((9, 9), 3, SPARKLE),
    "bubble": Glyph((8, 8), 2, BUBBLE),
    "z": Glyph((11, 11), 3, Z_GLYPH),
    "star": Glyph((9, 9), 2, STAR),
    "sweat": Glyph((6, 8), 1, SWEAT),
    "chevron_up": Glyph((11, 9), 2, CHEVRON_UP),
    "chevron_down": Glyph((11, 9), 2, chevron_down),
    "glint": Glyph((11, 11), 4, GLINT),
    "orb": Glyph((8, 8), 2, ORB),
    "shimmer": Glyph((12, 16), 2, shimmer, tile="v", fixed="fire"),
    **{name: Glyph(spec[0], spec[1], spec[2], tile=spec[3]) for name, spec in BIG.GLYPHS.items()},
    **{name: Glyph(spec[0], 1, spec[1], fixed="icon") for name, spec in ICONS.GLYPHS.items()},
}


def colors_for(glyph: str, ramp: str) -> list[Color]:
    return P.colors(GLYPHS[glyph].fixed or ramp)


def render(glyph: str, ramp: str) -> list[Canvas]:
    spec = GLYPHS[glyph]
    if spec.fixed and ramp != spec.fixed:
        raise KeyError(f"glyph {glyph} exists only in ramp {spec.fixed}, not {ramp}")
    cols = P.colors(ramp)
    return [spec.draw(cols, f) for f in range(spec.frames)]
