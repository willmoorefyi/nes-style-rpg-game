"""The `naga` body template for the monster rig (docs/ROSTER_PLAN.md 5.2 FW-3): a biped upper body with any number of
arm pairs on a serpent lower body with no legs (medusa, earth medusa, water / spirit naga, ashen queen). Data only;
rig.py registers it and monster_anim._joint_sets reads `arms`, `extra` and `ground`.

Joints are marked in the approved image's own coordinates (monsters face right). `_n*` arms are the near (attack) set,
`_f*` the far set; the suffixes are `n f n2 f2 n3 f3` (a two-armed naga simply leaves n2..f3 unmarked).

naga                                         root `c_f` (the far coil contact)
  coil       c_f -> c_n                      `coil` rigid: the resting coil mass on the ground line (an altar or a sand
             mound the creature sits on is a rig part on the same pinned joints, e.g. parts: {altar: {bone: [c_n, alt]}})
  body       c_n -> s0 -> s1 -> hip          `body` chain: s0 = where the rising body leaves the resting coil (pinned),
             s1 = mid body, hip = the waist (human torso meets the serpent)
  torso      hip -> chest                    `torso` (rigid torso kind, 20 deg cap)
  head       chest -> neck -> crown          `head` rigid (neck = chin / neck base, crown = top of the head or crown)
  arms       chest -> sh_<s> -> el_<s> -> hand_<s>   `uarm_<s>`, `farm_<s>` for s in n f n2 f2 n3 f3
  tail       c_n -> tail0 -> tail1 -> tail2 -> tail_tip   `tail` chain (tail0 = where the free tail leaves the coil,
             pinned); override `chain` for more joints
  weapon     hand_<weapon_hand> -> tip       as the biped (`weapon_hand: f3` puts it on the lowest far arm)

Contact joints: `ground` (c_f, c_n, s0, tail0) is pinned in EVERY generated frame (added to every recipe's and every
frames.<f>.pins override's pins), so the coil and anything on those joints never moves and stays on the ground line;
`feet` (c_f, c_n) are the parts check 8 judges per foot. No IK limbs. The recipes are the biped's (`moves: None`) with
the arm lists: `attack_hand` / `cast_hand` / `half_hand` accept a list of arm suffixes (e.g. `attack_hand: [n, n2,
n3]`, `half_hand: [f, f2, f3]`: those arms move with half the recipe's t), the cast set is every arm, and `extra` adds the
serpent body (s1, hip) and the free tail to the wind / follow / cast sets.
"""
from __future__ import annotations

ARMS = ("n", "f", "n2", "f2", "n3", "f3")
TAIL_J = ["tail1", "tail2", "tail_tip"]
_ARM_PARENT = {k: v for s in ARMS for k, v in ((f"sh_{s}", "chest"), (f"el_{s}", f"sh_{s}"), (f"hand_{s}", f"el_{s}"))}
_ARM_PARTS = {k: v for s in ARMS for k, v in ((f"uarm_{s}", {"bone": [f"sh_{s}", f"el_{s}"], "radius": 3.0}),
                                              (f"farm_{s}", {"bone": [f"el_{s}", f"hand_{s}"], "radius": 3.5}))}


def _arm_z(sets) -> list[str]:
    return [p for s in sets for p in (f"uarm_{s}", f"farm_{s}")]


NAGA = {
    "parent": {"c_n": "c_f", "s0": "c_n", "s1": "s0", "hip": "s1", "chest": "hip", "neck": "chest", "crown": "neck",
               "tail0": "c_n", "tail1": "tail0", "tail2": "tail1", "tail_tip": "tail2", **_ARM_PARENT, "tip": "hand_n"},
    "parts": {
        "coil": {"bone": ["c_f", "c_n"], "radius": 14.0},
        "body": {"chain": ["s0", "s1", "hip"], "radius": 8.0, "kind": "chain", "width": "auto"},
        "tail": {"chain": ["tail0", "tail1", "tail2", "tail_tip"], "radius": 4.0, "kind": "chain", "width": "auto"},
        "torso": {"bone": ["chest", "hip"], "radius": 9.0, "kind": "torso"},
        "head": {"bone": ["neck", "crown"], "radius": 11.0},
        **_ARM_PARTS,
        "weapon": {"bone": ["hand_n", "tip"], "radius": 2.0}},
    "z": _arm_z(("f3", "f2", "f")) + ["coil", "tail", "body", "torso", "head"] + _arm_z(("n3", "n2", "n")) + ["weapon"],
    "legs": ("c_f", "c_n", "s0", "tail0"),
    "feet": ("c_f", "c_n"),
    "limbs": (),
    "moves": None,                                         # the biped sets (monster_anim._joint_sets) plus `extra`
    "planted": ["c_f", "c_n"],
    "breath": "hip",
    "head": ("crown", "neck"),
    "arms": ARMS,
    "extra": {"wind": ["s1", "hip", *TAIL_J], "follow": ["s1", "hip", *TAIL_J], "cast": ["s1", "hip", *TAIL_J],
              "release": []},
    "ground": ("c_f", "c_n", "s0", "tail0"),
}
