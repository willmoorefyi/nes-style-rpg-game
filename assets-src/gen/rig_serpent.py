"""The `serpent` body template and its `rooted` preset for the monster rig (docs/ROSTER_PLAN.md 5.2, FW-2): cobra,
anaconda, worms, wyrm, sea snake (serpent); ochu, neochu (rooted). Data only; rig.py registers both and reads `lead`
(rooted) from the rig file; monster_anim._joint_sets reads `ground`, `moves` and `half`.

Joints are marked in the approved image's own coordinates (monsters face right).

serpent                                      root `c_f` (the far coil contact)
  coil       c_f -> c_n                      `coil` rigid: the resting coil on the ground line. c_f / c_n = its far /
             near ground contacts (the left and right ends of its lowest row)
  body       c_n -> body0 -> body1 -> neck   `body` chain (width auto): body0 = where the rising body leaves the coil
             (pinned), body1 = mid body, neck = under the head (the hood's root)
  head       neck -> head -> snout           `head` rigid on head -> snout (head = back of the skull / hood top, snout
             = nose tip); add a jaw with parts: {jaw: {bone: [head, jaw]}}
  tail       c_n -> t1 -> t2 -> t3 -> tail_tip   `tail` chain (t1 = where the free tail leaves the coil, pinned). A
             tail lifted only in the attack key: mark it only there (parts: {tail: {in: [attack]}}), so idle frames
             keep the tucked tail and attack-sourced frames the raised one (it changes at the wind2 -> mid boundary)
  Contacts: `ground` (c_f, c_n, body0, t1) is pinned in EVERY generated frame (it ignores dy and tweaks), so the coil
  never moves; `feet` (c_f, c_n) are judged per foot by check 8 (the coil's pixels in the bottom band). No IK limbs.
  Recipes: the shared tables with the serpent sets. idle_b: everything above `neck` 1 px down (breath joint neck).
  Wind-up draws the head and neck back and down (the shared t -0.20 / -0.35 and dy 1 / 2 on the free joints); mid /
  attack / follow strike from the approved attack (follow overshoot 1.10); hurt recoils the chain; daze sinks the
  head (`head` = head + snout).

rooted (preset)                              root `root` (the root mass's ground centre)
  mass       root -> maw                     `mass` rigid: the root mass and its maw (maw = the maw's centre / top)
  tentacles  k<i>_0 -> k<i>_1 -> k<i>_2 -> k<i>_3   `tent<i>` chains, i = 1..6 (drawn only when marked), each on its
             own root k<i>_0 (no parent: where the tentacle leaves the mass; pinned)
  Contacts: `ground` = root, maw and every k<i>_0 (the mass never turns, so its base stays planted; the daze droop
  comes from the shared dy on the tentacles); `feet` = (root,) (the mass's bottom band). `lead: [1, 2]` in the rig file
  names the lead tentacles: they move with the recipe's full t (pull back in the wind-up, whip in the strike); the
  others move with half of it (a 1-2 px sway, the `half` set). Without `lead` every tentacle leads.
"""
from __future__ import annotations

_HEAD = ["neck", "head", "snout", "jaw"]
_TAIL = ["t2", "t3", "tail_tip"]
_FREE = ["body1", *_HEAD, *_TAIL]

SERPENT = {
    "parent": {"c_n": "c_f", "body0": "c_n", "body1": "body0", "neck": "body1", "head": "neck", "snout": "head",
               "t1": "c_n", "t2": "t1", "t3": "t2", "tail_tip": "t3"},
    "parts": {
        "coil": {"bone": ["c_f", "c_n"], "radius": 14.0},
        "body": {"chain": ["body0", "body1", "neck"], "radius": 7.0, "kind": "chain", "width": "auto"},
        "head": {"bone": ["head", "snout"], "radius": 9.0},
        "tail": {"chain": ["t1", "t2", "t3", "tail_tip"], "radius": 3.5, "kind": "chain", "width": "auto"}},
    "z": ["tail", "coil", "body", "head"],
    "legs": ("c_f", "c_n"), "feet": ("c_f", "c_n"), "limbs": (),
    "moves": {"wind": _FREE, "follow": _FREE, "cast": _FREE, "release": ["head", "snout", "jaw"]},
    "planted": ["c_f", "c_n"],
    "breath": "neck",
    "head": ("head", "snout"),
    "ground": ("c_f", "c_n", "body0", "t1"),
}

K = 6
_TJ = [f"k{i}_{s}" for i in range(1, K + 1) for s in (1, 2, 3)]
ROOTED = {
    "parent": {"maw": "root", **{f"k{i}_{s}": f"k{i}_{s - 1}" for i in range(1, K + 1) for s in (1, 2, 3)}},
    "parts": {"mass": {"bone": ["root", "maw"], "radius": 14.0},
              **{f"tent{i}": {"chain": [f"k{i}_{s}" for s in range(4)], "radius": 4.0, "kind": "chain",
                              "width": "auto"} for i in range(1, K + 1)}},
    "z": [*(f"tent{i}" for i in range(K, 0, -1)), "mass"],
    "legs": ("root",), "feet": ("root",), "limbs": (),
    "moves": {"wind": ["maw", *_TJ], "follow": ["maw", *_TJ], "cast": ["maw", *_TJ], "release": ["maw", *_TJ]},
    "planted": ["root"],
    "breath": "maw",
    "head": ("maw",),
    "ground": ("root", "maw", *(f"k{i}_0" for i in range(1, K + 1))),
    "rooted": True,
}


def rooted_half(cfg: dict) -> set[str]:
    """The non-lead tentacles' joints (they move with half the recipe's t: the sway); empty without `lead`."""
    lead = cfg.get("lead")
    if not lead:
        return set()
    return {f"k{i}_{s}" for i in range(1, K + 1) if i not in set(lead) for s in (1, 2, 3)}


SERPENTS = {"serpent": SERPENT, "rooted": ROOTED}
