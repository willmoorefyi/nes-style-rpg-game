"""The doors of the regions outside act 1, read from today's world (docs/NATURAL_WORLD_PLAN.md 3.3, 7; NW-3).

Act 1's content comes from its pins (`a1/world_a1_pins.py`). The other regions' transitions and door offsets are
still read here from today's 192x192 source, `assets-src/maps/overworld.yaml` (read only; `mainline` still builds
it), until each NW-R tranche places its own; the composer moves each transition with its entrance. Act 1's
entrances and transitions are left out (`ACT1`), so nothing of act 1 is read from today's world.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

from a1 import world_a1_pins as P

SRC = Path(__file__).resolve().parents[3] / "maps" / "overworld.yaml"      # assets-src/maps/overworld.yaml
ACT1 = frozenset(P.ENTRANCES)


@lru_cache(maxsize=1)
def doc() -> dict:
    return yaml.safe_load(SRC.read_text())


def entrances() -> dict:
    """Today's entrances outside act 1 (today's cells)."""
    return {e: c for e, c in doc()["entrances"].items() if e not in ACT1}


def transitions() -> list[dict]:
    """Today's transitions whose nearest entrance (within 1 step) lies outside act 1, in today's order."""
    out = []
    every = doc()["entrances"]
    for t in doc()["transitions"]:
        near = sorted((abs(t["x"] - x) + abs(t["y"] - y), e) for e, (x, y) in every.items()
                      if abs(t["x"] - x) + abs(t["y"] - y) <= 1)
        if near[0][1] not in ACT1:
            out.append({**t, "_entrance": near[0][1]})
    return out


def door_of(ents: dict, trans: list[dict]) -> dict[str, tuple[tuple[int, int], dict]]:
    """Each entrance's door: the transition within 1 step (the nearest), as (offset, transition)."""
    best: dict[str, tuple[int, tuple[int, int], dict]] = {}
    for t in trans:
        for name, (x, y) in ents.items():
            d = abs(t["x"] - x) + abs(t["y"] - y)
            if d <= 1 and (name not in best or d < best[name][0]):
                best[name] = (d, (t["x"] - x, t["y"] - y), t)
    return {k: (v[1], v[2]) for k, v in best.items()}
