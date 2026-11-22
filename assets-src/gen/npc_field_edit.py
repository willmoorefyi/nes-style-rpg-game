"""The per-cell cut and the offline edit steps of the AR NPC field sheets (`npc_field_cut.py`, SPEC entries with
`cells`). Pure numpy / PIL; no Bedrock call, no randomness outside the cutter's seeded k-means.

A `cells` SPEC entry:
  renders  {alias: [render tag, cache key, rows in the render]}
  cut      {alias: {"tol": flood tolerance (default 14), "holes": colour distance}}: `holes` cuts away enclosed
           background-coloured areas of at least HOLE_MIN render px (between the legs, under a tail)
  cells    3 rows (down, up, side drawn facing right) of 3 cells [alias, cell index in the render, mirror]; a
           mirrored cell is flipped left-right after it is placed (so a step drawn facing the wrong way faces right)
  shifts   {row: [[src hue, tol, dst hue, sat x, val x, (min sat)]]}: pre-quantize hue shifts of that row's cells
  edits    post steps on the finished sheet, in order (below); every colour they write is a 15-bit colour already
           in the sheet or snapped to 15 bits, and alpha stays binary
Edit steps:
  erase  {"op": "erase", "cell": [r, c], "rects": [[x0, y0, x1, y1], ...]} (cell px, x1 / y1 exclusive): clears
         the rects, drops the small pieces (< 6 px) left touching them, and outlines the new edge (the selective
         outline rule, only next to the rects)
  ramp   {"op": "ramp", "cells": [[r, c], ...], "rect": [x0, y0, x1, y1] (optional), "match": {...},
         "to": {"cells": [...], ...}, "mode": "nearest" | "rank"}: every colour of the cells (inside the rect) that
         passes `match` is replaced by a colour of the target ramp: the colours of the `to` cells that pass `to`'s
         predicate with at least RAMP_MIN px. `nearest`: the ramp colour of the nearest value (ties: saturation);
         `rank`: the sources sorted by value spread over the ramp sorted by value
         predicates: hue [lo, hi] (deg, wraps), smin, smax, vmin, vmax
  fill   {"op": "fill", "cell": [r, c], "rect": [x0, y0, x1, y1], "color": "#rrggbb"}: the see-through holes of
         the cell inside the rect (transparent pieces that do not reach the cell border) are filled with the colour
  patch  {"op": "patch", "cell": [r, c], "pixels": [[x, y, "#rrggbb" | null], ...]}: single pixels (null clears)
"""
from __future__ import annotations

import colorsys

import numpy as np
from PIL import Image

GW, GH = 48, 96
HOLE_MIN = 400
RAMP_MIN = 8
PIECE_MIN = 6


def hue_shift(col, solid, src, tol, dst, smul=1.0, vmul=1.0, smin=0.12):
    """Pre-quantize recolour of one frame: pixels of hue within src +- tol (deg) and saturation >= smin get their
    hue moved by dst - src, saturation x smul, value x vmul (AR-N's review.hue_shift)."""
    c = col.copy()
    h, w = solid.shape
    flat = c.reshape(-1, 3) / 255.0
    hsv = np.array([colorsys.rgb_to_hsv(*p) for p in flat])
    hd = hsv[:, 0] * 360
    d = (hd - src + 180) % 360 - 180
    m = (np.abs(d) <= tol) & (hsv[:, 1] >= smin) & solid.reshape(-1)
    hsv[m, 0] = ((hd[m] + dst - src) % 360) / 360
    hsv[m, 1] = np.clip(hsv[m, 1] * smul, 0, 1)
    hsv[m, 2] = np.clip(hsv[m, 2] * vmul, 0, 1)
    out = np.array([colorsys.hsv_to_rgb(*p) for p in hsv]) * 255
    return out.reshape(h, w, 3).astype(np.float32), solid


def render_frames(C, raw, rows, tol=14, holes=None, scale=1.0):
    """The cutter's cells of one render with a flood tolerance and the optional hole cut (AR-N's review.frames)."""
    if holes is None and tol == 14:
        return C.frames(raw, rows, scale)
    rgb, cells, ch, cw = C.cell_masks(raw, rows, tol)
    size = (round(GW * scale), round(GH * scale))
    hole = np.zeros(rgb.shape[:2], bool)
    if holes is not None:
        bg = np.median(np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]), axis=0)
        near = np.linalg.norm(rgb.astype(np.float32) - bg, axis=2) < holes
        lab, _n = C.components(near)
        sizes = np.bincount(lab.ravel())
        hole = near & (sizes[lab] >= HOLE_MIN) & (lab > 0)
    return [C.down(rgb, m & ~hole, (c * cw, r * ch, (c + 1) * cw, (r + 1) * ch), size) for r, c, m in cells]


def hexs(c) -> str:
    return "#%02x%02x%02x" % tuple(int(v) for v in c)


def _hsv(c):
    h, s, v = colorsys.rgb_to_hsv(*(np.asarray(c, np.float64) / 255))
    return h * 360, s, v


def _passes(c, p: dict) -> bool:
    h, s, v = _hsv(c)
    if "hue" in p:
        lo, hi = p["hue"]
        if not (lo <= h <= hi if lo <= hi else (h >= lo or h <= hi)):
            return False
    return (s >= p.get("smin", 0) and s <= p.get("smax", 1) and v >= p.get("vmin", 0) and v <= p.get("vmax", 1))


def _cell(a, r, c):
    return a[r * GH:(r + 1) * GH, c * GW:(c + 1) * GW]


def _ring(al):
    ring = np.zeros_like(al)
    ring[1:] |= al[:-1]; ring[:-1] |= al[1:]; ring[:, 1:] |= al[:, :-1]; ring[:, :-1] |= al[:, 1:]
    return ring & ~al


def erase(a, step, outline):
    r, c = step["cell"]
    q = _cell(a, r, c)
    zone = np.zeros(q.shape[:2], bool)
    for x0, y0, x1, y1 in step["rects"]:
        zone[y0:y1, x0:x1] = True
    q[zone] = 0
    near = zone | _ring(zone)
    al = q[..., 3] > 0
    from gen.pixelize import components
    lab, n = components(al)
    for i in range(1, n + 1):
        piece = lab == i
        if piece.sum() < PIECE_MIN and (piece & near).any():
            q[piece] = 0
    al = q[..., 3] > 0
    new = outline(q.copy())
    edge = _ring(al) & (zone | _ring(zone))
    q[edge] = new[edge]
    return {"cell": [r, c], "rects": step["rects"], "cleared_px": int(zone.sum()), "outlined_px": int(edge.sum())}


def ramp(a, step):
    src_cells = [_cell(a, r, c) for r, c in step["cells"]]
    x0, y0, x1, y1 = step.get("rect", [0, 0, GW, GH])
    to = step["to"]
    ref = np.concatenate([_cell(a, r, c)[_cell(a, r, c)[..., 3] > 0][:, :3] for r, c in to["cells"]])
    cols, counts = np.unique(ref, axis=0, return_counts=True)
    target = sorted((tuple(int(v) for v in col) for col, n in zip(cols, counts)
                     if n >= RAMP_MIN and _passes(col, to)), key=lambda d: (_hsv(d)[2], d))
    if not target:
        raise SystemExit(f"npc_field_edit: ramp step {step} has an empty target ramp")
    used = set()
    for q in src_cells:
        sub = q[y0:y1, x0:x1]
        used |= {tuple(int(v) for v in col) for col in sub[sub[..., 3] > 0][:, :3]}
    srcs = sorted((col for col in used if _passes(col, step["match"]) and col not in target),
                  key=lambda d: (_hsv(d)[2], d))
    remap = {}
    for i, col in enumerate(srcs):
        if step.get("mode", "nearest") == "rank":
            remap[col] = target[round(i * (len(target) - 1) / max(len(srcs) - 1, 1))]
        else:
            _h, s, v = _hsv(col)
            remap[col] = min(target, key=lambda d: (abs(_hsv(d)[2] - v), abs(_hsv(d)[1] - s), d))
    for q in src_cells:
        sub = q[y0:y1, x0:x1]
        for s_col, d_col in remap.items():
            m = (sub[..., 3] > 0) & np.all(sub[..., :3] == s_col, axis=-1)
            sub[m, :3] = d_col
    return {"cells": step["cells"], "map": {hexs(s): hexs(d) for s, d in remap.items()}}


def _rgb15(col: str):
    from gen.pixelize import snap15
    rgb = np.array([int(col[i:i + 2], 16) for i in (1, 3, 5)], np.float32)
    if hexs(snap15(rgb)) != col:
        raise SystemExit(f"npc_field_edit: colour {col} is not a 15-bit colour")
    return rgb.astype(np.uint8)


def fill(a, step):
    from gen.pixelize import components
    r, c = step["cell"]
    q = _cell(a, r, c)
    x0, y0, x1, y1 = step["rect"]
    lab, n = components(q[..., 3] == 0)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])).tolist())
    zone = np.zeros(lab.shape, bool)
    zone[y0:y1, x0:x1] = True
    holes = (lab > 0) & ~np.isin(lab, list(edge)) & zone
    q[holes, :3] = _rgb15(step["color"]); q[holes, 3] = 255
    return {"cell": [r, c], "rect": step["rect"], "color": step["color"], "filled_px": int(holes.sum())}


def patch(a, step):
    r, c = step["cell"]
    q = _cell(a, r, c)
    for x, y, col in step["pixels"]:
        if col is None:
            q[y, x] = 0
            continue
        q[y, x, :3] = _rgb15(col); q[y, x, 3] = 255
    return {"cell": [r, c], "pixels": len(step["pixels"])}


def apply_edits(sheet: Image.Image, edits: list[dict], outline) -> tuple[Image.Image, list[dict]]:
    a = np.asarray(sheet).copy()
    log = []
    for step in edits:
        op = step["op"]
        if op == "erase":
            res = erase(a, step, outline)
        elif op == "ramp":
            res = ramp(a, step)
        elif op == "fill":
            res = fill(a, step)
        elif op == "patch":
            res = patch(a, step)
        else:
            raise SystemExit(f"npc_field_edit: unknown edit op {op!r}")
        log.append({"op": op} | ({"why": step["why"]} if "why" in step else {}) | res)
    return Image.fromarray(a), log


def build(C, spec: dict) -> tuple[Image.Image, Image.Image, list[dict]]:
    """(the sheet before its edits, the edited sheet, the edit log) of a `cells` SPEC entry."""
    cache: dict = {}

    def cells_of(alias):
        if alias not in cache:
            _tag, key, rows = spec["renders"][alias]
            cut = spec.get("cut", {}).get(alias, {})
            cache[alias] = render_frames(C, C._cached(key), rows, cut.get("tol", 14), cut.get("holes"))
        return cache[alias]

    picked, flips = [], []
    for ri, row in enumerate(spec["cells"]):
        for alias, idx, mir in row:
            f = cells_of(alias)[idx]
            for sh in spec.get("shifts", {}).get(ri, []):
                f = hue_shift(*f, *sh)
            picked.append(f); flips.append(mir)
    q = C.quantize(picked, spec.get("colors", 16))
    out = Image.new("RGBA", (3 * GW, 3 * GH))
    for i, (f, mir) in enumerate(zip(q, flips)):
        im = C.place(f)
        if mir:
            im = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        out.alpha_composite(im, ((i % 3) * GW, (i // 3) * GH))
    edited, log = apply_edits(out, spec.get("edits", []), C.outline)
    return out, edited, log
