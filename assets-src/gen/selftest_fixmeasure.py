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
    # defect 6: the ice_gigas sheet was regenerated in the fix pass (R287), so its RED numbers (4.3 / 60.9 / 4.0 on the
    # old art) can no longer be reproduced; the gate is checked GREEN on the live rig instead.
    steps = FM.partc("ice_gigas", "axe", ["idle", "hurt_in1", "hurt_in2", "hurt"])
    got = [round(s["step"], 1) for s in steps[1:]]
    check(max(got) <= 32, f"defect 6 (GREEN after R287): ice_gigas max axe step <= 32 px ({got})")
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
    ch = FM.pieces(raw_croc, ["hurt"], holes=2)       # hurt_in2's raw holes depend on the (since fixed) rig's paint
    check(sorted(h["size"] for h in ch["hurt"]["holes"]) == [13, 19],
          f"defect 4: crocodile raw hurt key holes 19 + 13 px ({ch['hurt']['holes']})")
    drowned = FM.Sprite("drowned_sovereign", paint=False)
    blue = tuple(FM.colours(drowned, ["cast"], [c])["cast"] for c in ((33, 33, 165), (41, 41, 115), (41, 49, 107)))
    check(blue == (165, 100, 32), f"11a: drowned_sovereign cast tips 165 / 100 / 32 px ({blue})")


def _fixture2(sprite: str) -> dict:
    """The round-2 fixtures (docs/ROSTER_FIX_PLAN_2.md 4, FW-M2): the rigs as they were at the plan (b6b1346 /
    3ebbe1d), so the RED numbers stay reproducible after the G3 rig tranches change the live rigs."""
    return yaml.safe_load((FIXTURES / "fix2" / f"{sprite}.yaml").read_text())


def run_m2_unit(check: Callable[[bool, str], None]) -> None:
    """FW-M2 primitives on a synthetic cell: spurs, inner ink, edge gaps and bare ink; a polygon mask; match; rowspan."""
    from gen import fixmeasure_edges as FE
    a = np.zeros((12, 12, 4), np.uint8)
    a[2:9, 2:9] = (6, 4, 10, 255)                         # a 7x7 ink square ...
    a[3:8, 3:8] = (100, 0, 0, 255)                        # ... with a 5x5 fill inside
    a[5, 5] = (6, 4, 10, 255)                             # 1 inner ink px (4 opaque neighbours)
    a[2, 5] = (100, 0, 0, 255)                            # 1 edge gap: a fill px on the silhouette edge
    a[1, 8] = (6, 4, 10, 255)                             # 1 spur, also bare ink (no fill neighbour)
    m = FE.edge_metrics(a)
    check((m["spurs"], m["inner_ink"], m["edge_gaps"], m["bare_ink"]) == (1, 1, 1, 1 + 4),
          f"edges: spurs / inner ink / edge gaps / bare ink on the synthetic cell ({m}; bare: the spur + 4 corners)")
    boxed = FE.edge_metrics(a, (0, 0, 6, 12))
    check(boxed["edge_gaps"] == 1 and boxed["spurs"] == 0, f"edges --box: neighbours from the whole frame, counts in the box ({boxed})")
    check(FE.edge_metrics(a, FE.shift_box((0, 0, 6, 12), (6, 0)))["spurs"] == 1, "edges --shift: the box moves by (dx, dy)")
    pm = FE.poly_mask([[2, 2], [6, 2], [6, 6], [2, 6]], a.shape)
    check(int(pm.sum()) == 25, f"poly: a rig polygon rasterizes as rig.segment does (PIL fill, edges inclusive: {int(pm.sum())})")
    b = a.copy()
    b[4, 4] = (0, 100, 0, 255)
    check(FE.match_px(a, b, (2, 2, 9, 9), (2, 2, 9, 9), [(100, 0, 0)]) == 1, "match: one px differs in the colour mask")
    check(FE.match_px(a, np.roll(a, 1, 1), (2, 2, 9, 9), (3, 2, 10, 9), [(100, 0, 0), (6, 4, 10)]) == 0,
          "match: the same glyph at another offset differs in 0 px")
    check(FE.row_extent(a, (2, 4)) == (2, 8) and FE.row_extent(a, (0, 1)) is None, "rowspan: opaque x extent of rows [y0, y1)")


def run_m2_red(check: Callable[[bool, str], None]) -> None:
    """FW-M2: the plan-2 pre-measure numbers (sections 1-5) through the committed tool, on the fix2 fixtures."""
    from gen import fixmeasure as FM
    from gen import fixmeasure_edges as FE
    chim = FM.Sprite("chimera", _fixture2("chimera"))
    got = [r["px"] for r in FM.partc(chim, "dragon", ["attack", "atk_mid", "atk_follow", "hurt_in2", "hurt"])]
    check(got == [794, 794, 795, 671, 673], f"1: chimera upper dragon part px 794 / 794 / 795 / 671 / 673 ({got})")
    rig = _fixture2("chimera")
    e_att = FE.poly(chim, ["attack", "atk_mid", "atk_follow"], "dragon2@attack", ["head", "dragon"], rig)
    e_hurt = FE.poly(chim, ["hurt", "hurt_in2"], "dragon2@hurt", ["head", "dragon"], rig)
    check(e_att == {"attack": 732, "atk_mid": 691, "atk_follow": 746} and e_hurt == {"hurt": 234, "hurt_in2": 233},
          f"1: chimera |E| RED 732 / 691 / 746 and 234 / 233 (opaque px in dragon2 minus head and dragon) {e_att} {e_hurt}")
    greens = [(66, 82, 49), (99, 132, 74), (148, 156, 90)]
    ca = FE.colours(chim, ["attack"], greens, (120, 54, 168, 92), not_masks=["dragon@attack"], masks=rig)
    ch = FE.colours(chim, ["hurt"], greens, (106, 54, 160, 88), not_masks=["dragon@hurt"], masks=rig)
    check(ca["attack"]["n"] == 375 and ch["hurt"]["n"] == 374,
          f"1: chimera colour gate RED 375 / 374 (the box holds 393 / 341 greens; the plan's 360 / 337 were estimates) ({ca}, {ch})")
    st = FM.Sprite("sea_troll", _fixture2("sea_troll"))
    gaps = [FE.edge_metrics(st.img(f))["edge_gaps"] for f in ("idle", "atk_wind1", "atk_wind2", "hurt_in1")]
    check(gaps == [0, 29, 44, 38], f"P2-5: sea_troll edge gaps idle 0, wind1 29, wind2 44, hurt_in1 38 ({gaps})")
    ba = FM.Sprite("basilisk", _fixture2("basilisk"))
    m = [tuple(FE.edge_metrics(ba.img(f))[k] for k in ("spurs", "inner_ink", "edge_gaps")) for f in ("idle", "atk_wind1", "atk_wind2")]
    check(m == [(4, 74, 0), (4, 119, 3), (3, 130, 8)], f"P2-1: basilisk (spurs, inner ink, edge gaps) idle / wind1 / wind2 ({m})")
    ig = FM.Sprite("ice_gigas", _fixture2("ice_gigas"))
    gaps = [FE.edge_metrics(ig.img(f))["edge_gaps"] for f in ("idle", "atk_wind1", "atk_wind2", "atk_recover")]
    check(gaps == [0, 8, 9, 5], f"N-2: ice_gigas edge gaps idle 0, wind1 8, wind2 9, recover 5 ({gaps})")
    sw = FE.edges(FM.Sprite("sand_worm", _fixture2("sand_worm")), ["hurt_in2"], vs="hurt")
    check(sw["key"]["inner_ink"] == 482 and sw["frames"]["hurt_in2"]["inner_ink"] == 528,
          f"P2-2: sand_worm inner ink hurt 482, hurt_in2 528 (+46) ({sw['key']['inner_ink']}, {sw['frames']['hurt_in2']['inner_ink']})")
    cr = FE.edges(FM.Sprite("crocodile", _fixture2("crocodile")), ["hurt", "hurt_in2"], box=(15, 36, 30, 47))
    check(cr["frames"]["hurt"]["bare_ink"] == 7 and cr["frames"]["hurt"]["spurs"] == 0,
          f"N-1b: crocodile bare ink 7 in box 15 36 30 47 (the plan's 5 = the tip block x 17-20, y 38 + (17, 39); plus "
          f"(29, 43) and (23, 44)), spurs 0 ({cr['frames']['hurt']})")
    km = FM.colours(FM.Sprite("king_mummy", _fixture2("king_mummy")), ["hurt", "hurt_in2"], [(156, 115, 41), (222, 198, 99)],
                    box=(49, 20, 53, 48))
    check(km == {"hurt": 7, "hurt_in2": 5}, f"P2-3: king_mummy gold staff px 7 / 5 ({km})")
    em = FM.colours(FM.Sprite("earth_medusa", _fixture2("earth_medusa")), ["idle"], [(6, 4, 10)], box=(35, 31, 41, 37))
    check(em == {"idle": 19}, f"P2-8: earth_medusa chest-rectangle ink 19 ({em})")
    aq = FE.rowspan(FM.Sprite("ashen_queen", _fixture2("ashen_queen")), ["idle", "attack", "hurt", "cast"], (170, 200))
    check([v[0] for v in aq.values()] == [28, 25, 20, 25], f"N-4: ashen_queen coil base left edges 28 / 25 / 20 / 25 ({aq})")
    sw = FE.switch(FM.Sprite("black_knight"), "attack")
    check(round(sw["need"], 2) == 0.46 and sw["d"] is not None, f"T-K: switch black_knight attack need 0.46 ({sw['need']:.3f}, d {sw['d']})")


def run_fixmeasure(check: Callable[[bool, str], None]) -> None:
    for fn in (run_unit, run_red, run_m2_unit, run_m2_red):
        fn(check)
