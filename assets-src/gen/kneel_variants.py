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
- `legs_free`: (K2-0) K-rot gives limb parts the template's limb cap even under a preset cap (mech_kneel).
- `aim`:      (K2-0, also a kneel block key) {joint: [x, y]} native px: the bone into the joint points there.
- `ground_dy`: (K2-0) the ground line this many px (per 80 px of cell) below the feet joints' row: a forearm laid
              flat has its bone, not its underside, on that line.
- `ground_late`: (K2-0) the `ground` joints are placed from their parents after `lower` / `aim` (by default from
              the plain forward-kinematics place: a lowered chest left the elbows hanging above the ground).
- `turn`:     (K2-0, also a kneel block key) {joint: deg}: the bone into the joint ends deg off its idle angle
              (forward-positive) whatever its parents turned, so its part turns exactly deg.
- `droop`:    (K2-0) {joint: deg} like `sag` but on either side: the bone ends at most deg off its idle angle,
              turned toward straight down the short way, whatever its parents did (wings).
- `robe`:     (K2-0) f: kneel_ops.robe_fit resamples the rows from the waist (f of chest -> hip) to the body's
              lowest row back onto its idle row, in the key and its in-betweens (a robe compressed under a sunk body).
- `fit`:      (K2-0) "ground": kneel.derive raises the ground line until the parts holding a `ground` joint fit
              (by default until every pixel does: garland's low armour skirt left the far knee floating 11 px up).
"""
from __future__ import annotations

import copy

# additive variants (D-K18): a rig opts in with kneel: {variant: <name>}
VARIANTS = {
    # K1 pilot (goblin): a short-legged biped whose 0.8 L_thigh drop leaves the kneel above the band
    ("biped", "short_legs"): {"drop": ("L_thigh", 1.15)},
    # K2-0 iteration 2 (white_dragon; no rig used the K1 draft): wings fold and droop down along the body, each wing
    # bone toward the ground on the side it leans (a raised wing leaning back sinks back over the haunch), under the
    # 30 deg rigid cap: the template wing joints and the one-piece folded wings (wtip_i, wt_*)
    ("quadruped", "winged"): {"droop": {j: 26.0 for j in ("wel_n", "wel_f", "wtip_n", "wtip_f", "wtip_i", "wt_n",
                                                           "wt_f", "wt")}},
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
    # K2-0 iteration 2 (garland), after knee_forward: the hips go further back (1.05 L_thigh) so a near knee pinned
    # at the idle key (block `pins`) keeps its shin upright and its thigh level
    ("biped", "knee_back"): {"back": ("L_thigh", 1.05)},
    # K2-0 iteration 2 (garland), with knee_forward: the far fist is not lowered, so the greatsword turns only a few
    # degrees to rest tip-down on the ground in front as a crutch; the far shin lies flat back along the ground with
    # the toes down; the ground line 2 px (per 80) low so the knee and the point touch the plain
    ("biped", "blade_kept"): {"down": {"tip": None}, "ground": {"tip": -3.0}, "lower": {"hand_f": None},
                              "dir": {"foot_f": 180.0, "toe_f": 100.0}, "ground_dy": 2.0},
    # K2-0 (garland): the upper body bowed further (torso and head at their 20 / 30 deg caps with whole-pixel slack)
    ("biped", "deep_bow"): {"rel": {"chest": 17.0, "crown": 11.0}},
    # K2-0 iteration 2 (iron_golem; needs a section 13 ruling, it departs from D-K11 / D-K19): the mechanical preset
    # kneels like a biped instead of the power-down squat: the far knee on the ground with its shin folded back flat,
    # the near foot planted with its knee forward; leg parts take the biped 100 deg limb cap while every other part
    # keeps the preset's 15 (nearest sampling throughout); the biped band
    ("biped", "mech_kneel"): {"squat": None, "slump": None, "drop": ("L_thigh", 1.4), "ground": {"knee_f": 0.3},
                              "dir": {"foot_f": 180.0}, "rel": {"crown": None, "head": None, "snout": None},
                              "pins": ["foot_n"], "knee_fwd": ["knee_n"],
                              "free_in": ["foot_n"], "legs_free": True, "limb_cap": 100.0, "band": (0.68, 0.85)},
    # K2-0 iteration 2 (blue_dragon), after crouch: lying sphinx-like: the chest low enough for the elbows to reach the
    # ground in front of the shoulders, the forearms and toes flat forward along it; only the hind feet planted; the
    # head turned 13 deg (its antlers stay clean), the droop comes from the neck
    ("quadruped", "sphinx"): {"drop": ("L_hindthigh", 0.5), "lower": {"chest": ("L_upperfore", 0.85)},
                              "ground": {"el_n": -0.3, "el_f": -0.3},
                              "dir": {"paw_n": 0.0, "paw_f": 0.0, "ftoe_n": 0.0, "ftoe_f": 0.0},
                              "pins": ["foot_n", "foot_f", "toe_n", "toe_f"], "fit": "ground", "sag": {"snout": 13.0},
                              "ground_dy": 2.5, "ground_late": True},
    # K2-0 (K2-B ask, ogre_mage; lich and king_mummy): a robed biped whose hip sits at the hem: the upper body sinks
    # rigidly (`slump`, legs held) over a robe compressed row by row to its idle hem (`robe`: the band from 0.6 of the
    # way chest -> hip down to the body's lowest row, a planted staff's foot included); head bowed, shoulders
    # dropped on the free side and that hand lowered; the staff arm and the chest keep their angles, so the staff
    # hand stays closed on the staff, which slides down with the body to its foot on the plain
    ("biped", "robed"): {"drop": None, "slump": 0.16, "robe": 0.6, "ground": None, "dir": None, "keep": None,
                         "pins": [], "down": {"tip": None},
                         "rel": {"chest": None, "crown": 14.0},
                         "lower": {"sh_f": ("L_neck", 0.12), "hand_f": ("L_neck", 0.15), "hand_n": None}},
    # K2-0 (hydra iteration 1), with crouch, a low body on stub legs: the legs stay where they stand (folding them
    # smears them), the body, tail and necks sink between them by the belly's clearance (`slump`, no bone turns); no
    # neck sag (three crossing neck chains tear when they turn), only the heads bow; the rig's tweaks lower the heads
    ("quadruped", "settle"): {"slump": 0.08, "drop": None, "lower": {"chest": None}, "sag": None,
                              "rel": {"snout": 12.0}},
    # K2-0b (ogre_mage), after robed: the feet are kept out of the robe's row compression (they stay as rendered,
    # behind the robe), so a foot inside the compressed band does not fold into a crease
    ("biped", "robed_feet"): {"robe_legs": "feet"},
    # K2-0 iteration 3 (hydra; needs a section 13 ruling): heads that bow on full-width necks (the reviewer's ask: no
    # translated, pinched necks; the column drops only with the body) leave the tall top head near 0.88 of the idle
    # height, so a multi-head kneel takes the band 0.60-0.90
    ("quadruped", "tall_necks"): {"band": (0.60, 0.90)},
    # K2-0 iteration 2 (hydra), after crouch instead of settle: the low body sinks to the belly line with its feet
    # planted (the knees and elbows folding by IK); no neck sag: the rig's `turn` droops each neck its own way
    ("quadruped", "settle2"): {"drop": ("L_hindthigh", 0.85), "lower": {"chest": None}, "sag": None},
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
