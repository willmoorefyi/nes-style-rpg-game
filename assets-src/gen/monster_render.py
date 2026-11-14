"""Per-part rendering of a monster in-between (docs/ENEMY_ANIM_PLAN.md 4.2), split out of monster_anim.generate:
carried props, chain / cloth mesh warps, rigid parts (nearest or rotsprite), plus the wave-0 frame options
(docs/ENEMY_ANIM_ISSUES.md F2): a per-frame part `scale` for fx parts and a per-frame `sampler` override.

  frames.<frame>.scale: {part: s}      # 0.25 <= s <= 1, kind fx only; rendered by rotsprite (mode sampling) about
                                       # the part's first joint; s = 1 takes the unscaled code path unchanged
  frames.<frame>.sampler: rotsprite    # or nearest; overrides the rig's `sampler` for the rigid parts of that frame
"""
from __future__ import annotations

import math

import numpy as np

SAMPLERS = ("nearest", "rotsprite")
MIN_SCALE = 0.25


def warp_width(d: dict, mask: np.ndarray, chain: list) -> float:
    """Half-width of a chain / cloth part's warp quads: `width` (a number, or `auto` = every masked pixel inside the
    quads), else the segmentation radius (the biped default)."""
    from gen import rig as R
    if d.get("width") != "auto":
        return float(d.get("width", d["radius"]))
    ys, xs = np.nonzero(mask)
    px = np.stack([xs, ys], 1).astype(float)
    return float(np.min([R._seg_dist(px, a, b) for a, b in zip(chain, chain[1:])], 0).max()) + 1.5


def frame_options(rig, name: str, over: dict) -> tuple[dict[str, float], str]:
    """({part: scale}, sampler) of one frame; a bad value raises ValueError naming the rig and frame."""
    who = f"rig {rig.cfg.get('sprite')} frame {name}"
    sampler = over.get("sampler", rig.sampler)
    if sampler not in SAMPLERS:
        raise ValueError(f"{who}: sampler {sampler!r} is not one of {SAMPLERS}")
    scales = {}
    for part, s in (over.get("scale") or {}).items():
        if part not in rig.parts:
            raise ValueError(f"{who}: scale names unknown part {part!r}")
        if rig.parts[part]["kind"] != "fx":
            raise ValueError(f"{who}: scale on {part!r} (kind {rig.parts[part]['kind']}); only kind fx parts scale")
        if not MIN_SCALE <= float(s) <= 1.0:
            raise ValueError(f"{who}: scale {part} {s} outside {MIN_SCALE}-1")
        scales[part] = float(s)
    return scales, sampler


def render_part(rig, part: str, kf: str, arr: np.ndarray, mask: np.ndarray, J: dict, size, gaps: np.ndarray,
                carried: bool, scale: float = 1.0, sampler: str = "nearest"):
    """One part of a frame from its source keyframe `kf`: (rgba, hit, mapped source gaps, (rotation deg, kind))."""
    from gen import rig as R
    from gen import rig_render as RR
    d = rig.parts[part]
    sj = rig.keyframes[kf]
    js = rig.joints_of(part, kf)
    if carried:
        to = d["carry_to"]
        par = rig.parent[to]
        rot = R._wrap(R._ang(J[par], J[to]) - R._ang(rig.keyframes["idle"][par], rig.keyframes["idle"][to]))
        if d.get("carry_mode") == "truncate":
            a, b = np.asarray(sj[js[0]]), np.asarray(sj[js[-1]])
            ys, xs = np.nonzero(mask)
            t = ((np.stack([xs, ys], 1) - a) @ (b - a)) / max(float((b - a) @ (b - a)), 1e-9)
            mask[ys[t < 0.5], xs[t < 0.5]] = False
        rgba, hit, emp = RR.rigid(arr, mask, sj[js[0]], J[to], rot, size, gaps)
        return rgba, hit, emp, (math.degrees(rot), "prop")
    if d["kind"] in ("chain", "cloth"):
        rgba, hit, emp = RR.mesh_warp(arr, mask, [sj[j] for j in js], [J[j] for j in js],
                                      warp_width(d, mask, [sj[j] for j in js]), size, gaps)
        return rgba, hit, emp, (R.part_rotation(rig, part, kf, sj, J), d["kind"])
    rot = math.radians(R.part_rotation(rig, part, kf, sj, J))
    if scale != 1.0:                                       # F2: mode-sampled shrink, palette-locked, binary alpha
        rgba, hit, emp = RR.rotsprite(arr, mask, sj[js[0]], J[js[0]], rot, size, gaps, scale=scale)
    else:
        fn = RR.rotsprite if sampler == "rotsprite" else RR.rigid
        rgba, hit, emp = fn(arr, mask, sj[js[0]], J[js[0]], rot, size, gaps)
    return rgba, hit, emp, (math.degrees(rot), d["kind"])


def check_info(rig, kf: str, carried: list[str]) -> dict:
    """Check-only facts of a frame cut from keyframe `kf`: fx part indices (F1 / F3) and, per prop that is not carried,
    the indices of its grip parts (F7: the non-prop, non-fx parts holding the prop's first joint, else its parent)."""
    names = list(rig.parts)
    fx = [i for i, p in enumerate(names) if rig.parts[p]["kind"] == "fx"]
    grips = {}
    for p in names:
        if rig.parts[p]["kind"] != "prop" or p in carried or not rig.present(p, kf):
            continue
        j0 = rig.joints_of(p, kf)[0]
        body = [q for q in names if rig.parts[q]["kind"] not in ("prop", "fx") and rig.present(q, kf)]
        for j in (j0, rig.parent.get(j0)):
            g = [names.index(q) for q in body if j in rig.joints_of(q, kf)]
            if g:
                grips[names.index(p)] = g
                break
    return {"fx": fx, "grips": grips, "names": names}
