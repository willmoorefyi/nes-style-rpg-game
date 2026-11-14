"""A synthetic right-facing biped (80x80, feet on row 76) with marked joints on idle / attack / hurt and a dagger prop
(hip in idle, hand in attack, carried into hurt_in2): exercises the whole rig path of monster_anim.generate."""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw

OUTLINE = (6, 4, 10, 255)
SKIN, VEST, PANTS, STEEL = (90, 170, 80, 255), (130, 90, 50, 255), (70, 60, 110, 255), (170, 170, 185, 255)

IDLE = {"crown": (40, 14), "neck": (40, 28), "chest": (40, 33), "hip": (40, 52), "sh_n": (44, 34), "el_n": (47, 42),
        "hand_n": (49, 49), "sh_f": (36, 34), "el_f": (33, 42), "hand_f": (32, 49), "hip_n": (43, 53), "knee_n": (45, 63),
        "foot_n": (46, 75), "hip_f": (37, 53), "knee_f": (35, 63), "foot_f": (34, 75), "dag": (31, 61)}
ATTACK = {**IDLE, "crown": (43, 15), "neck": (42, 29), "chest": (42, 34), "sh_n": (46, 35), "el_n": (51, 40),
          "hand_n": (56, 45), "tip": (63, 48), "sh_f": (38, 35), "el_f": (34, 41), "hand_f": (31, 46)}
HURT = {**IDLE, "crown": (37, 15), "neck": (38, 29), "chest": (39, 34), "sh_n": (43, 35), "el_n": (45, 42),
        "hand_n": (44, 49), "sh_f": (35, 35), "el_f": (31, 40), "hand_f": (27, 44)}
RIG = {"sprite": "synthetic", "body": "biped", "facing": "right", "keyframes": {"idle": IDLE, "attack": ATTACK, "hurt": HURT},
       "parts": {"weapon": {"remove": True},
                 "dagger": {"kind": "prop", "bone": {"idle": ["hip_f", "dag"], "attack": ["hand_n", "tip"]},
                            "radius": 2.0, "in": ["idle", "attack"], "carry_to": "hand_n", "carry_mode": "behind"}},
       "colors": {"prop": [list(STEEL[:3])]}}
META = {"bottom_row": 76, "floating": False}


def draw(j: dict, dagger: bool) -> Image.Image:
    im = Image.new("RGBA", (80, 80), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for a, b, c, w in (("sh_f", "el_f", SKIN, 4), ("el_f", "hand_f", SKIN, 4), ("hip_f", "knee_f", PANTS, 5),
                       ("knee_f", "foot_f", PANTS, 5), ("chest", "hip", VEST, 12), ("hip_n", "knee_n", PANTS, 5),
                       ("knee_n", "foot_n", PANTS, 5), ("sh_n", "el_n", SKIN, 4), ("el_n", "hand_n", SKIN, 4)):
        d.line([j[a], j[b]], fill=c, width=w)
    cx, cy = (j["neck"][0] + j["crown"][0]) / 2, (j["neck"][1] + j["crown"][1]) / 2
    d.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=SKIN)
    if dagger:
        a, b = ("hand_n", "tip") if "tip" in j else ("hip_f", "dag")
        d.line([j[a], j[b]], fill=STEEL, width=2)
    a = np.asarray(im).copy()
    solid = a[..., 3] > 0
    ring = np.zeros_like(solid)
    ring[1:] |= solid[:-1]; ring[:-1] |= solid[1:]; ring[:, 1:] |= solid[:, :-1]; ring[:, :-1] |= solid[:, 1:]
    a[ring & ~solid] = OUTLINE
    return Image.fromarray(a, "RGBA")


def keyframes() -> dict[str, Image.Image]:
    out = {}
    for name, j, dag in (("idle", IDLE, True), ("attack", ATTACK, True), ("hurt", HURT, False)):
        im = draw(j, dag)
        low = int(np.where((np.asarray(im)[..., 3] > 0).any(1))[0].max())
        assert low == META["bottom_row"], f"synthetic {name}: feet on row {low}"
        out[name] = im
    return out


def render_synthetic() -> dict[str, tuple[np.ndarray, dict]]:
    from gen import monster_anim as MA
    gen = MA.generate("synthetic", RIG, keyframes(), META)
    return {n: (f["img"], f) for n, f in gen.items()}


# Aesthetic findings that depend on the art and the rig tuning (the T1+ iteration loop); the stick figure's arm
# crossing its torso legitimately trips them. Everything else is guaranteed by construction and must pass.
TUNING = ("second ring", "dark edge", "new hole", "seam gaps", "adjacent IoU", "centroid", "opaque area", "bbox height")


def check_synthetic(frames: dict[str, tuple[np.ndarray, dict]]) -> tuple[list[str], list[str]]:
    """(construction failures, tuning findings) of the synthetic biped's frames."""
    from gen import monster_check as MC
    rep = MC.check_sprite("synthetic", RIG, keyframes(), META, {n: f for n, (_, f) in frames.items()}, with_lock=False)
    every = [f"{k}: {e}" for k, v in rep.items() for e in v]
    tuning = [e for e in every if any(t in e for t in TUNING)]
    return [e for e in every if e not in tuning], tuning
