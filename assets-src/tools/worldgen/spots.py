"""Spots on the generated world (docs/NATURAL_WORLD_PLAN.md 5.2, 3.8 `pins`; NW-2).

A region names its spots (`bundle.SpotDef`) relative to an entrance or a dock (or as an absolute world cell, act 1's
pins). The composer resolves each to the nearest cell of its kind within SEARCH_R cells of its target (ties by
(distance, y, x)): `land` walkable, `dock` Water, `landing` a canLand cell (grass or tundra, never snow; not a
transition, gate or entrance cell); none under an object. The resolved cell is then a pin of that material, so it
holds on every later compose; one with no such cell is reported (`errors`) and the `pins` check fails.
"""
from __future__ import annotations

import numpy as np

from .gates import BLOCK, LANDING

SEARCH_R = 6


def fits(h: np.ndarray, kind: str, x: int, y: int, blocked: set, covered: set = frozenset()) -> bool:
    if (x, y) in covered:
        return False
    c = h[y, x]
    if kind == "land":
        return c not in BLOCK
    if kind == "dock":
        return c == "o"
    return c in LANDING and (x, y) not in blocked


def target(d, sites: dict, docks: dict) -> tuple[int, int]:
    if not d.base:
        return tuple(d.offset)
    bx, by = docks[d.base[5:]] if d.base.startswith("dock:") else sites[d.base]
    return (bx + d.offset[0], by + d.offset[1])


def resolve(h: np.ndarray, defs: list, sites: dict, docks: dict, blocked: set,
            covered: set = frozenset()) -> tuple[dict, list[str]]:
    """({name: {"at": [x, y], "kind": k}}, errors). `h`: the source ground (patches off); `blocked`: transition,
    gate and entrance cells (no landing there); `covered`: object cells (no spot at all)."""
    out, errors = {}, []
    hh, ww = h.shape
    for d in defs:
        tx, ty = target(d, sites, docks)
        ring = sorted(((dx * dx + dy * dy, ty + dy, tx + dx) for dy in range(-SEARCH_R, SEARCH_R + 1)
                       for dx in range(-SEARCH_R, SEARCH_R + 1) if dx * dx + dy * dy <= SEARCH_R * SEARCH_R))
        hit = next(((x, y) for _, y, x in ring
                    if 0 <= x < ww and 0 <= y < hh and fits(h, d.kind, x, y, blocked, covered)), None)
        if hit is None:
            errors.append(f"spot {d.name} ({d.kind}): no such cell within {SEARCH_R} of {(tx, ty)}")
            hit = (tx, ty)
        out[d.name] = {"at": [int(hit[0]), int(hit[1])], "kind": d.kind}
    return out, errors
