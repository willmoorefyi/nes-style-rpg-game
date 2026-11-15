"""Status icons (9x9) and the two overlay signs (speech bubble, question mark), in the fixed `icon` ramp:
0 ink, 1 grey, 2 light grey, 3 white, 4 yellow, 5 purple, 6 green, 7 blue, 8 red, 9 violet (fx_palette.RAMPS_EXTRA).
docs/FEEDBACK_PLAN_2026-11-14.md §3.5 (Fe refines and wires them)."""
from __future__ import annotations

from pixel import Canvas

import glyph_draw as D

Color = tuple[int, int, int]

ICONS = {
    "icon_sleep": [".........", ".0000000.", ".0333330.", ".0003300.", "..03300..", ".033000..", ".0333330.",
                   ".0000000.", "........."],
    "icon_stun": [".........", "....0....", "...040...", ".0004000.", ".0444440.", ".0004000.", "...040...",
                  "....0....", "........."],
    "icon_poison": [".........", "....0....", "...060...", "...060...", "..06360..", "..06660..", "..06660..",
                    "...000...", "........."],
    "icon_stone": [".........", "..00000..", ".0322210.", ".0221110.", ".0211210.", ".0212110.", ".0111110.",
                   "..00000..", "........."],
    "icon_blind": [".........", ".......8.", "..00008..", ".0332830.", ".0308030.", ".0383330.", "..800000.",
                   ".8.......", "........."],
    "icon_silence": [".........", ".0000000.", ".0333380.", ".0303830.", ".0338330.", ".0083330.", ".080000..",
                     "...00....", "........."],
    "icon_fear": [".........", "....0....", "...070...", "...070...", "..07370...", "..07770..", "..07770..",
                  "...000...", "........."],
    "icon_frozen": [".........", "....7....", ".7..3..7.", "..7.3.7..", ".7733377.", "..7.3.7..", ".7..3..7.",
                    "....7....", "........."],
    "icon_confuse": [".........", "..00000..", ".0333330.", ".0300030.", "....0330.", "...0330..", "...030...",
                     "...030...", "........."],
}

QUESTION = ["........", "..0000..", ".033330.", ".030030.", "....030.", "...030..", "...030..", "...00...",
            "...030..", "...00...", "........"]


def _from(rows: list[str]):
    def draw(r: list[Color], _f: int) -> Canvas:
        c = Canvas(len(rows[0]), len(rows))
        D.plot(c, rows, {str(i): col for i, col in enumerate(r)})
        return c
    return draw


def ellipsis(r: list[Color], _f: int) -> Canvas:
    """SILENCE's overlay: a white speech bubble with three dots, struck through in red."""
    c = Canvas(16, 12)
    c.rect(2, 3, 13, 7, r[3])
    c.rect(3, 2, 12, 8, r[3])
    c.rect(3, 9, 4, 9, r[3])
    for x in (4, 7, 10):
        c.rect(x, 4, x + 1, 5, r[0])
    c.outline(r[0])
    for i in range(9):
        c.set(3 + i, 9 - i, r[8])
    return c


GLYPHS = {
    **{name: ((9, 9), _from(rows)) for name, rows in ICONS.items()},
    "question": ((8, 11), _from(QUESTION)),
    "ellipsis": ((16, 12), ellipsis),
}
