"""Beast body templates for the monster rig (docs/ENEMY_ANIM_PLAN.md 4.1, tranche T5a): `quadruped` (wolf, gr_wolf,
dragon) and `bird` (cockatrice). The biped template stays in rig.py; this module only adds data.

Joints are marked in the approved image's own coordinates (monsters face right: the head is on the right). `_n` is
the near side (toward the viewer), `_f` the far side. Radii are segmentation radii at an 80 px cell height (scaled with
the cell); chain parts are mesh-warped with `width: auto` (the warp covers every pixel the part segments to).

quadruped                                   root `hip` (pelvis, centre of the haunch)
  spine      hip -> back -> chest            `body` chain (back = mid-back, chest = withers / shoulder blades)
  neck       chest -> neck -> head           `neck` chain; head = back of the skull / ear base
  head       head -> snout                   `head` rigid (snout = nose tip); add a jaw with parts: {jaw: {bone: [head, jaw]}}
  tail       hip -> tail0 -> tail1 -> tail2 -> tail_tip   `tail` chain (tail0 = tail root on the rump)
  forelegs   chest -> sh_n -> el_n -> paw_n -> ftoe_n   `ufore_n`, `lfore_n`, `fpaw_n` (and _f); el = elbow / wrist
             bend, paw = the ankle just above the paw, ftoe = the paw's front tip on the ground line
  hindlegs   hip -> hip_n -> knee_n -> foot_n -> toe_n  `thigh_n`, `shin_n`, `hpaw_n` (and _f); knee = the hock bend
             Mark the toes (recommended): a paw part then rides its pinned ankle without rotating, so the paw pixels
             stay on the ground line; without toes the leg's lower bone rotates the paw and can drop it 1 px.
  wings      chest -> wsh_n -> wel_n -> wtip_n `uwing_n`, `fwing_n` (and _f); only drawn when the joints are marked
             (dragon); a wolf simply leaves them out.
bird                                        root `hip`
  body       chest -> hip                    `body` torso (rigid, 20 deg cap); chest = breast / wing root
  neck       chest -> neck -> head           `neck` chain;  head -> beak: `head` rigid (comb and wattles ride along)
  tail       hip -> tail0 -> tail1 -> tail2 -> tail_tip   `tail` chain (the cockatrice snake tail; override `chain`
             for more joints, e.g. parts: {tail: {chain: [tail0, tail1, tail2, tail3, tail_tip]}})
  wings      chest -> wsh_n -> wel_n -> wtip_n `uwing_n`, `fwing_n` (and _f)
  legs       hip -> hip_n -> knee_n -> foot_n -> toe_n   `thigh_n`, `shin_n`, `toes_n` (and _f; toe optional)

Per template: `legs` (pinned with the knees in wind-up / recover), `feet` (pinned in follow / hurt / cast; the ground
line), `limbs` (two-bone IK chains that keep a held / grounded foot), `moves` (the joint sets of the recipes),
`planted` (atk_mid's planted foot or feet), `breath` (idle_b moves everything above this joint's row 1 px down) and
`head` (the joints a recipe's symbolic `head` tweak moves, e.g. the daze slump: `head` + `snout` / `beak`; the biped's
are `crown` + `neck` in rig.py; a rig missing one is an error).
"""
from __future__ import annotations

TAIL = {"tail0": "hip", "tail1": "tail0", "tail2": "tail1", "tail_tip": "tail2"}
WINGS = {"wsh_n": "chest", "wel_n": "wsh_n", "wtip_n": "wel_n", "wsh_f": "chest", "wel_f": "wsh_f", "wtip_f": "wel_f"}
HIND = {"hip_n": "hip", "knee_n": "hip_n", "foot_n": "knee_n", "hip_f": "hip", "knee_f": "hip_f", "foot_f": "knee_f"}
WING_PARTS = {"uwing_n": {"bone": ["wsh_n", "wel_n"], "radius": 6.0}, "fwing_n": {"bone": ["wel_n", "wtip_n"], "radius": 8.0},
              "uwing_f": {"bone": ["wsh_f", "wel_f"], "radius": 6.0}, "fwing_f": {"bone": ["wel_f", "wtip_f"], "radius": 8.0}}
WING_J = list(WINGS)
TAIL_J = list(TAIL)


def _moves(spine: list[str], head: list[str]) -> dict[str, list[str]]:
    return {"wind": spine + head + TAIL_J + WING_J, "follow": spine + head + TAIL_J + WING_J,
            "cast": spine + head + TAIL_J + WING_J, "release": head + WING_J}


QUADRUPED = {
    "parent": {"back": "hip", "chest": "back", "neck": "chest", "head": "neck", "snout": "head", **TAIL, **WINGS,
               "sh_n": "chest", "el_n": "sh_n", "paw_n": "el_n", "sh_f": "chest", "el_f": "sh_f", "paw_f": "el_f", **HIND,
               "ftoe_n": "paw_n", "ftoe_f": "paw_f", "toe_n": "foot_n", "toe_f": "foot_f"},
    "parts": {
        "body": {"chain": ["hip", "back", "chest"], "radius": 10.0, "kind": "chain", "width": "auto"},
        "neck": {"chain": ["chest", "neck", "head"], "radius": 6.0, "kind": "chain", "width": "auto"},
        "head": {"bone": ["head", "snout"], "radius": 8.0},
        "tail": {"chain": ["tail0", "tail1", "tail2", "tail_tip"], "radius": 4.0,
                 "kind": "chain", "width": "auto"},
        "ufore_n": {"bone": ["sh_n", "el_n"], "radius": 4.0}, "lfore_n": {"bone": ["el_n", "paw_n"], "radius": 3.5},
        "ufore_f": {"bone": ["sh_f", "el_f"], "radius": 4.0}, "lfore_f": {"bone": ["el_f", "paw_f"], "radius": 3.5},
        "thigh_n": {"bone": ["hip_n", "knee_n"], "radius": 5.0}, "shin_n": {"bone": ["knee_n", "foot_n"], "radius": 3.5},
        "thigh_f": {"bone": ["hip_f", "knee_f"], "radius": 5.0}, "shin_f": {"bone": ["knee_f", "foot_f"], "radius": 3.5},
        "fpaw_n": {"bone": ["paw_n", "ftoe_n"], "radius": 3.0}, "fpaw_f": {"bone": ["paw_f", "ftoe_f"], "radius": 3.0},
        "hpaw_n": {"bone": ["foot_n", "toe_n"], "radius": 3.0}, "hpaw_f": {"bone": ["foot_f", "toe_f"], "radius": 3.0},
        **WING_PARTS},
    "z": ["fwing_f", "uwing_f", "thigh_f", "shin_f", "hpaw_f", "ufore_f", "lfore_f", "fpaw_f", "tail", "body",
          "thigh_n", "shin_n", "hpaw_n", "ufore_n", "lfore_n", "fpaw_n", "neck", "head", "uwing_n", "fwing_n"],
    "legs": ("el_n", "el_f", "paw_n", "paw_f", "knee_n", "knee_f", "foot_n", "foot_f"),
    "feet": ("paw_n", "paw_f", "foot_n", "foot_f"),
    "limbs": (("sh_n", "el_n", "paw_n"), ("sh_f", "el_f", "paw_f"), ("hip_n", "knee_n", "foot_n"), ("hip_f", "knee_f", "foot_f")),
    "moves": _moves(["back", "chest"], ["neck", "head", "snout", "jaw"]),
    "planted": ["foot_n", "foot_f"],
    "breath": "hip",
    "head": ("head", "snout"),
}

BIRD = {
    "parent": {"chest": "hip", "neck": "chest", "head": "neck", "beak": "head", **TAIL, **WINGS, **HIND,
               "toe_n": "foot_n", "toe_f": "foot_f"},
    "parts": {
        "body": {"bone": ["chest", "hip"], "radius": 11.0, "kind": "torso"},
        "neck": {"chain": ["chest", "neck", "head"], "radius": 5.0, "kind": "chain", "width": "auto"},
        "head": {"bone": ["head", "beak"], "radius": 7.0},
        "tail": {"chain": ["tail0", "tail1", "tail2", "tail_tip"], "radius": 4.0,
                 "kind": "chain", "width": "auto"},
        "thigh_n": {"bone": ["hip_n", "knee_n"], "radius": 4.0}, "shin_n": {"bone": ["knee_n", "foot_n"], "radius": 2.5},
        "toes_n": {"bone": ["foot_n", "toe_n"], "radius": 3.0},
        "thigh_f": {"bone": ["hip_f", "knee_f"], "radius": 4.0}, "shin_f": {"bone": ["knee_f", "foot_f"], "radius": 2.5},
        "toes_f": {"bone": ["foot_f", "toe_f"], "radius": 3.0},
        **WING_PARTS},
    "z": ["fwing_f", "uwing_f", "thigh_f", "shin_f", "toes_f", "tail", "body", "thigh_n", "shin_n", "toes_n",
          "neck", "head", "uwing_n", "fwing_n"],
    "legs": ("knee_n", "knee_f", "foot_n", "foot_f"),
    "feet": ("foot_n", "foot_f"),
    "limbs": (("hip_n", "knee_n", "foot_n"), ("hip_f", "knee_f", "foot_f")),
    "moves": _moves(["chest"], ["neck", "head", "beak"]),
    "planted": ["foot_f"],
    "breath": "hip",
    "head": ("head", "beak"),
}

BEASTS = {"quadruped": QUADRUPED, "bird": BIRD}
