"""Additive kneel template variants (docs/KNEEL_PLAN.md 4, D-K18), split out of kneel_templates.py in K2-0: a rig opts
in with `kneel: {variant: <name>}` or a list of names, merged in order onto its body template (kneel_templates.merge,
where a None value drops a default key). Adding a variant never changes a rig on the default template. Template keys
added in K2-0 (of the defaults only the mechanical preset uses one, `slump`):

- `back`:     (K2-0) (unit, k) the root also goes k x unit back, against the facing.
- `sag`:      (K2-0) {joint: deg} a bone into the joint that leans forward ends deg off its idle angle, turned down
              toward the facing, whatever its parents turned (a part's rotation is then at most deg, under its cap); a
              bone leaning back keeps its idle angle (sagging it back kinks a neck chain: hydra K2-0).
- `slump`:    (K2-0) every joint but the limbs sinks this fraction of the idle's opaque height, rigidly (no bone
              turns), the limb roots held: the body settles between legs a 15 deg cap cannot fold.
- `knee_fwd`: (K2-0) knees bent forward in the key: a solved knee behind its hip-foot line is mirrored across it (a
              near-straight idle leg gives the IK no side; garland's planted knee bent backward).
- `free_in`:  (K2-0) pins the in-betweens drop: those joints follow the position lerp (kneel.leg_lerp) instead of the
              IK, which would bend the knee back to the idle's side.
- `fit`:      (K2-0) "ground": kneel.derive raises the ground line until the parts holding a `ground` joint fit
              (by default until every pixel does: garland's low armour skirt left the far knee floating 11 px up).
"""
from __future__ import annotations

# additive variants (D-K18): a rig opts in with kneel: {variant: <name>}
VARIANTS = {
    # K1 pilot (goblin): a short-legged biped whose 0.8 L_thigh drop leaves the kneel above the band
    ("biped", "short_legs"): {"drop": ("L_thigh", 1.15)},
    ("quadruped", "winged"): {"rel": {"wel_n": 20.0, "wel_f": 20.0, "wtip_n": 10.0, "wtip_f": 10.0}},
    ("quadruped", "multihead"): {"multihead": True},
    # K2-0 (blue_dragon): a long low body on short legs; folding them to the ground smears them, so it crouches: feet
    # planted (IK knees and elbows), body and chest a little down, the neck bowed forward and the head hung (the neck
    # chain and the head under their 25 / 30 deg caps; the head bends back a little so the snout stays in the cell)
    ("quadruped", "crouch"): {"drop": ("L_hindthigh", 0.35), "lower": {"chest": ("L_upperfore", 0.7), "neck": None},
                              "ground": None, "dir": None,
                              "pins": ["paw_n", "paw_f", "foot_n", "foot_f", "ftoe_n", "ftoe_f", "toe_n", "toe_f"],
                              "rel": {"snout": None, "tail1": None, "tail2": None, "tail_tip": None},
                              "sag": {"neck": 20.0, "head": 23.0, "snout": 29.0}},
    # K2-0 (garland): a long blade held low: its tip goes onto the ground line in front (a planted greatsword)
    # instead of the default 30 deg turn toward the ground (over the 30 deg prop cap once the arm has turned)
    ("biped", "blade_planted"): {"down": {"tip": None}, "ground": {"tip": -3.0}},
    # K2-0 (garland): long legs: the hip goes back over the far knee so the planted near shin stands about
    # vertical, its knee bent forward (in the key and its in-betweens)
    ("biped", "knee_forward"): {"knee_fwd": ["knee_n"], "free_in": ["foot_n"], "back": ("L_thigh", 0.8),
                                "drop": ("L_thigh", 1.0), "fit": "ground"},
    # K2-0 (garland): the upper body bowed further (torso and head at their 20 / 30 deg caps with whole-pixel slack)
    ("biped", "deep_bow"): {"rel": {"chest": 17.0, "crown": 11.0}},
    # K2-0 (hydra): with crouch, a low body on stub legs: the legs stay where they stand (folding them smears them),
    # the body, tail and necks sink between them by the belly's clearance (`slump`, no bone turns); no neck sag (three
    # crossing neck chains tear when they turn), only the heads bow; the rig's tweaks lower the head groups
    ("quadruped", "settle"): {"slump": 0.08, "drop": None, "lower": {"chest": None}, "sag": None,
                              "rel": {"snout": 12.0}},
}


def knees_forward(rig, tpl: dict, J: dict) -> dict:
    """`knee_fwd`: each listed knee that lies behind its hip-foot line (against the facing) mirrored across it."""
    out = dict(J)
    for h, k, f in rig.limbs:
        if k not in tpl.get("knee_fwd", []) or not all(j in J for j in (h, k, f)):
            continue
        (hx, hy), (kx, ky), (fx, fy) = J[h], J[k], J[f]
        dx, dy = fx - hx, fy - hy
        n2 = dx * dx + dy * dy or 1.0
        t = ((kx - hx) * dx + (ky - hy) * dy) / n2
        px, py = hx + t * dx, hy + t * dy               # the knee's foot point on the hip-foot line
        if (kx - px) * rig.fwd < 0:
            out[k] = (float(round(2 * px - kx)), float(round(2 * py - ky)))
    return out
