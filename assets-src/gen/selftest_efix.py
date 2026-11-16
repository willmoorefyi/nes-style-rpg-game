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
# revision 3: no new kind fx without orchestrator approval; G1 turns lich crystal into fx (E4); FW-7 (pass R,
# orchestrator-approved): hollow_seraph halo, which brightens (frames.<f>.brighten) only at the cast frames
FX_ALLOWED = {"garland": {"glow"}, "lich": {"trail", "crystal"}, "vampire": {"slash"}, "hollow_seraph": {"halo"}}
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


def run_halo_brighten(check: Callable[[bool, str], None]) -> None:
    """FW-7 (ROSTER_PLAN 5.3): on the real hollow_seraph the fx halo brightens only where the rig says (cast_gather 1
    step, cast_release 2), only to approved colours of the halo, and every other frame is byte-identical to the rig
    without `brighten` (RED: with brighten stripped, the halo in cast_gather is not brighter). brighten on a non-fx
    part, or a step outside 1..3, is an error naming the rig."""
    from gen import monster_anim as MA, monster_render as MR, pixelize as PX, rig as R
    cfg = MA.load_rig("hollow_seraph")
    _, meta, kfs = next(e for e in MA.load_entries() if e[0] == "hollow_seraph")
    plain = copy.deepcopy(cfg)
    for f in (plain.get("frames") or {}).values():
        f.pop("brighten", None)
    on, off = MA.generate("hollow_seraph", cfg, kfs, meta), MA.generate("hollow_seraph", plain, kfs, meta)
    rig = R.Rig(cfg, kfs["idle"].size)
    hi = list(rig.parts).index("halo")
    lum = lambda g, n: float((g[n]["img"][..., :3].astype(float) @ [0.299, 0.587, 0.114])[g[n]["labels"] == hi].mean())
    bright = {n for n, f in (cfg.get("frames") or {}).items() if (f or {}).get("brighten")}
    check(bright == {"cast_gather", "cast_release"}, f"FW-7: the seraph halo brightens in the cast frames only ({sorted(bright)})")
    check(all(lum(on, n) > lum(off, n) + 5 for n in bright), "FW-7: brighten lifts the halo's luminance (RED without it)")
    same = [n for n in on if n not in bright and np.array_equal(on[n]["img"], off[n]["img"])]
    check(len(same) == len(on) - len(bright), f"FW-7: every other frame is byte-identical ({len(same)} of {len(on) - len(bright)})")
    halo_cols = set()
    for kf in kfs:
        if kf in rig.keyframes:
            lab, names = R.segment(rig, kf, np.asarray(kfs[kf].convert("RGBA")).copy())
            halo_cols |= {tuple(c) for c in np.asarray(kfs[kf].convert("RGBA"))[lab == names.index("halo")][:, :3].tolist()}
    got = {tuple(c) for n in bright for c in on[n]["img"][on[n]["labels"] == hi][:, :3].tolist()}
    check(got <= halo_cols | {tuple(PX.OUTLINE)}, f"FW-7: brightened halo colours are approved halo colours ({len(got - halo_cols)} new)")

    def refused(over) -> bool:
        try:
            MR.brighten(rig, "cast_gather", over, on["cast_gather"]["img"].copy(), on["cast_gather"]["labels"], {}, {})
        except ValueError as e:
            return "hollow_seraph" in str(e)
        return False
    check(refused({"brighten": {"body": 1}}) and refused({"brighten": {"halo": 4}}) and refused({"brighten": {"halo": 0}}),
          "FW-7: brighten refuses a non-fx part and steps outside 1..3, naming the rig")


def _refused(fn, *words: str) -> bool:
    try:
        fn()
    except ValueError as e:
        return all(w in str(e) for w in words)
    return False


def run_kf_paint(check: Callable[[bool, str], None]) -> None:
    """FW-P (docs/ROSTER_FIX_PLAN.md 3, D-F6): rig `paint` on a keyframe is applied in load_entries after
    pad_keyframes. A patch changes that key's atlas cell and every frame cut from it, nothing else; the 160 px cap, the
    approved-exception allowlist, the approved palette and the remap-only key are enforced; a painted key is locked as
    `kf:<name>` and gets the palette, pieces and outline checks; a rig without keyframe paint is byte-identical."""
    import contextlib
    import io
    import json
    from gen import monster_anim as MA, monster_atlas as MAT, monster_check as MC, monster_keys as MK
    entries = {e[0]: e for e in MA.load_entries()}
    _, meta, kfs = entries["goblin"]
    cfg = MA.load_rig("goblin")
    idle = np.asarray(kfs["idle"].convert("RGBA"))
    pal = sorted(MK.approved_palette(kfs))
    old = tuple(int(v) for v in idle[45, 44, :3])
    new = next(c for c in pal if c not in (old, MK.OUTLINE))
    painted_cfg = copy.deepcopy(cfg)
    painted_cfg.setdefault("paint", []).append({"frame": "idle", "xy": [[44, 45]], "rgb": list(new)})
    same, none = MK.paint_keys("goblin", cfg, kfs)
    check(none == [] and all(same[k] is kfs[k] for k in kfs), "FW-P: a rig without keyframe paint keeps the same key objects")
    real = MA.load_rig
    MA.load_rig = lambda s: painted_cfg if s == "goblin" else real(s)
    try:
        _, pmeta, pkfs = next(e for e in MA.load_entries() if e[0] == "goblin")
    finally:
        MA.load_rig = real
    pa = np.asarray(pkfs["idle"].convert("RGBA"))
    check(pmeta.get("kf_painted") == ["idle"] and tuple(pa[45, 44, :3]) == new and int((pa != idle).any(2).sum()) == 1,
          f"FW-P: load_entries paints the idle key at (44, 45) only ({pmeta.get('kf_painted')})")
    check(all(np.array_equal(np.asarray(pkfs[k]), np.asarray(kfs[k])) for k in kfs if k != "idle"),
          "FW-P: the other keys are the approved ones")
    base, gen = MA.generate("goblin", cfg, kfs, meta), MA.generate("goblin", painted_cfg, pkfs, pmeta)
    from_idle = [n for n in gen if gen[n]["src"] == "idle"]
    check(bool(from_idle) and all(not np.array_equal(gen[n]["img"], base[n]["img"]) for n in from_idle),
          f"FW-P: every frame cut from the painted key changes ({len(from_idle)} frames)")
    check(all(np.array_equal(gen[n]["img"], base[n]["img"]) for n in gen if gen[n]["src"] != "idle"),
          "FW-P: every frame cut from another key is byte-identical")
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        frames = MAT.sprite_frames("goblin", pmeta, pkfs)[0]
    check(np.array_equal(np.asarray(frames["idle"].convert("RGBA")), pa) and "goblin lock" in buf.getvalue(),
          "FW-P: the atlas cell of the painted key is the painted key (the build warns on the stale lock)")
    rep = MC.painted_key_checks(pmeta, {k: np.asarray(v.convert("RGBA")) for k, v in pkfs.items()}, set(pal))
    check(rep == {"kf:idle": []}, f"FW-P: the painted key passes its palette, pieces and outline checks {rep}")
    lock = MC.lock_frames(gen, pkfs, pmeta)
    check("kf:idle" in lock and not [n for n in MC.lock_frames(base, kfs, meta) if n.startswith("kf:")],
          "FW-P: a painted key is locked as kf:idle; an unpainted sheet's lock has no kf: entry")
    from gen import anim_checks as C
    stale = {**{n: C.frame_hash(a) for n, a in lock.items()}, "kf:idle": "0" * 64}
    check(any(e.startswith("kf:idle: hash differs") for e in C.lock_match(lock, stale)),
          "FW-P: a changed key paint fails the lock (kf:idle: hash differs)")
    stray = copy.deepcopy(painted_cfg)
    stray["paint"].append({"frame": "idle", "xy": [[2, 2]], "rgb": list(new)})
    skfs, _ = MK.paint_keys("goblin", stray, kfs)
    bad = MC.painted_key_checks({**pmeta, "kf_painted": ["idle"], "kf_raw": {"idle": kfs["idle"]}},
                                {k: np.asarray(v.convert("RGBA")) for k, v in skfs.items()}, set(pal))
    check(any("pieces" in e for e in bad["kf:idle"]), f"FW-P: a stray painted pixel fails the pieces check {bad}")

    opaque = [[int(x), int(y)] for y, x in zip(*np.nonzero(idle[..., 3] > 0))]
    big = copy.deepcopy(cfg)
    big["paint"] = [{"frame": "idle", "xy": opaque[:161], "rgb": list(new)}]
    check(_refused(lambda: MK.paint_keys("goblin", big, kfs), "goblin", "161 px", "160"), "FW-P: a 161 px key patch is refused")
    big["paint"][0]["xy"] = opaque[:160]
    check(MK.paint_keys("goblin", big, kfs)[1] == ["idle"], "FW-P: a 160 px key patch is allowed")
    off = copy.deepcopy(painted_cfg)
    off["paint"][-1]["rgb"] = [1, 2, 3]
    check(_refused(lambda: MK.paint_keys("goblin", off, kfs), "goblin", "approved palette"), "FW-P: an off-palette colour is refused")
    out = copy.deepcopy(painted_cfg)
    out["paint"][-1]["xy"] = [[80, 3]]
    check(_refused(lambda: MK.paint_keys("goblin", out, kfs), "outside"), "FW-P: a pixel outside the cell is refused")
    nul = copy.deepcopy(painted_cfg)
    nul["paint"][-1]["rgb"] = None
    check(MK.paint_keys("goblin", nul, kfs)[1] == ["idle"], "FW-P: rgb null (transparent) is allowed")
    for sid, caps in (("goblin", {"hurt": 200}), ("crocodile", {"hurt": 221}), ("crocodile", {"idle": 200}),
                      ("drowned_sovereign", {"cast": 301}), ("chimera", {"attack": 801}), ("chimera", {"hurt": 601}),
                      ("chimera", {"idle": 200})):
        check(_refused(lambda: MK.paint_keys(sid, {"kf_paint_cap": caps}, kfs), sid, "not an approved exception"),
              f"FW-P: kf_paint_cap {caps} on {sid} is refused (not in the allowlist)")
    check(MK.KF_PAINT_ALLOW == {("crocodile", "hurt"): 220, ("drowned_sovereign", "cast"): 300, ("chimera", "attack"): 800,
                                ("chimera", "hurt"): 600} and MK.KF_PAINT_CAP == 160,
          "FW-P: the cap is 160 px; the exceptions are exactly crocodile/hurt <= 220, drowned_sovereign/cast <= 300 and "
          "(FW-PA, D-R1) chimera/attack <= 800, chimera/hurt <= 600")
    for k, n in (("attack", 800), ("hurt", 600)):
        check(MK.paint_keys("chimera", {"kf_paint_cap": {k: n}}, kfs)[1] == [], f"FW-PA: chimera kf_paint_cap {{{k}: {n}}} is allowed")
    raw = {e[0]: e for e in MA.load_entries(paint=False)}
    ck = raw["crocodile"][2]
    ch = np.asarray(ck["hurt"].convert("RGBA"))
    hurt_px = [[int(x), int(y)] for y, x in zip(*np.nonzero(ch[..., 3] > 0))]
    cpal = sorted(MK.approved_palette(ck))
    croc = {"kf_paint_cap": {"hurt": 220}, "paint": [{"frame": "hurt", "xy": hurt_px[:220], "rgb": list(cpal[1])}]}
    check(MK.paint_keys("crocodile", croc, ck)[1] == ["hurt"], "FW-P: crocodile kf_paint_cap {hurt: 220} allows 220 px")
    croc["paint"][0]["xy"] = hurt_px[:221]
    check(_refused(lambda: MK.paint_keys("crocodile", croc, ck), "221 px"), "FW-P: crocodile hurt over 220 px is refused")
    dk = raw["drowned_sovereign"][2]
    dc = np.asarray(dk["cast"].convert("RGBA"))
    blue = [[int(x), int(y)] for y, x in zip(*np.nonzero((dc[..., :3] == (33, 33, 165)).all(2) & (dc[..., 3] > 0)))]
    remap = {"kf_paint_cap": {"cast": 300}, "paint": [{"frame": "cast", "xy": blue, "rgb": [41, 99, 99]}]}
    check(MK.paint_keys("drowned_sovereign", remap, dk)[1] == ["cast"], "FW-P: the drowned cast remap (165 px) is allowed")
    holes = [[int(x), int(y)] for y, x in zip(*np.nonzero(dc[..., 3] == 0))][:1]
    for bad_p, why in (({"frame": "cast", "xy": blue[:1], "rgb": None}, "null"), ({"frame": "cast", "xy": holes, "rgb": [41, 99, 99]}, "transparent")):
        check(_refused(lambda: MK.paint_keys("drowned_sovereign", {"kf_paint_cap": {"cast": 300}, "paint": [bad_p]}, dk),
                       "remap only"), f"FW-P: drowned_sovereign/cast is a remap only ({why} refused)")
    kf_rigs = [p.stem for p in sorted(MA.RIGS.glob("*.yaml")) if MK.kf_patches(yaml.safe_load(p.read_text()) or {})]
    kf_locks = [p.name for p in sorted(MA.RIGS.glob("*.lock.json")) if any(k.startswith("kf:") for k in json.loads(p.read_text()))]
    check(len(list(MA.RIGS.glob("*.lock.json"))) >= 77 and kf_locks == sorted(f"{s}.lock.json" for s in kf_rigs),
          f"FW-P: kf: lock entries exactly for the rigs with keyframe paint (rigs {kf_rigs}, locks {kf_locks})")


def run_efix(check: Callable[[bool, str], None]) -> None:
    for fn in (run_f1, run_f2, run_f3_f7, run_f4, run_f5, run_gates, run_fx_allowlist, run_lich_crystal,
               run_halo_brighten, run_kf_paint):
        fn(check)
