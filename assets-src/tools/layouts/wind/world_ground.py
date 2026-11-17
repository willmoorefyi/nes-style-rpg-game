"""The ground of region WIND (docs/WORLD_PLAN.md 2.4, 2.8, 4.7): a rugged north-eastern continent, in world cells.

Land defaults to mountain (the continent is a tangle of ranges) and three walkable basins are carved out of it, never
joined on foot:
- **Gaia's bowl** in the north: a grass floor in a ring of peaks, round Gaia's site, with a crater tarn, a pine grove
  and the landing meadow; a wind-gap in its east rim opens onto the **Pinewold**, a forested upland on the east coast;
- **the Mirage sands** in the south-west: a sand sea with a broken stone spine running through it, the tower on a
  spit at the west coast, a dry salt pan and the oasis meadow where the airship lands;
- **Lufenia's mesa** in the south: a grass and moor table ringed by cliffs, cut off from the sands by the Sundering,
  a sea fjord that runs in from the west coast under the mesa's north-west wall.

Everything here is drawn from shapes (ellipses and polygons), so the layout is deterministic and needs no RNG.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import polygon_mask  # noqa: E402

X0, Y0, W, H = 128, 0, 64, 64                    # the WIND box (world cells), 2.4
GRASS, FOREST, MOUNT, SAND, OCEAN, SWAMP, LAKE = ".", "f", "m", "s", "o", "w", "≈"

# the continent's outline (world cells, clockwise from the north-west)
COAST = [(137, 5), (147, 4), (158, 6), (166, 3), (177, 5), (186, 9), (188, 18), (184, 24), (188, 31), (185, 39),
         (187, 47), (181, 55), (171, 58), (162, 60), (150, 59), (141, 57), (137, 52), (135, 48), (131, 47), (130, 41),
         (131, 32), (134, 26), (132, 19), (134, 11)]
# the Sundering: a fjord in from the west coast between the sands (north) and the mesa (south)
FJORD = [(129, 44), (139, 44), (145, 45), (147, 46), (140, 47), (129, 47)]
# two sea lochs biting into the east coast (the Pinewold's shore is rugged)
LOCHS = [[(189, 22), (181, 23), (175, 24), (181, 26), (189, 26)], [(189, 41), (182, 42), (178, 44), (183, 45), (189, 45)]]


def _ellipse(cx: float, cy: float, rx: float, ry: float) -> set[tuple[int, int]]:
    return {(x, y) for y in range(Y0, Y0 + H) for x in range(X0, X0 + W)
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0}


def _poly(pts: list[tuple[int, int]]) -> set[tuple[int, int]]:
    m = polygon_mask(W, H, [(x - X0, y - Y0) for x, y in pts])
    return {(x + X0, y + Y0) for y in range(H) for x in range(W) if m[y][x]}


# ── Gaia's bowl and the Pinewold (north) ──
BOWL = _ellipse(151.5, 13.5, 9.5, 6.5)
WIND_GAP = {(x, y) for x in range(160, 167) for y in range(12, 15)}
PINEWOLD = _poly([(165, 9), (176, 8), (183, 12), (182, 19), (176, 22), (179, 27), (183, 30), (181, 35), (172, 34),
                  (168, 28), (169, 20), (165, 15)])
TARN = _ellipse(156.5, 10.5, 2.2, 1.6)
BOWL_FOREST = _ellipse(144.5, 15.0, 2.6, 2.4) | _ellipse(157.0, 17.5, 2.0, 1.4)
PINE_FOREST = (_ellipse(172.0, 13.0, 4.0, 3.0) | _ellipse(177.5, 18.0, 2.5, 2.2) | _ellipse(175.0, 30.0, 3.5, 2.5)
               | _ellipse(170.5, 24.0, 1.8, 2.5))
PINE_CRAGS = _ellipse(178.5, 25.0, 1.6, 1.4)     # a granite knot in the middle of the wold

# ── the Mirage sands (south-west) ──
SANDS = _poly([(131, 33), (134, 27), (140, 24), (149, 24), (152, 28), (151, 35), (148, 41), (142, 43), (134, 43),
               (131, 40)])
SPINE = [_ellipse(139.0, 29.5, 1.4, 2.6), _ellipse(142.5, 33.0, 1.6, 1.3), _ellipse(145.5, 36.5, 1.3, 2.4)]
SALT_PAN = _ellipse(147.0, 29.0, 2.0, 1.3)       # a dry salt lake (Lake terrain: never walked, never sailed)
OASIS = _ellipse(136.0, 39.0, 2.4, 1.9)          # the landing meadow by the tower
PALMS = {(137, 40), (138, 40), (138, 41)}

# ── Lufenia's mesa (south) ──
MESA = _ellipse(153.5, 49.5, 8.5, 6.2)
MOOR = _ellipse(149.0, 52.5, 2.6, 1.8) | _ellipse(158.0, 52.0, 1.8, 2.2)
MESA_FOREST = _ellipse(156.0, 54.5, 2.0, 1.2)


def build() -> dict[tuple[int, int], str]:
    """Every cell of the WIND box (bands included; the caller drops them) -> a legend char."""
    land = _poly(COAST) - _poly(FJORD) - set().union(*(_poly(p) for p in LOCHS))
    g = {(x, y): OCEAN for y in range(Y0, Y0 + H) for x in range(X0, X0 + W)}
    for c in land:
        g[c] = MOUNT
    for c in BOWL | WIND_GAP | PINEWOLD:
        g[c] = GRASS
    for c in BOWL_FOREST | PINE_FOREST:
        g[c] = FOREST
    for c in TARN:
        g[c] = LAKE
    for c in PINE_CRAGS:
        g[c] = MOUNT
    for c in SANDS & land:
        g[c] = SAND
    for spur in SPINE:
        for c in spur:
            g[c] = MOUNT
    for c in SALT_PAN:
        g[c] = LAKE
    for c in OASIS | PALMS:
        g[c] = GRASS if c in OASIS else FOREST
    for c in MESA:
        g[c] = GRASS
    for c in MOOR:
        g[c] = SWAMP
    for c in MESA_FOREST:
        g[c] = FOREST
    _tidy(g)
    return g


def _runs_short(g: dict, c: tuple[int, int]) -> bool:
    """An ocean cell in a 1-cell water run closed by land on both sides, along a row or a column (an inlet)."""
    x, y = c
    return any(g.get((x - dx, y - dy), OCEAN) != OCEAN and g.get((x + dx, y + dy), OCEAN) != OCEAN
               for dx, dy in ((1, 0), (0, 1)))


def _tidy(g: dict) -> None:
    """The organic renderer's minimum sizes (map_checks min_blob): no 1-cell inlet, no mountain or forest or sand
    patch under 3 cells. Inlets fill with mountain; a small patch takes its commonest land neighbour."""
    for _ in range(8):
        changed = False
        for c in sorted((c for c, ch in g.items() if ch == OCEAN), key=lambda c: (c[1], c[0])):
            if _runs_short(g, c):
                g[c], changed = MOUNT, True
        for ch in (MOUNT, FOREST, SAND):
            seen: set = set()
            for c in sorted((c for c, v in g.items() if v == ch), key=lambda c: (c[1], c[0])):
                if c in seen:
                    continue
                comp, todo = {c}, [c]
                while todo:
                    x, y = todo.pop()
                    for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if g.get(n) == ch and n not in comp:
                            comp.add(n)
                            todo.append(n)
                seen |= comp
                if len(comp) < 3:
                    near = [g[n] for x, y in sorted(comp) for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
                            if g.get(n) not in (None, ch, OCEAN, LAKE)]
                    fill = max(sorted(set(near)), key=near.count) if near else OCEAN
                    for k in comp:
                        g[k] = fill
                    changed = True
        if not changed:
            return
