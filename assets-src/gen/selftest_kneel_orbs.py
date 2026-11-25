"""EF-J self-tests (docs/ENEMY_FEEDBACK_PLAN.md: Chaos's orbs fall when he kneels), run from selftest.py
(test_monster_anim, also --anim). A rig option `kneel_orbs` (kneel_orbs.py) cuts the four orbs out of the idle and the
AI kneel key, bridges the clean body, and pastes the orbs part-way down in kneel_in1 / kneel_in2 and on the ground in
the kneel key cell and kneel_b. RED first: without the block (the state before EF-J) the hold's orbs float by the head.
Each rig variant rebuilds its own `kneel` key (kneel_source_ai.ai_key, the add_key step) before generate. Nothing in
approved/ is written.

  python3 -I assets-src/gen/selftest_kneel_orbs.py
"""
from __future__ import annotations

import copy
import sys
from pathlib import Path
from typing import Callable

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import yaml

ORB_COLOURS = {(231, 239, 222), (66, 132, 148), (165, 90, 49)}   # the orbs' light / teal / ember fills


def _raises(fn) -> str:
    try:
        fn()
    except ValueError as e:
        return str(e)
    return ""


def _orb_rows(a: np.ndarray, x0: int, x1: int) -> np.ndarray:
    """Rows holding an orb fill colour in columns x0..x1 (the free ground beside the hem, or the whole cell)."""
    sub = a[:, x0:x1 + 1]
    hit = np.array([[tuple(int(v) for v in px[:3]) in ORB_COLOURS and px[3] > 0 for px in row] for row in sub])
    return np.nonzero(hit.any(1))[0]


def run_kneel_orbs(check: Callable[[bool, str], None]) -> None:
    from PIL import Image
    from gen import monster_anim as MA
    from gen import monster_check as MC
    from gen import kneel_source_ai as KS
    rigs = sorted(p.stem for p in MA.RIGS.glob("*.yaml") if (yaml.safe_load(p.read_text()) or {}).get("kneel_orbs"))
    check(rigs == ["chaos"], f"only chaos's rig has `kneel_orbs` ({rigs})")
    sid, meta, kfs = next(e for e in MA.load_entries() if e[0] == "chaos")
    cfg = MA.load_rig("chaos")

    def entry(c: dict) -> tuple[dict, dict]:                 # the add_key step for a rig variant, then generate
        k = {**kfs, "kneel": Image.fromarray(KS.ai_key(sid, c, kfs), "RGBA")}
        return k, MA.generate(sid, c, k, meta)
    plain = {k: v for k, v in cfg.items() if k != "kneel_orbs"}
    k0, g0 = entry(plain)
    key0 = np.asarray(k0["kneel"])
    check(len(_orb_rows(key0, 0, 199)) and _orb_rows(key0, 0, 199).min() < 100
          and not len(_orb_rows(key0, 1, 26)) and not len(_orb_rows(key0, 175, 198)),
          "RED: without `kneel_orbs` the kneel key's orbs float by the head (none on the ground beside him)")
    if "kneel_orbs" not in cfg:
        check(False, "chaos's rig has no `kneel_orbs` block")
        return
    from gen import kneel_orbs as KO
    k1, g1 = entry(cfg)
    hold = {"kneel": np.asarray(k1["kneel"]), "kneel_b": g1["kneel_b"]["img"]}
    bottom = int(meta["bottom_row"])
    for n, a in hold.items():
        info = KO.key_info(sid, cfg, kfs) if n == "kneel" else g1[n]["kneel_orbs"]
        tops = {k: int(o["ys"].min() + o["d"][1]) for k, o in info["orbs"].items()}
        check(min(tops.values()) > 150 and len(_orb_rows(a, 1, 26)) and len(_orb_rows(a, 175, 198)),
              f"{n}: every orb below row 150, orbs on the free ground left and right of the hem ({tops})")
        check(all(o["bottom"] == bottom for o in info["orbs"].values()),
              f"{n}: every orb rests on the feet row {bottom} ({ {k: o['bottom'] for k, o in info['orbs'].items()} })")
    src = {"kneel_in1": g1["kneel_in1"]["kneel_orbs"], "kneel_in2": g1["kneel_in2"]["kneel_orbs"]}
    start = KO.source_bottoms(sid, cfg, kfs)
    ok = all(start["idle"][nm] < src["kneel_in1"]["orbs"][nm]["bottom"] and
             start["kneel"][nm] < src["kneel_in2"]["orbs"][nm]["bottom"] < bottom and
             src["kneel_in1"]["orbs"][nm]["bottom"] < src["kneel_in2"]["orbs"][nm]["bottom"] for nm in start["idle"])
    check(ok, f"the orbs fall: source -> in1 -> in2 -> {bottom} ({start}, "
              f"{ {n: {k: o['bottom'] for k, o in r['orbs'].items()} for n, r in src.items()} })")
    allowed = MC.palette(kfs) | {tuple(c) for c in meta.get("kf_palette", ())}
    for n in ("kneel_in1", "kneel_in2", "kneel_b"):
        check(not KO.frame_checks(n, g1[n]["img"], g1[n]["kneel_orbs"]), f"{n}: kneel_orbs checks pass "
              f"({KO.frame_checks(n, g1[n]['img'], g1[n]['kneel_orbs'])[:2]})")
    ki = KO.key_info(sid, cfg, kfs)
    check(not KO.frame_checks("kneel", hold["kneel"], ki), f"kf:kneel: kneel_orbs checks pass "
          f"({KO.frame_checks('kneel', hold['kneel'], ki)[:2]})")
    from gen.pixelize import components
    check(components(ki["clean_src"][..., 3] > 0)[1] == 1 and
          components(g1["kneel_in1"]["kneel_orbs"]["clean_src"][..., 3] > 0)[1] == 1,
          "the clean key and the clean idle are one piece each (no orphan outline dots)")
    others = [k for k in g0 if k not in ("kneel_in1", "kneel_in2", "kneel_b")]
    check(all(np.array_equal(g0[k]["img"], g1[k]["img"]) for k in others), "every non-kneel chaos frame is unchanged")
    rep = MC.check_sprite(sid, cfg, k1, meta, g1, with_lock=False)
    bad = {k: v for k, v in rep.items() if v and ("kneel" in k)}
    check(not bad, f"chaos's kneel frames pass every check ({dict(list(bad.items())[:3])})")
    # mutations at add_key: each one a ValueError naming the rig

    def mut(f):
        c = copy.deepcopy(cfg)
        f(c)
        return lambda: KS.ai_key(sid, c, kfs)
    check("chaos" in _raises(mut(lambda c: c["kneel_orbs"]["rest"].update(ember=197))), "a rest spot off the cell fails")
    check("names" in _raises(mut(lambda c: c["kneel_orbs"]["parts"].pop("teal"))), "orb names not matching `orbit` fail")
    check("fall" in _raises(mut(lambda c: c["kneel_orbs"].update(fall=[0.7, 0.3]))), "a `fall` not increasing fails")
    check("source: ai" in _raises(mut(lambda c: c.update(kneel={"source": "derived"}))), "the block without `kneel: {source: ai}` fails")
    check("orbit" in _raises(mut(lambda c: c.pop("orbit"))), "the block without `orbit` fails")
    # mutations at the checks
    a = hold["kneel"].copy()
    nm, o = next(iter(ki["orbs"].items()))
    moved = copy.deepcopy(ki)
    moved["orbs"][nm]["d"] = (o["d"][0] + 40, o["d"][1])
    check(any("cover" in e or "pixel" in e for e in KO.frame_checks("kneel", a, moved)), "an orb record moved fails")
    b = hold["kneel"].copy()
    b[120, 100] = (231, 239, 222, 255) if tuple(b[120, 100, :3]) != (231, 239, 222) else (6, 4, 10, 255)
    check(any("body" in e for e in KO.frame_checks("kneel", b, ki)), "a body pixel changed outside the orbs fails")
    r = g1["kneel_in2"]["kneel_orbs"]
    c2 = g1["kneel_in2"]["img"].copy()
    c2[5:8, 100:103] = (6, 4, 10, 255)                         # a 9 px speck: a new piece under MIN_PIECE
    check(any("piece" in e for e in KO.detached(c2, r)), "a split-off piece under MIN_PIECE fails (detached)")
    check(not KO.detached(g1["kneel_in2"]["img"], r), "kneel_in2's body pieces pass the detached exception")


if __name__ == "__main__":
    fails: list[str] = []

    def _check(ok: bool, msg: str) -> None:
        print(f"  {'ok  ' if ok else 'FAIL'} {msg}")
        if not ok:
            fails.append(msg)
    run_kneel_orbs(_check)
    print(f"\n{'ALL PASSED' if not fails else f'{len(fails)} FAILED'}")
    sys.exit(1 if fails else 0)
