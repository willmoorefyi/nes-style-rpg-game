"""The `floating` body template and its `swimmer` preset for the monster rig (docs/ROSTER_PLAN.md 5.2 FW-1): ghosts,
eyes, elementals, shadows, the hollow seraph (floating) and sharks, piranhas (swimmer). Data only; rig.py registers
both, monster_anim.generate reads `floating` and `recipes`, monster_check judges them by the float band.

Joints are marked in the approved image's own coordinates (monsters face right). Nothing touches the ground: there
are no feet, legs, IK limbs or pins, and check 8 is the **float band** (anim_feet.feet with floating on): a frame's
lowest opaque row stays within +-1 of its source keyframe's, lerped toward the target keyframe by the frame's u and
offset by the frame's body `dy` (idle_b: 1). It applies to every frame of a `body: floating | swimmer` rig and to any
sheet approved with `floating: true`.

floating                                    root `core` (the centre of the mass: chest, eye, flame heart)
  body       core -> base                   `body` (torso kind, 20 deg cap); base = the lowest point of the mass (hem,
             legs, the eye's underside)
  head       core -> neck -> crown          `head` rigid; a headless eye marks neck / crown on its upper rim
  arms       core -> sh_<s> -> el_<s> -> hand_<s>   `uarm_<s>`, `farm_<s>` (s = n, f; drawn only when marked)
  weapon     hand_<weapon_hand> -> tip      as the biped
  tail       base -> tail0 -> tail1 -> tail2 -> tail_tip   `tail` chain: a wisp, a ghost tail, an eye stalk (drawn
             only when every joint is marked; override `chain` for more or fewer joints)
  wings      wr_<s> -> wt_<s>               `wing_n`, `wing_f` on their **own roots** (wr_* has no parent: a body turn
             never swings a wing; the whole-body drift moves it). More wings (the seraph's six) are rig parts on more
             own roots, with keyframe-specific joint names so no frame interpolates one wing pose into another.
swimmer (preset)                            root `core`
  head       core -> head -> snout          `head` rigid (+ parts: {jaw: {bone: [head, jaw]}})
  body       core -> b1 -> b2 -> tail_tip   `body` chain (width auto): the S-curve that coils in wind and straightens
             in the lunge
  fins       wr_<s> -> wt_<s>               `wing_n`, `wing_f` (pectoral / dorsal fins) on own roots

Recipes: the shared tables (monster_recipes.RECIPES) with the template's `recipes` merged per frame: wind-up drifts the
whole figure back (`dx` -1 / -2, every joint) and sinks it 1 px; hurt_in1 is pushed back 2 px. `dx` and `dy` move every
joint (nothing is pinned); a rig's frames.<f>.dx / dy replace them. idle_b moves the whole sprite 1 px down (no breath
cut). The floating joint sets are the biped's plus `extra` (the body base, tail and wing tips); the swimmer names its
own (`moves`, beast-style).
"""
from __future__ import annotations

TAIL_J = ["tail0", "tail1", "tail2", "tail_tip"]
WING_TIPS = ["wt_n", "wt_f"]
_ARMS = {k: v for s in "nf" for k, v in ((f"sh_{s}", "core"), (f"el_{s}", f"sh_{s}"), (f"hand_{s}", f"el_{s}"))}
_WINGS = {"wt_n": "wr_n", "wt_f": "wr_f"}                 # wr_n / wr_f: own roots (no parent)
_WING_PARTS = {"wing_n": {"bone": ["wr_n", "wt_n"], "radius": 8.0}, "wing_f": {"bone": ["wr_f", "wt_f"], "radius": 8.0}}
# drift back and sink in the wind-up, pushed back by the hit (ROSTER_PLAN 5.2 floating row); px, every joint
DRIFT = {"atk_wind1": {"dx": -1, "dy": 1}, "atk_wind2": {"dx": -2, "dy": 1}, "hurt_in1": {"dx": -2}}

FLOATING = {
    "parent": {"neck": "core", "crown": "neck", "base": "core", **_ARMS, "tip": "hand_n",
               "tail0": "base", "tail1": "tail0", "tail2": "tail1", "tail_tip": "tail2", **_WINGS},
    "parts": {
        "body": {"bone": ["core", "base"], "radius": 10.0, "kind": "torso"},
        "head": {"bone": ["neck", "crown"], "radius": 11.0},
        "uarm_n": {"bone": ["sh_n", "el_n"], "radius": 3.5}, "farm_n": {"bone": ["el_n", "hand_n"], "radius": 4.5},
        "uarm_f": {"bone": ["sh_f", "el_f"], "radius": 3.5}, "farm_f": {"bone": ["el_f", "hand_f"], "radius": 4.5},
        "weapon": {"bone": ["hand_n", "tip"], "radius": 2.0},
        "tail": {"chain": ["base", *TAIL_J], "radius": 4.0, "kind": "chain", "width": "auto"},
        **_WING_PARTS},
    "z": ["wing_f", "uarm_f", "farm_f", "tail", "body", "head", "uarm_n", "farm_n", "weapon", "wing_n"],
    "legs": (), "feet": (), "limbs": (),
    "moves": None,                                         # the biped sets (monster_anim._joint_sets) plus `extra`
    "planted": [],
    "breath": "core",
    "head": ("crown", "neck"),
    "extra": {"wind": ["base", *TAIL_J, *WING_TIPS], "follow": ["base", *TAIL_J, *WING_TIPS],
              "cast": ["base", *TAIL_J, *WING_TIPS], "release": []},
    "floating": True,
    "recipes": DRIFT,
}

_SWIM = ["head", "snout", "jaw", "b1", "b2", "tail_tip", *WING_TIPS]
SWIMMER = {
    "parent": {"head": "core", "snout": "head", "jaw": "head", "b1": "core", "b2": "b1", "tail_tip": "b2", **_WINGS},
    "parts": {
        "head": {"bone": ["head", "snout"], "radius": 8.0},
        "body": {"chain": ["core", "b1", "b2", "tail_tip"], "radius": 9.0, "kind": "chain", "width": "auto"},
        **_WING_PARTS},
    "z": ["wing_f", "body", "head", "wing_n"],
    "legs": (), "feet": (), "limbs": (),
    "moves": {"wind": _SWIM, "follow": _SWIM, "cast": _SWIM, "release": ["head", "snout", "jaw"]},
    "planted": [],
    "breath": "core",
    "head": ("head", "snout"),
    "floating": True,
    "recipes": DRIFT,
}

FLOATERS = {"floating": FLOATING, "swimmer": SWIMMER}
