"""Kneel templates (docs/KNEEL_PLAN.md 4, D-K4 / D-K11 / D-K18): the joint targets of the derived `kneel` key, per body,
preset and variant. Pure data; kneel.py turns it into target joints (forward kinematics from the idle key, bone lengths
kept) and solves them with rig.solve.

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
- `squat`:    the mechanical power-down: the root drops until a leg bone turns `squat` degrees (every foot pinned).
- `band`:     (lo, hi) the kneel / idle opaque-height ratio (K-height).
- `limb_cap`: K-rot's cap on limb parts in the kneel key (in-betweens: kneel.IN_LIMB_CAP).

A rig's `kneel:` block adds `tweaks: {joint: [dx, dy]}` (after the template, px per 80 px of cell are NOT scaled: native
px), `paint: [...]` (<= monster_keys.KF_PAINT_CAP px, approved palette or null), `sink: n` (floaters, runtime only) and
`variant: name`. Variants are additive (D-K18): a variant only adds keys or overrides them, and the default template
never changes once a rig is locked on it.
"""
from __future__ import annotations

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

# preset mechanical (iron_golem, soldier, warmech; guardian as a quadruped): power-down squat, every bone <= 15 deg
MECHANICAL = {
    "squat": 13.0,
    "rel": {"crown": 13.0, "head": 13.0, "snout": 13.0},
    "down": {"el_n": 13.0, "el_f": 13.0, "hand_n": 13.0, "hand_f": 13.0},
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

# additive variants (D-K18): a rig opts in with kneel: {variant: <name>}
VARIANTS = {
    # K1 pilot (goblin): a short-legged biped whose 0.8 L_thigh drop leaves the kneel above the band
    ("biped", "short_legs"): {"drop": ("L_thigh", 1.15)},
    ("quadruped", "winged"): {"rel": {"wel_n": 20.0, "wel_f": 20.0, "wtip_n": 10.0, "wtip_f": 10.0}},
    ("quadruped", "multihead"): {"multihead": True},
}

TEMPLATES = {"biped": BIPED, "quadruped": QUADRUPED}
# limb chains per body for K-rot: the joints after each limb root, plus the toes hanging from the last one
TOES = {"biped": {"foot_n": "toe_n", "foot_f": "toe_f"},
        "quadruped": {"paw_n": "ftoe_n", "paw_f": "ftoe_f", "foot_n": "toe_n", "foot_f": "toe_f"}}


def merge(base: dict, add: dict) -> dict:
    """base with add's keys (dict values merged one level deep, others replaced)."""
    out = dict(base)
    for k, v in add.items():
        out[k] = {**base.get(k, {}), **v} if isinstance(v, dict) and isinstance(base.get(k), dict) else v
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
    if variant is not None:
        if (body, variant) not in VARIANTS:
            raise ValueError(f"rig {sprite}: kneel variant {variant!r} is not one of "
                             f"{sorted(v for b, v in VARIANTS if b == body)} (body {body})")
        t = merge(t, VARIANTS[(body, variant)])
    return t
