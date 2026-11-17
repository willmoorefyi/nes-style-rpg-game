"""Small helpers shared by the map checks (map_checks.py, map_checks_terrain.py, map_checks_encounters.py)."""
from __future__ import annotations

from typing import Iterable

import numpy as np

from map_graph import DIRS, Cell, reach, walkable


def _touches(mask: np.ndarray, cells: Iterable[Cell]) -> bool:
    hgt, wid = mask.shape
    return any(0 <= x + dx < wid and 0 <= y + dy < hgt and mask[y + dy, x + dx]
               for x, y in cells for dx, dy in DIRS)


def _cells(cs: Iterable[Cell], n: int = 6) -> str:
    cs = sorted(cs, key=lambda c: (c[1], c[0]))
    s = ", ".join(f"({x}, {y})" for x, y in cs[:n])
    return s + (f" (+{len(cs) - n} more)" if len(cs) > n else "")


def _is_int(v) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def _unreachable(src: dict, c, seen: set[Cell]) -> list[str]:
    """Walkable cells reached neither from the first entrance, nor from an `unreachable_ok` entrance (or cell), nor
    from a reach root (`no_unreachable_walkable: {reach_roots: [...]}`, entrance names or [x, y] cells: the world map,
    where every region names the entrances its land is walked from)."""
    allowed = src.get("unreachable_ok") or []
    spec = src.get("no_unreachable_walkable")
    roots = (spec.get("reach_roots") or []) if isinstance(spec, dict) else []
    later = [c.entrances[e] for e in [*allowed, *roots] if isinstance(e, str) and e in c.entrances]
    later += [e for e in roots if not isinstance(e, str)]
    cells = {(int(e[0]), int(e[1])) for e in allowed if not isinstance(e, str)}
    ok = seen | reach(c.collision, later) | cells
    lost = [(x, y) for y in range(c.height) for x in range(c.width) if walkable(c.collision, x, y) and (x, y) not in ok]
    if not lost:
        return []
    return [f"no_unreachable_walkable: {len(lost)} walkable cells can't be reached from any entrance (fill them or "
            f"open a path): {_cells(lost, 10)}"]
