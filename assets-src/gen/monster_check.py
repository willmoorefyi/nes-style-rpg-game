"""Runs the 5.1 checks (anim_checks.py) over a sprite's generated frames, plus lock files and the calibration table
(docs/ENEMY_ANIM_PLAN.md 5.1). Used by monster_anim.py check / review / lock and by the monsters_ai build.

`efix_gates` (docs/ENEMY_ANIM_ISSUES.md, revision 1) switches the wave-0 checks F3 (fx-mask integrity), F4 (intra-
part crease), F5 (foot release) and F7 (prop attached) on: `monster_anim.py check / review` and, since V.3, the build
(monster_atlas.sprite_frames) pass True. F1 (fx exclusion in check 6) is strict with the gates on; with them off (only
the selftests turn them off) it can only relax check 6."""
from __future__ import annotations

import json

import numpy as np
from PIL import Image

from gen import anim_checks as C
from gen import anim_efix as E
from gen import anim_feet as AF
from gen import monster_anim as MA


def palette(keyframes: dict[str, Image.Image]) -> set:
    """Union of the source keyframe files' colours (bosses have one 16-colour palette per pose file) plus OUTLINE."""
    cols = {C.OUTLINE}
    for im in keyframes.values():
        a = np.asarray(im.convert("RGBA"))
        cols |= {tuple(int(v) for v in c) for c in np.unique(a[a[..., 3] > 0][:, :3], axis=0)}
    return cols


def _per_foot(f: dict) -> dict | None:
    """Part-label maps for the per-foot feet check (frame, pixel source, target keyframe), or None (no rig labels). A
    translated frame's own labels are moved back by its shift (rooted `translate`), like its pixels in frame_checks."""
    if f.get("labels") is None or f.get("src_labels") is None or not f.get("foot_parts"):
        return None                                        # FW-6: a feetless body (blob) is judged on the whole band
    return {"frame": AF.unshift(f["labels"], f.get("shift")), "src": f["src_labels"], "toward": f.get("toward_labels"),
            "parts": f["foot_parts"]}


def _efix(name: str, f: dict, meta: dict) -> list[str]:
    """Wave-0 frame checks F4, F7, F5 (labelled frames only)."""
    if f.get("labels") is None:
        return []
    a, lab = f["img"], f["labels"]
    out = E.crease(a, lab, a.shape[0], f.get("names")) + E.prop_attached(lab, f.get("grips") or {}, f.get("names"))
    if f.get("contact") is not None and name not in AF.REAR:
        out += AF.released_feet(AF.unshift(a, f.get("shift")), AF.unshift(lab, f.get("shift")), f["src_labels"],
                                f["foot_parts"], meta["bottom_row"])
    return out


def _silhouette(f: dict, a, S, T, cell_h: int, efix_gates: bool) -> list[str]:
    """Check 6 area / height with F1 (fx parts and their own outline left out of frame, source and target). With the
    gates off (the build until V.3) F1 can only relax the check: the plain or the fx-excluded variant passing is enough."""
    excl = tuple(E.fx_exclusion(m, f.get("fx") or []) for m in (f["labels"], f.get("src_labels"), f.get("toward_labels")))
    sy = (f.get("squash") or (1.0, 1.0, 0))[1]
    strict = C.silhouette(a, S, T, f["u"], cell_h, excl, sy)
    if efix_gates or not strict:
        return strict
    plain = C.silhouette(a, S, T, f["u"], cell_h, None, sy)
    return [] if not plain else strict


def frame_checks(name: str, f: dict, arrs: dict[str, np.ndarray], gen: dict[str, dict], meta: dict, allowed: set,
                 efix_gates: bool = True) -> list[str]:
    a = f["img"]
    S = arrs[f["src"]]
    T = gen[f["toward"]]["img"] if f["toward"] in gen else arrs[f["toward"]]
    cell_h = a.shape[0]
    a0 = AF.unshift(a, f.get("shift"))                    # rooted translate: holes and feet judged as if unmoved
    out = C.binary_alpha(a) + C.palette_lock(a, allowed) + C.magenta(a) + C.detached(a, S) + \
        C.new_holes(a0, S, 4, AF.unshift(f["labels"], f.get("shift")))
    if f["labels"] is not None:
        out += C.seam_gaps(a, f["labels"], f.get("seam_tolerance", 0), f.get("pairs"))
    out += _silhouette(f, a, S, T, cell_h, efix_gates) + C.outline_kept(a, S)
    floating = bool(meta.get("floating") or f.get("floating"))       # FW-1: the float band replaces the feet check
    out += C.feet(a0, S, T, f["u"], meta["bottom_row"], f["pinned"], floating,
                  1 if name == "idle_b" else int(f.get("dy", 0)) if floating else 0, f.get("contact"), _per_foot(f),
                  f.get("squash"))
    out += C.clipping(a) + C.rotation_cap(f["rots"], f.get("rot_cap")) + C.whole_pixel(f["joints"])
    if name != "idle_b":
        out += C.near_keyframe(f["u"])
    if name == "hurt_in2":
        for p in f.get("carried", []):
            out += C.prop_carry(gen.get("hurt_in1", {}).get("prop_px", {}).get(p, 0), f["prop_px"].get(p, 0))
    return out + (_efix(name, f, meta) if efix_gates else [])


def mask_report(cfg: dict, keyframes: dict[str, Image.Image]) -> tuple[dict[str, list[str]], dict[str, dict]]:
    """F3 per keyframe: ({keyframe: fx-mask failures}, {keyframe: {part: overlap}} of the non-fx masks, report only)."""
    from gen import rig as R
    rig = R.Rig(cfg, keyframes["idle"].size)
    kinds = {p: d["kind"] for p, d in rig.parts.items()}
    fails, overlap = {}, {}
    for kf, im in keyframes.items():
        if kf not in rig.keyframes:
            continue
        arr = np.asarray(im.convert("RGBA"))
        lab, names = R.segment(rig, kf, arr)
        fails[kf], ov = E.mask_integrity(cfg.get("masks") or {}, kinds, kf, lab, names, arr[..., 3] > 0)
        if ov:
            overlap[kf] = ov
    return fails, overlap


def check_sprite(sprite: str, cfg: dict, keyframes: dict[str, Image.Image], meta: dict,
                 gen: dict[str, dict] | None = None, with_lock: bool = True, efix_gates: bool = True) -> dict[str, list[str]]:
    """{frame, keyframe (F3), sequence: [failures]} for a rigged sprite (empty lists = pass)."""
    gen = gen if gen is not None else MA.generate(sprite, cfg, keyframes, meta)
    arrs = {k: np.asarray(v.convert("RGBA")) for k, v in keyframes.items()}
    allowed = palette(keyframes)
    rep = {n: frame_checks(n, f, arrs, gen, meta, allowed, efix_gates) for n, f in gen.items()}
    if efix_gates:
        rep.update(mask_report(cfg, keyframes)[0])
    imgs = {**arrs, **{n: f["img"] for n, f in gen.items()}}
    cell_h = arrs["idle"].shape[0]
    for seq, names in MA.SEQUENCES.items():           # every sequence (daze, heavy too), each step against its span
        if MA.NEEDS.get(seq, "idle") not in arrs:
            continue
        fails = []
        for i, (a, b) in enumerate(zip(names, names[1:])):
            if a in gen or b in gen:                     # a pair of keyframes (holds) is the approved art itself
                span = tuple(arrs[k] for k in MA.span_of(seq, i))
                fails += [f"{a}->{b}: {e}" for e in C.continuity(imgs[MA.resolve(a, imgs)], imgs[MA.resolve(b, imgs)],
                                                                    span, cell_h)]
        rep[f"sequence:{seq}"] = fails
    rep["holds"] = C.holds_cap([h["frame"] for h in cfg.get("holds") or []])
    if with_lock:
        lp = MA.lock_path(sprite)
        lock = json.loads(lp.read_text()) if lp.exists() else {}
        rep["lock"] = C.lock_match({n: f["img"] for n, f in gen.items()}, lock) if lock else [f"no lock file {lp.name}"]
    return rep


def write_lock(sprite: str, gen: dict[str, dict]) -> dict[str, str]:
    lock = {n: C.frame_hash(gen[n]["img"]) for n in sorted(gen)}
    MA.lock_path(sprite).write_text(json.dumps(lock, indent=2, sort_keys=True) + "\n")
    return lock


def calibrate(entries) -> list[tuple[str, str, float, float]]:
    """Per sprite and keyframe pair (idle-attack, idle-hurt, idle-cast): IoU and centroid shift (native px)."""
    rows = []
    for sid, _meta, kfs in entries:
        a = {k: np.asarray(v) for k, v in kfs.items()}
        for s, k in (("idle", "attack"), ("idle", "hurt"), ("idle", "cast"), ("idle", "attack_raise"),
                     ("attack_raise", "attack")):
            if s in a and k in a:
                (x0, y0), (x1, y1) = C.centroid(a[s]), C.centroid(a[k])
                rows.append((sid, f"{s}-{k}", C.iou(a[s], a[k]), float(np.hypot(x1 - x0, y1 - y0))))
    return rows
