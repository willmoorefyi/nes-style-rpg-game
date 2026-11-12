"""Large (64x64) monsters: ogre, troll, dragon, garland. Face RIGHT, light from top-left."""
from __future__ import annotations

import random

import monster_palette as M
from mon_engine import MSpr
from art_helpers import tex_diag, tex_fur, tex_noise, tex_rows, tex_scales

L = 64


def ogre() -> MSpr:
    s = MSpr(L, L)
    rng = random.Random("ogre")
    o = M.OGRE
    # far limbs, in shadow
    s.paint(s.tube([(25, 45, 6), (23, 54, 5)]) | s.poly([(17, 56), (30, 56), (31, 61), (17, 61)]), o, bias=-1.5, cap=4)
    s.paint(s.tube([(20, 25, 5.5), (14, 34, 5), (15, 43, 4.5)]) | s.ell(15, 46, 4.5, 4), o, bias=-1.4, cap=4)
    # ONE lit mass: torso, belly, head, near arm, near leg and foot -> no patch seams
    torso = s.poly([(17, 22), (28, 17), (42, 19), (48, 27), (50, 38), (46, 49), (30, 51), (19, 45), (15, 33)])
    head = s.ell(44, 15, 9, 8) | s.poly([(38, 16), (54, 16), (55, 22), (49, 26), (40, 24)])
    arm = s.tube([(42, 25, 6.5), (49, 33, 5.5), (52, 39, 5.0)]) | s.ell(53, 41, 5, 4.6)
    leg = s.tube([(37, 45, 7), (39, 54, 6)]) | s.poly([(32, 55), (47, 55), (50, 59), (50, 61), (32, 61)])
    s.paint(torso | head | leg, o, cap=8, tex=tex_noise(s, rng, 0.14), gain=1.3, soft=2)
    s.paint(arm, o, cap=5, tex=tex_noise(s, rng, 0.14), gain=1.2, bias=0.2, sep=True)
    # sculpt anatomy over the single mass
    s.bump(30, 28, 8, 5.5, 1.1)           # pectoral
    s.bump(43, 27, 6, 6, 1.0)             # deltoid
    s.bump(48, 34, 4.5, 6, 0.9)           # bicep
    s.bump(34, 40, 11, 10, 0.9)           # belly
    s.bump(38, 49, 6, 7, 0.9)             # thigh
    s.bump(52, 41, 4, 3.6, 0.7)           # fist
    s.crease([(26, 33), (31, 35), (38, 34)], 1.2, 0.4)        # under-pec
    s.crease([(44, 31), (46, 38), (44, 44)], 1.0, 0.3)        # arm/torso gap
    s.crease([(38, 25), (42, 27)], 0.8, 0.3)                  # collarbone
    s.crease([(36, 44), (36, 47)], 1.0, 0.2)                  # navel
    s.crease([(40, 23), (47, 25), (54, 22)], 1.5, 0.5)        # jaw
    s.crease([(48, 41), (53, 38), (57, 41)], 0.8, 0.2)        # knuckles
    s.shade_ell(33, 49, 12, 4, -0.7)                          # belt shadow
    # scars and pores
    for (x, y) in ((33, 31), (39, 34), (28, 38), (41, 43)):
        s.hl([(x, y), (x + 1, y + 1)], o[1])
    # loincloth with fur trim and rope belt
    cloth = s.poly([(18, 45), (46, 45), (47, 52), (43, 50), (39, 56), (34, 51), (30, 57), (26, 51), (21, 54)])
    s.paint(cloth, M.LEATHER, cap=3, tex=tex_fur(s, 0.5), sep=True, amp=0.3)
    s.paint(s.rect(17, 43, 48, 46), M.GOLD, bias=-0.4, cap=2, tex=tex_diag(s, 4, 0.5))
    s.paint(s.rect(30, 42, 35, 47), M.GOLD, bias=0.5, cap=2)
    s.hl([(32, 44)], M.GOLD[0])
    # ear, hair tufts, nose, brow
    s.paint(s.ell(36, 15, 3, 3.5), o, cap=2, bias=0.2, sep=True)
    s.paint(s.poly([(36, 10), (36, 4), (40, 7), (42, 2), (45, 7), (49, 4), (50, 10)]), M.LEATHER, bias=-0.4, cap=2, tex=tex_fur(s, 0.5))
    s.bump(52, 15, 3.4, 3.0, 0.8)
    s.hl([(53, 17), (52, 17)], o[0])
    s.paint(s.poly([(42, 11), (53, 11), (53, 13), (42, 14)]), o, bias=-1.2, cap=1)
    s.hl([(46, 13), (47, 13), (48, 13), (49, 13)], M.WHITE)
    s.hl([(48, 13), (49, 13)], M.EYE_RED)
    s.hl([(49, 13)], M.BLACK)
    s.hl([(45, 12), (46, 12), (47, 12), (48, 12), (49, 12), (50, 12)], o[0])
    s.hl([(41 + k, 22) for k in range(10)], M.CRIMSON[0])
    s.paint(s.poly([(43, 23), (47, 23), (46, 16), (45, 16)]), M.BONE, cap=1, bias=0.4)
    s.paint(s.poly([(50, 23), (54, 23), (54, 17), (53, 17)]), M.BONE, cap=1, bias=0.4)
    # spiked club planted in front
    s.paint(s.stroke([(53, 40), (57, 56)], 4), M.WOOD, cap=2)
    s.paint(s.ell(58, 53, 5.5, 7.5), M.LEATHER, cap=4, tex=tex_diag(s, 5, 0.5), bias=0.3, sep=True)
    for (x, y) in ((56, 48), (61, 50), (58, 54), (62, 56), (56, 58)):
        s.paint(s.ell(x, y, 1.3, 1.3), M.IRON, cap=1, bias=0.8)
    s.outline()
    s.shadow(32, 61.5, 24, 1.6, M.SHADOW)
    return s


def troll() -> MSpr:
    s = MSpr(L, L)
    rng = random.Random("troll")
    t = M.TROLL
    # far arm raised, gripping a gnarled branch
    s.paint(s.tube([(24, 22, 4.2), (16, 27, 3.8), (12, 21, 3.4)]), t, bias=-1.4, cap=3)
    s.paint(s.stroke([(10, 24), (7, 6)], 3), M.WOOD, cap=1, bias=-0.5)
    s.paint(s.poly([(3, 14), (7, 3), (12, 8), (10, 18)]), M.WOOD, cap=3, tex=tex_diag(s, 4, 0.6), bias=0.2, sep=True)
    # far leg
    s.paint(s.tube([(26, 41, 5), (22, 50, 4.2), (24, 58, 3.6)]) | s.poly([(18, 58), (31, 58), (32, 61), (18, 61)]), t, bias=-1.4, cap=3)
    # single lit mass: hump, torso, head, snout, near leg, near arm
    torso = s.poly([(14, 33), (18, 18), (28, 12), (40, 16), (46, 26), (44, 38), (40, 46), (24, 47), (16, 42)]) | s.ell(25, 25, 10, 9)
    head = s.ell(46, 15, 8, 7.5) | s.poly([(48, 14), (58, 18), (57, 23), (48, 21)]) | s.poly([(40, 19), (55, 21), (54, 26), (42, 26)])
    leg = s.tube([(35, 40, 6), (41, 49, 4.6), (35, 57, 3.8)]) | s.poly([(29, 57), (44, 57), (48, 60), (48, 61), (29, 61)])
    arm = s.tube([(38, 24, 5.2), (46, 33, 4.4), (50, 42, 3.8)]) | s.ell(51, 46, 4.4, 4.0)
    s.paint(torso | head | leg, t, cap=8, tex=tex_noise(s, rng, 0.14), gain=1.3, soft=2)
    s.paint(arm, t, cap=5, tex=tex_noise(s, rng, 0.14), gain=1.2, bias=0.2, sep=True)
    s.bump(25, 24, 9, 8, 1.0)             # hump
    s.bump(33, 34, 8, 8, 0.8)             # ribcage / belly
    s.bump(44, 32, 4.5, 6, 0.9)           # forearm
    s.bump(38, 48, 5, 7, 0.9)             # thigh
    s.crease([(33, 26), (40, 29), (43, 38)], 1.1, 0.4)
    s.crease([(36, 24), (42, 26)], 0.9, 0.3)
    s.crease([(40, 22), (47, 24), (55, 24)], 0.9, 0.3)   # jaw
    # rib ridges
    for y in (31, 35, 39):
        s.hl([(30 + k, y) for k in range(5)], t[1])
        s.hl([(30 + k, y - 1) for k in range(1, 4)], t[4])
    # moss, warts
    moss = s.ell(21, 21, 8, 5) & ~s.ell(25, 31, 9, 6) & s.a
    s.paint(moss, M.LEAF, cap=2, tex=tex_noise(s, rng, 0.5), sep=True, amp=0.35)
    for (x, y) in ((30, 20), (35, 33), (20, 37), (40, 29), (27, 41), (48, 18), (49, 38)):
        s.hl([(x, y)], t[5])
        s.hl([(x + 1, y + 1)], t[0])
    # ragged pants
    s.paint(s.poly([(18, 40), (42, 38), (44, 47), (41, 45), (38, 52), (33, 46), (28, 53), (24, 46), (19, 49)]), M.LEATHER, bias=-0.4, cap=3, tex=tex_noise(s, rng, 0.45), sep=True)
    s.flat(s.rect(17, 38, 43, 40), M.LEATHER[1])
    s.hl([(24, 39), (31, 39), (38, 39)], M.BONE[3])
    # ear, bone crest, brow, red eye, tusks
    s.paint(s.ell(38, 12, 3.5, 4.5), t, bias=-0.3, cap=2, sep=True)
    s.paint(s.poly([(38, 8), (40, 2), (43, 7), (46, 1), (49, 7), (52, 4), (52, 9)]), t, bias=-1.2, cap=2)
    s.bump(54, 19, 4, 3.4, 0.8)
    s.paint(s.poly([(43, 11), (54, 12), (54, 13), (43, 14)]), t, bias=-1.5, cap=1)
    s.hl([(48, 13), (49, 13), (50, 13)], M.EYE_RED)
    s.hl([(50, 13)], M.BLACK)
    s.hl([(48, 12)], M.EYE_YEL)
    s.hl([(42 + 2 * k, 24) for k in range(6)], M.CRIMSON[0])
    s.paint(s.poly([(47, 25), (49, 25), (48, 21)]), M.BONE, cap=1, bias=0.4)
    s.paint(s.poly([(52, 24), (54, 24), (53, 20)]), M.BONE, cap=1, bias=0.4)
    for x, y in ((49, 50), (51, 51), (54, 49)):
        s.paint(s.stroke([(x, y - 1), (x, y + 2)], 1), M.BONE, cap=1, bias=0.5)
    s.outline()
    s.shadow(32, 61.5, 22, 1.6, M.SHADOW)
    return s


def dragon() -> MSpr:
    s = MSpr(L, L)
    rng = random.Random("dragon")
    d = M.DRAGON
    sc = lambda a=0.5: tex_scales(s, 3, a)
    # wing (behind everything)
    T1, T2, T3 = (13, 3), (4, 17), (9, 30)
    s.paint(s.poly([(28, 33), (26, 11), T1, (15, 13), T2, (10, 22), T3, (19, 30)]), M.CRIMSON, bias=-0.3, cap=5, tex=tex_diag(s, 6, 0.35, slope=-1))
    for tip in (T1, T2, T3):
        s.paint(s.stroke([(26, 11), tip], 2), d, bias=0.3, cap=1)
    s.paint(s.stroke([(29, 34), (26, 11)], 3), d, bias=0.4, cap=1)
    s.paint(s.stroke([(26, 11), (25, 7)], 2), M.BONE, cap=1, bias=0.0)  # wing claw
    # tail
    s.paint(s.tube([(16, 40, 6), (9, 44, 5), (4, 51, 3.6), (5, 57, 2.6), (12, 59, 1.6)]), d, cap=5, tex=sc(), gain=1.1)
    s.paint(s.poly([(12, 56), (20, 58), (13, 62), (10, 60)]), M.CRIMSON, cap=2, bias=0.3)
    # hind leg
    s.paint(s.ell(21, 45, 7.5, 8), d, bias=0.1, cap=5, tex=sc(), sep=True)
    s.paint(s.tube([(19, 51, 3.8), (17, 57, 3.0)]), d, cap=3, sep=True)
    s.paint(s.poly([(10, 58), (24, 58), (25, 61), (10, 61)]), d, cap=2, sep=True)
    s.pxs([(10, 61), (13, 61), (16, 61), (19, 61)], M.BONE[2])
    # body + neck
    s.paint(s.poly([(14, 38), (24, 31), (36, 31), (44, 36), (47, 44), (40, 51), (24, 51), (15, 46)]), d, cap=7, tex=sc(0.55), gain=1.1)
    s.paint(s.tube([(40, 40, 7), (46, 29, 5.2), (47, 19, 4.4)]), d, cap=5, tex=sc(), sep=True, gain=1.1)
    # belly plates
    s.paint(s.poly([(18, 46), (44, 45), (45, 48), (40, 52), (24, 52)]), M.BELLY, bias=-0.1, cap=2, tex=tex_rows(s, 3, 0.7))
    s.paint(s.stroke([(45, 24), (44, 38)], 3), M.BELLY, cap=1, bias=-0.1, tex=tex_rows(s, 3, 0.7))
    # front legs
    s.paint(s.tube([(43, 46, 3.6), (47, 53, 2.8), (48, 58, 2.4)]), d, bias=-0.7, cap=3)
    s.paint(s.poly([(44, 57), (53, 57), (54, 61), (44, 61)]), d, bias=-0.7, cap=2)
    s.paint(s.tube([(37, 46, 4.8), (40, 53, 3.8), (40, 58, 3.2)]), d, cap=4, tex=sc(), sep=True)
    s.paint(s.poly([(35, 57), (48, 57), (50, 61), (35, 61)]), d, cap=2, sep=True)
    s.pxs([(48, 61), (45, 61), (42, 61), (39, 61)], M.BONE[3])
    # back spines
    for (x, y) in ((19, 35), (24, 31), (30, 30), (36, 31), (43, 33), (46, 25), (47, 21)):
        s.paint(s.poly([(x - 2, y + 1), (x - 1, y - 4), (x + 1, y + 1)]), M.BONE, cap=1, bias=-0.3)
    # head
    s.paint(s.ell(50, 14, 6.6, 5.4), d, cap=4, bias=0.2, tex=sc(0.4), sep=True)
    s.paint(s.poly([(52, 10), (62, 14), (62, 18), (52, 19)]), d, cap=3, bias=0.3, sep=True)
    s.paint(s.poly([(51, 19), (62, 19), (60, 24), (50, 23)]), d, cap=2, bias=-0.5, sep=True)  # jaw
    s.flat(s.poly([(53, 18), (61, 18), (59, 20), (53, 21)]), M.CRIMSON[0])
    s.pxs([(54, 18), (56, 18), (58, 18), (60, 18)], M.WHITE)
    s.pxs([(55, 21), (58, 21)], M.WHITE)
    s.pxs([(61, 14), (61, 15)], d[0])
    # horns + brow + eye
    s.paint(s.tube([(47, 10, 2.2), (42, 7, 1.8), (38, 1, 0.8)]), M.BONE, cap=2, bias=0.1)
    s.paint(s.tube([(51, 8, 2.0), (47, 3, 1.5), (47, 0, 0.7)]), M.BONE, cap=2, bias=-0.2)
    s.pxs([(51, 11), (52, 11), (53, 11), (54, 11)], d[0])
    s.pxs([(52, 12), (53, 12)], M.EYE_YEL)
    s.px(53, 12, M.BLACK)
    s.outline()
    s.shadow(30, 61.5, 24, 1.6, M.SHADOW)
    return s


def garland() -> MSpr:
    s = MSpr(L, L)
    rng = random.Random("garland")
    a = M.DARKARMOR
    mt = lambda am=0.4: tex_noise(s, rng, am)
    # cape behind
    cape = s.poly([(24, 19), (32, 19), (30, 40), (31, 59), (26, 56), (22, 60), (17, 55), (12, 58), (13, 40)])
    s.paint(cape, M.CRIMSON, cap=6, bias=-0.3, tex=tex_diag(s, 7, 0.4, slope=-1))
    # far leg
    s.paint(s.tube([(27, 42, 5.5), (25, 50, 4.8), (24, 57, 4)]), a, bias=-0.6, cap=3)
    s.paint(s.poly([(18, 57), (30, 57), (31, 61), (18, 61)]), a, bias=-0.6, cap=2)
    # near leg
    s.paint(s.tube([(37, 42, 6.5), (40, 50, 5.2), (41, 57, 4.4)]), a, cap=4, sep=True)
    s.paint(s.ell(41, 49, 4.4, 3.4), a, bias=0.1, cap=2, sep=True)  # knee guard
    s.paint(s.poly([(34, 56), (48, 56), (52, 60), (52, 61), (34, 61)]), a, cap=2, sep=True)
    s.pxs([(50, 59), (51, 60)], a[4])
    # tasset skirt
    for i, x in enumerate(range(22, 44, 7)):
        s.paint(s.poly([(x, 37), (x + 8, 37), (x + 7, 49), (x + 1, 49)]), a, bias=0.1 - 0.1 * (i % 2), cap=3, sep=True)
    s.flat(s.rect(22, 36, 44, 38), M.GOLD[1])
    s.pxs([(30, 37), (31, 37), (32, 37)], M.GOLD[4])
    # far arm
    s.paint(s.tube([(23, 24, 4.4), (27, 32, 3.8), (35, 36, 3.4)]), a, bias=-0.6, cap=3)
    # torso
    s.paint(s.poly([(21, 20), (35, 17), (43, 22), (41, 38), (24, 38), (19, 30)]), a, cap=7, tex=mt(0.15), bias=0.2)
    s.paint(s.stroke([(22, 28), (40, 28)], 1), M.GOLD, cap=1, bias=-0.3)
    s.paint(s.poly([(30, 21), (36, 21), (36, 28), (33, 31), (30, 28)]), M.CRIMSON, cap=2, bias=0.5, sep=True)  # chest gem plate
    s.paint(s.stroke([(24, 20), (30, 23)], 1), M.GOLD, cap=1)
    # pauldrons with spikes
    s.paint(s.poly([(14, 21), (18, 15), (25, 19), (26, 26), (18, 27)]), a, cap=3, bias=-0.1, sep=True)
    s.paint(s.poly([(18, 15), (15, 8), (21, 15)]), a, cap=1, bias=0.6)
    s.paint(s.ell(41, 22, 8.5, 6.8), a, cap=5, bias=0.15, sep=True)
    s.paint(s.poly([(36, 17), (36, 9), (42, 16)]), a, cap=1, bias=0.6)
    s.paint(s.poly([(46, 20), (53, 17), (49, 25)]), a, cap=1, bias=0.6)
    s.paint(s.stroke([(34, 18), (47, 24)], 1), M.GOLD, cap=1, bias=-0.2)
    # helmet
    s.paint(s.ell(31, 11, 7, 7.5), a, cap=5, bias=0.2)
    s.paint(s.poly([(33, 13), (40, 13), (39, 19), (31, 19)]), a, cap=3, bias=0.1, sep=True)  # faceguard
    s.flat(s.rect(33, 10, 39, 12), a[0])
    s.pxs([(34, 11), (35, 11), (37, 11), (38, 11)], M.EYE_RED)
    s.pxs([(35, 15), (37, 15), (35, 17), (37, 17)], a[0])
    s.paint(s.stroke([(31, 4), (31, 10)], 1), M.GOLD, cap=1)
    # horns
    s.paint(s.tube([(26, 8, 2.6), (20, 6, 2.0), (17, 0, 1.0)]), M.BONE, cap=2, bias=-0.1)
    s.paint(s.tube([(37, 7, 2.6), (43, 5, 2.0), (46, 0, 1.0)]), M.BONE, cap=2, bias=0.1)
    # near arm + sword
    s.paint(s.tube([(44, 26, 5.2), (49, 33, 4.4), (50, 38, 3.8)]), a, cap=4, bias=0.1, sep=True)
    blade = s.poly([(52, 34), (50, 33), (56, 3), (60, 2), (58, 5)])
    s.paint(s.poly([(49, 34), (53, 34), (60, 3), (57, 1)]), M.IRON, cap=2, bias=0.6)
    s.paint(s.stroke([(54, 30), (58, 6)], 1), M.IRON[4:], cap=1) if False else None
    s.flat(s.rect(45, 34, 57, 36), M.GOLD[2])
    s.pxs([(45, 34), (46, 34), (47, 34)], M.GOLD[4])
    s.paint(s.ell(51, 39, 4.2, 4.2), a, cap=2, bias=0.2, sep=True)  # gauntlet
    s.paint(s.stroke([(50, 42), (49, 47)], 2), M.LEATHER, cap=1)
    s.px(49, 48, M.GOLD[3])
    # rivets and plate edges
    s.hl([(24, 22), (24, 30), (40, 30), (26, 36), (38, 36), (36, 24)], a[5])
    s.hl([(41, 18), (45, 21), (38, 22)], a[5])
    s.crease([(24, 38), (24, 48)], 0.9, 0.3)
    s.crease([(35, 38), (36, 48)], 0.9, 0.3)
    s.outline()
    s.shadow(32, 61.5, 22, 1.5, M.SHADOW)
    return s
