"""The `arthropod` body template for the monster rig (docs/ROSTER_PLAN.md 5.2 arthropod row, FW-4): spiders, scorpions,
crawler, centipedes, sea scorpion. Data only; rig.py registers it.

Joints are marked in the approved image's own coordinates (monsters face right).

arthropod                                    root `body` (the cephalothorax / thorax centre)
  thorax     body -> head                    `thorax` rigid (head = the front of the head: eyes, chelicerae root)
  fangs      head -> fang                    `fangs` rigid (fang tips / mandibles); drawn only when marked
  abdomen    body -> abd -> abd_end          `abdomen` rigid on abd -> abd_end (abd = the pedicel / waist, abd_end =
             the far end of the abdomen); a centipede marks a longer body as a chain (parts: {abdomen: {chain: [...],
             kind: chain, width: auto}})
  tail       abd_end -> tl0 -> tl1 -> tl2 -> tl3 -> sting   `tail` chain (the scorpion's metasoma; drawn only when marked)
  pincers    body -> sh_<s> -> el_<s> -> hand_<s>   `uarm_<s>`, `farm_<s>` (s = n, f): pedipalps / claws (only when
             marked); recipes move the `attack_hand` set like a biped arm (attack_hand: [n, f] for both claws)
  legs       body -> coxa<i>_<s> -> knee<i>_<s> -> tip<i>_<s>   `leg<i>_<s>` chain (width auto): one mesh-warped
             part per leg, so femur and tibia bend as one line with no gap or shred at the knee
             for i = 1..4 front to back, s = n (near) / f (far); mark only the legs the art shows (a leg with an
             unmarked joint is not drawn)

Ground: every leg tip is a foot: pinned in wind-up, mid, follow, recover, hurt, cast and daze (`legs`, `feet` and
`planted` are the tips), and judged per foot by check 8 (a tip lifted in a keyframe is skipped there). Each leg is a
two-bone IK limb (coxa, knee, tip), so when the body lowers, shifts back or tips the knees bend and the tips stay put.
Recipes: the shared tables with the arthropod sets: wind-up lowers the body (dy 1 / 2) and shifts it back (t -0.20 /
-0.35 on `body`), raising fangs, pincers and the tail; mid / follow strike from the approved attack; hurt tips the
body back with the tips fixed (the legs splay); daze sinks the body (`head` = the head joint). idle_b moves everything
above the `body` joint's row 1 px down.
"""
from __future__ import annotations

LEGS = [(i, s) for i in range(1, 5) for s in "nf"]
_LEG_PARENT = {k: v for i, s in LEGS for k, v in ((f"coxa{i}_{s}", "body"), (f"knee{i}_{s}", f"coxa{i}_{s}"),
                                                  (f"tip{i}_{s}", f"knee{i}_{s}"))}
_LEG_PARTS = {f"leg{i}_{s}": {"chain": [f"coxa{i}_{s}", f"knee{i}_{s}", f"tip{i}_{s}"], "radius": 2.5, "kind": "chain",
                                "width": "auto"} for i, s in LEGS}
TIPS = tuple(f"tip{i}_{s}" for i, s in LEGS)
_PINC = {k: v for s in "nf" for k, v in ((f"sh_{s}", "body"), (f"el_{s}", f"sh_{s}"), (f"hand_{s}", f"el_{s}"))}
_TAIL = ["tl0", "tl1", "tl2", "tl3", "sting"]
_UPPER = ["body", "head", "fang", "abd", "abd_end", *_TAIL[1:], *_PINC]

ARTHROPOD = {
    "parent": {"head": "body", "fang": "head", "abd": "body", "abd_end": "abd", "tl0": "abd_end", "tl1": "tl0",
               "tl2": "tl1", "tl3": "tl2", "sting": "tl3", **_PINC, **_LEG_PARENT},
    "parts": {
        "thorax": {"bone": ["body", "head"], "radius": 8.0},
        "fangs": {"bone": ["head", "fang"], "radius": 3.0},
        "abdomen": {"bone": ["abd", "abd_end"], "radius": 11.0},
        "tail": {"chain": _TAIL, "radius": 4.0, "kind": "chain", "width": "auto"},
        "uarm_n": {"bone": ["sh_n", "el_n"], "radius": 3.0}, "farm_n": {"bone": ["el_n", "hand_n"], "radius": 5.0},
        "uarm_f": {"bone": ["sh_f", "el_f"], "radius": 3.0}, "farm_f": {"bone": ["el_f", "hand_f"], "radius": 5.0},
        **_LEG_PARTS},
    "z": ([f"leg{i}_f" for i in range(1, 5)] + ["uarm_f", "farm_f", "tail", "abdomen", "thorax", "fangs"] +
          [f"leg{i}_n" for i in range(1, 5)] + ["uarm_n", "farm_n"]),
    "legs": TIPS, "feet": TIPS,
    "limbs": tuple((f"coxa{i}_{s}", f"knee{i}_{s}", f"tip{i}_{s}") for i, s in LEGS),
    "moves": {"wind": _UPPER, "follow": _UPPER, "cast": _UPPER, "release": ["head", "fang", *_PINC, "tl3", "sting"]},
    "planted": list(TIPS),
    "breath": "body",
    "head": ("head",),
}
