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
# Integrator ruling (KT2-A, 2026-11-18; docs/KNEEL_TWEEN_PLAN.md rev 2 section 7, rulings log in 12): the bridge pair
# step kneel_in1 -> kneel_in2 of a `source: ai` rig is the deliberate swap between two drawings inside the 133 ms drop,
# so its `sequence:kneel` centroid cap is 0.65 x the idle-key span; every other step (and the derived path) keeps 0.5.
BRIDGE_SWAP = ("kneel_in1", "kneel_in2")
BRIDGE_SWAP_SHARE = 0.65


def continuity_share(seq: str, a: str, b: str, gen: dict) -> float:
    """The centroid cap's span share for the step a -> b of `seq` (anim_checks.continuity)."""
    swap = seq == "kneel" and (a, b) == BRIDGE_SWAP and all(gen.get(n, {}).get("bridge") for n in BRIDGE_SWAP)
    return BRIDGE_SWAP_SHARE if swap else 0.5


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
    bottom = int(meta["bottom_row"])
    floating = bool(meta.get("floating")) or rig.floating
    idle, key = np.asarray(kfs["idle"].convert("RGBA")), np.asarray(kfs["kneel"].convert("RGBA"))
    if KN.is_ai(cfg):                                 # pass KT: any body (no kneel template needed)
        return ai_checks(sprite, cfg, kfs, meta, gen, allowed, idle, key, bottom, floating)
    tpl = KN.template_of(rig, cfg)
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


def order(frames: list[np.ndarray]) -> list[str]:
    """K-order (pass KT, D-KT4): the opaque heights of idle, kneel_in1, kneel_in2, kneel run one way (+-1 px), so the
    bridge never pops up or down on the way into the kneel."""
    hs = [int(_rows(a).max() - _rows(a).min() + 1) for a in frames]
    s = 1 if hs[-1] >= hs[0] else -1
    bad = [i for i in range(3) if s * (hs[i + 1] - hs[i]) < -1]
    return [f"K-order: heights {hs} (idle, kneel_in1, kneel_in2, kneel) not monotonic"] if bad else []


def ai_checks(sprite: str, cfg: dict, kfs: dict, meta: dict, gen: dict, allowed: set, idle: np.ndarray,
              key: np.ndarray, bottom: int, floating: bool) -> dict[str, list[str]]:
    """D-KT4: the `source: ai` checks. The approved key gets the plain checks (alpha, palette, magenta, outline) plus
    K-ground / K-fit; K-height is reported, never a gate (the user's size ruling: the key was approved as drawn). The
    bridge frames get K-ground / K-fit here and every plain check in monster_check.frame_checks; K-order and K-anchor
    hold the sequence."""
    from PIL import Image
    from gen import monster_anim as MA
    # the key's outline weight is the approved drawing's own (J0 / the review judged it): not compared with the idle
    out = {"kf:kneel": C.binary_alpha(key) + C.palette_lock(key, allowed) + C.magenta(key)
           + ground(key, idle, bottom, floating) + fit(key, bottom)}
    for n in (f for f in KNEEL_FRAMES if f in gen):
        out[n] = ground(gen[n]["img"], idle, bottom, floating) + fit(gen[n]["img"], bottom)
    if all(n in gen for n in IN_BETWEENS):
        out["kneel:order"] = order([idle, gen["kneel_in1"]["img"], gen["kneel_in2"]["img"], key])
    frames = {**{n: v for n, v in kfs.items()}, **{n: Image.fromarray(f["img"]) for n, f in gen.items()}}
    out["kneel:anchor"] = anchors(frames, MA.frames_for("cast" in kfs, "attack_raise" in kfs), meta)
    return out


def bridge_holes(a: np.ndarray, src: np.ndarray, min_px: int = 4) -> list[str]:
    """A bridge frame resizes its one source, so its holes are the source's holes resized: no more holes of >= min_px
    than the source has, and their total area within 1.5x the source's (a resize moves and grows a tail loop, so the
    plain near-and-similar counterpart rule does not apply)."""
    fh = [h[0] for h in C._holes(a) if h[0] >= min_px]
    sh = [h[0] for h in C._holes(src) if h[0] >= min_px]
    if len(fh) > len(sh):
        return [f"new hole: {len(fh)} holes >= {min_px} px > the source's {len(sh)}"]
    return [f"holes {sum(fh)} px > 1.5 x the source's {sum(sh)}"] if sum(fh) > 1.5 * sum(sh) + min_px else []


def bridge_frame(name: str, a: np.ndarray, src: np.ndarray, toward: np.ndarray, u: float, cell_h: int,
                 allowed: set) -> list[str]:
    """D-KT4: the plain checks of a bridge frame (monster_check.frame_checks hands them here). Alpha, palette, magenta,
    no new piece and the outline against its one source drawing; holes per bridge_holes; the opaque area within
    0.85-1.15 of the source's area resized to the frame's bbox (no chunk lost or gained; the plain rule, 0.85-1.15 of
    the source alone, would refuse any squash) and the bbox height within the cell's tolerance of the src -> toward
    lerp at u; nothing on the border; |u| <= 0.35 (kneel_b, the breath, is u 0)."""
    out = C.binary_alpha(a) + C.palette_lock(a, allowed) + C.magenta(a) + C.detached(a, src) + C.outline_kept(a, src)
    out += bridge_holes(a, src)
    hs, ht, hf = (C._rows(x[..., 3] > 0) for x in (src, toward, a))
    ws, wf = (C._rows((x[..., 3] > 0).T) for x in (src, a))
    fa, fs = (int((x[..., 3] > 0).sum()) for x in (a, src))
    want = fs * (hf / max(hs, 1)) * (wf / max(ws, 1))       # the source's area, resized: no chunk lost or gained
    if not 0.85 <= fa / max(want, 1) <= 1.15:
        out.append(f"opaque area {fa / max(want, 1):.2f} of the resized source (0.85-1.15)")
    tol = 4 if cell_h <= 80 else 6 if cell_h <= 128 else 10
    if abs(hf - (hs + (ht - hs) * u)) > tol:
        out.append(f"bbox height {hf} vs lerp {hs + (ht - hs) * u:.1f} (+-{tol})")
    return out + C.clipping(a) + ([] if name == "kneel_b" else C.near_keyframe(u))
