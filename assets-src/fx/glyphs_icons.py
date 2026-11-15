"""Status icons (12x12 native, 24 px at the atlas's x2) and the two overlay signs (speech bubble, question mark), in the
fixed `icon` ramp: 0 ink, 1 grey, 2 light grey, 3 white, 4 yellow, 5 purple, 6 green, 7 blue, 8 red, 9 violet
(fx_palette.RAMPS_EXTRA). docs/FEEDBACK_PLAN_2026-11-14.md §3.5: every icon has a 1-px ink outline so it reads on the
bright plain and on dark backgrounds, a clear 1-px border, and a distinct shape and colour per status:
sleep Z (white / violet), stun spark (yellow), poison drop (green), stone block (grey), blind eye with a bar, silence
crossed bubble (red slash), fear sweat drop (blue, tilted), frozen flake (blue / white), confuse ? (yellow).
"""
from __future__ import annotations

from pixel import Canvas

import glyph_draw as D

Color = tuple[int, int, int]

ICONS = {
    "icon_sleep": ["............", ".000000000..", ".033333330..", ".099993390..", "....0339....", "...0339.....",
                   "..0339......", ".0339000000.", ".033333330..", ".099999990..", ".000000000..", "............"],
    "icon_stun": ["............", ".....00.....", "....0440....", "....0440....", "..00434400..", ".0444334440.",
                  ".0444334440.", "..00443400..", "....0440....", "....0440....", ".....00.....", "............"],
    "icon_poison": ["............", ".....00.....", "....0660....", "....0660....", "...066660...", "..06366660..",
                    "..06366660..", "..06636660..", "..06666660..", "...066660...", "....0000....", "............"],
    "icon_stone": ["............", "...000000...", "..03322210..", ".0332222110.", ".0322202110.", ".0222011110.",
                   ".0221101110.", ".0211110110.", ".0111111110.", "..01111110..", "...000000...", "............"],
    "icon_fear": ["............", ".......00...", "......070...", ".....0770...", "....07770...", "...073770...",
                  "..0737770...", "..0777770...", "..0777770...", "...07770....", "....000.....", "............"],
    "icon_frozen": ["............", ".....77.....", "..7..33..7..", "...7.33.7...", "....7337....", ".7733333377.",
                    ".7733333377.", "....7337....", "...7.33.7...", "..7..33..7..", ".....77.....", "............"],
    "icon_confuse": ["............", "...000000...", "..04444440..", "..04400440..", "...00.0440..", ".....04400..",
                     "....04400...", "....0440....", "....0000....", "....0440....", "....0000....", "............"],
}

QUESTION = ["........", "..0000..", ".033330.", ".030030.", "....030.", "...030..", "...030..", "...00...",
            "...030..", "...00...", "........"]


def _from(rows: list[str]):
    def draw(r: list[Color], _f: int) -> Canvas:
        c = Canvas(len(rows[0]), len(rows))
        D.plot(c, rows, {str(i): col for i, col in enumerate(r)})
        return c
    return draw


def silence_icon(r: list[Color], _f: int) -> Canvas:
    """SILENCE: a white speech bubble with three ink dots, struck through by a red slash."""
    c = Canvas(12, 12)
    c.rect(2, 3, 9, 7, r[3])
    c.rect(3, 2, 8, 8, r[3])
    c.rect(3, 9, 3, 9, r[3])
    for x in (3, 5, 7):
        c.set(x + 1, 5, r[0])
    c.outline(r[0])
    for i in range(8):
        c.set(2 + i, 9 - i, r[8])
    return c


def blind_icon(r: list[Color], _f: int) -> Canvas:
    """BLIND: an open eye (white, blue iris, ink pupil) with a dark bar across it, top-left to bottom-right."""
    c = Canvas(12, 12)
    c.rect(3, 4, 8, 7, r[3])
    c.rect(2, 5, 9, 6, r[3])
    c.rect(5, 4, 6, 7, r[7])
    c.rect(5, 5, 6, 6, r[0])
    c.outline(r[0])
    for i in range(8):
        for d in (0, 1):
            c.set(2 + i, 1 + i + d, r[1] if d == 0 else r[0])
    return c


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
    **{name: ((12, 12), _from(rows)) for name, rows in ICONS.items()},
    "icon_silence": ((12, 12), silence_icon),
    "icon_blind": ((12, 12), blind_icon),
    "question": ((8, 11), _from(QUESTION)),
    "ellipsis": ((16, 12), ellipsis),
}
