"""The cut of a user-rendered hero class sheet (gen/hero_user.py; pass CB, docs/CLASS_BARBARIAN_PLAN.md 3.2, and pass CL's
oversize cells, docs/CLASS_LANCE_PLAN.md 4). The recipe's geometry: `cell` (default 80 x 80), `foot_row` (76), `body_box`
(inclusive, default the whole cell), `palette` (`sheet`: one house palette for the sheet, the CB rule; `per_row`: one
per class row) and `prop` (pass CL: `kind: lance`, its lines, radius, head length and colours, gen/hero_user_lance.py).
Without the CL keys the cut is pass CB's, byte for byte. Fail closed: every refusal is a SystemExit naming the rule.
"""
from __future__ import annotations

import numpy as np
from PIL import Image

from gen import hero_user_lance as HL
from gen import pixelize as PX

CELL, FOOT, COLOURS = 80, 76, 16
COLUMNS = ("ready", "attack", "cast", "hurt", "down", "victory", "kneel")


def geometry(rec: dict) -> dict:
    """{cw, ch, foot, body (x0, y0, x1, y1 inclusive), palette, prop} of a recipe, validated."""
    cw, ch = (int(v) for v in rec.get("cell", (CELL, CELL)))
    foot = int(rec.get("foot_row", FOOT))
    body = tuple(int(v) for v in rec.get("body_box", (0, 0, cw - 1, ch - 1)))
    mode = rec.get("palette", "sheet")
    if mode not in ("sheet", "per_row"):
        raise SystemExit(f"palette must be sheet or per_row, not {mode!r}")
    x0, y0, x1, y1 = body
    if (cw, ch) != (CELL, CELL):
        if (x1 - x0 + 1, y1 - y0 + 1) != (CELL, CELL):
            raise SystemExit(f"body_box {list(body)} must be {CELL} x {CELL} (the body is drawn at every class's size)")
        if foot - y0 != FOOT:
            raise SystemExit(f"foot_row {foot} must sit {FOOT} rows below the body box top {y0} (as in an 80 cell)")
    if not (0 <= x0 <= x1 < cw and 0 <= y0 <= y1 < ch and y0 <= foot <= y1):
        raise SystemExit(f"body_box {list(body)} / foot_row {foot} do not fit the {cw} x {ch} cell")
    prop = rec.get("prop")
    if prop is not None and prop.get("kind") != "lance":
        raise SystemExit(f"prop kind {prop.get('kind')!r}: only lance exists")
    return {"cw": cw, "ch": ch, "foot": foot, "body": body, "palette": mode, "prop": prop}


def body_xywh(g: dict) -> list[int]:
    x0, y0, x1, y1 = g["body"]
    return [x0, y0, x1 - x0 + 1, y1 - y0 + 1]


def cells_apart(m: np.ndarray, ncols: int, nrows: int, cw: int = CELL, ch: int = CELL) -> list[str]:
    """Every pair of 8-adjacent opaque px on either side of a cell border (a piece crossing it)."""
    bad = []
    for c in range(1, ncols):
        x = c * cw
        left, right = m[:, x - 1], m[:, x]
        near = right.copy()
        near[1:] |= right[:-1]
        near[:-1] |= right[1:]
        if (left & near).any():
            bad.append(f"a figure crosses the border of columns {c - 1} / {c}")
    for r in range(1, nrows):
        y = r * ch
        top, bot = m[y - 1], m[y]
        near = bot.copy()
        near[1:] |= bot[:-1]
        near[:-1] |= bot[1:]
        if (top & near).any():
            bad.append(f"a figure crosses the border of rows {r - 1} / {r}")
    return bad


def palette(a: np.ndarray, who: str = "user sheet") -> dict[tuple, tuple]:
    """The house mapping {source rgb: 15-bit rgb}: <= 16 colours, PX.snap15, the darkest PX.OUTLINE, one-to-one."""
    uniq = [tuple(int(v) for v in c) for c in np.unique(a[a[..., 3] > 0][:, :3], axis=0)]
    if len(uniq) > COLOURS:
        raise SystemExit(f"{who}: {len(uniq)} colours, at most {COLOURS} (no colour is invented by a k-means)")
    snapped = PX.snap15(np.array(uniq, np.float32)).astype(int)
    dark = int(np.array(uniq).sum(1).argmin())
    out = {c: tuple(int(v) for v in s) for c, s in zip(uniq, snapped)}
    out[uniq[dark]] = tuple(PX.OUTLINE)
    if len(set(out.values())) != len(out):
        raise SystemExit(f"{who}: two colours snap to the same 15-bit colour (the mapping must be one-to-one)")
    return out


def _lance(g: dict, cid: str, pose: str, src: np.ndarray) -> np.ndarray | None:
    """The lance mask of one cell (source colours), checked; None without a prop."""
    p = g["prop"]
    if not p:
        return None
    line = ((p.get("lines") or {}).get(cid) or {}).get(pose)
    if not line:
        raise SystemExit(f"user sheet: {cid} {pose} has no lance line in the recipe")
    m = HL.mask(src, line, (p.get("colours") or {}).get(cid) or [], p["radius"], HL.head_len(p, cid),
               (p.get("shaft_colours") or {}).get(cid))
    bad = HL.problems(src, m, line, pose)
    if bad:
        raise SystemExit(f"user sheet: {cid} {pose} lance: " + "; ".join(bad))
    return m


def cut(rec: dict, a: np.ndarray) -> tuple[dict[str, dict[str, Image.Image]], dict]:
    """{class: {pose: cell}} for every row of the recipe (the seven columns), and the import measures."""
    g = geometry(rec)
    cw, ch, rows = g["cw"], g["ch"], rec["rows"]
    if a.shape[:2] != (len(rows) * ch, len(COLUMNS) * cw):
        raise SystemExit(f"user sheet: {a.shape[1]}x{a.shape[0]}, need {len(COLUMNS) * cw}x{len(rows) * ch} "
                         f"({len(COLUMNS)} x {len(rows)} cells of {cw} x {ch})")
    al = a[..., 3]
    if ((al > 0) & (al < 255)).any():
        raise SystemExit("user sheet: semi-transparent pixels (binary alpha needed)")
    m = al > 0
    bad = cells_apart(m, len(COLUMNS), len(rows), cw, ch)
    if bad:
        raise SystemExit("user sheet: " + "; ".join(bad))
    pals = {cid: palette(a[r * ch:(r + 1) * ch], f"user sheet row {cid}") for r, cid in enumerate(rows)} \
        if g["palette"] == "per_row" else dict.fromkeys(rows, palette(a))
    out = a.copy()
    for r, cid in enumerate(rows):
        band, mb = a[r * ch:(r + 1) * ch], m[r * ch:(r + 1) * ch]
        for src, dst in pals[cid].items():
            out[r * ch:(r + 1) * ch][(band[..., :3] == src).all(-1) & mb, :3] = dst
    allow = rec.get("allow_outside") or {}
    x0, y0, x1, y1 = g["body"]
    cells: dict[str, dict[str, Image.Image]] = {}
    boxes, lance_px = {}, {}
    for r, cid in enumerate(rows):
        cells[cid] = {}
        for c, pose in enumerate(COLUMNS):
            sl = (slice(r * ch, (r + 1) * ch), slice(c * cw, (c + 1) * cw))
            cell, src = out[sl], a[sl]
            lance = _lance(g, cid, pose, src)
            body = (cell[..., 3] > 0) & (~lance if lance is not None else True)
            ys, xs = np.where(cell[..., 3] > 0)
            if not len(ys):
                raise SystemExit(f"user sheet: {cid} {pose} is empty")
            by = np.where(body.any(1))[0]
            if not len(by) or by.max() != g["foot"]:
                raise SystemExit(f"user sheet: {cid} {pose} feet on row {by.max() if len(by) else None}, "
                                 f"need {g['foot']}")
            outside = body.copy()
            outside[y0:y1 + 1, x0:x1 + 1] = False
            ok = allow.get(f"{cid}/{pose}")
            if ok:
                bx0, by0, bx1, by1 = ok["box"]
                inbox = np.zeros_like(outside)
                inbox[by0:by1 + 1, bx0:bx1 + 1] = True
                if int((outside & inbox).sum()) != int(ok["px"]):
                    raise SystemExit(f"user sheet: {cid} {pose} allow_outside counts {int((outside & inbox).sum())} "
                                     f"px, the recipe says {ok['px']}")
                outside &= ~inbox
            if outside.any():
                oy, ox = np.nonzero(outside)
                raise SystemExit(f"user sheet: {cid} {pose}: {int(outside.sum())} body (non-lance) px outside the body "
                                 f"box, first ({int(ox[0])}, {int(oy[0])})")
            cells[cid][pose] = Image.fromarray(np.ascontiguousarray(cell))
            boxes[f"{cid}/{pose}"] = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
            if lance is not None:
                lance_px[f"{cid}/{pose}"] = int(lance.sum())
    info = {"source_size": [int(a.shape[1]), int(a.shape[0])],
            "colours": len(pals[rows[0]]) if g["palette"] == "sheet" else {c: len(p) for c, p in pals.items()},
            "palette": [[list(s), list(d)] for s, d in sorted(pals[rows[0]].items())],
            "palettes": {c: [[list(s), list(d)] for s, d in sorted(p.items())] for c, p in pals.items()},
            "boxes": boxes, "lance_px": lance_px, "geometry": g}
    return cells, info
