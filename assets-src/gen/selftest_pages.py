"""FW-8 self-tests (docs/ROSTER_PLAN.md 8), run from selftest.py (test_monster_anim, also --anim): the paged packer
(groups start pages, spills, no straddling, stable earlier pages, a sheet too big for a page), the group order, the
committed atlas index (every page <= MAX_PAGE, every sheet's rects inside its page) and `check`'s `<id>: no rig` line.
Fix pass (docs/ROSTER_FIX_PLAN.md 3): FW-A atlas anchors (travelTop, lungeRight, homeX; explicit constants from the
atlas at 95b31e2) and FW-R (`raise: false`: no raise frames, the heavy tip from atk_wind2)."""
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
    run_anchors(check)
    run_scale(check)
    run_raise_off(check)
    run_alias(check)


# V4 (docs/REDESIGN_PLAN.md 2.4, D-V2, D-V3): bigeyes (large) and the 22 tier-H (huge) sheets at display scale 3
V4_RESCALED = ("bigeyes", "shark", "minotaur", "ochu", "neochu", "hydra", "earth_elemental", "fire_elemental",
               "water_elemental", "air_elemental", "hill_gigas", "fire_gigas", "ice_gigas", "dragon", "white_dragon",
               "blue_dragon", "green_dragon", "dragon_zombie", "white_shark", "minotaur_zombie", "fire_hydra", "deepeyes",
               "evil_eye")
# V6 (REDESIGN_PLAN 4.2, D-V6 = C2): the redesigned chaos, boss band 200 shown at scale 3 (by design, not a rescale).
V6_SCALED = ("chaos",)


def run_scale(check: Callable[[bool, str], None]) -> None:
    """FW-S (docs/REDESIGN_PLAN.md 2.2, 7): gen/monster_scale.yaml -> the atlas sheet field `scale`, nothing else. On a
    two-sprite fixture build: an explicit {}, a missing file and a comment-only table give byte-identical pages and
    JSON; {goblin: 3} keeps every page byte-identical and adds only `"scale": 3` to goblin's JSON; a value of 4 or an
    unknown sprite is refused. The real table (empty at V1) holds the 23 V4 sheets at 3 since V4 (REDESIGN_PLAN 2.4) and chaos since V6 (D-V6 = C2); it
    names sprites the fixture lacks, so the fixture builds take explicit tables only."""
    import tempfile
    from gen import monster_atlas as MAT
    from gen import retire as RT
    real = MAT.load_scale(set(json.loads(ATLAS_JSON.read_text())["sheets"]))
    check(all(v in MAT.DISPLAY_SCALES for v in real.values()), f"FW-S: the real monster_scale.yaml is valid "
                                                                 f"({len(real)} entries)")
    check(real == {s: 3 for s in V4_RESCALED + V6_SCALED},
          f"FW-S: the real table is the 23 V4 sheets + chaos (V6) at 3 ({sorted(real)})")
    with tempfile.TemporaryDirectory() as tmp, RT.fixture_tree(("goblin", "ogre")):
        t = Path(tmp)

        def build(name: str, text: str | None) -> dict[str, bytes]:
            table = t / f"{name}.yaml"
            if text is not None:
                table.write_text(text)
            out = t / name
            with contextlib.redirect_stdout(io.StringIO()):
                MAT.build(out, table)
            return {p.name: p.read_bytes() for p in sorted(out.iterdir())}
        base = build("empty", "{}\n")
        same = [build("missing", None), build("comments", "# nothing\n")]
        check(bool(base) and all(b == base for b in same) and "scale" not in json.loads(base["monsters-ai.json"])
              ["sheets"]["goblin"], "FW-S: an empty, missing or comment-only table gives byte-identical pages and JSON")
        one = build("one", "goblin: 3\n")
        pages = [n for n in base if n.endswith(".png")]
        a, b = json.loads(base["monsters-ai.json"]), json.loads(one["monsters-ai.json"])
        got = b["sheets"]["goblin"].pop("scale", None)
        check(all(one[n] == base[n] for n in pages) and got == 3 and a == b,
              f"FW-S: {{goblin: 3}} keeps the pages byte-identical and adds only goblin's \"scale\": 3 ({got})")
        for text, word in (("goblin: 4\n", "goblin"), ("nosuch: 3\n", "nosuch"), ("goblin: true\n", "goblin")):
            check(word in _raises(lambda: build("bad", text)), f"FW-S: the table {text.strip()!r} is refused")


def run_alias(check: Callable[[bool, str], None]) -> None:
    """FW-Q (docs/ROSTER_FIX_PLAN_2.md 4): a rig `alias: [hurt]` (or [attack]) leaves that sequence's in-betweens out
    of generate, so the atlas aliases them to their source keys as on a keyframe-only sheet; idle_b, daze / daze_b and
    the other sequences are still generated, byte-identical to the same rig without the alias; `check` prints
    `OK (aliased: hurt; ...)`. Only MA.FWQ_ALLOW entries (selftest_efix pins the list), one per rig. Goblin is
    not on the live allowlist, so a goblin entry is added for the test only."""
    import copy
    import tempfile
    import numpy as np
    from gen import anim_checks as C
    from gen import monster_anim as MA
    from gen import monster_atlas as MAT
    from gen import monster_review as MR
    sid = "goblin"
    _, meta, kfs = next(e for e in MA.load_entries() if e[0] == sid)
    cfg = MA.load_rig(sid)
    base = MA.generate(sid, cfg, kfs, meta)
    hurt = {**copy.deepcopy(cfg), "alias": ["hurt"]}
    check(_raises_value(lambda: MA.generate(sid, hurt, kfs, meta), sid, "FWQ_ALLOW"),
          "FW-Q: an alias not in FWQ_ALLOW is refused (naming the rig)")
    allow, real_rig, real_lock = set(MA.FWQ_ALLOW), MA.load_rig, MA.lock_path
    MA.FWQ_ALLOW |= {(sid, "hurt"), (sid, "attack")}
    try:
        gh = MA.generate(sid, hurt, kfs, meta)
        ga = MA.generate(sid, {**copy.deepcopy(cfg), "alias": ["attack"]}, kfs, meta)
        check(_raises_value(lambda: MA.generate(sid, {**cfg, "alias": ["hurt", "attack"]}, kfs, meta), "one"),
              "FW-Q: a second alias is refused (at most one aliased sequence per rig)")
        check(_raises_value(lambda: MA.generate(sid, {**cfg, "alias": ["cast"]}, kfs, meta), "cast"),
              "FW-Q: only hurt or attack can be aliased")
        MA.load_rig = lambda s: hurt if s == sid else real_rig(s)
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            frames, _, anim = MAT.sprite_frames(sid, meta, kfs)
        lock = {n: C.frame_hash(f["img"]) for n, f in gh.items()}
        with tempfile.TemporaryDirectory() as d:
            lp = Path(d) / f"{sid}.lock.json"
            lp.write_text(json.dumps(lock))
            MA.lock_path = lambda s: lp if s == sid else real_lock(s)
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                code = MR.main(["check", sid])
    finally:
        MA.FWQ_ALLOW.clear()
        MA.FWQ_ALLOW.update(allow)
        MA.load_rig, MA.lock_path = real_rig, real_lock
    gone = {"hurt_in1", "hurt_in2"}
    check(not gone & set(gh) and {"daze", "daze_b", "idle_b", "atk_wind1"} <= set(gh),
          f"FW-Q: alias [hurt] generates no hurt_in1 / hurt_in2; daze, daze_b, idle_b and the attack are generated ({sorted(gh)})")
    check(set(gh) == set(base) - gone and all(np.array_equal(gh[n]["img"], base[n]["img"]) for n in gh),
          "FW-Q: every other frame is byte-identical to the same rig without the alias")
    atk = {"atk_wind1", "atk_wind2", "atk_mid", "atk_follow", "atk_recover"}
    check(set(ga) == set(base) - atk, f"FW-Q: alias [attack] leaves out exactly the five attack in-betweens ({sorted(set(base) - set(ga))})")
    check(anim and not gone & set(frames) and MA.resolve("hurt_in1", frames) == "idle" and MA.resolve("hurt_in2", frames) == "hurt",
          "FW-Q: the atlas aliases hurt_in1 -> idle and hurt_in2 -> hurt (as a keyframe-only sheet)")
    lines = [ln for ln in buf.getvalue().splitlines() if ln.strip() and not ln.endswith("boss poses incomplete, skipped")]
    check(code == 0 and len(lines) == 1 and lines[0].startswith(f"{sid}: OK (aliased: hurt"),
          f"FW-Q: check prints 'OK (aliased: hurt; ...)' ({lines})")


def _raises_value(fn: Callable[[], object], *words: str) -> bool:
    try:
        fn()
    except ValueError as e:
        return all(w in str(e) for w in words)
    return False


# FW-A constants, measured from the atlas at 95b31e2 (inclusive extents; dragon is `attack: ranged`, so its homeX
# includes the attack frames: home only it is [18, 110]). Re-measured at F5 (roster-int, after the F3/F4 rig fixes):
# only ogre's lungeRight moved, 125 -> 110, because 125 was its old atk_recover (the club thrown out past the attack
# key; F3b pulled the recover back toward idle, recover->idle 3.6 px), so its lunge frames now reach 110.
# Re-measured at fix pass 2 G6: warmech travelTop 5 -> 2, because the sheet is rigged since T-K (its in-betweens are
# translations of the keys, and the attack's d (-23, -4/-5) lifts the travel frames 3 px above the keyframe-only top).
ANCHORS = {"garland": {"travelTop": 2}, "lich": {"travelTop": 9}, "death_eye": {"travelTop": 42, "lungeRight": 179},
           "chaos": {"travelTop": 12}, "warmech": {"travelTop": 2}, "ogre": {"homeX": [10, 113], "lungeRight": 110},
           "troll": {"homeX": [24, 122]}, "dragon": {"homeX": [4, 118]},
           "earth_elemental": {"lungeRight": 109, "opaqueRight": 110}}


def run_anchors(check: Callable[[bool, str], None]) -> None:
    """FW-A: inclusive extents over the plan's frame lists (names resolve through MA.resolve), the ranged attack frames
    in homeX, the explicit constants in the committed index, and the index agreeing with its own page pixels."""
    import numpy as np
    from PIL import Image
    from gen import monster_anim as MA
    from gen import monster_atlas as MAT
    blank = lambda: np.zeros((20, 30, 4), np.uint8)
    fr = {n: blank() for n in ("idle", "attack", "hurt", "atk_wind1", "hurt_in1")}
    fr["idle"][10, 5:21] = 255                                     # idle: columns 5-20, row 10
    fr["hurt_in1"][3, 7] = 255                                     # the highest row: 3 (a travel frame)
    fr["atk_wind1"][12, 2:28] = 255                                # a wind-up reaching 2-27
    fr["attack"][15, 4:29] = 255                                   # the lunge's right edge: 28
    fr["hurt"][11, 6:9] = 255
    ims = {n: Image.fromarray(a) for n, a in fr.items()}
    names = MA.frames_for(False)                                   # every other name resolves to a key or wind1
    a = MAT.travel_anchors(ims, names)
    check(a == {"travelTop": 3, "lungeRight": 28, "homeX": [5, 20]}, f"FW-A: inclusive extents over the frame lists {a}")
    fr["idle"][14, 9] = 255                                        # idle: columns 5-20, rows 10-14
    box = MAT.anchors(Image.fromarray(fr["idle"]))["idleBox"]
    check(box == [5, 10, 20, 14], f"FW-A2: idleBox is the idle frame's opaque box [l, t, r, b], inclusive {box}")
    r = MAT.travel_anchors(ims, names, ranged=True)
    check(r["homeX"] == [2, 28] and r["travelTop"] == 3, f"FW-A: a ranged sheet's homeX includes its attack frames {r}")
    check(MAT.ranged_sheets() == {"dragon"}, f"FW-A: the ranged sheets are the dragon's ({sorted(MAT.ranged_sheets())})")
    check(MAT.LUNGE_FRAMES == MAT.TRAVEL_FRAMES[:11] and len(MAT.TRAVEL_FRAMES) == 15 and MAT.HOME_FRAMES ==
          ("idle", "idle_b", "hurt_in1", "hurt_in2", "hurt", "daze", "daze_b"), "FW-A: the plan's frame lists")

    meta = json.loads(ATLAS_JSON.read_text())
    sheets = meta["sheets"]
    missing = [s for s, v in sheets.items() if not all(k in v for k in ("travelTop", "lungeRight", "homeX"))]
    check(not missing, f"FW-A: every sheet has travelTop, lungeRight and homeX {missing[:5]}")
    # docs/REDESIGN_PLAN.md 9.5: a sprite with a v1 archive (chaos) is measured from the archived keys and rig, which
    # are the pixels these constants were measured on; the committed index then holds the redesigned sheet
    from gen import retire as RT
    archived = {s for s in ANCHORS if RT.fixture_source(RT.Tree(), s)[3]}
    have = {s: sheets.get(s, {}) for s in ANCHORS if s not in archived}
    for s in sorted(archived):
        with RT.fixture_tree((s,)):
            _, m, k = next(e for e in MA.load_entries() if e[0] == s)
            with contextlib.redirect_stdout(io.StringIO()):
                frames = MAT.sprite_frames(s, m, k)[0]
        names = MA.frames_for("cast" in frames, "attack_raise" in frames)
        have[s] = {**MAT.anchors(frames["idle"]), **MAT.travel_anchors(frames, names, s in MAT.ranged_sheets())}
    bad = {s: {k: (have[s].get(k), v) for k, v in want.items() if have[s].get(k) != v} for s, want in ANCHORS.items()}
    bad = {s: d for s, d in bad.items() if d}
    check(not bad, f"FW-A: the anchors match the constants measured at 95b31e2 / F5 {bad} (from the archive: "
                   f"{sorted(archived) or 'none'})")
    el = sheets.get("earth_elemental", {})
    check(el.get("lungeRight", 999) < el.get("opaqueRight", 0), "FW-A: earth_elemental lunges inside its idle edge (109 < 110)")
    pages = [Image.open(ATLAS_JSON.parent / p["file"]).convert("RGBA") for p in meta["pages"]]
    ranged, off, boxes = MAT.ranged_sheets(), [], []
    for sid, v in sorted(sheets.items()):
        if "travelTop" not in v:
            continue
        w, h = v["cell"]
        crops = {n: pages[v["page"]].crop((x, y, x + w, y + h)) for n, (x, y) in v["frames"].items()}
        got = MAT.travel_anchors(crops, list(v["frames"]), sid in ranged)
        if any(got[k] != v[k] for k in got):
            off.append(sid)
        if v.get("idleBox") != MAT.anchors(crops["idle"])["idleBox"]:
            boxes.append(sid)
    check(not off, f"FW-A: every sheet's anchors agree with its own frames on the committed pages {off[:5]}")
    check(not boxes, f"FW-A2: every sheet's idleBox is its idle frame's opaque box on the committed pages "
                     f"({len(boxes)} off: {boxes[:5]})")


CHAOS_TIP = [116, 12]        # the chaos attack_raise tip at 9fe129c (docs/REDESIGN_PLAN.md 9.5: the chaos_v1 archive)


def run_raise_off(check: Callable[[bool, str], None]) -> None:
    """FW-R (D-F1): a rig with `raise: false` drops the approved attack_raise in load_entries (the padded cell is
    kept), so the sheet has hasRaise false, none of the 5 raise frames, and a tip on an opaque atk_wind2 pixel; every
    other sheet's keys are unchanged; a raise value other than true / false is an error naming the rig."""
    import copy
    import numpy as np
    from gen import monster_anim as MA
    from gen import monster_atlas as MAT
    from gen import monster_keys as MK
    from gen import retire as RT
    with RT.fixture_tree(("hollow_seraph", "chaos"), full=True) as archived:   # 9.5: the v1 archives when present
        real = MA.load_rig
        cfg = copy.deepcopy(real("hollow_seraph"))
        cfg["raise"] = False
        before = {e[0]: e for e in MA.load_entries()}
        MA.load_rig = lambda s: cfg if s == "hollow_seraph" else real(s)
        try:
            after = {e[0]: e for e in MA.load_entries()}
            _, meta, kfs = after["hollow_seraph"]
            check("attack_raise" not in kfs and meta.get("raise_off") is True and kfs["idle"].size == (218, 200)
                  and "attack_raise" not in meta["poses"],
                  f"FW-R: no attack_raise key, the 218x200 cell kept ({sorted(kfs)}; archive: {archived})")
            same = all(sid == "hollow_seraph" or (set(e[2]) == set(before[sid][2]) and all(
                np.array_equal(np.asarray(e[2][k]), np.asarray(before[sid][2][k])) for k in e[2]))
                for sid, e in after.items())
            check(same and set(after) == set(before), "FW-R: every other sheet's keys are unchanged")
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                frames, holds, anim = MAT.sprite_frames("hollow_seraph", meta, kfs)
        finally:
            MA.load_rig = real
    names = MA.frames_for("cast" in frames, "attack_raise" in frames)
    raise_names = [n for n in MA.RAISE_FRAMES if n in frames or n in names]
    sheet = MAT.sheet_meta(meta, frames, names, {}, holds, anim, MA.lunge_px(frames["idle"]), 0, False)
    w2 = np.asarray(frames[MA.resolve("atk_wind2", frames)].convert("RGBA"))
    tx, ty = sheet.get("tip", (-1, -1))
    check(sheet["hasRaise"] is False and not raise_names, f"FW-R: hasRaise false and no raise frames {raise_names}")
    check(0 <= ty < w2.shape[0] and 0 <= tx < w2.shape[1] and w2[ty, tx, 3] > 0 and not (w2[:ty, :, 3] > 0).any(),
          f"FW-R: the tip {sheet.get('tip')} is on atk_wind2's topmost opaque row")
    _, cmeta, ckfs = before["chaos"]
    committed = json.loads(ATLAS_JSON.read_text())["sheets"]["chaos"]
    tip = MAT.tip(ckfs["attack_raise"])["tip"]
    check(tip == CHAOS_TIP and (archived["chaos"] or committed.get("tip") == tip) and not cmeta.get("raise_off"),
          f"FW-R: a sheet with a raise keeps its attack_raise tip (chaos {tip} == {CHAOS_TIP}"
          f"{', from the chaos_v1 archive' if archived['chaos'] else ', as committed'})")
    try:
        MK.raise_off("x", {"raise": "no"})
        refused = False
    except ValueError as e:
        refused = "rig x" in str(e)
    check(refused, "FW-R: raise must be true or false (an error naming the rig)")


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
    from gen import retire as RT
    raw = {}
    with RT.fixture_tree(("hollow_seraph", "warmech")):        # 9.5: the seraph's v1 archive when present
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
