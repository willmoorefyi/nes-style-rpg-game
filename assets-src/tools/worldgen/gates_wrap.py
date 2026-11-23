"""WR (docs/WORLD_WRAP_PLAN.md 6.1, D-WR-2, D-WR-8): the world's wrap checks on the composed ground.

`wrap_check` is gated: (i) every edge cell is Water; (ii) no non-Water cell lies within SEAM_MARGIN cells of an edge;
(iii) the components on foot, on foot plus canoe and by ship, with the patches all off and all on, are the same with
and without the seam neighbours. A seam step joins (0, y) to (W - 1, y) and (x, 0) to (x, H - 1); the labelling with
the wrap equals the flat one exactly when no such pair joins two flat components, which is what is tested.

`seam_report` is report-only (Q4 (b): a sea cell keeps its zone): the seam stretches whose two ship zones are of
different `SEA_CLASS`es, with their lengths, and `UNCLASSED <id>` for a ship zone missing from the table.
"""
from __future__ import annotations

import numpy as np

from .geom import components
from .gates import canoe, walk, with_patches

WATER = "o"


def _edge_cells(h: int, w: int, depth: int) -> np.ndarray:
    m = np.zeros((h, w), bool)
    m[:depth, :] = m[-depth:, :] = True
    m[:, :depth] = m[:, -depth:] = True
    return m


def seam_joins(mask: np.ndarray) -> list[tuple[int, int, int, int]]:
    """The seam pairs (x0, y0, x1, y1) of `mask` whose flat components differ (each first pair of two labels)."""
    lab, _ = components(mask)
    h, w = mask.shape
    out, seen = [], set()
    pairs = [((0, y), (w - 1, y)) for y in range(h)] + [((x, 0), (x, h - 1)) for x in range(w)]
    for (ax, ay), (bx, by) in pairs:
        a, b = int(lab[ay, ax]), int(lab[by, bx])
        if a and b and a != b and (min(a, b), max(a, b)) not in seen:
            seen.add((min(a, b), max(a, b)))
            out.append((ax, ay, bx, by))
    return out


def wrap_check(g: np.ndarray, meta: dict, margin: int) -> dict:
    """The gated `wrap` line: the edges and the margin are Water, and the seam joins no component."""
    h, w = g.shape
    why = []
    edge = _edge_cells(h, w, 1) & (g != WATER)
    if edge.any():
        y, x = map(int, np.argwhere(edge)[0])
        why.append(f"wrap: {int(edge.sum())} edge cells are not Water, first ({x}, {y}) {str(g[y, x])!r}")
    near = _edge_cells(h, w, margin) & (g != WATER) & ~edge
    if near.any():
        y, x = map(int, np.argwhere(near)[0])
        why.append(f"wrap: {int(near.sum())} non-Water cells within SEAM_MARGIN {margin} of an edge, first ({x}, {y}) "
                   f"{str(g[y, x])!r}")
    least = _least_margin(g)
    joins = 0
    for state, on in (("off", False), ("on", True)):
        hh = with_patches(g, meta, bridge=on, canal=on) if meta else g
        for layer, mask in (("walk", walk(hh)), ("walk+canoe", canoe(hh)), ("ship", hh == WATER)):
            for ax, ay, bx, by in seam_joins(mask):
                joins += 1
                why.append(f"wrap: the seam joins two {layer} components at ({ax}, {ay}) | ({bx}, {by}) (patches {state})")
    return {"ok": not why, "why": why, "least_margin": least, "joins": joins,
            "note": f"edges Water, least land margin {least} >= {margin}, no component joined (walk, walk+canoe, ship; "
                    f"patches off and on)"}


def _least_margin(g: np.ndarray) -> int:
    land = np.argwhere(g != WATER)
    if not len(land):
        return min(g.shape)
    h, w = g.shape
    ys, xs = land[:, 0], land[:, 1]
    return int(min(xs.min(), w - 1 - xs.max(), ys.min(), h - 1 - ys.max()))


def _ship_zone(zones: list[dict], x: int, y: int) -> str | None:
    for z in zones:
        if "ship" not in (z.get("modes") or []):
            continue
        for x0, y0, x1, y1 in z["rects"]:
            if x0 <= x <= x1 and y0 <= y <= y1:
                return z["id"]
    return None


def seam_report(g: np.ndarray, zones: list[dict], sea_class: dict[str, str]) -> dict:
    """The report-only `seam_zones` line: per seam, the stretches whose two ship zones' classes differ."""
    h, w = g.shape
    stretches, unclassed = [], sorted({z["id"] for z in zones if "ship" in (z.get("modes") or [])} - set(sea_class))
    for name, pairs in (("E-W", [((0, y), (w - 1, y), y) for y in range(h)]),
                        ("N-S", [((x, 0), (x, h - 1), x) for x in range(w)])):
        run = None
        for a, b, i in pairs:
            za, zb = _ship_zone(zones, *a), _ship_zone(zones, *b)
            ca, cb = sea_class.get(za or ""), sea_class.get(zb or "")
            key = (za, zb) if ca and cb and ca != cb else None
            if run and run["key"] == key:
                run["to"] = i
                continue
            if run and run["key"]:
                stretches.append(run)
            run = {"seam": name, "key": key, "from": i, "to": i}
        if run and run["key"]:
            stretches.append(run)
    text = [f"{s['seam']} {s['from']}-{s['to']} ({s['to'] - s['from'] + 1}): {s['key'][0]} | {s['key'][1]}"
            for s in stretches]
    return {"ok": True, "stretches": stretches, "unclassed": unclassed,
            "note": "; ".join(text + [f"UNCLASSED {z}" for z in unclassed]) or "every seam pair of one class"}
