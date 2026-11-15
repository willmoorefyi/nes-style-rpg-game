"""FW-6 (docs/ROSTER_PLAN.md 5.2 blob row, 5.4) self-tests, run from selftest.py (test_monster_anim): the `squash` frame
op (anim_squash.py), the `blob` body template (rig_blob.py) on a synthetic right-facing slime (110x80, feet row 76) and
the per-rig `idle_b` tweaks with their 1 px cap. The op keeps the ground row, the anchor column, the outline rows,
the palette and binary alpha; the blob renders deterministically, passes the construction checks, sags one row in
idle_b, squashes in the wind-up and is judged by a squash-aware feet check; every other body keeps its recipes."""
from __future__ import annotations

from typing import Callable

import numpy as np
from PIL import Image, ImageDraw

OUTLINE = (6, 4, 10, 255)
GOO, SHINE, BONE = (70, 160, 110, 255), (150, 220, 170, 255), (225, 225, 210, 255)
META = {"bottom_row": 76, "floating": False}
CELL = (110, 80)
IDLE = {"base": (55, 75), "mid": (55, 60), "top": (55, 43), "bone_a": (47, 64), "bone_b": (63, 58)}
ATTACK = {"base": (52, 75), "mid": (60, 60), "top": (72, 47), "bone_a": (52, 64), "bone_b": (68, 58)}
HURT = {"base": (55, 75), "mid": (55, 66), "top": (55, 54), "bone_a": (46, 68), "bone_b": (62, 65)}
SLIME = {"sprite": "synthetic_slime", "body": "blob", "facing": "right",
         "keyframes": {"idle": IDLE, "attack": ATTACK, "hurt": HURT}, "colors": {}}
SHAPES = {"idle": [(22, 75), (24, 62), (32, 50), (44, 44), (55, 42), (66, 44), (78, 50), (86, 62), (88, 75)],
          "attack": [(14, 75), (28, 66), (44, 56), (58, 48), (70, 44), (80, 46), (84, 54), (80, 66), (90, 75)],
          "hurt": [(16, 75), (22, 66), (36, 58), (55, 53), (74, 58), (88, 66), (94, 75)]}


def draw(kf: str) -> Image.Image:
    im = Image.new("RGBA", CELL, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon(SHAPES[kf], fill=GOO)
    j = SLIME["keyframes"][kf]
    d.line([j["bone_a"], j["bone_b"]], fill=BONE, width=2)
    x, y = SHAPES[kf][3]
    d.ellipse([x - 2, y + 2, x + 3, y + 5], fill=SHINE)
    a = np.asarray(im).copy()
    solid = a[..., 3] > 0
    ring = np.zeros_like(solid)
    ring[1:] |= solid[:-1]; ring[:-1] |= solid[1:]; ring[:, 1:] |= solid[:, :-1]; ring[:, :-1] |= solid[:, 1:]
    a[ring & ~solid] = OUTLINE
    low = int(np.where((a[..., 3] > 0).any(1))[0].max())
    assert low == META["bottom_row"], f"synthetic slime {kf}: lowest row {low}"
    return Image.fromarray(a, "RGBA")


def keyframes() -> dict[str, Image.Image]:
    return {k: draw(k) for k in ("idle", "attack", "hurt")}


def render(cfg: dict) -> dict[str, dict]:
    from gen import monster_anim as MA
    return MA.generate(cfg["sprite"], cfg, keyframes(), META)


def _box(a: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(a[..., 3] > 0)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def run_blob(check: Callable[[bool, str], None]) -> None:
    try:
        from gen import anim_squash as SQ
    except ImportError as e:
        check(False, f"anim_squash module exists ({e})")
        return
    _squash_op(check, SQ)
    _blob_template(check)
    _idle_b_tweaks(check)
    _recipes_unchanged(check)


def _squash_op(check: Callable[[bool, str], None], SQ) -> None:
    src = np.asarray(draw("idle"))
    lab = np.where(src[..., 3] > 0, 0, -1).astype(np.int32)
    x0, y0, x1, y1 = _box(src)
    h, w = y1 - y0 + 1, x1 - x0 + 1
    same, slab, _ = SQ.squash(src, lab, 1.0, 1.0, 55)
    check(np.array_equal(same, src) and np.array_equal(slab, lab), "squash sx = sy = 1 returns the frame unchanged")
    v, vl, info = SQ.squash(src, lab, 1.0, 0.88, 55)
    n = int(round(h * 0.12))
    vx0, vy0, vx1, vy1 = _box(v)
    check(vy1 == y1 and vy1 - vy0 + 1 == h - n and len(info["rows"]) == n,
          f"squash sy 0.88 removes {n} interior rows above the ground row (height {vy1 - vy0 + 1}, ground {vy1})")
    k = SQ.KEEP
    check(np.array_equal(v[y1 - k + 1:y1 + 1], src[y1 - k + 1:y1 + 1]) and
          np.array_equal(v[vy0:vy0 + k], src[y0:y0 + k]), f"squash keeps the {k} outline rows at the top and the ground")
    check(all(y0 + k <= r <= y1 - k for r in info["rows"]), f"removed rows are interior {info['rows']}")
    s, sl, si = SQ.squash(src, lab, 1.08, 1.0, 55)
    m = int(round(w * 0.08))
    sx0, _, sx1, _ = _box(s)
    check(sx1 - sx0 + 1 == w + m and np.array_equal(s[:, 55], src[:, 55]),
          f"squash sx 1.08 duplicates {m} columns about the anchor column 55 (width {sx1 - sx0 + 1}, column kept)")
    check(sum(1 for c in si["cols"] if c < 55) == m // 2, f"the left side gets the smaller half {si['cols']}")
    b, bl, bi = SQ.squash(src, lab, 1.08, 0.88, 55)
    cols = lambda a: {tuple(int(c) for c in px) for px in a[a[..., 3] > 0][:, :3]}   # noqa: E731
    ratio = (b[..., 3] > 0).sum() / (src[..., 3] > 0).sum()
    check(cols(b) <= cols(src) and set(np.unique(b[..., 3])) <= {0, 255} and 0.85 <= ratio <= 1.15,
          f"squash keeps the palette and binary alpha; area {ratio:.2f}")
    check(np.array_equal(bl >= 0, b[..., 3] > 0), "the label map follows the squash (labelled exactly where opaque)")
    from gen import anim_checks as C
    check(C.dark_edge(b) >= C.dark_edge(src) - 0.01 and C.dark_edge(v) >= C.dark_edge(src) - 0.01,
          f"squash keeps the outline closed (ink repair; dark edge {C.dark_edge(b):.2f} vs {C.dark_edge(src):.2f})")
    cols_lr = SQ.squash_px(src, None, 0, (3, -2), 55)[2]["cols"]
    check(len(cols_lr) == 5 and sum(1 for c in cols_lr if c < 55) == 3,
          f"squash_px takes signed per-side column counts (auto) {cols_lr}")
    b2, _, _ = SQ.squash(src, lab, 1.08, 0.88, 55)
    check(np.array_equal(b, b2), "squash is deterministic")
    up, _, _ = SQ.squash(src, None, 0.97, 1.03, 55)
    check(_box(up)[3] == y1 and _box(up)[3] - _box(up)[1] + 1 == h + int(round(h * 0.03)),
          "squash sy 1.03 stretches up from the ground (rows duplicated)")
    for bad in ({"sx": 1.5}, {"sx": 0.86, "sy": 0.90}, {"sz": 1.0}):
        try:
            SQ.validate(bad, "rig t frame f")
            check(False, f"squash {bad} is rejected")
        except ValueError as e:
            check("rig t frame f" in str(e), f"squash {bad} is rejected ({e})")
    one, _, oi = SQ.squash_px(src, None, -1, 0, 55)
    check(_box(one)[1] == y0 + 1 and _box(one)[3] == y1 and len(oi["rows"]) == 1, "squash_px rows -1 sags exactly one row")


def _blob_template(check: Callable[[bool, str], None]) -> None:
    from gen import monster_check as MC
    from gen import rig as R
    from gen import selftest_rig as SR
    try:
        one, two = render(SLIME), render(SLIME)
    except (ValueError, KeyError) as e:
        check(False, f"blob template renders ({type(e).__name__}: {e})")
        return
    check(sorted(one) == sorted(two) and all(np.array_equal(one[k]["img"], two[k]["img"]) for k in one),
          f"synthetic blob renders deterministically ({len(one)} frames)")
    check(len(one) == 10, f"a rigged blob gets 10 generated frames ({sorted(one)})")
    rig = R.Rig(SLIME, CELL)
    check(rig.ground == ("base",) and not rig.feet and not rig.limbs, "blob: base is the ground joint; no feet, no IK")
    rep = MC.check_sprite(SLIME["sprite"], SLIME, keyframes(), META, one, with_lock=False)
    every = [f"{k}: {e}" for k, v in rep.items() for e in v]
    fails = [e for e in every if not any(t in e for t in SR.TUNING)]
    check(not fails, f"synthetic blob frames pass the construction checks {fails[:3]}")
    print(f"  info {len(every) - len(fails)} tuning findings on the synthetic blob {every[:2]}")
    idle = np.asarray(keyframes()["idle"])
    x0, y0, x1, y1 = _box(idle)
    ib = one["idle_b"]["img"]
    check(_box(ib) == (x0, y0 + 1, x1, y1) and int((ib[..., 3] > 0).sum()) < int((idle[..., 3] > 0).sum()),
          f"blob idle_b sags: one interior row removed, the top 1 px lower, ground and width kept ({_box(ib)})")
    w2 = one["atk_wind2"]
    bx0, by0, bx1, by1 = _box(w2["img"])
    check(by1 == y1 and bx1 - bx0 > x1 - x0 + 2 and by1 - by0 < y1 - y0 - 2,
          f"atk_wind2 squashes: wider, lower, on the ground ({_box(w2['img'])} vs idle {(x0, y0, x1, y1)})")
    check(w2["joints"]["base"] == IDLE["base"], "the base joint never moves")
    sq = w2.get("squash")
    check(bool(sq) and abs(sq[0] - 1.08) < 0.03 and abs(sq[1] - 0.88) < 0.03, f"the frame records its squash {sq}")
    from gen import anim_checks as C
    S, T = idle, np.asarray(keyframes()["attack"])
    ok = C.feet(w2["img"], S, T, w2["u"], 76, w2["pinned"], False, 0, None, None, sq)
    moved = np.zeros_like(w2["img"])
    moved[:, 3:] = w2["img"][:, :-3]
    bad = C.feet(moved, S, T, w2["u"], 76, w2["pinned"], False, 0, None, None, sq)
    plain = C.feet(w2["img"], S, T, w2["u"], 76, w2["pinned"], False, 0, None, None, None)
    check(not ok and bool(bad) and bool(plain),
          f"the feet check scales the base about the anchor: squashed passes, 3 px off fails, unscaled fails ({bad})")
    off = render({**SLIME, "frames": {"atk_wind2": {"squash": None}}})["atk_wind2"]["img"]
    check(abs((_box(off)[2] - _box(off)[0]) - (x1 - x0)) <= 2, "frames.<f>.squash: null turns the template's squash off")
    try:
        render({**SLIME, "frames": {"atk_wind1": {"squash": {"sx": 1.5}}}})
        check(False, "a squash outside the caps raises")
    except ValueError as e:
        check("synthetic_slime" in str(e) and "atk_wind1" in str(e), f"a squash outside the caps raises ({e})")


def _idle_b_tweaks(check: Callable[[bool, str], None]) -> None:
    """Per-rig idle_b tweaks (wing flutter, robe sway): joints moved at most 1 px, then the body's usual idle_b op."""
    from gen import monster_anim as MA
    from gen import puppet as PU
    from gen import selftest_rig as SR
    kfs = SR.keyframes()
    base = MA.generate("synthetic", SR.RIG, kfs, SR.META)["idle_b"]["img"]
    bob = np.asarray(PU.bob(kfs["idle"], int(round(SR.IDLE["hip"][1])), 1))
    check(np.array_equal(base, bob), "without idle_b tweaks idle_b is the plain 1 px bob (byte-identical)")
    cfg = {**SR.RIG, "frames": {"idle_b": {"tweaks": {"hand_n": [1, 0], "el_n": [1, 0]}}}}
    f = MA.generate("synthetic", cfg, kfs, SR.META)["idle_b"]
    check(not np.array_equal(f["img"], base) and f["labels"] is not None and f["joints"]["hand_n"][0] ==
          SR.IDLE["hand_n"][0] + 1, "idle_b tweaks move the joints 1 px (a labelled rig frame, then the bob)")
    from gen import monster_check as MC
    rep = MC.check_sprite("synthetic", cfg, kfs, SR.META, MA.generate("synthetic", cfg, kfs, SR.META), with_lock=False)
    fails = [e for e in rep["idle_b"] if not any(t in e for t in SR.TUNING)]
    check(not fails, f"a tweaked idle_b passes the construction checks {fails[:3]}")
    try:
        MA.generate("synthetic", {**SR.RIG, "frames": {"idle_b": {"tweaks": {"hand_n": [2, 0]}}}}, kfs, SR.META)
        check(False, "an idle_b tweak over 1 px raises")
    except ValueError as e:
        check("idle_b" in str(e) and "1 px" in str(e), f"an idle_b tweak over 1 px raises ({e})")


def _recipes_unchanged(check: Callable[[bool, str], None]) -> None:
    """FW-6 is additive: only the blob template squashes and sags; every other body keeps its recipes and idle_b."""
    from gen import rig as R
    from gen import selftest_rig as SR
    for body in ("biped", "quadruped", "bird", "naga", "floating", "swimmer"):
        rig = R.Rig({**SR.RIG, "body": body, "keyframes": {}}, (80, 80))
        check(not any("squash" in v for v in rig.recipes.values()) and getattr(rig, "idle_b", None) == "bob",
              f"{body}: no template squash, idle_b mode bob")
