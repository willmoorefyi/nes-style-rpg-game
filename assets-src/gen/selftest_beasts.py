"""Synthetic right-facing quadruped (110x80) and bird (84x80) rigs for the T5a body templates (docs/ENEMY_ANIM_PLAN.md
4.1): both render deterministically, pass the by-construction checks, pin every foot in the wind-up, and a frame
solved at t = 0 reproduces its keyframe exactly (chain parts are warped over their whole segmented area)."""
from __future__ import annotations

from typing import Callable

import numpy as np
from PIL import Image, ImageDraw

OUTLINE = (6, 4, 10, 255)
FUR, BELLY, DARK, HORN = (120, 120, 130, 255), (170, 165, 150, 255), (80, 80, 92, 255), (200, 180, 60, 255)
META = {"bottom_row": 76, "floating": False}

Q_IDLE = {"hip": (32, 40), "back": (50, 38), "chest": (70, 40), "neck": (78, 32), "head": (84, 25), "snout": (97, 28),
          "tail0": (25, 37), "tail1": (18, 33), "tail2": (13, 28), "tail_tip": (9, 22),
          "sh_n": (72, 46), "el_n": (75, 60), "paw_n": (74, 72), "sh_f": (66, 46), "el_f": (63, 60), "paw_f": (64, 72),
          "hip_n": (35, 46), "knee_n": (39, 60), "foot_n": (37, 72), "hip_f": (29, 46), "knee_f": (26, 60), "foot_f": (27, 72),
          "ftoe_n": (78, 74), "ftoe_f": (68, 74), "toe_n": (41, 74), "toe_f": (31, 74)}
Q_ATTACK = {**Q_IDLE, "back": (52, 40), "chest": (73, 43), "neck": (82, 38), "head": (89, 33), "snout": (100, 37),
            "tail1": (18, 32), "tail2": (12, 26), "tail_tip": (9, 20), "sh_n": (75, 49), "el_n": (80, 61),
            "paw_n": (80, 72), "ftoe_n": (84, 74), "sh_f": (69, 49), "el_f": (69, 61), "paw_f": (70, 72), "ftoe_f": (74, 74)}
Q_HURT = {**Q_IDLE, "back": (49, 35), "chest": (68, 34), "neck": (73, 25), "head": (77, 17), "snout": (89, 18),
          "tail1": (18, 38), "tail2": (12, 36), "tail_tip": (7, 32), "sh_n": (69, 40), "el_n": (72, 56),
          "paw_n": (71, 72), "ftoe_n": (75, 74), "sh_f": (63, 40), "el_f": (59, 56), "paw_f": (61, 72), "ftoe_f": (65, 74)}
QUAD = {"sprite": "synthetic_quad", "body": "quadruped", "facing": "right",
        "keyframes": {"idle": Q_IDLE, "attack": Q_ATTACK, "hurt": Q_HURT}, "colors": {},
        "frames": {"atk_mid": {"tweaks": {"paw_f": [-3, 0], "ftoe_f": [-3, 0]}}}}   # far forepaw on its lerp (check 8)
# a rearing hurt (wolf, dragon): chest up, both forepaws off the ground; only the hind paws stay grounded
Q_REAR = {**Q_IDLE, "back": (42, 30), "chest": (50, 18), "neck": (58, 12), "head": (66, 9), "snout": (78, 12),
          "sh_n": (54, 24), "el_n": (64, 32), "paw_n": (70, 42), "ftoe_n": (74, 44),
          "sh_f": (48, 24), "el_f": (58, 34), "paw_f": (64, 44), "ftoe_f": (68, 46)}
REAR = {**QUAD, "sprite": "synthetic_rear", "keyframes": {**QUAD["keyframes"], "hurt": Q_REAR},
        "frames": {"hurt_in1": {"t": 0.25, "pins": ["foot_n", "foot_f"]}, "hurt_in2": {"t": 0.25, "pins": ["foot_n", "foot_f"]}}}

B_IDLE = {"hip": (36, 52), "chest": (48, 44), "neck": (52, 34), "head": (55, 24), "beak": (63, 26),
          "tail0": (28, 50), "tail1": (20, 44), "tail2": (16, 34), "tail_tip": (12, 26),
          "wsh_n": (46, 42), "wel_n": (38, 46), "wtip_n": (26, 52), "wsh_f": (44, 40), "wel_f": (36, 42), "wtip_f": (26, 46),
          "hip_n": (40, 58), "knee_n": (43, 66), "foot_n": (42, 74), "toe_n": (47, 74),
          "hip_f": (34, 58), "knee_f": (31, 66), "foot_f": (32, 74), "toe_f": (37, 74)}
B_ATTACK = {**B_IDLE, "chest": (50, 46), "neck": (58, 40), "head": (64, 34), "beak": (72, 37),
            "wel_n": (39, 40), "wtip_n": (28, 40), "wel_f": (37, 37), "wtip_f": (28, 36)}
B_HURT = {**B_IDLE, "chest": (46, 43), "neck": (47, 33), "head": (48, 22), "beak": (56, 21),
          "tail1": (21, 46), "tail2": (15, 38), "tail_tip": (10, 31), "wel_n": (37, 40), "wtip_n": (27, 38)}
BIRD = {"sprite": "synthetic_bird", "body": "bird", "facing": "right",
        "keyframes": {"idle": B_IDLE, "attack": B_ATTACK, "hurt": B_HURT}, "colors": {}}

Q_STROKES = (("sh_f", "el_f", DARK, 5), ("el_f", "paw_f", DARK, 4), ("hip_f", "knee_f", DARK, 6),
             ("knee_f", "foot_f", DARK, 4), ("foot_f", "toe_f", DARK, 3), ("paw_f", "ftoe_f", DARK, 3), ("tail0", "tail1", FUR, 5), ("tail1", "tail2", FUR, 4),
             ("tail2", "tail_tip", FUR, 3), ("hip", "back", FUR, 21), ("back", "chest", BELLY, 21),
             ("hip_n", "knee_n", FUR, 6), ("knee_n", "foot_n", FUR, 4), ("foot_n", "toe_n", FUR, 3), ("sh_n", "el_n", FUR, 5), ("el_n", "paw_n", FUR, 4),
             ("paw_n", "ftoe_n", FUR, 3),
             ("chest", "neck", FUR, 8), ("neck", "head", FUR, 8), ("head", "snout", BELLY, 8))
B_STROKES = (("wsh_f", "wel_f", DARK, 5), ("wel_f", "wtip_f", DARK, 4), ("hip_f", "knee_f", HORN, 3),
             ("knee_f", "foot_f", HORN, 3), ("foot_f", "toe_f", HORN, 3), ("tail0", "tail1", FUR, 5),
             ("tail1", "tail2", FUR, 4), ("tail2", "tail_tip", FUR, 4), ("chest", "hip", BELLY, 15),
             ("hip_n", "knee_n", HORN, 3), ("knee_n", "foot_n", HORN, 3), ("foot_n", "toe_n", HORN, 3),
             ("chest", "neck", FUR, 6), ("neck", "head", FUR, 6), ("head", "beak", HORN, 5),
             ("wsh_n", "wel_n", DARK, 6), ("wel_n", "wtip_n", DARK, 5))


def draw(j: dict, strokes, size) -> Image.Image:
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for a, b, c, w in strokes:
        d.line([j[a], j[b]], fill=c, width=w)
    a = np.asarray(im).copy()
    solid = a[..., 3] > 0
    ring = np.zeros_like(solid)
    ring[1:] |= solid[:-1]; ring[:-1] |= solid[1:]; ring[:, 1:] |= solid[:, :-1]; ring[:, :-1] |= solid[:, 1:]
    a[ring & ~solid] = OUTLINE
    return Image.fromarray(a, "RGBA")


def keyframes(cfg: dict) -> dict[str, Image.Image]:
    strokes, size = (Q_STROKES, (110, 80)) if cfg["body"] == "quadruped" else (B_STROKES, (84, 80))
    out = {}
    for name, j in cfg["keyframes"].items():
        im = draw(j, strokes, size)
        low = int(np.where((np.asarray(im)[..., 3] > 0).any(1))[0].max())
        assert low == META["bottom_row"], f"{cfg['sprite']} {name}: feet on row {low}"
        out[name] = im
    return out


def render(cfg: dict) -> dict[str, dict]:
    from gen import monster_anim as MA
    return MA.generate(cfg["sprite"], cfg, keyframes(cfg), META)


FEET_ERRS = ("lowest opaque row", "feet x", "no foot pixels", "below the plain", "kept paw")


def run_rearing(check: Callable[[bool, str], None]) -> None:
    """Check 8 judges a frame that releases feet (a rearing hurt_in1 / hurt_in2) on the ground contact of the paws it
    keeps pinned in its pixel source: the forepaws may leave the bottom rows, the pinned hind paws may not move."""
    from gen import anim_checks as C
    from gen import monster_check as MC
    kfs = keyframes(REAR)
    gen = render(REAR)
    rep = MC.check_sprite(REAR["sprite"], REAR, kfs, META, gen, with_lock=False)
    for name in ("hurt_in1", "hurt_in2"):
        f = gen[name]
        S = REAR["keyframes"][f["src"]]
        up = all(f["joints"][p][1] < Q_IDLE[p][1] for p in ("paw_n", "paw_f"))
        check(up and all(f["joints"][p] == S[p] for p in ("foot_n", "foot_f")),
              f"rearing {name}: forepaws off the ground, hind feet pinned to {f['src']}")
        bad = [e for e in rep[name] if e.startswith(FEET_ERRS)]
        check(not bad, f"rearing {name}: feet judged on the pinned paws' ground contact {bad}")
    f = gen["hurt_in1"]
    src = np.asarray(kfs["idle"])
    contact = f.get("contact")
    lifted = np.roll(f["img"], -1, 0)
    check(bool(C.feet(lifted, src, src, f["u"], 76, True, False, contact=contact)) if contact is not None else False,
          "rearing hurt_in1 with the pinned hind paws lifted 1 px fails")
    low = f["img"].copy()
    low[77, 2] = (*FUR[:3], 255)
    check(bool(C.feet(low, src, src, f["u"], 76, True, False, contact=contact)) if contact is not None else False,
          "rearing hurt_in1 with a pixel below the plain fails")


def run_beasts(check: Callable[[bool, str], None]) -> None:
    from gen import monster_check as MC
    from gen import rig as R
    from gen import selftest_rig as SR
    for cfg in (QUAD, BIRD):
        body = cfg["body"]
        try:
            one, two = render(cfg), render(cfg)
        except (ValueError, KeyError) as e:
            check(False, f"{body} template renders ({type(e).__name__}: {e})")
            continue
        check(sorted(one) == sorted(two) and all(np.array_equal(one[k]["img"], two[k]["img"]) for k in one),
              f"synthetic {body} renders deterministically ({len(one)} frames)")
        check(len(one) == 10, f"a rigged {body} gets 10 generated frames (with daze, daze_b) ({sorted(one)})")
        rep = MC.check_sprite(cfg["sprite"], cfg, keyframes(cfg), META, one, with_lock=False)
        every = [f"{k}: {e}" for k, v in rep.items() for e in v]
        fails = [e for e in every if not any(t in e for t in SR.TUNING)]
        check(not fails, f"synthetic {body} frames pass the construction checks {fails[:3]}")
        print(f"  info {len(every) - len(fails)} tuning findings on the synthetic {body}")
        rig = R.Rig(cfg, keyframes(cfg)["idle"].size)
        S = cfg["keyframes"]["idle"]
        for name in ("atk_wind1", "atk_wind2", "atk_recover"):
            moved = [f for f in rig.feet if one[name]["joints"][f] != S[f]]
            check(not moved, f"{body} {name}: every foot ({', '.join(rig.feet)}) pinned to idle {moved}")
        zero = render({**cfg, "frames": {"hurt_in1": {"t": 0.0}}})["hurt_in1"]["img"]
        idle = np.asarray(keyframes(cfg)["idle"])
        src = idle[..., 3] > 0                          # (joint-crack closing may add ink; no source pixel may change)
        lost = int((src & (zero != idle).any(2)).sum())
        check(lost == 0, f"{body}: hurt_in1 at t = 0 keeps every idle pixel ({lost} of {int(src.sum())} lost or changed)")
    run_rearing(check)
    try:
        R.Rig({**QUAD, "body": "serpent"}, (110, 80))
        check(False, "an unknown body template is rejected")
    except ValueError:
        check(True, "an unknown body template is rejected")
