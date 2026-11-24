"""int-ef2 (docs/ENEMY_FEEDBACK_PLAN.md, user ruling 2026-11-24): `crop: true` in gen/monster_scale.yaml, for a hi-res
sheet whose full cells do not fit one 2048 page (iron_golem at 3.3: 17 frames of 423 px, 16 a page). Every frame is cut
to the sheet's union opaque box over all its frames plus a 1-px transparent margin (the gutter ring), the cell's bottom
rows kept (the feet keep their distance to the cell bottom). Only empty px go; the atlas measures every anchor on the
cut frames, and `footRow` moves up by the rows cut. Runs after despur, before the upscale; no approved PNG, rig or
lock changes."""
from __future__ import annotations

import numpy as np
from PIL import Image


def crop_box(frames: dict[str, Image.Image]) -> tuple[int, int, int]:
    """(left, top, right) of the cut cell: the union opaque box of every frame plus a 1-px margin, inside the cell."""
    w, h = frames["idle"].size
    op = np.zeros((h, w), bool)
    for f in frames.values():
        op |= np.asarray(f.convert("RGBA"))[..., 3] > 0
    ys, xs = np.nonzero(op)
    if not len(xs):
        raise SystemExit("monsters_ai: crop: the sheet has no opaque px")
    return max(int(xs.min()) - 1, 0), max(int(ys.min()) - 1, 0), min(int(xs.max()) + 2, w)


def crop_sheet(sid: str, frames: dict[str, Image.Image]) -> tuple[dict[str, Image.Image], tuple[int, int]]:
    """({name: cut frame}, (dx, dy) the px cut on the left and top); SystemExit when a frame loses an opaque px."""
    l, t, r = crop_box(frames)
    h = frames["idle"].size[1]
    out = {}
    for name in sorted(frames):
        f = frames[name].convert("RGBA")
        if f.size != frames["idle"].size:
            raise SystemExit(f"monsters_ai: crop {sid} {name}: frame size {f.size} != the idle's")
        out[name] = f.crop((l, t, r, h))
        if int((np.asarray(out[name])[..., 3] > 0).sum()) != int((np.asarray(f)[..., 3] > 0).sum()):
            raise SystemExit(f"monsters_ai: crop {sid} {name}: the cut drops opaque px")
    return out, (l, t)


def apply(scales: dict[str, dict], sprites: dict) -> dict[str, tuple[int, int]]:
    """Cut every `crop: true` sheet of `sprites` ({id: (meta, frames, holds, anim, lunge)}) in place, its meta's
    `bottom_row` moved up by the rows cut: {id: (dx, dy)}. A floating sheet is refused (kneelSink reads its height)."""
    crops = {}
    for sid in sorted(s for s, e in scales.items() if e.get("crop")):
        meta, frames, holds, anim, lunge = sprites[sid]
        if meta.get("floating"):
            raise SystemExit(f"monsters_ai: crop {sid}: a floating sheet keeps its cell (kneelSink reads its height)")
        frames, crops[sid] = crop_sheet(sid, frames)
        sprites[sid] = ({**meta, "bottom_row": meta["bottom_row"] - crops[sid][1]}, frames, holds, anim, lunge)
        print(f"monsters_ai: crop {sid}: cell cut to {list(frames['idle'].size)} ({crops[sid][0]} px off the left, "
              f"{crops[sid][1]} off the top)")
    return crops
