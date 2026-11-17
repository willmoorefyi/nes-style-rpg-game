"""Kneel templates (docs/KNEEL_PLAN.md 4, D-K4 / D-K11 / D-K18): the joint targets of the derived `kneel` key, per body,
preset and variant, and the target math that reads it (`targets`: forward kinematics from the idle key, bone lengths
kept; kneel.py solves the targets with rig.solve and renders the key).

Lengths are in units of a measured bone of the rig's idle key (`L_thigh`, `L_hindthigh`, `L_upperfore`, `L_neck`, the
mean of the near and far bone where there are two); angles are degrees, `+` = toward the facing (forward / down for a
bone that points up, as monsters face right). Template keys (all optional per template):

- `drop`:     (unit, k) the root (hip) goes down k x unit.
- `rel`:      {joint: deg} the bone into the joint turns by deg (forward-positive), relative to its parent's turn.
- `down`:     {joint: deg} the bone into the joint turns toward straight down by at most deg.
- `lower`:    {joint: (unit, k)} the joint goes k x unit lower than its plain forward-kinematics place (bone length kept:
              only the bone's direction changes).
- `ground`:   {joint: back} the joint goes on the ground line, `back` x L_thigh behind the root (biped) or its parent.
- `dir`:      {joint: deg} the bone into the joint points this absolute way (0 = forward, 90 = down, 180 = back).
- `keep`:     joints whose bone keeps the idle key's absolute angle (a planted foot stays flat).
- `pins`:     joints held at the idle key (with the IK knee); also the kneel in-betweens' pins.
- `squat`:    mechanical: the root drops until a leg bone turns `squat` degrees (every foot pinned; K2-0: 0).
- `band`:     (lo, hi) the kneel / idle opaque-height ratio (K-height).
- `limb_cap`: K-rot's cap on limb parts in the kneel key (in-betweens: kneel.IN_LIMB_CAP).
- K2-0 keys (`back`, `sag`, `slump`, `fit`, `knee_fwd`, `free_in`): kneel_variants.py.

A rig's `kneel:` block adds `tweaks: {joint: [dx, dy]}` (native px), `paint: [...]` (<= monster_keys.KF_PAINT_CAP px),
`sink: n` (floaters), `pins`, `sampler` and `variant: name` or a list of names (kneel_variants.py). Variants are additive
(D-K18): the default template never changes once a rig is locked on it.
"""
from __future__ import annotations

import copy
import math

# biped (46 rigs): far knee down, near foot planted, torso low, head bowed, weapon low; band 0.68-0.85
BIPED = {
    "drop": ("L_thigh", 0.8),
    "rel": {"chest": 10.0, "crown": 5.0},          # the head ends 15 deg down (the chest's 10 plus 5)
    "lower": {"hand_n": ("L_thigh", 0.5), "hand_f": ("L_thigh", 0.5)},
    "down": {"tip": 30.0},
    "ground": {"knee_f": 0.3},
    "dir": {"foot_f": 195.0, "toe_f": 115.0},     # shin back along the ground, toes tucked (ankle up, toe down)
    "keep": ["toe_n"],
    "pins": ["foot_n"],
    "band": (0.68, 0.85),
    "limb_cap": 100.0,
}

# preset mechanical (iron_golem, soldier, warmech; guardian as a quadruped): power-down, every bone <= 15 deg. K2-0:
# a 13 deg leg squat lowered short legs about 1 px (0.98 of the idle height, over the band), so the legs stay
# straight and the body sinks between them rigidly (`slump`); the forearm droop is gone (it tore the plated arms)
MECHANICAL = {
    "squat": 0.0,
    "slump": 0.09,                                 # K2-0: the upper body sinks 9 % of the idle height between the legs
    "rel": {"crown": 13.0, "head": 13.0, "snout": 13.0},
    "band": (0.85, 0.95),
    "limb_cap": 15.0,
}

# quadruped (27 rigs): haunches and forelegs folded, belly low; band 0.60-0.85
QUADRUPED = {
    "drop": ("L_hindthigh", 0.6),
    "lower": {"chest": ("L_upperfore", 0.6), "neck": ("L_neck", 0.5)},
    "ground": {"el_n": 0.2, "el_f": 0.2, "knee_n": 0.0, "knee_f": 0.0},
    "dir": {"paw_n": 0.0, "paw_f": 0.0, "ftoe_n": 0.0, "ftoe_f": 0.0, "foot_n": 0.0, "foot_f": 0.0,
            "toe_n": 0.0, "toe_f": 0.0},
    "rel": {"snout": 15.0, "tail1": 7.0, "tail2": 7.0, "tail_tip": 7.0},   # 21 in all: under the 25 deg chain cap
    "pins": [],
    "band": (0.60, 0.85),
    "limb_cap": 100.0,
}

from gen.kneel_variants import VARIANTS, knees_forward  # noqa: E402,F401  (K2-0 split)

TEMPLATES = {"biped": BIPED, "quadruped": QUADRUPED}
# limb chains per body for K-rot: the joints after each limb root, plus the toes hanging from the last one
TOES = {"biped": {"foot_n": "toe_n", "foot_f": "toe_f"},
        "quadruped": {"paw_n": "ftoe_n", "paw_f": "ftoe_f", "foot_n": "toe_n", "foot_f": "toe_f"}}


def merge(base: dict, add: dict) -> dict:
    """base with add's keys (dict values merged one level deep, others replaced; a None value, at either level, drops
    the key: a variant can take a default target away)."""
    out = dict(base)
    for k, v in add.items():
        if v is None:
            out.pop(k, None)
        elif isinstance(v, dict) and isinstance(base.get(k), dict):
            out[k] = {j: w for j, w in {**base[k], **v}.items() if w is not None}
        else:
            out[k] = v
    return out


def template(body: str, preset: str | None = None, variant: str | None = None, sprite: str = "?") -> dict:
    """The kneel template of a rig (ValueError naming the rig for a body, preset or variant with none yet)."""
    if body not in TEMPLATES:
        raise ValueError(f"rig {sprite}: no kneel template for body {body!r} yet "
                         f"(K1 has {', '.join(sorted(TEMPLATES))}; the other bodies come in K3-0)")
    t = TEMPLATES[body]
    if preset == "mechanical":
        t = {**MECHANICAL, "pins": [], "body": body}
    elif preset is not None:
        raise ValueError(f"rig {sprite}: no kneel template for preset {preset!r}")
    for v in ([] if variant is None else [variant] if isinstance(variant, str) else list(variant)):
        if (body, v) not in VARIANTS:                # K2-0: a list of variants merges in order
            raise ValueError(f"rig {sprite}: kneel variant {v!r} is not one of "
                             f"{sorted(n for b, n in VARIANTS if b == body)} (body {body})")
        t = merge(t, VARIANTS[(body, v)])
    return t


# ───────── targets ─────────
def _d(a, b) -> float:
    return math.hypot(b[0] - a[0], b[1] - a[1])


def _ang(a, b) -> float:
    return math.atan2(b[1] - a[1], b[0] - a[0])


def _wrap(a: float) -> float:
    return (a + math.pi) % (2 * math.pi) - math.pi


def units(S: dict) -> dict[str, float]:
    """The template's length units, measured on the idle joints (mean of near and far where both exist)."""
    def mean(pairs):
        ls = [_d(S[a], S[b]) for a, b in pairs if a in S and b in S]
        return sum(ls) / len(ls) if ls else 0.0
    return {"L_thigh": mean([("hip_n", "knee_n"), ("hip_f", "knee_f")]),
            "L_hindthigh": mean([("hip_n", "knee_n"), ("hip_f", "knee_f")]),
            "L_upperfore": mean([("sh_n", "el_n"), ("sh_f", "el_f")]),
            "L_neck": mean([("chest", "neck")]) + mean([("neck", "head")])}


def fk(rig, S: dict, dy: float, spec: dict, pos: dict | None = None) -> dict:
    """Forward kinematics from the idle joints: roots down by dy, each bone turned per the spec (rel / down / keep / dir)
    or aimed at pos[j]; bone lengths from S. Angles are forward-positive degrees (mirrored for a left-facing rig)."""
    f, pos = rig.fwd, pos or {}
    rel, down, keep, dirs = spec.get("rel", {}), spec.get("down", {}), set(spec.get("keep", [])), spec.get("dir", {})
    sag = spec.get("sag", {})
    bx = units(S)[spec["back"][0]] * spec["back"][1] if spec.get("back") else 0.0
    T, acc = {}, {}
    for j in rig.order:
        if j not in S:
            continue
        p = rig.parent.get(j)
        if p is None or p not in T:
            T[j], acc[j] = (S[j][0] - f * bx, S[j][1] + dy), 0.0
            continue
        a0 = _ang(S[p], S[j])
        if j in pos:
            a = _ang(T[p], pos[j])
        elif j in dirs:
            d = math.radians(dirs[j])
            a = math.atan2(math.sin(d), f * math.cos(d))
        elif j in keep:
            a = a0
        elif j in sag:                               # K2-0: the idle angle toward down by deg, whatever the parent did
            cap = math.radians(sag[j]) if f * math.cos(a0) > 0 else 0.0
            a = a0 + max(-cap, min(cap, _wrap(math.pi / 2 - a0)))
        else:
            a = a0 + acc[p] + f * math.radians(rel.get(j, 0.0))
            if j in down:
                cap = math.radians(down[j])
                a += max(-cap, min(cap, _wrap(math.pi / 2 - a)))
        acc[j] = _wrap(a - a0)
        L = _d(S[p], S[j])
        T[j] = (T[p][0] + L * math.cos(a), T[p][1] + L * math.sin(a))
    return T


def _heads(rig, tpl: dict) -> dict:
    """The multihead variant: every extra neck / head copies the first one's targets."""
    if not tpl.get("multihead"):
        return tpl
    t = copy.deepcopy(tpl)
    for i in (2, 3, 4, 5):
        if f"neck{i}" in rig.parent:
            for key, src in (("lower", "neck"), ("rel", "snout"), ("sag", "neck"), ("sag", "head"), ("sag", "snout")):
                if src in t.get(key, {}):
                    t[key][f"{src}{i}"] = t[key][src]
    return t


def targets(rig, tpl: dict, S: dict, lift: float = 0.0) -> dict:
    """Target joints of the kneel key (before rig.solve), `lift` px raising the ground line."""
    tpl = _heads(rig, tpl)
    U = units(S)
    unit, k = tpl.get("drop", ("L_thigh", 0.0))
    dy = U[unit] * k
    first = fk(rig, S, dy, tpl)
    ground = max((S[f][1] for f in rig.feet if f in S), default=0.0) - lift
    pos = {j: (first[j][0], first[j][1] + U[u] * k) for j, (u, k) in tpl.get("lower", {}).items() if j in first}
    for j, back in tpl.get("ground", {}).items():   # on the ground line at bone length, the side nearest `back` x L
        p = rig.parent.get(j)                        # behind the parent (the hip socket, the shoulder)
        if j not in S or p not in first:
            continue
        L, h = _d(S[p], S[j]), ground - first[p][1]
        want = first[p][0] - rig.fwd * back * L
        if abs(h) >= L:
            pos[j] = (first[p][0], first[p][1] + math.copysign(L, h))
            continue
        w = math.sqrt(L * L - h * h)
        pos[j] = (min((first[p][0] - w, first[p][0] + w), key=lambda x: abs(x - want)), ground)
    return fk(rig, S, dy, tpl, pos)
