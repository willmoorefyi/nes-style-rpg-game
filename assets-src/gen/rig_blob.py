"""The `blob` body template for the monster rig (docs/ROSTER_PLAN.md 5.2 blob row, FW-6): slimes, oozes, jellies, flans.
Data only; rig.py registers it, monster_anim.generate reads `recipes` (squash per frame), `ground` and `idle_b`.

Joints are marked in the approved image's own coordinates (monsters face right).

blob                                         root `base` (the bottom centre of the mass, on the ground row)
  body       base -> mid -> top              `body` (kind shear): the whole mass. mid = the middle of the mass, top =
             its crown; in a leaning attack key top sits on the lean (the wave's crest, the pseudopod's root)
  pods       mid -> sh_<s> -> el_<s> -> hand_<s>   `uarm_<s>`, `farm_<s>` (s = n, f): arms or pseudopods, drawn only
             when marked (an ooze's fists; a plain slime leaves them out)
  extras     rig parts on these joints (an eye, a bone floating inside: parts: {bone: {bone: [mid, bone_e]}})

Contact: `base` is the template's `ground` joint, pinned in every frame (it ignores dy and tweaks, as the naga coil).
The body is `kind: shear` (anim_squash.shear_part): each row slides sideways by the chain's solved x displacement at
its height (0 at the pinned base), never up or down, so the ground row stays put and nothing is resampled; its lean
is capped at 25 deg like a chain. Height changes come only from the squash op. There are no feet parts: check 8 judges
the whole bottom band (lowest row on the plain, base x extent within +-1 of the source's, or +-2 of the lerp), scaled
about the squash anchor when the frame squashes.

Squash recipes (the `squash` frame op, anim_squash.py: whole interior rows / columns removed or duplicated about the
bottom centre; anchor column = the solved `base` x): wind1 / wind2 squash sx 1.04 / 1.08, sy 0.94 / 0.88 (no dy: the
squash is the crouch), recover bounces sx 0.97 sy 1.03, hurt_in1 flattens sx 1.10 sy 0.90, daze / daze_b sag sy
0.94 / 0.92 (+ the shared 1 px head lean on `top`). atk_mid, atk_follow and hurt_in2 (cut from a key of another
size: the stretched attack, the flattened hurt) use `squash: auto`: rows and per-side columns that bring the frame's
height and bottom band to the S -> T lerp (the checks then judge them by the lerp, as any frame). The stretch toward
the party comes from the attack key; the shared wind t (-0.20 / -0.35) leans the mass back, and a rig whose attack
leans far (green_slime: centroid 10 px) coils forward instead (frames.atk_wind2.t > 0). `idle_b: sag` removes exactly
one interior row (the top sinks 1 px; no breath cut). A rig's frames.<f>.squash replaces the template's ({sx, sy},
`auto`, or null for none). Mark `base` at the top of the planted band: rows at or below it never slide.
"""
from __future__ import annotations

_PODS = {k: v for s in "nf" for k, v in ((f"sh_{s}", "mid"), (f"el_{s}", f"sh_{s}"), (f"hand_{s}", f"el_{s}"))}
_POD_PARTS = {k: v for s in "nf" for k, v in ((f"uarm_{s}", {"bone": [f"sh_{s}", f"el_{s}"], "radius": 4.0}),
                                              (f"farm_{s}", {"bone": [f"el_{s}", f"hand_{s}"], "radius": 5.0}))}
_MASS = ["mid", "top", *_PODS]
SQUASH = {"atk_wind1": {"dy": 0, "squash": {"sx": 1.04, "sy": 0.94}},
          "atk_wind2": {"dy": 0, "squash": {"sx": 1.08, "sy": 0.88}},
          "atk_mid": {"squash": "auto"}, "atk_follow": {"squash": "auto"},
          "atk_recover": {"squash": {"sx": 0.97, "sy": 1.03}},
          "hurt_in1": {"squash": {"sx": 1.10, "sy": 0.90}}, "hurt_in2": {"squash": "auto"},
          "daze": {"dy": 0, "squash": {"sy": 0.94}},
          "daze_b": {"dy": 0, "squash": {"sy": 0.92}}}

BLOB = {
    "parent": {"mid": "base", "top": "mid", **_PODS},
    "parts": {"body": {"chain": ["base", "mid", "top"], "radius": 30.0, "kind": "shear"}, **_POD_PARTS},
    "z": ["uarm_f", "farm_f", "body", "uarm_n", "farm_n"],
    "legs": (), "feet": (), "limbs": (),
    "moves": {"wind": _MASS, "follow": _MASS, "cast": _MASS, "release": ["top", "el_n", "hand_n"]},
    "planted": [],
    "breath": "base",
    "head": ("top",),
    "ground": ("base",),
    "recipes": SQUASH,
    "idle_b": "sag",
}
