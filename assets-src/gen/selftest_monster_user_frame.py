"""EF-H amendment A (docs/ENEMY_FEEDBACK_PLAN.md): selftests of the tall frame of gen/monster_user_frame.py. The frame
rule on native heights (tall when the idle is above the large band or the tallest pose is over the large cell's 121
rows), the tall cut (200-row cells, feet on row 192, s = 1.0, the minimum width 128, the border clear), the approved
json shapes (`frame: tall` only for a tall import), the four shipped large-frame user sheets unchanged, the real
fire_hydra recipe, and the tier report's large-tier comparison (report only)."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path
from typing import Callable

import numpy as np


def _frame_of(check: Callable[[bool, str], None], MF) -> None:
    from gen import spec as S
    cases = [("large", [122, 123, 134, 82], "tall"), ("large", [112, 93, 115, 113], "large"),
             ("large", [120, 100, 121, 90], "large"), ("large", [120, 100, 122, 90], "tall"),
             ("large", [121, 100, 121, 90], "tall"), ("small", [70, 90, 60, 50], "small")]
    got = [MF.frame_of(size, hs) for size, hs, _ in cases]
    check([g[0] for g in got] == [c[2] for c in cases]
          and got[-1][1] == S.MONSTER_BANDS["small"] and got[1][1] == S.MONSTER_BANDS["large"]
          and (got[0][1].cell, got[0][1].foot_row, got[0][1].height) == (200, 192, (96, 184)) and MF.MIN_W == 128,
          f"EF-H A frame_of: tall when the idle is over 120 or the tallest pose over 121 rows, else large; small stays "
          f"small ({[g[0] for g in got]})")


def _tall_cut(check: Callable[[bool, str], None]) -> None:
    from gen import monster_user as U
    from gen import monster_user_review as UR
    from gen import selftest_monster_user as T
    with tempfile.TemporaryDirectory() as t:
        td = Path(t)
        rec = T.tree(td, T.row(heights=(122, 100, 134, 90)))
        frames, info = U.cut("syn", rec, td)
        a = [np.asarray(f) for f in frames]
        low = [int(np.where(x[..., 3].any(1))[0].max()) for x in a]
        border = any(m[0].any() or m[-1].any() or m[:, 0].any() or m[:, -1].any() for m in (x[..., 3] for x in a))
        check(info.get("frame") == "tall" and info["scale"] == 1.0 and low == [192] * 4
              and all(f.size == (info["cw"], 200) for f in frames) and info["cw"] % 2 == 0 and info["cw"] >= 128
              and not border,
              f"EF-H A tall cut: four 200-row frames, feet on row 192, s = 1.0, even cw {info.get('cw')} >= 128, border "
              f"clear (frame {info.get('frame')}, scale {info.get('scale')}, feet {low})")
        meta, kneel = UR.metas("syn", rec, info, "2026-11-25")
        check(meta["grid"] == [info["cw"], 200] and meta["bottom_row"] == 192 and kneel["foot_row"] == 192
              and kneel["grid"] == [info["cw"], 200] and meta.get("frame") == kneel.get("frame") == "tall",
              f"EF-H A metas: grid [cw, 200], bottom_row / foot_row 192, frame tall ({meta['grid']}, "
              f"{meta['bottom_row']}, {kneel.get('foot_row')}, {meta.get('frame')})")
        U.approve("syn", td / "approved", "2026-11-25")
        from PIL import Image
        check(Image.open(td / "approved" / "syn" / "kneel.png").size == (info["cw"], 200)
              and U.check(json.loads((td / "approved" / "syn" / "kneel.json").read_text()), td) is None,
              "EF-H A approve: a 200-row kneel.png, re-imported byte for byte")
    with tempfile.TemporaryDirectory() as t:
        td = Path(t)
        rec = T.tree(td, T.row(heights=(112, 100, 120, 90)))
        frames, info = U.cut("syn", rec, td)
        meta, kneel = UR.metas("syn", rec, info, "2026-11-25")
        check(info.get("frame") == "large" and all(f.size[1] == 128 for f in frames) and "frame" not in meta
              and "frame" not in kneel and meta["bottom_row"] == 122,
              f"EF-H A large cut: 128-row frames on row 122, no frame key (frame {info.get('frame')})")


def _shipped(check: Callable[[bool, str], None]) -> None:
    from gen import monster_user as U
    from gen import monster_user_review as UR
    for sid in ("dark_wizard", "pirate", "vampire", "vampire_lord"):
        d = U.HERE / "approved" / sid
        if not (d / "monster_large.json").is_file():
            continue
        rec = U.recipe(sid)
        _, info = U.cut(sid, rec)
        meta, kneel = UR.metas(sid, rec, info, "x")
        same = []
        for name, m in (("monster_large", meta), ("kneel", kneel)):
            have = json.loads((d / f"{name}.json").read_text())
            same.append({k: v for k, v in have.items() if k != "approved"} == json.loads(json.dumps(
                {k: v for k, v in m.items() if k != "approved"})) and U.check(have) is None)
        check(all(same) and info.get("frame") == "large",
              f"EF-H A {sid}: still the large frame, its jsons recomputed equal (but for approved), re-import byte for "
              f"byte ({same})")


def _real(check: Callable[[bool, str], None]) -> None:
    from gen import monster_user as U
    import yaml
    if "fire_hydra" not in (yaml.safe_load(U.RECIPES.read_text()) or {}):
        return
    frames, info = U.cut("fire_hydra", U.recipe("fire_hydra"))
    check(info.get("frame") == "tall" and info["scale"] == 1.0 and info["cw"] == 224
          and info["native_heights"] == [122, 123, 134, 82],
          f"EF-H A fire_hydra: tall frame, s = 1.0, cw {info.get('cw')}, heights {info.get('native_heights')}")
    d = U.HERE / "approved" / "fire_hydra"
    for name in ("monster_large", "kneel"):
        if (d / f"{name}.json").is_file():
            meta = json.loads((d / f"{name}.json").read_text())
            check(meta.get("backend") == "user" and meta.get("frame") == "tall" and U.check(meta) is None,
                  f"EF-H A fire_hydra {name}: backend user, frame tall, re-imported byte for byte")


def _tiers(check: Callable[[bool, str], None], MF) -> None:
    a = np.zeros((200, 120, 4), np.uint8)
    b = np.zeros((200, 120, 4), np.uint8)
    a[100:192, 10:90, 3] = 255
    b[100:192, 22:102, 3] = 255                          # the centroid moves 12 px; the keys the same pair
    span = (a, b)
    res = MF.compare_step(a, b, span, 200, 0.5, 0.02)
    check(res["cell"] == [] and any("centroid" in e for e in res["large"]),
          f"EF-H A tiers: a 12 px centroid step passes at the 200-row cell (cap 15) and is listed at the large tier "
          f"(cap 9.6) ({res})")


def _anchors(check: Callable[[bool, str], None], MF) -> None:
    from gen import monster_user as U
    figs = []
    for x0, w, foot in ((10, 60, 30), (10, 60, 30), (10, 60, 30), (20, 80, 0)):   # the 4th: feet at its left end
        a = np.zeros((40, 120, 4), np.uint8)
        a[5:30, x0:x0 + w, 3] = 255
        a[30:36, x0 + foot:x0 + foot + 4, 3] = 255
        figs.append(a)
    feet = MF.anchors(figs, U.anchor)
    box = MF.anchors(figs, U.anchor, {"idle": None, "attack": None, "hurt": None, "kneel": "bbox"})
    off = feet[0] - 39.5
    check(feet[3] == 21.5 and box[:3] == feet[:3] and box[3] == 59.5 + off
          and T_refused(lambda: MF.anchors(figs, U.anchor, {"idle": "bbox", "attack": None, "hurt": None, "kneel": None}))
          and T_refused(lambda: MF.anchors(figs, U.anchor, {"idle": None, "attack": "x", "hurt": None, "kneel": None})),
          f"EF-H A anchor: `bbox` places a pose by its box centre with the idle's feet-to-centre offset ({feet} / {box}); "
          f"a bbox idle and an unknown mode are refused")


def _selects(check: Callable[[bool, str], None]) -> None:
    from gen import monster_user_palette as UP
    o = np.array([(180, 38, 40), (194, 57, 44), (233, 76, 21), (250, 117, 37), (255, 172, 54), (164, 46, 20),
                  (208, 54, 37), (217, 128, 69), (128, 128, 128), (6, 4, 10)], np.float32)
    red, ember = UP.SELECT.get("red"), UP.SELECT.get("ember")
    got = (None if red is None else red(o).tolist(), None if ember is None else ember(o).tolist())
    check(got == ([True, True, False, False, False, False, True, False, False, False],
                  [False, False, True, True, True, True, False, False, False, False]),
          f"EF-H A palette classes: `red` (a crimson frill: green and blue both low) and `ember` (a glowing visor: "
          f"warm, blue under half the green) ({got})")


def _wide_edges(check: Callable[[bool, str], None]) -> None:
    """A user figure over 200 px wide keeps its 1-px edge detail (claw and horn tips): the alpha is the figure, so the
    renders' blob filter on a 4x-reduced mask (pixelize.foreground for w > 200) must not trim it (fire_hydra review)."""
    from gen import monster_user as U
    from gen import pixelize as PX
    a = np.zeros((120, 230, 4), np.uint8)
    a[40:110, 5:225] = (150, 40, 40, 255)
    a[30:40, 100, :] = (20, 10, 20, 255)                 # a 1-px horn tip, 10 px tall, above the body
    a[110:116, 50] = (20, 10, 20, 255)                    # a 1-px claw below it
    m = a[..., 3] > 0
    rgb = a[..., :3].copy()
    figs, _ = U.quantize([(rgb, m)], 1.0)
    out = figs[0][..., 3] > 0
    kept = int(out[30:40, 100].sum()) + int(out[110:116, 50].sum())
    check(kept == 16 and out[m].all(), f"EF-H A wide edges: a 230 px figure keeps its 1-px tips ({kept} of 16 px) and "
                                       f"every opaque px")


def T_refused(fn) -> bool:
    try:
        fn()
    except SystemExit:
        return True
    return False


def run_monster_user_frame(check: Callable[[bool, str], None]) -> None:
    try:
        from gen import monster_user_frame as MF
    except ImportError as e:
        check(False, f"EF-H A: gen/monster_user_frame.py imports ({e!r})")
        return
    _frame_of(check, MF)
    _tall_cut(check)
    _shipped(check)
    _real(check)
    _tiers(check, MF)
    _anchors(check, MF)
    _selects(check)
    _wide_edges(check)
