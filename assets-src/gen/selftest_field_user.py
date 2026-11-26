"""Pass PT (docs/PLAYTEST_ART_PLAN.md 6.5): selftests of gen/field_user.py, the import of a user-rendered field sheet.
Synthetic 3 x 3 renders in a temp generator tree: an on-grid alpha render kept exactly (amendment A1), the same sheet
on magenta and drawn 3x as big pixels (resampled back), a side row facing right (`side_faces: right`), an off-band
height (scaled to the band's target), the broom's hop lift, the selective outline where an edge has none, the refusals
(a missing figure, an extra figure, a too-wide figure, a sha256 mismatch), approve's shape and the re-import check,
the style-lock dispatch, determinism under PYTHONHASHSEED 0 / 1, and the real recipes."""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Callable

import numpy as np
import yaml
from PIL import Image

OUT = (40, 24, 28)
BODY, HEAD, LEG = (170, 60, 64), (230, 190, 150), (90, 70, 50)


def figure(h: int, step: int, outline: bool = True, nose: int = 0) -> np.ndarray:
    """A 24-px-wide outlined child-like figure h px tall: head, body, two legs (step moves one leg by `step`), and on
    a side view a nose on the left (nose -1) or the right (+1)."""
    a = np.zeros((h, 24, 4), np.uint8)
    hh = h // 3
    a[:hh, 6:18] = (*HEAD, 255)
    if nose:
        a[hh // 2:hh // 2 + 3, (2, 18)[nose > 0]:(6, 22)[nose > 0]] = (*HEAD, 255)
    a[hh:h - 10, 3:21] = (*BODY, 255)
    a[h - 10:, 6:10] = (*LEG, 255)
    a[h - 10:h - max(0, -step), 14 + step:18 + step] = (*LEG, 255)
    if outline:
        m = a[..., 3] > 0
        p = np.pad(m, 1)
        edge = m & ~(p[2:, 1:-1] & p[:-2, 1:-1] & p[1:-1, 2:] & p[1:-1, :-2])
        a[edge, :3] = OUT
    return a


def sheet(h: int = 54, missing: bool = False, extra: bool = False, wide: bool = False, facing_right: bool = False,
          lift: int = 0, outline: bool = True) -> Image.Image:
    out = np.zeros((288, 144, 4), np.uint8)
    for r in range(3):
        for c in range(3):
            if missing and (r, c) == (1, 2):
                continue
            f = figure(h, (0, -2, 2)[c], outline, (0, 0, 1 if facing_right else -1)[r])
            if wide and (r, c) == (0, 0):
                f = np.repeat(f, 3, axis=1)[:, 12:60]          # 48 px drawn: wider than the 46 px a cell allows
            dy = 93 - (h - 1) - (lift if c == 1 else 0)
            x0 = c * 48 + (48 - f.shape[1]) // 2
            out[r * 96 + dy:r * 96 + dy + h, x0:x0 + f.shape[1]][f[..., 3] > 0] = f[f[..., 3] > 0]
    if extra:
        out[100:130, 2:5] = (*BODY, 255)                    # a 90-px stray piece in the back row
    return Image.fromarray(out)


def tree(tmp: Path, recs: dict[str, tuple[Image.Image, dict]]) -> Path:
    gen = tmp / "gen"
    (gen / "approved").mkdir(parents=True, exist_ok=True)
    y = {}
    for sid, (img, extra) in recs.items():
        p = gen / "user_art" / sid / "field_2026-01-01.png"
        p.parent.mkdir(parents=True, exist_ok=True)
        img.save(p)
        y[sid] = {"file": str(p.relative_to(gen)), "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
                  "band": "child", "tool": "test", "rendered": "2026-01-01", **extra}
    (gen / "field_user.yaml").write_text(yaml.safe_dump(y))
    return gen


def refused(fn: Callable, *a) -> str:
    try:
        fn(*a)
    except SystemExit as e:
        return str(e)
    return ""


def run_field_user(check: Callable[[bool, str], None]) -> None:
    from gen import field_user as F
    from gen import pixelize as PX
    base = sheet()
    magenta = np.asarray(base).copy()
    magenta[magenta[..., 3] == 0] = (255, 0, 255, 255)
    big = base.resize((432, 864), Image.Resampling.NEAREST)
    with tempfile.TemporaryDirectory() as td:
        gen = tree(Path(td), {
            "on_grid": (base, {}), "magenta": (Image.fromarray(magenta), {}), "big": (big, {}),
            "right": (sheet(facing_right=True), {"side_faces": "right"}), "small": (sheet(h=40), {}),
            "hop": (sheet(h=60, lift=4), {"band": "broom", "walk": "hop"}), "bare": (sheet(outline=False), {}),
            "missing": (sheet(missing=True), {}), "extra": (sheet(extra=True), {}), "wide": (sheet(wide=True), {}),
            "badsha": (base, {})})
        y = yaml.safe_load((gen / "field_user.yaml").read_text())
        y["badsha"]["sha256"] = "0" * 64
        (gen / "field_user.yaml").write_text(yaml.safe_dump(y))
        cut = lambda sid: F.cut(sid, F.recipe(sid, gen / "field_user.yaml"), gen)   # noqa: E731
        a, info = cut("on_grid")
        A = np.asarray(a)
        check(a.size == (144, 288) and set(np.unique(A[..., 3])) <= {0, 255}, "on-grid: 144 x 288, binary alpha")
        check(np.array_equal(A[..., 3] > 0, np.asarray(base)[..., 3] > 0), "A1: an on-grid render keeps its own mask")
        opaque = A[A[..., 3] > 0][:, :3]
        opaque = opaque[~(opaque == PX.OUTLINE).all(1)]                 # the house outline is its own colour
        check(info["scale"] == 1.0 and info["colours"] <= 16 and np.array_equal(PX.snap15(opaque.astype(float)), opaque),
              f"in band: s = 1, <= 16 colours on the 15-bit grid ({info['colours']})")
        dark = A[A[..., 3] > 0][:, :3]
        check(any((dark == PX.OUTLINE).all(1)), "the darkest colour is PX.OUTLINE")
        feet = [int(np.where(A[r * 96:(r + 1) * 96, c * 48:(c + 1) * 48, 3].any(1))[0].max()) for r in range(3)
                for c in range(3)]
        check(feet == [93] * 9, f"feet on row 93 in every cell {feet}")
        m, im = cut("magenta")
        check(np.array_equal(np.asarray(m), A) and im["background"] == "magenta", "a magenta background imports equal")
        b, ib = cut("big")
        sizes = lambda m: [m[r * 96:(r + 1) * 96, c * 48:(c + 1) * 48].sum() for r in range(3) for c in range(3)]  # noqa: E731
        check(abs(ib["pitch"] - 3.0) < 0.05 and ib["background"] == "alpha" and np.allclose(sizes(np.asarray(b)[..., 3] > 0), sizes(A[..., 3] > 0), rtol=0.05),
              f"a 3x big-pixel render resamples to 1x (pitch {ib['pitch']}, every figure's area within 5 %)")
        r, _ = cut("right")
        boxed = lambda m: m[np.ix_(m.any(1), m.any(0))]   # noqa: E731
        R, L = np.asarray(r)[..., 3] > 0, np.asarray(sheet(facing_right=True))[..., 3][:, ::-1] > 0
        check(all(np.array_equal(boxed(R[192:, c * 48:(c + 1) * 48]), boxed(L[192:, (2 - c) * 48:(3 - c) * 48]))
                  for c in range(3)), "side_faces: right mirrors each side figure to face left, order kept")
        s, isml = cut("small")
        hs = [int(np.ptp(np.where(np.asarray(s)[r * 96:(r + 1) * 96, :48, 3].any(1))[0]) + 1) for r in range(3)]
        check(isml["scale"] != 1.0 and all(50 <= h <= 58 for h in hs), f"off band (40 px): scaled into 50-58 {hs}")
        h, ih = cut("hop")
        lows = [int(np.where(np.asarray(h)[r * 96:(r + 1) * 96, 48:96, 3].any(1))[0].max()) for r in range(3)]
        check(lows == [89] * 3 and ih["lift"][1::3] == [4] * 3, f"walk: hop keeps the hop frame's lift {lows}")
        bare_in = np.asarray(sheet(outline=False))
        bare, _ = cut("bare")
        B = np.asarray(bare)
        check((B[..., 3] > 0).sum() > (bare_in[..., 3] > 0).sum() and
              ((B[..., 3] > 0) & (bare_in[..., 3] == 0) & (B[..., :3] == PX.OUTLINE).all(-1)).any(),
              "a light edge with no outline gets the selective PX.OUTLINE ring (pixelize_native)")
        for sid, want in (("missing", "need 3"), ("extra", "need exactly 3"), ("wide", "does not fit"), ("badsha", "sha256")):
            why = refused(cut, sid)
            check(want in why, f"{sid} refused ({why[:70]})")
        paths = F.approve("on_grid", gen / "approved", "2026-01-01")
        meta = json.loads(paths[1].read_text())
        check([p.name for p in paths] == ["field.png", "field.json"] and meta["backend"] == "user" and
              meta["rows"] == ["down", "up", "left"] and meta["flip_rows"] == [] and meta["bottom_row"] == 93,
              "approve writes field.{png,json} (backend user, rows down / up / left, no flip_rows)")
        check(F.check(meta, gen) is None, "check: the approved sheet re-imports identically")
        Image.fromarray(np.zeros((288, 144, 4), np.uint8)).save(gen / "approved" / "on_grid" / "field.png")
        check("differs" in (F.check(meta, gen) or ""), "check fails on a changed approved png")
        check("no byte-identical archive" in refused(F.approve, "on_grid", gen / "approved", "2026-01-01"),
              "approve refuses to overwrite a different approved sheet without an archive")
    check(F.user_check({"sheet": "field", "character": "_none_"}) is not None and
          "monster_user" in F.user_check.__doc__, "the style-lock dispatch routes field sheets to field_user.check")
    code = ("import sys,hashlib;sys.path.insert(0,'.');from gen import field_user as F;"
            "print(','.join(hashlib.sha256(F.cut(i)[0].tobytes()).hexdigest()[:12] for i in sys.argv[1:]))")
    ids = list(yaml.safe_load(F.RECIPES.read_text()) or {})
    runs = {seed: subprocess.run([sys.executable, "-I", "-c", code, *ids], capture_output=True, text=True,
                                 cwd=F.HERE.parent, env={"PYTHONHASHSEED": seed}).stdout for seed in ("0", "1")}
    check(runs["0"] == runs["1"] and runs["0"].strip(), f"cut is the same under PYTHONHASHSEED 0 / 1 ({runs['0'].strip()})")
    for sid in ids:
        p = F.HERE / "approved" / sid / "field.json"
        if p.is_file():
            check(F.check(json.loads(p.read_text())) is None, f"{sid}: the approved sheet re-imports identically")


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    fails = []
    run_field_user(lambda ok, msg: (print(("  ok   " if ok else "  FAIL ") + msg), None if ok else fails.append(msg)))
    sys.exit(1 if fails else 0)
