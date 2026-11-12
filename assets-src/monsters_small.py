"""Small (32x32) monsters: goblin, wolf, skeleton, pirate, mummy, cockatrice, vampire.

All face RIGHT in a 3/4 side view, light from the top-left. See art_helpers.Spr.
"""
from __future__ import annotations

import random

import monster_palette as M
import numpy as np
from art_helpers import tex_diag, tex_fur, tex_noise, tex_rows, tex_scales
from mon_engine import MSpr, tex_wrap

S = 32


def goblin() -> MSpr:
    s = MSpr(S, S)
    rng = random.Random("goblin")
    g = M.GOBLIN
    s.paint(s.tube([(11, 17, 1.8), (8, 21, 1.5), (9, 24, 1.4)]), g, bias=-1.3, cap=2)
    s.paint(s.tube([(12, 24, 2.0), (10, 29, 1.6)]), g, bias=-1.3, cap=2)
    s.paint(s.rect(8, 29, 12, 30), g, bias=-1.3, cap=1)
    s.paint(s.tube([(17, 24, 2.4), (18, 28, 1.8)]), g, cap=2)
    s.paint(s.poly([(16, 28), (23, 28), (24, 30), (16, 30)]), g, cap=2, sep=True)
    s.paint(s.poly([(9, 15), (14, 12), (21, 14), (22, 20), (20, 25), (11, 25), (9, 20)]), g, tex=tex_noise(s, rng, 0.15), cap=4)
    s.bump(14, 17, 4, 5, 0.7)
    s.paint(s.poly([(10, 15), (20, 15), (21, 22), (19, 23), (11, 23)]), M.LEATHER, tex=tex_rows(s, 3, 0.3), cap=3, sep=True)
    s.paint(s.poly([(11, 23), (20, 23), (20, 27), (18, 26), (16, 28), (14, 26), (12, 27)]), M.LEATHER, bias=-0.5, cap=2, sep=True)
    s.flat(s.rect(11, 22, 20, 22), M.GOLD[2])
    s.hl([(15, 22)], M.GOLD[5])
    s.paint(s.poly([(14, 9), (6, 4), (5, 5), (13, 13)]), g, bias=-0.7, cap=2)
    s.paint(s.ell(18, 11, 5.6, 5.0), g, cap=4, tex=tex_noise(s, rng, 0.12))
    s.paint(s.poly([(14, 10), (4, 9), (3, 11), (14, 15)]), g, cap=2, sep=True, bias=0.2)
    s.paint(s.ell(24, 12.5, 2.6, 2.1), g, bias=0.3, cap=2, sep=True)
    s.px(25, 14, g[0])
    s.pxs([(18, 8), (19, 8), (20, 9), (21, 9)], g[0])
    s.pxs([(19, 10), (20, 10), (21, 10)], M.EYE_YEL)
    s.px(21, 10, M.BLACK)
    s.px(19, 10, M.WHITE)
    s.pxs([(19, 15), (20, 15), (21, 15), (22, 15), (23, 15)], g[0])
    s.hl([(20, 14), (22, 14)], M.WHITE)
    s.paint(s.tube([(20, 17, 2.0), (23, 20, 1.7), (26, 19, 1.5)]), g, cap=2, sep=True)
    s.paint(s.stroke([(27, 18), (30, 10)], 2), M.IRON, cap=1, bias=0.8)
    s.hl([(30, 9), (30, 10)], M.IRON[5])
    s.flat(s.rect(25, 18, 28, 19), M.LEATHER[2])
    s.outline()
    s.shadow(16, 30.5, 11, 1.2, M.SHADOW)
    return s


def wolf() -> MSpr:
    s = MSpr(S, S)
    f, fl = M.FUR, M.FUR_LIGHT
    fur = lambda a=0.4: tex_fur(s, a)
    # far legs (shadowed)
    s.paint(s.tube([(23, 21, 2.2), (25, 25, 1.7), (25, 29, 1.5)]), f, bias=-1.2, cap=2)
    s.paint(s.rect(24, 29, 28, 30), f, bias=-1.2, cap=1)
    s.paint(s.tube([(11, 22, 2.4), (10, 26, 1.8), (11, 29, 1.5)]), f, bias=-1.2, cap=2)
    s.paint(s.rect(10, 29, 14, 30), f, bias=-1.2, cap=1)
    # tail, bushy with a pale tip
    s.paint(s.tube([(6, 16, 2.2), (3, 14, 2.0), (1, 10, 1.5), (1, 7, 0.9)]), f, tex=fur(0.5), cap=2, sep=True)
    s.paint(s.tube([(1, 9, 1.3), (1, 7, 0.9)]), fl, cap=1, bias=0.2)
    # one lit mass: body + haunch + chest + neck + near legs
    body = s.poly([(5, 17), (9, 13), (17, 12), (24, 13), (26, 18), (24, 23), (10, 24), (6, 22)])
    haunch = s.ell(9.5, 19, 4.8, 5.4)
    legs = s.tube([(8, 23, 2.7), (6, 26, 2.1), (8, 29, 1.7)]) | s.tube([(21, 21, 2.6), (22, 25, 2.0), (22, 29, 1.8)])
    feet = s.rect(6, 29, 11, 30) | s.rect(21, 29, 26, 30)
    neck = s.poly([(20, 11), (25, 9), (27, 15), (25, 21), (20, 19)])
    s.paint(body | haunch | legs | feet | neck, f, tex=fur(0.45), cap=5, bias=0.35, amp=0.3)
    s.bump(9.5, 19, 4.5, 5, 0.9)       # haunch muscle
    s.bump(22, 17, 4, 5, 0.8)          # shoulder
    s.crease([(13, 22), (15, 17), (16, 13)], 0.9, 0.3)   # flank line
    s.crease([(17, 21), (20, 22)], 0.8, 0.2)
    s.paint(s.poly([(12, 23), (22, 22), (21, 24), (13, 25)]), fl, bias=-0.9, cap=2, tex=fur(0.3))
    # head: skull + long muzzle, ears, open jaw
    s.paint(s.ell(25.5, 11.5, 4.2, 3.8), f, bias=0.5, cap=3, sep=True)
    s.paint(s.poly([(26, 10), (31, 12), (31, 15), (27, 16)]), fl, cap=2, bias=0.0, sep=True)
    s.paint(s.poly([(22, 10), (22, 4), (25, 8)]), f, cap=2, bias=0.2)
    s.paint(s.poly([(25, 9), (27, 4), (29, 9)]), f, cap=2, bias=-0.4)
    s.hl([(23, 7), (23, 6)], fl[2])
    s.hl([(27, 10), (28, 10)], M.EYE_AMB)
    s.hl([(27, 9)], M.BLACK)
    s.hl([(31, 12), (30, 12)], M.BLACK)
    s.hl([(27, 15), (28, 15), (29, 15), (30, 15)], M.RED[1])
    s.hl([(28, 16), (30, 16)], M.WHITE)
    s.outline()
    s.shadow(15, 30.5, 13, 1.2, M.SHADOW)
    return s


def skeleton() -> MSpr:
    s = MSpr(S, S)
    b = M.BONE
    # far limbs
    s.paint(s.tube([(11, 12, 1.1), (8, 16, 1.0), (9, 21, 1.0)]), b, bias=-1.3, cap=2)
    s.paint(s.tube([(18, 23, 1.3), (19, 27, 1.1), (20, 29, 1.0)]), b, bias=-1.3, cap=2)
    s.paint(s.rect(19, 29, 23, 30), b, bias=-1.3, cap=1)
    # near leg: femur, knee cap, tibia, foot
    s.paint(s.tube([(14, 23, 1.5), (14, 26, 1.2), (13, 29, 1.1)]) | s.poly([(12, 29), (17, 29), (18, 30), (12, 30)]), b, cap=2)
    s.bump(14, 26.5, 1.9, 1.6, 1.0)
    # pelvis
    s.paint(s.poly([(11, 20), (20, 20), (20, 22), (18, 25), (16, 23), (14, 25), (12, 22)]), b, cap=2)
    s.flat(s.rect(15, 23, 16, 23), b[0])
    # spine + ribcage with real gaps
    s.paint(s.tube([(15.5, 10, 1.0), (15, 20, 1.0)]), b, cap=1, bias=-0.2)
    s.paint(s.ell(15.5, 15.5, 5.2, 4.8), b, cap=4, bias=0.2)
    for y in (13, 15, 17):
        for x in range(11, 21):
            if x not in (15, 16):
                s.px(x, y, b[0])
        s.px(10 + (y % 2), y - 1, b[3])
    s.paint(s.tube([(15.5, 10, 1.0), (15, 20, 1.0)]), b, cap=1, bias=0.2)
    s.paint(s.tube([(11, 11.5, 1.4), (20, 11.5, 1.4)]), b, cap=1, bias=0.4)
    # sword arm
    s.paint(s.tube([(20, 12, 1.2), (23, 16, 1.1), (26, 16, 1.0)]), b, cap=2, sep=True)
    s.flat(s.rect(25, 15, 27, 17), M.IRON[1])
    s.paint(s.stroke([(27, 15), (28, 3)], 2), M.IRON, cap=1, bias=0.2, tex=tex_diag(s, 5, 0.9))
    s.hl([(27, 3), (28, 2)], M.IRON[5])
    s.flat(s.rect(24, 14, 30, 14), M.GOLD[1])
    # skull (3/4: cranium, cheek, jaw, deep orbit with ember)
    s.paint(s.ell(17.5, 6, 4.6, 4.4), b, cap=4, bias=0.3)
    s.paint(s.poly([(16, 9), (22, 9), (21, 12), (16, 12)]), b, cap=2, sep=True)
    s.flat(s.ell(18.8, 6, 1.7, 2.0), b[0])
    s.hl([(19, 6)], M.EYE_RED)
    s.hl([(22, 8), (21, 8)], b[0])
    s.hl([(17, 10), (19, 10), (21, 10)], b[0])
    s.hl([(17, 11), (19, 11), (21, 11)], b[2])
    s.hl([(15, 4)], b[5])
    # rag loincloth with folds
    s.paint(s.poly([(12, 20), (19, 20), (20, 26), (18, 25), (16, 27), (14, 25), (12, 26)]), M.RED, bias=-0.5, cap=2, tex=tex_rows(s, 3, 0.4), sep=True)
    s.outline()
    s.shadow(16, 30.5, 9, 1.1, M.SHADOW)
    return s


def pirate() -> MSpr:
    s = MSpr(S, S)
    # legs and boots (long, believable)
    s.paint(s.tube([(14, 22, 2.2), (13, 27, 1.9)]), M.CLOTHDK, bias=-0.4, cap=2)
    s.paint(s.poly([(10, 26), (15, 26), (16, 30), (10, 30)]), M.LEATHER, bias=-0.8, cap=2)
    s.paint(s.tube([(19, 22, 2.5), (20, 26, 2.1)]), M.CLOTHDK, bias=0.2, cap=2, sep=True)
    s.paint(s.poly([(17, 25), (22, 25), (25, 28), (25, 30), (17, 30)]), M.LEATHER, cap=2, sep=True)
    s.hl([(21, 26), (22, 27)], M.LEATHER[5])
    s.flat(s.rect(17, 25, 22, 25), M.LEATHER[1])
    # far arm on hip
    s.paint(s.tube([(12, 14, 1.8), (9, 18, 1.6), (12, 21, 1.4)]), M.BLUE, bias=-1.2, cap=2)
    # long coat with flare, lapel, sash, shirt
    coat = s.poly([(12, 13), (20, 12), (22, 16), (23, 25), (11, 25), (10, 17)])
    s.paint(coat, M.BLUE, cap=4, tex=tex_rows(s, 6, 0.2))
    s.bump(16, 19, 4, 5, 0.6)
    s.paint(s.poly([(15, 13), (20, 13), (21, 18), (17, 19)]), M.PALE, cap=2, tex=tex_rows(s, 2, 0.25), sep=True)
    s.paint(s.poly([(14, 12), (17, 12), (19, 18), (17, 25), (14, 25)]), M.BLUE, bias=0.3, cap=2, sep=True)
    s.paint(s.poly([(11, 19), (22, 19), (23, 22), (11, 22)]), M.RED, cap=2, tex=tex_diag(s, 4, 0.3), sep=True)
    s.flat(s.rect(16, 19, 18, 21), M.GOLD[3])
    s.hl([(17, 20)], M.GOLD[5])
    s.hl([(15, 14), (15, 16)], M.GOLD[4])
    s.crease([(18, 18), (19, 24)], 0.9, 0.3)
    # head
    s.paint(s.ell(18, 8.5, 4.0, 4.4), M.SKIN, cap=3)
    s.paint(s.poly([(15, 10), (22, 10), (22, 14), (18, 16), (15, 13)]), M.LEATHER, bias=-0.3, cap=2, sep=True, tex=tex_fur(s, 0.4))
    s.hl([(20, 11), (21, 11), (22, 11)], M.LEATHER[2])
    s.hl([(21, 9), (22, 9)], M.SKIN[3])
    s.hl([(22, 8)], M.SKIN[5])
    # tricorn
    s.paint(s.poly([(11, 6), (14, 2), (22, 1), (26, 5), (22, 6), (16, 5)]), M.CLOTHDK, bias=0.4, cap=2, sep=True)
    s.flat(s.rect(14, 5, 23, 5), M.GOLD[2])
    s.hl([(18, 3), (19, 3)], M.WHITE)
    # eyepatch + good eye
    s.hl([(19, 7), (20, 8), (21, 8), (22, 9)], M.BLACK)
    s.hl([(21, 7)], M.WHITE)
    s.hl([(22, 7)], M.BLACK)
    s.hl([(16, 7)], M.GOLD[4])  # earring
    # sword arm + cutlass
    s.paint(s.tube([(21, 14, 2.0), (24, 18, 1.8), (27, 17, 1.5)]), M.BLUE, cap=2, sep=True)
    s.flat(s.rect(27, 16, 28, 18), M.SKIN[2])
    s.paint(s.poly([(28, 15), (30, 9), (29, 4), (28, 5), (28, 9), (27, 15)]), M.IRON, cap=1, bias=0.8)
    s.hl([(29, 4), (29, 5)], M.IRON[5])
    s.flat(s.rect(25, 15, 30, 15), M.GOLD[3])
    s.outline()
    s.shadow(16, 30.5, 11, 1.1, M.SHADOW)
    return s


def mummy() -> MSpr:
    s = MSpr(S, S)
    w = M.WRAP
    # per-region wrap directions so limbs and torso read as separately bound
    far_arm = s.tube([(13, 14, 2.0), (18, 15, 1.7), (23, 16, 1.6)])
    s.paint(far_arm, w, bias=-1.2, cap=2, tex=tex_wrap(s, 70, 4, 1, 1.5))
    far_leg = s.tube([(13, 22, 2.6), (11, 26, 2.1), (11, 29, 1.9)]) | s.rect(9, 29, 14, 30)
    s.paint(far_leg, w, bias=-1.0, cap=2, tex=tex_wrap(s, 20, 4, 2, 1.5))
    torso = s.poly([(9, 14), (14, 11), (20, 12), (22, 18), (21, 25), (12, 25), (10, 20)])
    near_leg = s.tube([(17, 22, 3.0), (19, 26, 2.5), (19, 29, 2.2)]) | s.rect(17, 29, 23, 30)
    head = s.ell(17, 7.5, 4.6, 4.8)
    near_arm = s.tube([(19, 14, 2.4), (24, 15, 2.0), (28, 16, 1.8)]) | s.ell(29.5, 16.5, 1.8, 1.6)
    tex = np.zeros((S, S))
    for m_, th, per, sd in ((torso, 35, 4, 3), (near_leg, 15, 4, 4), (head, 70, 4, 5), (near_arm, 80, 4, 6)):
        tex = np.where(m_, tex_wrap(s, th, per, sd, 1.6), tex)
    s.paint(torso | near_leg | head | near_arm, w, cap=5, tex=tex, amp=0.0, bias=0.1)
    s.bump(15, 18, 4, 5, 0.5)
    # eye gap: wrap parts to reveal dark, ember eyes
    s.flat(s.rect(15, 6, 21, 8), M.CLOTHDK[0])
    s.hl([(17, 7), (18, 7), (20, 7), (21, 7)], M.EYE_RED)
    s.hl([(17, 6), (20, 6)], M.EYE_YEL)
    s.hl([(19, 6), (19, 7), (19, 8)], w[2])  # strip crossing between the eyes
    # rot staining and a torn hole showing the dark body
    s.adjust(s.ell(13.5, 21, 2.2, 2.6) & s.a, -1.0)
    s.flat(s.rect(14, 17, 15, 18), M.CLOTHDK[1])
    # dangling loose strips
    for pts in (((25, 17, 0.9), (26, 20, 0.8), (25, 24, 0.6)), ((11, 24, 0.9), (8, 27, 0.8), (6, 29, 0.6)), ((13, 6, 0.8), (10, 10, 0.8), (9, 14, 0.6))):
        s.paint(s.tube(list(pts)), w, bias=-0.4, cap=1)
    s.outline()
    s.shadow(16, 30.5, 10, 1.1, M.SHADOW)
    return s


def cockatrice() -> MSpr:
    s = MSpr(S, S)
    t, g = M.TEAL, M.GOBLIN
    gold = M.GOLD
    # serpent tail rising behind, with a small head and forked tongue
    s.paint(s.tube([(10, 20, 2.3), (5, 21, 2.0), (3, 17, 1.8), (3, 13, 1.5), (6, 10, 1.2)]), g, cap=2, tex=tex_scales(s, 3, 0.7), sep=True)
    s.paint(s.ell(8, 9, 2.5, 1.9), g, cap=1, bias=0.3, sep=True)
    s.hl([(9, 8)], M.EYE_YEL)
    s.hl([(10, 10), (11, 10), (12, 11), (12, 9)], M.RED[4])
    # rooster sickle tail feathers
    s.paint(s.poly([(9, 17), (5, 14), (2, 16), (3, 21), (8, 22)]), M.ROBE, bias=0.0, cap=2, tex=tex_rows(s, 3, 0.5), sep=True)
    # legs: scaly, with distinct toes and spur
    for (x, y, lit_) in ((14, 23, 0), (19, 23, 1)):
        s.paint(s.tube([(x, y, 1.5), (x, 27, 1.2)]), gold, bias=-1.0 + lit_ * 0.9, cap=1, tex=tex_rows(s, 2, 0.5), sep=bool(lit_))
        fx, fy = x, 28
        for dx, dy in ((4, 2), (2, 2), (-3, 2)):
            s.hl([(fx + dx * k // 4, fy + (dy * k) // 4) for k in range(1, 5)], gold[3 if lit_ else 1])
        s.hl([(fx + 4, fy + 2), (fx + 2, fy + 2), (fx - 3, fy + 2)], gold[0])
    # body: breast puff, belly, back
    s.paint(s.poly([(7, 18), (11, 14), (18, 14), (23, 17), (22, 23), (16, 25), (9, 23)]), t, cap=5, tex=tex_scales(s, 3, 0.35), bias=0.2)
    s.bump(15, 18, 6, 4, 0.5)
    s.paint(s.poly([(14, 21), (22, 20), (21, 24), (16, 25)]), M.BELLY, bias=-0.3, cap=2, tex=tex_scales(s, 3, 0.25))
    # folded wing: covert rows light, flight feathers darker with pale tips
    wing = s.poly([(17, 13), (21, 16), (20, 21), (14, 25), (8, 24), (10, 20), (13, 15)])
    s.paint(wing, M.ROBE, cap=4, bias=0.4, tex=tex_scales(s, 3, 0.7), sep=True)
    s.paint(s.poly([(9, 24), (14, 25), (13, 23), (11, 22)]), M.ROBE, bias=-0.6, cap=1)
    s.hl([(8, 24), (10, 25), (12, 25), (14, 25)], t[5])
    s.crease([(13, 15), (10, 20), (8, 23)], 0.9, 0.3)
    # neck + head
    s.paint(s.tube([(19, 16, 3.0), (21, 11, 2.4), (23, 8, 2.2)]) | s.ell(24, 7, 3.4, 3.2), t, cap=4, tex=tex_scales(s, 3, 0.35), sep=True, bias=0.2)
    s.paint(s.poly([(26, 5), (31, 8), (26, 10)]), gold, cap=2, bias=0.2, sep=True)
    s.px(29, 8, gold[0])
    for cx, cy in ((22, 3), (24, 2), (26, 3)):
        s.paint(s.ell(cx, cy, 1.5, 1.7), M.RED, cap=2)
    s.paint(s.ell(27, 11, 1.2, 2.2), M.RED, cap=1, bias=0.3)
    s.hl([(25, 6), (26, 6)], M.EYE_YEL)
    s.hl([(26, 6)], M.BLACK)
    s.hl([(25, 5)], t[0])
    s.outline()
    s.shadow(15, 30.5, 11, 1.1, M.SHADOW)
    return s


def vampire() -> MSpr:
    s = MSpr(S, S)
    p = M.PURPLE
    # cape: dark outer, crimson lining facing us, scalloped hem; separated from the body by a gap of shadow
    cape = s.poly([(15, 12), (21, 12), (20, 22), (18, 29), (15, 27), (12, 30), (9, 27), (5, 30), (4, 24), (8, 17)])
    s.paint(cape, p, cap=5, bias=-0.4, tex=tex_diag(s, 6, 0.4, slope=-1))
    lining = s.poly([(14, 13), (9, 18), (5, 27), (8, 28), (11, 26), (14, 28), (15, 20)])
    s.paint(lining, M.CRIMSON, bias=0.0, cap=3, tex=tex_diag(s, 6, 0.5, slope=-1), sep=True)
    s.crease([(15, 14), (14, 20), (13, 27)], 1.0, 0.4)
    # slim legs, pointed shoes
    s.paint(s.tube([(16, 23, 1.7), (15, 27, 1.4)]) | s.poly([(12, 28), (16, 28), (17, 30), (12, 30)]), M.CLOTHDK, cap=2, bias=0.0)
    s.paint(s.tube([(20, 23, 1.9), (21, 27, 1.6)]) | s.poly([(19, 28), (23, 28), (26, 30), (19, 30)]), M.CLOTHDK, cap=2, bias=0.4, sep=True)
    # frock coat with waistcoat, cravat and gold buttons
    s.paint(s.poly([(14, 13), (21, 13), (22, 18), (23, 26), (13, 26), (13, 18)]), M.CLOTHDK, cap=4, bias=1.1)
    s.bump(17, 18, 3, 5, 0.5)
    s.paint(s.poly([(17, 13), (21, 13), (21, 22), (18, 23)]), M.CRIMSON, cap=2, bias=0.1, sep=True)
    s.paint(s.poly([(17, 12), (21, 12), (20, 16), (18, 16)]), M.PALE, cap=1, bias=0.3)
    s.hl([(19, 18), (19, 20), (19, 22)], M.GOLD[4])
    s.crease([(16, 18), (15, 25)], 0.8, 0.3)
    # tall collar behind the head
    s.paint(s.poly([(13, 13), (12, 5), (17, 10), (17, 13)]), M.CRIMSON, bias=0.2, cap=2, sep=True)
    # head, 3/4 view: nose bump, narrow chin
    s.paint(s.ell(18.8, 8.2, 3.4, 4.2) | s.poly([(19, 11), (22, 11), (20, 14), (18, 13)]), M.PALE, cap=3, bias=0.2)
    s.paint(s.poly([(15, 7), (15, 3), (19, 1), (23, 3), (22, 6), (19, 4.5), (18, 7), (16, 10)]), M.CLOTHDK, cap=2, bias=-0.3)
    s.paint(s.stroke([(15, 6), (13, 12)], 1), M.CLOTHDK, cap=1, bias=0.2)
    s.hl([(21, 7), (22, 7)], M.EYE_RED)
    s.hl([(21, 7)], M.WHITE)
    s.hl([(20, 6), (21, 6), (22, 6)], M.CLOTHDK[0])
    s.hl([(23, 9)], M.PALE[1])
    s.hl([(21, 11), (22, 11)], M.CRIMSON[2])
    s.hl([(21, 12), (22, 12)], M.WHITE)
    s.adjust(s.ell(20.5, 9.5, 2.5, 3) & s.a, 0.4)
    # reaching arm: black sleeve, crimson cuff, long pale fingers
    s.paint(s.tube([(20, 15, 2.0), (24, 17, 1.7), (27, 16, 1.4)]), M.CLOTHDK, cap=2, bias=0.6, sep=True)
    s.paint(s.ell(27.5, 16, 1.5, 1.6), M.CRIMSON, cap=1)
    s.paint(s.ell(29, 15.5, 1.4, 1.5), M.PALE, cap=1, sep=True)
    s.hl([(30, 13), (31, 12), (31, 14), (31, 16), (30, 17)], M.PALE[4])
    s.outline()
    s.shadow(15, 30.5, 11, 1.1, M.SHADOW)
    return s
