"""Derived kneel key and its in-betweens (docs/KNEEL_PLAN.md 3-5, D-K4 / D-K5 / D-K7 / D-K9 / D-K10).

A rig opts in with a `kneel:` block (`tweaks`, `paint`, `sink`, `variant`, `sampler`, `pins`, `aim`; kneel_templates.py
has the reference). Then:

- `kneel` is a derived key: the idle key re-posed by the body template's joint targets (forward kinematics from the idle
  joints, bone lengths kept), solved by rig.solve at t 1 with the template's pins (a planted foot keeps its IK knee),
  rendered part by part from the idle pixels (rotsprite for any part turned more than ROTSPRITE_ABOVE deg), composited,
  then the block's paint (FW-P rules). monster_anim.load_entries adds it to the sheet's keys (meta `kf_derived:
  {kneel: idle}`, so it is locked as `kf:kneel`); its joints and labels ride in meta["kneel"].
- `kneel_in1` (idle toward kneel, t 0.33), `kneel_in2` (kneel toward idle, t 0.33) and `kneel_b` (the body's idle_b op
  on kneel) are ordinary recipes (monster_recipes.RECIPES) that monster_anim.generate runs once `prepare` has given the
  rig a `kneel` keyframe (joints) and the kneel key's part labels.
- A rig without the block gets nothing: `prepare` returns the same objects and `skip` holds the 3 names out, so every
  frame is byte-identical to a build without this module.
"""
from __future__ import annotations

import copy
import math

import numpy as np
from PIL import Image

from gen import kneel_templates as KT
from gen.kneel_ops import (erase, fit_mask, glow_apply, hem_row, post_frame, robe_fit, robe_frame,  # noqa: F401
                           slump_px, slump_roots)
from gen.kneel_templates import _ang, _wrap, fk, targets, units  # noqa: F401  (the target math, section 4)
from gen.monster_recipes import KNEEL_FRAMES

ROTSPRITE_ABOVE = 30.0           # D-K19: a part turned more than this is sampled with rotsprite
IN_LIMB_CAP = 40.0               # D-K19: kneel_in1 / kneel_in2 limb parts, relative to their pixel source
SINK_PER_80 = 6                  # D-K9: the floaters' runtime sink, native px per 80 px of cell
FIT_ROUNDS = 12                  # ground-line joints are raised until nothing lies below the feet row


def opted(cfg: dict | None) -> bool:
    return isinstance(cfg, dict) and "kneel" in cfg


def block(cfg: dict) -> dict:
    b = cfg.get("kneel") or {}
    if not isinstance(b, dict):
        raise ValueError(f"rig {cfg.get('sprite')}: kneel must be a mapping, not {b!r}")
    bad = sorted(set(b) - set(BLOCK_KEYS))
    if bad:
        raise ValueError(f"rig {cfg.get('sprite')}: unknown kneel keys {bad} ({', '.join(BLOCK_KEYS)})")
    if b.get("prop_cap") is not None and not 0 < float(b["prop_cap"]) <= PROP_CAP_MAX:
        raise ValueError(f"rig {cfg.get('sprite')}: kneel prop_cap {b['prop_cap']!r} is not in (0, {PROP_CAP_MAX:g}]")
    if b.get("sampler", "nearest") not in ("nearest", "rotsprite"):
        raise ValueError(f"rig {cfg.get('sprite')}: kneel sampler {b['sampler']!r} is not nearest or rotsprite")
    return b


# `pins` (K2-0): extra joints held at the idle key in the kneel key and its in-betweens (garland's cape hem).
# `sampler` (K1 addition): one sampler for every part of the kneel key instead of the D-K19 rotsprite-above-30 rule
# (the wolf's folded legs double their outlines under rotsprite: second ring 0.30 against the idle's 0.21)
BLOCK_KEYS = ("tweaks", "paint", "sink", "variant", "sampler", "pins", "aim", "samplers", "turn", "z", "erase",
              "glow", "prop_cap")
PROP_CAP_MAX = 60.0              # K2-0b: a block's `prop_cap` (kneel frames only) never goes past this


def template_of(rig, cfg: dict) -> dict:
    """The rig's template; the block's `pins` (K2-0: e.g. a cape hem on the plain) join the template's, its `aim`
    ({joint: [x, y]}, native px: the bone into the joint points there, length kept) joins the template's targets."""
    b = block(cfg)
    t = KT.template(rig.body, getattr(rig, "preset", None), b.get("variant"), cfg.get("sprite", "?"))
    t = {**t, "pins": [*t.get("pins", []), *b["pins"]]} if b.get("pins") else t
    t = {**t, "turn": {**t.get("turn", {}), **b["turn"]}} if b.get("turn") else t
    return {**t, "aim": {**t.get("aim", {}), **b["aim"]}} if b.get("aim") else t


def squat(rig, tpl: dict, S: dict) -> tuple[dict, list[str]]:
    """Mechanical power-down (D-K11): the deepest root drop with every foot pinned whose leg bones turn at most
    tpl['squat'] degrees (bisection, 14 steps); the head / arm droop is scaled down (1, 0.75 ... 0) until no bone of
    the whole-pixel pose turns more than the preset's 15 deg (rounding turns a short bone a few degrees more)."""
    from gen import rig as R
    pins = [f for f in rig.feet if f in S]
    legs = [(a, b) for h, k, f in rig.limbs for a, b in ((h, k), (k, f)) if a in S and b in S]
    bones = [(rig.parent[j], j) for j in S if rig.parent.get(j) in S]

    def worst(t: dict, dy: float, pairs) -> float:
        J = R.solve(rig, S, fk(rig, S, dy, t), 1.0, "all", pins, 0, None, True)
        return max((abs(math.degrees(_wrap(_ang(J[a], J[b]) - _ang(S[a], S[b])))) for a, b in pairs), default=0.0)
    for k in (1.0, 0.75, 0.5, 0.25, 0.0):
        t = {**tpl, **{key: {j: v * k for j, v in tpl.get(key, {}).items()} for key in ("rel", "down")}}
        lo, hi = 0.0, max(units(S).values()) or 1.0
        for _ in range(14):
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if worst(t, mid, legs) <= tpl["squat"] else (lo, mid)
        if worst(t, lo, bones) <= R.MECH_CAP:
            break
    return fk(rig, S, lo, t), pins


# ───────── the derived key ─────────
def derive(sid: str, cfg: dict, kfs: dict[str, Image.Image], meta: dict) -> dict:
    """{img, labels, joints, rots, lift} of the kneel key, rendered from the idle key."""
    from gen import monster_keys as MK
    from gen import monster_render as MR
    from gen import rig as R
    from gen import rig_render as RR
    cell = kfs["idle"].size
    rig = R.Rig(cfg, cell)
    tpl, b = template_of(rig, cfg), block(cfg)
    S = rig.keyframes["idle"]
    arr = erase(np.asarray(kfs["idle"].convert("RGBA")).copy(), b.get("erase"))
    lab, names = R.segment(rig, "idle", arr)
    pairs = rig.joined_pairs()
    gaps = RR.source_gaps(lab, pairs)
    size, bottom = (cell[1], cell[0]), int(meta["bottom_row"])
    tweaks = {j: [float(v[0]), float(v[1])] for j, v in (b.get("tweaks") or {}).items()}
    dy = slump_px(tpl, arr)
    tried = []                                       # (low row, render) per ground-line lift 0, 1, 2 ... px
    for lift in map(float, range(FIT_ROUNDS)):
        T, pins = squat(rig, tpl, S) if "squat" in tpl else (targets(rig, tpl, S, lift), list(tpl.get("pins", [])))
        J = KT.knees_forward(rig, tpl, R.solve(rig, S, T, 1.0, "all", pins + slump_roots(rig, tpl), dy, tweaks, False))
        layers, rots = [], {}
        for part in (b.get("z") or rig.z_for("idle")):                    # K2-0 block `z`: the kneel key's order
            mask = lab == names.index(part)
            if not rig.present(part, "idle") or not mask.any():
                continue
            deg = R.part_rotation(rig, part, "idle", S, J)
            mech = getattr(rig, "preset", None) == "mechanical"           # FW-5: the preset is nearest only
            own = (b.get("samplers") or {}).get(part) or ("rotsprite" if b.get("prop_cap") and        # K2-0b
                                                          rig.parts[part]["kind"] == "prop" else None)
            if own and lift == 0 and b.get("prop_cap") and rig.parts[part]["kind"] == "prop" and abs(deg) > 30:
                print(f"kneel: {sid} prop {part} turns {deg:.1f} deg (prop_cap {b['prop_cap']}, rotsprite)")
            # K2-0 `samplers`: per part (a
            sampler = own or (rig.sampler if mech else b.get("sampler") or (    # mechanical key part too, ruling)
                "rotsprite" if abs(deg) > ROTSPRITE_ABOVE else rig.sampler))
            rgba, hit, emp, rots[part] = MR.render_part(rig, part, "idle", arr, mask, J, size, gaps, False, 1.0, sampler)
            layers.append((list(rig.parts).index(part), rgba, hit, emp))
        img, labels = robe_fit(rig, tpl, *RR.composite(layers, size, pairs), S, J, hem_row(rig, lab))   # K2-0 robed
        rows = np.nonzero(((img[..., 3] > 0) & fit_mask(rig, tpl, labels)).any(1))[0]
        tried.append((int(rows.max()) if len(rows) else bottom, (img, labels, J, rots, lift)))
        if tried[-1][0] == bottom or not tpl.get("ground"):
            break
    # the lowest lift standing on the feet row, else the lowest one above it (K-ground then reports it), else the last
    low, (img, labels, J, rots, lift) = next((t for t in tried if t[0] == bottom), None) or \
        next((t for t in tried if t[0] < bottom), tried[-1])
    img = MK.kneel_paint(sid, b.get("paint"), glow_apply(b.get("glow"), "kneel", img, sid), kfs)   # K2-0b glow
    return {"img": img, "labels": labels, "joints": J, "rots": rots, "lift": lift}


def add_key(sid: str, cfg: dict | None, meta: dict, kfs: dict[str, Image.Image]) -> tuple[dict, dict]:
    """load_entries hook: an opted rig's sheet gains the `kneel` key (meta kf_derived kneel: idle, meta kneel = the
    derivation); any other sheet comes back unchanged (the same objects)."""
    if not opted(cfg):
        return meta, kfs
    d = derive(sid, cfg, kfs, meta)
    return {**meta, "kf_derived": {**meta.get("kf_derived", {}), "kneel": "idle"}, "kneel": d}, \
        {**kfs, "kneel": Image.fromarray(d["img"], "RGBA")}


def extend_cfg(cfg: dict, joints: dict, pins: list[str]) -> dict:
    """The rig with a `kneel` keyframe: its joints, every per-keyframe part entry and z order copied from idle, and the
    template pins for the kneel in-betweens (a rig's frames.kneel_in*.pins wins)."""
    c = copy.deepcopy(cfg)
    c.setdefault("keyframes", {})["kneel"] = {j: [v[0], v[1]] for j, v in joints.items()}
    for p in (c.get("parts") or {}).values():
        for key in ("bone", "chain"):
            if isinstance(p.get(key), dict) and "idle" in p[key]:
                p[key]["kneel"] = p[key]["idle"]
        if isinstance(p.get("in"), list) and "idle" in p["in"]:
            p["in"] = [*p["in"], "kneel"]
    if "idle" in (c.get("z") or {}):
        c["z"]["kneel"] = c["z"]["idle"]
    if (c.get("kneel") or {}).get("z"):
        c.setdefault("z", {})["kneel"] = list(c["kneel"]["z"])
    if c.get("frames") is None:
        c["frames"] = {}
    frames = c["frames"]
    for n in ("kneel_in1", "kneel_in2"):
        frames[n] = {"pins": list(pins), **(frames.get(n) or {})}
    return c


def leg_lerp(rig, c: dict, name: str) -> dict:
    """The frame's tweaks plus, for every unpinned leg joint (knees, feet, toes), the step from its angle-space place to
    its straight position lerp: an angle lerp swings a folding leg through the ground; a position lerp folds it."""
    from gen import monster_anim as MA
    from gen import monster_recipes as MR
    from gen import rig as R
    r, over = MR.RECIPES[name], c["frames"][name]
    S, T, u = rig.keyframes[r["src"]], rig.keyframes[r["toward"]], MA.recipe_u(name, c)
    own = {j: [float(v[0]), float(v[1])] for j, v in (over.get("tweaks") or {}).items()}
    pins = set(over.get("pins", []))
    J = R.solve(rig, S, T, u, "all", list(pins), 0, own, False, MA.half_joints(rig, name, c))
    toes = KT.TOES.get(rig.body, {})
    legs = [j for _, k, f in rig.limbs for j in (k, f, toes.get(f)) if j and j in S and j in T and j not in pins]
    out = dict(own)
    for j in legs:
        want = (S[j][0] + (T[j][0] - S[j][0]) * u + own.get(j, [0, 0])[0], S[j][1] + (T[j][1] - S[j][1]) * u
                + own.get(j, [0, 0])[1])
        out[j] = [own.get(j, [0, 0])[0] + round(want[0] - J[j][0]), own.get(j, [0, 0])[1] + round(want[1] - J[j][1])]
    return out


def prepare(sid: str, cfg: dict, kfs: dict[str, Image.Image], meta: dict) -> tuple[dict, dict, dict]:
    """generate hook: (cfg, keys, {kneel: (labels, part names)}); unchanged objects and {} for a rig without the block."""
    if not opted(cfg):
        return cfg, kfs, {}
    from gen import rig as R
    if "kneel" not in kfs or "kneel" not in meta:
        meta, kfs = add_key(sid, cfg, {k: v for k, v in meta.items() if k != "kneel"}, kfs)
    d = meta["kneel"]
    rig0 = R.Rig(cfg, kfs["idle"].size)
    tpl = template_of(rig0, cfg)
    pins = [f for f in rig0.feet if f in rig0.keyframes["idle"]] if "squat" in tpl else list(tpl.get("pins", []))
    pins = [p for p in pins if p not in tpl.get("free_in", [])] + slump_roots(rig0, tpl)
    c = extend_cfg(cfg, d["joints"], pins)
    rig = R.Rig(c, kfs["idle"].size)
    for n in ("kneel_in1", "kneel_in2"):
        c["frames"][n]["tweaks"] = leg_lerp(rig, c, n)
    names = list(rig.parts)
    lab = d["labels"].copy()
    near, _ = R.segment(rig, "kneel", d["img"])
    fix = (d["img"][..., 3] > 0) & (lab < 0)
    lab[fix] = near[fix]
    lab[d["img"][..., 3] == 0] = -1
    return c, kfs, {"kneel": (lab, names)}


def skip(kfs: dict) -> set[str]:
    """The kneel names generate leaves out: `kneel` itself (a key), and all four for a sheet without the kneel key."""
    return {"kneel"} if "kneel" in kfs else set(KNEEL_FRAMES)


def sink_px(cfg: dict, cell_h: int) -> int:
    """D-K9: a floater's runtime kneelSink (native px): the block's `sink`, else 6 px per 80 px of cell."""
    v = block(cfg).get("sink")
    return int(v) if v is not None else max(1, int(SINK_PER_80 * cell_h / 80 + 0.5))
