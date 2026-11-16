"""FW-M2 subcommands of fixmeasure.py (docs/ROSTER_FIX_PLAN_2.md 4); fixmeasure.py dispatches here.

  fixmeasure.py edges <sprite> <frame>... [--box X0 Y0 X1 Y1] [--vs KEY [--shift DX,DY]] [--xy]
      spurs (opaque px with <= 1 opaque 4-neighbour), inner ink (ink px with 4 opaque 4-neighbours), edge gaps
      (silhouette-edge px that are not ink) and bare ink (ink px with no fill 4-neighbour). Neighbours come from the
      whole frame, counts from the box. --vs: KEY measured in the box, every frame in the box moved by --shift (the
      frame's dx, dy against KEY), plus the difference. --xy lists the pixels.
  fixmeasure.py match <sprite> <A> <B> --box BA --to BB --rgb R,G,B ...
      px whose colour class (which --rgb colour, or none) differs between A in box BA and B in box BB (same size).
  fixmeasure.py poly <sprite> <frame>... --poly PART@KEY [--not-mask PART[@KEY] ...] [--masks RIG.yaml]
      opaque px inside the rig polygon masks.PART.KEY minus the other polygons (their key defaults to KEY).
  fixmeasure.py switch <sprite> <seq> [--rig RIG.yaml]
      with a rig: every adjacent pair of SEQUENCES[seq] with a generated frame against the continuity need
      min(0.55, IoU(span) + 0.02) and cap max(6 x cell_h / 80, 0.5 x span centroid distance) (monster_check); without
      one: the best key-switch translation d of the seq's key against the idle and the per-frame table (T-K pre-check).
  fixmeasure.py rowspan <sprite> <frame>... --rows Y0 Y1          # opaque x extent (inclusive) of rows [Y0, Y1)
  fixmeasure.py sweep [--top N]                                   # roster edge-gap sweep over the locked rigs
  colours / select also take [--vs KEY] [--shift DX,DY] [--poly PART@KEY] [--not-mask PART[@KEY] ...] [--masks RIG]:
      the region is the box and the polygon (minus the not-masks) moved by --shift; colours --vs prints KEY in the
      unmoved region; select --vs keeps only px that differ from KEY at (x - dx, y - dy). A not-mask without a poly
      takes the frame's own key (a keyframe) or the key it is cut from.
Every box is X0 Y0 X1 Y1 with X1 / Y1 exclusive (fixmeasure.py conventions); --raw skips the keyframe paint.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np
import yaml
from PIL import Image, ImageDraw

from gen import fixmeasure as FM
from gen import monster_anim as MA
from gen.fixmeasure_px import INK, Box, _in_box, _rgb_mask
from gen.fixmeasure_seq import _shift, sweep, switch  # noqa: F401  (re-exported)

CMDS = ("edges", "match", "poly", "switch", "rowspan", "sweep")
EXTENDED = ("vs", "shift", "poly", "not-mask", "masks")      # colours / select options that route here
METRICS = ("spurs", "inner_ink", "edge_gaps", "bare_ink")


# ───────── primitives ─────────
def _n4(m: np.ndarray) -> list[np.ndarray]:
    p = np.pad(m, 1)
    return [p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]]


def edge_masks(a: np.ndarray) -> dict[str, np.ndarray]:
    op = a[..., 3] > 0
    ink = op & (a[..., :3] == INK).all(2)
    n = sum(x.astype(int) for x in _n4(op))
    nf = np.logical_or.reduce(_n4(op & ~ink))
    return {"spurs": op & (n <= 1), "inner_ink": ink & (n == 4), "edge_gaps": op & (n < 4) & ~ink, "bare_ink": ink & ~nf}


def edge_metrics(a: np.ndarray, box: Box | None = None, xy: bool = False) -> dict:
    inb = _in_box(a.shape, box)
    out = {}
    for k, m in edge_masks(a).items():
        out[k] = int((m & inb).sum())
        if xy:
            out[f"{k}_xy"] = [[int(x), int(y)] for y, x in zip(*np.nonzero(m & inb))]
    return out


def shift_box(box: Box | None, d) -> Box | None:
    return None if box is None or d is None else (box[0] + d[0], box[1] + d[1], box[2] + d[0], box[3] + d[1])


def poly_mask(poly, shape, d=(0, 0)) -> np.ndarray:
    """A rig polygon rasterized as rig.segment does (PIL polygon fill), moved by d."""
    m = Image.new("L", (shape[1], shape[0]), 0)
    ImageDraw.Draw(m).polygon([(p[0] + d[0], p[1] + d[1]) for p in poly], fill=255)
    return np.asarray(m) > 0


def _cls(a: np.ndarray, rgbs) -> np.ndarray:
    out = np.full(a.shape[:2], -1, np.int32)
    for i, c in enumerate(rgbs):
        out[_rgb_mask(a, [c])] = i
    return out


def match_px(a: np.ndarray, b: np.ndarray, box_a: Box, box_b: Box, rgbs) -> int:
    (ax0, ay0, ax1, ay1), (bx0, by0, bx1, by1) = box_a, box_b
    if (ax1 - ax0, ay1 - ay0) != (bx1 - bx0, by1 - by0):
        raise SystemExit(f"fixmeasure match: boxes differ in size ({box_a} vs {box_b})")
    return int((_cls(a, rgbs)[ay0:ay1, ax0:ax1] != _cls(b, rgbs)[by0:by1, bx0:bx1]).sum())


def row_extent(a: np.ndarray, rows: tuple[int, int]) -> tuple[int, int] | None:
    xs = np.nonzero((a[rows[0]:rows[1], :, 3] > 0).any(0))[0]
    return (int(xs.min()), int(xs.max())) if len(xs) else None


# ───────── sprite-level measures ─────────
def _key_of(s: FM.Sprite, frame: str) -> str:
    n = s.name(frame)
    return n if n in s.kfs else s.gen[n]["src"]


def _polygon(masks: dict, spec: str, key: str) -> list:
    part, _, k = spec.partition("@")
    poly = ((masks.get("masks") or {}).get(part) or {}).get(k or key)
    if not poly:
        raise SystemExit(f"fixmeasure: no polygon masks.{part}.{k or key} in the rig")
    return poly


def region(s: FM.Sprite, frame: str, box: Box | None = None, poly: str | None = None, not_masks=(),
           masks: dict | None = None, shift=None) -> np.ndarray:
    """The box and the polygon minus the not-mask polygons, all moved by `shift`, on the frame's cell."""
    shape, d = s.img(frame).shape, tuple(shift or (0, 0))
    masks = masks if masks is not None else (s.cfg or {})
    m = _in_box(shape, shift_box(box, d) if box else None)
    key = poly.partition("@")[2] if poly else _key_of(s, frame)
    if poly:
        m &= poly_mask(_polygon(masks, poly, key), shape, d)
    for nm in not_masks or ():
        m &= ~poly_mask(_polygon(masks, nm, key), shape, d)
    return m


def poly(sprite, frames: list[str], poly_spec: str, not_masks=(), masks: dict | None = None, rig=None,
         paint: bool = True) -> dict[str, int]:
    s = FM._sprite(sprite, rig, paint)
    return {f: int(((s.img(f)[..., 3] > 0) & region(s, f, None, poly_spec, not_masks, masks)).sum()) for f in frames}


def colours(sprite, frames: list[str], rgbs, box: Box | None = None, shift=None, poly: str | None = None, not_masks=(),
            masks: dict | None = None, rig=None, paint: bool = True) -> dict[str, dict]:
    s = FM._sprite(sprite, rig, paint)
    out = {}
    for f in frames:
        a, m = s.img(f), region(s, f, box, poly, not_masks, masks, shift)
        each = {tuple(c): int((_rgb_mask(a, [c]) & m).sum()) for c in rgbs}
        out[f] = {"n": sum(each.values()), "each": each}
    return out


def edges(sprite, frames: list[str], box: Box | None = None, vs: str | None = None, shift=None, xy: bool = False,
          rig=None, paint: bool = True) -> dict:
    """{key: KEY's metrics in the box (or None), frames: {f: metrics in the moved box}, diff: {f: frame - key}}."""
    s = FM._sprite(sprite, rig, paint)
    key = edge_metrics(s.img(vs), box, xy) if vs else None
    fr = {f: edge_metrics(s.img(f), shift_box(box, shift) if shift else box, xy) for f in frames}
    diff = {f: {k: m[k] - key[k] for k in METRICS} for f, m in fr.items()} if key else {}
    return {"key": key, "frames": fr, "diff": diff}


def match(sprite, a: str, b: str, box_a: Box, box_b: Box, rgbs, rig=None, paint: bool = True) -> int:
    s = FM._sprite(sprite, rig, paint)
    return match_px(s.img(a), s.img(b), box_a, box_b, rgbs)


def rowspan(sprite, frames: list[str], rows: tuple[int, int], rig=None, paint: bool = True) -> dict:
    s = FM._sprite(sprite, rig, paint)
    return {f: row_extent(s.img(f), rows) for f in frames}


# ───────── CLI ─────────
def _d(o: dict) -> tuple[int, int] | None:
    v = o.get("shift")
    return tuple(int(c) for c in ",".join(v).replace(" ", "").split(",")[:2]) if v else None


def _masks(o: dict) -> dict | None:
    from gen import monster_keys as MK
    return MK.offset_cfg("--masks", yaml.safe_load(Path(o["masks"][0]).read_text())) if o.get("masks") else None


def _fmt(m: dict) -> str:
    return " ".join(f"{k.replace('_', ' ')} {m[k]}" for k in METRICS)


def main(argv: list[str]) -> int:
    pos, o = FM._opts(argv[1:])
    cmd, paint, box, d = argv[0], "raw" not in o, FM._box(o.get("box")), _d(o)
    nm, pspec, masks = o.get("not-mask") or [], (o.get("poly") or [None])[0], _masks(o)
    if cmd == "edges":
        vs = (o.get("vs") or [None])[0]
        r = edges(pos[0], pos[1:], box, vs, d, "xy" in o, paint=paint)
        if r["key"]:
            print(f"{vs} (key, box {box}): {_fmt(r['key'])}")
        for f, m in r["frames"].items():
            dd = r["diff"].get(f)
            print(f"{f}{f' (box {shift_box(box, d)})' if d and box else ''}: {_fmt(m)}"
                  + (" | vs " + " ".join(f"{k.replace('_', ' ')} {v:+d}" for k, v in dd.items()) if dd else ""))
            for k in METRICS if "xy" in o else ():
                print(f"  {k}: {json.dumps(m[k + '_xy'])}")
    elif cmd == "match":
        n = match(pos[0], pos[1], pos[2], box, FM._box(o.get("to")), [FM._rgb(v) for v in o["rgb"]], paint=paint)
        print(f"{pos[1]} {box} vs {pos[2]} {FM._box(o.get('to'))}: {n} differing px")
    elif cmd == "poly":
        for f, n in poly(pos[0], pos[1:], pspec, nm, masks, paint=paint).items():
            print(f"{f}: {n} opaque px in {pspec}" + (f" minus {' '.join(nm)}" if nm else ""))
    elif cmd == "switch":
        rig = yaml.safe_load(Path(o["rig"][0]).read_text()) if o.get("rig") else None
        r = switch(FM.Sprite(pos[0], rig) if rig else pos[0], pos[1])
        if not r["rig"]:
            print(f"{pos[0]} {pos[1]} (no rig, best key-switch translation): need {r['need']:.3f} cap {r['cap']:.1f} "
                  + (f"d {r['d']} IoU {r['iou']:.3f} shifts {r['shifts']}" if r["d"] else "no translation within the cap"))
        for p in r["pairs"]:
            print(f"  {p['pair']}: IoU {p['iou']:.3f} / step {p['step']:.1f} vs need {p['need']:.3f} / cap {p['cap']:.1f}"
                  f" {'ok' if p['ok'] else 'FAIL'}")
    elif cmd == "rowspan":
        rows = (int(o["rows"][0]), int(o["rows"][1]))
        for f, e in rowspan(pos[0], pos[1:], rows, paint=paint).items():
            print(f"{f}: rows {rows[0]}-{rows[1] - 1} " + (f"x {e[0]}-{e[1]}" if e else "empty"))
    elif cmd == "sweep":
        t = time.time()
        r = sweep(int(o["top"][0]) if o.get("top") else 20)
        print(f"{r['sprites']} of {r['rigs']} locked rigs have a frame with edge gaps; {len(r['keys'])} approved keys "
              f"have some ({', '.join(f'{s} {n} {g}' for g, s, n in r['keys'][:4])} ...)")
        for g, s, n in r["inbetweens"]:
            print(f"  {s} {n}: {g}")
        print(f"sweep {time.time() - t:.0f} s")
    elif cmd == "colours":
        s = FM.Sprite(pos[0], paint=paint)
        rgbs, vs = [FM._rgb(v) for v in o["rgb"]], (o.get("vs") or [None])[0]
        if vs:
            k = colours(s, [vs], rgbs, box, None, pspec, nm, masks)[vs]
            print(f"{vs} (key): {k['n']} " + " ".join(f"{list(c)}={n}" for c, n in k["each"].items()))
        for f, r in colours(s, pos[1:], rgbs, box, d, pspec, nm, masks).items():
            print(f"{f}: {r['n']} " + " ".join(f"{list(c)}={n}" for c, n in r["each"].items())
                  + (f" | vs {r['n'] - k['n']:+d}" if vs else ""))
    elif cmd == "select":
        _select(pos, o, box, d, pspec, nm, masks, paint)
    return 0


def _select(pos, o, box, d, pspec, nm, masks, paint) -> None:
    from gen import fixmeasure_px as PX
    s = FM.Sprite(pos[0], paint=paint)
    a = s.img(pos[1])
    within = region(s, pos[1], box, pspec, nm, masks, d)
    if o.get("vs"):
        k = _shift(s.img(o["vs"][0]), d or (0, 0))
        within &= (a != k).any(2)
    comp = tuple(int(v) for v in o["component"][0].split(",")) if o.get("component") else None
    to = o.get("to")
    num = int(o["holes"][0]) if o.get("holes") else None
    entries = PX.select(a, [FM._rgb(v) for v in o["rgb"]] if o.get("rgb") else None, None, comp, num,
                        mode=to is None, to=FM._rgb(to[0]) if to and to[0] != "null" else None, within=within)
    n = sum(len(e["xy"]) for e in entries)
    print(f"# {pos[0]} {pos[1]}: {n} px in {len(entries)} entr{'y' if len(entries) == 1 else 'ies'}")
    for e in entries:
        line = f"  - {{frame: {pos[1]}, rgb: {json.dumps(e['rgb'])}, xy: {json.dumps(e['xy'])}}}"
        print(f"# no candidate colour within 3 px (pick one by hand): {line.strip()}" if e.get("unassigned") else line)
