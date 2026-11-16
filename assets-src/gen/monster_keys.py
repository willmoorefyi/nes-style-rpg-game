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
- FW-O (ROSTER_FIX_PLAN_2.md 4, N-4): `key_offset: {key: [dx, dy]}` moves an approved key's pixels by whole px
  (transparent fill, no content change; after FW-R, before FW-P, and with paint=False too). offset_cfg (applied by
  monster_anim.load_rig) translates that key's keyframe joints, `masks.*.<key>` polygons and keyframe paint xy, so
  every coordinate a rig writes for the key is in its unmoved art; in-between paint is not moved (the rig agent
  re-derives it). Refused: |dx| or |dy| > KEY_OFFSET_MAX, a non-integer, a key the sheet does not have, an opaque px
  leaving the cell. An offset key is locked as `kf:<name>`.
"""
from __future__ import annotations

import copy

import numpy as np
from PIL import Image

from gen.monster_recipes import KEYFRAMES

KF_PAINT_CAP = 160
# orchestrator-approved per-sprite caps (ROSTER_FIX_PLAN.md 10: rev 3 and rev 15 rulings; ROSTER_FIX_PLAN_2.md 12
# D-R1, FW-PA: the chimera's second dragon head erased from its attack and hurt keys); nothing else may raise one
KF_PAINT_ALLOW = {("crocodile", "hurt"): 220, ("drowned_sovereign", "cast"): 300, ("chimera", "attack"): 800,
                  ("chimera", "hurt"): 720}  # hurt raised 600 -> 720 (orchestrator, round 2: measured erase >= 689 px)
# rev 15: drowned_sovereign/cast is a colour remap only: every patched pixel is opaque and stays opaque
KF_REMAP_ONLY = {("drowned_sovereign", "cast")}
OUTLINE = (6, 4, 10)
KEY_OFFSET_MAX = 12
_OFFSET_DONE = "_key_offset_applied"      # offset_cfg's marker: the translation is applied once


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


def key_offsets(sid: str, cfg: dict | None) -> dict[str, tuple[int, int]]:
    """FW-O: {key: (dx, dy)} of a rig's `key_offset` (validated: keyframe names, whole px, |d| <= KEY_OFFSET_MAX)."""
    out = {}
    for k, d in ((cfg or {}).get("key_offset") or {}).items():
        if k not in KEYFRAMES:
            raise ValueError(f"rig {sid}: key_offset {k}: not a keyframe ({', '.join(KEYFRAMES)})")
        if not (isinstance(d, (list, tuple)) and len(d) == 2 and all(isinstance(v, int) and not isinstance(v, bool)
                                                                    for v in d)):
            raise ValueError(f"rig {sid}: key_offset {k}: {d!r} is not [dx, dy] in whole px")
        if max(abs(d[0]), abs(d[1])) > KEY_OFFSET_MAX:
            raise ValueError(f"rig {sid}: key_offset {k}: {list(d)} is over {KEY_OFFSET_MAX} px")
        out[k] = (int(d[0]), int(d[1]))
    return out


def offset_cfg(sid: str, cfg: dict | None) -> dict | None:
    """FW-O: the rig with each offset key's joints, mask polygons and keyframe paint moved by its (dx, dy); a rig
    without key_offset (or already translated) comes back as the same object."""
    offs = key_offsets(sid, cfg)
    if not offs or cfg.get(_OFFSET_DONE):
        return cfg
    out = copy.deepcopy(cfg)
    for k, (dx, dy) in offs.items():
        kf = (out.get("keyframes") or {}).get(k) or {}
        for j, v in kf.items():
            kf[j] = [v[0] + dx, v[1] + dy]
        for per_kf in (out.get("masks") or {}).values():
            if per_kf and per_kf.get(k):
                per_kf[k] = [[x + dx, y + dy] for x, y in per_kf[k]]
        for p in out.get("paint") or []:
            if p.get("frame") == k:
                p["xy"] = [[x + dx, y + dy] for x, y in p["xy"]]
    out[_OFFSET_DONE] = True
    return out


def offset_keys(sid: str, cfg: dict | None, meta: dict, kfs: dict[str, Image.Image]) -> tuple[dict, dict]:
    """FW-O: (meta, keys) with each offset key moved by whole px (meta gains kf_offset); else unchanged."""
    offs = key_offsets(sid, cfg)
    if not offs:
        return meta, kfs
    out = dict(kfs)
    for k, (dx, dy) in offs.items():
        if k not in kfs:
            raise ValueError(f"rig {sid}: key_offset on keyframe {k}, which the sheet does not have")
        a = np.asarray(kfs[k].convert("RGBA"))
        h, w = a.shape[:2]
        ys, xs = np.nonzero(a[..., 3] > 0)
        if len(xs) and (xs.min() + dx < 0 or xs.max() + dx >= w or ys.min() + dy < 0 or ys.max() + dy >= h):
            raise ValueError(f"rig {sid}: key_offset {k}: {[dx, dy]} would make opaque px leave the {w}x{h} cell")
        b = np.zeros_like(a)
        b[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = a[max(0, -dy):h - max(0, dy), max(0, -dx):w - max(0, dx)]
        out[k] = Image.fromarray(b)
    return {**meta, "kf_offset": [k for k in KEYFRAMES if k in offs]}, out


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
    """FW-R, FW-O, then FW-P (paint=False: the approved keys, offset but unpainted, for fixmeasure's RED states). A
    painted sheet's meta gains `kf_painted` (names), `kf_raw` (the unpainted keys) and `kf_palette` (the approved
    palette); an offset sheet's gains `kf_offset`."""
    cfg = offset_cfg(sid, cfg)
    meta, kfs = drop_raise(sid, cfg, meta, kfs)
    meta, kfs = offset_keys(sid, cfg, meta, kfs)
    if not paint:
        return meta, kfs
    keys, painted = paint_keys(sid, cfg, kfs)
    if not painted:
        return meta, kfs
    return {**meta, "kf_painted": painted, "kf_raw": {k: kfs[k] for k in painted},
            "kf_palette": sorted(approved_palette(kfs))}, keys
