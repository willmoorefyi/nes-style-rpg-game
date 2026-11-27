"""Pass CL (docs/CLASS_LANCE_PLAN.md 4.3, 5.2.5, 10): selftests of the oversize lance sheet import
(hero_user.py with hero_user_grid.py / hero_user_lance.py) and of puppet_lance's checks L1-L8.

Synthetic 7 x 2 renders of 160 x 144 cells (a block body in the 80 x 80 box at x 72-151, y 64-143 standing on row 140,
a 3-strand lance from the upper left into the box; 16 colours per row, 32 on the sheet) in a temp generator tree: the
round trip, and each refusal (the size for the recipe cell, a body px outside the box, a body foot off row 140, a
broken lance, 17 colours in one row, a body box that is not 80 x 80); the CB 80 x 80 recipe still cuts byte-equal.
Then L1-L8 each failing on a mutated frame, and the real landsknecht_dragoon recipe re-importing byte for byte."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image

from gen.selftest_hero_user import refused, tree

CW, CH = 160, 144
LINE = [[10.0, 30.0], [106.0, 126.0]]                   # 45 deg (136 px), tip up-left, butt inside the body box
LANCE = [(10, 10, 14), (120, 80, 50)]                   # ink (darkest), wood


def row_palette(r: int) -> list[tuple]:
    """16 colours of row r (the darkest the ink); the two rows share none but nothing (32 on the sheet)."""
    return [LANCE[0], LANCE[1]] + [(40 + 12 * i, 60 + 40 * r, 90) for i in range(14)]


def render(foot: int = 140, outside: bool = False, broken: bool = False, extra: bool = False) -> np.ndarray:
    a = np.zeros((2 * CH, 7 * CW, 4), np.uint8)
    for r in range(2):
        pal = row_palette(r)
        for c in range(7):
            ox, oy = c * CW, r * CH
            blk = a[oy + 80:oy + foot + 1, ox + 96:ox + 130]      # the body block in the box
            blk[...] = (*pal[0], 255)
            for i in range(1, blk.shape[0] - 1):
                blk[i, 1:-1] = (*pal[2 + (i + c) % 14], 255)
            for t in range(0, 97):                                # the lance: ink / wood / ink strands, 45 deg
                x, y = ox + 10 + t, oy + 30 + t
                if broken and 30 <= t <= 33:
                    continue
                a[y, x] = (*LANCE[1], 255)
                a[y, x + 1] = (*LANCE[0], 255)
                a[y + 1, x] = (*LANCE[0], 255)
            if outside:
                a[oy + 20, ox + 140] = (*pal[3], 255)
            if extra and r == 0:
                a[oy + 100, ox + 100] = (250, 0, 250, 255)
    return a


def recipe(over: dict | None = None) -> dict:
    lines = {p: LINE for p in ("ready", "attack", "cast", "hurt", "down", "victory", "kneel")}
    rec = {"rows": ["syn_base", "syn_plus"], "cell": [CW, CH], "foot_row": 140, "body_box": [72, 64, 151, 143],
           "palette": "per_row", "prop": {"kind": "lance", "radius": {"shaft": 2.1, "head": 6.0}, "head_len": 8,
                                          "colours": {c: [list(x) for x in LANCE] for c in ("syn_base", "syn_plus")},
                                          "lines": {"syn_base": lines, "syn_plus": lines}}}
    rec.update(over or {})
    return rec


def run_hero_lance(check: Callable[[bool, str], None]) -> None:
    from gen import hero_user as HU
    from gen import hero_user_lance as HL
    from gen import puppet_lance as PL
    with tempfile.TemporaryDirectory() as t:
        td = Path(t)
        rec = tree(td, render(), recipe())
        gen = td / "gen"
        cells, info = HU.cut(rec, gen)
        check(all(c.size == (CW, CH) for v in cells.values() for c in v.values()) and info["colours"] ==
              {"syn_base": 16, "syn_plus": 16}, "CL: the cut gives 160 x 144 cells, one 16-colour palette per row (32 on the sheet)")
        written = HU.approve("syn", gen / "approved", "2026-11-26")
        m = json.loads((gen / "approved/syn_base/battle.json").read_text())
        check(len(written) == 8 and Image.open(gen / "approved/syn_base/battle.png").size == (480, 288)
              and m["grid"] == [CW, CH] and m["bottom_row"] == 140 and m["body"] == [72, 64, 80, 80]
              and m["prop"]["lines"]["ready"] == LINE, "CL: approve writes 480 x 288 / 160 x 144 sheets, the body box and lines")
        check(all(HU.check(json.loads((gen / f"approved/{c}/{s}.json").read_text()), gen) is None
                  for c in ("syn_base", "syn_plus") for s in ("battle", "battle_kneel")), "CL: the lance sheet re-imports byte for byte")
        check("lance lines differ" in (HU.check({**m, "prop": {**m["prop"], "lines": {**m["prop"]["lines"], "ready": [[0, 0], [1, 1]]}}}, gen) or ""),
              "CL: a json whose lance line differs from the recipe is refused")
    cases = {
        "need": (render(), {"cell": [CW, 150]}),
        "outside the body box": (render(outside=True), None),
        "feet on row": (render(foot=139), None),
        "broken": (render(broken=True), None),
        "colours": (render(extra=True), None),
        "must be 80 x 80": (render(), {"body_box": [72, 64, 150, 143]}),
    }
    for word, (a, over) in cases.items():
        with tempfile.TemporaryDirectory() as t2:
            r2 = tree(Path(t2), a, recipe(over))
            why = refused(lambda: HU.cut(r2, Path(t2) / "gen"))
            check(word in why, f"CL: the cut refuses ({word}): {why[:90]}")
    # L1-L8 on a synthetic level lance (the shaft cross-section: ink / wood / ink), each check failing on a mutation
    h, w = CH, CW
    img = np.zeros((h, w, 4), np.uint8)
    for x in range(10, 150):
        img[99, x], img[100, x], img[101, x] = (*LANCE[0], 255), (*LANCE[1], 255), (*LANCE[0], 255)
    mask = img[..., 3] > 0
    line = [[10.0, 100.0], [149.0, 100.0]]
    src = {"img": img, "mask": mask, "lpx": img.copy(), "lmask": mask.copy(), "line": line}
    pal = {tuple(LANCE[0]), tuple(LANCE[1])}
    lance = PL.carry(src, (0, 0))
    base = PL.lance_checks(img, lance, src, pal, 140)
    check(all(base.values()), f"CL: a carried lance passes L1-L7 {base}")
    gap = img.copy(); gap[99:102, 60:63] = 0
    check(not PL.lance_checks(gap, lance, src, pal, 140)["L1"], "CL: L1 fails on a 3 px gap")
    red = PL.redraw(src, 26.565051177077994, (80, 100), (80, 100), 8.0, (w, h))
    rimg = PL.compose(np.zeros((h, w, 4), np.uint8), red, None)
    good = PL.lance_checks(np.asarray(rimg), red, src, pal, 140)
    check(good["L2"] and good["L3"] and good["L4"], f"CL: a redrawn lance keeps its length, its strands and a clean angle {good}")
    short = {**red, "mask": red["mask"].copy()}
    ys, xs = np.nonzero(short["mask"]); far = xs >= xs.max() - 3
    short["mask"][ys[far], xs[far]] = False
    check(not PL.lance_checks(np.asarray(rimg), short, src, pal, 140)["L2"], "CL: L2 fails on a lance 3 px short")
    corner = {**red, "mask": red["mask"].copy()}
    ys, xs = np.nonzero(corner["mask"]); i = len(xs) // 2
    corner["mask"][ys[i] + 3, xs[i]] = True
    check(not PL.straight(corner), "CL: L3 fails on a stray strand px (an L corner)")
    check(not PL.lance_checks(np.asarray(rimg), {**red, "angle": 30.0}, src, pal, 140)["L4"], "CL: L4 fails on an angle outside the clean set")
    low = PL.carry(src, (0, 41))
    check(not PL.lance_checks(PL.shift(img, 0, 41), low, src, pal, 140)["L5"], "CL: L5 fails on a lance below the feet row")
    check(PL.lance_checks(PL.shift(img, 0, 41), low, src, pal, 140, exempt=low["mask"])["L5"],
          "CL: L5 passes a below-row px carried from a key (the exemption)")
    odd = img.copy(); odd[100, 70] = (250, 0, 250, 255)
    check(not PL.lance_checks(odd, lance, src, pal, 140)["L6"], "CL: L6 fails on a colour outside the palette")
    check(not PL.lance_checks(img, lance, src, pal, 140, grips=[(80, 110)])["L7"], "CL: L7 fails on a hand 10 px off the shaft")
    check(bool(PL.turns({"a": 45.0, "b": 0.0}, (["a", "b"],))) and not PL.turns({"a": 45.0, "b": 26.6}, (["a", "b"],)),
          "CL: L8 fails on a 45 deg turn in one frame, passes 18.4")
    check(HL.angle([[0, 0], [10, 10]]) == 45.0 and HL.angle([[0, 10], [10, 10]]) == 0.0, "CL: the angle convention (up-left +)")
    real = {c: json.loads((HU.HERE / f"approved/{c}/{s}.json").read_text()) for c in ("landsknecht", "dragoon")
            for s in ("battle", "battle_kneel")}
    check(all(HU.check(m) is None for m in real.values()), "CL: the real landsknecht_dragoon recipe re-imports byte for byte")
