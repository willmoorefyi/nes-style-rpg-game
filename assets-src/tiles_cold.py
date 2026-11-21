"""The legacy 16x16 tiles of the cold terrains (docs/NATURAL_WORLD_PLAN.md 2.6, D-NW9; docs/NW2_EDITS_PLAN.md 3,
D-NW2-4), rows 12 and 13 of the terrain sheet (`tiles.TERRAIN_ORDER`): taiga (dark conifers on snowy ground, snow on
their lit upper-left; walked at forest's speed, the airship never lands on it; tundra before NW2) and snow (a
snowfield with soft drifts; walkable, no landing either)."""
import snes_palette as P

# dark blue-green needles, darkest -> lightest (15-bit values); darker and bluer than the forest's LEAF ramp
NEEDLE = P.ramp((2, 5, 5), (3, 8, 7), (5, 11, 9), (7, 14, 11), (10, 17, 14))
LAYOUTS = [[(3, 0), (11, 1), (7, 7), (14, 8), (2, 9)], [(5, 0), (13, 2), (2, 6), (9, 7), (13, 10)],
           [(8, 0), (2, 3), (13, 5), (6, 8), (11, 10)], [(3, 1), (10, 0), (14, 6), (6, 7), (1, 10)]]
HALF = (0, 1, 1, 2, 1, 2, 3, 3)                  # a conifer's half-width per row: three tiers widening down


def conifer(cv, cx: int, top: int) -> None:
    """A conifer from row `top`, apex at column cx: three tiers (HALF), a 1 px trunk, the lit (left) side lighter,
    a dark outline, and snow on the upper-left shoulder of each tier."""
    n, s = NEEDLE, P.SNOW
    for y, half in enumerate(HALF):
        new_tier = y == 0 or half < HALF[y - 1] or (y > 0 and HALF[y - 1] < half and y in (1, 3, 6))
        for x in range(cx - half, cx + half + 1):
            edge = x in (cx - half, cx + half) and half > 0
            col = n[0] if edge or y == len(HALF) - 1 else (n[3] if x < cx else n[1] if x > cx else n[2])
            if new_tier and x <= cx and x >= cx - max(half - 1, 0):
                col = s[4] if x == cx - max(half - 1, 0) else s[3]     # snow on the tier's lit shoulder
            cv.set(x, top + y, col)
    cv.set(cx, top + len(HALF), P.WOOD[1])


def taiga(v: int, rng):
    from tiles import Canvas, speckle
    s = P.SNOW
    cv = Canvas()
    cv.fill(s[2])
    speckle(cv, rng, s[1], 24)
    speckle(cv, rng, s[3], 10)
    for cx, top in LAYOUTS[v]:
        conifer(cv, cx, top)
    return cv.img


def snow(v: int, rng):
    from tiles import T, Canvas, speckle
    s = P.SNOW
    cv = Canvas()
    cv.fill(s[3])
    speckle(cv, rng, s[2], 18)
    speckle(cv, rng, s[4], 12)
    y = (4 + 5 * v) % (T - 2)                  # one soft drift line
    x = rng.randrange(0, 6)
    for k in range(rng.randrange(5, 9)):
        cv.set(x + k, y, s[1])
        cv.set(x + k + 1, y + 1, s[2])
    return cv.img
