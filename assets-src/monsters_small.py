"""Small (32x32) monsters: goblin, wolf, skeleton, pirate, mummy, cockatrice, vampire.

All face RIGHT in a 3/4 side view, light from the top-left. See art_helpers.Spr.
"""
import random

import monster_palette as M
from art_helpers import Spr, tex_diag, tex_fur, tex_noise, tex_rows, tex_scales

S = 32


def goblin() -> Spr:
    s = Spr(S, S)
    rng = random.Random("goblin")
    g = M.GOBLIN
    # far arm + far leg first (darker)
    far = s.tube([(11, 17, 1.8), (8, 21, 1.5), (9, 24, 1.4)])
    s.paint(far, g, bias=-0.9, cap=2)
    s.paint(s.tube([(12, 24, 2.0), (10, 29, 1.6)]), g, bias=-0.8, cap=2)
    s.paint(s.rect(8, 29, 12, 30), g, bias=-0.8, cap=1)
    # near leg
    s.paint(s.tube([(17, 24, 2.4), (18, 28, 1.8)]), g, cap=2)
    s.paint(s.poly([(16, 28), (23, 28), (24, 30), (16, 30)]), g, cap=2, sep=True)
    # torso (hunched)
    s.paint(s.poly([(9, 15), (14, 12), (21, 14), (22, 20), (20, 25), (11, 25), (9, 20)]), g, tex=tex_noise(s, rng, 0.25), cap=4)
    # leather vest + loincloth
    s.paint(s.poly([(10, 15), (20, 15), (21, 22), (19, 23), (11, 23)]), M.LEATHER, tex=tex_rows(s, 3, 0.35), cap=3)
    s.paint(s.poly([(11, 23), (20, 23), (20, 27), (18, 26), (16, 28), (14, 26), (12, 27)]), M.LEATHER, bias=-0.3, cap=2, sep=True)
    s.flat(s.rect(11, 22, 20, 22), M.GOLD[2])
    # head
    ear_far = s.poly([(14, 9), (6, 4), (5, 5), (13, 13)])
    s.paint(ear_far, g, bias=-0.4, cap=2)
    s.paint(s.ell(18, 11, 5.6, 5.0), g, cap=4, tex=tex_noise(s, rng, 0.2))
    s.paint(s.poly([(14, 10), (4, 9), (3, 11), (14, 15)]), g, cap=2, sep=True)  # near ear
    s.paint(s.ell(24, 12.5, 2.6, 2.1), g, bias=0.2, cap=2, sep=True)  # nose
    s.px(25, 14, M.GOBLIN[0])
    # brow, eye, mouth
    s.pxs([(18, 8), (19, 8), (20, 9), (21, 9)], g[0])
    s.pxs([(19, 10), (20, 10), (21, 10)], M.EYE_YEL)
    s.px(21, 10, M.BLACK)
    s.pxs([(19, 15), (20, 15), (21, 15), (22, 15), (23, 15)], g[0])
    s.pxs([(20, 14), (22, 14)], M.WHITE)
    # near arm + dagger
    s.paint(s.tube([(20, 17, 2.0), (23, 20, 1.7), (26, 19, 1.5)]), g, cap=2, sep=True)
    s.paint(s.stroke([(27, 18), (30, 10)], 2), M.IRON, cap=1, bias=0.4)
    s.pxs([(30, 9), (30, 10)], M.IRON[4])
    s.flat(s.rect(25, 18, 28, 19), M.LEATHER[1])
    s.outline()
    s.shadow(16, 30.5, 11, 1.2, M.SHADOW)
    return s


def wolf() -> Spr:
    s = Spr(S, S)
    rng = random.Random("wolf")
    f, fl = M.FUR, M.FUR_LIGHT
    # far legs
    s.paint(s.tube([(23, 21, 2.2), (25, 25, 1.8), (25, 29, 1.6)]), f, bias=-0.4, cap=2)
    s.paint(s.rect(24, 29, 28, 30), f, bias=-0.4, cap=1)
    s.paint(s.tube([(11, 22, 2.4), (10, 26, 1.9), (11, 29, 1.6)]), f, bias=-0.4, cap=2)
    s.paint(s.rect(10, 29, 14, 30), f, bias=-0.4, cap=1)
    # tail
    s.paint(s.tube([(6, 16, 2.0), (3, 14, 1.8), (1, 10, 1.3), (1, 7, 0.8)]), f, tex=tex_fur(s, 0.5), cap=2)
    # body
    body = s.poly([(5, 17), (9, 13), (17, 12), (24, 13), (26, 18), (24, 23), (10, 24), (6, 22)])
    s.paint(body, f, tex=tex_fur(s, 0.55), cap=5, amp=0.6, bias=0.35)
    s.paint(s.poly([(9, 22), (24, 21), (23, 24), (10, 25)]), fl, bias=-0.5, cap=2, tex=tex_fur(s, 0.3))
    # haunch
    s.paint(s.ell(9.5, 19, 4.6, 5.2), f, bias=0.3, cap=4, tex=tex_fur(s, 0.5), sep=True)
    # near legs
    s.paint(s.tube([(8, 23, 2.8), (6, 26, 2.2), (8, 29, 1.8)]), f, bias=0.3, cap=2, tex=tex_fur(s, 0.4), sep=True)
    s.paint(s.rect(6, 29, 11, 30), f, cap=1, bias=-0.2)
    s.paint(s.tube([(21, 21, 2.6), (22, 25, 2.0), (22, 29, 1.8)]), f, bias=0.3, cap=2, tex=tex_fur(s, 0.4), sep=True)
    s.paint(s.rect(21, 29, 26, 30), f, cap=1, bias=-0.2)
    # neck / mane
    s.paint(s.poly([(20, 11), (25, 9), (27, 15), (25, 21), (20, 19)]), f, bias=0.2, cap=4, tex=tex_fur(s, 0.6))
    # head: skull + snout
    s.paint(s.ell(25.5, 11.5, 4.2, 3.8), f, bias=0.45, cap=3, sep=True)
    s.paint(s.poly([(26, 10), (31, 12), (31, 15), (27, 16)]), fl, cap=2, bias=-0.1, sep=True)
    # ears
    s.paint(s.poly([(22, 10), (22, 4), (25, 8)]), f, cap=2, bias=0.1)
    s.paint(s.poly([(25, 9), (27, 4), (29, 9)]), f, cap=2, bias=-0.3)
    s.pxs([(23, 7), (23, 6)], M.FUR_LIGHT[1])
    # face
    s.pxs([(27, 10), (28, 10)], M.EYE_AMB)
    s.px(27, 9, M.BLACK)
    s.pxs([(31, 12), (30, 12)], M.BLACK)
    s.pxs([(27, 15), (28, 15), (29, 15), (30, 15)], M.RED[1])
    s.pxs([(28, 16), (30, 16)], M.WHITE)
    s.outline()
    s.shadow(15, 30.5, 13, 1.2, M.SHADOW)
    return s



def skeleton() -> Spr:
    s = Spr(S, S)
    rng = random.Random("skeleton")
    b = M.BONE
    # far limbs (dark)
    s.paint(s.tube([(11, 12, 1.1), (8, 16, 1.0), (9, 21, 1.0)]), b, bias=-0.9, cap=2)
    s.paint(s.tube([(18, 23, 1.3), (19, 27, 1.1), (20, 29, 1.0)]), b, bias=-0.9, cap=2)
    s.paint(s.rect(19, 29, 23, 30), b, bias=-0.9, cap=1)
    # near leg: femur, knee, tibia, foot
    s.paint(s.tube([(14, 23, 1.5), (14, 26, 1.2), (13, 29, 1.1)]), b, cap=2)
    s.paint(s.ell(14, 26.5, 1.9, 1.5), b, cap=2, bias=0.3)
    s.paint(s.poly([(12, 29), (17, 29), (18, 30), (12, 30)]), b, cap=1)
    # pelvis
    s.paint(s.poly([(11, 20), (20, 20), (20, 22), (18, 25), (16, 23), (14, 25), (12, 22)]), b, cap=2)
    s.pxs([(15, 23), (16, 23)], b[0])
    # spine + ribcage
    s.paint(s.tube([(15.5, 10, 1.0), (15, 20, 1.0)]), b, cap=1, bias=-0.2)
    rib = s.ell(15.5, 15.5, 5.2, 4.8)
    s.paint(rib, b, cap=4, bias=0.2)
    for y in (13, 15, 17):
        for x in range(11, 21):
            if x not in (15, 16):
                s.px(x, y, b[0])
    s.paint(s.tube([(15.5, 10, 1.0), (15, 20, 1.0)]), b, cap=1, bias=0.1)
    # shoulders / near arm holding rusty sword
    s.paint(s.tube([(11, 11.5, 1.4), (20, 11.5, 1.4)]), b, cap=1, bias=0.2)
    s.paint(s.tube([(20, 12, 1.2), (23, 16, 1.1), (26, 16, 1.0)]), b, cap=2, sep=True)
    s.flat(s.rect(25, 15, 27, 17), M.IRON[1])
    sw = s.stroke([(27, 15), (28, 3)], 2)
    s.paint(sw, M.IRON, cap=1, bias=0.1, tex=tex_diag(s, 5, 0.9))
    s.pxs([(27, 3), (28, 2)], M.IRON[4])
    s.flat(s.rect(24, 14, 30, 14), M.GOLD[1])
    # skull
    s.paint(s.ell(17.5, 6, 4.6, 4.4), b, cap=4, bias=0.3)
    s.paint(s.poly([(16, 9), (22, 9), (21, 12), (16, 12)]), b, cap=2, sep=True)  # jaw
    s.paint(s.ell(18.5, 6, 1.7, 1.9), M.BONE[:1], cap=1)
    s.px(19, 6, M.EYE_RED)
    s.pxs([(22, 8), (21, 8)], b[0])
    for x in (17, 19, 21):
        s.px(x, 10, b[0])
    s.pxs([(17, 11), (19, 11), (21, 11)], b[1])
    # rag loincloth
    s.paint(s.poly([(12, 20), (19, 20), (20, 26), (18, 25), (16, 27), (14, 25), (12, 26)]), M.RED, bias=-0.6, cap=2, tex=tex_rows(s, 3, 0.4))
    s.outline()
    s.shadow(16, 30.5, 9, 1.1, M.SHADOW)
    return s


def pirate() -> Spr:
    s = Spr(S, S)
    rng = random.Random("pirate")
    # legs + boots
    s.paint(s.tube([(13, 22, 2.4), (12, 27, 2.0)]), M.PALE, bias=-0.7, cap=2)
    s.paint(s.poly([(9, 26), (14, 26), (15, 30), (9, 30)]), M.LEATHER, bias=-0.6, cap=2)
    s.paint(s.tube([(18, 22, 2.8), (19, 26, 2.2)]), M.PALE, bias=-0.1, cap=2, sep=True)
    s.paint(s.poly([(16, 25), (21, 25), (24, 28), (24, 30), (16, 30)]), M.LEATHER, cap=2, sep=True)
    s.pxs([(21, 26), (22, 27)], M.LEATHER[4])
    # far arm on hip
    s.paint(s.tube([(11, 14, 2.0), (8, 18, 1.8), (11, 21, 1.6)]), M.BLUE, bias=-0.9, cap=2)
    # coat + shirt
    s.paint(s.poly([(10, 13), (21, 12), (23, 18), (22, 26), (11, 26), (9, 19)]), M.BLUE, cap=4, tex=tex_rows(s, 5, 0.2))
    s.paint(s.poly([(15, 13), (21, 13), (22, 19), (16, 20)]), M.PALE, cap=2, tex=tex_rows(s, 2, 0.5))
    s.paint(s.poly([(14, 12), (17, 12), (19, 19), (17, 25), (14, 25)]), M.BLUE, bias=0.1, cap=2, sep=True)
    s.flat(s.rect(11, 21, 22, 22), M.LEATHER[1])
    s.flat(s.rect(16, 21, 18, 22), M.GOLD[3])
    s.pxs([(15, 16), (15, 18), (15, 20)], M.GOLD[3])
    # head
    s.paint(s.ell(18, 8.5, 4.2, 4.4), M.SKIN, cap=3)
    s.paint(s.poly([(15, 11), (22, 11), (22, 15), (18, 17), (15, 14)]), M.LEATHER, bias=-0.6, cap=2, sep=True)  # beard
    s.pxs([(20, 12), (21, 12), (20, 13)], M.SKIN[1])
    # hat
    s.paint(s.poly([(11, 6), (14, 2), (22, 1), (26, 5), (22, 6), (16, 5)]), M.CLOTHDK, bias=0.3, cap=2, sep=True)
    s.flat(s.rect(14, 5, 23, 5), M.GOLD[2])
    s.pxs([(18, 3), (19, 3)], M.WHITE)
    # face
    s.pxs([(20, 8), (21, 8), (22, 8)], M.BLACK)  # eyepatch strap hint
    s.px(21, 9, M.BLACK)
    s.px(19, 8, M.BLACK)
    s.pxs([(19, 9)], M.WHITE)
    s.pxs([(22, 10), (23, 10)], M.SKIN[1])
    # near arm + cutlass
    s.paint(s.tube([(21, 14, 2.2), (24, 18, 2.0), (27, 17, 1.7)]), M.BLUE, cap=2, sep=True)
    s.flat(s.rect(27, 16, 28, 18), M.SKIN[2])
    s.paint(s.stroke([(28, 16), (29, 9), (27, 4)], 2), M.IRON, cap=1, bias=0.5)
    s.pxs([(27, 4), (27, 5)], M.IRON[4])
    s.flat(s.rect(25, 15, 30, 15), M.GOLD[2])
    s.outline()
    s.shadow(16, 30.5, 11, 1.1, M.SHADOW)
    return s


def mummy() -> Spr:
    s = Spr(S, S)
    rng = random.Random("mummy")
    w = M.WRAP
    wt = lambda a=0.7: tex_diag(s, 5, a, slope=1)
    # far arm
    s.paint(s.tube([(13, 14, 2.0), (18, 15, 1.7), (23, 16, 1.6)]), w, bias=-0.8, cap=2, tex=wt())
    # legs
    s.paint(s.tube([(13, 22, 2.8), (11, 26, 2.3), (11, 29, 2.0)]), w, bias=-0.6, cap=2, tex=wt())
    s.paint(s.rect(9, 29, 14, 30), w, bias=-0.6, cap=1)
    s.paint(s.tube([(17, 22, 3.0), (19, 26, 2.5), (19, 29, 2.2)]), w, cap=2, tex=wt(), sep=True)
    s.paint(s.rect(17, 29, 23, 30), w, cap=1)
    # torso (hunched)
    s.paint(s.poly([(9, 14), (14, 11), (20, 12), (22, 18), (21, 25), (12, 25), (10, 20)]), w, cap=4, tex=wt(0.55))
    # rot stains
    s.paint(s.ell(13, 20, 1.3, 1.6), M.LEATHER, bias=0.2, cap=1, tex=tex_noise(s, rng, 0.4))
    # head
    s.paint(s.ell(17, 7.5, 4.6, 4.8), w, cap=4, tex=wt(0.6))
    s.flat(s.rect(16, 6, 18, 8), M.CLOTHDK[0])
    s.flat(s.rect(20, 6, 22, 8), M.CLOTHDK[0])
    s.pxs([(17, 7), (18, 7), (21, 7), (22, 7)], M.EYE_RED)
    s.pxs([(16, 5), (17, 5), (21, 5)], M.WRAP[1])
    # near arm reaching forward
    s.paint(s.tube([(19, 14, 2.4), (24, 15, 2.0), (28, 16, 1.8)]), w, cap=2, tex=wt(), sep=True)
    s.paint(s.ell(29.5, 16.5, 1.8, 1.6), w, cap=1, sep=True)
    # loose bandage ends
    s.paint(s.tube([(25, 17, 0.8), (26, 20, 0.7), (25, 23, 0.6)]), w, bias=-0.3, cap=1)
    s.paint(s.tube([(11, 24, 0.9), (8, 27, 0.8), (6, 28, 0.6)]), w, bias=-0.3, cap=1)
    s.paint(s.tube([(13, 6, 0.7), (10, 10, 0.7), (9, 13, 0.6)]), w, bias=-0.3, cap=1)
    s.outline()
    s.shadow(16, 30.5, 10, 1.1, M.SHADOW)
    return s


def cockatrice() -> Spr:
    s = Spr(S, S)
    rng = random.Random("cockatrice")
    t = M.TEAL
    g = M.GOBLIN
    # serpent tail rising behind, with a tiny snake head
    s.paint(s.tube([(10, 20, 2.3), (5, 21, 2.0), (3, 17, 1.8), (3, 13, 1.5), (6, 10, 1.2)]), g, cap=2, tex=tex_scales(s, 3, 0.6))
    s.paint(s.ell(8, 9, 2.4, 1.8), g, cap=1, bias=0.3, sep=True)
    s.px(9, 8, M.EYE_YEL)
    s.pxs([(10, 10), (11, 10), (12, 11), (12, 9)], M.RED[3])
    # legs
    s.paint(s.tube([(14, 23, 1.4), (14, 27, 1.1)]), M.GOLD, bias=-0.7, cap=1)
    s.paint(s.tube([(19, 23, 1.8), (19, 27, 1.4)]), M.GOLD, bias=-0.1, cap=1, sep=True)
    s.flat(s.rect(12, 29, 16, 29), M.GOLD[1])
    s.flat(s.rect(17, 29, 23, 29), M.GOLD[3])
    s.pxs([(12, 30), (14, 30), (16, 30), (18, 30), (20, 30), (22, 30), (23, 30)], M.GOLD[0])
    s.pxs([(19, 28), (20, 28)], M.GOLD[2])
    # tail feathers (rooster)
    s.paint(s.poly([(9, 18), (4, 13), (6, 19), (3, 22), (9, 22)]), t, bias=-0.3, cap=2, tex=tex_rows(s, 3, 0.4)) if False else None
    # body
    s.paint(s.poly([(7, 18), (11, 14), (18, 14), (23, 17), (22, 23), (16, 25), (9, 23)]), t, cap=5, tex=tex_scales(s, 3, 0.5), bias=0.1)
    s.paint(s.poly([(14, 21), (22, 20), (21, 24), (16, 25)]), M.BELLY, bias=-0.3, cap=2, tex=tex_scales(s, 3, 0.3))
    # bat-like wing with feather tips
    wing = s.poly([(8, 16), (13, 12), (18, 14), (19, 20), (17, 24), (15, 20), (13, 25), (11, 20), (9, 23), (7, 19)])
    s.paint(wing, t, bias=-0.9, cap=3, tex=tex_rows(s, 3, 0.9), sep=True)
    s.paint(s.poly([(9, 16), (13, 13), (17, 15), (17, 18), (13, 17)]), t, bias=0.5, cap=2)
    # neck + head
    s.paint(s.tube([(19, 16, 3.0), (21, 11, 2.4), (23, 8, 2.2)]), t, cap=3, tex=tex_scales(s, 3, 0.4), sep=True)
    s.paint(s.ell(24, 7, 3.4, 3.2), t, cap=3, bias=0.2, sep=True)
    s.paint(s.poly([(26, 5), (31, 8), (26, 10)]), M.GOLD, cap=2, bias=0.3, sep=True)
    s.px(29, 8, M.GOLD[0])
    for cx, cy in ((22, 3), (24, 2), (26, 3)):
        s.paint(s.ell(cx, cy, 1.5, 1.7), M.RED, cap=2)
    s.paint(s.ell(27, 11, 1.2, 2.2), M.RED, cap=1, bias=0.2)
    s.pxs([(25, 6), (26, 6)], M.EYE_YEL)
    s.px(26, 6, M.BLACK)
    s.px(25, 5, t[0])
    s.outline()
    s.shadow(15, 30.5, 11, 1.1, M.SHADOW)
    return s


def vampire() -> Spr:
    s = Spr(S, S)
    rng = random.Random("vampire")
    p = M.PURPLE
    # cape flowing back-left, scalloped hem
    cape = s.poly([(14, 12), (20, 12), (19, 22), (17, 29), (14, 27), (11, 30), (8, 27), (5, 30), (4, 24), (7, 17)])
    s.paint(cape, p, cap=5, bias=-0.2, tex=tex_diag(s, 6, 0.4, slope=-1))
    s.paint(s.poly([(14, 13), (13, 16), (7, 20), (5, 27), (8, 25), (11, 28), (14, 25), (14, 18)]), M.CRIMSON, bias=0.0, cap=3, tex=tex_diag(s, 6, 0.4, slope=-1), sep=True)
    # legs and shoes
    s.paint(s.tube([(15, 23, 2.0), (14, 27, 1.7)]), M.CLOTHDK, cap=2, bias=0.1)
    s.paint(s.tube([(19, 23, 2.2), (20, 27, 1.9)]), M.CLOTHDK, cap=2, bias=0.5, sep=True)
    s.paint(s.poly([(12, 28), (16, 28), (17, 30), (12, 30)]), M.CLOTHDK, cap=1)
    s.paint(s.poly([(18, 28), (23, 28), (25, 30), (18, 30)]), M.CLOTHDK, cap=1, bias=0.5)
    # coat
    s.paint(s.poly([(14, 13), (21, 13), (22, 19), (22, 25), (14, 25), (13, 19)]), M.CLOTHDK, cap=4, bias=0.5)
    s.paint(s.poly([(17, 13), (20, 13), (20, 21), (18, 21)]), M.PALE, cap=2, tex=tex_rows(s, 3, 0.2))
    s.pxs([(18, 14), (18, 15), (18, 17)], M.RED[4])
    s.flat(s.rect(14, 21, 21, 21), M.GOLD[1])
    s.pxs([(17, 21), (18, 21)], M.GOLD[4])
    # tall collar flares behind the head
    s.paint(s.poly([(13, 13), (13, 5), (17, 10), (17, 13)]), M.CRIMSON, bias=0.2, cap=2, sep=True)
    # head
    s.paint(s.ell(19, 8.5, 3.6, 4.3), M.PALE, cap=3)
    s.paint(s.poly([(17, 10), (22, 10), (21, 13), (19, 14), (17, 12)]), M.PALE, cap=2, bias=0.1)
    hair = s.poly([(15, 7), (15, 3), (19, 1), (23, 3), (22, 6), (19, 5), (18, 7), (16, 9)])
    s.paint(hair, M.CLOTHDK, cap=2, bias=0.0)
    s.pxs([(20, 7), (21, 7)], M.EYE_RED)
    s.pxs([(20, 6), (21, 6), (22, 6)], M.CLOTHDK[0])
    s.px(22, 9, M.PALE[1])
    s.pxs([(20, 11), (21, 11), (22, 11)], M.CRIMSON[1])
    s.pxs([(20, 12), (22, 12)], M.WHITE)
    # reaching arm, clawed hand
    s.paint(s.tube([(20, 15, 2.4), (24, 17, 2.0), (27, 17, 1.6)]), p, cap=2, bias=0.5, sep=True)
    s.paint(s.ell(28.5, 17.5, 1.5, 1.4), M.PALE, cap=1, sep=True)
    s.pxs([(30, 16), (31, 17), (31, 18), (30, 19)], M.PALE[3])
    s.outline()
    s.shadow(15, 30.5, 11, 1.1, M.SHADOW)
    return s
