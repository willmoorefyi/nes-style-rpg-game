"""Cutter selftests (ROSTER_LOG batch B: 14 rejections were reaches sliced flat at the raw's fixed thirds). RED first:
the fixed-thirds cutter (`split="thirds"`, how every approved sheet was cut) slices a synthetic reach that crosses the
two-thirds line and `flat_edges` flags it; the gap splitter (the default for future cuts) keeps it whole and unflagged,
is byte-identical to the thirds when no piece crosses a line, and keeps the thirds when two figures are fused across
a line. Approved sheets are never re-cut (approve.py copies the reviewed cut); their request keys are checked by
selftest_roster (FW-9) and their PNGs by `git diff --exit-code assets-src/gen/approved`."""
from __future__ import annotations

from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image, ImageDraw

from gen import monster as M
from gen import spec as S

CW, CH, PITCH = 105, 135, 5


def _raw(reach: int = 0, fused: bool = False) -> Image.Image:
    """Three 64-px figures on magenta (the selftest.py monster raw); the attack figure's arm reaches `reach` sprite px
    right of its body, crossing the two-thirds line (x 210) when reach > 29; `fused` joins attack and hurt bodies."""
    art = Image.new("RGB", (CW * 3, CH), (255, 0, 255))
    d = ImageDraw.Draw(art)
    for i, dx in enumerate((0, 6, -4)):
        x0, y1 = i * CW + 30 + dx, 120
        d.rectangle([x0, y1 - 63, x0 + 40, y1], fill=(60, 140, 60), outline=(0, 0, 0))
        d.rectangle([x0 + 4, y1 - 60, x0 + 36, y1 - 44], fill=(230, 190, 150))
    if reach:
        d.rectangle([181, 78, 181 + reach, 88], fill=(200, 120, 60), outline=(0, 0, 0))     # the reaching arm
    if fused:
        d.rectangle([181, 95, 236, 110], fill=(60, 140, 60), outline=(0, 0, 0))            # a wide tail into the hurt
    return art.resize((art.width * PITCH, art.height * PITCH), Image.Resampling.NEAREST)


def _same(a: list[Image.Image], b: list[Image.Image]) -> bool:
    return len(a) == len(b) and all(x.size == y.size and np.array_equal(np.asarray(x), np.asarray(y)) for x, y in zip(a, b))


def _width(f: Image.Image) -> int:
    xs = np.where((np.asarray(f)[..., 3] > 0).any(0))[0]
    return int(xs.max() - xs.min() + 1)


def _crop(f: Image.Image) -> np.ndarray:
    a = np.asarray(f)
    ys, xs = np.where(a[..., 3] > 0)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def run_cut(check: Callable[[bool, str], None]) -> None:
    band = S.MONSTER_BANDS["small"]
    clean = _raw()
    t, _ = M.cut(clean, band, split="thirds")
    g, gi = M.cut(clean, band)
    check(_same(t, g) and "split" not in gi, "cut: with no piece crossing a third line the gap splitter is the thirds, byte for byte")
    check(not any(M.flat_edges(f) for f in t), "cut: flat_edges reads 0 on a clean outlined cut")

    reach = _raw(reach=44)                        # the arm ends at x 225: 15 sprite px past the two-thirds line
    t, _ = M.cut(reach, band, split="thirds")
    g, gi = M.cut(reach, band)
    check(bool(M.flat_edges(t[1])), f"cut RED: the fixed thirds slice the reach flat and flat_edges sees it ({M.flat_edges(t[1])[:3]})")
    check(not M.flat_edges(g[1]), f"cut: the gap splitter keeps the reach outlined ({M.flat_edges(g[1])[:3]})")
    check(_width(g[1]) >= _width(t[1]) + 14, f"cut: the whole reach is in the attack cell (width {_width(g[1])} vs {_width(t[1])})")
    check(np.array_equal(_crop(t[0]), _crop(g[0])) and _width(g[2]) == _width(t[2]),
          "cut: the idle pixels are unchanged (the cell only widens) and the hurt keeps its width")
    moved = [m for line in gi.get("split", []) for m in line["moved"]]
    check(len(moved) == 1 and moved[0]["to"] == 1, f"cut: the report names the one moved piece ({gi.get('split')})")
    lead = [int(np.where(np.asarray(f)[..., 3].any(0))[0].min()) for f in (g[0], g[1])]
    lead_t = [int(np.where(np.asarray(f)[..., 3].any(0))[0].min()) for f in (t[0], t[1])]
    check(lead[1] - lead[0] == lead_t[1] - lead_t[0], "cut: the attack keeps its lunge offset from the idle")

    fused = _raw(fused=True)
    ft, _ = M.cut(fused, band, split="thirds")
    fg, _ = M.cut(fused, band)
    _, _, lines = M.split_cells(np.asarray(M.native_art(fused)[0].convert("RGB")), 3)
    check(_same(ft, fg) and any(line.get("fused") for line in lines),
          f"cut: two figures fused across a line keep the thirds (reported fused, no piece moved) ({lines})")
    one, _ = M.cut(_raw(), band, n_cells=1, cell=200, foot_row=192)
    one_t, _ = M.cut(_raw(), band, n_cells=1, cell=200, foot_row=192, split="thirds")
    check(_same(one, one_t), "cut: a one-pose boss cut is unchanged")
    run_float_lift(check)


# ───────── FW-C (docs/ROSTER_FIX_PLAN_2.md 6): the floating lift ─────────
FW, FH = 150, 175                                     # art px per cell (pitch 5): room for a 100 px figure 40 px low


def _float_raw(attack_low: int = 0) -> Image.Image:
    """Three 100-px floating figures (the large band, 96-120) on magenta; the attack is drawn `attack_low` px lower."""
    art = Image.new("RGB", (FW * 3, FH), (255, 0, 255))
    d = ImageDraw.Draw(art)
    for i, (dx, low) in enumerate(((0, 0), (6, attack_low), (-4, 0))):
        x0, y1 = i * FW + 40 + dx, 120 + low
        d.rectangle([x0, y1 - 99, x0 + 60, y1], fill=(60, 140, 60), outline=(0, 0, 0))
        d.rectangle([x0 + 6, y1 - 94, x0 + 54, y1 - 70], fill=(230, 190, 150))
    return art.resize((art.width * PITCH, art.height * PITCH), Image.Resampling.NEAREST)


def _digest(frames: list[Image.Image]) -> str:
    import hashlib
    h = hashlib.sha256()
    for f in frames:
        h.update(f"{f.size}".encode() + np.asarray(f).tobytes())
    return h.hexdigest()[:16]


# the cutter's output before FW-C (3ebbe1d), so "unchanged" is pinned rather than recomputed by the changed cutter
TODAY = {"low10_idle": "e239cf4ba5bc4d70", "low10_hurt": "c3858810103bab0d", "float": "bcbd335faba4f5f6",
         "ground": "bcbd335faba4f5f6"}


def run_float_lift(check: Callable[[bool, str], None]) -> None:
    band = S.MONSTER_BANDS["large"]
    low, info = M.cut(_float_raw(10), band, floating=True)
    check(info["clipped"] == [] and info.get("lifted") == {"attack": 7},
          f"FW-C: a floating attack drawn 10 px low is lifted 7 px (132 - 125), not clipped ({info['clipped']}, {info.get('lifted')})")
    bottom = int(np.nonzero((np.asarray(low[1])[..., 3] > 0).any(1))[0].max())
    check(bottom == band.cell - 3, f"FW-C: the lifted attack's lowest row is the cell's 2 px margin ({bottom})")
    got = {"low10_idle": _digest([low[0]]), "low10_hurt": _digest([low[2]]),
           "float": _digest(M.cut(_float_raw(0), band, floating=True)[0]), "ground": _digest(M.cut(_float_raw(10), band)[0])}
    check(got == TODAY, f"FW-C: the idle and hurt cells, a floating raw with no low cell and a grounded raw are "
          f"byte-identical to the cutter before FW-C ({got})")
    check("lifted" not in M.cut(_float_raw(0), band, floating=True)[1] and "lifted" not in M.cut(_float_raw(10), band)[1],
          "FW-C: no `lifted` entry without a low floating cell")
    over = M.LIFT_MAX + 1 + 3                          # the lift is the drop minus the 3 px (2 px margin + the foot row gap)
    try:
        M.cut(_float_raw(over), band, floating=True)
        refused = ""
    except ValueError as e:
        refused = str(e)
    check("attack" in refused and str(M.LIFT_MAX) in refused, f"FW-C: a lift of LIFT_MAX + 1 is refused naming the pose ({refused!r})")
    import os
    import subprocess
    import sys
    code = ("import sys; sys.path.insert(0, sys.argv[1]); from gen import selftest_cut as T, monster as M, spec as S; "
            "print(T._digest(M.cut(T._float_raw(10), S.MONSTER_BANDS['large'], floating=True)[0]))")
    root = str(Path(__file__).resolve().parents[1])
    outs = {subprocess.run([sys.executable, "-I", "-c", code, root], capture_output=True, text=True,
                           env={**os.environ, "PYTHONHASHSEED": s}).stdout.strip() for s in ("0", "1")}
    check(len(outs) == 1 and _digest(low) in outs, f"FW-C: PYTHONHASHSEED 0 and 1 give the same bytes ({outs})")
