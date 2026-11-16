"""Pure pixel primitives of fixmeasure.py (docs/ROSTER_FIX_PLAN.md 3, FW-M) on RGBA arrays (H x W x 4, uint8): fill
components (outline ink left out), pieces, enclosed holes, colour counts, and the `select` helper that turns
selectors into rig `paint` entries. Boxes are X0 Y0 X1 Y1 with X1 and Y1 exclusive; reported boxes are inclusive."""
from __future__ import annotations

from collections import Counter

import numpy as np

from gen.pixelize import components

INK = (6, 4, 10)
Box = tuple[int, int, int, int]


def _in_box(shape, box: Box | None) -> np.ndarray:
    m = np.zeros(shape[:2], bool)
    if box is None:
        m[...] = True
    else:
        x0, y0, x1, y1 = box
        m[max(0, y0):max(0, y1), max(0, x0):max(0, x1)] = True
    return m


def _comps(mask: np.ndarray, offset=(0, 0)) -> list[dict]:
    lab, n = components(mask)
    out = []
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        out.append({"size": int(len(xs)), "box": (int(xs.min()) + offset[0], int(ys.min()) + offset[1],
                                                  int(xs.max()) + offset[0], int(ys.max()) + offset[1]),
                    "at": (int(xs[0]) + offset[0], int(ys[0]) + offset[1]), "_px": (ys + offset[1], xs + offset[0])})
    return sorted(out, key=lambda c: (-c["size"], c["box"]))


def _public(cs: list[dict]) -> list[dict]:
    return [{k: v for k, v in c.items() if not k.startswith("_")} for c in cs]


def _rgb_mask(a: np.ndarray, rgbs) -> np.ndarray:
    m = np.zeros(a.shape[:2], bool)
    for c in rgbs or []:
        m |= (a[..., :3] == tuple(c)).all(2)
    return m & (a[..., 3] > 0)


def fill_mask(a: np.ndarray) -> np.ndarray:
    return (a[..., 3] > 0) & ~(a[..., :3] == INK).all(2)


def fill_components(a: np.ndarray, box: Box | None = None, keep_px: bool = False) -> list[dict]:
    """Fill components (ink excluded) of the frame cropped to `box`, largest first."""
    x0, y0 = (box[0], box[1]) if box else (0, 0)
    sub = a if box is None else a[max(0, box[1]):max(0, box[3]), max(0, box[0]):max(0, box[2])]
    cs = _comps(fill_mask(sub), (max(0, x0), max(0, y0)))
    return cs if keep_px else _public(cs)


def pieces_of(a: np.ndarray, box: Box | None = None) -> list[dict]:
    """Pieces (all opaque pixels, 4-connected) of the frame cropped to `box`, largest first."""
    x0, y0 = (max(0, box[0]), max(0, box[1])) if box else (0, 0)
    sub = a if box is None else a[y0:max(0, box[3]), x0:max(0, box[2])]
    return _public(_comps(sub[..., 3] > 0, (x0, y0)))


def holes(a: np.ndarray, box: Box | None = None, min_px: int = 1, keep_px: bool = False) -> list[dict]:
    """Enclosed transparent pieces of the whole frame (>= min_px), kept when any pixel lies in `box`."""
    cs = _comps(a[..., 3] == 0)
    h, w = a.shape[:2]
    inbox = _in_box(a.shape, box)
    out = []
    for c in cs:
        ys, xs = c["_px"]
        if ys.min() == 0 or xs.min() == 0 or ys.max() == h - 1 or xs.max() == w - 1 or c["size"] < min_px:
            continue
        if inbox[ys, xs].any():
            out.append(c)
    return out if keep_px else _public(out)


def colour_count(a: np.ndarray, rgbs, box: Box | None = None) -> int:
    return int((_rgb_mask(a, rgbs) & _in_box(a.shape, box)).sum())


def _mode_fill(a: np.ndarray, sel: np.ndarray) -> dict[tuple[int, int], tuple[int, int, int]]:
    """Each selected pixel's 4-neighbour mode colour among opaque, non-ink, unselected neighbours (ties: the lowest
    RGB); a pixel with none (an ink-ringed hole) takes the mode of the nearest square ring (r 1-3) that has some.
    Grown inward until every pixel has one, so a hole's inner pixels take their filled neighbours' colours."""
    col = {(int(x), int(y)): tuple(int(v) for v in a[y, x, :3]) for y, x in zip(*np.nonzero(fill_mask(a) & ~sel))}
    todo = sorted((int(x), int(y)) for y, x in zip(*np.nonzero(sel)))
    out: dict[tuple[int, int], tuple[int, int, int]] = {}

    def ring(x: int, y: int, r: int) -> list[tuple[int, int]]:
        if r == 0:
            return [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]
        return [(x + dx, y + dy) for dy in range(-r, r + 1) for dx in range(-r, r + 1) if max(abs(dx), abs(dy)) == r]
    while todo:
        got = {}
        for x, y in todo:
            for r in range(4):
                n = Counter(col[q] for q in ring(x, y, r) if q in col)
                if n:
                    best = max(n.values())
                    got[(x, y)] = min(c for c, k in n.items() if k == best)
                    break
        if not got:
            break
        out.update(got)
        col.update(got)
        todo = [p for p in todo if p not in got]
    return out


def select(a: np.ndarray, rgb=None, box: Box | None = None, component: tuple[int, int] | None = None,
           holes_min: int | None = None, mode: bool = True, to=None, within: np.ndarray | None = None) -> list[dict]:
    """Selected pixels as rig `paint` entries [{rgb, xy}] (no `frame`): by colour (`rgb`), the fill component holding
    pixel `component`, or the enclosed holes >= holes_min, each limited to `box`. With `to` every pixel gets that colour
    (None with mode=False: null = transparent); with `mode` each gets its 4-neighbour mode colour. `within` (FW-M2)
    limits the selection to a region mask."""
    sel = _in_box(a.shape, box) & (within if within is not None else True)
    if rgb:
        sel &= _rgb_mask(a, rgb)
    if component is not None:
        x, y = component
        lab, _ = components(fill_mask(a))
        sel &= (lab == lab[y, x]) & (lab[y, x] > 0)
    if holes_min is not None:
        hm = np.zeros(a.shape[:2], bool)
        for c in holes(a, box, holes_min, keep_px=True):
            hm[c["_px"]] = True
        sel &= hm
    if not mode or to is not None:
        xy = [[int(x), int(y)] for y, x in zip(*np.nonzero(sel))]
        return [{"rgb": list(to) if to is not None else None, "xy": xy}] if xy else []
    groups: dict[tuple[int, int, int], list[list[int]]] = {}
    got = _mode_fill(a, sel)
    for (x, y), c in sorted(got.items(), key=lambda t: (t[0][1], t[0][0])):
        groups.setdefault(c, []).append([x, y])
    left = [[int(x), int(y)] for y, x in zip(*np.nonzero(sel)) if (int(x), int(y)) not in got]
    return [{"rgb": list(c), "xy": xy} for c, xy in sorted(groups.items())] + \
        ([{"rgb": None, "xy": left, "unassigned": True}] if left else [])
