"""Map checks for the map compiler (build_map.validate) and the map report (map_report.py).

Always on: NPCs are talkable, `inspect` cells are reachable, and with `edge_exits` every walkable edge cell is a
reachable exit. Opt-in per source map:

  sealed_edges: true                         no walkable cell on the map edge
  road_check: {materials: [dirt], ends: [[x, y], ...], cap_width: 2}
                                             road cells (and bridges) form one 4-connected component; every road end
                                             (a 1-wide tip or a cap of a road up to cap_width wide) touches a
                                             transition, an entrance, a key-item gate, a bridge or a listed end;
                                             no road cell is under a blocked object cell
  warp_leaves: true                          every transition cell has at most one walkable 4-neighbour outside its
                                             own object (no junction is a warp)
  min_blob: {mountain: 3, sand: 3, forest: 3, ocean_inlet: 2}
                                             no 4-connected component of that ground material is smaller; for
                                             ocean_inlet N, no ocean cell lies in a horizontal or vertical run of
                                             water (ocean or bridge) shorter than N between two non-water cells
  river_check: true | {sources: [water, lake, mountain]}
                                             each component of river cells (plus bridges over the river) touches a
                                             source and the ocean; the river keeps the bridge span's columns (rows)
                                             on both sides of each bridge
  art_coverage: true | {min: 0.25}           every blocked cell on open ground has at least that share of object art
  no_static_chokepoints: true                static NPCs (no `wander`) cut off no entrance or transition
  no_unreachable_walkable: true | {reach_roots: [name | [x, y], ...]}
                                             every walkable cell can be reached from the first entrance, from an
                                             entrance named in `unreachable_ok` (a region opened later, e.g. the
                                             north shore), or from a reach root (the world map: each region names
                                             the entrances its land is walked from); `unreachable_ok` may also list
                                             [x, y] cells
  contrast: [{a: W, b: "-", min: 0.2}]       ground cells drawn with legend char `a` next to (4-neighbour) cells of
                                             char `b` read apart: the mean Rec. 601 luma (0-1) of the centre 8x8 px of
                                             `c.below` differs by at least `min` between the two sets (cells under
                                             object art are skipped), e.g. a temple's wall tops against its floor

Also always on, for `encounters` and `encounterZones`: every table entry has a weight and exactly one of `enemies`
(ids) or `groups` ({id, min, max?} with 0 <= min <= max); a formation's largest roll is at most 9 enemies; every id is
in assets/data/enemies.yaml. A zone has a unique id, inclusive [x0, y0, x1, y1] rects inside the map that cover at
least one walkable cell, its own table and an optional encounterRate.

Collision values are TerrainType (src/types/index.ts); BLOCKED is what blocks on foot. This module is the façade that
build_map.py, map_report.py and map_selftest.py import: the helpers live in map_graph.py (walk graph),
map_checks_terrain.py (roads, blobs, rivers, contrast), map_checks_encounters.py (encounter tables and zones) and
map_checks_util.py, and are re-exported here. The world map's per-region options (road_check, river_check,
min_blob, warp_leaves per `regions.<r>.checks`) run in map_checks_region.py.
"""
from __future__ import annotations

from map_checks_encounters import ENEMIES_FILE, MAX_FORMATION, encounter_errors, known_enemies, table_errors  # noqa: F401
from map_checks_terrain import (CONTRAST_SAMPLE, LUMA_601, RIVER_SOURCES, _min_blob, _river_check, _road_check,  # noqa: F401
                                _run, cell_luma, contrast_errors, contrast_pairs, ocean_inlets, road_caps)
from map_checks_util import _cells, _is_int, _touches, _unreachable  # noqa: F401
from map_graph import (BLOCKED, COUNTER, DIRS, MOUNTAIN, RIVER, WALL, WATER, Cell, articulation_points,  # noqa: F401
                       components, distances, edge_cells, reach, static_npc_cells, talkable, walkable)

# ground that is art by itself when blocked (walls, water, mountains); anything else needs object art over it
SOLID_GROUND = frozenset({"wall", "water", "mountain", "river", "ocean", "lake", "counter", "in_wall_top",
                          "in_wall_face", "void", "culvert"})


# ───────────────────────────── the checks ─────────────────────────────

def run(src: dict, c, seen: set[Cell]) -> list[str]:
    """All checks for a compiled map `c` (build_map.Compiled); `seen` is what is reachable from the first entrance."""
    errors: list[str] = []
    coll = c.collision
    npcs = src.get("npcs") or []
    static = static_npc_cells(npcs)
    ok_unreach = {e for e in src.get("unreachable_ok") or [] if isinstance(e, str)}
    starts = [v for k, v in c.entrances.items()]
    seen_static = reach(coll, starts, static)

    for npc in npcs:                                    # talkable: always
        if not talkable(coll, npc, seen_static):
            errors.append(f"NPC {npc['id']} at ({npc['x']}, {npc['y']}) has no reachable cell to be talked to from")

    for n, e in enumerate(src.get("inspect") or []):    # inspect cells: always
        x, y = e.get("x"), e.get("y")
        text = e.get("text")
        if not isinstance(text, list) or not text:
            errors.append(f"inspect {n} at ({x}, {y}) needs a non-empty text list")
        elif not (all(isinstance(t, str) for t in text) or all(
                isinstance(t, dict) and set(t) <= {"text", "condition"} and isinstance(t.get("text"), list)
                and all(isinstance(s, str) for s in t["text"]) and isinstance(t.get("condition", ""), str) for t in text)):
            errors.append(f"inspect {n} at ({x}, {y}): text must be all strings or all {{text: [..], condition?}}"
                          " entries (no other keys)")
        if set(e) - {"x", "y", "text"}:
            errors.append(f"inspect {n} at ({x}, {y}) has unknown keys {sorted(set(e) - {'x', 'y', 'text'})}")
        if not (isinstance(x, int) and isinstance(y, int) and 0 <= x < c.width and 0 <= y < c.height):
            errors.append(f"inspect {n} at ({x}, {y}) is off the map")
        elif not any((x + dx, y + dy) in seen for dx, dy in DIRS):
            errors.append(f"inspect {n} at ({x}, {y}) has no reachable walkable neighbour")

    trans = {(t["x"], t["y"]) for t in c.transitions}
    for name, at in c.entrances.items():               # arrivals: never on a warp
        if tuple(at) in trans:
            errors.append(f"entrance {name} at {tuple(at)} is on a transition cell (the player would arrive on a warp)")
    if src.get("edge_exits"):
        walk_edge = [p for p in edge_cells(c.width, c.height) if walkable(coll, *p)]
        missing = [p for p in walk_edge if p not in trans]
        if missing:
            errors.append(f"edge_exits: walkable edge cells are not exits: {_cells(missing)}")
        lost = [p for p in walk_edge if p in trans and p not in seen]
        if lost:
            errors.append(f"edge_exits: walkable edge cells can't be reached from the first entrance: {_cells(lost)}")

    if src.get("sealed_edges"):
        open_edge = [p for p in edge_cells(c.width, c.height) if walkable(coll, *p)]
        if open_edge:
            errors.append(f"sealed_edges: walkable cells on the map edge: {_cells(open_edge)}")

    if src.get("road_check") is not None and src["road_check"] is not False:     # `road_check: {}` is on too
        errors += _road_check(src, c, src["road_check"] if isinstance(src["road_check"], dict) else {})

    if src.get("warp_leaves"):
        for t in c.transitions:
            p = (t["x"], t["y"])
            out = [(p[0] + dx, p[1] + dy) for dx, dy in DIRS
                   if walkable(coll, p[0] + dx, p[1] + dy) and (p[0] + dx, p[1] + dy) not in trans]
            if len(out) != 1:
                errors.append(f"warp_leaves: transition at {p} to {t['targetMap']} has {len(out)} walkable "
                              f"non-warp neighbours (want exactly 1, so it is a doorway, not a junction): {_cells(out)}")

    if src.get("min_blob"):
        errors += _min_blob(c.mat, src["min_blob"])

    if src.get("river_check"):
        spec = src["river_check"] if isinstance(src["river_check"], dict) else {}
        errors += _river_check(c.mat, tuple(spec.get("sources", RIVER_SOURCES)))

    if src.get("art_coverage"):
        spec = src["art_coverage"] if isinstance(src["art_coverage"], dict) else {}
        need = spec.get("min", 0.25)
        bare = [(x, y) for y in range(c.height) for x in range(c.width)
                if int(coll[y, x]) in BLOCKED and c.mat[y, x] not in SOLID_GROUND and c.art_share[y, x] < need]
        if bare:
            errors.append(f"art_coverage: blocked cells with less than {need:.0%} art (invisible walls): {_cells(bare)}")

    if src.get("no_static_chokepoints"):
        targets = [(f"entrance {k}", tuple(v)) for k, v in c.entrances.items() if k not in ok_unreach]
        targets += [(f"transition to {t['targetMap']}", (t["x"], t["y"])) for t in c.transitions]
        start = next(iter(c.entrances.values()), None)
        plugged = reach(coll, [start], static) if start is not None else set()
        for label, p in targets:
            if p in seen and p not in plugged and p not in static:
                errors.append(f"no_static_chokepoints: static NPCs cut off the {label} at {p}")

    if src.get("no_unreachable_walkable"):
        errors += _unreachable(src, c, seen)
    if src.get("contrast"):
        errors += contrast_errors(src, c)
    errors += encounter_errors(src, c)                 # encounter tables and zones: always
    return errors
