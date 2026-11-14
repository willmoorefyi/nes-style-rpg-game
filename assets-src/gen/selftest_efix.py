"""Wave-0 framework selftests (docs/ENEMY_ANIM_ISSUES.md section 2), each RED first on a synthetic fixture: F1 fx
exclusion, F2 part scale and the per-frame sampler, F3 fx-mask integrity, F4 intra-part crease, F5 foot release, F6
roughness, F7 prop attached, the efix_gates switch, the fx allowlist (revision 3), and the real-lich crystal size in
cast_rise (revision 4, E4)."""
from __future__ import annotations

import copy
import inspect
from typing import Callable

import numpy as np
import yaml

BODY, FX, INK = (90, 90, 90, 255), (120, 200, 255, 255), (6, 4, 10, 255)
# revision 3: no new kind fx without orchestrator approval; G1 turns lich crystal into fx (E4)
FX_ALLOWED = {"garland": {"glow"}, "lich": {"trail", "crystal"}, "vampire": {"slash"}}
FX_PENDING: set[tuple[str, str]] = set()


def _canvas() -> tuple[np.ndarray, np.ndarray]:
    return np.zeros((80, 80, 4), np.uint8), np.full((80, 80), -1, np.int32)


def _paint(a, lab, box, rgba, idx) -> None:
    x0, y0, x1, y1 = box
    a[y0:y1, x0:x1] = rgba
    lab[y0:y1, x0:x1] = idx


def run_f1(check: Callable[[bool, str], None]) -> None:
    """A spell blob (part 1, kind fx) above a 40 px body shrinks to half its size: the fx exclusion passes it; the same
    shrink of a body part fails check 6's bbox height."""
    from gen import anim_checks as C, anim_efix as E
    src, sl = _canvas()
    _paint(src, sl, (20, 36, 60, 76), BODY, 0)
    _paint(src, sl, (30, 4, 50, 36), FX, 1)                            # 32 rows of fx on top
    fr, fl = _canvas()
    _paint(fr, fl, (20, 36, 60, 76), BODY, 0)
    _paint(fr, fl, (35, 19, 45, 35), FX, 1)                            # half-size blob
    fr[18, 34:46], fl[18, 34:46] = INK, -2                             # its own outline ring (new ink)
    plain = C.silhouette(fr, src, src, 0.0, 80)
    check(any("bbox height" in e for e in plain), f"F1 RED: without the exclusion the shrinking blob fails {plain}")
    excl = (E.fx_exclusion(fl, [1]), E.fx_exclusion(sl, [1]), E.fx_exclusion(sl, [1]))
    check(not C.silhouette(fr, src, src, 0.0, 80, excl), "F1: fx-labelled pixels and their ink ring are excluded (passes)")
    rigid = (E.fx_exclusion(fl, []), E.fx_exclusion(sl, []), E.fx_exclusion(sl, []))
    check(any("bbox height" in e for e in C.silhouette(fr, src, src, 0.0, 80, rigid)),
          "F1: the same shrink on a body part (no fx label) still fails the height check")
    ring = E.fx_exclusion(fl, [1])
    check(bool(ring[18, 34:46].all()) and not ring[40, 40], "F1: the -2 ring 8-adjacent to fx is excluded, the body is not")
    from gen import monster_check as MC
    keep, kl = _canvas()                                               # the frame drops nothing; the target loses its fx
    _paint(keep, kl, (20, 36, 60, 76), BODY, 0)
    _paint(keep, kl, (30, 4, 50, 36), BODY, 0)
    f = {"labels": kl, "src_labels": kl, "toward_labels": sl, "fx": [1], "u": 1.0}
    check(bool(MC._silhouette(f, keep, keep, src, 80, True)) and not MC._silhouette(f, keep, keep, src, 80, False),
          "F1: strict with efix_gates; with the gates off (build) it only relaxes check 6")


def _orb_rig():
    """The selftest_rig biped with a fx orb on the attack keyframe's hand (and its keyframes)."""
    from gen import selftest_rig as SR
    from PIL import ImageDraw
    kfs = SR.keyframes()
    d = ImageDraw.Draw(kfs["attack"])
    d.ellipse([55, 22, 69, 36], fill=FX)                               # the orb, above the fist
    cfg = copy.deepcopy(SR.RIG)
    cfg["keyframes"]["attack"] = {**cfg["keyframes"]["attack"], "orb": (62, 29)}
    cfg["parts"]["orb"] = {"kind": "fx", "bone": {"attack": ["hand_n", "orb"]}, "radius": 1.0, "in": ["attack"]}
    cfg["masks"] = {"orb": {"attack": [[54, 21], [70, 21], [70, 37], [54, 37]]}}
    return cfg, kfs, SR.META


def run_f2(check: Callable[[bool, str], None]) -> None:
    from gen import monster_anim as MA, monster_check as MC, rig_render as RR
    cfg, kfs, meta = _orb_rig()
    base = MA.generate("synthetic_orb", cfg, kfs, meta)
    one = copy.deepcopy(cfg)
    one["frames"] = {"atk_mid": {"scale": {"orb": 1.0}}}
    same = MA.generate("synthetic_orb", one, kfs, meta)
    check(all(np.array_equal(base[n]["img"], same[n]["img"]) for n in base), "F2: scale 1.0 is byte-identical")
    half = copy.deepcopy(cfg)
    half["frames"] = {"atk_mid": {"scale": {"orb": 0.5}}}
    a, b = MA.generate("synthetic_orb", half, kfs, meta), MA.generate("synthetic_orb", half, kfs, meta)
    f = a["atk_mid"]
    orb = f["names"].index("orb")
    n0, n1 = int((base["atk_mid"]["labels"] == orb).sum()), int((f["labels"] == orb).sum())
    check(0 < n1 <= 0.4 * n0, f"F2 RED: scale 0.5 shrinks the orb ({n1} px vs {n0} at scale 1)")
    check(np.array_equal(f["img"], b["atk_mid"]["img"]), "F2: scale 0.5 is deterministic")
    check(not MC.C.palette_lock(f["img"], MC.palette(kfs)) and not MC.C.binary_alpha(f["img"]),
          "F2: scale 0.5 keeps the palette (subset of the sources) and binary alpha")
    arr = np.asarray(kfs["attack"]).copy()
    m = np.zeros(arr.shape[:2], bool); m[20:40, 52:72] = arr[20:40, 52:72, 3] > 0
    for name, fn in (("rigid", RR.rigid), ("rotsprite", RR.rotsprite)):
        out, hit = fn(arr, m, (56.0, 45.0), (56.0, 45.0), 0.3, arr.shape[:2], scale=0.5)
        cols = {tuple(c) for c in out[hit][:, :4].tolist()} - {tuple(c) for c in arr[m][:, :4].tolist()}
        check(not cols and set(np.unique(out[..., 3])) <= {0, 255} and 0 < hit.sum() < m.sum(),
              f"F2: {name} at scale 0.5 copies source colours only, binary alpha, fewer pixels")
        full, fh = fn(arr, m, (56.0, 45.0), (56.0, 45.0), 0.3, arr.shape[:2])
        again, ah = fn(arr, m, (56.0, 45.0), (56.0, 45.0), 0.3, arr.shape[:2], scale=1.0)
        check(np.array_equal(full, again) and np.array_equal(fh, ah), f"F2: {name} scale 1.0 = no scale argument")
    gaps = np.zeros(arr.shape[:2], bool); gaps[45, 56] = True
    sx, sy, ok = RR._rigid_map(arr, (56.0, 45.0), (40.0, 40.0), 0.0, arr.shape[:2], 0.5)
    check(bool(RR._src_gap(gaps, sx, sy, ok)[40, 40]) and int(sx[40, 42]) == 60, "F2: _rigid_map carries the same factor")
    for bad, why in (({"atk_mid": {"scale": {"torso": 0.5}}}, "a non-fx part"), ({"atk_mid": {"scale": {"orb": 0.2}}}, "0.2"),
                     ({"atk_mid": {"sampler": "bilinear"}}, "an unknown sampler")):
        c2 = copy.deepcopy(cfg); c2["frames"] = bad
        try:
            MA.generate("synthetic_orb", c2, kfs, meta)
            check(False, f"F2: {why} is rejected")
        except ValueError as e:
            check("synthetic" in str(e) and "atk_mid" in str(e), f"F2: {why} is rejected ({e})")
    rs, rs_rig = copy.deepcopy(cfg), copy.deepcopy(cfg)
    rs["frames"] = {"atk_mid": {"sampler": "rotsprite"}}
    rs_rig["sampler"] = "rotsprite"
    g1, g2 = MA.generate("synthetic_orb", rs, kfs, meta), MA.generate("synthetic_orb", rs_rig, kfs, meta)
    check(np.array_equal(g1["atk_mid"]["img"], g2["atk_mid"]["img"]) and
          np.array_equal(g1["atk_wind1"]["img"], base["atk_wind1"]["img"]),
          "per-frame sampler: rotsprite on atk_mid only (= the rig-level sampler there, other frames unchanged)")


def run_f3_f7(check: Callable[[bool, str], None]) -> None:
    from gen import anim_efix as E
    a, lab = _canvas()
    _paint(a, lab, (10, 10, 50, 50), BODY, 0)
    _paint(a, lab, (30, 10, 50, 30), FX, 1)
    poly = {"fx_part": {"attack": [[30, 10], [49, 10], [49, 29], [30, 29]]}}
    kinds, names = {"fx_part": "fx", "body": "rigid"}, ["body", "fx_part"]
    ok, _ = E.mask_integrity(poly, kinds, "attack", lab, names, a[..., 3] > 0)
    lab2 = lab.copy(); lab2[20:30, 30:40] = 0                          # a later mask claimed part of the arc
    bad, _ = E.mask_integrity(poly, kinds, "attack", lab2, names, a[..., 3] > 0)
    check(not ok and bool(bad) and "100 opaque px" in bad[0], f"F3 RED: fx mask pixels labelled body fail {bad}")
    rep, ov = E.mask_integrity(poly, {"fx_part": "rigid"}, "attack", lab2, names, a[..., 3] > 0)
    check(not rep and ov == {"fx_part": {"px": 100, "by": {"body": 100}}}, "F3: a non-fx mask overlap is reported only")
    pl = np.full((80, 80), -1, np.int32)
    pl[20:60, 20:30] = 0                                               # grip (arm), columns 20-29
    pl[30:60, 30:34] = 1                                               # prop right beside it: 30 px touch
    check(not E.prop_attached(pl, {1: [0]}, ["arm", "club"]), "F7: a prop beside its grip passes")
    pl[pl == 1] = -1
    pl[57:60, 31:34] = 1                                               # moved 1 px off the arm ...
    pl[57, 30] = 1                                                     # ... but for a 1 px touch
    bad = E.prop_attached(pl, {1: [0]}, ["arm", "club"])
    check(bool(bad) and "club touches its grip arm by 1 px" in bad[0], f"F7 RED: a prop touching its grip by < 4 px fails {bad}")


def run_f4(check: Callable[[bool, str], None]) -> None:
    from gen import anim_efix as E
    a, lab = _canvas()
    _paint(a, lab, (10, 10, 60, 60), BODY, 0)
    a[30, 20:26], lab[30, 20:26] = INK, -2                             # a 6 px crease inside part 0
    bad = E.crease(a, lab, 80, ["neck"])
    check(bool(bad) and "6 px >= 5" in bad[0] and "neck" in bad[0], f"F4 RED: a 6 px intra-part crease fails {bad}")
    lab[30, 24:26], a[30, 24:26] = 0, BODY[:3] + (255,)                # 4 px left
    check(not E.crease(a, lab, 80), "F4: a 4 px crease (under ceil(5 * 80 / 80)) passes")
    b, bl = _canvas()
    _paint(b, bl, (10, 10, 60, 35), BODY, 0); _paint(b, bl, (10, 36, 60, 60), BODY, 1)
    b[35, 15:40], bl[35, 15:40] = INK, -2                              # ink between two parts: a seam line, not a crease
    check(not E.crease(b, bl, 80), "F4: new ink between two different parts passes")
    c, cl = _canvas()
    _paint(c, cl, (10, 10, 60, 60), BODY, 0)
    c[10, 20:30], cl[10, 20:30] = INK, -2                              # on the silhouette edge (not fully inside)
    check(not E.crease(c, cl, 80), "F4: edge ink (a neighbour transparent) passes")
    check(E.crease(a, lab, 200) == [] and len(E.pieces8(np.eye(5, dtype=bool))) == 1, "F4: the limit scales; 8-connected")


def run_f5(check: Callable[[bool, str], None]) -> None:
    from gen import anim_feet as AF, monster_check as MC
    a, lab = _canvas()
    _paint(a, lab, (30, 20, 50, 60), BODY, 0)
    _paint(a, lab, (32, 60, 38, 77), BODY, 1)                          # foot_n, ground row 76
    _paint(a, lab, (42, 60, 48, 77), BODY, 2)                          # foot_f
    src = lab.copy()
    lifted = lab.copy(); lifted[75:77, 32:38] = -1
    la = a.copy(); la[75:77, 32:38] = 0
    feet = {"foot_n": [1], "foot_f": [2]}
    check(not AF.released_feet(a, lab, src, feet, 76), "F5: feet kept on their row pass")
    bad = AF.released_feet(la, lifted, src, feet, 76)
    check(bool(bad) and "foot_n" in bad[0] and "74 vs source 76" in bad[0], f"F5 RED: a foot lifted 2 px fails {bad}")
    f = {"img": la, "labels": lifted, "contact": np.zeros((80, 80), bool), "src_labels": src, "foot_parts": feet,
         "names": ["body", "foot_n", "foot_f"], "grips": {}}
    check(any("released" in e for e in MC._efix("atk_recover", f, {"bottom_row": 76})) and
          not any("released" in e for e in MC._efix("hurt_in1", f, {"bottom_row": 76})),
          "F5: the release is exempt only in hurt_in1 / hurt_in2")


def run_gates(check: Callable[[bool, str], None]) -> None:
    """Revision 1: the new checks run in check / review (efix_gates True) and, since V.3, in the build gate too."""
    from gen import anim_efix as E, monster_atlas as MAT, monster_check as MC
    a, lab = _canvas()
    _paint(a, lab, (10, 10, 60, 60), BODY, 0)
    a[30, 20:26], lab[30, 20:26] = INK, -2
    f = {"img": a, "labels": lab, "src": "idle", "toward": "idle", "u": 0.0, "rots": {}, "joints": {}, "pinned": False,
         "names": ["torso"], "grips": {}, "fx": []}
    args = ("atk_wind1", f, {"idle": a}, {}, {"bottom_row": 59}, {BODY[:3], INK[:3]})
    on, off = MC.frame_checks(*args), MC.frame_checks(*args, efix_gates=False)
    check(any("crease" in e for e in on) and not any("crease" in e for e in off), "efix_gates: on in check, off by flag")
    src = inspect.getsource(MAT.sprite_frames)
    check("efix_gates=True" in src and "efix_gates=False" not in src, "efix_gates: the monsters_ai build gates on them (V.3)")
    check(E.roughness(np.pad(np.ones((20, 20, 4), np.uint8) * 255, ((5, 5), (5, 5), (0, 0)))) == 0.0, "F6: a square is smooth")


def run_fx_allowlist(check: Callable[[bool, str], None]) -> None:
    """Revision 3: the fx parts of the real rigs are exactly the approved list (lich crystal pending G1 / E4)."""
    from gen import monster_anim as MA
    found = {}
    for p in sorted(MA.RIGS.glob("*.yaml")):
        cfg = yaml.safe_load(p.read_text()) or {}
        fx = {n for n, d in (cfg.get("parts") or {}).items() if (d or {}).get("kind") == "fx"}
        if fx:
            found[p.stem] = fx
    extra = {(s, n) for s, ns in found.items() for n in ns if n not in FX_ALLOWED.get(s, set())}
    missing = {(s, n) for s, ns in FX_ALLOWED.items() for n in ns if n not in found.get(s, set())} - FX_PENDING
    check(not extra, f"fx allowlist: no kind fx part outside the approved list (orchestrator approval needed) {sorted(extra)}")
    check(not missing, f"fx allowlist: every approved fx part is declared {sorted(missing)}")


def lich_crystal_ratio(cfg: dict | None = None) -> tuple[int, int]:
    """(crystal px in the generated lich cast_rise, crystal px in the approved cast keyframe), from the real rig and
    sheet; `cfg` overrides the rig file (the RED-first run sets the rise scale back to 1.0 in memory)."""
    from gen import monster_anim as MA, rig as R
    cfg = cfg if cfg is not None else MA.load_rig("lich")
    _, meta, kfs = next(e for e in MA.load_entries() if e[0] == "lich")
    gen = MA.generate("lich", cfg, kfs, meta)
    rig = R.Rig(cfg, kfs["idle"].size)
    rise = int((gen["cast_rise"]["labels"] == list(rig.parts).index("crystal")).sum())
    plab, pnames = R.segment(rig, "cast", np.asarray(kfs["cast"].convert("RGBA")).copy())
    return rise, int((plab == pnames.index("crystal")).sum())


def run_lich_crystal(check: Callable[[bool, str], None]) -> None:
    """Revision 4 (E4, V.3): on the real lich the crystal grows in, so in cast_rise it is at most 40 % of its size
    in cast (RED with frames.cast_rise.scale.crystal at 1.0)."""
    rise, cast = lich_crystal_ratio()
    check(cast > 0 and rise <= 0.4 * cast, f"E4: lich crystal in cast_rise is at most 40 % of cast ({rise} / {cast} px)")


def run_efix(check: Callable[[bool, str], None]) -> None:
    for fn in (run_f1, run_f2, run_f3_f7, run_f4, run_f5, run_gates, run_fx_allowlist, run_lich_crystal):
        fn(check)
