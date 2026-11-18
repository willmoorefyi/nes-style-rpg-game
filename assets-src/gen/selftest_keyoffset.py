"""FW-O self-tests (docs/ROSTER_FIX_PLAN_2.md 4, N-4), run from selftest_efix.run_efix: a rig `key_offset: {key: [dx,
dy]}` moves that approved key's pixels by whole px (monster_keys.apply, after FW-R and before FW-P) and translates, for
that key, its keyframe joints, its `masks.*.<key>` polygons and its keyframe paint (monster_keys.offset_cfg, applied
by monster_anim.load_rig); in-between paint stays where it was written. The approved PNGs are never edited."""
from __future__ import annotations

import copy
from typing import Callable

import numpy as np


def _shift(a: np.ndarray, dx: int, dy: int) -> np.ndarray:
    out = np.zeros_like(a)
    h, w = a.shape[:2]
    out[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = a[max(0, -dy):h - max(0, dy), max(0, -dx):w - max(0, dx)]
    return out


def _entries(sprite: str, cfg: dict | None, paint: bool = True):
    """load_entries with `sprite`'s rig file replaced by `cfg` (the raw dict, as a rig file would read)."""
    from gen import monster_anim as MA
    from gen import monster_keys as MK
    real = MA.load_rig
    MA.load_rig = lambda s: MK.offset_cfg(s, copy.deepcopy(cfg)) if s == sprite else real(s)
    try:
        return next(e for e in MA.load_entries(paint) if e[0] == sprite)
    finally:
        MA.load_rig = real


def _refused(fn, *words: str) -> bool:
    try:
        fn()
    except ValueError as e:
        return all(w in str(e) for w in words)
    return False


def run_key_offset(check: Callable[[bool, str], None]) -> None:
    from gen import monster_anim as MA
    from gen import monster_check as MC
    from gen import monster_keys as MK
    from gen import rig as R
    sid = "chimera"                                      # hurt and attack masks, room in its 128 px cell
    cfg = copy.deepcopy(MA.load_rig(sid))
    # chimera's rig has `kneel: {source: ai}` since KT3: the FW-O fixture is the pre-kneel rig (KT3 ruling, 2026-11-18)
    cfg.pop("kneel", None)
    check("key_offset" not in cfg and MK.offset_cfg(sid, cfg) is cfg,
          "FW-O: a rig without key_offset comes back as the same object (every frame and lock byte-identical)")
    _, meta, kfs = _entries(sid, cfg)
    _, rmeta, rkfs = _entries(sid, cfg, paint=False)
    raw = {k: np.asarray(v.convert("RGBA")) for k, v in kfs.items()}
    base = MA.generate(sid, cfg, kfs, meta)
    dx, dy = 3, -2
    off = {**copy.deepcopy(cfg), "key_offset": {"hurt": [dx, dy]}}
    ocfg = MK.offset_cfg(sid, off)
    _, ometa, okfs = _entries(sid, off)
    oh = np.asarray(okfs["hurt"].convert("RGBA"))
    check(np.array_equal(oh, _shift(raw["hurt"], dx, dy)) and all(okfs[k] is kfs[k] or np.array_equal(
        np.asarray(okfs[k]), raw[k]) for k in kfs if k != "hurt"),
          "FW-O: the hurt key moves by exactly (3, -2); the other keys are the approved ones")
    check(ometa.get("kf_offset") == ["hurt"] and ometa["bottom_row"] == meta["bottom_row"] and ometa["grid"] == meta["grid"],
          f"FW-O: meta records kf_offset {ometa.get('kf_offset')}; the cell and foot row are unchanged")
    j0, j1 = cfg["keyframes"]["hurt"], ocfg["keyframes"]["hurt"]
    check(all(j1[j] == [j0[j][0] + dx, j0[j][1] + dy] for j in j0) and ocfg["keyframes"]["idle"] == cfg["keyframes"]["idle"],
          "FW-O: the hurt keyframe joints move by (dx, dy); the idle joints do not")
    m0, m1 = cfg["masks"]["head"], ocfg["masks"]["head"]
    check(m1["hurt"] == [[x + dx, y + dy] for x, y in m0["hurt"]] and m1["attack"] == m0["attack"],
          "FW-O: masks.head.hurt moves by (dx, dy); masks.head.attack does not")
    rig0, rig1 = R.Rig(cfg, kfs["idle"].size), R.Rig(ocfg, kfs["idle"].size)
    l0, n0 = R.segment(rig0, "hurt", raw["hurt"].copy())
    l1, n1 = R.segment(rig1, "hurt", oh.copy())
    check(n0 == n1 and np.array_equal(l1, _shift(l0[..., None] + 1, dx, dy)[..., 0] - 1),
          "FW-O: the offset hurt key segments into exactly the moved part labels (joints and masks moved with it)")
    _, _, rokfs = _entries(sid, off, paint=False)
    check(np.array_equal(np.asarray(rokfs["hurt"].convert("RGBA")), _shift(np.asarray(rkfs["hurt"].convert("RGBA")), dx, dy)),
          "FW-O: --raw (paint=False) applies the offset too")

    ex, ey = 2, -2                                       # the attack key reaches x 165 of 168: room for 2 px only
    every = {**copy.deepcopy(cfg), "key_offset": {k: [ex, ey] for k in kfs}}
    _, emeta, ekfs = _entries(sid, every)
    egen = MA.generate(sid, MK.offset_cfg(sid, every), ekfs, emeta)
    jok = all(abs(egen[n]["joints"][j][0] - v[0] - ex) < 1e-9 and abs(egen[n]["joints"][j][1] - v[1] - ey) < 1e-9
              for n in base for j, v in base[n]["joints"].items())
    off_px = {n: int((egen[n]["img"] != _shift(base[n]["img"], ex, ey)).any(2).sum()) for n in base}
    exact = [n for n, v in off_px.items() if v == 0]
    # the solved joints move exactly; a part rendered at fractional joints (lerped poses) can flip a few nearest-
    # neighbour samples on float rounding (chimera atk_mid 14 px, atk_recover 75 px of ~5000): <= 2 % of the frame
    small = all(v <= 0.02 * int((base[n]["img"][..., 3] > 0).sum()) for n, v in off_px.items())
    check(jok and small and len(exact) >= len(base) - 2,
          f"FW-O: with every key and its joints offset, every frame's joints move by exactly (2, -2) and its pixels "
          f"too ({len(exact)} of {len(base)} byte-exact; the rest within 2 % on float rounding: "
          f"{ {n: v for n, v in off_px.items() if v} })")

    hp = [[int(x), int(y)] for y, x in zip(*np.nonzero(raw["hurt"][..., 3] > 0))][:5]
    pal = sorted(MK.approved_palette(kfs))
    kf_paint = {**copy.deepcopy(cfg), "paint": [{"frame": "hurt", "xy": hp, "rgb": list(pal[2])}]}
    _, _, pk = _entries(sid, kf_paint)
    both = {**copy.deepcopy(kf_paint), "key_offset": {"hurt": [dx, dy]}}
    _, bmeta, bk = _entries(sid, both)
    check(np.array_equal(np.asarray(bk["hurt"].convert("RGBA")), _shift(np.asarray(pk["hurt"].convert("RGBA")), dx, dy))
          and bmeta.get("kf_painted") == ["hurt"],
          "FW-O: keyframe paint is translated with its key (offset + paint = the painted key moved)")
    # an attack in-between: the live chimera rig aliases its hurt sequence since G3b round 2 (FW-Q), so it generates
    # no hurt_in2
    ib = {**copy.deepcopy(off), "paint": [{"frame": "atk_mid", "xy": [[40, 40]], "rgb": list(pal[2])}]}
    _, imeta, ik = _entries(sid, ib)
    ig = MA.generate(sid, MK.offset_cfg(sid, ib), ik, imeta)["atk_mid"]["img"]
    check(tuple(ig[40, 40]) == (*pal[2], 255), "FW-O: in-between paint stays at its written xy (the rig agent re-derives it)")

    lock = MC.lock_frames(MA.generate(sid, ocfg, okfs, ometa), okfs, ometa)
    # the live chimera rig paints its attack key since ROSTER_FIX_PLAN_2 G3b (D-R1 B, kf:attack in its lock), so the
    # "no key paint" case drops the rig's paint list rather than use the live rig as is
    bare = {k: v for k, v in copy.deepcopy(cfg).items() if k not in ("paint", "kf_paint_cap")}
    _, nmeta, nkfs = _entries(sid, bare)
    plain = MC.lock_frames(MA.generate(sid, bare, nkfs, nmeta), nkfs, nmeta)
    check("kf:hurt" in lock and np.array_equal(lock["kf:hurt"], oh) and not [n for n in plain if n.startswith("kf:")]
          and sorted(n for n in MC.lock_frames(base, kfs, meta) if n.startswith("kf:"))
          == sorted(f"kf:{k}" for k in meta.get("kf_painted", [])),
          "FW-O: the lock gains kf:hurt for the offset key; a rig without key_offset or key paint has no kf: entry "
          "(the live rig: only its painted keys)")

    for bad, words in (({"hurt": [13, 0]}, ("12",)), ({"hurt": [0, 0.5]}, ("whole",)), ({"cast": [1, 0]}, ("cast",)),
                       ({"hurt": [0, 12]}, ("leave the",))):
        b = {**copy.deepcopy(cfg), "key_offset": bad}
        check(_refused(lambda: _entries(sid, b), sid, *words), f"FW-O: key_offset {bad} is refused ({' '.join(words)})")
    live = [p.stem for p in sorted(MA.RIGS.glob("*.yaml")) if "key_offset" in (MA.load_rig(p.stem) or {})]
    check(live == [] or all(MA.lock_path(s).exists() for s in live), f"FW-O: every rig with key_offset is locked ({live})")
