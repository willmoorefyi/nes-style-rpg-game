"""FW-T self-tests (docs/REDESIGN_PLAN.md 4.2, 7), run from selftest.py (test_monster_anim, also --anim): the titan band
(300 px cell, feet row 292, figure 258-278), its fail-closed cut (RED: a 1024^2 render at pitch 5.12, about 200 native,
is refused; one at pitch 3.3 with a 270-native grid figure cuts 1:1 in grid mode with the lowest row 292), the probe,
approve.py writing `size: titan` / bottom_row 292, load_entries and the atlas on a titan fixture, the cell-relative
continuity cap at 300, the `titan` page group (size-keyed; no cell of pages 0-1 moves; byte-identical pages without a
titan) and every approved boss request key unchanged.

  python3 -I assets-src/gen/selftest_titan.py
"""
from __future__ import annotations

import contextlib
import io
import json
import shutil
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace
from typing import Callable

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

HERE = Path(__file__).resolve().parent
ATLAS_JSON = HERE.parents[1] / "assets" / "sprites" / "monsters-ai.json"
TITAN = {"id": "tt", "kind": "monster", "size": "titan", "per_pose": True, "seeds": [1234]}


def render(native_h: int, pitch: float, width: int = 120, canvas: int = 1024, blur: float = 0.0) -> Image.Image:
    """A synthetic per-pose render on magenta: a textured outlined figure `native_h` art px tall, drawn on a pixel grid
    of `pitch` render px per art px (nearest), optionally blurred (no detectable grid)."""
    n = int(round(canvas / pitch))
    a = np.zeros((n, n, 3), np.uint8)
    a[:] = (255, 0, 255)
    x0, y1 = (n - width) // 2, n - 6
    rng = np.random.default_rng(7)
    pal = np.array([[60, 60, 80], [90, 80, 60], [140, 120, 40], [200, 180, 90]], np.uint8)
    a[y1 - native_h + 1:y1 + 1, x0:x0 + width] = pal[rng.integers(0, 4, (native_h, width))]
    a[y1 - native_h + 1, x0:x0 + width] = a[y1, x0:x0 + width] = (6, 4, 10)
    a[y1 - native_h + 1:y1 + 1, x0] = a[y1 - native_h + 1:y1 + 1, x0 + width - 1] = (6, 4, 10)
    im = Image.fromarray(a).resize((canvas, canvas), Image.Resampling.NEAREST)
    return im.filter(ImageFilter.GaussianBlur(blur)) if blur else im


def _cut(char: dict, raw: Image.Image):
    from gen import generate as GEN
    try:
        frames = GEN.cut_frames(raw, Image.new("RGB", (4, 4)), GEN.SHEETS["boss_idle"], char, 1234)
        return frames, GEN.LAST_RESAMPLE["boss_idle"], ""
    except ValueError as e:
        return [], getattr(e, "info", {}), str(e)


def run_titan(check: Callable[[bool, str], None]) -> None:
    from gen import generate as GEN
    from gen import monster as M
    from gen import spec as S
    b = S.MONSTER_BANDS.get("titan")
    check(b is not None and (b.cell, b.height, b.foot_row) == (300, (258, 278), 292) and S.TITAN_TOP_MIN == 15,
          f"FW-T: the titan band is a 300 cell, figure 258-278, feet row 292, top row >= 15 ({b})")
    g = S.TITAN_POSE_GEOM
    check(g.grid == (300, 300) and g.bottom_row == 292 and g.cell_px == S.MONSTER_POSE_GUIDE and g.aspect ==
          S.BOSS_POSE_GEOM.aspect and S.pose_geom("titan") is g and S.pose_geom("boss") is S.BOSS_POSE_GEOM
          and S.pose_geom(None) is S.BOSS_POSE_GEOM, "FW-T: TITAN_POSE_GEOM 300x300 / 292 on the boss guide; pose_geom")
    check("monster_titan" not in GEN.SHEETS and "titan" not in S.MONSTER_GEOMS,
          "FW-T: no 3-pose titan sheet (titans are per-pose only)")
    gd = M.pose_guide(b)
    box = (np.abs(np.asarray(gd).astype(int) - np.array(M.GUIDE_BOX)).sum(2) < 6)
    side = int(np.ptp(np.where(box.any(1))[0]) + 1)
    check(M.titan_guide_box() == 914 and abs(side - 915) <= 3,
          f"FW-T: the titan guide box is capped at 914 guide px ({M.titan_guide_box()}; {side} rows drawn, the ground "
          f"line covers the bottom ones)")

    # RED cases: the fail-closed cut
    coarse = render(185, 5.12)                     # a 200x200 native canvas (1024 / 5.12), the figure 185 tall
    fr, info, err = _cut(TITAN, coarse)
    check(not fr and "titan band refuses" in err and info.get("mode") == "grid" and info.get("scale") != 1.0,
          f"FW-T: a 1024^2 render at pitch 5.12 (200 native, figure 185) is refused, not upscaled ({err[:110]!r})")
    fr_b, info_b, err_b = _cut({**TITAN, "size": "boss"}, coarse)
    check(bool(fr_b) and not err_b and fr_b[0].size[1] == 200, f"FW-T: the same render cuts for a boss (control) {err_b}")
    fine = render(270, 3.3)
    fr, info, err = _cut(TITAN, fine)
    ys = np.where(np.asarray(fr[0])[..., 3].any(1))[0] if fr else np.array([0])
    check(bool(fr) and not err and info.get("scale") == 1.0 and info.get("mode") == "grid" and fr[0].size[1] == 300
          and int(ys.max()) == 292 and int(ys.max() - ys.min() + 1) == 270 and int(ys.min()) >= S.TITAN_TOP_MIN,
          f"FW-T: pitch 3.3, a 270-native grid figure: cut 1:1 in grid mode, 300 cell, lowest row 292 ({info.get('scale')},"
          f" {info.get('mode')}, rows {int(ys.min())}-{int(ys.max())}{', ' + err if err else ''})")
    fr, info, err = _cut(TITAN, render(270, 3.3, blur=3.0))
    check(not fr and "titan band refuses" in err and info.get("mode") != "grid",
          f"FW-T: an area-averaged (no grid) render is refused ({str(info.get('mode'))[:40]!r})")
    p_ok, p_no = M.titan_probe(fine), M.titan_probe(coarse)
    check(p_ok["accepted"] and p_ok["native_height"] == 270 and p_ok["lowest_row"] == 292 and p_ok["in_band"]
          and not p_no["accepted"] and p_no["native_height"] == 185 and p_no["guide_box_px"] == 914
          and abs(p_no["guide_box_art_px"] - 914 / 5.12) < 0.2,
          f"FW-T: --titan-probe reports pitch, mode, scale, native height and the guide box in art px ({p_no})")

    _approve_titan(check)
    _entries_and_atlas(check)
    _caps(check)
    _pages(check)
    _boss_keys(check)


def _approve_titan(check) -> None:
    """approve.py writes boss_<pose> with size: titan and the titan feet row (the request and cut faked)."""
    from gen import approve as AP
    from gen import generate as GEN
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        out = t / "out" / "gemini" / "tt" / "1234"
        out.mkdir(parents=True)
        Image.new("RGBA", (306, 300)).save(out / "boss_idle.png")
        real = (AP.APPROVED, GEN.OUT, GEN.load_character, GEN.plan_request, AP._unignore)
        AP.APPROVED, GEN.OUT = t / "approved", t / "out"
        GEN.load_character = lambda cid: dict(TITAN)
        GEN.plan_request = lambda *a, **k: SimpleNamespace(cached=True, key="k" * 24, model="m")
        AP._unignore = lambda key: None
        try:
            meta = json.loads(AP.approve("tt", "boss_idle", []).read_text())
        finally:
            AP.APPROVED, GEN.OUT, GEN.load_character, GEN.plan_request, AP._unignore = real
    check(meta.get("size") == "titan" and meta.get("bottom_row") == 292 and meta.get("grid") == [306, 300]
          and meta.get("poses") == ["idle"], f"FW-T: approve.py writes boss_idle with size titan, bottom_row 292 ({meta})")


def _titan_tree(gen: Path) -> None:
    d = gen / "approved" / "tt"
    d.mkdir(parents=True)
    (gen / "anim" / "monsters").mkdir(parents=True)
    for pose, w, dx in (("idle", 300, 0), ("attack", 312, 14), ("hurt", 300, -10)):
        im = Image.new("RGBA", (w, 300), (0, 0, 0, 0))
        dr = ImageDraw.Draw(im)
        x0 = (w - 120) // 2 + dx
        dr.rectangle([x0, 292 - 269, x0 + 119, 292], fill=(90, 80, 60, 255), outline=(6, 4, 10, 255))
        im.save(d / f"boss_{pose}.png")
        (d / f"boss_{pose}.json").write_text(json.dumps({
            "character": "tt", "sheet": f"boss_{pose}", "grid": [w, 300], "bottom_row": 292, "layout": [1, 1],
            "poses": [pose], "size": "titan", "floating": False, "flip_frames": []}) + "\n")


def _entries_and_atlas(check) -> None:
    """load_entries pads a titan's keys to its widest 300-tall cell (feet row 292 kept); the atlas puts it in the
    `titan` group with cell [312, 300] and footRow 292."""
    from gen import monster_anim as MA
    from gen import monster_atlas as MAT
    from gen.selftest_retire import patched_tree
    with tempfile.TemporaryDirectory() as tmp:
        gen = Path(tmp) / "gen"
        _titan_tree(gen)
        with patched_tree(gen):
            (sid, meta, kfs), = MA.load_entries()
            with contextlib.redirect_stdout(io.StringIO()):
                js = MAT.build(Path(tmp) / "atlas")
    sizes = {k: v.size for k, v in kfs.items()}
    check(sid == "tt" and set(sizes.values()) == {(312, 300)} and meta["bottom_row"] == 292 and meta["size"] == "titan",
          f"FW-T: load_entries pads the titan keys to the 312x300 cell, feet row 292 ({sizes}, {meta['bottom_row']})")
    sh = js["sheets"]["tt"]
    check(sh["cell"] == [312, 300] and sh["footRow"] == 292 and len(js["pages"]) == 1,
          f"FW-T: the atlas packs the titan sheet (cell {sh['cell']}, footRow {sh['footRow']})")


def _caps(check) -> None:
    """The cell-relative continuity cap (6 x cell_h / 80, anim_checks.continuity) is 22.5 px at the 300 cell."""
    from gen import anim_checks as C
    blank = np.zeros((300, 312, 4), np.uint8)

    def blob(x: int) -> np.ndarray:
        a = blank.copy()
        a[200:240, x:x + 40] = 255
        return a
    k = blob(100)
    ok, bad = C.continuity(blob(100), blob(122), (k, k), 300), C.continuity(blob(100), blob(123), (k, k), 300)
    small = C.continuity(blob(100), blob(122), (k, k), 200)
    check(not any("centroid" in e for e in ok) and any("centroid" in e and "22.5" in e for e in bad)
          and any("15.0" in e for e in small), f"FW-T: the continuity cap scales with the cell: 22.5 px at 300 "
                                               f"(22 ok, 23 fails; 15.0 at 200) {bad}")


def _real_groups(titans: set[str]) -> tuple[list, dict]:
    """Pack the committed atlas's sheets (unique frame cells, in page order) with the given titan set."""
    from gen import monster_pages as MP
    sheets = json.loads(ATLAS_JSON.read_text())["sheets"]
    groups = MP.group_order(sorted(sheets), titans)

    def cells(s: str) -> list[tuple[int, int]]:
        pos = sorted({tuple(p) for p in sheets[s]["frames"].values()}, key=lambda p: (p[1], p[0]))
        return [tuple(sheets[s]["cell"])] * len(pos)
    return groups, MP.pack_pages([[(s, cells(s)) for s in ids] for _, ids in groups])[1]


def _pages(check) -> None:
    from gen import monster_pages as MP
    sizes, at = MP.pack_pages([[("t", [(300, 300)] * 22)]])
    check(sizes == [(1800, 1200)] and at["t"][0] == 0, f"FW-T: a 22-frame 300 sheet packs on one page <= 2048 ({sizes})")
    plain, titan = MP.group_order(["goblin", "chaos", "zz"]), MP.group_order(["goblin", "chaos", "zz"], {"chaos"})
    check(plain == [("act1", ["goblin"]), ("bosses", ["chaos"]), ("other", ["zz"])]
          and titan == [("act1", ["goblin"]), ("titan", ["chaos"]), ("other", ["zz"])],
          f"FW-T: a size-titan sheet leaves its listed group for `titan`, after D and before `other` ({titan})")
    sheets = json.loads(ATLAS_JSON.read_text())["sheets"]
    g0, at0 = _real_groups(set())
    same = all(at0[s][0] == v["page"] and sorted(set(map(tuple, at0[s][1]))) == sorted({tuple(p) for p in
               v["frames"].values()}) for s, v in sheets.items())
    check(same and g0 == MP.group_order(sorted(sheets)), "FW-T: with no titan sheet the packer reproduces the committed "
                                                         "atlas cell for cell (pages byte-identical)")
    g1, at1 = _real_groups({"chaos"})
    early = [s for s, v in sheets.items() if v["page"] <= 1]
    moved = [s for s in early if at1[s] != at0[s]]
    last = max(p for p, _ in at1.values())
    check(not moved and dict(g1).get("titan") == ["chaos"] and at1["chaos"][0] == last - (0 if not dict(g1).get("other")
          else 1), f"FW-T: chaos switching to size titan moves no cell of pages 0-1 ({moved}) and gets its own page")


def _boss_keys(check) -> None:
    """Every approved boss pose request (approved/*/boss_*.json) re-plans to its cache key (the titan band changes no
    boss guide, prompt or aspect)."""
    from gen import generate as GEN
    bad, n = [], 0
    for p in sorted((GEN.HERE / "approved").glob("*/boss_*.json")):
        meta = json.loads(p.read_text())
        if meta.get("revived_from"):
            continue
        req = GEN.plan_request(GEN.load_character(meta["character"]), GEN.SHEETS[meta["sheet"]], meta["seed"], "gemini",
                               meta["model"])
        n += 1
        if req.key != meta["cache_key"]:
            bad.append(f"{meta['character']} {meta['sheet']}")
    check(n > 0 and not bad, f"FW-T: all {n} approved boss pose keys unchanged {bad[:3]}")


if __name__ == "__main__":
    fails: list[str] = []

    def _check(cond: bool, msg: str) -> None:
        print(("  ok   " if cond else "  FAIL ") + msg)
        if not cond:
            fails.append(msg)
    run_titan(_check)
    print(f"\n{'ALL PASSED' if not fails else f'{len(fails)} FAILED'}")
    sys.exit(1 if fails else 0)
