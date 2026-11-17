"""Pass KA self-tests, part 4 (selftest_kneel_ai.run_kneel_ai): the section 6 failure fixtures. Each must FAIL its
named check, and the same sprite unmodified must pass that check (offline, with the pinned thresholds).

J0: goblin with a foreign colour (A-pal) and a grey fill (A-grey) on its raw; a 2 px lift (K-ground); a doubled outer
outline ring (A-outline thickness); the wolf at 112 % of its cell width (A-width, in selftest_kneel_ai_cut). J1: rhyos
with a 4th head (a ram head pasted 20 px away, marked with its idle joints: A-headdup); a warrior `ready` with a
second sword and hand from its attack key (the R3 variant-B failure: A-prop weapon@attack); a goblin at 125 % about
its feet, marked with its scaled joints (A-scale).
"""
from __future__ import annotations

import copy
from typing import Callable

import numpy as np

from gen import kneel_ai_cut as C
from gen import kneel_ai_data as D
from gen import kneel_ai_gates as GT
from gen import kneel_ai_j1 as J1
from gen import kneel_ai_guide as G


def _row(rows, name: str):
    return next((r for r in rows if r[0] == name), (name, None, "missing"))


def _j0(sp, key, raw=None):
    return GT.j0(sp, key, raw if raw is not None else key, {"shrink_pct": 0.0}, GT.thresholds())


def _raw_fixtures(check) -> None:
    sp = D.load("goblin")
    win = G.window(sp.cell)
    k = win["k"]
    base = np.asarray(G.place(sp, sp.idle, win)).copy()
    ys, xs = np.nonzero(sp.idle[..., 3] > 0)
    y0, y1, x0, x1 = (win["y0"] + ys.min() * k, win["y0"] + ys.max() * k, win["x0"] + xs.min() * k,
                      win["x0"] + xs.max() * k)
    cy, cx = (y0 + y1) // 2, (x0 + x1) // 2
    foreign, grey = base.copy(), base.copy()
    foreign[y0 + 4 * k:y1 - 4 * k, x0 + 4 * k:x1 - 4 * k] = (0, 210, 255)
    grey[cy - 14 * k:cy + 14 * k, cx - 12 * k:cx + 12 * k] = (128, 128, 128)
    for name, img, what in (("A-pal", foreign, "a foreign colour"), ("A-grey", grey, "a grey fill")):
        ok = _row(_j0(sp, sp.idle, C.cut(_im(base), sp, k)["raw"]), name)
        bad = _row(_j0(sp, sp.idle, C.cut(_im(img), sp, k)["raw"]), name)
        check(ok[1] is True and bad[1] is False, f"{name}: goblin with {what} fails ({bad[2]}), unmodified passes "
                                                 f"({ok[2]})")


def _im(a):
    from PIL import Image
    return Image.fromarray(a)


def _key_fixtures(check) -> None:
    sp = D.load("goblin")
    lift = C._shift(sp.idle, 2, 0, 0)
    ok, bad = _row(_j0(sp, sp.idle), "K-ground"), _row(_j0(sp, lift), "K-ground")
    check(ok[1] is True and bad[1] is False, f"K-ground: a 2 px lift fails ({bad[2]})")
    ink, op = C.outline_rgb(sp.idle), sp.idle[..., 3] > 0
    grown = op | np.logical_or.reduce([C._shift(op, dy, dx) for dy, dx in C.DIRS])
    doubled = sp.idle.copy()
    doubled[grown & ~op] = (*ink, 255)
    ok, bad = _row(_j0(sp, sp.idle), "A-outline"), _row(_j0(sp, doubled), "A-outline")
    check(ok[1] is True and bad[1] is False, f"A-outline: a doubled outer ring fails on thickness ({bad[2]})")


def _idle_joints(sp) -> dict:
    return {j: tuple(v) for j, v in sp.rig.keyframes["idle"].items()}


def _rhyos(check) -> None:
    from gen import rig as R
    sp = D.load("rhyos")
    lab, names = R.segment(sp.rig, "idle", sp.idle)
    ys, xs = np.nonzero(lab == names.index("ram_n"))
    four = sp.idle.copy()
    ok = (xs - 20 >= 0)
    four[ys[ok], xs[ok] - 20] = sp.idle[ys[ok], xs[ok]]
    T = GT.thresholds()
    good = [r for r in J1.j1(sp, sp.idle, _idle_joints(sp), T) if r[0].startswith("A-headdup")]
    bad = [r for r in J1.j1(sp, four, _idle_joints(sp), T) if r[0].startswith("A-headdup")]
    check(len(good) == 4 and all(r[1] for r in good) and any(r[1] is False for r in bad),
          f"A-headdup: rhyos with a 4th head fails ({[r[2] for r in bad if r[1] is False][:1]}), unmodified passes")


def _warrior(check) -> None:
    from gen import rig as R
    sp = D.load("warrior")
    att = {k: [float(v[0]), float(v[1])] for k, v in sp.cfg["battle"]["attack"].items() if isinstance(v, (list, tuple))}
    rig = R.Rig({**sp.rig.cfg, "keyframes": {**sp.rig.cfg["keyframes"], "attack": att}}, sp.cell)
    lab, names = R.segment(rig, "attack", sp.keys["attack"])
    m = np.isin(lab, [names.index("weapon"), names.index("farm_n")])
    two = sp.idle.copy()
    two[m] = sp.keys["attack"][m]
    T = GT.thresholds()
    good = _row(J1.j1(sp, sp.idle, _idle_joints(sp), T), "A-prop weapon@attack")
    bad = _row(J1.j1(sp, two, _idle_joints(sp), T), "A-prop weapon@attack")
    check(good[1] is True and bad[1] is False, f"A-prop: a warrior ready with a 2nd sword and hand fails ({bad[2]})")


def _padded(sp, top: int):
    """The sprite with `top` empty rows above its cell (room for a 125 % figure); joints and feet move down."""
    s = copy.copy(sp)
    s.keys = {k: np.vstack([np.zeros((top,) + v.shape[1:], v.dtype), v]) for k, v in sp.keys.items()}
    s.meta = {**sp.meta, "bottom_row": sp.bottom + top}
    s.cfg = copy.deepcopy(sp.cfg)
    for kf in s.cfg.get("keyframes", {}).values():
        for j, v in kf.items():
            kf[j] = [v[0], v[1] + top]
    s.__dict__.pop("rig", None)
    return s


def _goblin_scale(check) -> None:
    from PIL import Image
    sp = _padded(D.load("goblin"), 40)
    S = _idle_joints(sp)
    f, fx = 1.25, D.base_cx(sp.idle[..., 3] > 0, D.base_rows(D.height(sp.idle)), False)
    fy = sp.foot_row + 1
    h, w = sp.idle.shape[:2]
    big = Image.fromarray(sp.idle, "RGBA").resize((round(w * f), round(h * f)), Image.Resampling.NEAREST)
    can = Image.new("RGBA", (w, h))
    can.paste(big, (round(fx - fx * f), round(fy - fy * f)), big)
    key = np.asarray(can).copy()
    joints = {j: (fx + (x - fx) * f, fy + (y - fy) * f) for j, (x, y) in S.items()}
    T = GT.thresholds()
    good, bad = _row(J1.j1(sp, sp.idle, S, T), "A-scale"), _row(J1.j1(sp, key, joints, T), "A-scale")
    check(good[1] is True and bad[1] is False, f"A-scale: a goblin at 125 % fails ({bad[2]}), unmodified passes "
                                               f"({good[2]})")


def run_fix(check: Callable[[bool, str], None]) -> None:
    from gen.selftest_colossus import sections
    sections(check, _raw_fixtures, _key_fixtures, _rhyos, _warrior, _goblin_scale)
