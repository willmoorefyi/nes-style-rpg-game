"""FW-3 (docs/ROSTER_PLAN.md 5.2, 5.4) self-tests, run from selftest.py (test_monster_anim): the `naga` body template
on a synthetic right-facing six-armed naga (100x100, coil on row 96) with idle / attack / hurt / cast keyframes. It
renders deterministically, passes the by-construction checks, keeps its coil contact joints (and the coil pixels)
pinned in every frame, moves arm lists (`attack_hand: [n, n2, n3]`, `half_hand` at half t), and leaves the biped's
recipe joint sets exactly as they were."""
from __future__ import annotations

import math
from typing import Callable

import numpy as np
from PIL import Image, ImageDraw

OUTLINE = (6, 4, 10, 255)
SCALE, SKIN, GOLD, DARK = (70, 90, 60, 255), (150, 110, 90, 255), (200, 170, 60, 255), (50, 60, 45, 255)
META = {"bottom_row": 96, "floating": False}
BASE = {"c_f": (20, 91), "c_n": (70, 91), "s0": (62, 84), "s1": (55, 66), "tail0": (74, 90), "tail1": (84, 86),
        "tail2": (90, 78), "tail_tip": (92, 68)}
IDLE = {**BASE, "hip": (52, 52), "chest": (52, 36), "neck": (52, 28), "crown": (52, 14),
        "sh_n": (57, 36), "el_n": (66, 34), "hand_n": (72, 26), "sh_f": (47, 36), "el_f": (38, 34), "hand_f": (32, 26),
        "sh_n2": (57, 42), "el_n2": (67, 43), "hand_n2": (76, 40), "sh_f2": (47, 42), "el_f2": (37, 43), "hand_f2": (28, 40),
        "sh_n3": (57, 48), "el_n3": (65, 52), "hand_n3": (72, 56), "sh_f3": (47, 48), "el_f3": (39, 52), "hand_f3": (32, 56)}
ATTACK = {**IDLE, "s1": (56, 66), "hip": (54, 52), "chest": (56, 37), "neck": (58, 29), "crown": (60, 15),
          "sh_n": (61, 37), "el_n": (72, 36), "hand_n": (82, 33), "sh_n2": (61, 43), "el_n2": (73, 44), "hand_n2": (85, 44),
          "sh_n3": (60, 49), "el_n3": (70, 52), "hand_n3": (80, 53), "sh_f": (51, 37), "el_f": (44, 30), "hand_f": (40, 21),
          "sh_f2": (51, 43), "el_f2": (41, 41), "hand_f2": (33, 36), "sh_f3": (51, 49), "el_f3": (42, 52), "hand_f3": (35, 57),
          "tail1": (85, 85), "tail2": (92, 78), "tail_tip": (95, 70)}
HURT = {**IDLE, "s1": (53, 66), "hip": (50, 52), "chest": (48, 37), "neck": (46, 29), "crown": (44, 15),
        "sh_n": (53, 37), "el_n": (61, 33), "hand_n": (66, 25), "sh_f": (43, 37), "el_f": (34, 32), "hand_f": (28, 24),
        "sh_n2": (53, 43), "el_n2": (62, 42), "hand_n2": (70, 38), "sh_f2": (43, 43), "el_f2": (33, 41), "hand_f2": (25, 37),
        "sh_n3": (53, 49), "el_n3": (60, 51), "hand_n3": (67, 53), "sh_f3": (43, 49), "el_f3": (35, 50), "hand_f3": (28, 53),
        "tail2": (89, 77), "tail_tip": (88, 66)}
CAST = {**IDLE, "el_n": (65, 28), "hand_n": (70, 18), "el_f": (39, 28), "hand_f": (34, 18), "el_n2": (66, 38),
        "hand_n2": (74, 32), "el_f2": (38, 38), "hand_f2": (30, 32), "el_n3": (66, 48), "hand_n3": (74, 46),
        "el_f3": (38, 48), "hand_f3": (30, 46)}
NAGA = {"sprite": "synthetic_naga", "body": "naga", "facing": "right",
        "keyframes": {"idle": IDLE, "attack": ATTACK, "hurt": HURT, "cast": CAST}, "colors": {},
        "attack_hand": ["n", "n2", "n3"], "half_hand": ["f", "f2", "f3"], "cast_hand": ["n", "f"],
        "parts": {"weapon": {"remove": True}}}
ARMS = ("n", "f", "n2", "f2", "n3", "f3")
GROUND = ("c_f", "c_n", "s0", "tail0")              # the contact joints the template pins in every frame
STROKES = (("c_f", "c_n", SCALE, 9), ("tail0", "tail1", SCALE, 5), ("tail1", "tail2", SCALE, 4),
           ("tail2", "tail_tip", SCALE, 3), ("s0", "s1", SCALE, 8), ("s1", "hip", SCALE, 7)) + \
          tuple((f"sh_{s}", f"el_{s}", DARK, 3) for s in ARMS if "f" in s) + (("chest", "hip", GOLD, 10),) + \
          tuple((a, b, SKIN, 3) for s in ARMS if "n" in s for a, b in ((f"sh_{s}", f"el_{s}"), (f"el_{s}", f"hand_{s}")))
FAR_FORE = tuple((f"el_{s}", f"hand_{s}", DARK, 3) for s in ARMS if "f" in s)


def draw(j: dict) -> Image.Image:
    im = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for a, b, c, w in FAR_FORE + STROKES:
        d.line([j[a], j[b]], fill=c, width=w)
    cx, cy = (j["neck"][0] + j["crown"][0]) / 2, (j["neck"][1] + j["crown"][1]) / 2
    d.ellipse([cx - 6, cy - 7, cx + 6, cy + 7], fill=SKIN)
    a = np.asarray(im).copy()
    solid = a[..., 3] > 0
    ring = np.zeros_like(solid)
    ring[1:] |= solid[:-1]; ring[:-1] |= solid[1:]; ring[:, 1:] |= solid[:, :-1]; ring[:, :-1] |= solid[:, 1:]
    a[ring & ~solid] = OUTLINE
    return Image.fromarray(a, "RGBA")


def keyframes(cfg: dict | None = None) -> dict[str, Image.Image]:
    out = {}
    for name, j in (cfg or NAGA)["keyframes"].items():
        im = draw(j)
        low = int(np.where((np.asarray(im)[..., 3] > 0).any(1))[0].max())
        assert low == META["bottom_row"], f"synthetic naga {name}: coil on row {low}"
        out[name] = im
    return out


def render(cfg: dict) -> dict[str, dict]:
    from gen import monster_anim as MA
    return MA.generate(cfg["sprite"], cfg, keyframes(cfg), META)


def _biped_sets_unchanged(check: Callable[[bool, str], None]) -> None:
    """The arm-list generalisation leaves every biped / beast recipe set as the literal it replaced (locks unchanged)."""
    from gen import monster_anim as MA
    from gen import rig as R
    from gen import selftest_rig as SR
    from gen.monster_recipes import ARM, RECIPES
    for hand, cast_h in (("n", "n"), ("f", "f"), ("n", "f")):
        cfg = {**SR.RIG, "attack_hand": hand, "cast_hand": cast_h}
        rig = R.Rig(cfg, (80, 80))
        arm = [a.format(h=hand) for a in ARM]
        old = {"wind": ["crown", "neck", "chest", *arm, "tip"], "follow": ["crown", "chest", *arm, "tip"],
               "cast": ["crown", "chest", *[a.format(h=s) for s in "nf" for a in ARM]],
               "release": ["crown", *[a.format(h=cast_h) for a in ARM]], "all": "all"}
        pins = {"legs": list(R.LEGS), "feet": list(R.FEET), "planted": ["foot_f"]}
        bad = [n for n, r in RECIPES.items()
               if MA._joint_sets(rig, n, r, cfg) != (old[r["moves"]], pins[r["pins"]])]
        check(not bad, f"biped joint sets unchanged with attack_hand {hand}, cast_hand {cast_h} {bad}")


def run_naga(check: Callable[[bool, str], None]) -> None:
    from gen import monster_check as MC
    from gen import rig as R
    from gen import selftest_rig as SR
    _biped_sets_unchanged(check)
    try:
        one, two = render(NAGA), render(NAGA)
    except (ValueError, KeyError) as e:
        check(False, f"naga template renders ({type(e).__name__}: {e})")
        return
    check(sorted(one) == sorted(two) and all(np.array_equal(one[k]["img"], two[k]["img"]) for k in one),
          f"synthetic naga renders deterministically ({len(one)} frames)")
    check(len(one) == 13, f"a rigged naga boss gets 13 generated frames (with cast, daze) ({sorted(one)})")
    kfs = keyframes()
    rep = MC.check_sprite(NAGA["sprite"], NAGA, kfs, META, one, with_lock=False)
    every = [f"{k}: {e}" for k, v in rep.items() for e in v]
    fails = [e for e in every if not any(t in e for t in SR.TUNING)]
    check(not fails, f"synthetic naga frames pass the construction checks {fails[:3]}")
    print(f"  info {len(every) - len(fails)} tuning findings on the synthetic naga")
    rig = R.Rig(NAGA, (100, 100))
    moved = [f"{n}:{j}" for n, f in one.items() if f["joints"] for j in GROUND
             if f["joints"][j] != NAGA["keyframes"][f["src"]][j]]
    check(not moved, f"naga: coil contacts {list(GROUND)} pinned in every generated frame {moved[:4]}")
    ci = list(rig.parts).index("coil")
    off = []
    for n, f in one.items():
        if f["labels"] is None:
            continue
        s = np.asarray(kfs[f["src"]])
        own = R.segment(rig, f["src"], s)[0] == ci
        drawn = f["labels"] == ci                      # the coil may be covered (the body sinks onto it), never moved;
        near = own.copy()                               # joint-crack fills (3 rounds of reach 2) at the body root are allowed
        for _ in range(6):
            near[1:] |= near[:-1].copy(); near[:-1] |= near[1:].copy()
            near[:, 1:] |= near[:, :-1].copy(); near[:, :-1] |= near[:, 1:].copy()
        if not (drawn <= near).all() or not (f["img"][drawn & own] == s[drawn & own]).all() \
                or (drawn & own).sum() < 0.8 * own.sum():
            off.append(n)
    check(not off, f"naga: the coil's pixels stay put (own source position and colour) in every frame {off}")
    src = np.asarray(kfs["idle"])
    # the attack's coil marked 2 px off the idle's: a frame cut from either keyframe keeps that keyframe's contacts
    shifted = {**NAGA, "keyframes": {**NAGA["keyframes"], "attack": {**ATTACK, "c_f": (22, 91), "c_n": (72, 91),
                                                                 "s0": (64, 84), "tail0": (76, 90)}},
               "frames": {"atk_mid": {"pins": [], "tweaks": {"c_n": [3, -2], "s0": [2, 0], "tail0": [0, -3]}},
                          "hurt_in1": {"pins": ["hip"], "dy": 3, "tweaks": {"c_f": [-2, -2]}}}}
    unpinned = render(shifted)
    check(all(unpinned[n]["joints"][j] == shifted["keyframes"][unpinned[n]["src"]][j]
              for n in ("atk_mid", "hurt_in1") for j in GROUND),
          "naga: a frames.<f>.pins override or tweak cannot move the coil contacts")
    low = [n for n, f in one.items() if int(np.where((f["img"][..., 3] > 0).any(1))[0].max()) != META["bottom_row"]]
    check(not low, f"naga: every frame's lowest row is the coil's ground row {META['bottom_row']} {low}")
    single = render({**NAGA, "attack_hand": "n", "half_hand": []})
    w2, s2 = one["atk_wind2"]["joints"], single["atk_wind2"]["joints"]
    check(w2["hand_n"] == s2["hand_n"] and all(w2[f"hand_{s}"] != s2[f"hand_{s}"] for s in ("n2", "n3")),
          "naga: attack_hand [n, n2, n3] winds all three near arms back (one hand moves only its own arm)")
    _half(check, rig)
    # the whole body hangs from the pinned coil: the recipe's dy still lowers it, and a tweak moves only its own joint
    # (children of pinned contact joints are not re-derived like a pinned foot's toes)
    flat = render({**NAGA, "frames": {"atk_wind2": {"dy": 0}}})["atk_wind2"]["joints"]
    tw = render({**NAGA, "frames": {"atk_wind2": {"tweaks": {"el_n2": [0, -3]}}}})["atk_wind2"]["joints"]
    check(w2["chest"][1] - flat["chest"][1] == 2 and w2["crown"][1] - flat["crown"][1] == 2,
          f"naga: atk_wind2's dy 2 lowers the upper body ({w2['chest']} vs {flat['chest']} at dy 0)")
    check(tw["el_n2"] == (w2["el_n2"][0], w2["el_n2"][1] - 3) and tw["hand_n2"] == w2["hand_n2"],
          "naga: a tweak on an elbow moves only the elbow (tweaks do not add up along the arm)")
    zero = render({**NAGA, "frames": {"hurt_in1": {"t": 0.0}}})["hurt_in1"]["img"]
    solid = src[..., 3] > 0
    lost = int((solid & (zero != src).any(2)).sum())
    check(lost == 0, f"naga: hurt_in1 at t = 0 keeps every idle pixel ({lost} of {int(solid.sum())} lost or changed)")


def _half(check: Callable[[bool, str], None], rig) -> None:
    """`half_hand` arms turn by half the recipe's t: a 40 px far upper arm turned 60 deg between the keys turns
    about 21 deg at u = 0.35 when listed in attack_hand and about 10.5 deg when listed in half_hand."""
    from gen import rig as R
    S = dict(IDLE)
    S["el_f2"] = (S["sh_f2"][0] - 40, S["sh_f2"][1])
    a = math.radians(-60)
    T = {**S, "el_f2": (S["sh_f2"][0] - 40 * math.cos(a), S["sh_f2"][1] + 40 * math.sin(a))}

    def turn(half) -> float:
        J = R.solve(rig, S, T, 0.35, ["sh_f2", "el_f2"], list(rig.ground), half=half)
        return abs(math.degrees(R._wrap(R._ang(J["sh_f2"], J["el_f2"]) - R._ang(S["sh_f2"], S["el_f2"]))))
    full, half = turn(set()), turn({"sh_f2", "el_f2"})
    check(abs(full - 21.0) <= 2.0 and abs(half - full / 2) <= 2.0,
          f"naga: a half_hand arm turns half as far ({half:.1f} vs {full:.1f} deg)")

