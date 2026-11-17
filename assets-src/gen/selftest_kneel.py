"""Pass K selftests (docs/KNEEL_PLAN.md 7), on the synthetic rigs of selftest_rig.py / selftest_beasts.py: opt-in
only (every old frame byte-identical with and without a kneel block), the 4 names, the K-check failure cases, an
additive template variant, the Python / TS frame tables, kneelSink and preload, and (when puppet_kneel.py is
importable) its own hero selftest."""
from __future__ import annotations

import copy
import json
import re
from typing import Callable

import numpy as np
from PIL import Image

from gen import kneel as KN
from gen import kneel_checks as KC
from gen import kneel_templates as KT
from gen import monster_anim as MA
from gen import monster_recipes as RC

TS = MA.HERE.parent.parent / "src" / "scenes" / "battle" / "enemyChoreography.ts"
ATLAS = MA.HERE.parent.parent / "assets" / "sprites" / "monsters-ai.json"


def _rigs():
    from gen import selftest_beasts as SB
    from gen import selftest_rig as SR
    return [(SR.RIG, SR.keyframes(), SR.META), (SB.QUAD, SB.keyframes(SB.QUAD), SB.META)]


def _gen(cfg, kfs, meta):
    m, k = KN.add_key(cfg["sprite"], cfg, dict(meta), dict(kfs))
    return MA.generate(cfg["sprite"], cfg, k, m), m, k


def run_optin(check: Callable[[bool, str], None]) -> None:
    for cfg, kfs, meta in _rigs():
        body = cfg["body"]
        plain = MA.generate(cfg["sprite"], cfg, kfs, meta)
        check(not set(plain) & set(RC.KNEEL_FRAMES), f"{body}: no kneel frames without a kneel block ({sorted(plain)})")
        opted = {**copy.deepcopy(cfg), "kneel": {}}
        gen, m, k = _gen(opted, kfs, meta)
        same = all(np.array_equal(plain[n]["img"], gen[n]["img"]) for n in plain)
        check(same and set(gen) - set(plain) == {"kneel_in1", "kneel_in2", "kneel_b"} and "kneel" in k,
              f"{body}: the block adds kneel_in1 / kneel_in2 / kneel_b and the kneel key; every old frame identical")
        check(m.get("kf_derived", {}).get("kneel") == "idle", f"{body}: the kneel key is locked as kf:kneel")
        from gen import monster_check as MC
        check("kf:kneel" in MC.lock_frames(gen, k, m), f"{body}: lock_frames hashes kf:kneel")
        again = _gen(opted, kfs, meta)[0]
        check(all(np.array_equal(gen[n]["img"], again[n]["img"]) for n in gen), f"{body}: kneel frames are deterministic")
        check(gen["kneel_in1"]["u"] == 0.33 and gen["kneel_in2"]["src"] == "kneel" and gen["kneel_b"]["src"] == "kneel",
              f"{body}: kneel_in1 t 0.33 from idle, kneel_in2 / kneel_b cut from the kneel key")


def run_failures(check: Callable[[bool, str], None]) -> None:
    from gen import selftest_rig as SR
    gen, m, k = _gen({**copy.deepcopy(SR.RIG), "kneel": {}}, SR.keyframes(), SR.META)
    key, idle = np.asarray(k["kneel"]), np.asarray(k["idle"])
    b = SR.META["bottom_row"]
    check(not KC.ground(idle, idle, b), "K-ground passes a frame on the feet row")
    check(bool(KC.ground(np.roll(idle, -1, 0), idle, b)), "K-ground fails a frame lifted 1 px")
    check(bool(KC.ground(np.roll(key, 1, 0), idle, b)), "K-ground fails a kneel sunk below the feet row")
    half = idle.copy()
    half[b - 1:b + 1, :half.shape[1] // 2 + 6] = 0
    check(bool(KC.ground(half, idle, b)), "K-ground fails fewer than half the idle's pixels in the bottom 2 rows")
    check(bool(KC.height(idle, idle, (0.68, 0.85))), "K-height fails a frame outside its band (the idle: 1.00)")
    check(not KC.height(key, idle, (0.0, 1.0)), "K-height passes a frame inside its band")
    limbs = {"thigh_f"}
    check(bool(KC.rot({"thigh_f": (101.0, "rigid")}, limbs, 100.0)), "K-rot fails a 101 deg limb in the kneel key")
    check(not KC.rot({"thigh_f": (99.0, "rigid")}, limbs, 100.0), "K-rot passes a 99 deg limb in the kneel key")
    check(bool(KC.rot({"thigh_f": (41.0, "rigid")}, limbs, KN.IN_LIMB_CAP)), "K-rot fails a 41 deg in-between limb")
    check(bool(KC.rot({"head": (31.0, "rigid")}, limbs, 100.0)), "K-rot holds a non-limb part to ROT_CAP")
    check(bool(KC.rot({"thigh_f": (16.0, "rigid")}, limbs, 15.0, 15.0)), "K-rot: the mechanical 15 deg cap")
    low = key.copy()
    low[b + 1, 40] = (90, 170, 80, 255)
    check(bool(KC.fit(low, b)), "K-fit fails a pixel in the bottom margin")
    old = {"daze": "a", "idle_b": "b"}
    a, c, r = KC.lock_delta(old, {**old, "daze": "x", "kf:kneel": "k"})
    check(c == ["daze"] and a == ["kf:kneel"] and not r, "K-lock: a changed daze hash is a change, kf:kneel an addition")
    check(KC.lock_delta(old, {"idle_b": "b"})[2] == ["daze"], "K-lock: a lost entry is a removal")
    check(not KC.anchors({**{n: Image.fromarray(f["img"]) for n, f in gen.items()},
                          **k}, MA.frames_for(False), SR.META), "K-anchor: the kneel frames move no anchor")
    try:
        KN.block({"sprite": "x", "kneel": {"drop": 1}})
        check(False, "an unknown kneel key is refused")
    except ValueError:
        check(True, "an unknown kneel key is refused")


def run_variant(check: Callable[[bool, str], None]) -> None:
    from gen import selftest_beasts as SB
    cfg = {**copy.deepcopy(SB.QUAD), "kneel": {}}
    kfs = SB.keyframes(SB.QUAD)
    base = _gen(cfg, kfs, SB.META)
    saved = dict(KT.VARIANTS)
    KT.VARIANTS[("quadruped", "selftest_extra")] = {"rel": {"snout": 40.0}}
    try:
        after = _gen(cfg, kfs, SB.META)
        check(all(np.array_equal(base[0][n]["img"], after[0][n]["img"]) for n in base[0])
              and np.array_equal(np.asarray(base[2]["kneel"]), np.asarray(after[2]["kneel"])),
              "an added template variant leaves a rig on the default template byte-identical")
        used = _gen({**cfg, "kneel": {"variant": "selftest_extra"}}, kfs, SB.META)
        check(not np.array_equal(np.asarray(base[2]["kneel"]), np.asarray(used[2]["kneel"])),
              "a rig naming the variant gets its targets")
    finally:
        KT.VARIANTS.clear()
        KT.VARIANTS.update(saved)
    try:
        KT.template("serpent", sprite="x")
        check(False, "a body without a kneel template is refused")
    except ValueError:
        check(True, "a body without a kneel template is refused (K3-0)")
    from gen import selftest_rig as SR
    mech = {**copy.deepcopy(SR.RIG), "preset": "mechanical", "kneel": {}}
    mech["parts"]["dagger"]["kind"] = "prop"
    gen, m, k = _gen(mech, SR.keyframes(), SR.META)
    worst = max(abs(d) for d, _ in m["kneel"]["rots"].values())
    check(worst <= 15.0 + 1e-9, f"mechanical: the power-down squat turns no part over 15 deg ({worst:.1f})")
    check(KC.ratio(np.asarray(k["kneel"]), np.asarray(k["idle"])) < 1.0, "mechanical: the squat lowers the figure")


def _ts_list(src: str, name: str) -> list[str] | None:
    m = re.search(rf"{name}[^=]*=\s*\[([^\]]*)\]", src)
    return re.findall(r"'(\w+)'", m.group(1)) if m else None


def run_tables(check: Callable[[bool, str], None]) -> None:
    check(RC.SEQUENCES["kneel"] == ["idle", "kneel_in1", "kneel_in2", "kneel", "kneel_b"]
          and RC.SPAN["kneel"] == ("idle", "kneel") and RC.NEEDS["kneel"] == "kneel", "Python kneel sequence and span")
    have = {"idle", "daze", "daze_b", "hurt_in1"}
    check({n: RC.resolve(n, have) for n in RC.KNEEL_FRAMES} ==
          {"kneel": "daze", "kneel_b": "daze_b", "kneel_in2": "daze", "kneel_in1": "idle"},
          "D-K7 fallback: an unopted sheet's kneel names alias to daze / daze_b / idle")
    src = TS.read_text() if TS.exists() else ""
    ts = _ts_list(src, "MONSTER_FRAMES")
    if not ts or "kneel" not in ts:
        print("  skip: enemyChoreography.ts has no kneel frames yet (the TS side lands with K1c)")
        return
    check(ts == RC.MONSTER_FRAMES, f"MONSTER_FRAMES match the TS list ({ts})")
    for n, want in (("kneel", "daze"), ("kneel_b", "daze_b"), ("kneel_in2", "daze"), ("kneel_in1", "idle")):
        m = re.search(rf"FRAME_FALLBACK:[^=]*=[\s\S]*?\b{n}:\s*'(\w+)'", src)
        check(bool(m) and m.group(1) == want, f"TS FRAME_FALLBACK {n} -> {want} ({m.group(1) if m else None})")


def run_atlas(check: Callable[[bool, str], None]) -> None:
    from gen import monster_atlas as MAT
    from gen import selftest_rig as SR
    from PIL import Image
    cfg = {**copy.deepcopy(SR.RIG), "kneel": {"sink": 5}}
    real = MA.load_rig
    MA.load_rig = lambda s: cfg if s == "synthetic" else real(s)
    try:
        fr = {"idle": Image.new("RGBA", (80, 80)), "kneel": Image.new("RGBA", (80, 80))}
        check(MAT.kneel_sink("synthetic", {"character": "synthetic"}, fr) == {}, "kneelSink: none for a grounded sheet")
        check(MAT.kneel_sink("synthetic", {"character": "synthetic", "floating": True}, fr) == {"kneelSink": 5},
              "kneelSink: a floating sheet with a kneel key gets the block's sink")
        check(MAT.kneel_sink("synthetic", {"floating": True}, {"idle": fr["idle"]}) == {},
              "kneelSink: none without a kneel key")
    finally:
        MA.load_rig = real
    check(KN.sink_px({"kneel": {}}, 80) == 6 and KN.sink_px({"kneel": {}}, 160) == 12, "kneelSink template: 6 px per 80")
    meta = json.loads(ATLAS.read_text()) if ATLAS.exists() else {}
    if "preload" not in meta:
        print("  skip: the committed monsters-ai.json has no preload yet (the integrator rebuilds the atlases)")
        return
    from gen import monster_pages as MP
    act1 = sorted({meta["sheets"][s]["page"] for s in dict(MP.PAGE_GROUPS)["act1"] if s in meta["sheets"]})
    check(meta["preload"] == act1 and len(act1) <= 2, f"preload {meta['preload']} = the act-1 pages {act1}")


def run_kneel(check: Callable[[bool, str], None]) -> None:
    run_optin(check)
    run_failures(check)
    run_variant(check)
    run_tables(check)
    run_atlas(check)
    try:
        from gen import puppet_kneel as PK
    except ImportError as e:
        print(f"  skip: heroes (puppet_kneel.py not importable: {e})")
        return
    PK.selftest(check)
