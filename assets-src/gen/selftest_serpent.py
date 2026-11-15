"""FW-2 (docs/ROSTER_PLAN.md 5.2 serpent / rooted rows, 5.4) self-tests, run from selftest.py (test_monster_anim): the
`serpent` body template on a synthetic right-facing cobra (80x80, feet row 76: a coil on the ground, a rising body, a
head, a tail raised only in the attack key) and the `rooted` preset on a synthetic root mass with three tentacles.
They render deterministically and pass the construction checks; the coil contacts (and the rooted mass and tentacle
roots) never move; the wind-up draws the head back and down; a tail marked only in the attack key exists only in
attack-sourced frames; idle_b bobs above the neck; non-lead tentacles sway with half the motion; check 8 judges the
coil per foot; every other body keeps its recipes."""
from __future__ import annotations

from typing import Callable

import numpy as np
from PIL import Image, ImageDraw

OUTLINE = (6, 4, 10, 255)
SCALE, BELLY, HOOD, LEAF = (120, 130, 60, 255), (220, 210, 150, 255), (100, 110, 50, 255), (90, 150, 70, 255)
META = {"bottom_row": 76, "floating": False}
C_IDLE = {"c_f": (22, 72), "c_n": (58, 72), "body0": (50, 62), "body1": (46, 48), "neck": (44, 34), "head": (44, 22),
          "snout": (56, 20)}
C_ATTACK = {**C_IDLE, "body1": (42, 48), "neck": (50, 32), "head": (56, 24), "snout": (68, 24),
            "t1": (22, 68), "t2": (14, 62), "t3": (11, 54), "tail_tip": (12, 47)}
C_HURT = {**C_IDLE, "body1": (50, 48), "neck": (44, 36), "head": (38, 26), "snout": (50, 22)}
COBRA = {"sprite": "synthetic_cobra", "body": "serpent", "facing": "right",
         "keyframes": {"idle": C_IDLE, "attack": C_ATTACK, "hurt": C_HURT}, "colors": {},
         "parts": {"tail": {"in": ["attack"]}}}
R_IDLE = {"root": (40, 72), "maw": (40, 56), "k1_0": (50, 58), "k1_1": (58, 50), "k1_2": (64, 42), "k1_3": (68, 34),
          "k2_0": (30, 58), "k2_1": (22, 50), "k2_2": (18, 42), "k2_3": (16, 34),
          "k3_0": (40, 50), "k3_1": (41, 40), "k3_2": (43, 30), "k3_3": (46, 22)}
R_ATTACK = {**R_IDLE, "k1_1": (60, 54), "k1_2": (68, 50), "k1_3": (76, 48), "k3_1": (44, 40), "k3_2": (48, 31),
            "k3_3": (53, 24)}
R_HURT = {**R_IDLE, "k1_1": (56, 48), "k1_2": (60, 39), "k1_3": (62, 30), "k2_1": (21, 49), "k2_2": (16, 41),
          "k2_3": (13, 33), "maw": (40, 58)}
OCHU = {"sprite": "synthetic_ochu", "body": "rooted", "facing": "right", "lead": [1],
        "keyframes": {"idle": R_IDLE, "attack": R_ATTACK, "hurt": R_HURT}, "colors": {}}


def _ink(im: Image.Image) -> Image.Image:
    a = np.asarray(im).copy()
    solid = a[..., 3] > 0
    ring = np.zeros_like(solid)
    ring[1:] |= solid[:-1]; ring[:-1] |= solid[1:]; ring[:, 1:] |= solid[:, :-1]; ring[:, :-1] |= solid[:, 1:]
    a[ring & ~solid] = OUTLINE
    low = int(np.where((a[..., 3] > 0).any(1))[0].max())
    assert low == META["bottom_row"], f"synthetic figure: lowest row {low}"
    return Image.fromarray(a, "RGBA")


def draw_cobra(j: dict) -> Image.Image:
    im = Image.new("RGBA", (80, 80), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if "t1" in j:
        for a, b in (("t1", "t2"), ("t2", "t3"), ("t3", "tail_tip")):
            d.line([j[a], j[b]], fill=SCALE, width=4)
    d.ellipse([16, 62, 64, 75], fill=SCALE)
    d.ellipse([28, 65, 52, 71], fill=HOOD)
    for a, b in (("body0", "body1"), ("body1", "neck")):
        d.line([j[a], j[b]], fill=BELLY, width=7)
    hx, hy = j["head"]
    d.ellipse([hx - 7, hy - 6, hx + 5, hy + 8], fill=HOOD)
    d.line([j["head"], j["snout"]], fill=SCALE, width=6)
    return _ink(im)


def draw_ochu(j: dict) -> Image.Image:
    im = Image.new("RGBA", (80, 80), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for i in (1, 2, 3):
        for s in range(3):
            d.line([j[f"k{i}_{s}"], j[f"k{i}_{s + 1}"]], fill=LEAF, width=4)
    mx, my = j["maw"]
    d.ellipse([22, 50, 58, 75], fill=SCALE)
    d.ellipse([mx - 5, my - 2, mx + 5, my + 4], fill=BELLY)
    return _ink(im)


def keyframes(cfg: dict) -> dict[str, Image.Image]:
    fn = draw_ochu if cfg["body"] == "rooted" else draw_cobra
    return {k: fn(j) for k, j in cfg["keyframes"].items()}


def render(cfg: dict) -> dict[str, dict]:
    from gen import monster_anim as MA
    return MA.generate(cfg["sprite"], cfg, keyframes(cfg), META)


def run_serpent(check: Callable[[bool, str], None]) -> None:
    from gen import monster_check as MC
    from gen import rig as R
    from gen import selftest_rig as SR
    for cfg in (COBRA, OCHU):
        body = cfg["body"]
        try:
            one, two = render(cfg), render(cfg)
        except (ValueError, KeyError) as e:
            check(False, f"{body} template renders ({type(e).__name__}: {e})")
            continue
        check(sorted(one) == sorted(two) and all(np.array_equal(one[k]["img"], two[k]["img"]) for k in one),
              f"synthetic {body} renders deterministically ({len(one)} frames)")
        check(len(one) == 10, f"a rigged {body} gets 10 generated frames")
        rep = MC.check_sprite(cfg["sprite"], cfg, keyframes(cfg), META, one, with_lock=False)
        every = [f"{k}: {e}" for k, v in rep.items() for e in v]
        fails = [e for e in every if not any(t in e for t in SR.TUNING)]
        check(not fails, f"synthetic {body} frames pass the construction checks {fails[:3]}")
        print(f"  info {len(every) - len(fails)} tuning findings on the synthetic {body} {every[:2]}")
        rig = R.Rig(cfg, (80, 80))
        moved = [f"{n}:{j}" for n, f in one.items() for j in rig.ground
                 if f["joints"] and j in f["joints"] and j in rig.keyframes[f["src"]]
                 and f["joints"][j] != rig.keyframes[f["src"]][j]]
        check(not moved and rig.ground, f"{body}: the ground joints {rig.ground} never move {moved[:3]}")
        fp = next(f for f in one.values() if f["labels"] is not None)["foot_parts"]
        check(bool(fp) and all(fp.values()), f"{body}: check 8 judges the contacts per foot {sorted(fp)}")
    _cobra(check)
    _rooted(check)
    from gen import selftest_translate as ST
    ST.run_translate(check)
    _recipes_unchanged(check)


def _cobra(check: Callable[[bool, str], None]) -> None:
    try:
        one = render(COBRA)
    except (ValueError, KeyError):
        return
    w2 = one["atk_wind2"]["joints"]
    check(w2["head"][1] > C_IDLE["head"][1] and w2["head"][0] < C_IDLE["head"][0],
          f"serpent: atk_wind2 draws the head back and down ({w2['head']} vs idle {C_IDLE['head']})")
    names = one["atk_mid"]["names"]
    ti = names.index("tail")
    check(not (one["atk_wind2"]["labels"] == ti).any() and (one["atk_mid"]["labels"] == ti).any(),
          "serpent: a tail marked only in the attack key exists only in attack-sourced frames")
    from gen import puppet as PU
    bob = np.asarray(PU.bob(keyframes(COBRA)["idle"], C_IDLE["neck"][1], 1))
    check(np.array_equal(one["idle_b"]["img"], bob), "serpent: idle_b moves everything above the neck 1 px down")


def _rooted(check: Callable[[bool, str], None]) -> None:
    try:
        one = render(OCHU)
    except (ValueError, KeyError):
        return
    w2 = one["atk_wind2"]["joints"]
    d1 = np.hypot(w2["k1_3"][0] - R_IDLE["k1_3"][0], w2["k1_3"][1] - R_IDLE["k1_3"][1])
    d3 = np.hypot(w2["k3_3"][0] - R_IDLE["k3_3"][0], w2["k3_3"][1] - R_IDLE["k3_3"][1])
    check(d1 > 0 and d3 > 0 and d3 < d1, f"rooted: the lead tentacle pulls back further than a swaying one "
                                         f"(lead {d1:.1f} px, other {d3:.1f} px)")
    from gen import rig as R
    from gen import rig_serpent as RS
    check(RS.rooted_half({"lead": [1]}) == {f"k{i}_{s}" for i in range(2, RS.K + 1) for s in (1, 2, 3)} and
          RS.rooted_half({}) == set(), "rooted: `lead` names the full-motion tentacles, the rest sway at half")
    check(R.Rig(OCHU, (80, 80)).half_default == RS.rooted_half(OCHU), "rooted: the rig carries the half set")


def _recipes_unchanged(check: Callable[[bool, str], None]) -> None:
    """FW-2 is additive: no other body gains a half set or new ground joints."""
    from gen import rig as R
    from gen import selftest_rig as SR
    for body, ground in (("biped", ()), ("quadruped", ()), ("bird", ()), ("floating", ()), ("blob", ("base",)),
                         ("naga", ("c_f", "c_n", "s0", "tail0"))):
        rig = R.Rig({**SR.RIG, "body": body, "keyframes": {}, "lead": [1]}, (80, 80))
        check(getattr(rig, "half_default", None) == set() and rig.ground == ground,
              f"{body}: no half set, ground {ground}")
