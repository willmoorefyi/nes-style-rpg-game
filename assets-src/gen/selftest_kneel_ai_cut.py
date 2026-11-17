"""Pass KA self-tests, part 3 (selftest_kneel_ai.run_kneel_ai): the D-KA6 cut, offline.

- round trip (D-KA6.8): the idle x k (nearest) placed as the guide is, cut with the guide window: >= 99 % of the
  cell's pixels (colour and alpha) equal the idle's, output size = the idle's grid, at 80x80 (goblin), 110x80 (wolf,
  green_slime), 218x128 (fire_lizard), the hero 80x80 (white_mage ready) and a floater (air_elemental: its foot row is
  the idle's lowest opaque row);
- momus rev-4 P2: the same at +15 % of the cell width off-centre (the window re-centres on the base); a figure the
  canvas crops, and one taller than the window, fail ("canvas edge", "touches the window edge") instead of clipping;
- the width rule (<= 8 % shrink, more = A-width), the <= 2 px height correction, the outline peel (the pixelize ring).
"""
from __future__ import annotations

from typing import Callable

import numpy as np
from PIL import Image

ROUND_TRIP = ("goblin", "wolf", "green_slime", "fire_lizard", "white_mage", "air_elemental")
EQUAL = 0.99


def equal(a: np.ndarray, b: np.ndarray) -> float:
    same = (a == b).all(-1) | ((a[..., 3] == 0) & (b[..., 3] == 0))
    return float(same.mean())


def scaled_canvas(sp, s: float, sx: float = 1.0):
    """The idle scaled by (s * sx, s) about its base centre and foot row, then x k onto the guide canvas."""
    from gen import kneel_ai_data as D
    from gen import kneel_ai_guide as G
    win = G.window(sp.cell)
    k = win["k"]
    up = Image.fromarray(sp.idle, "RGBA").resize((sp.cell[0] * k, sp.cell[1] * k), Image.Resampling.NEAREST)
    nw, nh = round(up.size[0] * s * sx), round(up.size[1] * s)
    big = up.resize((nw, nh), Image.Resampling.NEAREST)
    cx = D.base_cx(sp.idle[..., 3] > 0, D.base_rows(D.height(sp.idle)), sp.floating) * k
    foot = (sp.foot_row + 1) * k
    can = Image.new("RGB", (D.CANVAS, D.CANVAS), sp.key_rgb)
    can.paste(big, (round(win["x0"] + cx - cx * s * sx), round(win["y0"] + foot - foot * s)), big)
    return can, k


def _round_trip(check) -> None:
    from gen import kneel_ai_cut as C
    from gen import kneel_ai_data as D
    from gen import kneel_ai_guide as G
    for sid in ROUND_TRIP:
        sp = D.load(sid)
        win = G.window(sp.cell)
        r = C.cut(G.place(sp, sp.idle, win), sp, win["k"])
        e = equal(r["key"], sp.idle)
        low = int(D.opaque_rows(r["key"]).max())
        check(e >= EQUAL and r["key"].shape[:2] == sp.idle.shape[:2] and low == sp.foot_row,
              f"round trip {sid} {sp.cell[0]}x{sp.cell[1]}{' (floater)' if sp.floating else ''}: {100 * e:.2f} % equal "
              f"(>= 99), grid {r['key'].shape[1]}x{r['key'].shape[0]}, lowest row {low} = foot row {sp.foot_row}")
        dx = int(0.15 * sp.cell[0] * win["k"])
        ys, xs = np.nonzero(sp.idle[..., 3] > 0)
        if win["x0"] + dx + (xs.max() + 1) * win["k"] < D.CANVAS - 1:
            r2 = C.cut(G.place(sp, sp.idle, win, dx=dx), sp, win["k"])
            check(equal(r2["key"], sp.idle) >= EQUAL and r2["info"]["window"]["x0"] == win["x0"] + dx,
                  f"round trip {sid} +15 % off-centre ({dx} canvas px): the window re-centres on the base "
                  f"({100 * equal(r2['key'], sp.idle):.2f} %)")
        else:
            try:
                C.cut(G.place(sp, sp.idle, win, dx=dx), sp, win["k"])
                check(False, f"{sid} +15 %: a figure the canvas crops must fail")
            except C.CutFail as err:
                check("canvas edge" in str(err), f"{sid} +15 % off-centre leaves the canvas: CutFail ({err})")


def _edges(check) -> None:
    from gen import kneel_ai_cut as C
    from gen import kneel_ai_data as D
    sp = D.load("goblin")
    can, k = scaled_canvas(sp, 1.13)                 # taller than the window, still inside the 1024 canvas
    try:
        C.cut(can, sp, k)
        check(False, "a figure taller than the window must fail")
    except C.CutFail as err:
        check("touches the window edge" in str(err), f"momus P2: a 113 % goblin fails, not clipped ({err})")


def _width_height(check) -> None:
    from gen import kneel_ai_cut as C
    from gen import kneel_ai_data as D
    wolf = D.load("wolf")
    ys, xs = np.nonzero(wolf.idle[..., 3] > 0)
    fill = (xs.max() - xs.min() + 1) / wolf.cell[0]
    mid = sum(wolf.band_px) / 2 / D.height(wolf.idle)
    # 112 % of the cell width at kneel height cannot fit the 1024 canvas at the guide's k, so the fixture is drawn
    # smaller and cut as arm (d), which scales the figure to the band midpoint first (D-KA6.2)
    can, k = scaled_canvas(wolf, 0.6, 1.12 / (fill * mid))
    r = C.cut(can, wolf, k, "d")
    check(any("A-width" in f for f in r["info"]["fails"]) and r["info"]["shrink_pct"] > 8,
          f"width rule: the wolf at 112 % of its cell width needs {r['info']['shrink_pct']} % > 8 %: A-width")
    can, k = scaled_canvas(wolf, 0.6, 1.04 / (fill * mid))
    r = C.cut(can, wolf, k, "d")
    xs2 = np.nonzero((r["key"][..., 3] > 0).any(0))[0]
    check(not r["info"]["fails"] and 0 < r["info"]["shrink_pct"] <= 8 and xs2.max() - xs2.min() + 1 <= wolf.cell[0],
          f"width rule: at 104 % the canvas shrinks {r['info']['shrink_pct']} % (<= 8), the cell is never widened")
    sp = D.load("goblin")
    lo, hi = sp.band_px
    h = D.height(sp.idle)
    can, k = scaled_canvas(sp, (hi + 2) / h)
    r = C.cut(can, sp, k)
    hk = D.height(r["key"])
    check(r["info"]["height_fix_px"] in (1, 2) and lo <= hk <= hi + 1,
          f"height correction: a goblin {hi + 2} px tall (band {lo}-{hi}) is corrected once to {hk} px "
          f"(fix {r['info']['height_fix_px']} px)")
    can, k = scaled_canvas(sp, (hi + 6) / h)
    r = C.cut(can, sp, k)
    check(D.height(r["key"]) > hi + 1, "height correction: 6 px over the band is not corrected (a K-height pose fail)")


def _peel(check) -> None:
    from gen import kneel_ai_cut as C
    from gen import kneel_ai_data as D
    sp = D.load("goblin")
    ink = C.outline_rgb(sp.idle)
    ring = np.zeros_like(sp.idle)
    op = sp.idle[..., 3] > 0
    grown = op | np.logical_or.reduce([C._shift(op, dy, dx) for dy, dx in C.DIRS])
    ring[grown & ~op] = (*ink, 255)
    doubled = np.where(op[..., None], sp.idle, ring)
    check(C.thickness(sp.idle, ink) == 1 and C.thickness(doubled, ink) == 2
          and equal(C.peel(doubled, sp.idle), sp.idle) >= EQUAL,
          "outline peel: one pass takes a doubled outer ring back to the idle's 1 px")


def run_cut(check: Callable[[bool, str], None]) -> None:
    from gen.selftest_colossus import sections
    sections(check, _round_trip, _edges, _width_height, _peel)
