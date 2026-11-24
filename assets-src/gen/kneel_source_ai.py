"""Pass KT `kneel: {source: ai}` (docs/KNEEL_TWEEN_PLAN.md D-KT1 / D-KT2): the approved AI key as a rig's kneel key and
generate's entries for its bridge frames. kneel.py delegates here (add_key, prepare, skip, bridge_frames)."""
from __future__ import annotations

import numpy as np
from PIL import Image

from gen.monster_recipes import KNEEL_FRAMES


def ai_key(sid: str, cfg: dict, kfs: dict[str, Image.Image]) -> np.ndarray:
    """The approved AI kneel key (approved/<id>/kneel.png, the idle's cell), moved by the block's `offset` (FW-O style:
    the approved file is never edited) and painted by its `paint` (FW-P)."""
    from gen import kneel as KN
    from gen import kneel_bridge as KB
    from gen import monster_anim as MA
    from gen import monster_keys as MK
    path = MA.APPROVED / sid / "kneel.png"               # monster_anim's (the retire selftest patches its tree)
    if not path.exists():
        raise ValueError(f"rig {sid}: kneel source ai but no approved {path.name}")
    key = np.asarray(Image.open(path).convert("RGBA")).copy()
    if key.shape[:2] != (kfs["idle"].size[1], kfs["idle"].size[0]):
        raise ValueError(f"rig {sid}: AI kneel key {key.shape[1]}x{key.shape[0]} != the idle cell {kfs['idle'].size}")
    b = KN.block(cfg)
    return MK.kneel_paint(sid, b.get("paint"), KB.offset(key, b.get("offset")), kfs,
                          MK.kneel_cap(sid, cfg))                 # EF-C2: kf_paint_cap.kneel (KNEEL_PAINT_ALLOW)


HERO_KEYS = ("source", "bridge", "offset")


def hero_frames(cid: str, cfg: dict, frames: dict, bottom: int) -> dict:
    """puppet_kneel.make for a `source: ai` class: {name: (image, {}, source)} with the approved key
    approved/<class>/battle_kneel.png (moved by `offset`) and the bridge frames from ready; no rotations."""
    from gen import kneel_bridge as KB
    from gen import puppet as PU
    b = cfg["kneel"]
    if set(b) - set(HERO_KEYS):
        raise ValueError(f"{cid}: kneel source ai refuses {sorted(set(b) - set(HERO_KEYS))}")
    key = KB.offset(np.asarray(Image.open(PU.APPROVED / cid / "battle_kneel.png").convert("RGBA")).copy(),
                    b.get("offset"))
    made = KB.frames(np.asarray(frames["ready"].convert("RGBA")).copy(), key, bottom, KB.options(b, cid))
    return {"kneel": (Image.fromarray(key), {}, "ai"), **{n: (Image.fromarray(a), {}, "bridge") for n, a in made.items()}}


def bridge_frames(sid: str, cfg: dict, kfs: dict[str, Image.Image], meta: dict, floating: bool) -> dict[str, dict]:
    """generate's entries for kneel_in1 / kneel_in2 / kneel_b of a `source: ai` rig: one-source frames (no labels,
    joints or rotations), with the recipe's src / toward / u for the plain checks; the rig's per-frame paint applies."""
    from gen import kneel as KN
    from gen import kneel_bridge as KB
    stale = sorted(set(cfg.get("frames") or {}) & set(KNEEL_FRAMES))
    if stale:                                         # rig tweaks of the derived in-betweens mean nothing here
        raise ValueError(f"rig {sid}: kneel source ai with frames.{stale} (tune `kneel.bridge` instead)")
    o = KB.options(KN.block(cfg), f"rig {sid}")
    idle, key = (np.asarray(kfs[k].convert("RGBA")).copy() for k in ("idle", "kneel"))
    made = KB.frames(idle, key, int(meta["bottom_row"]), o)
    spec = {"kneel_in1": ("idle", "kneel", float(o["u"][0]), 0), "kneel_in2": ("kneel", "idle", float(o["u"][1]), 0),
            "kneel_b": ("kneel", "kneel", 0.0, 1)}
    out = {}
    for n, (src, to, u, dy) in spec.items():
        img = made[n]
        for patch in cfg.get("paint") or []:
            if patch["frame"] == n:
                for x, y in patch["xy"]:
                    img[y, x] = (*patch["rgb"], 255) if patch.get("rgb") is not None else 0
        out[n] = {"img": img, "labels": None, "src": src, "toward": to, "u": u, "joints": {}, "rots": {},
                  "pinned": True, "prop_px": {}, "dy": dy, "dx": 0, "floating": floating, "bridge": True}
    return out
