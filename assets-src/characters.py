"""SNES-style two-tile characters (16x32: a "head" tile above a "feet" tile).

One generator builds every playable class and every NPC from a `Look`. Each character
becomes a 6x5 block of 16x32 cells:
  rows 0-3  field walk: down, up, left, right   (cols 0-2 = stand, step A, step B)
  row  4    battle poses, facing LEFT toward the enemies:
            ready, attack, cast, hurt, down (kneeling), victory
Figures are composed from separately-drawn parts so poses and walk frames only change
part offsets, not the art. Light always comes from the top-left.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from PIL import Image

import snes_palette as P
from pixel import Canvas

CELL_W, CELL_H = 16, 32
BLOCK_COLS, BLOCK_ROWS = 6, 5
OUTLINE = P.c15(3, 2, 6)
EYE = P.c15(3, 2, 5)
WHITE = P.c15(31, 31, 31)


def shade_ramp(r: int, g: int, b: int) -> list:
    """5-step ramp from a 5-bit base colour: shadows cool and deepen, highlights warm and lift."""
    def cl(v: float) -> int:
        return max(0, min(31, int(round(v))))
    return [P.c15(*t) for t in (
        (cl(r * 0.36), cl(g * 0.36), cl(b * 0.48 + 2)),
        (cl(r * 0.62), cl(g * 0.62), cl(b * 0.76 + 1)),
        (r, g, b),
        (cl(r * 1.16 + 2), cl(g * 1.14 + 2), cl(b * 1.06 + 1)),
        (cl(r * 1.28 + 5), cl(g * 1.26 + 5), cl(b * 1.12 + 3)),
    )]


SKIN_LIGHT = shade_ramp(28, 20, 15)
SKIN_TAN = shade_ramp(24, 16, 10)
SKIN_DARK = shade_ramp(18, 11, 7)
STEEL = shade_ramp(17, 19, 23)
GOLD = shade_ramp(27, 22, 6)


@dataclass
class Look:
    skin: list = field(default_factory=lambda: SKIN_LIGHT)
    hair: tuple[int, int, int] | None = (14, 8, 4)
    hair_style: str = "short"        # short | spiky | long | bun | bald | hood
    cloth: tuple[int, int, int] = (8, 12, 22)
    trim: tuple[int, int, int] = (26, 22, 8)
    pants: tuple[int, int, int] = (9, 9, 14)
    boots: tuple[int, int, int] = (12, 7, 4)
    outfit: str = "tunic"            # tunic | armor | robe | gi | coat | dress | apron
    gear: str | None = None          # helm | plume_helm | bandana | headband | hood | witch | feather | crown | round_hat
    gear_color: tuple[int, int, int] = (26, 6, 6)
    gear_color2: tuple[int, int, int] = (31, 31, 31)
    beard: tuple[int, int, int] | None = None
    mask: bool = False               # lower face covered (ninja)
    shadow_face: bool = False        # black-mage style: dark face with glowing eyes
    weapon: str | None = None        # sword | dagger | staff | rod | rapier | spear | cane
    weapon_color: tuple[int, int, int] = (22, 22, 26)
    shield: bool = False
    cape: tuple[int, int, int] | None = None
    prop: str | None = None          # chest


class Pal:
    """Resolved ramps for a Look."""
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


def vshade(cv: Canvas, x0: int, y0: int, x1: int, y1: int, ramp: list, lit_left: bool = True) -> None:
    """Fill a rect with ramp[2], light edge on the lit side, shadow edge opposite, darker bottom row."""
    cv.rect(x0, y0, x1, y1, ramp[2])
    if x1 - x0 >= 2:
        cv.rect(x0 if lit_left else x1, y0, x0 if lit_left else x1, y1, ramp[3])
        cv.rect(x1 if lit_left else x0, y0, x1 if lit_left else x0, y1, ramp[1])
    cv.rect(x0, y1, x1, y1, ramp[1])


# ───────────────────────────── legs ─────────────────────────────

def legs_front(look: Look, pal: Pal, frame: int, back: bool = False) -> Canvas:
    cv = new()
    if look.outfit in ("robe", "dress", "apron"):
        # Skirt/robe hem sways by a pixel while the feet peek out underneath.
        sway = {0: 0, 1: 1, 2: -1}[frame]
        base = pal.cloth if look.outfit != "apron" else shade_ramp(*look.pants)
        for y in range(23, 30):
            grow = (y - 23) // 3
            x0, x1 = 4 - grow, 11 + grow
            cv.rect(x0 + (sway if y > 26 else 0), y, x1 + (sway if y > 26 else 0), y, base[2])
            cv.set(x0 + (sway if y > 26 else 0), y, base[3])
            cv.set(x1 + (sway if y > 26 else 0), y, base[1])
        hem_y = 29
        cv.rect(2 + sway, hem_y, 13 + sway, hem_y, pal.trim[2] if look.outfit == "robe" else base[1])
        for fx in (4, 9):
            if frame == 1 and fx == 9:
                continue
            if frame == 2 and fx == 4:
                continue
            cv.rect(fx, 30, fx + 2, 30, pal.boots[2])
        return cv
    lifted = {0: None, 1: "r", 2: "l"}[frame]
    for side, (px0, px1, bx0, bx1) in {"l": (5, 7, 4, 7), "r": (8, 10, 8, 11)}.items():
        lift = 1 if lifted == side else 0
        vshade(cv, px0, 24, px1, 28 - lift, pal.pants, lit_left=True)
        cv.rect(bx0, 29 - lift, bx1, 30 - lift, pal.boots[2])
        cv.rect(bx0, 29 - lift, bx0, 29 - lift, pal.boots[3])
        cv.rect(bx0, 30 - lift, bx1, 30 - lift, pal.boots[1])
    return cv


def legs_side(look: Look, pal: Pal, frame: int) -> Canvas:
    """Facing left."""
    cv = new()
    if look.outfit in ("robe", "dress", "apron"):
        sway = {0: 0, 1: -1, 2: 1}[frame]
        base = pal.cloth if look.outfit != "apron" else shade_ramp(*look.pants)
        for y in range(23, 30):
            grow = (y - 23) // 3
            x0, x1 = 5 - grow + (sway if y > 26 else 0), 10 + grow + (sway if y > 26 else 0)
            cv.rect(x0, y, x1, y, base[2])
            cv.set(x0, y, base[3])
            cv.set(x1, y, base[1])
        cv.rect(3 + sway, 29, 12 + sway, 29, pal.trim[2] if look.outfit == "robe" else base[1])
        cv.rect(4 + sway, 30, 6 + sway, 30, pal.boots[2])
        return cv
    # (front-leg x offset, back-leg x offset)
    off = {0: (0, 0), 1: (-2, 2), 2: (2, -2)}[frame]
    back = (7, 9, 7 + off[1], 9 + off[1])
    front = (6, 8, 6 + off[0], 8 + off[0])
    for (_, _, a, b), shade in ((back, 1), (front, 2)):
        ramp = pal.pants
        cv.rect(a, 24, b, 28, ramp[shade])
        cv.rect(a, 24, a, 28, ramp[shade + 1] if shade < 3 else ramp[3])
        lead = a - 1
        cv.rect(lead, 29, b, 30, pal.boots[shade])
        cv.set(lead, 29, pal.boots[3])
    return cv


# ───────────────────────────── torso & arms ─────────────────────────────

def torso_front(look: Look, pal: Pal, back: bool = False) -> Canvas:
    cv = new()
    top, bot = 17, 24
    c = pal.cloth
    if look.outfit == "gi":
        # Open gi: bare chest between cloth lapels, sash at the waist.
        cv.rect(4, top, 11, bot, pal.skin[2])
        if not back:
            cv.rect(7, top, 8, top + 4, pal.skin[1])
            for i in range(3):
                cv.set(5 + i, top + i, c[2]); cv.set(10 - i, top + i, c[2])
            cv.rect(4, top, 4, bot, c[3]); cv.rect(11, top, 11, bot, c[1])
        else:
            cv.rect(4, top, 11, bot, c[2]); cv.rect(4, top, 4, bot, c[3]); cv.rect(11, top, 11, bot, c[1])
        cv.rect(4, bot - 1, 11, bot, pal.trim[2])
        cv.rect(4, bot, 11, bot, pal.trim[1])
        return cv
    vshade(cv, 4, top, 11, bot, c)
    cv.rect(3, top, 12, top, c[3] if look.outfit != "armor" else pal.trim[3])  # shoulder line
    if look.outfit == "armor":
        cv.rect(5, top + 1, 10, top + 4, c[3])          # breastplate
        cv.rect(5, top + 1, 6, top + 2, c[4])
        cv.rect(10, top + 3, 10, top + 4, c[1])
        cv.rect(7, top + 1, 8, top + 4, c[2])
        cv.rect(7, top + 1, 7, top + 3, c[4])
    elif look.outfit in ("robe", "dress"):
        if not back:
            cv.rect(7, top, 8, bot, pal.trim[2])         # front trim stripe
            cv.rect(7, top, 7, bot, pal.trim[3])
    elif look.outfit == "coat":
        if not back:
            cv.rect(7, top + 1, 8, bot, pal.trim[2])
            cv.set(7, top + 3, pal.trim[4]); cv.set(8, top + 5, pal.trim[4])
    elif look.outfit == "apron":
        if not back:
            vshade(cv, 5, top + 2, 10, bot, shade_ramp(31, 31, 29))
    if not back and look.outfit not in ("armor",):
        cv.set(6, top, pal.skin[1]); cv.set(7, top, pal.skin[2]); cv.set(8, top, pal.skin[2]); cv.set(9, top, pal.skin[1])
    # belt
    if look.outfit not in ("robe",):
        cv.rect(4, bot - 1, 11, bot - 1, pal.trim[1])
        cv.rect(7, bot - 1, 8, bot - 1, pal.trim[3])
    return cv


def torso_side(look: Look, pal: Pal) -> Canvas:
    cv = new()
    top, bot = 17, 24
    c = pal.cloth
    if look.outfit == "gi":
        cv.rect(5, top, 10, bot, c[2]); cv.rect(5, top, 5, bot, c[3]); cv.rect(10, top, 10, bot, c[1])
        cv.rect(5, top, 6, top + 2, pal.skin[2])
        cv.rect(5, bot - 1, 10, bot, pal.trim[2])
        return cv
    vshade(cv, 5, top, 10, bot, c)
    if look.outfit == "armor":
        cv.rect(5, top + 1, 7, top + 4, c[3]); cv.set(5, top + 1, c[4])
    elif look.outfit in ("robe", "dress"):
        cv.rect(5, top, 5, bot, pal.trim[2])
    elif look.outfit == "apron":
        vshade(cv, 5, top + 2, 7, bot, shade_ramp(31, 31, 29))
    if look.outfit != "robe":
        cv.rect(5, bot - 1, 10, bot - 1, pal.trim[1])
    cv.set(5, top, pal.skin[2])
    return cv


def arm_front(look: Look, pal: Pal, left: bool, length: int) -> Canvas:
    """length 4..6 rows below the shoulder (swing varies it)."""
    cv = new()
    x0 = 2 if left else 12
    sleeve = pal.skin if look.outfit == "gi" and look.gear != "no" else None
    c = pal.cloth
    top = 18
    sleeve_bottom = top + length - 3
    wide = look.outfit in ("robe", "dress")
    xs = (x0 - (1 if wide and left else 0), x0 + 1 + (1 if wide and not left else 0))
    body = sleeve if sleeve else c
    cv.rect(xs[0], top, xs[1], sleeve_bottom + (1 if wide else 0), body[2])
    cv.rect(xs[0] if left else xs[1], top, xs[0] if left else xs[1], sleeve_bottom, body[3 if left else 1])
    if look.outfit == "armor":
        cv.rect(xs[0], top - 1, xs[1], top, pal.trim[3])               # pauldron
        cv.set(xs[0 if left else 1], top - 1, pal.trim[2])
        cv.rect(xs[0], top + 1, xs[1], top + 1, pal.trim[1])
    hand_y = sleeve_bottom + (2 if wide else 1)
    hx = (x0, x0 + 1)
    cv.rect(hx[0], hand_y, hx[1], hand_y + 1, pal.skin[2])
    cv.set(hx[0], hand_y, pal.skin[3])
    cv.set(hx[1], hand_y + 1, pal.skin[1])
    if look.outfit == "gi":
        cv.rect(hx[0], hand_y - 1, hx[1], hand_y - 1, pal.trim[2])    # wrist wrap
    return cv


def arm_side(look: Look, pal: Pal, dx: int, length: int = 6) -> Canvas:
    """Near arm in profile; dx shifts it fore/aft."""
    cv = new()
    c = pal.skin if look.outfit == "gi" else pal.cloth
    x0 = 6 + dx
    cv.rect(x0, 18, x0 + 2, 18 + length - 3, c[2])
    cv.rect(x0, 18, x0, 18 + length - 3, c[3])
    cv.rect(x0 + 2, 18, x0 + 2, 18 + length - 3, c[1])
    if look.outfit == "armor":
        cv.rect(x0 - 1, 17, x0 + 3, 18, pal.trim[3])
        cv.rect(x0 - 1, 18, x0 + 3, 18, pal.trim[2])
    hand_y = 18 + length - 2
    cv.rect(x0, hand_y, x0 + 1, hand_y + 1, pal.skin[2])
    cv.set(x0, hand_y, pal.skin[3])
    return cv


# ───────────────────────────── heads ─────────────────────────────

def hair_cap(cv: Canvas, hair: list, style: str, facing: str, dy: int = 0) -> None:
    h = hair
    if style == "bald":
        return
    if style == "hood":
        return
    # base cap across the top of the head
    for y, (x0, x1) in zip(range(4, 9), ((5, 10), (4, 11), (3, 12), (3, 12), (3, 12))):
        cv.rect(x0, y + dy, x1, y + dy, h[2])
    cv.rect(5, 4 + dy, 8, 4 + dy, h[3]); cv.rect(5, 5 + dy, 6, 5 + dy, h[4])
    cv.rect(3, 8 + dy, 12, 8 + dy, h[1])
    if style == "spiky":
        for x, y in ((4, 3), (6, 2), (8, 2), (10, 3), (5, 3), (9, 3), (7, 3), (7, 2)):
            cv.set(x, y + dy, h[2])
        cv.set(6, 2 + dy, h[3]); cv.set(5, 3 + dy, h[3]); cv.set(10, 3 + dy, h[1])
        cv.set(11, 4 + dy, h[1]); cv.set(3, 5 + dy, h[1])
    if style == "bun":
        cv.disc(7.5, 3 + dy, 2, h[2]); cv.set(6, 2 + dy, h[3])


def head_front(look: Look, pal: Pal, back: bool = False) -> Canvas:
    cv = new()
    s = pal.skin
    # skull/face
    cv.ellipse(7.5, 9.5, 5.2, 5.7, s[2])
    cv.rect(10, 9, 12, 14, s[2])
    for y in range(4, 16):
        for x in range(2, 14):
            if cv.opaque(x, y) and (x >= 11 or y >= 13):
                cv.set(x, y, s[1])
    for y in range(4, 11):
        for x in range(2, 9):
            if cv.opaque(x, y) and (x <= 4 and y <= 10):
                cv.set(x, y, s[3])
    if look.hair_style == "hood":
        pass
    elif pal.hair:
        if back:
            cv.ellipse(7.5, 9.0, 5.4, 5.9, pal.hair[2])
            cv.rect(4, 4, 8, 6, pal.hair[3]); cv.rect(5, 4, 6, 5, pal.hair[4])
            cv.rect(9, 11, 12, 14, pal.hair[1]); cv.rect(4, 14, 11, 15, pal.hair[1])
            cv.rect(4, 14, 4, 14, pal.hair[2])
        else:
            hair_cap(cv, pal.hair, look.hair_style, "down")
            cv.set(5, 8, s[2]); cv.set(9, 8, s[2]); cv.set(10, 8, s[2])        # fringe gaps
            if look.hair_style == "long":
                cv.rect(3, 9, 4, 15, pal.hair[2]); cv.rect(11, 9, 12, 15, pal.hair[1])
                cv.rect(3, 9, 3, 14, pal.hair[3])
            else:
                cv.rect(3, 9, 3, 11, pal.hair[2]); cv.rect(12, 9, 12, 11, pal.hair[1])
    if not back:
        if look.shadow_face:
            cv.rect(4, 8, 11, 14, P.c15(2, 2, 6))
            cv.rect(5, 10, 6, 11, P.c15(31, 28, 4)); cv.rect(9, 10, 10, 11, P.c15(31, 28, 4))
        else:
            cv.rect(6, 10, 6, 11, EYE); cv.rect(9, 10, 9, 11, EYE)
            cv.set(6, 10, P.c15(9, 7, 12)); cv.set(9, 10, P.c15(9, 7, 12))
            cv.set(4, 12, P.c15(29, 15, 13)); cv.set(11, 12, P.c15(26, 12, 11))
            if not look.mask:
                cv.rect(7, 13, 8, 13, P.c15(20, 8, 8))
        if look.mask:
            cv.rect(4, 12, 11, 15, pal.gear[1] if look.gear == "headband" else shade_ramp(8, 8, 11)[1])
            cv.rect(4, 12, 4, 15, shade_ramp(8, 8, 11)[2])
        if look.beard:
            b = shade_ramp(*look.beard)
            cv.rect(4, 13, 11, 15, b[3]); cv.rect(6, 12, 9, 12, b[3])
            cv.rect(5, 15, 10, 16, b[2]); cv.rect(7, 16, 8, 17, b[2])
            cv.rect(11, 13, 11, 15, b[2]); cv.rect(7, 13, 8, 13, s[1])
    return cv


def head_side(look: Look, pal: Pal) -> Canvas:
    cv = new()
    s = pal.skin
    cv.ellipse(7.5, 9.5, 5.2, 5.7, s[2])
    cv.set(2, 11, s[2]); cv.set(2, 12, s[1])              # nose
    for y in range(4, 16):
        for x in range(2, 14):
            if cv.opaque(x, y) and (x >= 11 or y >= 14):
                cv.set(x, y, s[1])
    for y in range(4, 10):
        for x in range(2, 6):
            if cv.opaque(x, y):
                cv.set(x, y, s[3])
    if look.hair_style != "hood" and pal.hair and look.hair_style != "bald":
        h = pal.hair
        hair_cap(cv, h, look.hair_style, "left")
        # back-of-head hair mass
        cv.rect(8, 9, 12, 13 if look.hair_style != "long" else 16, h[2])
        cv.rect(11, 9, 12, 13 if look.hair_style != "long" else 16, h[1])
        cv.rect(5, 8, 6, 10, h[2])                       # sideburn
        cv.set(7, 11, h[1])
    elif look.hair_style == "bald":
        cv.rect(8, 4, 9, 5, s[3])
    if look.shadow_face:
        cv.rect(3, 9, 8, 14, P.c15(2, 2, 6)); cv.rect(3, 10, 4, 11, P.c15(31, 28, 4))
    else:
        cv.rect(4, 10, 4, 11, EYE); cv.set(4, 10, P.c15(9, 7, 12))
        cv.set(5, 12, P.c15(29, 15, 13)); cv.set(3, 13, P.c15(20, 8, 8))
    if look.mask:
        cv.rect(3, 12, 8, 15, shade_ramp(8, 8, 11)[1]); cv.rect(3, 12, 3, 15, shade_ramp(8, 8, 11)[2])
    if look.beard:
        b = shade_ramp(*look.beard)
        cv.rect(3, 13, 8, 16, b[3]); cv.rect(4, 16, 7, 17, b[2]); cv.rect(8, 14, 8, 16, b[2])
    return cv


# ───────────────────────────── headgear ─────────────────────────────

def gear(look: Look, pal: Pal, facing: str, dy: int = 0) -> Canvas:
    cv = new()
    g, g2 = pal.gear, pal.gear2
    kind = look.gear
    side = facing in ("left", "right")
    if kind in ("helm", "plume_helm"):
        cv.ellipse(7.5, 8.0, 5.5, 5.0, g[2])
        if facing == "down":
            cv.rect(2, 9, 13, 15, None)
        elif facing == "left":
            cv.rect(2, 9, 7, 15, None)
        cv.rect(2, 8, 13, 8, g[1])
        cv.rect(4, 3, 8, 4, g[3]); cv.rect(5, 3, 6, 3, g[4])
        if facing == "down":
            cv.rect(3, 9, 4, 12, g[2]); cv.rect(11, 9, 12, 12, g[1])
            cv.rect(3, 9, 3, 12, g[3])
            cv.rect(7, 4, 8, 8, g[3])
        elif facing == "up":
            cv.rect(2, 8, 13, 13, g[2]); cv.rect(2, 8, 13, 13, g[2]); cv.rect(10, 9, 13, 13, g[1])
        else:
            cv.rect(8, 9, 12, 13, g[2]); cv.rect(11, 9, 12, 13, g[1]); cv.rect(5, 8, 6, 11, g[3])
        if kind == "plume_helm":
            pl = g2
            px = 8 if not side else 9
            cv.rect(px - 1, 0, px, 4, pl[2]); cv.rect(px - 2, 1, px - 2, 3, pl[3]); cv.rect(px + 1, 1, px + 1, 3, pl[1])
            cv.set(px - 1, 0, pl[4])
    elif kind == "bandana":
        cv.rect(3, 6, 12, 7, g[2]); cv.rect(3, 6, 12, 6, g[3]); cv.rect(3, 7, 12, 7, g[1])
        kx = 13 if facing != "left" else 13
        cv.rect(12, 6, 14, 7, g[2]); cv.rect(13, 8, 14, 10, g[1]); cv.set(14, 11, g[1])
        if facing == "up":
            cv.rect(3, 6, 12, 7, g[2])
    elif kind == "headband":
        cv.rect(3, 6, 12, 7, g[2]); cv.rect(3, 6, 12, 6, g[3]); cv.rect(3, 7, 12, 7, g[1])
        cv.rect(12, 7, 13, 9, g[2]); cv.rect(13, 9, 14, 12, g[1])
        if look.mask:
            cv.rect(3, 6, 12, 7, g[2])
    elif kind == "hood":
        cv.ellipse(7.5, 8.5, 6.3, 6.6, g[2])
        cv.rect(1, 12, 14, 17, g[2])
        cv.ellipse(7.5, 10.5, 4.2, 4.3, None)
        if facing == "down":
            cv.rect(4, 9, 11, 14, None)
            cv.ellipse(7.5, 10.5, 4.2, 4.6, None)
            cv.rect(3, 15, 12, 16, g[2])
        elif facing == "up":
            cv.ellipse(7.5, 8.5, 6.3, 6.6, g[2]); cv.rect(1, 12, 14, 17, g[2])
        else:
            cv.rect(1, 12, 14, 17, g[2]); cv.rect(2, 9, 7, 14, None)
        # shading + trim
        for y in range(1, 18):
            for x in range(0, 16):
                if cv.opaque(x, y):
                    if x >= 11:
                        cv.set(x, y, g[1])
                    elif y <= 5 or x <= 3:
                        cv.set(x, y, g[3])
        cv.rect(4, 2, 7, 3, g[4])
        if facing == "down":
            for x in range(3, 13):
                cv.set(x, 8 if x not in (3, 12) else 9, look and pal.trim[2])
            cv.rect(2, 17, 13, 17, g[1])
    elif kind == "witch":
        cv.rect(0, 6, 15, 7, g[2]); cv.rect(1, 8, 14, 8, g[1])
        cv.rect(0, 6, 15, 6, g[3]); cv.rect(2, 5, 13, 5, g[2])
        for i in range(6):
            cv.rect(4 + i // 2, i, 11 - i // 2, i, g[2])
            cv.set(4 + i // 2, i, g[3]); cv.set(11 - i // 2, i, g[1])
        cv.rect(5, 4, 10, 4, pal.trim[2]); cv.rect(5, 4, 6, 4, pal.trim[3])
        cv.set(8, 0, g[3])
        if facing == "up":
            cv.rect(2, 9, 13, 10, g[1])
        if facing in ("left", "right"):
            cv.rect(0, 6, 15, 8, None)
            cv.rect(1, 6, 14, 7, g[2]); cv.rect(1, 6, 14, 6, g[3]); cv.rect(2, 8, 13, 8, g[1])
    elif kind == "feather":
        cv.rect(1, 6, 14, 7, g[2]); cv.rect(1, 6, 14, 6, g[3]); cv.rect(2, 8, 13, 8, g[1])
        cv.rect(4, 3, 11, 5, g[2]); cv.rect(4, 3, 7, 3, g[3]); cv.rect(10, 4, 11, 5, g[1])
        cv.rect(4, 5, 11, 5, pal.trim[2])
        fx = 11 if facing != "left" else 4
        for i, (dx, dyy) in enumerate(((0, 0), (1, -1), (2, -2), (2, -3), (3, -3))):
            xx = fx + dx if facing != "left" else fx - dx
            cv.set(xx, 3 + dyy, g2[3 if i % 2 else 4])
            cv.set(xx, 4 + dyy, g2[2])
    elif kind == "crown":
        cv.rect(4, 3, 11, 5, GOLD[2]); cv.rect(4, 3, 11, 3, GOLD[3])
        for x in (4, 7, 8, 11):
            cv.set(x, 2, GOLD[4])
        cv.set(7, 4, P.c15(28, 4, 6)); cv.set(8, 4, P.c15(28, 4, 6))
        cv.rect(4, 5, 11, 5, GOLD[1])
    elif kind == "round_hat":
        cv.ellipse(7.5, 5.5, 6.0, 3.0, g[2])
        cv.rect(3, 6, 12, 6, g[1])
        cv.rect(4, 3, 7, 4, g[3])
        cv.rect(3, 6, 12, 6, pal.trim[2])
    if dy:
        out = new()
        out.paste(cv, 0, dy)
        return out
    return cv


# ───────────────────────────── weapons ─────────────────────────────

def weapon_canvas(look: Look, pal: Pal, hand: tuple[int, int], vec: tuple[int, int]) -> Canvas:
    """Weapon for a LEFT-facing figure, gripped at `hand`, pointing along `vec` (dx, dy)."""
    cv = new()
    w = pal.weapon
    kind = look.weapon
    if kind is None:
        return cv
    wood = shade_ramp(14, 8, 4)
    metal = STEEL
    hx, hy = hand
    tx, ty = hx + vec[0], hy + vec[1]
    if kind in ("sword", "rapier"):
        blade = metal if kind == "sword" else shade_ramp(24, 24, 28)
        cv.line(hx, hy, tx, ty, blade[3])
        cv.line(hx + 1, hy, tx + 1, ty, blade[2])
        cv.set(tx, ty, blade[4])
        gx, gy = hx - (1 if vec[1] < -3 else 0), hy
        cv.rect(gx - 1, gy, gx + 2, gy, GOLD[2])
        cv.set(hx, hy + 1, wood[2])
    elif kind == "dagger":
        cv.line(hx, hy, hx + vec[0] // 2, hy + vec[1] // 2, metal[3])
        cv.rect(hx - 1, hy, hx + 1, hy, GOLD[2])
    elif kind in ("staff", "rod", "cane"):
        bx, by = hx - vec[0] // 3, hy - vec[1] // 3
        cv.line(bx, by, tx, ty, wood[2])
        cv.line(bx + 1, by, tx + 1, ty, wood[1])
        if kind != "cane":
            cv.disc(tx, ty - 1, 1.6, w[3]); cv.set(tx, ty - 1, w[4])
    elif kind == "spear":
        cv.line(hx, hy + 5, tx, ty, wood[2])
        cv.poly([(tx - 1.5, ty + 2), (tx + 1.5, ty + 2), (tx, ty - 3)], metal[3])
    return cv


def shield_canvas(look: Look, pal: Pal) -> Canvas:
    cv = new()
    c = pal.trim
    cv.ellipse(5.5, 21.5, 3.2, 4.2, STEEL[2])
    cv.ellipse(5.5, 21.5, 2.2, 3.2, c[2])
    cv.rect(5, 19, 6, 24, c[3]); cv.rect(3, 21, 8, 22, c[3])
    return cv


# ───────────────────────────── composition ─────────────────────────────

def compose_front(look: Look, pal: Pal, frame: int, back: bool) -> Canvas:
    cv = new()
    bob = -1 if frame else 0
    swing = {0: (0, 0), 1: (-1, 1), 2: (1, -1)}[frame]
    cv.paste(legs_front(look, pal, frame, back), 0, 0)
    if back and pal.cape:
        c = pal.cape
        cv.rect(4, 17 + bob, 11, 28, c[2]); cv.rect(4, 17 + bob, 4, 28, c[3]); cv.rect(11, 17 + bob, 11, 28, c[1])
    parts: list[tuple[Canvas, int]] = [
        (arm_front(look, pal, True, 5 + swing[0]), bob),
        (arm_front(look, pal, False, 5 + swing[1]), bob),
        (torso_front(look, pal, back), bob),
        (head_front(look, pal, back), bob),
    ]
    for part, dy in parts:
        cv.paste(part, 0, dy)
    if look.gear:
        cv.paste(gear(look, pal, "up" if back else "down"), 0, bob)
    cv.outline(OUTLINE)
    return cv


def compose_side(look: Look, pal: Pal, frame: int, pose: str | None = None) -> Canvas:
    """Facing left. pose: None (field), 'ready','attack','cast','hurt','down','victory'."""
    cv = new()
    bob = -1 if frame else 0
    arm_dx = {0: 0, 1: -2, 2: 2}[frame]
    ox = oy = 0
    arm_len = 6
    wp = None
    if pose == "ready":
        arm_dx, wp = -1, "ready"
    elif pose == "attack":
        arm_dx, wp, ox = -3, "swing", 3
        arm_len = 4
    elif pose == "cast":
        arm_dx, wp, arm_len = -1, "raised", 4
    elif pose == "hurt":
        ox, bob = 2, 0
    elif pose == "victory":
        wp, arm_len = "raised", 4
    legs = legs_side(look, pal, 0 if pose else frame)
    cv.paste(legs, ox // 2, oy)
    if pose == "down":
        return compose_kneel(look, pal)
    if pal.cape:
        c = pal.cape
        cv.rect(9, 17 + bob, 13, 27, c[1]); cv.rect(10, 17 + bob, 12, 27, c[2])
    cv.paste(torso_side(look, pal), ox, bob + oy)
    cv.paste(head_side(look, pal), ox + (1 if pose == "hurt" else 0), bob + oy)
    if look.gear:
        cv.paste(gear(look, pal, "left"), ox + (1 if pose == "hurt" else 0), bob + oy)
    if look.shield and pose in (None, "ready", "attack", "hurt"):
        cv.paste(shield_canvas(look, pal), ox + 1, bob + oy)
    arm = arm_side(look, pal, arm_dx, arm_len)
    if pose in ("cast", "victory"):
        arm = new()
        c = pal.skin if look.outfit == "gi" else pal.cloth
        cv_arm = arm
        cv_arm.rect(3, 12, 5, 19, c[2]); cv_arm.rect(3, 12, 3, 19, c[3])
        cv_arm.rect(3, 9, 4, 11, pal.skin[2]); cv_arm.set(3, 9, pal.skin[3])
    cv.paste(arm, ox, bob + oy)
    if wp and look.weapon:
        if wp == "ready":
            wc = weapon_canvas(look, pal, (6 + arm_dx, 22), (-2, -10))
        elif wp == "swing":
            wc = weapon_canvas(look, pal, (6 + arm_dx, 20), (-6, -2))
        else:
            wc = weapon_canvas(look, pal, (3, 10), (0, -8))
        cv.paste(wc, ox, bob + oy)
    if pose == "hurt":
        cv.rect(3, 10, 4, 10, EYE)
    cv.outline(OUTLINE)
    return cv


def compose_kneel(look: Look, pal: Pal) -> Canvas:
    cv = new()
    c = pal.cloth
    cv.rect(2, 28, 13, 30, pal.pants[1] if look.outfit not in ("robe", "dress") else c[1])      # folded legs
    cv.rect(2, 28, 13, 28, pal.pants[2] if look.outfit not in ("robe", "dress") else c[2])
    cv.rect(2, 30, 5, 30, pal.boots[2])
    cv.rect(5, 20, 11, 27, c[2]); cv.rect(5, 20, 5, 27, c[3]); cv.rect(11, 20, 11, 27, c[1])
    head = head_side(look, pal)
    cv.paste(head, -1, 10)
    if look.gear and look.gear != "witch":
        cv.paste(gear(look, pal, "left"), -1, 10)
    elif look.gear == "witch":
        cv.paste(gear(look, pal, "left"), -1, 10)
    cv.rect(3, 23, 7, 24, pal.skin[1])
    cv.rect(3, 22, 4, 23, pal.skin[2])
    cv.outline(OUTLINE)
    return cv


# ───────────────────────────── sheet assembly ─────────────────────────────

def build_block(look: Look) -> Image.Image:
    """Native-resolution 96x160 block for one character."""
    block = Image.new("RGBA", (CELL_W * BLOCK_COLS, CELL_H * BLOCK_ROWS), (0, 0, 0, 0))
    if look.prop == "chest":
        for col, open_ in enumerate((False, True)):
            block.paste(chest_cell(open_).img, (col * CELL_W, 0))
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


def chest_cell(open_: bool) -> Canvas:
    cv = new()
    wood, band = shade_ramp(18, 10, 5), GOLD
    cv.rect(2, 22, 13, 30, wood[2]); cv.rect(2, 22, 13, 22, wood[3]); cv.rect(2, 30, 13, 30, wood[1])
    cv.rect(2, 22, 2, 30, wood[3]); cv.rect(13, 22, 13, 30, wood[1])
    cv.rect(2, 26, 13, 26, band[2]); cv.rect(7, 25, 8, 28, band[3]); cv.set(7, 26, band[4])
    if open_:
        cv.rect(2, 15, 13, 21, wood[1]); cv.rect(3, 16, 12, 20, P.c15(3, 2, 4))
        cv.rect(4, 22, 11, 23, P.c15(31, 28, 10))
        cv.set(5, 22, WHITE); cv.set(9, 23, WHITE)
    else:
        cv.rect(2, 17, 13, 21, wood[2]); cv.rect(2, 17, 13, 17, wood[3]); cv.rect(2, 17, 2, 21, wood[3])
        cv.rect(13, 17, 13, 21, wood[1]); cv.rect(2, 19, 13, 19, band[2])
    cv.outline(OUTLINE)
    return cv


# ───────────────────────────── roster ─────────────────────────────

ROSTER: dict[str, Look] = {
    # Base classes
    "warrior": Look(hair=(14, 8, 4), hair_style="spiky", outfit="armor", cloth=(24, 5, 5), trim=(19, 21, 26),
                    pants=(8, 8, 12), boots=(11, 6, 4), weapon="sword", shield=True),
    "thief": Look(hair=(26, 21, 8), hair_style="short", outfit="tunic", cloth=(5, 17, 10), trim=(14, 8, 4),
                  pants=(10, 9, 6), boots=(12, 7, 4), gear="bandana", gear_color=(26, 5, 7), weapon="dagger"),
    "monk": Look(skin=SKIN_TAN, hair=(4, 3, 4), hair_style="short", outfit="gi", cloth=(28, 15, 3), trim=(31, 28, 22),
                 pants=(26, 13, 3), boots=(14, 9, 5), gear="headband", gear_color=(31, 31, 29)),
    "white_mage": Look(hair=(14, 8, 4), hair_style="short", outfit="robe", cloth=(29, 29, 30), trim=(26, 5, 6),
                       gear="hood", gear_color=(29, 29, 30), boots=(14, 9, 5), weapon="staff", weapon_color=(30, 26, 8)),
    "black_mage": Look(outfit="robe", cloth=(6, 6, 17), trim=(27, 22, 6), shadow_face=True, hair=None, hair_style="bald",
                       gear="witch", gear_color=(7, 7, 20), boots=(12, 7, 4), weapon="rod", weapon_color=(30, 26, 8)),
    "red_mage": Look(hair=(28, 24, 8), hair_style="short", outfit="coat", cloth=(24, 5, 8), trim=(30, 30, 28),
                     pants=(30, 30, 28), boots=(12, 7, 4), gear="feather", gear_color=(25, 5, 8), gear_color2=(31, 31, 31),
                     weapon="rapier"),
    # Upgraded classes
    "knight": Look(hair=(26, 22, 8), hair_style="short", outfit="armor", cloth=(18, 20, 27), trim=(27, 22, 6),
                   pants=(10, 12, 18), boots=(10, 11, 15), gear="plume_helm", gear_color=(18, 20, 27),
                   gear_color2=(28, 29, 31), weapon="sword", shield=True),
    "ninja": Look(hair=None, hair_style="bald", outfit="tunic", cloth=(7, 7, 11), trim=(25, 5, 6), pants=(6, 6, 10),
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
}
