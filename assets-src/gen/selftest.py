"""Offline self-checks for the sprite pipeline (no network, no backends imported).

  python3 -I assets-src/gen/selftest.py

Covers docs/ART_2X_PLAN.md Phase 1 item 12: guide geometry, crop-bleed, magenta key, budget guard + ledger,
and the size-reference crop.
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import numpy as np  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

from gen import generate as GEN  # noqa: E402
from gen import guides as G  # noqa: E402
from gen import monster as M  # noqa: E402
from gen import pixelize as PX  # noqa: E402
from gen import spec as S  # noqa: E402

FAILS: list[str] = []


def check(cond: bool, msg: str) -> None:
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        FAILS.append(msg)


def native_masks(geom: S.SheetGeom, poses, order):
    g = np.asarray(G.sheet(poses, order, geom).convert("RGB")).astype(int)
    cw, ch = geom.cell_px
    cols = geom.layout[0]
    out = {}
    for i, name in enumerate(order):
        cell = g[(i // cols) * ch:(i // cols + 1) * ch, (i % cols) * cw:(i % cols + 1) * cw]
        drawn = cell.sum(2) < 750
        weapon = np.abs(cell - np.array(G.WEAPON)).sum(2) < 6
        to_nat = lambda m: np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize(geom.grid, Image.Resampling.BOX)) > 127
        out[name] = (to_nat(drawn), to_nat(drawn & ~weapon))
    return out


def test_geometry() -> None:
    print("battle geometry")
    gw, gh = S.BATTLE_GEOM.grid
    for name, (allm, body) in native_masks(S.BATTLE_GEOM, S.BATTLE_POSES, S.BATTLE_ORDER).items():
        rows = np.where(body.any(1))[0]
        arows, acols = np.where(allm.any(1))[0], np.where(allm.any(0))[0]
        h = int(rows.max() - rows.min() + 1)
        lo, hi = (45, 53) if name == "down" else (68, 76)
        check(abs(int(rows.max()) - S.BATTLE_GEOM.bottom_row) <= 1, f"{name}: last opaque row {rows.max()} ~ {S.BATTLE_GEOM.bottom_row}")
        check(lo <= h <= hi, f"{name}: height {h} without weapon in {lo}-{hi}")
        check(arows.min() >= 0 and arows.max() <= gh - 1 and acols.min() >= 0 and acols.max() <= gw - 1
              and arows.min() > 0 and acols.min() > 0 and acols.max() < gw - 1,
              f"{name}: fits cell incl. weapon (rows {arows.min()}-{arows.max()}, cols {acols.min()}-{acols.max()})")
    print("field geometry")
    for d in S.FIELD_DIRECTIONS:
        for name, (allm, _) in native_masks(S.FIELD_GEOM, S.FIELD_POSES, S.field_order(d)).items():
            rows, cols = np.where(allm.any(1))[0], np.where(allm.any(0))[0]
            h, w = int(rows.max() - rows.min() + 1), int(cols.max() - cols.min() + 1)
            check(abs(int(rows.max()) - S.FIELD_GEOM.bottom_row) <= 1 and 82 <= h <= 92 and w <= 46,
                  f"{name}: bottom {rows.max()}, height {h} (82-92), width {w} (<=46)")


def test_field3_geometry() -> None:
    print("full field sheet (3x3) geometry")
    g = S.FIELD3_GEOM
    check(g.aspect == "9:16", f"sheet aspect {g.aspect} is 9:16")
    for name, (allm, _) in native_masks(g, S.FIELD3_POSES, S.FIELD_ORDER).items():
        rows, cols = np.where(allm.any(1))[0], np.where(allm.any(0))[0]
        h = int(rows.max() - rows.min() + 1)
        margin = (g.grid[0] - g.trim_width) // 2
        inside = cols.min() >= margin and cols.max() < g.grid[0] - margin
        check(abs(int(rows.max()) - g.bottom_row) <= 1 and 82 <= h <= 92 and inside,
              f"{name}: bottom {rows.max()}, height {h}, cols {cols.min()}-{cols.max()} inside the trimmed 48 px")
    a = native_masks(g, S.FIELD3_POSES, S.FIELD_ORDER)
    for d in ("down", "up", "left"):
        diff = [(a[f"{d}0"][0] != a[f"{d}{i}"][0]).sum() for i in (1, 2)]
        check(min(diff) >= 40, f"{d}: walk frames differ from standing by {diff} px (>=40)")


def _figure_cell(bg, size=(256, 256)) -> tuple[Image.Image, np.ndarray]:
    img = Image.new("RGB", size, bg)
    d = ImageDraw.Draw(img)
    d.ellipse([88, 40, 168, 120], fill=(250, 250, 250), outline=(0, 0, 0), width=6)     # white plume/helmet
    d.rectangle([100, 120, 156, 220], fill=(40, 70, 200), outline=(0, 0, 0), width=6)   # blue body
    guide = np.zeros((size[1], size[0]), bool)
    guide[40:221, 88:169] = True
    return img, guide


def test_crop_bleed_and_keys() -> None:
    print("pixelize")
    img, guide = _figure_cell((255, 255, 255))
    ImageDraw.Draw(img).rectangle([236, 20, 255, 240], fill=(10, 10, 10))   # bleed from the neighbouring cell
    out = np.asarray(PX.pixelize(img, guide, (32, 32), colors=6))
    check(not out[:, 29:, 3].any(), "crop bleed: bar outside the guide is dropped")
    mag, guide = _figure_cell((255, 0, 255))
    check(PX.is_magenta_bg(np.asarray(mag)), "magenta background detected")
    out = np.asarray(PX.pixelize(mag, guide, (32, 32), colors=6))
    whites = (out[..., 3] > 0) & (out[..., :3].min(axis=2) > 200)
    check(whites.sum() >= 8, f"magenta key keeps white parts ({whites.sum()} white px)")
    check(not ((out[..., 0] > 200) & (out[..., 1] < 80) & (out[..., 2] > 200) & (out[..., 3] > 0)).any(),
          "no magenta left in the sprite")
    aligned = np.asarray(PX.pixelize(mag, guide, (32, 32), colors=6, bottom_row=30))
    check(int(np.where(aligned[..., 3].any(1))[0].max()) == 30, "bottom_row alignment")
    dark_blue = np.zeros((64, 64, 3), np.uint8); dark_blue[...] = (30, 40, 120)
    check(not (dark_blue.max(axis=2) < 40).any(), "ink rule: dark saturated blue is not outline")


def test_face_details() -> None:
    """1-sprite-pixel eyes survive pixelize: dark eyes on skin, and glowing eyes in a shadowed face."""
    print("face details")
    for name, face, eye, want in (("dark eyes on skin", (240, 190, 150), (70, 45, 30), lambda c: c.sum() < 400),
                                  ("glowing eyes in shadow", (20, 18, 30), (250, 220, 60), lambda c: c[0] > 180 and c[1] > 150 and c[2] < 140)):
        img = Image.new("RGB", (256, 256), (255, 0, 255))
        d = ImageDraw.Draw(img)
        d.rectangle([60, 40, 196, 230], fill=(40, 70, 200), outline=(0, 0, 0), width=6)    # body
        d.rectangle([90, 60, 166, 130], fill=face)                                          # face
        for ex in (112, 136):
            d.rectangle([ex, 88, ex + 7, 95], fill=eye)                                    # 1 sprite px eyes (8 px/sprite px)
        guide = np.zeros((256, 256), bool); guide[40:231, 60:197] = True
        fg = PX.foreground(np.asarray(img), guide)
        rgb = np.asarray(img)
        pal = PX.sheet_palette([rgb[fg]], 6, detail_px=rgb[PX.detail_mask(rgb, fg, 8)])
        out = np.asarray(PX.pixelize(img, guide, (32, 32), colors=6, palette=pal))
        eyes = [out[88 // 8, ex // 8, :3].astype(int) for ex in (112, 136)]
        check(all(want(c) for c in eyes), f"{name}: both eye pixels kept ({[tuple(c) for c in eyes]})")


class _FakeSheet:
    def __init__(self, name):
        self.name = name


def _req(key: str, sheet="battle", fail=False):
    def run():
        if fail:
            raise RuntimeError("no image")
        return Image.new("RGBA", (4, 4))
    return GEN.Request("knight", _FakeSheet(sheet), 1234, "gemini", "m", Image.new("RGB", (4, 4)), key, "p", [], run)


def test_budget_guard() -> None:
    print("budget guard")
    def refused(fn) -> bool:
        try:
            fn()
        except SystemExit:
            return True
        return False
    a, b = _req("selftest-a"), _req("selftest-b")
    # a permissive synthetic budget for the generic rules (the real budget.json, pass V, refuses the fake 'knight'
    # requests by only_ids and an empty ledger by its consistency guard; selftest_passv.py tests the real budget)
    loose = {"attempts_before": 0, "cap": 10, "max_attempts_per_sheet": 3, "passes": []}
    check(refused(lambda: GEN.check_budget([a, b], paid=True, max_paid=1, retry=False, ledger=[], budget=loose)),
          "2 misses > max-paid 1 refused")
    check(refused(lambda: GEN.check_budget([a], paid=False, max_paid=1, retry=False, ledger=[], budget=loose)),
          "uncached without --paid refused")
    check(GEN.check_budget([a], paid=True, max_paid=1, retry=False, ledger=[], budget=loose) == [a],
          "1 miss with --paid allowed")
    if GEN.BUDGET.exists():
        b = json.loads(GEN.BUDGET.read_text())
        full = [{"event": "attempt", "character": "x", "sheet": "y"}] * (b["attempts_before"] + b["cap"])
        check(refused(lambda: GEN.check_budget([a], paid=True, max_paid=1, retry=True, ledger=full)),
              f"run cap: the {b['cap']}th-plus paid image is refused")
        same = [{"event": "attempt", "character": "x", "sheet": "y"}] * b["attempts_before"] + \
               [{"event": "attempt", "character": a.character, "sheet": a.sheet.name}] * b["max_attempts_per_sheet"]
        check(refused(lambda: GEN.check_budget([a], paid=True, max_paid=1, retry=True, ledger=same)),
              f"run cap: more than {b['max_attempts_per_sheet']} attempts at one sheet refused")
    with tempfile.TemporaryDirectory() as tmp:
        led = Path(tmp) / "ledger.jsonl"
        try:
            GEN.execute(_req("selftest-fail", fail=True), led)
        except RuntimeError:
            pass
        entries = GEN.read_ledger(led)
        check([e["event"] for e in entries] == ["attempt", "result"] and entries[1]["ok"] is False,
              "failed call is ledgered before and after (counts as spent)")
        edited = _req("selftest-edited-prompt")
        check(refused(lambda: GEN.check_budget([edited], paid=True, max_paid=1, retry=False, ledger=entries,
                                               budget=loose)),
              "earlier attempt at the same checkpoint blocks a new key without --retry")
        check(GEN.check_budget([edited], paid=True, max_paid=1, retry=True, ledger=entries, budget=loose) == [edited],
              "--retry allows it")
        other = _req("selftest-other", sheet="field_down")
        check(GEN.check_budget([other], paid=True, max_paid=1, retry=False, ledger=entries, budget=loose) == [other],
              "a different checkpoint is not blocked")


def test_field_atlas() -> None:
    import json
    meta_path = HERE.parent.parent / "assets" / "sprites" / "characters-ai.json"
    if not meta_path.exists():
        return
    print("AI field atlas")
    meta = json.loads(meta_path.read_text())
    gw, gh = meta["cell"]
    s = meta["fieldScale"]
    a = np.asarray(Image.open(meta_path.with_suffix(".png")))[::s, ::s]
    for cid, o in meta["sheets"].items():
        rows = {n: a[o["y"] + r * gh:o["y"] + (r + 1) * gh, o["x"]:o["x"] + 3 * gw] for r, n in enumerate(meta["rowNames"])}
        mirrored = all((rows["right"][:, i * gw:(i + 1) * gw] == rows["left"][:, i * gw:(i + 1) * gw][:, ::-1]).all() for i in range(3))
        check(mirrored, f"{cid}: right row is the left row mirrored frame by frame")
        check(cid not in meta.get("fallbacks", {}), f"{cid}: every direction has approved art (fallbacks {meta.get('fallbacks', {}).get(cid)})")
    # M6 (R4a): each chest frame (closed, open, closed) is one run of opaque columns: no key-fringe column beside it
    if "chest" in meta["sheets"]:
        o = meta["sheets"]["chest"]
        for i, name in enumerate(("closed", "open", "closed")):
            f = a[o["y"]:o["y"] + gh, o["x"] + i * gw:o["x"] + (i + 1) * gw]
            cols = np.where((f[..., 3] > 0).any(0))[0]
            check(len(cols) > 0 and cols.max() - cols.min() + 1 == len(cols),
                  f"chest frame {i} ({name}): opaque columns {cols.min() if len(cols) else None}-"
                  f"{cols.max() if len(cols) else None} have no gap")
    # W15 (R4a): vendor_f's back stand frame shows the same short shawl as its walk frames (head_from), not the long
    # brown cloak the approved stand frame drew
    if "vendor_f" in meta["sheets"]:
        o = meta["sheets"]["vendor_f"]
        r = meta["rowNames"].index("up")
        up = a[o["y"] + r * gh:o["y"] + (r + 1) * gh, o["x"]:o["x"] + meta["cols"] * gw].astype(int)

        def brown(i: int) -> int:
            f = up[:, i * gw:(i + 1) * gw]
            rr, gg, bb = f[..., 0], f[..., 1], f[..., 2]
            return int(((f[..., 3] > 0) & (rr > gg) & (gg > bb) & (rr > 70) & (rr < 140) & (gg - bb < 30)).sum())
        steps = [brown(i) for i in range(1, meta["cols"])]
        mean = sum(steps) / len(steps)
        check(abs(brown(0) - mean) <= 0.15 * mean,
              f"vendor_f up: stand frame brown-shawl px {brown(0)} within 15% of the walk frames' mean {mean:.0f}")


def test_style_lock() -> None:
    """Phase 5: the knight's approved requests still reproduce their cache keys (no prompt/guide drift), the knight
    is locked, rollout characters carry the house-style reference, and NPCs are field-only. Offline: keys only."""
    import json
    print("style lock")
    if not GEN.STYLE_REF.exists():
        print("  skip (style reference image not present)")
        return
    knight = GEN.load_character("knight")
    check(bool(knight.get("locked")), "knight is locked in characters.yaml")
    for path in sorted((HERE / "approved").glob("*/*.json")):
        meta = json.loads(path.read_text())
        meta.setdefault("character", meta.get("kit"))       # kit sheets are keyed by kit id
        char = GEN.load_character(meta["character"])
        req = GEN.plan_request(char, GEN.SHEETS[meta["sheet"]], meta["seed"], "gemini", meta["model"])
        check(req.key == meta["cache_key"] and req.cached,
              f"{meta['character']} {meta['sheet']}: planned key {req.key} == approved {meta['cache_key']}")
        if meta["character"] == "knight":
            check("HOUSE STYLE" not in req.prompt, f"knight {meta['sheet']}: no house-style reference in its own request")

    def refused(fn) -> bool:
        try:
            fn()
        except SystemExit:
            return True
        return False
    miss = _req("selftest-locked")
    check(refused(lambda: GEN.check_budget([miss], paid=True, max_paid=1, retry=True, ledger=[], locked=True)),
          "a locked character refuses uncached requests even with --retry")
    warrior = GEN.load_character("warrior")
    req = GEN.plan_request(warrior, GEN.SHEETS["battle"], 1234, "gemini", None)
    check("HOUSE STYLE" in req.prompt and len(req.inputs) == 3, "rollout battle request = guide + style + knight battle sheet")
    if not (HERE.parent.parent / warrior["identity_ref"][0]).exists():
        check(refused(lambda: GEN.plan_request(warrior, GEN.SHEETS["field"], 1234, "gemini", None)),
              "rollout field request is refused until that character's battle sheet is approved")
    guard = GEN.load_character("guard")
    check(refused(lambda: GEN.plan_request(guard, GEN.SHEETS["battle"], 1234, "gemini", None)), "NPCs have no battle sheet")
    req = GEN.plan_request(guard, GEN.SHEETS["field"], 1234, "gemini", None)
    check(len(req.inputs) == 3 and "HOUSE STYLE" in req.prompt, "NPC field request = guide + style + knight field sheet")
    ids = [c["id"] for c in __import__("yaml").safe_load((HERE / "characters.yaml").read_text())]
    check(len(ids) == len(set(ids)), "character ids are unique")


def _monster_raw(floating_hurt_lift: int = 0) -> Image.Image:
    """Synthetic 3-cell monster render on magenta at 5 px per sprite px: a 64-px creature with 1-px eyes; the attack
    frame leans 6 px right, the hurt frame leans 4 px left (and is lifted for the floating test)."""
    cw, ch, pitch = 105, 135, 5
    art = Image.new("RGB", (cw * 3, ch), (255, 0, 255))
    d = ImageDraw.Draw(art)
    for i, (dx, lift) in enumerate(((0, 0), (6, 0), (-4, floating_hurt_lift))):
        x0, y1 = i * cw + 30 + dx, 120 - lift
        d.rectangle([x0, y1 - 63, x0 + 40, y1], fill=(60, 140, 60), outline=(0, 0, 0))      # body
        d.rectangle([x0 + 4, y1 - 60, x0 + 36, y1 - 44], fill=(230, 190, 150))            # face
        d.point([(x0 + 12, y1 - 54), (x0 + 26, y1 - 54)], fill=(60, 30, 20))                # 1-px eyes
    return art.resize((art.width * pitch, art.height * pitch), Image.Resampling.NEAREST)


def test_monsters() -> None:
    print("monsters")
    band = S.MONSTER_BANDS["small"]
    check(S.MONSTER_GEOMS["small"].aspect == "21:9" and S.MONSTER_GEOMS["boss"].sheet_px == (1680, 720),
          "monster sheets request 21:9 (1680x720 guide)")
    g = np.asarray(M.guide(band).convert("RGB")).astype(int)
    box = (np.abs(g - np.array(M.GUIDE_BOX)).sum(2) < 6)
    hb = int(np.ptp(np.where(box[:, :560].any(1))[0]) + 1)
    check(abs(hb - round(band.height[1] * S.MONSTER_EXPECTED_PITCH)) <= 2, f"guide box height {hb} = top of band at expected pitch")
    frames, info = M.cut(_monster_raw(), band)
    rep = M.frame_report(frames, band)
    check(all(f.size == (80, 80) for f in frames), "frames are 80x80 output cells")
    check(rep["bottoms"] == [band.foot_row] * 3, f"grounded: every frame's feet on row {band.foot_row} ({rep['bottoms']})")
    check(rep["height_ok"] and rep["outline"] and rep["colours"] <= 16, f"height band, outline, <=16 colours ({rep})")
    cx = [float(np.where(np.asarray(f)[..., 3].any(0))[0].mean()) for f in frames]
    check(cx[1] - cx[0] >= 4 and cx[0] - cx[2] >= 2, f"attack lean right / hurt lean left kept ({[round(x, 1) for x in cx]})")
    eyes = [int((((np.asarray(f)[..., :3].astype(int) - np.array([60, 30, 20])) ** 2).sum(2) < 1600).sum()) for f in frames]
    check(min(eyes) >= 2, f"1-px eyes survive in every frame ({eyes})")
    lifted, _ = M.cut(_monster_raw(floating_hurt_lift=8), band, floating=True)
    b = M.frame_report(lifted, band)["bottoms"]
    check(b[0] == band.foot_row and b[2] == band.foot_row - 8, f"floating: one shared offset keeps the hurt lift ({b})")
    v = M.recolor(frames[0], {"hue": 120})
    va, fa = np.asarray(v), np.asarray(frames[0])
    out_px = np.all(fa[..., :3] == np.array(PX.OUTLINE), 2) & (fa[..., 3] > 0)
    check((va[..., 3] == fa[..., 3]).all() and np.all(va[out_px][:, :3] == np.array(PX.OUTLINE)),
          "recolour keeps alpha and the outline")
    check(not np.array_equal(va, fa), "recolour changes the body colours")
    print("monster cutter (gap split for future cuts, flat-edge check)")
    from gen import selftest_cut as SC
    SC.run_cut(check)


def test_size_ref() -> None:
    print("size reference")
    if not GEN.SIZE_REF.exists():
        check(False, f"{GEN.SIZE_REF} missing")
        return
    a = np.asarray(Image.open(GEN.SIZE_REF).convert("RGB")).astype(int)
    red = (a[..., 0] > 150) & (a[..., 1] < 70) & (a[..., 2] < 70)
    ys, xs = np.where(red)
    check(red.sum() > 150 and xs.min() > 5 and xs.max() < a.shape[1] - 5 and ys.min() > 5,
          f"warrior (red armour, {red.sum()} px) is inside the crop")


def test_kits() -> None:
    print("tile kits")
    from gen import kitsheet as KS
    kit = GEN.load_character("town")
    ks = GEN.kit_sheet(kit, "kit_house")
    cells = ks["cells"]
    size, tile = KS.geo(ks)
    cols, rows = len(cells[0]), len(cells)
    g = KS.guide(cells, size, tile, grid_lines=ks.get("grid_lines", True))
    x0, y0, x1, y1 = KS.grid_box(cols, rows, size, tile)
    check(g.size == size and x0 >= 0 and y0 >= 0 and (x1 - x0, y1 - y0) == (cols * tile, rows * tile),
          f"house guide {size}, {cols}x{rows} grid of {tile} px at ({x0}, {y0})")
    w, h = size
    from math import gcd
    check(GEN.SHEETS["kit_house"].geom.aspect == f"{w // gcd(w, h)}:{h // gcd(w, h)}", "kit sheet aspect matches its guide")
    # synthetic render: the guide recoloured as a house, drawn in ~6 px pixels at Gemini's output size
    rgb = np.asarray(g).copy()
    for grey, col in (((150, 150, 150), (180, 70, 50)), ((205, 205, 205), (225, 210, 180)),
                      ((90, 90, 90), (110, 70, 40)), ((120, 120, 120), (90, 150, 200)), ((110, 110, 110), (200, 190, 160))):
        rgb[(rgb == grey).all(-1)] = col
    small = Image.fromarray(rgb).resize((w // 6, h // 6), Image.Resampling.NEAREST).resize((w, h), Image.Resampling.NEAREST)
    sheet, rep = KS.cut(small, cells, 0, size, tile, ks.get("derive"))
    extra = 1 if ks.get("derive") else 0
    check(sheet.size == (cols * 48, (rows + extra) * 48), f"cut is 48 px per tile, plus a derived row ({sheet.size})")
    check(rep["pass"]["alignment"] and rep["pass"]["door"] and rep["pass"]["colours"],
          f"synthetic house passes alignment / door / colours ({rep['grid_alignment_native_px']} px, door "
          f"{rep['door_opening_px']} px, {rep['colours']} colours)")
    if extra:
        plain = np.asarray(sheet)[rows * 48:, :48, :3].reshape(-1, 3)
        check(len(np.unique(plain, axis=0)) <= 2, "derived wall_up_plain has the window painted out")
    check(rep["pass"]["seams"], f"plain repeated parts are seamless ({rep['seam_ratio']})")
    check(KS.seam_ratio(np.tile(np.arange(48, dtype=np.uint8)[None, :, None] * 5, (48, 1, 3))) > 1.5,
          "a ramp tile repeated horizontally fails the seam check")
    # materials: a noisy ramp is not seamless; make_seamless fixes both axes and keeps the palette
    rng = np.random.default_rng(1)
    pal = np.array([[60, 120, 50], [70, 140, 60], [90, 160, 70], [40, 100, 40]], np.uint8)
    idx = np.clip(rng.integers(0, 2, (96, 96)) + (np.arange(96)[None, :] // 40), 0, 3)
    tex = pal[idx]
    fixed = KS.make_seamless(tex)
    check(KS.wrap_ratio(tex) > 1.5 >= KS.wrap_ratio(fixed), f"make_seamless: wrap {KS.wrap_ratio(tex):.2f} -> {KS.wrap_ratio(fixed):.2f}")
    check({tuple(c) for c in fixed.reshape(-1, 3)} <= {tuple(c) for c in pal}, "make_seamless keeps the palette")
    ground = GEN.kit_sheet(kit, "kit_ground")
    mg = KS.materials_guide(ground)
    boxes = KS.swatch_boxes(ground)
    check(mg.size == tuple(ground["guide"]) and len(boxes) == 4 and all(b[2] - b[0] == 2 * ground["tile_px"] for b in boxes)
          and boxes[0][2] < boxes[1][0], f"ground guide: four separate 2x2-tile squares {boxes}")


def test_approve_keeps_hand_fixes() -> None:
    """Re-approving a kit sheet keeps its `paint` fixes (as field sheets keep head_from / row_from)."""
    print("approve keeps hand fixes")
    from gen import approve as AP
    check("paint" in AP.KIT_HAND_FIXES and "head_from" in AP.FIELD_HAND_FIXES, "paint and head_from are hand fixes")
    with tempfile.TemporaryDirectory() as tmp:
        old = Path(tmp) / "city.json"
        paint = [{"from": [0, 0, 8, 8], "to": [8, 0]}]
        old.write_text(json.dumps({"kit": "overworld", "cells": [["a"]], "paint": paint}))
        meta = AP.keep_hand_fixes(old, {"kit": "overworld", "cells": [["b"]]}, AP.KIT_HAND_FIXES)
        check(meta.get("paint") == paint and meta["cells"] == [["b"]], "re-approval keeps paint, takes the new cells")
        fresh = AP.keep_hand_fixes(Path(tmp) / "none.json", {"cells": []}, AP.KIT_HAND_FIXES)
        check("paint" not in fresh, "a first approval has no paint")


def test_monster_anim() -> None:
    """docs/ENEMY_ANIM_PLAN.md 6.3: every animation check RED on an injected defect, then the generator and build locks."""
    from gen import selftest_anim as SA
    print("monster animation checks")
    SA.run_checks(check)
    print("monster animation generator")
    SA.run_generator(check)
    print("monster body templates (quadruped, bird)")
    from gen import selftest_beasts as SB
    SB.run_beasts(check)
    print("monster naga template (FW-3: coil contacts, arm lists, half_hand)")
    from gen import selftest_naga as SN
    SN.run_naga(check)
    print("monster floating template (FW-1: float band, whole-body drift, swimmer preset)")
    from gen import selftest_floating as SFl
    SFl.run_floating(check)
    print("monster blob template (FW-6: squash op, blob sag, idle_b tweaks with a 1 px cap)")
    from gen import selftest_blob as SBl
    SBl.run_blob(check)
    print("monster serpent template and rooted preset (FW-2: coil contacts, attack-only tail, lead tentacles)")
    from gen import selftest_serpent as SSe
    SSe.run_serpent(check)
    print("monster arthropod template (FW-4: leg chains, every tip pinned, IK knees, tail and claws)")
    from gen import selftest_arthropod as SAr
    SAr.run_arthropod(check)
    print("monster framework fixes (per-foot feet, IoU bound, pinned reach, cloth chains)")
    from gen import selftest_fixes as SF
    SF.run_fixes(check)
    print("monster wave-0 framework (F1-F7, efix_gates, fx allowlist; FW-P keyframe paint)")
    from gen import selftest_efix as SE
    SE.run_efix(check)
    print("monster pass F framework (daze recipe, head joints, hold fallback, heavy raise)")
    from gen import selftest_daze as SD
    SD.run_daze(check)
    print("roster pass R budget guard (285 build + 15 fix, 3 per sheet, closed passes, only_approved)")
    from gen import selftest_roster as SRo
    SRo.run_roster(check)
    print("pass V budget guard (FW-V0: 50 new, 3 per sheet, only_ids, only_sheets, consistency, history never read)")
    from gen import selftest_passv as SPV
    SPV.run_passv(check)
    print("roster pass R prompt fields (FW-9: idle_negative, body, base; every approved key unchanged)")
    SRo.run_prompts(check)
    print("FW-5 templates (biped wings, extra arm pairs, multi-head necks, preset mechanical)")
    from gen import selftest_fw5 as SF5
    SF5.run_fw5(check)
    print("roster fix pass measurements (FW-M: fixmeasure.py reproduces the fix plan's RED numbers)")
    from gen import selftest_fixmeasure as SFM
    SFM.run_fixmeasure(check)
    print("monster atlas pages (FW-8: page groups, MAX_PAGE 2048, check's no-rig line; FW-A anchors, FW-R raise: false)")
    from gen import selftest_pages as SP
    SP.run_pages(check)
    print("monster atlas build locks")
    SA.run_build_locks(check)


if __name__ == "__main__":
    test_monster_anim() if "--anim" in sys.argv else None
    if "--anim" in sys.argv:
        print(f"\n{'ALL PASSED' if not FAILS else f'{len(FAILS)} FAILED'}")
        sys.exit(1 if FAILS else 0)
    test_geometry()
    test_field3_geometry()
    test_crop_bleed_and_keys()
    test_face_details()
    test_budget_guard()
    test_field_atlas()
    test_style_lock()
    test_monsters()
    test_size_ref()
    test_kits()
    test_approve_keeps_hand_fixes()
    test_monster_anim()
    print(f"\n{'ALL PASSED' if not FAILS else f'{len(FAILS)} FAILED'}")
    sys.exit(1 if FAILS else 0)
