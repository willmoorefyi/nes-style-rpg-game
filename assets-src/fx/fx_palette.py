"""Effect colour ramps for the battle-fx atlas, in the SNES 15-bit palette (5 bits per channel, see snes_palette.py).

Every ramp has 5 colours, darkest -> lightest (index 0 is the rim / outline shade, 4 the hot core or highlight).
The runtime never tints a glyph: each glyph is baked once per ramp it is used in (`<glyph>.<ramp>` in battle-fx.json).
"""
from __future__ import annotations

import snes_palette as SP
from snes_palette import ramp

Color = tuple[int, int, int]

RAMPS: dict[str, list[Color]] = {
    # elements
    "fire": ramp((14, 2, 1), (25, 6, 1), (31, 13, 2), (31, 22, 5), (31, 30, 16)),
    "ice": ramp((4, 7, 18), (7, 14, 26), (12, 22, 31), (21, 28, 31), (30, 31, 31)),
    "bolt": ramp((12, 8, 2), (24, 18, 3), (31, 27, 6), (31, 31, 17), (31, 31, 30)),
    "holy": ramp((13, 12, 20), (20, 20, 27), (26, 26, 30), (29, 30, 31), (31, 31, 31)),
    # restoratives
    "heal": ramp((2, 10, 5), (4, 18, 8), (10, 26, 10), (20, 31, 16), (29, 31, 27)),
    "ether": ramp((3, 5, 17), (5, 11, 25), (9, 18, 31), (17, 25, 31), (27, 30, 31)),
    "gold": ramp((14, 8, 2), (22, 15, 4), (29, 22, 8), (31, 28, 16), (31, 31, 26)),
    # buffs (chevrons up) and debuffs (chevrons down)
    "def": ramp((3, 6, 19), (6, 11, 27), (10, 17, 31), (18, 24, 31), (27, 29, 31)),
    "evade": ramp((1, 10, 12), (3, 17, 19), (7, 25, 26), (16, 31, 31), (27, 31, 31)),
    "atk": ramp((13, 2, 3), (22, 4, 5), (30, 8, 7), (31, 17, 14), (31, 26, 24)),
    "speed": ramp((14, 10, 1), (23, 18, 2), (30, 26, 4), (31, 31, 13), (31, 31, 26)),
    "curse": ramp((7, 2, 11), (13, 4, 19), (19, 8, 26), (25, 15, 31), (30, 25, 31)),
    "fear": ramp((3, 2, 6), (8, 5, 12), (14, 10, 19), (21, 18, 26), (29, 27, 31)),
    # statuses
    "sleep": ramp((9, 6, 15), (15, 11, 23), (21, 17, 29), (27, 24, 31), (31, 31, 31)),
    "poison": ramp((4, 10, 2), (8, 16, 3), (13, 23, 5), (20, 29, 9), (27, 31, 18)),
    "blind": ramp((2, 2, 4), (5, 5, 9), (9, 9, 14), (15, 15, 20), (22, 22, 27)),
    "silence": ramp((13, 3, 4), (23, 6, 6), (31, 11, 10), (31, 21, 19), (31, 29, 28)),
    "stun": ramp((14, 10, 1), (23, 18, 2), (30, 26, 4), (31, 31, 13), (31, 31, 26)),
    "stone": list(SP.STONE),
    # cue dust (sand / dirt of the battle plain)
    "dust": ramp((9, 6, 3), (15, 11, 6), (21, 17, 10), (26, 22, 15), (30, 27, 21)),
}

# Status icons: a dark ink outline and a few fixed colours shared by every icon (glyph ramp `icon`).
ICON: list[Color] = ramp((1, 1, 3), (10, 10, 14), (22, 22, 26), (31, 31, 31), (31, 27, 6))
ICON_ACCENTS: list[Color] = ramp((8, 4, 18), (6, 20, 6), (8, 14, 31), (31, 8, 8), (20, 12, 30))
RAMPS_EXTRA: dict[str, list[Color]] = {"icon": ICON + ICON_ACCENTS}


def colors(name: str) -> list[Color]:
    """Every colour a glyph in ramp `name` may use."""
    if name in RAMPS_EXTRA:
        return RAMPS_EXTRA[name]
    return RAMPS[name]


def hex_of(c: Color) -> str:
    return "#%02x%02x%02x" % c
