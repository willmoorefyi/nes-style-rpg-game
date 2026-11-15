"""FW-1 (docs/ROSTER_PLAN.md 5.2, 5.4) self-tests, run from selftest.py (test_monster_anim): the `floating` body template
and its `swimmer` preset on synthetic right-facing figures hovering above the plain (100x100, lowest row 84, feet row
96 unused). They render deterministically, pass the by-construction checks, are judged by the float band (check 8 for
floating sheets: the lowest row stays within +-1 of the source's, lerped toward the target and offset by the frame's
body dy) instead of the feet, drift back with the template's whole-body `dx`, bob the whole sprite in idle_b, and
leave every other template's recipes exactly as they were."""
from __future__ import annotations

from typing import Callable

import numpy as np
from PIL import Image, ImageDraw

OUTLINE = (6, 4, 10, 255)
ROBE, SKIN, WING, FIN = (90, 100, 150, 255), (200, 190, 170, 255), (220, 225, 235, 255), (70, 120, 140, 255)
META = {"bottom_row": 96, "floating": True}
LOW = 84                                                     # the synthetic figures hover: lowest opaque row
IDLE = {"core": (50, 50), "base": (50, 70), "neck": (50, 36), "crown": (50, 22), "sh_n": (55, 40), "el_n": (60, 48),
        "hand_n": (63, 56), "sh_f": (45, 40), "el_f": (40, 48), "hand_f": (37, 56), "tail0": (50, 74),
        "tail1": (48, 78), "tail_tip": (46, 81), "wr_n": (56, 34), "wt_n": (78, 18), "wr_f": (44, 34), "wt_f": (22, 18)}
ATTACK = {**IDLE, "core": (54, 51), "base": (50, 70), "neck": (57, 37), "crown": (60, 24), "sh_n": (59, 41),
          "el_n": (68, 42), "hand_n": (76, 44), "tail1": (46, 78), "tail_tip": (43, 81), "wr_n": (60, 35),
          "wt_n": (80, 22), "wr_f": (48, 35), "wt_f": (26, 20)}
HURT = {**IDLE, "core": (47, 50), "neck": (45, 37), "crown": (42, 24), "el_n": (58, 45), "hand_n": (62, 50),
        "el_f": (37, 45), "hand_f": (33, 50), "wr_n": (53, 34), "wt_n": (72, 14), "wr_f": (41, 34), "wt_f": (20, 22)}
CAST = {**IDLE, "el_n": (61, 44), "hand_n": (67, 44), "el_f": (39, 44), "hand_f": (33, 44)}
GHOST = {"sprite": "synthetic_ghost", "body": "floating", "facing": "right",
         "keyframes": {"idle": IDLE, "attack": ATTACK, "hurt": HURT, "cast": CAST}, "colors": {},
         "parts": {"weapon": {"remove": True}}}
STROKES = (("wr_f", "wt_f", WING, 5), ("sh_f", "el_f", SKIN, 3), ("el_f", "hand_f", SKIN, 3), ("base", "tail0", ROBE, 9),
           ("tail0", "tail1", ROBE, 6), ("tail1", "tail_tip", ROBE, 4), ("core", "base", ROBE, 14),
           ("neck", "core", ROBE, 10), ("sh_n", "el_n", SKIN, 3), ("el_n", "hand_n", SKIN, 3), ("wr_n", "wt_n", WING, 5))
FISH_IDLE = {"core": (50, 60), "head": (62, 60), "snout": (76, 62), "b1": (40, 60), "b2": (30, 62),
             "tail_tip": (20, 58), "wr_n": (50, 64), "wt_n": (46, 74), "wr_f": (52, 56), "wt_f": (50, 46)}
FISH_ATTACK = {**FISH_IDLE, "core": (54, 60), "head": (66, 60), "snout": (81, 60), "b1": (43, 60), "b2": (32, 60),
               "tail_tip": (21, 60)}
FISH_HURT = {**FISH_IDLE, "core": (48, 59), "head": (59, 56), "snout": (72, 54), "b1": (38, 61), "b2": (28, 64),
             "tail_tip": (18, 63)}
FISH = {"sprite": "synthetic_fish", "body": "swimmer", "facing": "right",
        "keyframes": {"idle": FISH_IDLE, "attack": FISH_ATTACK, "hurt": FISH_HURT}, "colors": {}}
FISH_STROKES = (("wr_f", "wt_f", FIN, 4), ("b2", "tail_tip", FIN, 6), ("b1", "b2", FIN, 9), ("core", "b1", FIN, 12),
                ("core", "head", FIN, 12), ("head", "snout", SKIN, 7), ("wr_n", "wt_n", FIN, 4))


def draw(j: dict, strokes=STROKES, head: bool = True) -> Image.Image:
    im = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for a, b, c, w in strokes:
        if a in j and b in j:
            d.line([j[a], j[b]], fill=c, width=w)
    if head:
        cx, cy = (j["neck"][0] + j["crown"][0]) / 2, (j["neck"][1] + j["crown"][1]) / 2
        d.ellipse([cx - 6, cy - 7, cx + 6, cy + 7], fill=SKIN)
    a = np.asarray(im).copy()
    solid = a[..., 3] > 0
    ring = np.zeros_like(solid)
    ring[1:] |= solid[:-1]; ring[:-1] |= solid[1:]; ring[:, 1:] |= solid[:, :-1]; ring[:, :-1] |= solid[:, 1:]
    a[ring & ~solid] = OUTLINE
    im = Image.fromarray(a, "RGBA")
    ys = np.where((a[..., 3] > 0).any(1))[0]
    return bob_to(im, LOW - int(ys.max()))


def bob_to(im: Image.Image, dy: int) -> Image.Image:
    """Shift the figure so its lowest row is LOW (the cut gives every floating pose one lowest row)."""
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, dy))
    return out


def keyframes(cfg: dict) -> dict[str, Image.Image]:
    fish = cfg["body"] == "swimmer"
    return {k: draw(j, FISH_STROKES if fish else STROKES, not fish) for k, j in cfg["keyframes"].items()}


def _shifted(cfg: dict) -> dict:
    """The rig joints of `cfg` moved like keyframes() moves the drawings (each keyframe onto lowest row LOW)."""
    fish = cfg["body"] == "swimmer"
    out = {}
    for k, j in cfg["keyframes"].items():
        im = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        for a, b, c, w in (FISH_STROKES if fish else STROKES):
            d.line([j[a], j[b]], fill=c, width=w)
        if not fish:
            cx, cy = (j["neck"][0] + j["crown"][0]) / 2, (j["neck"][1] + j["crown"][1]) / 2
            d.ellipse([cx - 6, cy - 7, cx + 6, cy + 7], fill=SKIN)
        low = int(np.where((np.asarray(im)[..., 3] > 0).any(1))[0].max()) + 1     # + the outline ring
        out[k] = {n: (x, y + LOW - low) for n, (x, y) in j.items()}
    return {**cfg, "keyframes": out}


def render(cfg: dict, meta: dict | None = None) -> dict[str, dict]:
    from gen import monster_anim as MA
    return MA.generate(cfg["sprite"], cfg, keyframes(cfg), meta or META)


def _low(a: np.ndarray) -> int:
    return int(np.where((a[..., 3] > 0).any(1))[0].max())


def run_floating(check: Callable[[bool, str], None]) -> None:
    from gen import anim_feet as AF
    from gen import monster_check as MC
    from gen import rig as R
    from gen import selftest_rig as SR
    _recipes_unchanged(check)
    ghost, fish = _shifted(GHOST), _shifted(FISH)
    for cfg, n_frames in ((ghost, 13), (fish, 10)):
        body = cfg["body"]
        try:
            one, two = render(cfg), render(cfg)
        except (ValueError, KeyError) as e:
            check(False, f"{body} template renders ({type(e).__name__}: {e})")
            continue
        check(sorted(one) == sorted(two) and all(np.array_equal(one[k]["img"], two[k]["img"]) for k in one),
              f"synthetic {body} renders deterministically ({len(one)} frames)")
        check(len(one) == n_frames, f"a rigged {body} gets {n_frames} generated frames ({sorted(one)})")
        kfs = keyframes(cfg)
        rep = MC.check_sprite(cfg["sprite"], cfg, kfs, META, one, with_lock=False)
        every = [f"{k}: {e}" for k, v in rep.items() for e in v]
        fails = [e for e in every if not any(t in e for t in SR.TUNING)]
        check(not fails, f"synthetic {body} frames pass the construction checks {fails[:3]}")
        print(f"  info {len(every) - len(fails)} tuning findings on the synthetic {body}")
        rig = R.Rig(cfg, (100, 100))
        check(rig.floating and not rig.feet and not rig.legs and not rig.limbs,
              f"{body}: a floating template has no feet, legs or IK limbs (the float band judges it)")
        check(all(f.get("contact") is None and not f.get("foot_parts") for f in one.values() if f["labels"] is not None),
              f"{body}: no ground contact or foot parts in any frame")
        idle_b = one["idle_b"]["img"]
        src = np.asarray(kfs["idle"])
        check(np.array_equal(idle_b[1:], src[:-1]) and not idle_b[0].any(),
              f"{body}: idle_b moves the whole sprite 1 px down (no breath joint cut)")
        S = cfg["keyframes"]["idle"]
        w2 = one["atk_wind2"]["joints"]
        check(w2["core"] == (S["core"][0] - 2, S["core"][1] + 1),
              f"{body}: atk_wind2 drifts back 2 px and sinks 1 ({w2['core']} vs idle {S['core']})")
        wing = [one[n]["joints"]["wr_n"] for n in ("atk_wind1", "atk_wind2")]
        check(wing == [(S["wr_n"][0] - 1, S["wr_n"][1] + 1), (S["wr_n"][0] - 2, S["wr_n"][1] + 1)],
              f"{body}: a wing on its own root rides the whole-body drift {wing}")
        # float band (check 8 for floating sheets)
        f = one["atk_wind2"]
        T = kfs[f["toward"]]
        a = f["img"]
        ok = AF.feet(a, np.asarray(kfs[f["src"]]), np.asarray(T), f["u"], META["bottom_row"], f["pinned"], True, f["dy"])
        down3 = np.zeros_like(a)
        down3[3:] = a[:-3]
        bad = AF.feet(down3, np.asarray(kfs[f["src"]]), np.asarray(T), f["u"], META["bottom_row"], f["pinned"], True,
                      f["dy"])
        check(not ok and bool(bad) and "float band" in bad[0],
              f"{body}: the float band passes the frame and fails it 3 px lower ({ok} / {bad})")
        lows = {n: _low(fr["img"]) for n, fr in one.items()}
        check(all(abs(lows[n] - (LOW + one[n].get("dy", 0))) <= 1 for n in lows if one[n]["src"] == "idle"),
              f"{body}: every idle-sourced frame keeps the idle lowest row (+ its sink) +-1 {lows}")
    # the meta flag alone (a floating sheet on a biped rig) switches check 8 to the float band, never to feet x
    lifted = np.zeros((100, 100, 4), np.uint8)
    lifted[40:60, 40:60] = ROBE
    check(not AF.feet(lifted, lifted, lifted, 0.0, 96, True, True, 0),
          "a floating sheet's frame hovering 37 rows above the feet row passes (no ground row)")
    check(bool(AF.feet(lifted, lifted, lifted, 0.0, 96, True, False, 0)),
          "the same frame on a grounded sheet fails check 8 (feet on the plain)")
    zero = render({**ghost, "frames": {"hurt_in1": {"t": 0.0, "dx": 0}}})["hurt_in1"]["img"]
    idle = np.asarray(keyframes(ghost)["idle"])
    lost = int(((idle[..., 3] > 0) & (zero != idle).any(2)).sum())
    check(lost == 0, f"floating: hurt_in1 at t = 0, dx 0 keeps every idle pixel ({lost} lost or changed)")
    fl = render({**fish, "frames": {"atk_wind2": {"dx": -3}}})["atk_wind2"]["joints"]
    check(fl["core"][0] == FISH["keyframes"]["idle"]["core"][0] - 3, "a frames.<f>.dx override replaces the template's")


def _recipes_unchanged(check: Callable[[bool, str], None]) -> None:
    """FW-1 is additive: the template recipe overrides (dx, dy) exist for floating bodies only; every other body's
    solve gets dx 0 and the shared recipes."""
    from gen import rig as R
    from gen import selftest_rig as SR
    for body in ("biped", "quadruped", "bird", "naga"):
        rig = R.Rig({**SR.RIG, "body": body, "keyframes": {}}, (80, 80))
        check(getattr(rig, "floating", None) is False and getattr(rig, "recipes", None) == {},
              f"{body}: no floating flag, no template recipe overrides")
