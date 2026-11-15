"""FW-8 self-tests (docs/ROSTER_PLAN.md 8), run from selftest.py (test_monster_anim, also --anim): the paged packer
(groups start pages, spills, no straddling, stable earlier pages, a sheet too big for a page), the group order, the
committed atlas index (every page <= MAX_PAGE, every sheet's rects inside its page) and `check`'s `<id>: no rig` line."""
from __future__ import annotations

import contextlib
import io
import json
from pathlib import Path
from typing import Callable

from gen import anim_rules as AR
from gen import monster_pages as MP

ATLAS_JSON = Path(__file__).resolve().parents[2] / "assets" / "sprites" / "monsters-ai.json"


def _raises(fn: Callable[[], object]) -> str:
    try:
        fn()
    except SystemExit as e:
        return str(e) or "exit"
    return ""


def run_pages(check: Callable[[bool, str], None]) -> None:
    check(AR.MAX_PAGE == 2048, f"MAX_PAGE is 2048 ({AR.MAX_PAGE})")
    cell = [(100, 100)] * 10                                         # one sheet: 10 cells of 100x100 (2 shelves at 512)
    sizes, at = MP.pack_pages([[("a", cell), ("b", cell)], [("c", cell)]], cap=512)
    check(at["a"][0] == 0 and at["b"][0] == 0 and at["c"][0] == 1, f"each group starts a new page {at}")
    check(at["a"][1][:6] == [(0, 0), (100, 0), (200, 0), (300, 0), (400, 0), (0, 100)],
          "inside a page the R0 shelf packer (a new shelf when the row is full)")
    _, at3 = MP.pack_pages([[("s", cell[:3]), ("b", cell)]], cap=512)
    check(at3["b"][1][:3] == [(300, 0), (400, 0), (0, 100)], f"the next sheet continues the shelf {at3['b'][1][:3]}")
    sizes2, at2 = MP.pack_pages([[("a", cell), ("b", cell), ("d", cell)], [("c", cell)]], cap=512)
    check(at2["d"][0] == 1 and at2["c"][0] == 2 and at2["d"][1][0] == (0, 0),
          "a full page spills the group onto a new page; a sheet never straddles pages")
    check(at2["a"] == at["a"] and at2["b"] == at["b"] and at2["c"][1] == at["c"][1],
          "adding a sprite to a group moves no earlier cell (later groups keep their cells, on a later page)")
    check(all(w <= 512 and h <= 512 for w, h in sizes + sizes2), f"every page within the cap {sizes2}")
    check(bool(_raises(lambda: MP.pack_pages([[("big", [(600, 10)])]], cap=512))), "a sheet wider than a page fails")
    check(bool(_raises(lambda: MP.pack_pages([[("tall", [(100, 300)] * 12)]], cap=512))),
          "a sheet too big for an empty page fails")
    g = MP.group_order(["zz_new", "wolf", "chaos", "goblin", "crazy_horse"])
    check(g == [("act1", ["goblin", "wolf"]), ("bosses", ["chaos"]), ("A", ["crazy_horse"]), ("other", ["zz_new"])],
          f"group order: act1, bosses, A-D, then unlisted ids sorted {g}")
    act1 = dict(MP.PAGE_GROUPS)["act1"]
    check(act1 == sorted(act1) and len(act1) == 14, "page 0 keeps the 14 R0 sheets in their R0 (sorted) order")

    meta = json.loads(ATLAS_JSON.read_text())
    pages = meta.get("pages", [])
    check(bool(pages) and all(p["w"] <= AR.MAX_PAGE and p["h"] <= AR.MAX_PAGE for p in pages),
          f"committed atlas: {len(pages)} page(s), each <= {AR.MAX_PAGE}")
    bad = [s for s, v in meta["sheets"].items() if not 0 <= v.get("page", -1) < len(pages) or any(
        x + v["cell"][0] > pages[v["page"]]["w"] or y + v["cell"][1] > pages[v["page"]]["h"] for x, y in v["frames"].values())]
    check(not bad, f"committed atlas: every sheet's rects inside its page {bad}")

    from gen import monster_anim as MA
    from gen import monster_review as MR
    sid = MA.load_entries()[0][0]
    real, buf = MA.load_rig, io.StringIO()
    MA.load_rig = lambda _s: None
    try:
        with contextlib.redirect_stdout(buf):
            code = MR.main(["check", sid])
    finally:
        MA.load_rig = real
    # load_entries notes partly approved bosses ("boss poses incomplete") while a roster boss is being generated
    lines = [ln for ln in buf.getvalue().splitlines() if ln.strip() and not ln.endswith("boss poses incomplete, skipped")]
    check(lines == [f"{sid}: no rig"] and code == 0,
          f"check prints the stable line '<id>: no rig' for an unrigged sheet and exits 0 ({buf.getvalue().strip()!r})")
    run_wide_cells(check)


def run_wide_cells(check: Callable[[bool, str], None]) -> None:
    """Wide boss cells: a sheet's cell is the max of its keyframes; smaller keyframes are padded, centred (the per-pose
    cut centres each figure in its own cell), feet row kept, never cropped. Uniform sheets come back unchanged."""
    import numpy as np
    from PIL import Image
    from gen import monster_anim as MA
    pad = getattr(MA, "pad_keyframes", None)
    check(pad is not None, "monster_anim.pad_keyframes exists")
    if pad is None:
        return
    idle = Image.new("RGBA", (200, 200), (0, 0, 0, 0))
    idle.putpixel((0, 199), (9, 9, 9, 255))
    idle.putpixel((199, 0), (8, 8, 8, 255))
    wide = Image.new("RGBA", (218, 200), (1, 2, 3, 255))
    kfs, meta = pad({"idle": idle, "attack": wide}, {"bottom_row": 192})
    check({k: v.size for k, v in kfs.items()} == {"idle": (218, 200), "attack": (218, 200)},
          f"every keyframe gets the widest keyframe's cell {[v.size for v in kfs.values()]}")
    a = np.asarray(kfs["idle"])
    check(a[199, 9, 3] == 255 and a[0, 208, 3] == 255 and a[:, :9, 3].max() == 0 and a[:, 209:, 3].max() == 0,
          "a narrower keyframe is centred ((218 - 200) / 2 = 9 px each side), nothing cropped")
    check(kfs["attack"] is wide and meta["bottom_row"] == 192, "the widest keyframe and the feet row are unchanged")
    same = {"idle": idle, "hurt": idle.copy()}
    k2, _ = pad(same, {"bottom_row": 192})
    check(all(k2[k] is same[k] for k in same), "a uniform sheet's keyframes come back untouched (same objects)")
    raw = {}
    for sid in ("hollow_seraph", "warmech"):
        for p in ("idle", "attack", "hurt", "cast", "attack_raise"):
            f = MA.APPROVED / sid / f"boss_{p}.png"
            if f.exists():
                raw[(sid, p)] = Image.open(f).convert("RGBA")
    entries = {e[0]: e for e in MA.load_entries()}
    for sid in ("hollow_seraph", "warmech"):
        if sid not in entries:
            continue
        kf = entries[sid][2]
        w = max(raw[(s, p)].size[0] for (s, p) in raw if s == sid)
        ok = all(im.size == (w, 200) and np.array_equal(np.asarray(im)[:, (w - raw[(sid, p)].size[0]) // 2:][:, :raw[(sid, p)].size[0]],
                                                         np.asarray(raw[(sid, p)])) for p, im in kf.items())
        check(ok, f"{sid}: every keyframe padded to the {w} px cell, approved pixels intact")
