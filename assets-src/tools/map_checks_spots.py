"""The `spots` check (docs/NATURAL_WORLD_PLAN.md 5.2, NW-1), always on for a map with `spots`.

A spot is a named place of a map, `spots: {<name>: {at: [x, y], kind: land | dock | landing}}`, that quest.yaml, the
debug scenarios and the cutscenes name instead of a raw cell (`entry.at`, a vehicle's `at`, a scenario `spot:`). It
must lie on the map and on a cell of its kind:

  land      a walkable cell (a stage entry, a scenario spawn)
  dock      a Water cell (a parked ship)
  landing   a cell the airship lands on (`canLand`): Grass, with no transition, key-item gate or static NPC on it

Collision values are TerrainType (src/types/index.ts).
"""
from __future__ import annotations

from map_graph import WATER, static_npc_cells, walkable

GRASS = 0                                   # TerrainType.Grass: the airship lands on grass only (NW2 D-NW2-4)
KINDS = ("land", "dock", "landing")


def spot_errors(src: dict, c) -> list[str]:
    """Errors for `src["spots"]` on the compiled map `c` (build_map.Compiled)."""
    spots = src.get("spots")
    if spots is None:
        return []
    if not isinstance(spots, dict):
        return [f"spots: expected a mapping of name -> {{at, kind}}, got {type(spots).__name__}"]
    errors: list[str] = []
    blocked = {(t["x"], t["y"]) for t in c.transitions}
    blocked |= {(g["x"], g["y"]) for g in src.get("keyItemGates") or []}
    blocked |= static_npc_cells(src.get("npcs") or [])
    for name, s in spots.items():
        at = s.get("at") if isinstance(s, dict) else None
        kind = s.get("kind") if isinstance(s, dict) else None
        if not isinstance(s, dict) or set(s) != {"at", "kind"} or kind not in KINDS:
            errors.append(f"spot {name}: expected {{at: [x, y], kind: {' | '.join(KINDS)}}}, got {s!r}")
            continue
        if not (isinstance(at, list) and len(at) == 2 and all(isinstance(v, int) and not isinstance(v, bool)
                                                              for v in at)):
            errors.append(f"spot {name}: at must be [x, y], got {at!r}")
            continue
        x, y = at
        if not (0 <= x < c.width and 0 <= y < c.height):
            errors.append(f"spot {name} at ({x}, {y}) is off the {c.width}x{c.height} map")
            continue
        t = int(c.collision[y, x])
        if kind == "land" and not walkable(c.collision, x, y):
            errors.append(f"spot {name} (land) at ({x}, {y}) is not walkable (terrain {t})")
        elif kind == "dock" and t != WATER:
            errors.append(f"spot {name} (dock) at ({x}, {y}) is not Water (terrain {t})")
        elif kind == "landing" and (t != GRASS or (x, y) in blocked):
            errors.append(f"spot {name} (landing) at ({x}, {y}) is not a landing cell (terrain {t}"
                          f"{'; a transition, gate or static NPC' if (x, y) in blocked else ''})")
    return errors
