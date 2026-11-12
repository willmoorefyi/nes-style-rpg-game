"""Procedural 16x16 SNES-style terrain tiles.

Terrain order matches TerrainType in src/types/index.ts. Each terrain gets
VARIANTS visual variants so large fields do not look like wallpaper. Variants are
tileable: no feature touches a tile edge unless it is designed to continue across it.
"""
import random
from PIL import Image

import snes_palette as P

T = 16
VARIANTS = 4
TERRAIN_ORDER = [
    "grass", "wall", "water", "mountain", "forest", "desert",
    "swamp", "river", "road", "bridge", "counter",
]


class Canvas:
    def __init__(self) -> None:
        self.img = Image.new("RGBA", (T, T), (0, 0, 0, 0))
        self.px = self.img.load()

    def set(self, x: int, y: int, col) -> None:
        if 0 <= x < T and 0 <= y < T:
            self.px[x, y] = (*col, 255)

    def fill(self, col) -> None:
        for y in range(T):
            for x in range(T):
                self.set(x, y, col)

    def rect(self, x0: int, y0: int, x1: int, y1: int, col) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, col)

    def disc(self, cx: float, cy: float, r: float, col) -> None:
        for y in range(T):
            for x in range(T):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    self.set(x, y, col)

    def get(self, x: int, y: int):
        return self.px[x % T, y % T][:3]


def speckle(cv: Canvas, rng, col, count: int) -> None:
    for _ in range(count):
        cv.set(rng.randrange(T), rng.randrange(T), col)


def grass(v: int, rng) -> Image.Image:
    g = P.GRASS
    cv = Canvas()
    cv.fill(g[2])
    speckle(cv, rng, g[1], 22)
    speckle(cv, rng, g[3], 14)
    for _ in range(3 + v % 2):
        x, y = rng.randrange(1, T - 1), rng.randrange(1, T - 2)
        cv.set(x, y, g[4])
        cv.set(x, y + 1, g[3])
        cv.set(x + 1, y + 1, g[1])
        cv.set(x - 1, y + 1, g[1])
    if v == 3:
        fx, fy = rng.randrange(3, 13), rng.randrange(3, 12)
        cv.set(fx, fy + 1, g[0])
        for dx, dy in ((0, 0), (-1, 0), (1, 0), (0, -1)):
            cv.set(fx + dx, fy + dy, P.c15(31, 29, 26))
        cv.set(fx, fy, P.c15(31, 24, 4))
    return cv.img


def water(v: int, rng) -> Image.Image:
    w = P.WATER
    cv = Canvas()
    cv.fill(w[2])
    speckle(cv, rng, w[1], 18)
    for i in range(3):
        y = (3 + i * 5 + v * 2) % T
        x = rng.randrange(0, 10)
        ln = rng.randrange(3, 6)
        for k in range(ln):
            cv.set(x + k, y, w[3])
            cv.set(x + k + 1, y + 1, w[1])
    for _ in range(2):
        cv.set(rng.randrange(T), rng.randrange(T), w[4])
    return cv.img


def river(v: int, rng) -> Image.Image:
    w = P.WATER
    cv = Canvas()
    cv.fill(w[2])
    speckle(cv, rng, w[1], 10)
    for i in range(4):
        x = (2 + i * 4 + v) % T
        y = rng.randrange(0, 10)
        ln = rng.randrange(3, 7)
        for k in range(ln):
            cv.set(x, (y + k) % T, w[3])
            cv.set(x + 1, (y + k) % T, w[1])
    speckle(cv, rng, w[4], 3)
    return cv.img


def road(v: int, rng) -> Image.Image:
    d = P.DIRT
    cv = Canvas()
    cv.fill(d[2])
    speckle(cv, rng, d[1], 26)
    speckle(cv, rng, d[3], 18)
    for _ in range(3):
        x, y = rng.randrange(1, T - 2), rng.randrange(1, T - 2)
        cv.set(x, y, d[4])
        cv.set(x + 1, y, d[3])
        cv.set(x, y + 1, d[1])
        cv.set(x + 1, y + 1, d[0])
    return cv.img


def desert(v: int, rng) -> Image.Image:
    s = P.SAND
    cv = Canvas()
    cv.fill(s[2])
    speckle(cv, rng, s[1], 14)
    speckle(cv, rng, s[3], 14)
    for i in range(2):
        y0 = (4 + i * 7 + v * 3) % T
        for x in range(T):
            y = y0 + (1 if 5 < x < 11 else 0) + (1 if x > 11 else 0)
            cv.set(x, y % T, s[3])
            cv.set(x, (y + 1) % T, s[1])
            if x % 3 == 0:
                cv.set(x, (y + 2) % T, s[0])
    if v == 2:
        cv.rect(10, 9, 12, 10, P.STONE[2])
        cv.rect(10, 9, 11, 9, P.STONE[3])
        cv.rect(10, 11, 12, 11, s[0])
    return cv.img


def swamp(v: int, rng) -> Image.Image:
    sw, m = P.SWAMP, P.MURK
    cv = Canvas()
    cv.fill(sw[2])
    speckle(cv, rng, sw[1], 24)
    speckle(cv, rng, sw[3], 10)
    for _ in range(2):
        cx, cy = rng.randrange(4, 12), rng.randrange(4, 12)
        cv.disc(cx, cy, 2.6, m[0])
        cv.disc(cx, cy, 1.9, m[1])
        cv.set(int(cx) - 1, int(cy) - 1, m[3])
        cv.set(int(cx), int(cy), m[2])
    for _ in range(2):
        x, y = rng.randrange(1, T - 1), rng.randrange(5, T - 1)
        for k in range(4):
            cv.set(x, y - k, P.LEAF[3] if k < 3 else P.LEAF[4])
        cv.set(x, y - 4, P.WOOD[2])
        cv.set(x, y - 5, P.WOOD[3])
    return cv.img


def tree(cv: Canvas, cx: int, cy: int, r: float) -> None:
    L, W = P.LEAF, P.WOOD
    cv.rect(cx - 1, cy + int(r) - 1, cx, cy + int(r) + 2, W[1])
    cv.set(cx - 1, cy + int(r), W[2])
    cv.disc(cx, cy + 0.5, r + 1, L[0])
    cv.disc(cx, cy + 0.5, r, L[2])
    cv.disc(cx - 1, cy - 0.5, r - 1.3, L[3])
    cv.set(cx - 2, cy - 2, L[4])
    cv.set(cx - 1, cy - 3, L[4])
    cv.set(cx + 2, cy + 2, L[1])
    cv.set(cx + 1, cy + 3, L[1])


def forest(v: int, rng) -> Image.Image:
    cv = Canvas()
    cv.fill(P.LEAF[1])
    speckle(cv, rng, P.LEAF[0], 20)
    layouts = [
        [(4, 5), (12, 5), (8, 11)],
        [(5, 4), (11, 6), (4, 12), (12, 13)],
        [(8, 4), (3, 9), (13, 10), (8, 13)],
        [(4, 4), (12, 4), (4, 12), (12, 12)],
    ]
    for cx, cy in layouts[v]:
        tree(cv, cx, cy, 3.4)
    return cv.img


def mountain(v: int, rng) -> Image.Image:
    R, S, G = P.ROCK, P.SNOW, P.GRASS
    cv = Canvas()
    cv.fill(G[2])
    speckle(cv, rng, G[1], 16)
    speckle(cv, rng, G[3], 8)
    apex_x = [8, 7, 9, 8][v]
    top = [1, 2, 1, 2][v]
    base = 14
    for y in range(top, base + 1):
        half = (y - top) * 0.6 + 0.6
        left, right = round(apex_x - half), round(apex_x + half)
        for x in range(left, right + 1):
            if x == left or x == right or y == base:
                col = R[0]
            elif x < apex_x:
                col = R[3] if (x + y) % 5 else R[4]
            else:
                col = R[1] if (x + y) % 4 else R[0]
            cv.set(x, y, col)
    for y in range(top, top + 4):
        half = (y - top) * 0.6 + 0.6
        left, right = round(apex_x - half) + 1, round(apex_x + half) - 1
        for x in range(left, right + 1):
            cv.set(x, y, S[3] if x < apex_x else S[1])
    cv.set(apex_x - 1, top + 1, S[4])
    for x in range(1, T - 1):
        if cv.get(x, base + 1) != P.c15(0, 0, 0):
            cv.set(x, base + 1, G[0] if x % 2 else G[1])
    return cv.img


def wall(v: int, rng) -> Image.Image:
    k = P.STONE
    cv = Canvas()
    cv.fill(k[0])
    rows = [(0, 3), (4, 7), (8, 11), (12, 15)]
    for i, (y0, y1) in enumerate(rows):
        off = 0 if i % 2 == 0 else 4
        for bx in range(-8, T + 8, 8):
            x0 = bx + off
            for y in range(y0, y1):
                for x in range(x0, x0 + 7):
                    col = k[2]
                    if y == y0:
                        col = k[3]
                    elif y == y1 - 1:
                        col = k[1]
                    if x == x0:
                        col = k[3] if y != y1 - 1 else k[1]
                    cv.set(x, y, col)
            cv.set(x0 + 2, y0 + 1, k[4])
    speckle(cv, rng, k[1], 8)
    if v == 2:
        for x, y in ((3, 6), (4, 7), (4, 8), (5, 9)):
            cv.set(x, y, k[0])
    if v == 3:
        for x, y in ((9, 2), (10, 2), (9, 3), (10, 11), (11, 11)):
            cv.set(x, y, P.LEAF[2])
    return cv.img


def bridge(v: int, rng) -> Image.Image:
    w, W = P.WATER, P.WOOD
    cv = Canvas()
    cv.fill(w[2])
    speckle(cv, rng, w[1], 10)
    speckle(cv, rng, w[3], 6)
    cv.rect(0, 3, T - 1, 12, W[0])
    for bx in range(0, T, 4):
        cv.rect(bx, 4, bx + 2, 11, W[3])
        cv.rect(bx, 4, bx, 11, W[4])
        cv.rect(bx + 2, 4, bx + 2, 11, W[2])
        cv.set(bx + 1, 6 + (bx // 4) % 3, W[2])
    cv.rect(0, 1, T - 1, 2, W[2])
    cv.rect(0, 1, T - 1, 1, W[4])
    cv.rect(0, 13, T - 1, 14, W[2])
    cv.rect(0, 14, T - 1, 14, W[1])
    cv.rect(0, 15, T - 1, 15, w[0])
    for post in (0, 8):
        cv.rect(post, 0, post + 1, 3, W[3])
        cv.rect(post, 12, post + 1, 15, W[3])
        cv.set(post, 0, W[4])
        cv.set(post, 12, W[4])
    return cv.img


def counter(v: int, rng) -> Image.Image:
    W = P.WOOD
    cv = Canvas()
    cv.fill(W[2])
    cv.rect(0, 0, T - 1, 6, W[3])
    cv.rect(0, 0, T - 1, 0, W[4])
    cv.rect(0, 6, T - 1, 6, W[1])
    for x in range(0, T, 4):
        cv.rect(x, 7, x, 15, W[1])
        cv.rect(x + 1, 8, x + 1, 14, W[3])
    cv.rect(0, 15, T - 1, 15, W[0])
    for x in (2, 7, 11):
        cv.set(x, 3, W[2])
        cv.set(x + 1, 3, W[2])
    return cv.img


GENERATORS = {
    "grass": grass, "wall": wall, "water": water, "mountain": mountain,
    "forest": forest, "desert": desert, "swamp": swamp, "river": river,
    "road": road, "bridge": bridge, "counter": counter,
}


def build_terrain_sheet() -> Image.Image:
    """Rows = terrain (TERRAIN_ORDER), columns = variants. Native 16px tiles."""
    sheet = Image.new("RGBA", (T * VARIANTS, T * len(TERRAIN_ORDER)), (0, 0, 0, 0))
    for row, name in enumerate(TERRAIN_ORDER):
        for v in range(VARIANTS):
            rng = random.Random(f"{name}:{v}")
            sheet.paste(GENERATORS[name](v, rng), (v * T, row * T))
    return sheet
