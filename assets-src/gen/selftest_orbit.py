"""EF-D self-tests (docs/ENEMY_FEEDBACK_PLAN.md: Chaos's element orbs orbit the head in the idle), run from selftest.py
(test_monster_anim, also --anim). A rig option `orbit` (monster_orbit.py) cuts the orbs out of the idle key and idle_b
and writes idle_o<k> / idle_b_o<k>; the atlas lists them with `idleOrbit: N`. RED first: without the option (every rig
but chaos) no orbit frame exists and the atlas tables are unchanged. On chaos's own keys and rig: the frames pass the
orbit checks, every mutated input (orb above the idle top, out of the cell, too many steps, an unknown `behind` part,
a body pixel changed, a hidden orb, a jump) fails, and the atlas anchors do not move. Nothing in approved/ is written.

  python3 -I assets-src/gen/selftest_orbit.py
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


def _raises(fn) -> str:
    try:
        fn()
    except ValueError as e:
        return str(e)
    return ""


def run_orbit(check: Callable[[bool, str], None]) -> None:
    from gen import monster_anim as MA
    from gen import monster_atlas as MAT
    from gen import monster_check as MC
    from gen import monster_orbit as MO
    from PIL import Image
    # only chaos opts in; every other rig is untouched (no orbit frames, byte-identical generation)
    rigs = sorted(p.stem for p in MA.RIGS.glob("*.yaml") if (yaml.safe_load(p.read_text()) or {}).get("orbit"))
    check(rigs == ["chaos"], f"only chaos's rig has `orbit` ({rigs})")
    check(MA.frames_for(True, True) == MA.BOSS_FRAMES + MA.RAISE_FRAMES and "idle_o0" not in MA.frames_for(True),
          "frames_for without an orbit lists no orbit frame (every other sheet's atlas names unchanged)")
    check(MA.frames_for(True, False, 16)[-32:] == MA.orbit_names(16), "frames_for(orbit=16) adds the 32 orbit names")
    check(MA.resolve("idle_o3", {"idle", "idle_b"}) == "idle" and MA.resolve("idle_b_o3", {"idle", "idle_b"}) == "idle_b",
          "an orbit name falls back to idle / idle_b (as the TS FRAME_FALLBACK)")
    sid, meta, kfs = next(e for e in MA.load_entries() if e[0] == "chaos")
    cfg = MA.load_rig("chaos")
    plain = {k: v for k, v in cfg.items() if k != "orbit"}
    g0 = MA.generate(sid, plain, kfs, meta)
    check(not any(n.startswith("idle_o") or n.startswith("idle_b_o") for n in g0),
          "RED: chaos without `orbit` has no orbit frames")
    gen = MA.generate(sid, cfg, kfs, meta)
    n = int(cfg["orbit"]["steps"])
    names = [f for f in gen if f.startswith(("idle_o", "idle_b_o"))]
    check(sorted(names) == sorted(MA.orbit_names(n)), f"chaos: {len(names)} orbit frames (2 x {n})")
    check(all(np.array_equal(g0[k]["img"], gen[k]["img"]) for k in g0), "the orbit leaves every other chaos frame equal")
    rep = MC.check_sprite(sid, cfg, kfs, meta, gen, with_lock=False)
    bad = {k: v for k, v in rep.items() if v and (k.startswith("idle_o") or k.startswith("idle_b_o") or k == "sequence:orbit")}
    check(not bad and "sequence:orbit" in rep, f"chaos orbit frames and sequence pass ({dict(list(bad.items())[:2])})")
    far = [i for f in names for i in gen[f]["orbs"].values() if i["far"] and i["shown"] < i["size"]]
    check(bool(far), f"some far-side orbs pass behind the head ({len(far)} partly hidden)")
    # mutations: each one RED
    arrs = {k: np.asarray(v.convert("RGBA")) for k, v in kfs.items()}
    allowed = MC.palette(kfs) | {tuple(c) for c in meta.get("kf_palette", ())}

    def mut(**o):
        c = copy.deepcopy(cfg)
        c["orbit"].update(o)
        return lambda: MA.generate(sid, c, kfs, meta)
    check("above the idle key's opaque top" in _raises(mut(centre=[100, 20])), "an orb above the idle top is refused")
    check("leaves the cell" in _raises(mut(rx=95)), "an orb leaving the cell is refused")
    check("outside 8..16" in _raises(mut(steps=20)), "more than 16 steps is refused")
    check("unknown parts" in _raises(mut(behind=["halo"])), "an unknown `behind` part is refused")
    f = copy.deepcopy(gen["idle_o3"])
    f["img"] = f["img"].copy()
    px = tuple(int(v) for v in f["img"][150, 100, :3])    # a robe pixel, far from every orb
    f["img"][150, 100] = (231, 239, 222, 255) if px != (231, 239, 222) else (6, 4, 10, 255)
    check(any("body changed" in e for e in MO.frame_checks("idle_o3", f, arrs["idle"], allowed)),
          "a body pixel changed outside the orb masks fails")
    f = copy.deepcopy(gen["idle_o0"])
    nm = next(iter(f["orbs"]))
    f["orbs"][nm]["shown"] = 1
    check(any("shows 1 of" in e for e in MO.frame_checks("idle_o0", f, arrs["idle"], allowed)), "a hidden orb fails")
    g2 = dict(gen)
    g2["idle_o5"] = {**gen["idle_o5"], "orbs": {k: {**v, "d": (v["d"][0] + 30, v["d"][1])}
                                                for k, v in gen["idle_o5"]["orbs"].items()}}
    check(any("moves" in e for e in MO.sequence_checks(g2, cfg)["sequence:orbit"]), "an orb jumping a step fails")
    # the atlas: idleOrbit only with orbit frames; chaos's anchors do not move
    frames = {**kfs, **{k: Image.fromarray(v["img"]) for k, v in gen.items()}}
    frames0 = {**kfs, **{k: Image.fromarray(v["img"]) for k, v in g0.items()}}
    m1 = MAT.sheet_meta(meta, frames, MA.frames_for(True, False, MAT.orbit_of(frames)), {}, [], True, 40, 0, False)
    m0 = MAT.sheet_meta(meta, frames0, MA.frames_for(True, False), {}, [], True, 40, 0, False)
    check(m1.get("idleOrbit") == n and "idleOrbit" not in m0, f"sheet_meta idleOrbit {m1.get('idleOrbit')} (none without)")
    keys = ("travelTop", "lungeRight", "homeX", "idleBox", "head", "opaqueRight", "tip")
    check({k: m1.get(k) for k in keys} == {k: m0.get(k) for k in keys},
          f"chaos anchors unchanged by the orbit ({ {k: (m0.get(k), m1.get(k)) for k in keys if m0.get(k) != m1.get(k)} })")


if __name__ == "__main__":
    fails: list[str] = []

    def _check(ok: bool, msg: str) -> None:
        print(f"  {'ok  ' if ok else 'FAIL'} {msg}")
        if not ok:
            fails.append(msg)
    run_orbit(_check)
    print(f"\n{'ALL PASSED' if not fails else f'{len(fails)} FAILED'}")
    sys.exit(1 if fails else 0)
