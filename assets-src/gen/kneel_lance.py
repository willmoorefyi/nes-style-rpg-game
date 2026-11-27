"""Pass CL (docs/CLASS_LANCE_PLAN.md 6): the kneel of a lance class (`kneel: {source: user, grip: [x, y]}`).

The key is the user's KNEEL cell as rendered. kneel_bridge.frames runs on the bodies (the lance cut out of ready and of
the key, its footprint filled), then the lance goes back on top, carried by whole px (never resampled): kneel_in1 takes
ready's lance moved u1 of the way from ready's grip (hand_n) to the key's `grip`, kneel_in2 the key's lance moved u2 of
the way back, kneel_b the key's lance unmoved (braced on the ground; the hands sink 1 px along the shaft). A lance that
stands on the ground in its cell (the key's) stays planted (no vertical carry). If the two lances' angles differ by more
than ANGLE_CARRY the bridge frames would need a redraw; that is refused (none of the pass's classes needs one).
"""
from __future__ import annotations

import numpy as np
from PIL import Image

from gen import hero_user_lance as HL
from gen import kneel_bridge as KB
from gen import puppet as PU
from gen import puppet_lance as PL

KEYS = ("source", "bridge", "offset", "grip", "alias_frames")
ANGLE_CARRY = 10.0


def parts(cid: str, cfg: dict, frames: dict) -> tuple[dict, dict, dict]:
    """(block, ready split, key split)."""
    b = cfg["kneel"]
    if set(b) - set(KEYS):
        raise ValueError(f"{cid}: a lance kneel block refuses {sorted(set(b) - set(KEYS))}")
    if "grip" not in b:
        raise ValueError(f"{cid}: a lance kneel block needs `grip` (the near fist on the key)")
    meta, kmeta = PL.meta_of(cid), PL.meta_of(cid, "battle_kneel")
    key = KB.offset(np.asarray(Image.open(PU.APPROVED / cid / "battle_kneel.png").convert("RGBA")).copy(),
                    b.get("offset"))
    rp = PL.split(meta, np.asarray(frames["ready"].convert("RGBA")).copy(), meta["prop"]["lines"]["ready"])
    kp = PL.split(kmeta, key, kmeta["prop"]["lines"]["kneel"])
    if abs(HL.angle(rp["line"]) - HL.angle(kp["line"])) > ANGLE_CARRY:
        raise ValueError(f"{cid}: ready and kneel lances differ by more than {ANGLE_CARRY} deg (a carry cannot bridge)")
    return b, rp, kp


def hero_frames(cid: str, cfg: dict, frames: dict, bottom: int) -> dict:
    """puppet_kneel.make for a lance class: {name: (image, {}, source)}, plus `_bodies` {name: body image} and
    `_lances` {name: (lance, source split)} for the checks."""
    b, rp, kp = parts(cid, cfg, frames)
    o = KB.options(b, cid)
    made = KB.frames(rp["body"], kp["body"], bottom, o)
    u1, u2 = (float(v) for v in o["u"])
    g_r = np.asarray(cfg["battle"]["ready"]["hand_n"], float)
    g_k = np.asarray(b["grip"], float)
    lances = {"kneel_in1": (PL.carry(rp, u1 * (g_k - g_r), under=True), rp),
              "kneel_in2": (PL.carry(kp, u2 * (g_r - g_k), under=True), kp),
              "kneel_b": (PL.carry(kp, (0, 0), under=True), kp)}
    out = {"kneel": (Image.fromarray(kp["img"]), {}, "user")}
    for n, (lance, _) in lances.items():
        out[n] = (PL.compose(made[n], lance, None), {}, "bridge")
    bodies = {n: made[n] for n in lances}
    for n in b.get("alias_frames") or []:             # the review fallback (plan 5): the frame is its source key
        if n not in lances:
            raise ValueError(f"{cid}: kneel alias_frames {n!r} is not a bridge frame ({', '.join(lances)})")
        src = rp if n == "kneel_in1" else kp
        lances[n] = (PL.carry(src, (0, 0), completed=False), src)
        out[n] = (Image.fromarray(src["img"]), {}, "alias")
        bodies[n] = src["body"]
    out["_bodies"] = {**{n: Image.fromarray(a) for n, a in bodies.items()}, "kneel": Image.fromarray(kp["body"]),
                      "ready": Image.fromarray(rp["body"])}
    out["_lances"] = lances
    out["_key"] = kp
    return out


def checks(cid: str, made: dict, bottom: int) -> list[str]:
    """L1-L8 on the bridge frames (5.2.5, 6): a lance px below the feet row only where it is the key's, carried."""
    meta = PL.meta_of(cid, "battle_kneel")
    pal = {tuple(int(v) for v in d) for _, d in meta["cut"]["palette"]}
    fails = []
    kp = made["_key"]
    for n, (lance, src) in made["_lances"].items():
        exempt = PL.shift(src["lmask"], *lance["delta"]) if src is kp else None
        rep = PL.lance_checks(np.asarray(made[n][0]), lance, src, pal, bottom, exempt=exempt)
        rep.pop("L7", None)                                          # no joints on a bridge frame
        bad = [k for k, v in rep.items() if not v]
        fails += [f"{n}: lance {', '.join(bad)}"] if bad else []
    angles = {"kneel": HL.angle(kp["line"]), **{n: HL.angle(lance["line"]) for n, (lance, _) in made["_lances"].items()}}
    angles["ready"] = HL.angle(made["_lances"]["kneel_in1"][1]["line"])
    fails += [f"L8 {t}" for t in PL.turns(angles, (["ready", "kneel_in1", "kneel_in2", "kneel", "kneel_b"],))]
    return fails
