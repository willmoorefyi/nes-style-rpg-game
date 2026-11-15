"""FW-4 (docs/ROSTER_PLAN.md 5.2 arthropod row, 5.4) self-tests, run from selftest.py (test_monster_anim): the
`arthropod` body template on a synthetic right-facing spider (100x80, feet row 76: thorax, abdomen, fangs, four legs
a side arching above the body to tips on the ground) and a scorpion variant with a tail chain and claws. They render
deterministically and pass the construction checks; every leg tip stays put in every frame while the knees bend (IK);
the wind-up lowers the body and shifts it back; check 8 judges every tip per foot; an unmarked leg is not drawn."""
from __future__ import annotations

from typing import Callable

import numpy as np
from PIL import Image, ImageDraw

OUTLINE = (6, 4, 10, 255)
SHELL, BELLY, LEG, RED = (60, 60, 75, 255), (90, 90, 110, 255), (40, 40, 55, 255), (200, 40, 40, 255)
META = {"bottom_row": 76, "floating": False}
TIPX = {"1_n": 80, "2_n": 70, "3_n": 38, "4_n": 26, "1_f": 86, "2_f": 76, "3_f": 32, "4_f": 20}


def _legs(body: tuple[int, int]) -> dict:
    out = {}
    for k, tx in TIPX.items():
        cx = body[0] + (4 if k[0] in "12" else -4) + (1 if k.endswith("n") else -1)
        out[f"coxa{k}"] = (cx, body[1] + 2)
        out[f"knee{k}"] = ((cx + tx) // 2 + (2 if tx > cx else -2), body[1] - 12)
        out[f"tip{k}"] = (tx, 75)
    return out


IDLE = {"body": (52, 58), "head": (62, 57), "fang": (66, 63), "abd": (46, 57), "abd_end": (30, 51), **_legs((52, 58))}
ATTACK = {**IDLE, "body": (56, 56), "head": (67, 54), "fang": (72, 59), "abd": (50, 55), "abd_end": (34, 47),
          **{k: v for k, v in _legs((56, 56)).items() if not k.startswith("tip")}}
HURT = {**IDLE, "body": (48, 55), "head": (57, 51), "fang": (61, 55), "abd": (42, 55), "abd_end": (26, 54),
        **{k: v for k, v in _legs((48, 55)).items() if not k.startswith("tip")}}
SPIDER = {"sprite": "synthetic_spider", "body": "arthropod", "facing": "right",
          "keyframes": {"idle": IDLE, "attack": ATTACK, "hurt": HURT}, "colors": {}}


def _scorp(j: dict, att: bool) -> dict:
    b = j["body"]
    return {**j, "sh_n": (b[0] + 8, b[1]), "el_n": (b[0] + 14, b[1] - 2 - 2 * att), "hand_n": (b[0] + 20 + 4 * att, b[1] - 4),
            "tl0": (j["abd_end"][0], j["abd_end"][1] - 2), "tl1": (j["abd_end"][0] - 2, j["abd_end"][1] - 12),
            "tl2": (j["abd_end"][0] + 2, j["abd_end"][1] - 22), "tl3": (j["abd_end"][0] + 9, j["abd_end"][1] - 26 - 2 * att),
            "sting": (j["abd_end"][0] + 14 + 3 * att, j["abd_end"][1] - 22 - 2 * att)}


SCORPION = {"sprite": "synthetic_scorpion", "body": "arthropod", "facing": "right",
            "keyframes": {"idle": _scorp(IDLE, False), "attack": _scorp(ATTACK, True), "hurt": _scorp(HURT, False)},
            "colors": {}, "parts": {"fangs": {"remove": True}}}


def draw(j: dict) -> Image.Image:
    im = Image.new("RGBA", (100, 80), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for k in TIPX:
        if f"tip{k}" in j and k.endswith("f"):
            d.line([j[f"coxa{k}"], j[f"knee{k}"], j[f"tip{k}"]], fill=LEG, width=2)
    if "sting" in j:
        d.line([j[n] for n in ("tl0", "tl1", "tl2", "tl3", "sting")], fill=BELLY, width=5)
    ax, ay = j["abd"]
    ex, ey = j["abd_end"]
    d.ellipse([min(ax, ex) - 2, min(ay, ey) - 8, max(ax, ex) + 2, max(ay, ey) + 6], fill=SHELL)
    d.ellipse([ex + 4, ey - 2, ex + 8, ey + 2], fill=RED)
    d.line([j["body"], j["head"]], fill=BELLY, width=9)
    if "fang" in j:
        d.line([j["head"], j["fang"]], fill=RED, width=2)
    if "hand_n" in j:
        d.line([j["sh_n"], j["el_n"], j["hand_n"]], fill=BELLY, width=4)
    for k in TIPX:
        if f"tip{k}" in j and k.endswith("n"):
            d.line([j[f"coxa{k}"], j[f"knee{k}"], j[f"tip{k}"]], fill=LEG, width=2)
    a = np.asarray(im).copy()
    solid = a[..., 3] > 0
    ring = np.zeros_like(solid)
    ring[1:] |= solid[:-1]; ring[:-1] |= solid[1:]; ring[:, 1:] |= solid[:, :-1]; ring[:, :-1] |= solid[:, 1:]
    a[ring & ~solid] = OUTLINE
    low = int(np.where((a[..., 3] > 0).any(1))[0].max())
    assert low == META["bottom_row"], f"synthetic arthropod: lowest row {low}"
    return Image.fromarray(a, "RGBA")


def keyframes(cfg: dict) -> dict[str, Image.Image]:
    return {k: draw({**cfg["keyframes"]["idle"], **j} if k != "idle" else j) for k, j in cfg["keyframes"].items()}


def _full(cfg: dict) -> dict:
    """Keyframes as drawn (attack and hurt inherit the idle tips)."""
    kf = cfg["keyframes"]
    return {**cfg, "keyframes": {k: ({**kf["idle"], **j} if k != "idle" else j) for k, j in kf.items()}}


def render(cfg: dict) -> dict[str, dict]:
    from gen import monster_anim as MA
    return MA.generate(cfg["sprite"], _full(cfg), keyframes(cfg), META)


def run_arthropod(check: Callable[[bool, str], None]) -> None:
    from gen import monster_check as MC
    from gen import rig as R
    from gen import selftest_rig as SR
    for cfg in (SPIDER, SCORPION):
        name = cfg["sprite"]
        try:
            one, two = render(cfg), render(cfg)
        except (ValueError, KeyError) as e:
            check(False, f"arthropod template renders {name} ({type(e).__name__}: {e})")
            continue
        check(sorted(one) == sorted(two) and all(np.array_equal(one[k]["img"], two[k]["img"]) for k in one),
              f"{name} renders deterministically ({len(one)} frames)")
        check(len(one) == 10, f"a rigged {name} gets 10 generated frames")
        full = _full(cfg)
        rep = MC.check_sprite(name, full, keyframes(cfg), META, one, with_lock=False)
        every = [f"{k}: {e}" for k, v in rep.items() for e in v]
        fails = [e for e in every if not any(t in e for t in SR.TUNING)]
        check(not fails, f"{name} frames pass the construction checks {fails[:3]}")
        print(f"  info {len(every) - len(fails)} tuning findings on {name} {every[:2]}")
        rig = R.Rig(full, (100, 80))
        tips = [j for j in rig.feet]
        moved = [f"{n}:{t}" for n, f in one.items() if f["joints"] for t in tips
                 if f["joints"].get(t) != full["keyframes"][f["src"]][t]]
        check(len(tips) == 8 and not moved, f"{name}: every leg tip stays put in every frame {moved[:4]}")
        fp = next(f for f in one.values() if f["labels"] is not None)["foot_parts"]
        check(sorted(fp) == sorted(tips) and all(fp.values()), f"{name}: check 8 judges all 8 tips per foot")
    try:
        one = render(SPIDER)
    except (ValueError, KeyError):
        return
    w2 = one["atk_wind2"]["joints"]
    check(w2["body"][1] > IDLE["body"][1] and w2["body"][0] < IDLE["body"][0],
          f"arthropod: atk_wind2 lowers the body and shifts it back ({w2['body']} vs idle {IDLE['body']})")
    bent = [k for k in TIPX if w2[f"knee{k}"] != IDLE[f"knee{k}"]]
    check(len(bent) >= 6, f"arthropod: the knees bend (IK) while the tips hold ({len(bent)} of 8 knees moved)")
    no4 = {**SPIDER, "keyframes": {k: {n: v for n, v in j.items() if n != "tip4_f"} for k, j in SPIDER["keyframes"].items()}}
    from gen import monster_anim as MA
    f = MA.generate("synthetic_spider", _full(no4), keyframes(SPIDER), META)["atk_wind2"]
    check("leg4_f" not in f["names"] or not (f["labels"] == f["names"].index("leg4_f")).any(),
          "arthropod: a leg with an unmarked tip is not drawn")
    sc = render(SCORPION)
    check((sc["atk_mid"]["labels"] == sc["atk_mid"]["names"].index("tail")).any() and
          (sc["atk_mid"]["labels"] == sc["atk_mid"]["names"].index("farm_n")).any(),
          "arthropod: a marked tail chain and claw are drawn (scorpion)")
