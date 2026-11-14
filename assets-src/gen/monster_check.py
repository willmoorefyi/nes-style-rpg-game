"""Runs the 5.1 checks (anim_checks.py) over a sprite's generated frames, plus lock files and the calibration table
(docs/ENEMY_ANIM_PLAN.md 5.1). Used by monster_anim.py check / review / lock and by the monsters_ai build."""
from __future__ import annotations

import json

import numpy as np
from PIL import Image

from gen import anim_checks as C
from gen import monster_anim as MA


def palette(keyframes: dict[str, Image.Image]) -> set:
    """Union of the source keyframe files' colours (bosses have one 16-colour palette per pose file) plus OUTLINE."""
    cols = {C.OUTLINE}
    for im in keyframes.values():
        a = np.asarray(im.convert("RGBA"))
        cols |= {tuple(int(v) for v in c) for c in np.unique(a[a[..., 3] > 0][:, :3], axis=0)}
    return cols


def _per_foot(f: dict) -> dict | None:
    """Part-label maps for the per-foot feet check (frame, pixel source, target keyframe), or None (no rig labels)."""
    if f.get("labels") is None or f.get("src_labels") is None:
        return None
    return {"frame": f["labels"], "src": f["src_labels"], "toward": f.get("toward_labels"), "parts": f["foot_parts"]}


def frame_checks(name: str, f: dict, arrs: dict[str, np.ndarray], gen: dict[str, dict], meta: dict, allowed: set) -> list[str]:
    a = f["img"]
    S = arrs[f["src"]]
    T = gen[f["toward"]]["img"] if f["toward"] in gen else arrs[f["toward"]]
    cell_h = a.shape[0]
    out = C.binary_alpha(a) + C.palette_lock(a, allowed) + C.magenta(a) + C.detached(a, S) + C.new_holes(a, S, 4, f["labels"])
    if f["labels"] is not None:
        out += C.seam_gaps(a, f["labels"], f.get("seam_tolerance", 0), f.get("pairs"))
    out += C.silhouette(a, S, T, f["u"], cell_h) + C.outline_kept(a, S)
    out += C.feet(a, S, T, f["u"], meta["bottom_row"], f["pinned"], bool(meta.get("floating")), 1 if name == "idle_b" else 0,
                  f.get("contact"), _per_foot(f))
    out += C.clipping(a) + C.rotation_cap(f["rots"]) + C.whole_pixel(f["joints"])
    if name != "idle_b":
        out += C.near_keyframe(f["u"])
    if name == "hurt_in2":
        for p in f.get("carried", []):
            out += C.prop_carry(gen.get("hurt_in1", {}).get("prop_px", {}).get(p, 0), f["prop_px"].get(p, 0))
    return out


def check_sprite(sprite: str, cfg: dict, keyframes: dict[str, Image.Image], meta: dict,
                 gen: dict[str, dict] | None = None, with_lock: bool = True) -> dict[str, list[str]]:
    """{frame or sequence: [failures]} for a rigged sprite (empty lists = pass)."""
    gen = gen if gen is not None else MA.generate(sprite, cfg, keyframes, meta)
    arrs = {k: np.asarray(v.convert("RGBA")) for k, v in keyframes.items()}
    allowed = palette(keyframes)
    rep = {n: frame_checks(n, f, arrs, gen, meta, allowed) for n, f in gen.items()}
    imgs = {**arrs, **{n: f["img"] for n, f in gen.items()}}
    cell_h = arrs["idle"].shape[0]
    for seq, names in MA.SEQUENCES.items():
        if seq == "cast" and "cast" not in arrs:
            continue
        span = tuple(arrs[k] for k in MA.SPAN[seq])
        fails = []
        for a, b in zip(names, names[1:]):
            if a in gen or b in gen:                     # a pair of keyframes (holds) is the approved art itself
                fails += [f"{a}->{b}: {e}" for e in C.continuity(imgs.get(a, arrs[MA.FRAME_SOURCE.get(a, a)]),
                                                                    imgs.get(b, arrs[MA.FRAME_SOURCE.get(b, b)]), span, cell_h)]
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
        for k in ("attack", "hurt", "cast"):
            if k in a:
                (x0, y0), (x1, y1) = C.centroid(a["idle"]), C.centroid(a[k])
                rows.append((sid, f"idle-{k}", C.iou(a["idle"], a[k]), float(np.hypot(x1 - x0, y1 - y0))))
    return rows
