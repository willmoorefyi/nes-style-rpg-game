"""The legacy 16x16 tiles of pass NW's cold terrains (docs/NATURAL_WORLD_PLAN.md 2.6, D-NW9), rows 12 and 13 of the
terrain sheet (`tiles.TERRAIN_ORDER`): tundra (grey-green moss with frost specks; the airship lands on it) and snow
(a snowfield with soft drifts; it never does). Both walk like grass. The runtime reads the rows from NW-5 on."""
import snes_palette as P

TUNDRA = P.ramp((8, 10, 8), (11, 14, 10), (15, 18, 13), (19, 21, 16), (23, 25, 20))


def tundra(v: int, rng):
    from tiles import T, Canvas, speckle
    t, s = TUNDRA, P.SNOW
    cv = Canvas()
    cv.fill(t[2])
    speckle(cv, rng, t[1], 24)
    speckle(cv, rng, t[3], 12)
    for _ in range(2 + v % 2):                 # moss tufts
        x, y = rng.randrange(1, T - 2), rng.randrange(1, T - 2)
        cv.set(x, y, t[0])
        cv.set(x + 1, y, t[1])
        cv.set(x, y + 1, t[1])
    speckle(cv, rng, s[2], 4 + v)
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
