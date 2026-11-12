"""Boss (96x96) monsters: lich. Faces RIGHT, light from top-left."""
import random

import monster_palette as M
from art_helpers import Spr, tex_diag, tex_noise, tex_rows

B = 96


def _aura(s: Spr, cx: float, cy: float, rng) -> None:
    """Dithered necrotic glow, drawn only behind the sprite (empty pixels)."""
    d = ((s.xs - cx) / 1.05) ** 2 + ((s.ys - cy) / 1.0) ** 2
    d = d ** 0.5
    chk = (s.xs + s.ys) % 2 == 0
    sparse = (s.xs % 2 == 0) & (s.ys % 2 == 0)
    free = ~s.a
    for lo, hi, col, pat in ((0, 26, M.NECRO[0], None), (26, 34, M.NECRO[0], chk), (34, 41, M.NECRO[0], sparse)):
        m = (d >= lo) & (d < hi) & free
        if pat is not None:
            m &= pat
        s.rgb[m] = col
        s.a |= m
    inner = (d < 20) & free & chk
    s.rgb[inner] = M.NECRO[1]
    for _ in range(26):  # drifting motes
        x, y = rng.randrange(6, 90), rng.randrange(4, 80)
        if not s.a[y, x] or (s.rgb[y, x] == M.NECRO[0]).all() or (s.rgb[y, x] == M.NECRO[1]).all():
            s.px(x, y, M.NECRO[3 if rng.random() < 0.6 else 4])


def lich() -> Spr:
    s = Spr(B, B)
    rng = random.Random("lich")
    r = M.ROBE
    nz = lambda a=0.25: tex_noise(s, rng, a)
    # staff (far hand), behind the robes
    s.paint(s.stroke([(19, 12), (21, 90)], 3), M.WOOD, cap=1, bias=-0.3)
    s.paint(s.ell(20, 8, 6, 6), M.BONE, cap=3, bias=0.2)
    s.flat(s.rect(17, 7, 19, 9), M.BLACK)
    s.flat(s.rect(22, 7, 24, 9), M.BLACK)
    s.px(18, 8, M.EYE_GRN)
    s.px(23, 8, M.EYE_GRN)
    s.paint(s.poly([(14, 12), (26, 12), (25, 15), (15, 15)]), M.BONE, cap=1, bias=-0.3)
    s.paint(s.ell(20, 0.5, 4, 4), M.NECRO, cap=2, bias=0.4)
    # tattered robe
    hem = [(76, 86), (71, 91), (65, 86), (59, 92), (52, 86), (45, 92), (38, 86), (31, 91), (25, 85), (17, 90)]
    robe = s.poly([(33, 32), (47, 27), (62, 31), (68, 50), (74, 70)] + hem + [(22, 70), (28, 50)])
    s.paint(robe, r, cap=8, bias=0.15, tex=tex_diag(s, 8, 0.45, slope=-1) + nz(0.15), gain=1.1)
    # folds
    for x0 in (30, 40, 56, 66):
        s.paint(s.stroke([(x0, 52), (x0 - 4 + (x0 % 3), 88)], 1), r, bias=-0.9, cap=1)
    # glowing inner chest cavity with ribs
    s.paint(s.poly([(39, 34), (56, 34), (54, 62), (47, 70), (41, 62)]), M.CLOTHDK, bias=-0.6, cap=2)
    for y in (39, 44, 49, 54, 59):
        w = 6 - abs(y - 46) // 5
        s.flat(s.rect(47 - w, y, 47 + w, y), M.BONE[2])
        s.flat(s.rect(47 - w, y + 1, 47 + w, y + 1), M.BONE[0])
    s.flat(s.rect(46, 36, 48, 62), M.BONE[1])
    s.paint(s.ell(47, 50, 3.2, 3.2), M.NECRO, cap=2, bias=0.5)
    # gold belt
    s.paint(s.stroke([(25, 70), (72, 72)], 3), M.GOLD, cap=1, bias=-0.2, tex=tex_diag(s, 4, 0.5))
    s.paint(s.ell(47, 71, 3, 3), M.NECRO, cap=2, bias=0.5, sep=True)
    # mantle + shoulder spikes
    s.paint(s.poly([(24, 36), (31, 27), (47, 24), (63, 27), (70, 38), (62, 44), (32, 44)]), M.PURPLE, cap=5, bias=0.0, tex=tex_diag(s, 6, 0.35), sep=True)
    for (x, y, dx) in ((29, 29, -9), (66, 29, 10)):
        s.paint(s.poly([(x - 3, y + 3), (x + dx, y - 14), (x + 4, y + 2)]), M.BONE, cap=2, bias=-0.1)
    # hood
    s.paint(s.poly([(33, 22), (35, 8), (47, 3), (59, 8), (61, 24), (56, 32), (38, 32)]), r, cap=6, bias=-0.3, sep=True)
    # skull
    s.paint(s.ell(48, 17, 10, 10.5), M.BONE, cap=6, bias=0.2)
    s.paint(s.poly([(42, 24), (59, 24), (57, 31), (46, 31)]), M.BONE, cap=3, bias=-0.1, sep=True)
    s.flat(s.rect(41, 14, 47, 19), M.BLACK)
    s.flat(s.rect(51, 14, 58, 19), M.BLACK)
    s.flat(s.rect(43, 15, 46, 17), M.EYE_GRN)
    s.flat(s.rect(53, 15, 56, 17), M.EYE_GRN)
    s.pxs([(44, 15), (54, 15)], M.WHITE)
    s.pxs([(49, 21), (50, 21), (49, 22), (50, 22)], M.BONE[0])
    s.flat(s.rect(44, 27, 57, 28), M.BONE[0])
    for x in range(45, 57, 2):
        s.px(x, 27, M.BONE[4])
        s.px(x, 29, M.BONE[2])
    # crown
    s.paint(s.poly([(38, 8), (40, 0), (44, 6), (48, 0), (52, 6), (56, 0), (58, 8)]), M.GOLD, cap=2, bias=0.2)
    s.flat(s.rect(38, 7, 58, 9), M.GOLD[1])
    s.pxs([(48, 7), (48, 8)], M.EYE_RED)
    # far arm to staff
    s.paint(s.tube([(32, 40, 5), (26, 48, 4.2), (22, 54, 3.2)]), M.PURPLE, bias=-0.5, cap=3)
    s.paint(s.ell(21, 55, 3.2, 3.2), M.BONE, cap=2, bias=-0.3, sep=True)
    # near arm casting
    s.paint(s.tube([(62, 38, 6), (72, 44, 5.2), (78, 46, 3.6)]), M.PURPLE, cap=4, bias=0.2, sep=True)
    s.paint(s.ell(82, 46, 3.4, 3.2), M.BONE, cap=2, sep=True)
    for (x0, y0, x1, y1) in ((84, 44, 89, 40), (85, 46, 90, 45), (84, 48, 89, 50)):
        s.paint(s.stroke([(x0, y0), (x1, y1)], 1), M.BONE, cap=1, bias=0.2)
    # necrotic orb
    s.paint(s.ell(86, 33, 7.5, 7.5), M.NECRO, cap=5, bias=0.5, tex=tex_diag(s, 5, 0.3), amp=0.7)
    s.paint(s.ell(84, 31, 2.5, 2.5), M.NECRO, cap=1, bias=3.0)
    s.outline()
    _aura(s, 48, 46, rng)
    s.shadow(48, 92.5, 34, 2.0, M.SHADOW)
    return s
