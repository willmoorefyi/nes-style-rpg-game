"""Per-class fixes of the hero kneel frames (docs/KNEEL_PLAN.md D-K4 / D-K18 additive options, K2-D), opt-in keys
of `kneel:` in anim/<class>.yaml. Without them nothing here runs, so every class without them is byte-identical.

- `labels: [{part: <puppet part>, box: [x0, y0, x1, y1]}, ...]` (native px on ready, inclusive): ready's opaque pixels
  in the box are cut with that part instead of their nearest bone, before the re-pose. A sash knot or a knee plate
  that straddles two parts then moves as one piece instead of breaking into fragments.
- `paint: [{frame: <kneel frame>, ...}, ...]`, applied after the re-pose (and before `reoutline`); `frame` defaults to
  `kneel`, whose paint `kneel_b` inherits through the breath bob. One of:
  - `xy: [[x, y], ...], rgb: [r, g, b] | null` - set pixels to a source-palette colour, or clear them;
  - `rect: [x0, y0, x1, y1], rgb: ..., only: [r, g, b]` - the same for a box (inclusive), with `only` just the box's
    pixels of that colour (a recolour);
  - `stamp: [x0, y0, x1, y1], to: [x, y], rot: 0 | 90 | 180 | 270, behind: bool` - copy ready's opaque pixels in
    the box (rotated by whole quarter turns, counter-clockwise, so no resampling) with its top-left at `to`;
    `behind` writes only onto transparent pixels;
  - `move: [x0, y0, x1, y1], by: [dx, dy], behind: bool` - move the frame's own opaque pixels in the box by whole px
    (e.g. a rear foot lowered onto the ground row).
  At most PAINT_CAP changed pixels per frame (the FW-P key-paint cap); colours must come from the class's approved
  sheet (or the puppet outline ink), else ValueError naming the class and frame.
"""
from __future__ import annotations

import numpy as np
from PIL import Image

from gen import puppet as PU

PAINT_CAP = 160
FRAMES = ("kneel_in1", "kneel_in2", "kneel", "kneel_b")


def relabel(labels: np.ndarray, ready: Image.Image, spec: list) -> np.ndarray:
    """`labels` (PU.segment of ready) with the `labels:` boxes re-assigned."""
    lab = labels.copy()
    solid = np.asarray(ready)[..., 3] > 0
    names = list(PU.PARTS)
    for e in spec or []:
        if e.get("part") not in names:
            raise ValueError(f"kneel labels: unknown part {e.get('part')!r}")
        x0, y0, x1, y1 = (int(v) for v in e["box"])
        m = np.zeros_like(solid)
        m[y0:y1 + 1, x0:x1 + 1] = True
        lab[m & solid] = names.index(e["part"])
    return lab


def _palette(frames: dict) -> set:
    pal = {tuple(int(v) for v in c) for f in frames.values() for c in np.asarray(f)[np.asarray(f)[..., 3] > 0][:, :3]}
    return pal | {tuple(PU.OUTLINE)}


def paint(img: Image.Image, frame: str, spec: list, frames: dict, who: str = "?") -> Image.Image:
    """`img` with the `paint:` entries of `frame` applied (see the module doc)."""
    ents = [e for e in spec or [] if e.get("frame", "kneel") == frame]
    if not ents:
        return img
    a = np.asarray(img).copy()
    before = a.copy()
    pal = _palette(frames)
    ready = np.asarray(frames["ready"])
    for e in ents:
        if e.get("frame", "kneel") not in FRAMES:
            raise ValueError(f"{who}: kneel paint frame {e.get('frame')!r} is not a kneel frame")
        if "move" in e:                                   # the frame's own pixels in a box, moved by whole px
            x0, y0, x1, y1 = (int(v) for v in e["move"])
            dx, dy = (int(v) for v in e["by"])
            blk = a[y0:y1 + 1, x0:x1 + 1].copy()
            a[y0:y1 + 1, x0:x1 + 1][blk[..., 3] > 0] = 0
            for (yy, xx) in zip(*np.nonzero(blk[..., 3] > 0)):
                ty, tx = y0 + yy + dy, x0 + xx + dx
                if 0 <= ty < a.shape[0] and 0 <= tx < a.shape[1] and not (e.get("behind") and a[ty, tx, 3] > 0):
                    a[ty, tx] = blk[yy, xx]
            continue
        if "stamp" in e:
            x0, y0, x1, y1 = (int(v) for v in e["stamp"])
            src = np.rot90(ready[y0:y1 + 1, x0:x1 + 1], int(e.get("rot", 0)) // 90 % 4)
            tx, ty = (int(v) for v in e["to"])
            h, w = src.shape[:2]
            dst = a[ty:ty + h, tx:tx + w]
            put = src[:dst.shape[0], :dst.shape[1], 3] > 0
            if e.get("behind"):
                put &= dst[..., 3] == 0
            dst[put] = src[:dst.shape[0], :dst.shape[1]][put]
            continue
        rgb = e.get("rgb")
        if rgb is not None and tuple(int(v) for v in rgb) not in pal:
            raise ValueError(f"{who}: kneel paint colour {rgb} ({frame}) is not in the approved palette")
        pts = [(int(x), int(y)) for x, y in e.get("xy", [])]
        if "rect" in e:
            x0, y0, x1, y1 = (int(v) for v in e["rect"])
            only = tuple(int(v) for v in e["only"]) if e.get("only") is not None else None
            pts += [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)
                    if only is None or (a[y, x, 3] > 0 and tuple(int(v) for v in a[y, x, :3]) == only)]
        for x, y in pts:
            a[y, x] = (0, 0, 0, 0) if rgb is None else (*(int(v) for v in rgb), 255)
    n = int((a != before).any(2).sum())
    if n > PAINT_CAP:
        raise ValueError(f"{who}: kneel paint changes {n} px in {frame} > the cap {PAINT_CAP}")
    return Image.fromarray(a, "RGBA")
