"""The doors of the regions outside act 1: pass W's door offsets (docs/NATURAL_WORLD_PLAN.md 3.3, 7; NW-3, NW-5).

Act 1's content comes from its pins (`a1/world_a1_pins.py`). The other regions' transitions and door offsets are pass
W's, frozen at the cutover in `today_doors_data.py` (NW-5: pass W's world source is gone); the composer moves each
transition with its entrance. Act 1's entrances and transitions are not in the data (`ACT1`).
"""
from __future__ import annotations

from a1 import world_a1_pins as P
from world_specs import today_doors_data as D

ACT1 = frozenset(P.ENTRANCES)


def entrances() -> dict:
    """Pass W's entrances outside act 1 (pass W's cells)."""
    return {e: list(c) for e, c in D.ENTRANCES.items() if e not in ACT1}


def transitions() -> list[dict]:
    """Pass W's transitions whose nearest entrance lies outside act 1, in pass W's order (a fresh copy each call)."""
    return [dict(t) for t in D.TRANSITIONS if t["_entrance"] not in ACT1]


def door_of(ents: dict, trans: list[dict]) -> dict[str, tuple[tuple[int, int], dict]]:
    """Each entrance's door: the transition within 1 step (the nearest), as (offset, transition)."""
    best: dict[str, tuple[int, tuple[int, int], dict]] = {}
    for t in trans:
        for name, (x, y) in ents.items():
            d = abs(t["x"] - x) + abs(t["y"] - y)
            if d <= 1 and (name not in best or d < best[name][0]):
                best[name] = (d, (t["x"] - x, t["y"] - y), t)
    return {k: (v[1], v[2]) for k, v in best.items()}
