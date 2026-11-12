"""Procedural SNES-style battle backdrops: native 480x270, saved at 4x (1920x1080)."""
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from art_helpers import Spr, tex_noise
from bg_helpers import HZ, H, W, Bg, cloud, lines_img, poly_mask, ridge, stripes
from snes_palette import c15

SCALE = 4
HERE = Path(__file__).resolve().parent
C = c15  # 5-bit -> RGB


def _r(*t):
    return [c15(*x) for x in t]


def bg_ids() -> list[str]:
    return list(_SCENES)


# ---------------------------------------------------------------- grassland
def grassland() -> Bg:
    b, rng = Bg(), random.Random("grassland")
    b.vgrad(0, HZ + 6, _r((4, 12, 27), (7, 17, 29), (11, 21, 30), (16, 25, 31), (21, 28, 31), (26, 30, 31)))
    b.glow(380, HZ - 10, 140, 60, C(31, 31, 28), 0.45)
    for cx, cy, w, h in ((70, 34, 90, 22), (210, 20, 70, 16), (330, 46, 110, 24), (430, 22, 60, 15), (150, 66, 60, 12), (260, 78, 70, 12)):
        cloud(b, cx, cy, w, h, rng, C(31, 31, 31), C(25, 28, 31), C(17, 22, 29))
    far = ridge(HZ - 22, [(9, 1.6), (5, 4.2), (2, 9)], "g-far")
    b.ridge_fill(far, HZ + 10, _r((10, 14, 24), (13, 18, 27), (17, 22, 29), (21, 26, 30), (26, 29, 31)), body=(2, 3))
    mid = ridge(HZ - 8, [(7, 1.2), (4, 3.3), (1.5, 8)], "g-mid")
    b.ridge_fill(mid, HZ + 18, _r((6, 15, 9), (8, 19, 11), (11, 23, 13), (15, 27, 15), (20, 30, 19)), body=(2, 1))
    near = ridge(HZ + 4, [(5, 0.9), (3, 2.7), (1.2, 7)], "g-near")
    b.ridge_fill(near, HZ + 30, _r((5, 11, 5), (7, 15, 6), (10, 20, 7), (14, 24, 9), (19, 28, 12)), body=(2, 1))
    sp = Spr(W, H)
    for _ in range(9):  # small round trees on the hills
        x = rng.randrange(200, 470)
        y = int(mid[x]) + rng.randrange(1, 4)
        r = rng.randrange(5, 8)
        sp.paint(sp.rect(x - 1, y - 4, x, y), _r((6, 3, 2), (11, 6, 3), (16, 10, 5), (21, 15, 8), (27, 21, 12)), cap=1)
        sp.paint(sp.ell(x, y - 5 - r * 0.6, r, r * 0.9), _r((2, 6, 5), (3, 10, 6), (5, 15, 7), (9, 20, 8), (14, 25, 10)), cap=3)
    b.layer(sp)
    g = _r((5, 11, 5), (7, 15, 6), (10, 20, 7), (14, 24, 9), (19, 28, 12))
    stripes(b, HZ + 22, HZ - 36, 90.0, g[2], g[3])
    # tufts and flowers: dense at the edges, calm lower-middle
    for _ in range(420):
        x, y = rng.randrange(W), rng.randrange(HZ + 24, H)
        if 110 < x < 330 and y > 185:
            continue
        s = 1 + (y - HZ) // 50
        b.a[y, x:x + s + 1] = g[4]
        b.a[y + 1: y + 1 + s, x] = g[1]
    for _ in range(26):
        x, y = rng.randrange(W), rng.randrange(HZ + 30, H - 4)
        if 90 < x < 340 and y > 170:
            continue
        col = rng.choice([C(31, 29, 26), C(31, 24, 4), C(30, 12, 14)])
        b.a[y, x] = col
        b.a[y - 1: y + 2, x] = col if rng.random() < 0.3 else b.a[y, x]
        b.a[y + 1, x] = g[0]
    for x0 in (60, 90, 360):
        y0 = rng.randrange(18, 60)
        b.a[y0, x0 - 2] = b.a[y0 + 1, x0 - 1] = b.a[y0, x0] = b.a[y0 + 1, x0 + 1] = b.a[y0, x0 + 2] = C(5, 8, 14)
    return b


# ------------------------------------------------------------------- forest
def forest() -> Bg:
    b, rng = Bg(), random.Random("forest")
    b.vgrad(0, HZ + 24, _r((1, 3, 3), (1, 5, 4), (2, 8, 5), (3, 11, 6), (5, 14, 8), (8, 18, 10)))
    # distant trunks (low contrast)
    for x in range(-6, W, 22):
        x += rng.randrange(-5, 6)
        w = rng.randrange(4, 12)
        m = (b.xs >= x) & (b.xs < x + w) & (b.ys < HZ + 24)
        b.paint(m, C(2, 7, 5))
        b.paint(m & (b.xs < x + 2), C(4, 11, 7))
        b.paint(m & (b.xs >= x + w - 2), C(1, 4, 3))
    b.glow(250, HZ + 6, 240, 50, C(12, 24, 12), 0.45)
    # canopy
    sp = Spr(W, H)
    lf = _r((2, 6, 5), (3, 10, 6), (5, 15, 7), (9, 20, 8), (14, 25, 10))
    for _ in range(80):
        x = rng.randrange(-10, W + 10)
        y = rng.randrange(-6, 34) + (14 if 100 < x < 340 else 0) * rng.random()
        r = rng.randrange(8, 17)
        sp.paint(sp.ell(x, y, r, r * 0.8), lf, cap=4, bias=-0.2)
    for x in range(0, W, 38):
        y = rng.randrange(36, 60)
        sp.paint(sp.ell(x + rng.randrange(8), y, rng.randrange(8, 13), 8), lf, cap=3, bias=-0.5)
    b.layer(sp)
    # light shafts
    for x0, w, k in ((90, 26, 0.35), (190, 18, 0.3), (290, 30, 0.38), (400, 20, 0.3)):
        m = poly_mask([(x0, 0), (x0 + w, 0), (x0 + w + 110, HZ + 90), (x0 + 110, HZ + 90)])
        fade = np.clip(1 - b.ys / (HZ + 90), 0, 1) * 0.5 + 0.12
        b.mix(np.where(m, fade * k * 1.4, 0), C(31, 31, 18), levels=5)
    # foreground trunks at the edges
    tr = _r((3, 2, 2), (6, 4, 3), (10, 7, 4), (14, 10, 6), (19, 14, 8))
    sp = Spr(W, H)
    for x, w in ((-6, 36), (436, 60), (330, 14)):
        top = 0
        sp.paint(sp.rect(x, top, x + w, HZ + 40), tr, cap=7, tex=tex_noise(sp, rng, 0.35), mid=0.5)
    sp.paint(sp.poly([(-8, HZ + 40), (30, HZ + 40), (46, HZ + 56), (20, HZ + 46), (-8, HZ + 54)]), tr, cap=3)
    sp.paint(sp.poly([(436, HZ + 40), (496, HZ + 40), (500, HZ + 54), (470, HZ + 46), (428, HZ + 58)]), tr, cap=3)
    b.layer(sp)
    # forest floor
    fl = _r((4, 3, 2), (6, 6, 3), (8, 10, 4), (11, 14, 6), (15, 18, 8))
    stripes(b, HZ + 22, HZ - 30, 80.0, fl[2], fl[3])
    for _ in range(300):
        x, y = rng.randrange(W), rng.randrange(HZ + 24, H)
        if 100 < x < 340 and y > 180:
            continue
        b.a[y, x:x + 2] = rng.choice([fl[4], fl[1], C(14, 12, 4), C(8, 14, 6)])
    b.mix(np.clip(1 - np.abs(b.ys - (HZ + 20)) / 18, 0, 1) * 0.6, C(14, 24, 14))
    return b


# ------------------------------------------------------------------- desert
def desert() -> Bg:
    b, rng = Bg(), random.Random("desert")
    b.vgrad(0, HZ + 6, _r((7, 14, 27), (11, 19, 29), (17, 23, 30), (24, 26, 28), (30, 27, 22), (31, 26, 15)))
    b.glow(380, 50, 70, 70, C(31, 30, 24), 0.7, 5)
    sun = (b.xs - 380) ** 2 + (b.ys - 50) ** 2 <= 15 ** 2
    b.paint(sun, C(31, 31, 29))
    b.paint(sun & (b.ys - 50 + b.xs - 380 > 6), C(31, 29, 22))
    cl = random.Random("dc")
    for cx, cy, w, h in ((90, 40, 100, 10), (230, 62, 90, 8)):
        cloud(b, cx, cy, w, h, cl, C(31, 31, 29), C(30, 27, 24), C(26, 22, 22))
    # mesas
    mes = ridge(HZ - 18, [(3, 2), (2, 6)], "d-mesa")
    mes = np.where((np.arange(W) > 40) & (np.arange(W) < 150), HZ - 38, mes)
    mes = np.where((np.arange(W) > 330) & (np.arange(W) < 420), HZ - 28, mes)
    b.ridge_fill(mes, HZ + 4, _r((14, 8, 8), (19, 11, 9), (23, 15, 12), (27, 19, 14), (30, 24, 18)), body=(2, 3))
    b.mix(np.clip(1 - np.abs(b.ys - (HZ - 4)) / 14, 0, 1) * 0.5, C(31, 27, 18))

    b.a[HZ + 4:] = np.array(C(29, 26, 17), float)

    def dune(base, comps, seed, bottom, lit, shade):
        r = ridge(base, comps, seed)
        slope = np.convolve(np.gradient(r.astype(float)), np.ones(31) / 31, 'same')
        d = b.ys - r[b.xs]
        sl = slope[b.xs]
        m = (d >= 0) & (b.ys < bottom)
        b.paint(m, lit[1])
        reach = 22 * np.clip(sl * 4.5, 0, 1) ** 1.5
        reach = np.where(reach < 4, 0, reach)
        b.paint(m & (d < reach), shade[1])
        b.paint(m & (d < reach * 0.6), shade[0])
        b.paint(m & (d < reach) & (d >= reach * 0.6) & (b.bay > 0.5), shade[0])
        b.paint(m & (d < 2), lit[2])
        b.paint(m & (d >= 2) & (d < 6) & (reach < 1) & (b.bay > 0.55), lit[2])

    sand = _r((19, 14, 8), (23, 18, 10), (27, 23, 13), (29, 26, 17), (31, 29, 22))
    dune(HZ + 4, [(9, 1.2), (4, 2.6)], "d1", HZ + 40, (sand[2], sand[3], sand[4]), (sand[0], sand[1]))
    dune(HZ + 20, [(12, 0.9), (5, 2.2)], "d2", HZ + 60, (sand[2], sand[3], sand[4]), (sand[0], sand[1]))
    # open sand foreground with perspective ripples
    near = ridge(HZ + 52, [(3, 0.8), (2, 2.0)], "d3")
    r = near[b.xs]
    m = b.ys >= r
    b.paint(m, sand[3])
    b.paint(m & (b.ys - r < 1), sand[4])
    z = 240.0 / np.maximum(b.ys - (HZ - 14), 1) + np.sin(b.xs / 19.0) * 0.05
    fz = z - np.floor(z)
    b.paint(m & (fz < 0.1) & (b.ys > r + 4), sand[2])
    b.paint(m & (fz > 0.1) & (fz < 0.18) & (b.ys > r + 4) & (b.bay > 0.5), sand[4])
    for _ in range(260):
        x, y = rng.randrange(W), rng.randrange(HZ + 40, H)
        if 110 < x < 340 and y > 185:
            continue
        b.a[y, x] = sand[2] if rng.random() < 0.6 else sand[4]
    # props: cactus, bones, rocks (edges only)
    sp = Spr(W, H)
    cg = _r((2, 6, 4), (4, 11, 6), (7, 16, 8), (11, 21, 10), (16, 25, 13))
    sp.paint(sp.tube([(432, HZ + 36, 4), (432, HZ - 4, 3.6)]), cg, cap=3)
    sp.paint(sp.tube([(432, HZ + 14, 2.2), (424, HZ + 12, 2.2), (423, HZ + 2, 2.2)]), cg, cap=2)
    sp.paint(sp.tube([(432, HZ + 8, 2.2), (441, HZ + 6, 2.2), (442, HZ - 6, 2.2)]), cg, cap=2)
    for yy in range(HZ - 2, HZ + 34, 5):
        sp.px(431, yy, cg[0])
    b.layer(sp)
    sp = Spr(W, H)
    bone = _r((10, 7, 6), (16, 13, 11), (22, 20, 16), (27, 25, 20), (31, 30, 26))
    sp.paint(sp.ell(40, HZ + 56, 9, 6), bone, cap=3)
    sp.flat(sp.rect(36, HZ + 54, 38, HZ + 57), C(3, 3, 4))
    sp.flat(sp.rect(42, HZ + 54, 44, HZ + 57), C(3, 3, 4))
    sp.paint(sp.tube([(52, HZ + 62, 2), (70, HZ + 58, 1.6)]), bone, cap=2)
    sp.paint(sp.poly([(450, HZ + 70), (458, HZ + 56), (472, HZ + 58), (480, HZ + 72)]), _r((8, 5, 4), (12, 8, 6), (17, 12, 9), (22, 16, 12), (27, 21, 16)), cap=4)
    b.layer(sp)
    b.mix(np.clip(1 - np.abs(b.ys - (HZ + 2)) / 10, 0, 1) * 0.45, C(31, 28, 20))
    return b


def _dead_tree(d, x, y, ang, ln, wd, dep, rng, col, hi):
    x2, y2 = x + math.sin(ang) * ln, y - math.cos(ang) * ln
    d.line([(x, y), (x2, y2)], fill=col, width=max(1, int(wd)))
    if wd >= 3:
        d.line([(x - 1, y), (x2 - 1, y2)], fill=hi, width=1)
    if dep > 0:
        for s in (-1, 1):
            if rng.random() < 0.9:
                _dead_tree(d, x2, y2, ang + s * rng.uniform(0.35, 0.8), ln * rng.uniform(0.62, 0.8), wd * 0.68, dep - 1, rng, col, hi)


# ------------------------------------------------------------------- swamp
def swamp() -> Bg:
    b, rng = Bg(), random.Random("swamp")
    b.vgrad(0, HZ + 8, _r((2, 6, 6), (4, 9, 8), (6, 13, 10), (9, 17, 12), (12, 20, 14), (15, 23, 16)))
    for y0, a in ((30, 0.18), (58, 0.22), (88, 0.3), (HZ - 6, 0.5)):
        b.glow(240, y0, 300, 16, C(17, 25, 18), a)
    far = ridge(HZ - 8, [(3, 2.4), (2, 7), (1.5, 15)], "s-far")
    b.ridge_fill(far, HZ + 6, _r((2, 6, 5), (3, 8, 7), (4, 10, 8), (6, 13, 10), (8, 16, 12)), body=(1, 1), rim=False)
    rng2 = random.Random("sd")

    def far_trees(d):
        for x in (60, 150, 250, 330, 405, 455):
            _dead_tree(d, x, HZ - 6, rng2.uniform(-0.15, 0.15), rng2.randrange(26, 44), 2, 3, rng2, C(3, 7, 7), C(5, 10, 9))
    b.pil_layer(lines_img(far_trees))
    b.glow(240, HZ - 2, 260, 22, C(16, 24, 17), 0.55)
    # mud ground and pools
    mud = _r((3, 6, 4), (5, 9, 6), (7, 12, 7), (9, 15, 9), (12, 18, 11))
    stripes(b, HZ + 6, HZ - 30, 70.0, mud[1], mud[2])
    wt = _r((3, 7, 9), (4, 10, 12), (6, 14, 16), (9, 18, 19), (13, 22, 22))
    for cx, cy, rx, ry in ((70, HZ + 22, 60, 7), (390, HZ + 30, 80, 10), (255, HZ + 12, 38, 3), (130, HZ + 74, 70, 12), (440, HZ + 90, 60, 14)):
        pool = ((b.xs - cx) / rx) ** 2 + ((b.ys - cy) / ry) ** 2 <= 1
        b.paint(pool, wt[1])
        b.paint(pool & ((b.ys - cy) < -ry * 0.3), wt[0])
        b.paint(pool & ((b.ys - cy) > ry * 0.2) & (b.bay > 0.5), wt[2])
        edge = pool & ~(((b.xs - cx) / (rx - 2)) ** 2 + ((b.ys - cy) / max(ry - 1.5, 1)) ** 2 <= 1)
        b.paint(edge & (b.ys < cy), mud[4])
        for i in range(4):
            yy = int(cy - ry * 0.4 + i * ry * 0.35)
            b.paint(pool & (b.ys == yy) & (((b.xs * 7 + i * 31) % 29) < 6), wt[4])
    for _ in range(220):
        x, y = rng.randrange(W), rng.randrange(HZ + 8, H)
        if 100 < x < 340 and y > 185:
            continue
        b.a[y, x:x + 2] = rng.choice([mud[0], mud[3], mud[4]])
    # foreground dead trees and reeds at the edges
    def fg(d):
        _dead_tree(d, 22, HZ + 70, 0.05, 90, 11, 5, random.Random("fg1"), C(5, 3, 3), C(10, 7, 6))
        _dead_tree(d, 462, HZ + 86, -0.06, 120, 14, 5, random.Random("fg2"), C(5, 3, 3), C(10, 7, 6))
        _dead_tree(d, 330, HZ + 8, 0.1, 40, 4, 3, random.Random("fg3"), C(4, 3, 3), C(8, 6, 5))
    b.pil_layer(lines_img(fg))
    sp = Spr(W, H)
    for x0 in (8, 30, 52, 410, 436, 462, 300, 318):
        for k in range(4):
            xx = x0 + k * 3
            top = HZ + 40 + rng.randrange(-14, 6) if x0 not in (300, 318) else HZ + 6 - rng.randrange(0, 5)
            sp.paint(sp.stroke([(xx, top + 70), (xx + rng.randrange(-2, 3), top)], 1), _r((2, 7, 4), (4, 11, 6), (6, 15, 8), (9, 19, 10), (13, 23, 12)), cap=1, bias=rng.uniform(-.3, .8))
    b.layer(sp)
    for _ in range(14):
        x, y = rng.randrange(W), rng.randrange(20, HZ + 10)
        b.a[y, x] = C(20, 31, 14)
        b.glow(x, y, 6, 5, C(14, 26, 10), 0.45, 3)
    b.mix(np.clip(1 - np.abs(b.ys - (HZ + 10)) / 16, 0, 1) * 0.35, C(16, 24, 17))
    return b


# ------------------------------------------------------------------- ocean
def ocean() -> Bg:
    b, rng = Bg(), random.Random("ocean")
    b.vgrad(0, HZ + 1, _r((4, 8, 22), (7, 12, 25), (11, 15, 27), (17, 18, 27), (24, 21, 25), (30, 25, 20), (31, 29, 17)))
    b.glow(330, HZ, 90, 40, C(31, 30, 22), 0.8, 5)
    sun = (b.xs - 330) ** 2 + (b.ys - HZ) ** 2 <= 17 ** 2
    b.paint(sun & (b.ys <= HZ), C(31, 31, 26))
    cl = random.Random("oc")
    for cx, cy, w, h in ((80, 30, 120, 12), (260, 50, 140, 10), (420, 24, 90, 9), (150, 80, 100, 7), (40, 96, 60, 5)):
        cloud(b, cx, cy, w, h, cl, C(31, 27, 27), C(24, 20, 26), C(15, 13, 23))
    # distant island and sails
    isl = np.where((np.arange(W) > 40) & (np.arange(W) < 150), HZ - np.rint(14 * np.abs(np.sin((np.arange(W) - 40) / 110 * math.pi)) ** 0.8).astype(int), HZ)
    b.ridge_fill(isl, HZ + 1, _r((6, 8, 14), (8, 10, 16), (10, 12, 18), (13, 14, 20), (16, 17, 22)), body=(1, 1), rim=False)
    for sx, sh in ((215, 9), (232, 7)):
        b.paint(poly_mask([(sx, HZ - sh), (sx + 5, HZ - 1), (sx, HZ - 1)]), C(30, 28, 26))
    # sea
    sea = _r((2, 7, 16), (3, 10, 20), (5, 14, 24), (8, 18, 27), (14, 24, 30))
    sea_bot = 152
    b.vgrad(HZ + 1, sea_bot, [sea[3], sea[2], sea[1], sea[0]])
    z = 60.0 / np.maximum(b.ys - (HZ - 8), 1) + np.sin(b.xs / 31.0) * 0.25
    fz = z - np.floor(z)
    m = (b.ys > HZ) & (b.ys < sea_bot)
    b.paint(m & (fz < 0.14) & (((b.xs * 3 + (np.floor(z) * 37).astype(int)) % 17) < 9), sea[4])
    b.paint(m & (fz > 0.14) & (fz < 0.24) & (b.bay > 0.5), sea[0])
    col = np.clip(1 - np.abs(b.xs - 330) / np.maximum(6 + (b.ys - HZ) * 1.2, 1), 0, 1) * ((b.ys > HZ) & (b.ys < sea_bot))
    glit = (col > 0.35) & (b.bay < col * 0.8) & (fz < 0.3)
    b.paint(glit, C(31, 30, 22))
    # bulwark rail
    wd = _r((5, 3, 2), (9, 5, 3), (14, 9, 5), (19, 13, 7), (25, 18, 10))
    b.paint((b.ys >= sea_bot) & (b.ys < sea_bot + 5), wd[3])
    b.paint((b.ys >= sea_bot) & (b.ys < sea_bot + 1), wd[4])
    b.paint((b.ys >= sea_bot + 3) & (b.ys < sea_bot + 5), wd[2])
    b.paint((b.ys >= sea_bot + 5) & (b.ys < sea_bot + 8), wd[0])
    for x in range(10, W, 46):
        b.paint((b.xs >= x) & (b.xs < x + 5) & (b.ys > sea_bot - 8) & (b.ys < sea_bot + 5), wd[2])
        b.paint((b.xs == x) & (b.ys > sea_bot - 8) & (b.ys < sea_bot + 5), wd[4])
    # deck planks converging to the vanishing point
    vpx, vpy = 240.0, HZ - 10
    dk = _r((6, 4, 2), (10, 6, 3), (15, 10, 5), (20, 14, 8), (25, 19, 11))
    m = b.ys >= sea_bot + 8
    u = (b.xs - vpx) / np.maximum(b.ys - vpy, 1) * 11
    pl = np.floor(u).astype(int)
    pr = np.array([random.Random(i).random() for i in range(-40, 41)])
    shade = pr[np.clip(pl + 40, 0, 80)]
    idx = np.where(shade < 0.35, 1, np.where(shade < 0.75, 2, 3))
    lut = np.array(dk, float)
    b.a[m] = lut[idx][m]
    seam = (u - np.floor(u)) < (0.04 + (b.ys - vpy) / 2500)
    b.paint(m & seam, dk[0])
    # butt joints
    jt = np.floor(260.0 / np.maximum(b.ys - vpy, 1) * 1.0 + (pl % 3) * 0.37)
    jn = (260.0 / np.maximum(b.ys - vpy, 1) * 1.0 + (pl % 3) * 0.37) - jt
    b.paint(m & (jn < 0.03) & (b.ys > sea_bot + 14), dk[1])
    b.mix(np.where(m, np.clip((b.ys - sea_bot) / 110.0, 0, 1) * 0.0, 0), dk[0])
    # mast and rigging on the right
    wsp = Spr(W, H)
    wsp.paint(wsp.rect(414, 0, 428, sea_bot + 40), _r((4, 2, 2), (8, 5, 3), (13, 8, 5), (18, 12, 7), (23, 17, 10)), cap=7, mid=0.5)
    wsp.paint(wsp.rect(380, 30, 470, 34), _r((4, 2, 2), (8, 5, 3), (13, 8, 5), (18, 12, 7), (23, 17, 10)), cap=2)
    wsp.paint(wsp.poly([(384, 34), (466, 34), (462, 60), (440, 54), (420, 62), (400, 55), (388, 58)]), _r((14, 12, 10), (19, 17, 14), (24, 22, 19), (28, 26, 23), (31, 30, 27)), cap=5, tex=tex_noise(wsp, rng, 0.2))
    b.layer(wsp)
    def rig(d):
        for x2 in (300, 340, 380):
            d.line([(421, 36), (x2, sea_bot + 2)], fill=C(5, 3, 2), width=1)
    b.pil_layer(lines_img(rig))
    # coiled rope / crates hint at lower-right corner
    sp = Spr(W, H)
    sp.paint(sp.rect(440, 228, 478, 266), dk, cap=3, bias=0.4, tex=tex_noise(sp, rng, 0.3))
    sp.flat(sp.rect(440, 238, 478, 239), dk[0])
    sp.flat(sp.rect(458, 228, 459, 266), dk[0])
    b.layer(sp)
    return b


# -------------------------------------------------------------------- cave
def cave() -> Bg:
    b, rng = Bg(), random.Random("cave")
    rk = _r((1, 1, 3), (3, 2, 5), (5, 4, 8), (8, 7, 11), (12, 10, 15))
    b.vgrad(0, H, [rk[1], rk[0], rk[1], rk[2], rk[1]], width=0.5)
    # rocky back wall: lumpy blobs
    for _ in range(160):
        x, y = rng.randrange(W), rng.randrange(0, HZ + 6)
        rx, ry = rng.randrange(8, 26), rng.randrange(6, 16)
        m = ((b.xs - x) / rx) ** 2 + ((b.ys - y) / ry) ** 2 <= 1
        b.paint(m, rk[rng.choice([0, 1, 1, 2])])
        b.paint(m & ((b.xs - x) * 0.7 + (b.ys - y) < -ry * 0.4) & (b.bay > 0.45), rk[2])
    # lava glow far back at the opening
    b.glow(335, HZ - 6, 150, 60, C(31, 14, 3), 0.75, 5)
    lv = (b.ys >= HZ - 3) & (b.ys <= HZ + 3) & (b.xs > 255) & (b.xs < 420)
    b.paint(lv, C(31, 17, 3))
    b.paint(lv & (b.ys == HZ - 3), C(31, 28, 8))
    b.paint(lv & (b.bay > 0.6), C(29, 10, 2))
    # wall silhouettes framing the opening
    fr = ridge(HZ - 30, [(14, 1.4), (6, 3.7)], "c-fr")
    fr = np.where((np.arange(W) > 250) & (np.arange(W) < 430), HZ - 6 - np.rint(10 * np.sin((np.arange(W) - 250) / 180 * math.pi)).astype(int), fr)
    b.ridge_fill(fr, HZ + 8, rk, body=(1, 0))
    b.mix(np.clip(1 - np.abs(b.ys - (HZ - 6)) / 10, 0, 1) * np.clip((b.xs - 230) / 60, 0, 1) * 0.0, C(31, 16, 4))
    # stalactites
    sp = Spr(W, H)
    for _ in range(22):
        x = rng.randrange(-5, W + 5)
        w = rng.randrange(8, 22)
        hgt = rng.randrange(22, 70) if not (60 < x < 220) else rng.randrange(14, 36)
        sp.paint(sp.poly([(x - w / 2, -2), (x + w / 2, -2), (x + rng.uniform(-3, 3), hgt)]), rk, cap=5, bias=0.0)
    b.layer(sp)
    # glowing crystals (upper right/left)
    sp = Spr(W, H)
    cr = _r((3, 3, 14), (6, 8, 22), (10, 15, 28), (16, 22, 31), (24, 28, 31))
    cp = _r((8, 2, 12), (13, 4, 19), (18, 8, 25), (23, 14, 29), (28, 21, 31))
    for (x, y, h, r_, ramp_) in ((404, 70, 26, 5, cr), (418, 78, 18, 4, cr), (392, 80, 14, 3, cr), (44, 44, 24, 5, cp), (58, 52, 16, 4, cp), (452, 40, 18, 4, cp)):
        sp.paint(sp.poly([(x - r_, y + h * 0.4), (x - r_ * 0.4, y - h * 0.6), (x + r_ * 0.2, y - h * 0.9), (x + r_, y - h * 0.4), (x + r_, y + h * 0.4)]), ramp_, cap=3, bias=0.5, gain=1.3)
        b.glow(x, y - h * 0.2, 30, 30, ramp_[4], 0.55, 4)
    b.layer(sp)
    # floor
    fl = _r((2, 2, 4), (5, 4, 8), (8, 6, 12), (11, 9, 15), (15, 12, 19))
    stripes(b, HZ + 6, HZ - 34, 75.0, fl[2], fl[3])
    b.glow(340, HZ + 12, 230, 70, C(28, 12, 3), 0.55, 5)
    for _ in range(80):  # cracks
        x, y = rng.randrange(W), rng.randrange(HZ + 14, H)
        if 100 < x < 340 and y > 185:
            continue
        ln = rng.randrange(3, 9)
        b.a[y, x:x + ln] = fl[0]
        b.a[y + 1, x + ln: x + ln + 3] = fl[0]
    sp = Spr(W, H)
    for x in (10, 44, 436, 466, 410):  # stalagmites at the edges
        h = rng.randrange(30, 60)
        sp.paint(sp.poly([(x - 12, H), (x + rng.uniform(-3, 3), H - h), (x + 12, H)]), rk, cap=6, bias=0.2)
    b.layer(sp)
    return b


# ------------------------------------------------------------------ temple
def temple() -> Bg:
    b, rng = Bg(), random.Random("temple")
    st = _r((2, 2, 5), (4, 4, 9), (7, 7, 13), (10, 10, 17), (15, 14, 22))
    b.vgrad(0, HZ + 4, [st[0], st[1], st[1], st[2]])
    # back wall bricks
    wall = (b.ys > 26) & (b.ys < HZ + 4)
    bk = np.zeros((H, W))
    row = b.ys // 9
    u = (b.xs + (row % 2) * 10) % 20
    bk[(b.ys % 9) == 8] = -0.8
    bk[u == 19] = -0.8
    bk[((b.ys % 9) == 0) & (u != 19)] = 0.5
    idx = np.clip(np.rint(1.4 + bk + (np.array([[random.Random(int(r) * 97 + int(c)).random() for c in range(40)] for r in range(32)])[np.clip(row, 0, 31), np.clip((b.xs + (row % 2) * 10) // 20, 0, 39)] - 0.5) * 1.2), 0, 4).astype(int)
    b.a[wall] = np.array(st, float)[idx][wall]
    # ceiling and beams
    ceil = b.ys <= 26
    b.paint(ceil, st[0])
    for x in range(0, W, 60):
        b.paint(ceil & (b.xs >= x) & (b.xs < x + 10), st[1])
    b.paint((b.ys >= 24) & (b.ys <= 28), st[1])
    b.paint(b.ys == 28, st[3])
    # central dark archway with evil glow
    arch = (np.abs(b.xs - 240) <= 34) & (b.ys >= 52) & (b.ys < HZ + 4)
    arch |= (((b.xs - 240) / 34.0) ** 2 + ((b.ys - 52) / 26.0) ** 2 <= 1) & (b.ys < 52)
    b.paint(arch, C(1, 0, 3))
    b.mix(np.where(arch, np.clip(1 - np.abs(b.xs - 240) / 36.0, 0, 1) * 0.6, 0), C(14, 4, 22), 5)
    # floor: perspective checker tiles
    vpy = HZ - 20
    zd = 700.0 / np.maximum(b.ys - vpy, 1)
    xw = (b.xs - 240) * zd / 150.0
    tile = (np.floor(xw / 1.0).astype(int) + np.floor(zd / 1.0).astype(int)) % 2
    fl = _r((2, 2, 5), (4, 4, 9), (6, 6, 12), (9, 9, 16), (13, 12, 20))
    fm = b.ys >= HZ + 4
    b.a[fm] = np.array([fl[1], fl[2]], float)[tile][fm]
    carpet = np.abs(xw) < 1.6
    cp = _r((6, 1, 3), (9, 2, 4), (13, 3, 6))
    b.a[fm & carpet] = np.array([cp[0], cp[1]], float)[tile][fm & carpet]
    b.paint(fm & (np.abs(np.abs(xw) - 1.6) < 0.07), C(22, 16, 4))
    b.paint(fm & (b.ys < HZ + 7), st[3])
    # pillars
    def pillar(cx, w, top, bot, bw):
        sp = Spr(W, H)
        lit = st[4]
        x0, x1 = int(cx - w / 2), int(cx + w / 2)
        sp.paint(sp.rect(x0, top, x1, bot), _r((1, 1, 4), (3, 3, 8), (6, 6, 12), (10, 10, 17), (16, 15, 23)), cap=max(3, w // 2), mid=0.5, gain=1.2)
        sp.paint(sp.rect(x0 - 3, top, x1 + 3, top + 7), st, cap=3, bias=0.2, sep=True)
        sp.paint(sp.rect(x0 - 3, bot - 7, x1 + 3, bot), st, cap=3, bias=0.0, sep=True)
        for yy in range(top + 14, bot - 10, 14):
            sp.flat(sp.rect(x0, yy, x1, yy), st[0])
        b.layer(sp)
    pillar(300, 11, 28, HZ + 6, 0)
    pillar(180, 11, 28, HZ + 6, 0)
    pillar(372, 22, 14, HZ + 22, 0)
    pillar(108, 22, 14, HZ + 22, 0)
    pillar(448, 40, 0, HZ + 58, 0)
    pillar(30, 40, 0, HZ + 58, 0)
    # torches on mid pillars
    for tx, ty in ((372, 66), (108, 66), (300, 54), (180, 54), (448, 84), (30, 84)):
        big = 5 if tx in (448, 30) else (3 if tx in (372, 108) else 2)
        b.glow(tx + (-1 if tx < 240 else 1) * 14, ty, 70 if big > 2 else 44, 60 if big > 2 else 38, C(31, 18, 4), 0.55, 5)
        bx = tx + (14 if tx < 240 else -14) if big < 5 else tx + (22 if tx < 240 else -22)
        sx = bx
        b.paint((b.xs >= sx - 1) & (b.xs <= sx + 1) & (b.ys >= ty) & (b.ys <= ty + big * 3), C(9, 5, 2))
        fl_ = poly_mask([(sx - big, ty), (sx - big * 0.4, ty - big * 2.6), (sx + big * 0.1, ty - big * 3.2), (sx + big * 0.9, ty - big * 1.5), (sx + big, ty)])
        b.paint(fl_, C(31, 14, 3))
        b.paint(fl_ & (np.abs(b.xs - sx) <= big * 0.55) & (b.ys > ty - big * 2.2), C(31, 24, 6))
        b.paint(fl_ & (np.abs(b.xs - sx) <= big * 0.25) & (b.ys > ty - big * 1.2), C(31, 30, 18))
    b.mix(np.clip(1 - np.abs(b.ys - (HZ + 6)) / 14, 0, 1) * 0.3, C(14, 8, 18))
    return b


_SCENES = {"grassland": grassland, "forest": forest, "desert": desert, "swamp": swamp, "ocean": ocean, "cave": cave, "temple": temple}


def build(out_root: Path) -> None:
    out = Path(out_root) / "backgrounds"
    out.mkdir(parents=True, exist_ok=True)
    prev = HERE / "preview"
    prev.mkdir(exist_ok=True)
    imgs = {}
    for bid, fn in _SCENES.items():
        img = fn().finish()
        img.resize((W * SCALE, H * SCALE), Image.NEAREST).save(out / f"{bid}.png")
        imgs[bid] = img
    cols = 3
    rows = (len(imgs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (W + 8) + 8, rows * (H + 8) + 8), (20, 20, 24))
    d = ImageDraw.Draw(sheet)
    for i, (bid, im) in enumerate(imgs.items()):
        x, y = 8 + (i % cols) * (W + 8), 8 + (i // cols) * (H + 8)
        sheet.paste(im, (x, y))
        d.text((x + 4, y + 4), bid, fill=(255, 255, 255))
    sheet.save(prev / "backgrounds-contact.png")
