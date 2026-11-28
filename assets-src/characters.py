"""SNES-style two-tile characters (16x32: a "head" tile above a "feet" tile).

Proportions follow the later 16-bit / pixel-remaster school: roughly three heads tall, a
smaller face with real features, six-tone shading with cool shadows and warm highlights,
coloured selective outlines, and clothing with folds, plates and trim.

Each character is a 6x5 block of 16x32 cells:
  rows 0-3  field walk: down, up, left, right   (cols 0-2 = stand, step A, step B)
  row  4    battle poses, facing LEFT toward the enemies:
            ready, attack, cast, hurt, down (kneeling), victory
Figures are composed from separately drawn parts so poses and walk frames only change
part offsets. Light always comes from the top-left.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from PIL import Image

import snes_palette as P
from pixel import Canvas

CELL_W, CELL_H = 16, 32
BLOCK_COLS, BLOCK_ROWS = 6, 5
GROUND = P.c15(2, 2, 4)
EYE = P.c15(3, 2, 5)
WHITE = P.c15(31, 31, 31)

# Ramp indices: 0 deepest shadow ... 3 base ... 5 highlight
SH2, SH1, MD, BASE, LT, HI = range(6)


def shade_ramp(r: int, g: int, b: int) -> list:
    """6-step ramp from a 5-bit base: shadows deepen and cool, highlights lift and warm."""
    def cl(v: float) -> int:
        return max(0, min(31, int(round(v))))
    return [P.c15(*t) for t in (
        (cl(r * 0.30), cl(g * 0.30), cl(b * 0.42 + 3)),
        (cl(r * 0.48), cl(g * 0.48), cl(b * 0.62 + 2)),
        (cl(r * 0.72), cl(g * 0.72), cl(b * 0.86 + 1)),
        (r, g, b),
        (cl(r * 1.12 + 2), cl(g * 1.10 + 2), cl(b * 1.02 + 1)),
        (cl(r * 1.24 + 5), cl(g * 1.22 + 5), cl(b * 1.08 + 3)),
    )]


def _skin(*tones: tuple[int, int, int]) -> list:
    return [P.c15(*t) for t in tones]


SKIN_LIGHT = _skin((12, 6, 7), (18, 10, 9), (24, 15, 12), (28, 20, 16), (30, 24, 20), (31, 28, 24))
SKIN_TAN = _skin((10, 5, 5), (15, 8, 7), (20, 12, 9), (24, 16, 11), (27, 20, 14), (30, 24, 18))
SKIN_DARK = _skin((7, 3, 4), (11, 6, 5), (15, 9, 7), (19, 12, 9), (22, 15, 11), (25, 19, 14))
STEEL = shade_ramp(17, 19, 23)
GOLD = shade_ramp(27, 22, 6)


@dataclass
class Look:
    skin: list = field(default_factory=lambda: SKIN_LIGHT)
    hair: tuple[int, int, int] | None = (14, 8, 4)
    hair_style: str = "short"        # short | spiky | long | bun | bald
    cloth: tuple[int, int, int] = (8, 12, 22)
    trim: tuple[int, int, int] = (26, 22, 8)
    pants: tuple[int, int, int] = (9, 9, 14)
    boots: tuple[int, int, int] = (12, 7, 4)
    outfit: str = "tunic"            # tunic | armor | robe | gi | coat | dress | apron
    gear: str | None = None          # helm | plume_helm | bandana | headband | hood | witch | feather | crown | round_hat
    gear_color: tuple[int, int, int] = (26, 6, 6)
    gear_color2: tuple[int, int, int] = (31, 31, 31)
    beard: tuple[int, int, int] | None = None
    mask: bool = False
    shadow_face: bool = False
    weapon: str | None = None        # sword | dagger | staff | rod | rapier | spear | cane
    weapon_color: tuple[int, int, int] = (22, 22, 26)
    shield: bool = False
    cape: tuple[int, int, int] | None = None
    prop: str | None = None          # chest


class Pal:
    def __init__(self, look: Look) -> None:
        self.skin = look.skin
        self.hair = shade_ramp(*look.hair) if look.hair else None
        self.cloth = shade_ramp(*look.cloth)
        self.trim = shade_ramp(*look.trim)
        self.pants = shade_ramp(*look.pants)
        self.boots = shade_ramp(*look.boots)
        self.gear = shade_ramp(*look.gear_color)
        self.gear2 = shade_ramp(*look.gear_color2)
        self.cape = shade_ramp(*look.cape) if look.cape else None
        self.weapon = shade_ramp(*look.weapon_color)


def new() -> Canvas:
    return Canvas(CELL_W, CELL_H)


def box(cv: Canvas, x0: int, y0: int, x1: int, y1: int, R: list, base: int = BASE) -> None:
    """Lit rectangle: bright top-left edges, shadowed bottom-right edges."""
    cv.rect(x0, y0, x1, y1, R[base])
    if x1 > x0:
        cv.rect(x0, y0, x0, y1, R[base + 1]); cv.rect(x1, y0, x1, y1, R[base - 1])
    cv.rect(x0, y0, x1, y0, R[base + 1]); cv.rect(x0, y1, x1, y1, R[base - 2])
    cv.set(x0, y0, R[min(base + 2, 5)])


# ───────────────────────────── heads ─────────────────────────────

FRONT_SIL = {3: (5, 10), 4: (4, 11), 5: (4, 11), 6: (4, 11), 7: (4, 11), 8: (4, 11),
             9: (4, 11), 10: (4, 11), 11: (5, 10), 12: (6, 9)}


def _hair_front(cv: Canvas, H: list, style: str, skin: list) -> None:
    if style == "bald":
        return
    cv.rect(5, 3, 10, 3, H[BASE]); cv.rect(4, 4, 11, 6, H[BASE])
    cv.rect(6, 3, 7, 3, H[LT]); cv.rect(5, 4, 7, 4, H[LT]); cv.set(6, 4, H[HI]); cv.set(5, 5, H[LT])
    cv.rect(9, 4, 11, 6, H[MD]); cv.set(10, 3, H[MD]); cv.set(11, 6, H[SH1])
    cv.rect(4, 7, 4, 8, H[MD]); cv.rect(11, 7, 11, 8, H[SH1])
    if style in ("short", "long", "bun"):
        cv.rect(7, 6, 8, 6, skin[BASE]); cv.set(6, 6, H[MD]); cv.set(9, 6, H[MD])
        cv.set(6, 7, H[MD]); cv.set(5, 7, H[BASE])
    if style == "spiky":
        for x, y in ((5, 2), (6, 1), (7, 2), (8, 0), (9, 2), (10, 2), (11, 3), (4, 3)):
            cv.set(x, y, H[BASE])
        cv.rect(5, 2, 10, 2, H[BASE]); cv.set(6, 1, H[LT]); cv.set(8, 0, H[LT]); cv.set(8, 1, H[BASE])
        cv.set(10, 2, H[MD]); cv.set(11, 3, H[MD])
        cv.set(6, 6, skin[BASE]); cv.set(7, 6, H[MD]); cv.set(8, 6, skin[BASE]); cv.set(9, 6, H[MD]); cv.set(5, 6, H[BASE])
    if style == "bun":
        cv.rect(7, 1, 8, 2, H[BASE]); cv.set(7, 1, H[LT]); cv.set(8, 2, H[MD])
    if style == "long":
        for y in range(7, 16):
            cv.rect(3, y, 4, y, H[BASE]); cv.rect(11, y, 12, y, H[MD])
            cv.set(3, y, H[LT] if y % 3 else H[BASE]); cv.set(12, y, H[SH1])
        cv.set(4, 15, H[MD]); cv.set(11, 15, H[SH1])


def head_front(look: Look, pal: Pal, back: bool = False) -> Canvas:
    cv = new()
    S = pal.skin
    for y, (a, b) in FRONT_SIL.items():
        cv.rect(a, y, b, y, S[BASE])
        cv.set(a, y, S[LT] if y < 10 else S[BASE]); cv.set(b, y, S[MD]); cv.set(b - 1, y, S[BASE] if b - 1 > a else S[MD])
    cv.rect(6, 12, 9, 12, S[MD])
    cv.rect(6, 13, 9, 13, S[SH1])
    cv.rect(6, 14, 9, 14, S[SH1])
    if back:
        H = pal.hair
        if look.shadow_face:
            D = shade_ramp(6, 6, 14)
            for y, (a, b) in FRONT_SIL.items():
                cv.rect(a, y, b, y, D[BASE]); cv.set(a, y, D[LT]); cv.set(b, y, D[MD])
            cv.rect(5, 11, 10, 12, D[MD])
        if look.hair_style != "hood" and H:
            for y, (a, b) in FRONT_SIL.items():
                if y <= 10:
                    cv.rect(a, y, b, y, H[BASE])
                    cv.set(a, y, H[LT]); cv.set(b, y, H[MD]); cv.set(b - 1, y, H[MD])
            cv.rect(5, 11, 10, 12, H[MD]); cv.rect(6, 12, 9, 12, H[SH1])
            cv.rect(5, 3, 7, 4, H[LT]); cv.set(6, 3, H[HI]); cv.rect(7, 6, 8, 8, H[MD])
            if look.hair_style == "long":
                for y in range(11, 18):
                    cv.rect(4, y, 11, y, H[BASE]); cv.rect(9, y, 11, y, H[MD]); cv.set(4, y, H[LT])
                cv.rect(5, 17, 10, 17, H[SH1])
            if look.hair_style == "spiky":
                for x, y in ((5, 2), (6, 1), (8, 0), (9, 2), (10, 2), (7, 2)):
                    cv.set(x, y, H[BASE])
            if look.hair_style == "bun":
                cv.rect(7, 1, 8, 2, H[BASE])
        return cv
    cv.set(4, 8, S[BASE]); cv.set(4, 9, S[MD]); cv.set(11, 8, S[MD]); cv.set(11, 9, S[SH1])
    if look.shadow_face:
        cv.rect(5, 7, 10, 12, P.c15(2, 2, 5))
        cv.rect(5, 8, 6, 9, P.c15(31, 29, 5)); cv.rect(9, 8, 10, 9, P.c15(31, 29, 5))
        cv.set(5, 8, P.c15(31, 31, 22)); cv.set(9, 8, P.c15(31, 31, 22))
    else:
        brow = pal.hair[SH1] if pal.hair else S[SH1]
        cv.set(5, 7, brow); cv.set(6, 7, brow); cv.set(9, 7, brow); cv.set(10, 7, brow)
        cv.set(5, 8, P.c15(28, 28, 29)); cv.set(6, 8, EYE); cv.set(9, 8, EYE); cv.set(10, 8, P.c15(28, 28, 29))
        cv.set(7, 10, S[MD]); cv.set(8, 10, S[SH1])
        if not look.mask:
            cv.rect(7, 11, 8, 11, P.c15(21, 9, 9)); cv.set(6, 11, S[MD]); cv.set(9, 11, S[MD])
    if look.mask:
        M = shade_ramp(8, 8, 12)
        cv.rect(4, 9, 11, 12, M[MD]); cv.rect(4, 9, 11, 9, M[BASE]); cv.rect(6, 12, 9, 12, M[SH1])
        cv.rect(5, 10, 5, 11, M[LT])
    if look.beard:
        B = shade_ramp(*look.beard)
        cv.rect(4, 10, 11, 11, B[BASE]); cv.rect(5, 12, 10, 14, B[BASE]); cv.rect(6, 15, 9, 16, B[MD])
        cv.rect(4, 10, 5, 12, B[LT]); cv.rect(10, 10, 11, 13, B[MD]); cv.rect(7, 12, 8, 13, B[LT])
        cv.rect(6, 10, 9, 10, B[MD]); cv.set(7, 10, S[MD]); cv.set(8, 10, S[MD])
    if look.hair_style != "bald" and pal.hair:
        _hair_front(cv, pal.hair, look.hair_style, S)
    elif look.hair_style == "bald":
        cv.rect(5, 3, 10, 3, S[BASE]); cv.rect(6, 3, 7, 3, S[HI]); cv.rect(5, 4, 6, 4, S[LT])
        cv.rect(4, 4, 4, 6, S[LT]); cv.rect(9, 3, 10, 5, S[MD])
    return cv


def head_side(look: Look, pal: Pal) -> Canvas:
    """Facing left."""
    cv = new()
    S = pal.skin
    sil = {3: (5, 10), 4: (4, 11), 5: (4, 11), 6: (4, 11), 7: (4, 11), 8: (4, 11), 9: (4, 11),
           10: (4, 10), 11: (4, 9), 12: (5, 8)}
    for y, (a, b) in sil.items():
        cv.rect(a, y, b, y, S[BASE]); cv.set(a, y, S[LT]); cv.set(b, y, S[MD])
    cv.set(3, 9, S[BASE]); cv.set(3, 10, S[MD])
    cv.rect(5, 12, 8, 12, S[MD]); cv.rect(6, 13, 8, 14, S[SH1])
    cv.set(8, 8, S[MD]); cv.set(8, 9, S[SH1])
    if look.shadow_face:
        cv.rect(3, 7, 8, 12, P.c15(2, 2, 5)); cv.rect(4, 8, 5, 9, P.c15(31, 29, 5))
        cv.set(4, 8, P.c15(31, 31, 22))
    else:
        cv.set(5, 8, EYE); cv.set(4, 8, P.c15(28, 28, 29))
        brow = pal.hair[SH1] if pal.hair else S[SH1]
        cv.set(4, 7, brow); cv.set(5, 7, brow)
        if not look.mask:
            cv.set(4, 11, P.c15(21, 9, 9))
    if look.mask:
        M = shade_ramp(8, 8, 12)
        cv.rect(3, 9, 8, 12, M[MD]); cv.rect(3, 9, 8, 9, M[BASE]); cv.rect(4, 10, 4, 11, M[LT])
    if look.beard:
        B = shade_ramp(*look.beard)
        cv.rect(3, 10, 8, 12, B[BASE]); cv.rect(4, 13, 7, 15, B[MD]); cv.rect(3, 10, 4, 11, B[LT])
    if look.hair_style == "bald":
        cv.rect(5, 3, 8, 3, S[LT]); cv.set(6, 3, S[HI])
    elif pal.hair:
        H = pal.hair
        cv.rect(5, 3, 10, 3, H[BASE]); cv.rect(4, 4, 11, 6, H[BASE])
        cv.rect(6, 3, 7, 3, H[LT]); cv.rect(5, 4, 8, 4, H[LT]); cv.set(6, 4, H[HI])
        cv.rect(7, 5, 11, 6, H[MD]); cv.set(4, 6, H[BASE])
        cv.rect(7, 7, 11, 10, H[MD]); cv.rect(10, 7, 11, 10, H[SH1])
        cv.rect(6, 7, 6, 8, H[BASE]); cv.set(7, 7, H[BASE])
        if look.hair_style == "long":
            for y in range(11, 18):
                cv.rect(7, y, 11, y, H[MD]); cv.rect(10, y, 11, y, H[SH1])
        if look.hair_style == "spiky":
            for x, y in ((5, 2), (6, 1), (8, 0), (9, 2), (10, 2), (7, 2), (11, 3)):
                cv.set(x, y, H[BASE])
            cv.set(8, 0, H[LT]); cv.set(6, 1, H[LT])
        if look.hair_style == "bun":
            cv.rect(9, 1, 10, 3, H[BASE]); cv.set(9, 1, H[LT])
    return cv


# ───────────────────────────── headgear ─────────────────────────────

def gear(look: Look, pal: Pal, facing: str) -> Canvas:
    cv = new()
    G, G2, T = pal.gear, pal.gear2, pal.trim
    kind = look.gear
    side = facing == "left"
    if kind in ("helm", "plume_helm"):
        cv.rect(5, 2, 10, 2, G[LT]); cv.rect(4, 3, 11, 7, G[BASE])
        cv.rect(4, 3, 11, 3, G[LT]); cv.rect(5, 3, 7, 3, G[HI]); cv.rect(10, 4, 11, 7, G[MD])
        cv.rect(4, 7, 11, 7, G[SH1]); cv.rect(4, 4, 4, 6, G[LT])
        if facing == "down":
            cv.rect(4, 8, 5, 10, G[BASE]); cv.rect(10, 8, 11, 10, G[MD]); cv.rect(4, 8, 4, 10, G[LT])
            cv.rect(7, 3, 8, 8, G[LT]); cv.rect(7, 4, 7, 7, G[HI]); cv.rect(8, 4, 8, 8, G[BASE])
        elif facing == "up":
            cv.rect(4, 8, 11, 11, G[BASE]); cv.rect(9, 8, 11, 11, G[MD]); cv.rect(4, 11, 11, 11, G[SH1])
            cv.rect(7, 3, 8, 10, G[LT])
        else:
            cv.rect(8, 8, 11, 11, G[MD]); cv.rect(9, 8, 11, 11, G[SH1]); cv.rect(5, 3, 5, 7, G[LT])
        if kind == "plume_helm":
            px = 9 if side else 8
            cv.rect(px, 0, px + 2, 1, G2[BASE]); cv.rect(px - 1, 1, px + 2, 2, G2[BASE])
            cv.set(px, 0, G2[HI]); cv.set(px + 1, 0, G2[LT]); cv.set(px + 2, 1, G2[MD]); cv.set(px + 2, 2, G2[SH1])
            cv.rect(px + 3 if side else px - 2, 3, px + 3 if side else px - 2, 6, G2[MD])
    elif kind == "bandana":
        cv.rect(4, 5, 11, 6, G[BASE]); cv.rect(4, 5, 11, 5, G[LT]); cv.rect(4, 6, 11, 6, G[MD])
        cv.set(5, 5, G[HI]); cv.rect(10, 5, 11, 6, G[MD])
        cv.rect(11, 6, 13, 7, G[BASE]); cv.rect(12, 7, 13, 10, G[MD]); cv.set(13, 10, G[SH1]); cv.set(12, 11, G[SH1])
    elif kind == "headband":
        cv.rect(4, 5, 11, 5, G[BASE]); cv.rect(4, 5, 6, 5, G[LT]); cv.rect(4, 6, 11, 6, G[MD])
        cv.rect(11, 6, 13, 7, G[BASE]); cv.rect(12, 8, 13, 11, G[MD]); cv.set(13, 11, G[SH1]); cv.set(12, 12, G[SH1])
    elif kind == "hood":
        shape = {2: (5, 10), 3: (4, 11), 4: (3, 12), 5: (3, 12)}
        for y in range(6, 13):
            shape[y] = (3, 12)
        for y in (13, 14, 15):
            shape[y] = (2, 13)
        for y, (a, b) in shape.items():
            cv.rect(a, y, b, y, G[BASE]); cv.set(a, y, G[LT]); cv.set(b, y, G[MD]); cv.set(b - 1, y, G[MD])
        cv.rect(5, 2, 8, 2, G[HI]); cv.rect(4, 3, 6, 3, G[LT]); cv.rect(4, 4, 4, 6, G[LT])
        for y in range(13, 16):
            cv.rect(3, y, 12, y, G[BASE]); cv.rect(10, y, 13, y, G[MD]); cv.set(2, y, G[LT])
        cv.rect(2, 15, 13, 15, G[SH1])
        if facing == "down":
            cv.rect(5, 6, 10, 12, None)
            cv.rect(5, 6, 10, 6, G[SH2]); cv.rect(5, 7, 5, 12, G[SH1]); cv.rect(10, 7, 10, 12, G[SH1])
            cv.rect(6, 6, 9, 6, T[BASE]); cv.rect(5, 6, 5, 6, T[MD]); cv.rect(10, 6, 10, 6, T[MD])
            cv.rect(2, 14, 13, 14, T[BASE]); cv.rect(2, 14, 3, 14, T[LT])
        elif facing == "left":
            cv.rect(3, 6, 7, 12, None); cv.rect(7, 6, 7, 12, G[SH1]); cv.rect(3, 6, 8, 6, G[SH2])
            cv.rect(3, 14, 13, 14, T[BASE])
        else:
            cv.rect(2, 14, 13, 14, T[BASE])
    elif kind == "witch":
        cv.rect(1, 5, 14, 6, G[BASE]); cv.rect(1, 5, 14, 5, G[LT]); cv.rect(2, 6, 13, 6, G[MD]); cv.rect(10, 5, 14, 6, G[MD])
        cv.rect(1, 5, 2, 5, G[HI]); cv.set(1, 6, G[LT]); cv.set(14, 6, G[SH1])
        if facing != "left":
            cv.rect(3, 7, 12, 7, G[SH2])
        for y, (a, b) in {0: (8, 9), 1: (7, 9), 2: (6, 9), 3: (5, 10), 4: (5, 10)}.items():
            cv.rect(a, y, b, y, G[BASE]); cv.set(a, y, G[LT]); cv.set(b, y, G[MD])
        cv.set(9, 0, G[MD]); cv.set(8, 0, G[LT])
        cv.rect(5, 4, 10, 4, T[BASE]); cv.rect(5, 4, 6, 4, T[LT]); cv.rect(9, 4, 10, 4, T[MD])
    elif kind == "feather":
        cv.rect(2, 5, 13, 6, G[BASE]); cv.rect(2, 5, 13, 5, G[LT]); cv.rect(3, 6, 12, 6, G[MD]); cv.rect(10, 5, 13, 6, G[MD])
        cv.rect(2, 5, 3, 5, G[HI]); cv.rect(5, 2, 10, 4, G[BASE]); cv.rect(5, 2, 10, 2, G[LT]); cv.rect(5, 2, 6, 2, G[HI])
        cv.rect(9, 3, 10, 4, G[MD]); cv.rect(5, 4, 10, 4, T[BASE]); cv.rect(5, 4, 6, 4, T[LT])
        fx = 4 if side else 10
        d = -1 if side else 1
        for i, (dx, dy) in enumerate(((0, 0), (1, -1), (2, -2), (3, -2), (3, -3), (4, -3))):
            cv.set(fx + dx * d, 2 + dy, G2[HI if i % 2 == 0 else LT]); cv.set(fx + dx * d, 3 + dy, G2[BASE])
            if i < 3:
                cv.set(fx + dx * d, 4 + dy, G2[MD])
    elif kind == "crown":
        cv.rect(4, 2, 11, 4, GOLD[BASE]); cv.rect(4, 2, 11, 2, GOLD[LT]); cv.rect(4, 4, 11, 4, GOLD[MD])
        for x in (4, 7, 8, 11):
            cv.set(x, 1, GOLD[HI])
        cv.set(7, 3, P.c15(28, 4, 8)); cv.set(8, 3, P.c15(28, 4, 8)); cv.set(5, 3, P.c15(6, 12, 28)); cv.set(10, 3, P.c15(6, 12, 28))
    elif kind == "round_hat":
        cv.rect(5, 2, 10, 2, G[LT]); cv.rect(4, 3, 11, 5, G[BASE]); cv.rect(4, 3, 7, 3, G[LT]); cv.set(5, 3, G[HI])
        cv.rect(10, 3, 11, 5, G[MD]); cv.rect(3, 5, 12, 6, G[MD]); cv.rect(3, 5, 12, 5, G[BASE]); cv.rect(3, 6, 12, 6, G[SH1])
        cv.rect(4, 4, 11, 4, T[BASE]); cv.rect(4, 4, 6, 4, T[LT])
    return cv


# ───────────────────────────── torso, arms, legs (front/back) ─────────────────────────────

def torso_front(look: Look, pal: Pal, back: bool = False) -> Canvas:
    cv = new()
    C, T, S = pal.cloth, pal.trim, pal.skin
    o = look.outfit
    if o == "gi":
        if back:
            box(cv, 4, 14, 11, 21, C)
            cv.rect(3, 14, 12, 14, C[LT])
        else:
            cv.rect(4, 14, 11, 21, S[BASE])
            cv.rect(5, 15, 7, 17, S[LT]); cv.rect(8, 15, 10, 17, S[BASE]); cv.rect(7, 15, 8, 18, S[MD])
            cv.rect(5, 18, 10, 18, S[MD]); cv.rect(6, 19, 9, 19, S[MD]); cv.rect(10, 15, 11, 18, S[MD])
            for i in range(5):
                cv.set(4 + i, 14 + i, C[BASE]); cv.set(11 - i, 14 + i, C[MD])
                if i < 4:
                    cv.set(5 + i, 14 + i, C[LT])
            cv.rect(4, 14, 4, 21, C[LT]); cv.rect(11, 14, 11, 21, C[MD])
        cv.rect(4, 19, 11, 20, T[BASE]); cv.rect(4, 19, 11, 19, T[LT]); cv.rect(4, 20, 11, 20, T[MD])
        cv.rect(8, 20, 9, 21, T[BASE]); cv.rect(8, 21, 9, 21, T[MD])
        return cv
    box(cv, 4, 14, 11, 21, C)
    cv.rect(3, 14, 12, 14, C[LT]); cv.set(3, 14, C[BASE]); cv.set(12, 14, C[MD])
    if o == "armor":
        cv.rect(2, 14, 4, 16, T[BASE]); cv.rect(11, 14, 13, 16, T[MD])
        cv.rect(2, 14, 4, 14, T[HI]); cv.rect(2, 14, 2, 16, T[LT]); cv.rect(11, 14, 13, 14, T[LT]); cv.rect(13, 15, 13, 16, T[SH1])
        cv.rect(3, 16, 4, 16, T[MD]); cv.rect(11, 16, 12, 16, T[SH1])
        if not back:
            cv.rect(5, 15, 10, 19, C[LT]); cv.rect(5, 15, 7, 17, C[HI]); cv.rect(8, 15, 10, 19, C[BASE])
            cv.rect(7, 15, 8, 19, C[BASE]); cv.rect(7, 15, 7, 18, C[LT]); cv.rect(5, 19, 10, 19, C[MD])
            cv.rect(10, 15, 10, 19, C[MD]); cv.set(7, 16, T[HI]); cv.set(8, 16, T[BASE]); cv.set(7, 17, T[BASE]); cv.set(8, 17, T[MD])
            cv.rect(6, 14, 9, 14, S[MD])
        else:
            cv.rect(5, 15, 10, 19, C[BASE]); cv.rect(5, 15, 7, 16, C[LT]); cv.rect(9, 17, 10, 19, C[MD])
        cv.rect(4, 20, 11, 21, T[MD]); cv.rect(4, 20, 11, 20, T[LT]); cv.rect(7, 20, 8, 21, T[HI]); cv.rect(4, 21, 11, 21, T[SH1])
        return cv
    if o in ("robe", "dress"):
        if not back:
            if o == "robe":
                cv.rect(7, 14, 8, 21, T[BASE]); cv.rect(7, 14, 7, 21, T[LT]); cv.rect(8, 14, 8, 21, T[MD])
            cv.rect(6, 14, 9, 14, S[MD]); cv.set(7, 14, S[BASE])
            if o == "dress":
                cv.rect(4, 19, 11, 19, T[BASE]); cv.rect(4, 19, 6, 19, T[LT])
        else:
            cv.rect(4, 19, 11, 19, T[MD])
            cv.rect(6, 15, 6, 18, C[MD]); cv.rect(9, 16, 9, 18, C[MD]); cv.rect(7, 14, 8, 14, C[LT])
        cv.rect(5, 16, 5, 18, C[MD]); cv.rect(10, 17, 10, 18, C[SH1])
        return cv
    if o == "coat":
        if not back:
            cv.rect(7, 15, 8, 21, T[BASE]); cv.rect(7, 15, 7, 21, T[LT]); cv.rect(8, 16, 8, 21, T[MD])
            for y in (16, 18):
                cv.set(6, y, GOLD[HI]); cv.set(9, y, GOLD[BASE])
            cv.rect(4, 14, 6, 15, C[HI]); cv.rect(9, 14, 11, 15, C[MD]); cv.rect(6, 14, 9, 14, S[MD])
            cv.rect(4, 14, 4, 15, T[BASE]); cv.rect(11, 14, 11, 15, T[MD])
        cv.rect(4, 19, 11, 20, T[MD]); cv.rect(4, 19, 11, 19, T[BASE]); cv.rect(7, 19, 8, 20, GOLD[BASE])
        cv.rect(5, 16, 5, 18, C[MD]); cv.rect(10, 17, 10, 18, C[SH1])
        return cv
    if o == "apron":
        if not back:
            A = shade_ramp(28, 28, 26)
            box(cv, 5, 16, 10, 21, A); cv.rect(6, 15, 9, 15, A[LT])
            cv.rect(5, 14, 5, 15, T[BASE]); cv.rect(10, 14, 10, 15, T[BASE])
            cv.rect(5, 18, 10, 18, A[MD])
        cv.rect(4, 20, 11, 20, T[MD])
        return cv
    # tunic
    if not back:
        cv.rect(6, 14, 9, 14, S[MD]); cv.rect(7, 14, 8, 14, S[BASE]); cv.rect(7, 15, 8, 15, S[MD])
        cv.set(6, 15, T[BASE]); cv.set(9, 15, T[MD]); cv.set(5, 14, T[LT]); cv.set(10, 14, T[MD])
        cv.rect(6, 16, 6, 18, C[MD]); cv.rect(9, 17, 9, 18, C[SH1]); cv.set(5, 17, C[LT])
    else:
        cv.rect(6, 15, 6, 18, C[MD]); cv.rect(9, 16, 9, 18, C[SH1])
    cv.rect(4, 19, 11, 20, T[MD]); cv.rect(4, 19, 11, 19, T[BASE]); cv.rect(4, 19, 6, 19, T[LT])
    cv.rect(7, 19, 8, 20, T[HI]); cv.set(7, 20, T[BASE]); cv.rect(4, 21, 11, 21, C[SH1])
    return cv


def torso_side(look: Look, pal: Pal) -> Canvas:
    cv = new()
    C, T, S = pal.cloth, pal.trim, pal.skin
    o = look.outfit
    if o == "gi":
        cv.rect(5, 14, 10, 21, S[BASE]); cv.rect(5, 14, 5, 21, C[LT]); cv.rect(5, 15, 7, 17, S[LT]); cv.rect(10, 14, 10, 21, S[MD])
        cv.rect(5, 19, 10, 20, T[BASE]); cv.rect(5, 19, 10, 19, T[LT]); cv.rect(5, 20, 10, 20, T[MD])
        return cv
    box(cv, 5, 14, 10, 21, C)
    cv.rect(4, 14, 10, 14, C[LT])
    if o == "armor":
        cv.rect(4, 14, 7, 16, T[BASE]); cv.rect(4, 14, 7, 14, T[HI]); cv.rect(4, 15, 4, 16, T[LT]); cv.rect(5, 16, 7, 16, T[MD])
        cv.rect(5, 17, 6, 19, C[LT]); cv.set(5, 17, C[HI])
        cv.rect(5, 20, 10, 21, T[MD]); cv.rect(5, 20, 10, 20, T[LT]); cv.rect(5, 21, 10, 21, T[SH1])
        return cv
    if o in ("robe", "dress", "coat"):
        cv.rect(5, 15 if o == "coat" else 14, 5, 21, T[BASE])
        cv.rect(5, 19, 10, 19, T[BASE]); cv.rect(6, 19, 7, 19, T[LT])
        cv.rect(8, 16, 8, 18, C[MD]); cv.rect(6, 15, 6, 17, C[LT])
        return cv
    if o == "apron":
        box(cv, 5, 16, 7, 21, shade_ramp(28, 28, 26)); cv.rect(5, 20, 10, 20, T[MD])
        return cv
    cv.rect(5, 19, 10, 20, T[MD]); cv.rect(5, 19, 10, 19, T[BASE]); cv.rect(5, 19, 6, 19, T[LT])
    cv.rect(8, 16, 8, 18, C[MD]); cv.rect(6, 15, 6, 17, C[LT]); cv.set(5, 14, S[BASE]); cv.rect(5, 21, 10, 21, C[SH1])
    return cv


def arm_front(look: Look, pal: Pal, left: bool, sw: int) -> Canvas:
    """sw > 0 swings the hand down/forward, < 0 up/back."""
    cv = new()
    C, T, S = pal.cloth, pal.trim, pal.skin
    x0 = 2 if left else 12
    wide = look.outfit in ("robe", "dress", "coat")
    bare = look.outfit == "gi"
    R = S if bare else C
    top, sleeve_end = 15, 19 + sw
    xs = (x0 - (1 if wide and left else 0), x0 + 1 + (1 if wide and not left else 0))
    cv.rect(xs[0], top, xs[1], sleeve_end, R[BASE])
    cv.rect(xs[0], top, xs[0], sleeve_end, R[LT]); cv.rect(xs[1], top, xs[1], sleeve_end, R[MD])
    inner = xs[1] if left else xs[0]
    cv.rect(inner, top, inner, sleeve_end, R[SH1])
    if bare:
        cv.rect(xs[0], top + 1, xs[1], top + 2, S[LT] if left else S[BASE])
        cv.rect(xs[0], sleeve_end - 1, xs[1], sleeve_end, T[BASE])
    if look.outfit == "armor":
        cv.rect(xs[0], top + 3, xs[1], sleeve_end, T[BASE]); cv.rect(xs[0], top + 3, xs[0], sleeve_end, T[LT]); cv.rect(inner, top + 3, inner, sleeve_end, T[MD])
        cv.rect(xs[0], sleeve_end, xs[1], sleeve_end, T[SH1])
    if wide:
        cv.rect(xs[0], sleeve_end, xs[1], sleeve_end, T[BASE]); cv.rect(xs[0], sleeve_end, xs[0], sleeve_end, T[LT])
    hy = sleeve_end + 1
    hx = (x0, x0 + 1)
    cv.rect(hx[0], hy, hx[1], hy + 1, S[BASE]); cv.set(hx[0], hy, S[LT]); cv.set(hx[1], hy + 1, S[MD])
    cv.set(hx[1] if left else hx[0], hy, S[MD])
    return cv


def arm_side(look: Look, pal: Pal, dx: int, length: int = 5) -> Canvas:
    cv = new()
    C, T, S = pal.cloth, pal.trim, pal.skin
    bare = look.outfit == "gi"
    R = S if bare else C
    x0 = 6 + dx
    end = 15 + length
    cv.rect(x0, 15, x0 + 2, end, R[BASE]); cv.rect(x0, 15, x0, end, R[LT]); cv.rect(x0 + 2, 15, x0 + 2, end, R[MD])
    cv.rect(x0 + 2, 16, x0 + 2, end, R[SH1])
    if look.outfit == "armor":
        cv.rect(x0 - 1, 14, x0 + 3, 16, T[BASE]); cv.rect(x0 - 1, 14, x0 + 3, 14, T[HI]); cv.rect(x0 + 3, 15, x0 + 3, 16, T[MD])
        cv.rect(x0, end - 2, x0 + 2, end, T[BASE]); cv.rect(x0 + 2, end - 2, x0 + 2, end, T[MD])
    if bare:
        cv.rect(x0, end - 1, x0 + 2, end, T[BASE])
    if look.outfit in ("robe", "dress", "coat"):
        cv.rect(x0 - 1, end - 1, x0 + 3, end, T[BASE])
    cv.rect(x0, end + 1, x0 + 1, end + 2, S[BASE]); cv.set(x0, end + 1, S[LT]); cv.set(x0 + 1, end + 2, S[MD])
    return cv


def legs_front(look: Look, pal: Pal, frame: int) -> Canvas:
    cv = new()
    B, P_ = pal.boots, pal.pants
    if look.outfit in ("robe", "dress", "apron"):
        base = pal.cloth if look.outfit != "apron" else shade_ramp(*look.pants)
        sway = {0: 0, 1: 1, 2: -1}[frame]
        for y in range(21, 29):
            g = (y - 21) // 3
            a, b = 4 - g + (sway if y > 25 else 0), 11 + g + (sway if y > 25 else 0)
            cv.rect(a, y, b, y, base[BASE]); cv.set(a, y, base[LT]); cv.set(b, y, base[MD]); cv.set(b - 1, y, base[MD])
            if y > 22:
                cv.set(a + 2, y, base[MD])
                if y > 23:
                    cv.set(b - 3, y, base[SH1])
                if y % 2:
                    cv.set(7 + (sway if y > 25 else 0), y, base[LT])
        e = pal.trim if look.outfit == "robe" else base
        cv.rect(2 + sway, 28, 13 + sway, 28, e[BASE]); cv.rect(2 + sway, 28, 5 + sway, 28, e[LT]); cv.rect(10 + sway, 28, 13 + sway, 28, e[MD])
        for fx, hide in ((4, frame == 2), (9, frame == 1)):
            if not hide:
                cv.rect(fx, 29, fx + 2, 30, B[BASE]); cv.rect(fx, 29, fx, 30, B[LT]); cv.rect(fx + 2, 29, fx + 2, 30, B[MD])
                cv.rect(fx, 30, fx + 2, 30, B[SH1])
        return cv
    lifted = {0: None, 1: "r", 2: "l"}[frame]
    for side, (px0, px1, bx0, bx1) in {"l": (5, 7, 4, 7), "r": (8, 10, 8, 11)}.items():
        lift = 1 if lifted == side else 0
        shift = (1 if side == "l" else -1) * lift
        cv.rect(px0, 21, px1, 27 - lift, P_[BASE])
        cv.rect(px0, 21, px0, 27 - lift, P_[LT]); cv.rect(px1, 21, px1, 27 - lift, P_[MD])
        cv.rect(px0 + 1, 24 - lift, px1 - 1, 24 - lift, P_[MD])
        cv.rect(bx0 + shift, 27 - lift, bx1 + shift, 30 - lift, B[BASE])
        cv.rect(bx0 + shift, 27 - lift, bx1 + shift, 27 - lift, B[HI] if side == "l" else B[LT])
        cv.rect(bx0 + shift, 27 - lift, bx0 + shift, 30 - lift, B[LT]); cv.rect(bx1 + shift, 28 - lift, bx1 + shift, 30 - lift, B[MD])
        cv.rect(bx0 + shift, 30 - lift, bx1 + shift, 30 - lift, B[SH1])
    if look.outfit == "coat":
        C = pal.cloth
        for y in range(21, 27):
            cv.rect(4, y, 11, y, C[BASE]); cv.set(4, y, C[LT]); cv.set(11, y, C[MD]); cv.set(10, y, C[MD])
            cv.set(7, y, C[SH1]); cv.set(8, y, C[MD])
        cv.rect(4, 26, 11, 26, pal.trim[BASE]); cv.rect(4, 26, 6, 26, pal.trim[LT]); cv.rect(7, 26, 8, 26, C[SH2])
    return cv


def legs_side(look: Look, pal: Pal, frame: int) -> Canvas:
    cv = new()
    B, P_ = pal.boots, pal.pants
    if look.outfit in ("robe", "dress", "apron"):
        base = pal.cloth if look.outfit != "apron" else shade_ramp(*look.pants)
        sway = {0: 0, 1: -1, 2: 1}[frame]
        for y in range(21, 29):
            g = (y - 21) // 3
            a, b = 5 - g + (sway if y > 25 else 0), 10 + g + (sway if y > 25 else 0)
            cv.rect(a, y, b, y, base[BASE]); cv.set(a, y, base[LT]); cv.set(b, y, base[MD]); cv.set(b - 1, y, base[MD])
            if y > 22:
                cv.set(a + 3, y, base[MD])
        e = pal.trim if look.outfit == "robe" else base
        cv.rect(3 + sway, 28, 12 + sway, 28, e[BASE]); cv.rect(3 + sway, 28, 6 + sway, 28, e[LT]); cv.rect(9 + sway, 28, 12 + sway, 28, e[MD])
        cv.rect(4 + sway, 29, 7 + sway, 30, B[BASE]); cv.rect(4 + sway, 29, 7 + sway, 29, B[LT]); cv.rect(4 + sway, 30, 7 + sway, 30, B[SH1])
        return cv
    off = {0: (0, 0), 1: (-2, 2), 2: (2, -2)}[frame]
    for sh, (x0, x1), o in ((1, (7, 9), off[1]), (3, (6, 8), off[0])):
        a, b = x0 + o, x1 + o
        cv.rect(a, 21, b, 27, P_[sh]); cv.rect(a, 21, a, 27, P_[min(sh + 1, 5)]); cv.rect(b, 21, b, 27, P_[sh - 1])
        cv.rect(a, 24, b, 24, P_[sh - 1])
        cv.rect(a - 1, 27, b, 30, B[sh]); cv.rect(a - 1, 27, b, 27, B[min(sh + 1, 5)]); cv.rect(a - 1, 28, a - 1, 30, B[min(sh + 1, 5)])
        cv.rect(a - 1, 30, b, 30, B[max(sh - 2, 0)])
    return cv


# ───────────────────────────── weapons ─────────────────────────────

def weapon_canvas(look: Look, pal: Pal, hand: tuple[int, int], vec: tuple[int, int]) -> Canvas:
    cv = new()
    W = pal.weapon
    kind = look.weapon
    if kind is None:
        return cv
    wood = shade_ramp(15, 9, 5)
    hx, hy = hand
    tx, ty = hx + vec[0], hy + vec[1]
    if kind in ("sword", "rapier"):
        blade = STEEL if kind == "sword" else shade_ramp(24, 24, 28)
        cv.line(hx, hy, tx, ty, blade[BASE]); cv.line(hx + 1, hy, tx + 1, ty, blade[LT])
        if kind == "sword":
            cv.line(hx - 1, hy, tx - 1, ty, blade[MD])
        cv.set(tx, ty, blade[HI]); cv.set(tx + 1, ty, blade[HI])
        cv.rect(hx - 2, hy, hx + 2, hy, GOLD[BASE]); cv.set(hx - 2, hy, GOLD[HI]); cv.set(hx + 2, hy, GOLD[MD])
        cv.rect(hx, hy + 1, hx, hy + 2, wood[BASE]); cv.set(hx, hy + 3, GOLD[BASE])
    elif kind == "dagger":
        cv.line(hx, hy, hx + vec[0] // 2, hy + vec[1] // 2, STEEL[LT]); cv.line(hx + 1, hy, hx + 1 + vec[0] // 2, hy + vec[1] // 2, STEEL[BASE])
        cv.rect(hx - 1, hy, hx + 2, hy, GOLD[BASE]); cv.set(hx, hy + 1, wood[BASE])
    elif kind in ("staff", "rod", "cane"):
        bx, by = hx - vec[0] // 3, hy - vec[1] // 3
        cv.line(bx, by, tx, ty, wood[BASE]); cv.line(bx + 1, by, tx + 1, ty, wood[MD])
        if kind != "cane":
            cv.disc(tx, ty - 1, 2.0, W[BASE]); cv.disc(tx, ty - 1, 1.4, W[LT]); cv.set(tx - 1, ty - 2, W[HI])
            cv.rect(tx - 1, ty + 1, tx + 1, ty + 1, GOLD[BASE])
        else:
            cv.rect(tx - 1, ty, tx + 1, ty, wood[LT])
    elif kind == "spear":
        cv.line(hx, hy + 5, tx, ty, wood[BASE]); cv.line(hx + 1, hy + 5, tx + 1, ty, wood[MD])
        cv.poly([(tx - 1.8, ty + 3), (tx + 2.8, ty + 3), (tx + 0.5, ty - 3)], STEEL[LT])
        cv.line(tx + 1, ty - 2, tx + 1, ty + 2, STEEL[HI])
    return cv


def shield_canvas(look: Look, pal: Pal) -> Canvas:
    cv = new()
    T = pal.trim
    cv.ellipse(5.5, 19.5, 3.4, 4.8, STEEL[MD]); cv.ellipse(5.5, 19.5, 2.6, 4.0, T[BASE])
    cv.rect(5, 16, 6, 23, T[LT]); cv.rect(3, 19, 8, 20, T[LT]); cv.set(5, 19, T[HI])
    return cv


# ───────────────────────────── composition ─────────────────────────────

def _finish(cv: Canvas) -> Canvas:
    cv.sel_outline(ground=GROUND)
    return cv


def compose_front(look: Look, pal: Pal, frame: int, back: bool) -> Canvas:
    cv = new()
    bob = -1 if frame else 0
    swing = {0: (0, 0), 1: (-1, 1), 2: (1, -1)}[frame]
    cv.paste(legs_front(look, pal, frame), 0, 0)
    if back and pal.cape:
        c = pal.cape
        for y in range(14 + bob, 29):
            cv.rect(3, y, 12, y, c[BASE]); cv.set(3, y, c[LT]); cv.set(12, y, c[MD]); cv.set(11, y, c[MD])
            if y > 17:
                cv.set(7 + (y % 2), y, c[MD])
        cv.rect(3, 28, 12, 28, c[SH1])
    cv.paste(arm_front(look, pal, True, swing[0]), 0, bob)
    cv.paste(arm_front(look, pal, False, swing[1]), 0, bob)
    cv.paste(torso_front(look, pal, back), 0, bob)
    cv.paste(head_front(look, pal, back), 0, bob)
    if look.gear:
        cv.paste(gear(look, pal, "up" if back else "down"), 0, bob)
    return _finish(cv)


def compose_side(look: Look, pal: Pal, frame: int, pose: str | None = None) -> Canvas:
    """Facing left."""
    cv = new()
    bob = -1 if frame else 0
    arm_dx = {0: 0, 1: -2, 2: 2}[frame]
    ox = 0
    arm_len = 5
    wp = None
    if pose == "ready":
        arm_dx, wp = -1, "ready"
    elif pose == "attack":
        arm_dx, wp, ox, arm_len = -3, "swing", 3, 3
    elif pose == "cast":
        arm_dx, wp, arm_len = -1, "raised", 3
    elif pose == "hurt":
        ox, bob = 2, 0
    elif pose == "victory":
        wp, arm_len = "raised", 3
    if pose == "down":
        return compose_kneel(look, pal)
    cv.paste(legs_side(look, pal, 0 if pose else frame), ox // 2, 0)
    if pal.cape:
        c = pal.cape
        for y in range(14 + bob, 28):
            cv.rect(9, y, 13, y, c[MD]); cv.rect(10, y, 12, y, c[BASE]); cv.set(13, y, c[SH1])
    cv.paste(torso_side(look, pal), ox, bob)
    cv.paste(head_side(look, pal), ox + (1 if pose == "hurt" else 0), bob)
    if look.gear:
        cv.paste(gear(look, pal, "left"), ox + (1 if pose == "hurt" else 0), bob)
    if look.shield and pose in (None, "ready", "attack", "hurt"):
        cv.paste(shield_canvas(look, pal), ox + 1, bob)
    if pose in ("cast", "victory"):
        arm = new()
        R = pal.skin if look.outfit == "gi" else pal.cloth
        arm.rect(3, 10, 5, 18, R[BASE]); arm.rect(3, 10, 3, 18, R[LT]); arm.rect(5, 10, 5, 18, R[MD])
        arm.rect(3, 7, 4, 9, pal.skin[BASE]); arm.set(3, 7, pal.skin[LT]); arm.set(4, 9, pal.skin[MD])
        cv.paste(arm, ox, bob)
    else:
        cv.paste(arm_side(look, pal, arm_dx, arm_len), ox, bob)
    if wp and look.weapon:
        if wp == "ready":
            wc = weapon_canvas(look, pal, (6 + arm_dx, 21), (-2, -10))
        elif wp == "swing":
            wc = weapon_canvas(look, pal, (6 + arm_dx, 19), (-6, -2))
        else:
            wc = weapon_canvas(look, pal, (4, 8), (0, -7))
        cv.paste(wc, ox, bob)
    if pose == "hurt":
        cv.rect(4, 8, 5, 8, EYE)
    return _finish(cv)


def compose_kneel(look: Look, pal: Pal) -> Canvas:
    cv = new()
    C = pal.cloth
    robe = look.outfit in ("robe", "dress", "coat")
    leg = C if robe else pal.pants
    cv.rect(2, 27, 13, 30, leg[BASE]); cv.rect(2, 27, 13, 27, leg[LT]); cv.rect(2, 30, 13, 30, leg[SH1]); cv.rect(11, 28, 13, 30, leg[MD])
    cv.rect(2, 29, 4, 30, pal.boots[BASE]); cv.rect(2, 29, 4, 29, pal.boots[LT])
    cv.rect(5, 19, 11, 26, C[BASE]); cv.rect(5, 19, 5, 26, C[LT]); cv.rect(10, 19, 11, 26, C[MD]); cv.rect(5, 19, 11, 19, C[LT])
    cv.rect(5, 22, 11, 22, pal.trim[MD])
    cv.paste(head_side(look, pal), -1, 9)
    if look.gear:
        cv.paste(gear(look, pal, "left"), -1, 9)
    cv.rect(2, 24, 6, 25, pal.skin[BASE]); cv.rect(2, 23, 3, 24, pal.skin[LT])
    return _finish(cv)


# ───────────────────────────── sheet assembly ─────────────────────────────

def build_block(look: Look) -> Image.Image:
    block = Image.new("RGBA", (CELL_W * BLOCK_COLS, CELL_H * BLOCK_ROWS), (0, 0, 0, 0))
    if look.prop == "chest":
        for col, open_ in enumerate((False, True)):
            block.paste(chest_cell(open_).img, (col * CELL_W, 0))
        return block
    if look.prop == "broom":                             # pass PT: Matoya's broom (1x), a hop in frame 1
        for row in range(4):
            for col in range(3):
                block.paste(broom_cell(col == 1).img, (col * CELL_W, row * CELL_H))
        return block
    pal = Pal(look)

    def put(canvas: Canvas, col: int, row: int) -> None:
        block.paste(canvas.img, (col * CELL_W, row * CELL_H))

    for frame in range(3):
        put(compose_front(look, pal, frame, back=False), frame, 0)
        put(compose_front(look, pal, frame, back=True), frame, 1)
        left = compose_side(look, pal, frame)
        put(left, frame, 2)
        put(left.mirrored(), frame, 3)
    for col, pose in enumerate(("ready", "attack", "cast", "hurt", "down", "victory")):
        put(compose_side(look, pal, 0, pose), col, 4)
    return block


def broom_cell(hop: bool) -> Canvas:
    """A besom broom standing on its bristles (pass PT's 1x Look of the `broom` field sheet); `hop` lifts it 2 px."""
    cv = new()
    wood, straw = shade_ramp(18, 11, 5), shade_ramp(28, 21, 8)
    dy = -2 if hop else 0
    cv.rect(7, 12 + dy, 8, 23 + dy, wood[BASE]); cv.rect(7, 12 + dy, 7, 23 + dy, wood[LT])
    box(cv, 4, 24 + dy, 11, 30 + dy, straw)
    cv.rect(5, 25 + dy, 10, 25 + dy, shade_ramp(22, 5, 5)[BASE])
    return _finish(cv)


def chest_cell(open_: bool) -> Canvas:
    cv = new()
    wood, band = shade_ramp(18, 10, 5), GOLD
    box(cv, 2, 22, 13, 30, wood)
    for x in (5, 10):
        cv.rect(x, 22, x, 30, wood[MD])
    cv.rect(2, 26, 13, 26, band[BASE]); cv.rect(2, 26, 5, 26, band[LT]); cv.rect(7, 25, 8, 28, band[LT]); cv.set(7, 26, band[HI]); cv.set(8, 28, band[MD])
    cv.rect(2, 22, 2, 30, band[BASE]); cv.rect(13, 22, 13, 30, band[MD])
    if open_:
        cv.rect(2, 15, 13, 21, wood[MD]); cv.rect(3, 16, 12, 20, P.c15(3, 2, 4))
        cv.rect(2, 15, 13, 15, wood[LT])
        cv.rect(4, 22, 11, 23, P.c15(31, 28, 10)); cv.set(5, 22, WHITE); cv.set(9, 23, WHITE); cv.set(7, 22, P.c15(31, 31, 24))
    else:
        box(cv, 2, 16, 13, 21, wood)
        cv.rect(2, 19, 13, 19, band[BASE]); cv.rect(7, 18, 8, 20, band[LT]); cv.set(7, 19, band[HI])
        cv.rect(2, 16, 2, 21, band[BASE]); cv.rect(13, 16, 13, 21, band[MD])
    return _finish(cv)


# ───────────────────────────── roster ─────────────────────────────

ROSTER: dict[str, Look] = {
    # Base classes
    "warrior": Look(hair=(15, 8, 4), hair_style="spiky", outfit="armor", cloth=(24, 5, 6), trim=(19, 21, 26),
                    pants=(8, 8, 12), boots=(11, 6, 4), weapon="sword", shield=True),
    "thief": Look(hair=(26, 21, 8), hair_style="short", outfit="tunic", cloth=(6, 17, 11), trim=(15, 9, 4),
                  pants=(10, 9, 6), boots=(12, 7, 4), gear="bandana", gear_color=(25, 5, 8), weapon="dagger"),
    "monk": Look(skin=SKIN_TAN, hair=(4, 3, 4), hair_style="short", outfit="gi", cloth=(28, 15, 3), trim=(31, 28, 22),
                 pants=(26, 13, 3), boots=(14, 9, 5), gear="headband", gear_color=(31, 31, 29)),
    "white_mage": Look(hair=(14, 8, 4), hair_style="short", outfit="robe", cloth=(29, 29, 30), trim=(26, 5, 7),
                       gear="hood", gear_color=(29, 29, 30), boots=(14, 9, 5), weapon="staff", weapon_color=(30, 26, 8)),
    "black_mage": Look(outfit="robe", cloth=(6, 6, 17), trim=(27, 22, 6), shadow_face=True, hair=None, hair_style="bald",
                       gear="witch", gear_color=(7, 7, 20), boots=(12, 7, 4), weapon="rod", weapon_color=(30, 26, 8)),
    "red_mage": Look(hair=(28, 24, 8), hair_style="short", outfit="coat", cloth=(24, 5, 8), trim=(30, 30, 28),
                     pants=(30, 30, 28), boots=(12, 7, 4), gear="feather", gear_color=(25, 5, 8), gear_color2=(31, 31, 31),
                     weapon="rapier"),
    # pass CB (docs/CLASS_BARBARIAN_PLAN.md 6): 1x legacy looks of the user-rendered class pair (fur-brown tunic, the
    # plain helm (no horned 1x gear exists), a sword as the nearest 1x weapon; the berserker bearded)
    "barbarian": Look(hair=(22, 11, 4), hair_style="spiky", outfit="tunic", cloth=(14, 9, 5), trim=(20, 20, 23),
                      pants=(12, 8, 5), boots=(9, 7, 6), gear="helm", gear_color=(20, 20, 23), weapon="sword"),
    # pass CB (plan 11): the legionnaire in red tunic and steel (plain helm, sword and shield); the centurion with the
    # plume helm (the crest) and a red cape
    "legionnaire": Look(hair=(15, 9, 4), hair_style="short", outfit="armor", cloth=(24, 5, 5), trim=(22, 22, 25),
                        pants=(22, 5, 5), boots=(14, 9, 5), gear="helm", gear_color=(22, 22, 25), weapon="sword",
                        shield=True),
    # pass CB (plan 11): the hunter in brown leather with a dagger as the nearest 1x weapon (no 1x bow exists); the
    # ranger in a green cloak-coloured tunic
    "hunter": Look(hair=(14, 8, 4), hair_style="short", outfit="tunic", cloth=(13, 9, 5), trim=(26, 22, 16),
                   pants=(11, 8, 5), boots=(9, 6, 4), weapon="dagger"),
    # pass CB (plan 11-13): the cleric in steel over a white tabard (plain helm-less hair, the hammer as a staff-like
    # 1x weapon is not drawn: rod); the paladin in white-and-gold plate with a sword and shield
    "cleric": Look(hair=(15, 9, 4), hair_style="short", outfit="armor", cloth=(29, 28, 26), trim=(26, 22, 8),
                   pants=(12, 8, 5), boots=(12, 8, 5), weapon="rod", weapon_color=(22, 22, 26), shield=True),
    # pass CB (plan 11-14): the ronin in a grey kimono under a straw hat (the round_hat gear) with a sword (no 1x
    # katana); the samurai in red-and-black armour with the plain helm
    "ronin": Look(hair=(4, 3, 4), hair_style="long", outfit="tunic", cloth=(11, 11, 11), trim=(6, 6, 8),
                  pants=(12, 11, 10), boots=(26, 24, 20), gear="round_hat", gear_color=(24, 19, 10), weapon="sword"),
    # pass CB (plan 11-14): the shaman in hide and fur with a witch-style hood as the nearest 1x headdress (no antler
    # gear exists) and a staff; the druid in a leaf-green robe with the same
    "shaman": Look(hair=(8, 5, 3), hair_style="long", outfit="tunic", cloth=(16, 10, 5), trim=(26, 21, 13),
                   pants=(22, 17, 10), boots=(12, 8, 5), gear="hood", gear_color=(12, 8, 5), weapon="staff",
                   weapon_color=(14, 9, 5)),
    # pass CB (plan 11-15): the beastmaster in a tan pelt hood (the hood gear) and brown hide, bare-handed like the
    # monk; the summoner in a feathered brown robe with a staff
    "beastmaster": Look(hair=(10, 6, 3), hair_style="short", outfit="gi", cloth=(14, 9, 5), trim=(26, 19, 11),
                        pants=(11, 7, 4), boots=(10, 6, 4), gear="hood", gear_color=(26, 19, 11)),
    # pass CB (plan 11-15): the warlock in a long dark coat with a dagger; the necromancer, pale, in a tattered dark robe
    # with a staff (no horned-skull 1x staff exists)
    "warlock": Look(hair=(3, 3, 4), hair_style="short", outfit="coat", cloth=(6, 5, 6), trim=(14, 6, 6),
                    pants=(6, 5, 6), boots=(5, 4, 5), weapon="dagger"),
    # pass CB (plan 11-15): the rune knight, blond, in steel and brown leather with a rune sword and a round shield; the
    # mystic warrior in dark steel with a helm, a rune sword, a kite shield and a cape
    "rune_knight": Look(hair=(28, 24, 16), hair_style="spiky", outfit="armor", cloth=(18, 19, 22), trim=(14, 9, 5),
                        pants=(8, 8, 10), boots=(14, 9, 5), weapon="sword", shield=True),
    # pass CB (plan 11-16): the scholar (hero id scholar_hero; "scholar" is the townsfolk NPC), young, in a teal cap
    # and a gold coat with a book; the sage (sage_hero), a white-bearded elder in a teal hat and robe with a gold staff
    "scholar_hero": Look(hair=(14, 9, 5), hair_style="short", outfit="coat", cloth=(24, 18, 8), trim=(14, 9, 5),
                         pants=(10, 7, 5), boots=(12, 8, 5), gear="hood", gear_color=(4, 10, 11)),
    # pass CB (plan 11-17): the arquebusier in a steel morion with a gold plume and a striped doublet, a matchlock;
    # the rifleman in a steel helmet with goggles, plate and leather, a rifle with a bayonet
    "arquebusier": Look(hair=(8, 5, 3), hair_style="short", outfit="tunic", cloth=(10, 7, 5), trim=(26, 18, 5),
                        pants=(10, 7, 5), boots=(5, 5, 6), gear="helm", gear_color=(20, 20, 22), weapon="spear",
                        weapon_color=(14, 9, 5)),
    # pass CB (plan 11-18): the shieldmaiden, a blond braid under a nasal helm, mail and fur, a spear and a round
    # shield; the valkyrie in a winged helm and silver armour with a cape (her wings are battle art only)
    "shieldmaiden": Look(hair=(28, 22, 10), hair_style="long", outfit="armor", cloth=(14, 9, 5), trim=(18, 18, 20),
                         pants=(14, 9, 5), boots=(12, 8, 5), gear="helm", gear_color=(18, 18, 20), weapon="spear",
                         shield=True),
    # Upgraded classes
    "valkyrie": Look(hair=(26, 18, 8), hair_style="long", outfit="armor", cloth=(26, 27, 29), trim=(20, 22, 26),
                     pants=(14, 20, 26), boots=(22, 23, 26), gear="helm", gear_color=(26, 27, 29), weapon="spear",
                     shield=True, cape=(14, 20, 26)),
    "rifleman": Look(hair=(8, 5, 3), hair_style="short", outfit="armor", cloth=(10, 7, 5), trim=(23, 16, 7),
                     pants=(8, 8, 9), boots=(5, 5, 6), gear="helm", gear_color=(17, 17, 18), weapon="spear",
                     weapon_color=(18, 18, 19)),
    "sage_hero": Look(hair=(29, 29, 28), hair_style="long", beard=(29, 29, 28), outfit="robe", cloth=(4, 10, 11),
                      trim=(28, 22, 10), boots=(12, 8, 5), gear="hood", gear_color=(4, 10, 11), weapon="staff",
                      weapon_color=(28, 22, 10)),
    "mystic_warrior": Look(hair=(14, 9, 5), hair_style="short", outfit="armor", cloth=(5, 6, 8), trim=(20, 22, 26),
                           pants=(5, 6, 8), boots=(18, 19, 22), gear="helm", gear_color=(18, 19, 22), weapon="sword",
                           shield=True, cape=(4, 9, 20)),
    "necromancer": Look(skin=SKIN_LIGHT, hair=(26, 26, 24), hair_style="long", outfit="robe", cloth=(7, 8, 7),
                        trim=(12, 20, 6), boots=(5, 5, 5), weapon="staff", weapon_color=(14, 10, 6)),
    "summoner": Look(hair=(10, 6, 3), hair_style="short", outfit="robe", cloth=(16, 11, 6), trim=(28, 25, 20),
                     boots=(10, 6, 4), gear="hood", gear_color=(26, 23, 18), weapon="staff", weapon_color=(16, 11, 6)),
    "druid": Look(hair=(8, 5, 3), hair_style="long", outfit="robe", cloth=(9, 14, 6), trim=(24, 20, 12),
                  boots=(12, 8, 5), gear="hood", gear_color=(7, 11, 5), weapon="staff", weapon_color=(26, 22, 14)),
    "centurion": Look(hair=(15, 9, 4), hair_style="short", outfit="armor", cloth=(24, 5, 5), trim=(27, 22, 6),
                      pants=(22, 5, 5), boots=(14, 9, 5), gear="plume_helm", gear_color=(22, 22, 25),
                      gear_color2=(26, 4, 4), weapon="sword", shield=True, cape=(22, 4, 4)),
    "ranger": Look(hair=(14, 8, 4), hair_style="short", outfit="tunic", cloth=(7, 13, 7), trim=(20, 16, 8),
                   pants=(9, 7, 4), boots=(9, 6, 4), gear="hood", gear_color=(7, 13, 7), weapon="dagger"),
    "paladin": Look(hair=(15, 9, 4), hair_style="short", outfit="armor", cloth=(30, 30, 29), trim=(28, 22, 6),
                    pants=(26, 26, 27), boots=(24, 24, 26), weapon="sword", shield=True, cape=(28, 24, 12)),
    "samurai": Look(hair=(4, 3, 4), hair_style="short", outfit="armor", cloth=(20, 4, 4), trim=(6, 5, 7),
                    pants=(7, 6, 9), boots=(26, 24, 20), gear="helm", gear_color=(8, 6, 8), weapon="sword"),
    "berserker": Look(hair=(22, 11, 4), hair_style="spiky", outfit="tunic", cloth=(11, 7, 4), trim=(20, 20, 23),
                      pants=(12, 8, 5), boots=(9, 7, 6), gear="helm", gear_color=(20, 20, 23), beard=(22, 11, 4),
                      weapon="sword"),
    # pass CL (docs/CLASS_LANCE_PLAN.md D-CL10): 1x legacy looks of the lance pair (no 1x spear exists, so the
    # nearest weapon): the landsknecht's ochre doublet and feathered beret, the dragoon's dark teal armour, gold trim
    "landsknecht": Look(hair=(27, 20, 8), hair_style="short", outfit="coat", cloth=(26, 18, 5), trim=(10, 6, 4),
                        pants=(26, 18, 5), boots=(12, 8, 5), gear="feather", gear_color=(9, 11, 17),
                        gear_color2=(27, 26, 23), weapon="sword"),
    "dragoon": Look(hair=(27, 22, 12), hair_style="short", outfit="armor", cloth=(5, 9, 11), trim=(26, 20, 9),
                    pants=(5, 8, 9), boots=(5, 8, 9), gear="plume_helm", gear_color=(5, 9, 11),
                    gear_color2=(26, 20, 9), weapon="sword"),
    # pass CD-K (docs/CLASS_DARKFIGHTER_PLAN.md D-DK7): 1x legacy looks of the dark pair (black-violet plate)
    "dark_fighter_hero": Look(hair=(4, 4, 6), hair_style="short", outfit="armor", cloth=(5, 5, 8), trim=(12, 10, 16),
                              pants=(4, 4, 6), boots=(3, 3, 5), gear="helm", gear_color=(6, 6, 9), weapon="sword"),
    "death_knight_hero": Look(hair=(4, 4, 6), hair_style="short", outfit="armor", cloth=(5, 5, 8), trim=(18, 8, 24),
                              pants=(4, 4, 6), boots=(3, 3, 5), gear="plume_helm", gear_color=(6, 6, 9),
                              gear_color2=(18, 8, 24), weapon="sword"),
    "knight": Look(hair=(26, 22, 8), hair_style="short", outfit="armor", cloth=(18, 20, 27), trim=(27, 22, 6),
                   pants=(10, 12, 18), boots=(10, 11, 15), gear="plume_helm", gear_color=(18, 20, 27),
                   gear_color2=(28, 29, 31), weapon="sword", shield=True),
    "ninja": Look(hair=(7, 7, 13), hair_style="short", outfit="tunic", cloth=(7, 7, 11), trim=(25, 5, 6), pants=(6, 6, 10),
                  boots=(5, 5, 8), gear="headband", gear_color=(26, 6, 6), mask=True, weapon="dagger"),
    "master": Look(skin=SKIN_TAN, hair=None, hair_style="bald", outfit="gi", cloth=(29, 24, 6), trim=(31, 31, 29),
                   pants=(29, 24, 6), boots=(30, 28, 22)),
    "white_wizard": Look(hair=(28, 28, 28), hair_style="short", outfit="robe", cloth=(30, 30, 31), trim=(28, 23, 6),
                         gear="hood", gear_color=(30, 30, 31), boots=(26, 22, 8), weapon="staff", weapon_color=(30, 26, 8)),
    "black_wizard": Look(outfit="robe", cloth=(10, 4, 16), trim=(26, 26, 30), shadow_face=True, hair=None, hair_style="bald",
                         gear="witch", gear_color=(11, 5, 18), boots=(8, 4, 12), weapon="rod", weapon_color=(26, 14, 30)),
    "red_wizard": Look(hair=(26, 26, 28), hair_style="short", outfit="coat", cloth=(19, 3, 9), trim=(28, 22, 6),
                       pants=(26, 22, 8), boots=(10, 5, 4), gear="feather", gear_color=(19, 3, 9),
                       gear_color2=(31, 30, 20), weapon="rapier"),
    # NPCs
    "guard": Look(hair=(12, 8, 4), outfit="armor", cloth=(8, 12, 24), trim=(24, 24, 28), pants=(8, 9, 14),
                  boots=(10, 7, 4), gear="plume_helm", gear_color=(20, 22, 27), gear_color2=(26, 5, 6), weapon="spear"),
    "innkeeper": Look(hair=(20, 14, 6), hair_style="bun", outfit="apron", cloth=(22, 12, 6), trim=(30, 30, 28),
                      pants=(14, 9, 5), boots=(12, 7, 4)),
    "mage": Look(hair=(28, 28, 28), hair_style="short", beard=(29, 29, 29), outfit="robe", cloth=(16, 6, 22),
                 trim=(27, 22, 6), gear="witch", gear_color=(14, 5, 20), boots=(12, 7, 4), weapon="staff",
                 weapon_color=(14, 24, 30)),
    "merchant": Look(hair=(8, 6, 3), hair_style="short", outfit="tunic", cloth=(6, 18, 8), trim=(27, 22, 6),
                     pants=(12, 9, 5), boots=(12, 7, 4), gear="round_hat", gear_color=(22, 5, 6), beard=(8, 6, 3)),
    "old_man": Look(hair=(27, 27, 28), hair_style="short", beard=(28, 28, 29), outfit="robe", cloth=(18, 13, 8),
                    trim=(24, 20, 12), boots=(12, 7, 4), weapon="cane"),
    "villager": Look(hair=(13, 8, 4), hair_style="short", outfit="tunic", cloth=(6, 12, 24), trim=(24, 18, 8),
                     pants=(14, 10, 6), boots=(12, 7, 4)),
    "villager_f": Look(hair=(24, 18, 6), hair_style="long", outfit="dress", cloth=(27, 10, 14), trim=(31, 28, 28),
                       boots=(14, 9, 5)),
    "king": Look(hair=(26, 26, 28), hair_style="short", beard=(26, 26, 28), outfit="robe", cloth=(24, 4, 6),
                 trim=(31, 31, 30), gear="crown", boots=(26, 22, 8), cape=(24, 4, 6)),
    "chest": Look(prop="chest"),
    # Townsfolk (CT-9 / UI-2): legacy looks until their 2x field sheets are approved (T6-art checkpoints 3-5)
    "vendor_f": Look(hair=(16, 9, 4), hair_style="long", outfit="dress", cloth=(26, 20, 5), trim=(30, 30, 28),
                     boots=(12, 7, 4), gear="bandana", gear_color=(7, 18, 8)),
    "farmer": Look(skin=SKIN_TAN, hair=(14, 8, 4), hair_style="short", beard=(14, 8, 4), outfit="tunic",
                   cloth=(14, 16, 6), trim=(29, 27, 21), pants=(15, 10, 5), boots=(12, 7, 4), gear="round_hat",
                   gear_color=(28, 24, 12)),
    "burgher": Look(hair=(21, 21, 22), hair_style="short", outfit="coat", cloth=(16, 5, 14), trim=(30, 30, 30),
                    pants=(4, 4, 6), boots=(3, 3, 4), gear="feather", gear_color=(4, 4, 6), gear_color2=(31, 31, 31),
                    cape=(4, 4, 6)),
    # Pass AR NPCs: 1x legacy looks (`?art=legacy`); the 2x field sheets are approved/<id>/field.* (npc_field_cut.py)
    "luf_citizen_m": Look(hair=(8, 5, 3), hair_style="short", outfit="robe", cloth=(29, 29, 28), trim=(6, 22, 24),
                          boots=(14, 9, 5), gear="headband", gear_color=(27, 22, 6)),
    "luf_citizen_f": Look(hair=(20, 11, 5), hair_style="long", outfit="dress", cloth=(5, 22, 23), trim=(30, 31, 31),
                          boots=(14, 9, 5), gear="headband", gear_color=(27, 22, 6)),
    "luf_senator": Look(hair=(27, 27, 28), hair_style="short", beard=(28, 28, 29), outfit="robe", cloth=(30, 30, 29),
                        trim=(27, 22, 6), boots=(14, 9, 5)),
    "dragon_guard": Look(skin=_skin((3, 9, 6), (5, 13, 9), (7, 17, 12), (9, 21, 14), (12, 24, 17), (16, 27, 21)),
                         hair=None, hair_style="bald", outfit="armor", cloth=(6, 10, 24), trim=(27, 22, 6),
                         weapon="spear"),
    "dragon_elder": Look(skin=_skin((3, 9, 6), (5, 13, 9), (7, 17, 12), (9, 21, 14), (12, 24, 17), (16, 27, 21)),
                         hair=None, hair_style="bald", outfit="robe", cloth=(8, 18, 12), trim=(24, 20, 12),
                         weapon="staff"),
    "dragon_youth": Look(skin=_skin((2, 8, 11), (3, 12, 15), (5, 17, 20), (7, 21, 24), (10, 24, 27), (15, 27, 29)),
                         hair=None, hair_style="bald", outfit="tunic", cloth=(5, 18, 22), trim=(28, 16, 4),
                         boots=(14, 8, 3)),
    # pass CD (docs/CARDIA_PLAN.md 6.2): Cardia Deep's dragon-kin sheets (approved/<id>/field.*)
    "bahamut": Look(skin=_skin((14, 9, 2), (19, 13, 3), (24, 18, 5), (28, 23, 9), (30, 27, 14), (31, 30, 20)),
                    hair=None, hair_style="bald", outfit="armor", cloth=(5, 9, 22), trim=(30, 25, 11),
                    cape=(26, 22, 8)),
    "dragon_sage": Look(skin=_skin((14, 15, 18), (18, 19, 22), (22, 23, 26), (25, 26, 28), (28, 28, 30), (30, 30, 31)),
                        hair=None, hair_style="bald", beard=(30, 30, 31), outfit="robe", cloth=(27, 25, 20),
                        trim=(14, 9, 5), weapon="staff"),
    "dragon_matron": Look(skin=_skin((14, 5, 1), (20, 8, 2), (25, 12, 3), (28, 16, 5), (30, 20, 8), (31, 24, 12)),
                          hair=None, hair_style="bald", outfit="dress", cloth=(18, 7, 3), trim=(29, 27, 22)),
    "dragon_hatchling": Look(skin=_skin((14, 4, 8), (20, 7, 11), (25, 11, 15), (28, 15, 18), (30, 20, 22),
                                        (31, 25, 26)),
                             hair=None, hair_style="bald", outfit="tunic", cloth=(4, 17, 17), trim=(28, 22, 6),
                             boots=(20, 7, 11)),
    "robot_sentry": Look(skin=STEEL, hair=None, hair_style="bald", outfit="armor", cloth=(18, 19, 22),
                         trim=(26, 5, 4), pants=(12, 13, 16), boots=(10, 11, 13), gear="helm",
                         gear_color=(20, 21, 24)),
    "robot_ancient": Look(skin=shade_ramp(8, 19, 16), hair=None, hair_style="bald", outfit="armor",
                          cloth=(8, 18, 15), trim=(18, 11, 5), pants=(6, 14, 12), boots=(12, 7, 3), gear="helm",
                          gear_color=(9, 20, 17)),
    "sage_star": Look(hair=(28, 28, 28), hair_style="short", beard=(29, 29, 29), outfit="robe", cloth=(6, 9, 24),
                      trim=(28, 24, 8), gear="witch", gear_color=(6, 9, 24)),
    "sage_earth": Look(hair=(26, 26, 26), hair_style="long", outfit="robe", cloth=(8, 16, 7), trim=(16, 10, 5),
                       gear="hood", gear_color=(8, 16, 7)),
    "sage_flame": Look(skin=SKIN_TAN, hair=None, hair_style="bald", beard=(28, 28, 29), outfit="robe",
                       cloth=(26, 10, 3), trim=(28, 22, 6)),
    "dr_unne": Look(hair=(28, 28, 29), hair_style="short", outfit="coat", cloth=(5, 12, 5), trim=(30, 30, 30),
                    pants=(3, 10, 11), boots=(12, 6, 3)),
    # pass DW: the dwarves of the dwarf hall (approved/<id>/field.*, npc_field_dw.py); 1x legacy looks
    "dwarf_miner": Look(hair=(26, 11, 3), beard=(26, 11, 3), outfit="tunic", cloth=(4, 18, 18), trim=(14, 8, 4),
                        pants=(4, 14, 15), boots=(12, 7, 3), gear="helm", gear_color=(29, 19, 5)),
    "dwarf_smith": Look(hair=None, hair_style="bald", beard=(14, 7, 3), outfit="apron", cloth=(9, 13, 9),
                        trim=(14, 8, 4), pants=(7, 10, 7), boots=(10, 6, 3)),
    "dwarf_elder": Look(hair=(29, 29, 29), beard=(30, 30, 30), outfit="robe", cloth=(4, 9, 24), trim=(28, 22, 6),
                        boots=(12, 7, 3)),
    "dwarf_guard": Look(hair=(24, 10, 3), beard=(24, 10, 3), outfit="armor", cloth=(4, 9, 20), trim=(24, 16, 7),
                        boots=(12, 7, 3), gear="helm", gear_color=(24, 16, 7)),
    "dwarf_woman": Look(hair=(26, 11, 3), hair_style="long", outfit="dress", cloth=(6, 16, 7), trim=(14, 8, 4),
                        boots=(12, 7, 3)),
    "dwarf_child": Look(hair=(26, 11, 3), hair_style="long", outfit="dress", cloth=(6, 16, 7), trim=(14, 8, 4),
                        boots=(12, 7, 3)),
    "dwarf_trader": Look(hair=(16, 9, 4), beard=(18, 9, 4), outfit="coat", cloth=(7, 18, 6), trim=(14, 8, 4),
                         boots=(12, 7, 3), gear="round_hat", gear_color=(7, 18, 6)),
    "dwarf_nerrick": Look(hair=(17, 10, 5), beard=(17, 10, 5), outfit="tunic", cloth=(17, 10, 5), trim=(30, 30, 29),
                          pants=(4, 8, 14), boots=(12, 7, 3), gear="round_hat", gear_color=(22, 15, 7)),
    # pass PT (docs/PLAYTEST_ART_PLAN.md 4.1 step 9): the 1x Looks of the user-rendered field sheets
    "boy": Look(hair=(28, 21, 12), hair_style="spiky", outfit="tunic", cloth=(19, 6, 7), trim=(20, 14, 8),
                pants=(17, 12, 8), boots=(10, 6, 4)),
    "girl": Look(hair=(4, 4, 6), hair_style="bun", outfit="dress", cloth=(4, 16, 17), trim=(30, 30, 29),
                 boots=(24, 4, 4)),
    "townsman": Look(hair=(12, 7, 4), outfit="tunic", cloth=(26, 21, 7), trim=(13, 8, 4), pants=(6, 12, 7)),
    "young_woman": Look(hair=(10, 6, 3), hair_style="long", outfit="dress", cloth=(9, 16, 27), trim=(18, 6, 8)),
    "old_woman": Look(hair=(24, 24, 24), hair_style="bun", outfit="dress", cloth=(14, 7, 15), trim=(18, 18, 20),
                      gear="hood", gear_color=(22, 18, 26), weapon="cane", weapon_color=(16, 10, 5)),
    "sailor": Look(hair=(4, 4, 6), beard=(4, 4, 6), outfit="tunic", cloth=(28, 28, 28), trim=(5, 7, 16),
                   pants=(20, 16, 10), gear="round_hat", gear_color=(5, 7, 16)),
    "sea_captain": Look(hair=(16, 14, 12), beard=(16, 14, 12), outfit="coat", cloth=(18, 4, 6), trim=(28, 22, 8),
                        pants=(4, 4, 6), gear="round_hat", gear_color=(4, 4, 6), weapon="sword"),
    "pirate_crew": Look(hair=(6, 4, 3), outfit="tunic", cloth=(4, 4, 6), trim=(28, 14, 4), pants=(9, 9, 10),
                        gear="bandana", gear_color=(24, 5, 4), weapon="dagger"),
    "labourer": Look(hair=None, hair_style="bald", beard=(13, 8, 4), outfit="apron", cloth=(22, 10, 4),
                     trim=(12, 8, 5), pants=(9, 7, 5)),
    "scholar": Look(hair=(8, 8, 8), beard=(8, 8, 8), outfit="robe", cloth=(4, 6, 14), trim=(14, 9, 4)),
    "healer": Look(hair=(20, 11, 5), outfit="robe", cloth=(17, 20, 14), trim=(30, 29, 24), gear="hood",
                   gear_color=(28, 26, 21)),
    "pilgrim": Look(hair=(16, 16, 16), beard=(16, 16, 16), outfit="robe", cloth=(15, 11, 7), trim=(12, 12, 12),
                    gear="hood", gear_color=(15, 11, 7), weapon="staff", weapon_color=(16, 10, 5)),
    "dancer": Look(hair=(18, 8, 22), hair_style="long", outfit="dress", cloth=(22, 3, 7), trim=(30, 12, 12)),
    "elf_man": Look(hair=(28, 27, 22), hair_style="long", outfit="tunic", cloth=(6, 16, 11), trim=(24, 25, 28)),
    "elf_woman": Look(hair=(29, 26, 16), hair_style="long", outfit="dress", cloth=(20, 28, 24), trim=(6, 15, 14),
                      gear="crown", gear_color=(24, 25, 28)),
    "elf_guard": Look(hair=(24, 25, 28), outfit="armor", cloth=(5, 15, 14), trim=(24, 25, 28), gear="helm",
                      gear_color=(24, 25, 28), weapon="spear"),
    "elf_elder": Look(hair=(30, 30, 30), hair_style="long", beard=(30, 30, 30), outfit="robe", cloth=(4, 13, 7),
                      trim=(24, 25, 28), weapon="staff", weapon_color=(26, 22, 14)),
    "elf_mage": Look(hair=(12, 6, 18), hair_style="long", outfit="robe", cloth=(14, 9, 22), trim=(24, 25, 28)),
    "elf_child": Look(hair=(29, 26, 16), outfit="tunic", cloth=(6, 16, 11), trim=(24, 25, 28), pants=(28, 27, 22)),
    "elf_prince": Look(hair=(30, 30, 30), hair_style="long", outfit="coat", cloth=(5, 14, 9), trim=(24, 25, 28),
                       pants=(28, 28, 28), gear="crown", gear_color=(24, 25, 28), cape=(20, 24, 22)),
    "broom": Look(hair=None, prop="broom"),
}
