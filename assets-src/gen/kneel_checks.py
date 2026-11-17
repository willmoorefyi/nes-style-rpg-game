"""K-checks for the kneel frames (docs/KNEEL_PLAN.md 7, D-K8 / D-K10 / D-K19). Pure functions on RGBA arrays returning
failure lists (empty = pass), plus `check_sprite`, which monster_check.check_sprite calls for an opted-in rig.

- K-ground: grounded bodies keep the lowest opaque row on the feet row in all 4 kneel frames, with at least half the
  idle's pixels in the bottom 2 rows; a floater keeps the idle's lowest row.
- K-height: the kneel / idle opaque-height ratio inside the body band (kneel and kneel_b).
- K-rot: the kneel key's limb parts <= the template's limb cap (100, mechanical 15), the in-betweens' <= 40, every
  other part <= anim_rules.ROT_CAP (and the mechanical 15 cap).
- K-fit: nothing below the feet row (the 2 px bottom margin) or on the cell border.
- K-anchor: the sheet's homeX, idleBox, travelTop, lungeRight, head, lungePx and opaqueRight equal those of the same
  frames without the kneel ones.
- K-lock: `lock_delta` (kneel_tools.py lockdiff): an existing lock entry may never change or go.
The plain checks (alpha, palette, magenta, pieces, holes, seams, outline, continuity, near-keyframe, F3/F4/F7) run on
the in-betweens in monster_check.frame_checks as on every frame; the kneel key gets them here.
"""
from __future__ import annotations

import numpy as np

from gen import anim_checks as C
from gen import kneel as KN
from gen.anim_rules import ROT_CAP
from gen.monster_recipes import KNEEL_FRAMES

IN_BETWEENS = ("kneel_in1", "kneel_in2")


def _rows(a: np.ndarray) -> np.ndarray:
    return np.nonzero((a[..., 3] > 0).any(1))[0]


def ground(a: np.ndarray, idle: np.ndarray, bottom: int, floating: bool = False) -> list[str]:
    ra, ri = _rows(a), _rows(idle)
    if not len(ra):
        return ["K-ground: empty frame"]
    if floating:
        return [] if ra.max() == ri.max() else [f"K-ground: lowest row {ra.max()} != the idle's {ri.max()} (floating)"]
    if ra.max() != bottom:
        return [f"K-ground: lowest opaque row {ra.max()} != feet row {bottom}"]
    n, m = int((a[bottom - 1:bottom + 1, :, 3] > 0).sum()), int((idle[bottom - 1:bottom + 1, :, 3] > 0).sum())
    return [] if n >= 0.5 * m else [f"K-ground: {n} px in the bottom 2 rows < half the idle's {m}"]


def height(a: np.ndarray, idle: np.ndarray, band: tuple[float, float]) -> list[str]:
    ra, ri = _rows(a), _rows(idle)
    r = (ra.max() - ra.min() + 1) / max(int(ri.max() - ri.min() + 1), 1) if len(ra) and len(ri) else 0.0
    lo, hi = band
    return [] if lo - 1e-9 <= r <= hi + 1e-9 else [f"K-height: kneel / idle height {r:.3f} outside {lo:.2f}-{hi:.2f}"]


def ratio(a: np.ndarray, idle: np.ndarray) -> float:
    ra, ri = _rows(a), _rows(idle)
    return float((ra.max() - ra.min() + 1) / max(int(ri.max() - ri.min() + 1), 1))


def limb_parts(rig) -> set[str]:
    """Parts on a limb: every joint of the bone after a limb root is a limb joint (IK chains, arms, toes)."""
    from gen import kneel_templates as KT
    roots = {h for h, _, _ in rig.limbs} | {f"sh_{s}" for s in rig.arms}
    joints = {j for _, k, f in rig.limbs for j in (k, f)} | {j for s in rig.arms for j in (f"el_{s}", f"hand_{s}")}
    joints |= {t for f, t in KT.TOES.get(rig.body, {}).items() if f in joints}
    out = set()
    for p, d in rig.parts.items():
        js = rig.joints_of(p, "idle")
        if d["kind"] not in ("prop", "fx") and js and js[0] in roots | joints and all(j in joints for j in js[1:]):
            out.add(p)
    return out


def rot(rots: dict, limbs: set[str], limb_cap: float, cap: float | None = None, legs_free: bool = False,
        prop_cap: float | None = None) -> list[str]:
    """K-rot: {part: (deg, kind)} against the limb cap (limb parts) or ROT_CAP (the rest), both <= cap if given
    (K2-0 `legs_free`, the mech_kneel variant: limb parts take only the limb cap, the rest keeps the preset's;
    K2-0b `prop_cap`, a kneel block key: prop parts take it instead of ROT_CAP's 30, at most kneel.PROP_CAP_MAX)."""
    bad = []
    for p, (d, k) in sorted(rots.items()):
        lim = limb_cap if p in limbs else float(prop_cap) if prop_cap and k == "prop" else \
            ROT_CAP.get("torso" if p == "torso" else k, 30.0)                     # K2-0b block prop_cap
        lim = min(lim, cap) if cap and not (legs_free and p in limbs) else lim
        if abs(d) > lim + 1e-9:
            bad.append(f"{p} {d:.1f} deg > {lim:g}")
    return [f"K-rot: {', '.join(bad)}"] if bad else []


def fit(a: np.ndarray, bottom: int) -> list[str]:
    low = a[bottom + 1:, :, 3] > 0
    out = [f"K-fit: {int(low.sum())} px below the feet row {bottom}"] if low.any() else []
    return out + [f"K-fit: {e}" for e in C.clipping(a)]


def lock_delta(old: dict[str, str], new: dict[str, str]) -> tuple[list[str], list[str], list[str]]:
    """K-lock: (added, changed, removed) entry names from one lock file to the next."""
    return (sorted(set(new) - set(old)), sorted(n for n in set(old) & set(new) if old[n] != new[n]),
            sorted(set(old) - set(new)))


def anchors(frames: dict, names: list[str], meta: dict, ranged: bool = False) -> list[str]:
    """K-anchor: the sheet's anchor fields with and without the kneel frames."""
    from gen import monster_anim as MA
    from gen import monster_atlas as MAT
    keys = ("homeX", "idleBox", "travelTop", "lungeRight", "head", "lungePx", "opaqueRight")
    plain = {n: f for n, f in frames.items() if n not in KNEEL_FRAMES}
    m = [MAT.sheet_meta(meta, fr, names, {}, [], True, MA.lunge_px(fr["idle"]), 0, ranged) for fr in (frames, plain)]
    bad = [k for k in keys if m[0].get(k) != m[1].get(k)]
    return [f"K-anchor: {k} {m[0].get(k)} != {m[1].get(k)} without the kneel frames" for k in bad]


def check_sprite(sprite: str, cfg: dict, kfs: dict, meta: dict, gen: dict, allowed: set) -> dict[str, list[str]]:
    """{frame: K-check failures} (plus `kf:kneel`, the key's plain checks) for an opted-in rig; {} otherwise."""
    if not KN.opted(cfg) or "kneel" not in kfs:
        return {}
    from PIL import Image
    from gen import monster_anim as MA
    from gen import rig as R
    rig = R.Rig(cfg, kfs["idle"].size)
    tpl, bottom = KN.template_of(rig, cfg), int(meta["bottom_row"])
    floating = bool(meta.get("floating")) or rig.floating
    idle, key = np.asarray(kfs["idle"].convert("RGBA")), np.asarray(kfs["kneel"].convert("RGBA"))
    d = meta.get("kneel") or KN.derive(sprite, cfg, kfs, meta)
    limbs, cap = limb_parts(rig), rig.rot_cap
    out = {"kf:kneel": C.binary_alpha(key) + C.palette_lock(key, allowed) + C.magenta(key) + C.detached(key, idle)
           + C.new_holes(key, idle, 4, d["labels"]) + C.seam_gaps(key, d["labels"], int(cfg.get("seam_tolerance", 0)),
                                                                  rig.joined_pairs())
           + C.outline_kept(key, idle) + C.whole_pixel(d["joints"])
           + rot(d["rots"], limbs, tpl["limb_cap"], cap, bool(tpl.get("legs_free")), KN.block(cfg).get("prop_cap"))}
    for n in ("kneel", *[f for f in KNEEL_FRAMES if f in gen]):
        a = key if n == "kneel" else gen[n]["img"]
        k = "kf:kneel" if n == "kneel" else n
        out.setdefault(k, [])
        out[k] += ground(a, idle, bottom, floating) + fit(a, bottom)
        if n in ("kneel", "kneel_b"):
            out[k] += height(a, idle, tpl["band"])
        if n in IN_BETWEENS:
            out[k] += rot(gen[n]["rots"], limbs, KN.IN_LIMB_CAP, cap, bool(tpl.get("legs_free")),
                          KN.block(cfg).get("prop_cap"))
    frames = {**{n: v for n, v in kfs.items()}, **{n: Image.fromarray(f["img"]) for n, f in gen.items()}}
    out["kneel:anchor"] = anchors(frames, MA.frames_for("cast" in kfs, "attack_raise" in kfs), meta)
    return out
