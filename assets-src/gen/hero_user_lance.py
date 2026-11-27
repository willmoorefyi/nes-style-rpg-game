"""Pass CL (docs/CLASS_LANCE_PLAN.md 4.2, 5.2): the lance of an oversize hero sheet, found from its hand-marked line.

A cell's lance is every opaque pixel near the line tip -> butt (within `radius.shaft`, or `radius.head` over the
`head_len` px nearest the tip) whose colour is one of the row's lance colours; the lance outline colour (the darkest
lance colour) counts only within 1.0 px of the line on the shaft (so a hand's or a leg's outline beside the shaft stays
the body's). Shared by the importer (hero_user_grid.py: the checks), the puppet (puppet_lance.py: body / lance split)
and the build (the heads of battle_atlas). Pure numpy.
"""
from __future__ import annotations

import math

import numpy as np

KEY_FULL = ("attack", "cast", "down", "victory")    # poses whose whole lance is in view (no hand or body hides an end)
LEN_MIN, LEN_MAX, LEN_FULL = 80.0, 152.0, 128.0      # the spec's "about 140 px" (4.2): visible length bounds
SHAFT_STRAIGHT = 1.5  # a level / upright shaft's reach (its ink rows at 1.0; the body's own row below at 2.0 stays body)


def seg(line) -> tuple[np.ndarray, np.ndarray, float]:
    """(tip, unit direction tip -> butt, length) of a [[tx, ty], [bx, by]] line."""
    tip, butt = np.asarray(line[0], float), np.asarray(line[1], float)
    v = butt - tip
    n = float(np.hypot(*v))
    return tip, v / max(n, 1e-9), n


def angle(line) -> float:
    """The lance's angle in degrees, the tip's side up-left positive: atan2(-dy, -dx) of tip - butt mirrored, i.e. 0 for
    a level lance pointing left, 45 for up-left, 90 straight up, -90 straight down."""
    tip, butt = np.asarray(line[0], float), np.asarray(line[1], float)
    d = tip - butt
    return math.degrees(math.atan2(-d[1], -d[0]))


def _dist(h: int, w: int, line) -> tuple[np.ndarray, np.ndarray]:
    """Per pixel: (distance to the segment, arc position from the tip, unclipped)."""
    tip, u, n = seg(line)
    gy, gx = np.mgrid[0:h, 0:w]
    px = np.stack([gx, gy], -1).astype(float) - tip
    t = px @ u
    tc = np.clip(t, 0, n)
    near = tip + tc[..., None] * u
    d = np.hypot(gx - near[..., 0], gy - near[..., 1])
    return d, t


def mask(cell: np.ndarray, line, colours, radius: dict, head_len: float, shaft_colours=None) -> np.ndarray:
    """bool[h, w]: the lance pixels of an RGBA cell along `line`: `colours` on the head, `shaft_colours` (default the
    same) on the shaft, so a steel or shirt colour beside the shaft stays the body's."""
    h, w = cell.shape[:2]
    d, t = _dist(h, w, line)
    _, _, n = seg(line)
    cols = [tuple(int(v) for v in c) for c in colours]
    outline = min(cols, key=sum)
    rgb = cell[..., :3].astype(int)
    opaque = cell[..., 3] > 0
    head = t <= head_len

    def any_of(cs) -> np.ndarray:
        out = np.zeros((h, w), bool)
        for c in cs:
            out |= (rgb == tuple(int(v) for v in c)).all(-1)
        return out
    is_col = np.where(head, any_of(cols), any_of(shaft_colours if shaft_colours is not None else cols))
    is_out = (rgb == outline).all(-1)
    rs = shaft_radius(line, float(radius["shaft"]))
    r = np.where(head, float(radius["head"]), rs)
    inside = (t >= -1.0) & (t <= n + 1.0) & (d <= r)
    keep = opaque & inside & is_col & (~is_out | head | (d <= rs))
    return keep


def shaft_radius(line, diag: float) -> float:
    """The shaft's reach from its line: SHAFT_STRAIGHT for a level or upright lance (a 3 px band: ink, wood, ink),
    rising to `diag` at 45 deg (a stepped diagonal's ink sits up to about 1.8 px off the line)."""
    a = math.radians(angle(line))
    return SHAFT_STRAIGHT + (diag - SHAFT_STRAIGHT) * abs(math.sin(2 * a))


def head_len(prop: dict, cid: str) -> float:
    """The recipe's `head_len`: one number, or {class: number}."""
    h = prop["head_len"]
    return float(h[cid] if isinstance(h, dict) else h)


def unbroken(cell: np.ndarray, line, step: float = 0.5) -> list[tuple[int, int]]:
    """The points of the line (tip to butt) that fall on a transparent pixel: the lance is drawn unbroken when every
    point is opaque (a hand or the body may cover it). Empty list = unbroken."""
    tip, u, n = seg(line)
    h, w = cell.shape[:2]
    gaps = []
    for s in np.arange(1.0, n - 1.0 + 1e-9, step):       # the ends themselves may round off the art
        x, y = (int(round(v)) for v in tip + s * u)
        if 0 <= x < w and 0 <= y < h and cell[y, x, 3] == 0:
            gaps.append((x, y))
    return sorted(set(gaps))


def problems(cell: np.ndarray, m: np.ndarray, line, pose: str, kind: str = "lance") -> list[str]:
    """The import checks of one cell's lance (4.2 item 4); [] when it holds."""
    out = []
    tip, u, n = seg(line)
    ys, xs = np.nonzero(m)
    if not len(ys):
        return ["no lance pixel on the line"]
    pts = np.stack([xs, ys], 1).astype(float)
    if np.hypot(*(pts - tip).T).min() > 1.5:
        out.append(f"the tip {tip.round(1).tolist()} is not within 1.5 px of a lance pixel")
    bx, by = (int(round(v)) for v in tip + n * u)       # the butt: the visible end, a lance px or the fist over it
    if not (0 <= bx < cell.shape[1] and 0 <= by < cell.shape[0]) or cell[by, bx, 3] == 0:
        out.append(f"the butt ({bx}, {by}) is not on an opaque pixel")
    gaps = unbroken(cell, line)
    if gaps:
        out.append(f"the line crosses {len(gaps)} transparent px (first {gaps[0]}): the lance is broken")
    if kind == "lance" and not LEN_MIN <= n <= LEN_MAX:          # the length rule is the lance's (a blade: none)
        out.append(f"length {n:.1f} outside [{LEN_MIN}, {LEN_MAX}]")
    if kind == "lance" and pose in KEY_FULL and n < LEN_FULL:
        out.append(f"{pose}: the whole lance is in view, length {n:.1f} < {LEN_FULL}")
    major = max(abs(u[0]), abs(u[1])) * n
    if m.sum() < 0.9 * major:
        out.append(f"only {int(m.sum())} lance px for a {major:.0f} px line")
    return out


def fill_footprint(body: np.ndarray, m: np.ndarray, line, reach: int = 2) -> tuple[np.ndarray, int]:
    """The body with the lance removed (5.2.1): a lance pixel whose nearest non-lance opaque pixels on both sides along
    the shaft's perpendicular are within `reach` px takes the nearer one's colour; every other lance pixel becomes
    transparent. Returns (RGBA image, filled count)."""
    out = body.copy()
    out[m] = 0
    _, u, _ = seg(line)
    pn = np.array([-u[1], u[0]])
    h, w = m.shape
    src = (body[..., 3] > 0) & ~m
    filled = 0
    for y, x in zip(*np.nonzero(m)):
        found = []
        for sgn in (1, -1):
            hit = None
            for k in range(1, reach + 1):
                xx, yy = int(round(x + sgn * k * pn[0])), int(round(y + sgn * k * pn[1]))
                if 0 <= xx < w and 0 <= yy < h and src[yy, xx]:
                    hit = (k, yy, xx)
                    break
            found.append(hit)
        if found[0] and found[1]:
            k, yy, xx = min(found)
            out[y, x] = body[yy, xx]
            filled += 1
    # review round 2: what is left inside the silhouette (a shin or a hand the shaft crossed at a slant) is grown in
    # from the body: a hole px with >= 3 opaque 4-neighbours (or two opposite ones) takes their most common colour,
    # pass after pass; the
    # footprint outside the silhouette (fewer neighbours) stays transparent
    hole = m & (out[..., 3] == 0)
    for _ in range(8):
        op = out[..., 3] > 0
        changed = False
        for y, x in zip(*np.nonzero(hole)):
            on = {(dy, dx) for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))
                  if 0 <= y + dy < h and 0 <= x + dx < w and op[y + dy, x + dx]}
            nb = [(y + dy, x + dx) for dy, dx in on]
            if len(nb) >= 3 or {(-1, 0), (1, 0)} <= on or {(0, -1), (0, 1)} <= on:   # inside: body on two opposite sides
                cols = [tuple(int(v) for v in out[p]) for p in nb]
                out[y, x] = max(set(cols), key=lambda c: (cols.count(c), c))
                hole[y, x] = False
                filled += 1
                changed = True
        if not changed:
            break
    # a hole the body encloses (a fist the shaft ran through) is filled in whatever its shape
    from gen.pixelize import components
    comps, n = components(out[..., 3] == 0)
    edge = set(np.unique(np.concatenate([comps[0], comps[-1], comps[:, 0], comps[:, -1]]))) - {0}
    enclosed = (comps > 0) & ~np.isin(comps, list(edge)) & m
    for _ in range(12):
        if not enclosed.any():
            break
        op = out[..., 3] > 0
        for y, x in zip(*np.nonzero(enclosed)):
            nb = [out[y + dy, x + dx] for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))
                  if 0 <= y + dy < h and 0 <= x + dx < w and op[y + dy, x + dx]]
            if nb:
                cols = [tuple(int(v) for v in c) for c in nb]
                out[y, x] = max(set(cols), key=lambda c: (cols.count(c), c))
                enclosed[y, x] = False
                filled += 1
    return out, filled


def head_of(img: np.ndarray, lance: np.ndarray | None) -> tuple[float, int] | None:
    """The body's head as texturePixels.headOf finds it (the topmost opaque row, x the middle of its run), with the
    lance pixels left out: (x, y) in cell px, or None for an empty frame."""
    a = img[..., 3] > 0
    if lance is not None:
        a = a & ~lance
    rows = np.nonzero(a.any(1))[0]
    if not len(rows):
        return None
    y = int(rows[0])
    xs = np.nonzero(a[y])[0]
    return (float(xs.min() + xs.max() + 1) / 2, y)


def review_sheet(src, rec: dict, g: dict, k: int = 4):
    """Every cell at x k: the lance mask in magenta, the body box outlined, the tip (green) and the butt (red)."""
    from PIL import Image, ImageDraw
    cw, ch, rows = g["cw"], g["ch"], rec["rows"]
    p = g["prop"]
    poses = ("ready", "attack", "cast", "hurt", "down", "victory", "kneel")
    out = Image.new("RGBA", (len(poses) * cw * k, len(rows) * ch * k), (60, 60, 70, 255))
    d = ImageDraw.Draw(out)
    for r, cid in enumerate(rows):
        for c, pose in enumerate(poses):
            cell = src[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw].copy()
            line = (p["lines"].get(cid) or {}).get(pose)          # pass CD-K: optional per pose
            m = mask(cell, line, p["colours"][cid], p["radius"], head_len(p, cid), (p.get("shaft_colours") or {}).get(cid)) \
                if line else np.zeros(cell.shape[:2], bool)
            cell[m, :3] = (255, 0, 255)
            ox, oy = c * cw * k, r * ch * k
            out.alpha_composite(Image.fromarray(cell).resize((cw * k, ch * k), Image.Resampling.NEAREST), (ox, oy))
            x0, y0, x1, y1 = g["body"]
            d.rectangle([ox + x0 * k, oy + y0 * k, ox + (x1 + 1) * k - 1, oy + (y1 + 1) * k - 1], outline=(255, 255, 0))
            for (x, y), col in zip(line or [], ((0, 255, 0), (255, 0, 0))):
                d.ellipse([ox + x * k - 4, oy + y * k - 4, ox + x * k + 4, oy + y * k + 4], outline=col, width=2)
    return out
