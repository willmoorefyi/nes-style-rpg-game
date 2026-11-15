"""Rig edits to the approved keyframes, applied once in monster_anim.load_entries (docs/ROSTER_FIX_PLAN.md 3, revision
10), so the build, `check`, `review`, `lock` and `fixmeasure.py` all see the same keys. The approved PNGs are never
edited.

- FW-R (D-F1): a rig with `raise: false` drops the approved `attack_raise` key (after pad_keyframes, so the cell stays
  the max of every approved key and no frame moves). The sheet then has no raise frames (`hasRaise: false`) and the
  atlas writes `tip` from `atk_wind2` instead (monster_atlas.sheet_meta).
- FW-P (D-F6): a rig `paint` entry whose `frame` is a keyframe (idle attack hurt cast attack_raise) paints that key,
  in padded-cell coordinates. At most KF_PAINT_CAP distinct px per key; `kf_paint_cap: {key: n}` raises it only to an
  orchestrator-approved exception (KF_PAINT_ALLOW). Colours must be in the approved palette (the union of the
  sprite's approved key colours, as monster_atlas computes it for variants) or null (transparent). A painted key is
  locked as `kf:<name>` (monster_check.write_lock) and gets the palette, pieces and outline checks.
"""
from __future__ import annotations

import numpy as np
from PIL import Image

from gen.monster_recipes import KEYFRAMES

KF_PAINT_CAP = 160
# orchestrator-approved per-sprite caps (ROSTER_FIX_PLAN.md 10: rev 3 and rev 15 rulings); nothing else may raise one
KF_PAINT_ALLOW = {("crocodile", "hurt"): 220, ("drowned_sovereign", "cast"): 300}
# rev 15: drowned_sovereign/cast is a colour remap only: every patched pixel is opaque and stays opaque
KF_REMAP_ONLY = {("drowned_sovereign", "cast")}
OUTLINE = (6, 4, 10)


def approved_palette(kfs: dict[str, Image.Image]) -> set[tuple[int, int, int]]:
    """The union of the opaque RGB colours over the approved keys (plus the outline ink)."""
    cols = {OUTLINE}
    for im in kfs.values():
        a = np.asarray(im.convert("RGBA"))
        cols |= {tuple(int(v) for v in c) for c in np.unique(a[a[..., 3] > 0][:, :3], axis=0)}
    return cols


def raise_off(sid: str, cfg: dict | None) -> bool:
    """FW-R: True for a rig with `raise: false`; any other value but true / absent is an error naming the rig."""
    v = (cfg or {}).get("raise", True)
    if v not in (True, False):
        raise ValueError(f"rig {sid}: raise must be true or false, not {v!r}")
    return v is False


def drop_raise(sid: str, cfg: dict | None, meta: dict, kfs: dict[str, Image.Image]) -> tuple[dict, dict]:
    """FW-R: (meta, keys) without `attack_raise` for a `raise: false` rig (meta gains raise_off: True); else unchanged."""
    if not raise_off(sid, cfg):
        return meta, kfs
    keys = {k: v for k, v in kfs.items() if k != "attack_raise"}
    return {**meta, "poses": [p for p in meta.get("poses", list(kfs)) if p != "attack_raise"], "raise_off": True}, keys


def kf_patches(cfg: dict | None) -> list[dict]:
    return [p for p in (cfg or {}).get("paint") or [] if p.get("frame") in KEYFRAMES]


def paint_keys(sid: str, cfg: dict | None, kfs: dict[str, Image.Image]) -> tuple[dict[str, Image.Image], list[str]]:
    """FW-P: (keys, painted key names). A rig without keyframe paint gets the same image objects back. Refused with a
    ValueError naming the rig: a cap not in KF_PAINT_ALLOW (or above it), more distinct px than the cap, a colour
    outside the approved palette, a pixel outside the cell, a missing key, and in a remap-only key a null colour or a
    transparent pixel."""
    caps = (cfg or {}).get("kf_paint_cap") or {}
    for k, v in caps.items():
        top = KF_PAINT_ALLOW.get((sid, k))
        if top is None or not isinstance(v, int) or v > top:
            raise ValueError(f"rig {sid}: kf_paint_cap {k}: {v} is not an approved exception "
                             f"(allowed: {', '.join(f'{s}/{f} <= {n}' for (s, f), n in sorted(KF_PAINT_ALLOW.items()))})")
    patches = kf_patches(cfg)
    if not patches:
        return kfs, []
    pal = approved_palette(kfs)
    out, painted = dict(kfs), []
    for k in KEYFRAMES:
        ps = [p for p in patches if p["frame"] == k]
        if not ps:
            continue
        if k not in kfs:
            raise ValueError(f"rig {sid}: paint on keyframe {k}, which the sheet does not have")
        a = np.asarray(kfs[k].convert("RGBA")).copy()
        h, w = a.shape[:2]
        n, cap = len({(int(x), int(y)) for p in ps for x, y in p["xy"]}), int(caps.get(k, KF_PAINT_CAP))
        if n > cap:
            raise ValueError(f"rig {sid}: keyframe paint on {k} is {n} px > the {cap} px cap")
        remap = (sid, k) in KF_REMAP_ONLY
        for p in ps:
            rgb = p.get("rgb")
            if rgb is not None and tuple(int(c) for c in rgb) not in pal:
                raise ValueError(f"rig {sid}: keyframe paint on {k} uses {list(rgb)}, not in the approved palette")
            if remap and rgb is None:
                raise ValueError(f"rig {sid}: keyframe paint on {k} is a colour remap only (rgb: null refused)")
            for x, y in p["xy"]:
                if not (0 <= x < w and 0 <= y < h):
                    raise ValueError(f"rig {sid}: keyframe paint on {k} at ({x}, {y}) is outside the {w}x{h} cell")
                if remap and a[y, x, 3] == 0:
                    raise ValueError(f"rig {sid}: keyframe paint on {k} at ({x}, {y}) is transparent (remap only)")
                a[y, x] = (*rgb, 255) if rgb is not None else 0
        out[k] = Image.fromarray(a)
        painted.append(k)
    return out, painted


def apply(sid: str, cfg: dict | None, meta: dict, kfs: dict[str, Image.Image], paint: bool = True) -> tuple[dict, dict]:
    """FW-R, then FW-P (paint=False: the approved keys, for fixmeasure's RED states). A painted sheet's meta gains
    `kf_painted` (names), `kf_raw` (the unpainted keys) and `kf_palette` (the approved palette)."""
    meta, kfs = drop_raise(sid, cfg, meta, kfs)
    if not paint:
        return meta, kfs
    keys, painted = paint_keys(sid, cfg, kfs)
    if not painted:
        return meta, kfs
    return {**meta, "kf_painted": painted, "kf_raw": {k: kfs[k] for k in painted},
            "kf_palette": sorted(approved_palette(kfs))}, keys
