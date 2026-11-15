"""FW-M self-tests (docs/ROSTER_FIX_PLAN.md 3), run from selftest.py --anim: the committed measurement tool
`fixmeasure.py` reproduces the RED numbers the fix plan quotes, so every fix gate starts from a pinned state.

The RED states are measured on the approved keys without keyframe paint (`paint=False`) and, where a generated frame
is measured (the ice_gigas axe, the garland smear), on the rig as it was at the plan's commit (95b31e2), kept as a
fixture in `fixtures/fixmeasure/` (the live rigs change in the F3 fix tranches; the fixtures never do).
"""
from __future__ import annotations

from pathlib import Path
from typing import Callable

import numpy as np
import yaml

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "fixmeasure"


def _fixture(sprite: str) -> dict:
    return yaml.safe_load((FIXTURES / f"{sprite}.yaml").read_text())


def run_unit(check: Callable[[bool, str], None]) -> None:
    """The primitives on a synthetic cell: fill components leave ink out, boxes are [x0, x1) x [y0, y1), holes are
    enclosed transparent pieces, `select --mode` groups pixels by their 4-neighbour mode colour."""
    from gen import fixmeasure as FM
    a = np.zeros((20, 20, 4), np.uint8)
    a[2:12, 2:12] = (6, 4, 10, 255)                       # an ink square
    a[3:11, 3:6] = (100, 0, 0, 255)                       # two fills split by an ink column (x 6)
    a[3:11, 7:11] = (0, 100, 0, 255)
    a[5, 8] = 0                                           # a 1 px enclosed hole
    comps = FM.fill_components(a)
    check(sorted(c["size"] for c in comps) == [24, 31], f"fills: ink excluded, 4-connected ({[c['size'] for c in comps]})")
    boxed = FM.fill_components(a, box=(0, 0, 6, 20))
    check([c["size"] for c in boxed] == [24], f"fills: --box is [x0, x1) x [y0, y1) ({[c['size'] for c in boxed]})")
    holes = FM.holes(a)
    check([(h["size"], h["at"]) for h in holes] == [(1, (8, 5))], f"pieces --holes: the enclosed hole ({holes})")
    check(FM.holes(a, box=(0, 0, 6, 20)) == [], "pieces --holes --box: a hole outside the box is left out")
    check(FM.colour_count(a, [(100, 0, 0)], (0, 0, 20, 20)) == 24, "colours: exact RGB count in the box")
    sel = FM.select(a, rgb=[(6, 4, 10)], box=(6, 3, 7, 11), mode=True)
    check(sel and all(p["rgb"] in ([100, 0, 0], [0, 100, 0]) for p in sel) and sum(len(p["xy"]) for p in sel) == 8,
          f"select --mode: the 8 ink seam px grouped by their 4-neighbour fill mode ({sel})")


def run_red(check: Callable[[bool, str], None]) -> None:
    """The fix plan's RED numbers (sections 1-3), reproduced by the committed tool."""
    from gen import fixmeasure as FM
    steps = FM.partc("ice_gigas", "axe", ["idle", "hurt_in1", "hurt_in2", "hurt"], rig=_fixture("ice_gigas"))
    got = [round(s["step"], 1) for s in steps[1:]]
    cent = [(round(s["c"][0], 1), round(s["c"][1], 1)) for s in steps]
    check(got == [4.3, 60.9, 4.0], f"defect 6: ice_gigas axe steps 4.3 / 60.9 / 4.0 ({got})")
    check(cent == [(85.8, 34.0), (82.7, 31.0), (21.9, 33.7), (25.9, 33.7)], f"defect 6: ice_gigas axe centroids {cent}")
    raw_garland = FM.Sprite("garland", paint=False)
    lav = FM.colours(raw_garland, ["cast"], [(189, 181, 198)], box=(55, 80, 90, 115))
    check(lav == {"cast": 120}, f"defect 7: 120 lavender px in garland's cast box ({lav})")
    whole = FM.colours(raw_garland, ["cast"], [(189, 181, 198)])
    check(whole == {"cast": 677}, f"defect 7: the colour occurs 677 times in the cast key ({whole})")
    garland = FM.Sprite("garland", _fixture("garland"))
    hole = FM.pieces(garland, ["cast_rise"], box=(55, 80, 90, 115), holes=4)["cast_rise"]
    check([h["size"] for h in hole["holes"]] == [11], f"defect 7: cast_rise's 11 px enclosed hole in the box ({hole['holes']})")
    smear = FM.join(garland, "atk_swing2", [(181, 181, 173), (148, 156, 140)], "sword")
    check([c["size"] for c in smear["apart"]] == [305] and smear["apart"][0]["box"] == (184, 138, 196, 184),
          f"defect 7: the smear is a separate 305 px fill component at x 184-196, y 138-184 ({smear['apart']})")
    raw_croc = FM.Sprite("crocodile", paint=False)
    croc = FM.fills(raw_croc, ["hurt"], box=(0, 40, 40, 90))["hurt"]
    sizes = [c["size"] for c in croc]
    check(sizes[:6] == [467, 121, 79, 35, 21, 9], f"defect 4: crocodile hurt fill components 467 / 121 / 79 / 35 / 21 / 9 ({sizes[:6]})")
    tail = {c["size"]: c["box"] for c in croc}
    check(tail.get(467) == (9, 51, 34, 87) and tail.get(121) == (16, 42, 36, 58) and tail.get(21) == (32, 61, 36, 69),
          f"defect 4: main tail, shard and ring boxes ({tail.get(467)}, {tail.get(121)}, {tail.get(21)})")
    ch = FM.pieces(raw_croc, ["hurt", "hurt_in2"], holes=2)
    check(sorted(h["size"] for h in ch["hurt"]["holes"]) == [13, 19] and ch["hurt_in2"]["holes"] == [],
          f"defect 4: crocodile hurt holes 19 + 13 px, none >= 2 in hurt_in2 ({ch['hurt']['holes']}, {ch['hurt_in2']['holes']})")
    drowned = FM.Sprite("drowned_sovereign", paint=False)
    blue = tuple(FM.colours(drowned, ["cast"], [c])["cast"] for c in ((33, 33, 165), (41, 41, 115), (41, 49, 107)))
    check(blue == (165, 100, 32), f"11a: drowned_sovereign cast tips 165 / 100 / 32 px ({blue})")


def run_fixmeasure(check: Callable[[bool, str], None]) -> None:
    for fn in (run_unit, run_red):
        fn(check)
