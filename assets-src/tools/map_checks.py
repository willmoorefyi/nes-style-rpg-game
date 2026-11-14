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
  no_unreachable_walkable: true              every walkable cell can be reached from the first entrance, or from an
                                             entrance named in `unreachable_ok` (a region opened later, e.g. the
                                             north shore); `unreachable_ok` may also list [x, y] cells
  contrast: [{a: W, b: "-", min: 0.2}]       ground cells drawn with legend char `a` next to (4-neighbour) cells of
                                             char `b` read apart: the mean Rec. 601 luma (0-1) of the centre 8x8 px of
                                             `c.below` differs by at least `min` between the two sets (cells under
                                             object art are skipped), e.g. a temple's wall tops against its floor

Also always on, for `encounters` and `encounterZones`: every table entry has a weight and exactly one of `enemies`
(ids) or `groups` ({id, min, max?} with 0 <= min <= max); a formation's largest roll is at most 9 enemies; every id is
in assets/data/enemies.yaml. A zone has a unique id, inclusive [x0, y0, x1, y1] rects inside the map that cover at
least one walkable cell, its own table and an optional encounterRate.

Collision values are TerrainType (src/types/index.ts); BLOCKED is what blocks on foot.
"""
from __future__ import annotations

from collections import deque
from functools import lru_cache
from pathlib import Path
from typing import Iterable

import numpy as np
import yaml

WALL, WATER, MOUNTAIN, RIVER, COUNTER = 1, 2, 3, 7, 10
BLOCKED = frozenset({WALL, WATER, COUNTER, MOUNTAIN, RIVER})
DIRS = ((1, 0), (-1, 0), (0, 1), (0, -1))
# ground that is art by itself when blocked (walls, water, mountains); anything else needs object art over it
SOLID_GROUND = frozenset({"wall", "water", "mountain", "river", "ocean", "lake", "counter", "in_wall_top",
                          "in_wall_face", "void", "culvert"})
RIVER_SOURCES = ("water", "lake", "mountain")

Cell = tuple[int, int]
MAX_FORMATION = 9                                   # EncounterTable.MAX_FORMATION (src/systems/EncounterTable.ts)
ENEMIES_FILE = Path(__file__).resolve().parents[2] / "assets" / "data" / "enemies.yaml"


# ───────────────────────────── graph helpers (also used by map_report) ─────────────────────────────

def walkable(coll: np.ndarray, x: int, y: int) -> bool:
    return 0 <= y < coll.shape[0] and 0 <= x < coll.shape[1] and int(coll[y, x]) not in BLOCKED


def reach(coll: np.ndarray, starts: Iterable[Iterable[int]], blocked: frozenset | set = frozenset()) -> set[Cell]:
    """Cells reachable on foot from any start (4-connected), never entering a `blocked` cell."""
    seen: set[Cell] = set()
    q: deque[Cell] = deque()
    for s in starts:
        s = (int(s[0]), int(s[1]))
        if s not in seen and s not in blocked:
            seen.add(s)
            q.append(s)
    while q:
        x, y = q.popleft()
        for dx, dy in DIRS:
            n = (x + dx, y + dy)
            if n not in seen and n not in blocked and walkable(coll, *n):
                seen.add(n)
                q.append(n)
    return seen


def distances(coll: np.ndarray, start: Iterable[int], blocked: frozenset | set = frozenset()) -> dict[Cell, int]:
    start = (int(start[0]), int(start[1]))
    dist = {start: 0}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in DIRS:
            n = (x + dx, y + dy)
            if n not in dist and n not in blocked and walkable(coll, *n):
                dist[n] = dist[(x, y)] + 1
                q.append(n)
    return dist


def static_npc_cells(npcs: list[dict]) -> set[Cell]:
    return {(n["x"], n["y"]) for n in npcs if not n.get("wander")}


def talkable(coll: np.ndarray, npc: dict, seen: set[Cell]) -> bool:
    """A reachable 4-neighbour, or a reachable cell straight across a counter."""
    x, y = npc["x"], npc["y"]
    for dx, dy in DIRS:
        a, b = (x + dx, y + dy), (x + 2 * dx, y + 2 * dy)
        if a in seen:
            return True
        if 0 <= a[1] < coll.shape[0] and 0 <= a[0] < coll.shape[1] and int(coll[a[1], a[0]]) == COUNTER and b in seen:
            return True
    return False


def articulation_points(coll: np.ndarray, start: Iterable[int], blocked: frozenset | set = frozenset()) -> set[Cell]:
    """Single cells whose blocking splits the walkable component of `start` (iterative Tarjan)."""
    start = (int(start[0]), int(start[1]))
    if start in blocked or not walkable(coll, *start):
        return set()
    disc: dict[Cell, int] = {start: 0}
    low: dict[Cell, int] = {start: 0}
    parent: dict[Cell, Cell | None] = {start: None}
    aps: set[Cell] = set()
    root_children = 0
    t = 1

    def nbrs(c: Cell):
        return [(c[0] + dx, c[1] + dy) for dx, dy in DIRS
                if (c[0] + dx, c[1] + dy) not in blocked and walkable(coll, c[0] + dx, c[1] + dy)]

    stack = [(start, iter(nbrs(start)))]
    while stack:
        v, it = stack[-1]
        advanced = False
        for w in it:
            if w not in disc:
                parent[w] = v
                disc[w] = low[w] = t
                t += 1
                if v == start:
                    root_children += 1
                stack.append((w, iter(nbrs(w))))
                advanced = True
                break
            if w != parent[v]:
                low[v] = min(low[v], disc[w])
        if advanced:
            continue
        stack.pop()
        p = parent[v]
        if p is not None:
            low[p] = min(low[p], low[v])
            if p != start and low[v] >= disc[p]:
                aps.add(p)
    if root_children > 1:
        aps.add(start)
    return aps


def components(mask: np.ndarray) -> list[list[Cell]]:
    """4-connected components of a boolean cell mask, in scan order."""
    hgt, wid = mask.shape
    seen = np.zeros_like(mask, bool)
    out = []
    for y in range(hgt):
        for x in range(wid):
            if not mask[y, x] or seen[y, x]:
                continue
            comp, q = [], deque([(x, y)])
            seen[y, x] = True
            while q:
                cx, cy = q.popleft()
                comp.append((cx, cy))
                for dx, dy in DIRS:
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < wid and 0 <= ny < hgt and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((nx, ny))
            out.append(comp)
    return out


def edge_cells(width: int, height: int) -> list[Cell]:
    return [(x, y) for y in range(height) for x in range(width) if x in (0, width - 1) or y in (0, height - 1)]


def _touches(mask: np.ndarray, cells: Iterable[Cell]) -> bool:
    hgt, wid = mask.shape
    return any(0 <= x + dx < wid and 0 <= y + dy < hgt and mask[y + dy, x + dx]
               for x, y in cells for dx, dy in DIRS)


def _cells(cs: Iterable[Cell], n: int = 6) -> str:
    cs = sorted(cs, key=lambda c: (c[1], c[0]))
    s = ", ".join(f"({x}, {y})" for x, y in cs[:n])
    return s + (f" (+{len(cs) - n} more)" if len(cs) > n else "")


# ───────────────────────────── road ends ─────────────────────────────

def road_caps(road: np.ndarray, cap_width: int = 2) -> list[list[Cell]]:
    """Ends of the road network: isolated road cells, 1-wide tips, and caps of roads up to cap_width wide (a run of
    cells across the road, all with road behind and none ahead, bounded by non-road on both sides)."""
    hgt, wid = road.shape
    r = lambda x, y: 0 <= x < wid and 0 <= y < hgt and bool(road[y, x])  # noqa: E731
    caps: list[list[Cell]] = []
    for y in range(hgt):
        for x in range(wid):
            if road[y, x] and not any(r(x + dx, y + dy) for dx, dy in DIRS):
                caps.append([(x, y)])
    for dx, dy in DIRS:
        px, py = abs(dy), abs(dx)                       # along the cap (perpendicular to the road)
        ok = lambda x, y: r(x, y) and not r(x + dx, y + dy) and r(x - dx, y - dy)  # noqa: E731
        done: set[Cell] = set()
        for y in range(hgt):
            for x in range(wid):
                if (x, y) in done or not ok(x, y) or ok(x - px, y - py):
                    continue                            # only start at the first cell of a run
                run = [(x, y)]
                while ok(run[-1][0] + px, run[-1][1] + py):
                    run.append((run[-1][0] + px, run[-1][1] + py))
                done.update(run)
                (ax, ay), (bx, by) = run[0], run[-1]
                if len(run) <= cap_width and not r(ax - px, ay - py) and not r(bx + px, by + py):
                    caps.append(run)
    return caps


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


# ───────────────────────────── encounter tables and zones ─────────────────────────────

@lru_cache(maxsize=1)
def known_enemies() -> frozenset[str]:
    return frozenset(e["id"] for e in yaml.safe_load(ENEMIES_FILE.read_text()) or [])


def _is_int(v) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def table_errors(where: str, table, enemies: frozenset[str]) -> list[str]:
    """An encounter list: each entry has a weight and exactly one of `enemies` (ids) or `groups` ({id, min, max?});
    a formation's largest roll is at most MAX_FORMATION enemies, and every id is in enemies.yaml."""
    if not isinstance(table, list):                 # [] is a map (or zone) without random battles
        return [f"{where}: expected a list of encounter entries"]
    errors = []
    for i, e in enumerate(table):
        p = f"{where}[{i}]"
        if not isinstance(e, dict):
            errors.append(f"{p}: expected an object")
            continue
        w = e.get("weight")
        if not isinstance(w, (int, float)) or isinstance(w, bool) or w < 0:
            errors.append(f"{p}: weight must be a number >= 0")
        if set(e) - {"weight", "enemies", "groups"}:
            errors.append(f"{p}: unknown keys {sorted(set(e) - {'weight', 'enemies', 'groups'})}")
        if ("enemies" in e) == ("groups" in e):
            errors.append(f"{p}: give exactly one of enemies or groups")
            continue
        if "enemies" in e:
            ids = e["enemies"]
            if not isinstance(ids, list) or not ids or not all(isinstance(x, str) for x in ids):
                errors.append(f"{p}: enemies must be a non-empty list of enemy ids")
                continue
            most = len(ids)
        else:
            groups = e["groups"]
            if not isinstance(groups, list) or not groups:
                errors.append(f"{p}: groups must be a non-empty list")
                continue
            ids, most = [], 0
            for j, gr in enumerate(groups):
                q = f"{p}.groups[{j}]"
                if not isinstance(gr, dict) or not isinstance(gr.get("id"), str):
                    errors.append(f"{q}: expected {{id, min, max?}}")
                    continue
                if set(gr) - {"id", "min", "max"}:
                    errors.append(f"{q}: unknown keys {sorted(set(gr) - {'id', 'min', 'max'})}")
                lo, hi = gr.get("min"), gr.get("max", gr.get("min"))
                if not (_is_int(lo) and _is_int(hi) and 0 <= lo <= hi):
                    errors.append(f"{q}: expected integers 0 <= min <= max, got min {lo}, max {hi}")
                    continue
                ids.append(gr["id"])
                most += hi
        if most > MAX_FORMATION:
            errors.append(f"{p}: up to {most} enemies, more than {MAX_FORMATION}")
        unknown = sorted({x for x in ids if x not in enemies})
        if unknown:
            errors.append(f"{p}: unknown enemy ids {unknown} (not in assets/data/enemies.yaml)")
    return errors


def encounter_errors(src: dict, c) -> list[str]:
    """The map's `encounters` and its `encounterZones` (docs/FIX_PLAN_PENINSULA.md T4 §2.5)."""
    enemies = known_enemies()
    errors = table_errors("encounters", src["encounters"], enemies) if "encounters" in src else []
    zones = src.get("encounterZones")
    if zones is None:
        return errors
    if not isinstance(zones, list):
        return errors + ["encounterZones: expected a list"]
    ids: set[str] = set()
    for i, z in enumerate(zones):
        p = f"encounterZones[{i}]"
        if not isinstance(z, dict) or not isinstance(z.get("id"), str) or not z["id"]:
            errors.append(f"{p}: needs a non-empty string id")
            continue
        p = f"encounterZones[{i}] ({z['id']})"
        if z["id"] in ids:
            errors.append(f"{p}: duplicate zone id")
        ids.add(z["id"])
        if set(z) - {"id", "rects", "encounters", "encounterRate"}:
            errors.append(f"{p}: unknown keys {sorted(set(z) - {'id', 'rects', 'encounters', 'encounterRate'})}")
        rects = z.get("rects")
        if not isinstance(rects, list) or not rects:
            errors.append(f"{p}: rects must be a non-empty list of [x0, y0, x1, y1]")
            rects = []
        walk = 0
        for j, r in enumerate(rects):
            if not (isinstance(r, list) and len(r) == 4 and all(_is_int(v) for v in r)):
                errors.append(f"{p}.rects[{j}]: expected [x0, y0, x1, y1] integers")
                continue
            x0, y0, x1, y1 = r
            if not (0 <= x0 <= x1 < c.width and 0 <= y0 <= y1 < c.height):
                errors.append(f"{p}.rects[{j}]: {r} is not an inclusive rect inside the {c.width}x{c.height} map")
                continue
            walk += sum(walkable(c.collision, x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1))
        if rects and not walk:
            errors.append(f"{p}: covers no walkable cell")
        errors += table_errors(f"{p}.encounters", z.get("encounters"), enemies)
        rate = z.get("encounterRate")
        if rate is not None and not (isinstance(rate, dict) and _is_int(rate.get("min")) and _is_int(rate.get("max"))
                                     and 1 <= rate["min"] <= rate["max"]):
            errors.append(f"{p}: encounterRate must be {{min, max}} integers with 1 <= min <= max")
    return errors


LUMA_601 = np.array([0.299, 0.587, 0.114], np.float32)
CONTRAST_SAMPLE = 8                                 # px: the centre square of a cell that is sampled


def contrast_pairs(src: dict, c, a: str, b: str) -> tuple[set[Cell], set[Cell]]:
    """Cells of ground char `a` with a 4-neighbour of char `b`, and those neighbours; cells under object art are
    left out (they show the object, not the ground)."""
    rows = src["ground"].rstrip("\n").split("\n")
    bare = (lambda x, y: c.art_share is None or c.art_share[y, x] == 0)  # noqa: E731
    sa: set[Cell] = set()
    sb: set[Cell] = set()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != a or not bare(x, y):
                continue
            for dx, dy in DIRS:
                nx, ny = x + dx, y + dy
                if 0 <= ny < len(rows) and 0 <= nx < len(rows[ny]) and rows[ny][nx] == b and bare(nx, ny):
                    sa.add((x, y))
                    sb.add((nx, ny))
    return sa, sb


def cell_luma(c, cells: Iterable[Cell]) -> float:
    """Mean Rec. 601 luma (0-1) of the centre CONTRAST_SAMPLE px square of each cell in `c.below`."""
    t = c.below.shape[0] // c.height
    lo, hi = (t - CONTRAST_SAMPLE) // 2, (t + CONTRAST_SAMPLE) // 2
    vals = [float((c.below[y * t + lo:y * t + hi, x * t + lo:x * t + hi, :3].astype(np.float32) @ LUMA_601).mean())
            for x, y in sorted(cells)]
    return sum(vals) / len(vals) / 255.0


def contrast_errors(src: dict, c) -> list[str]:
    specs = src["contrast"]
    if not isinstance(specs, list):
        return [f"contrast: want a list of {{a, b, min}} entries, not {specs!r}"]
    errors = []
    for n, spec in enumerate(specs):
        a, b, need = (spec.get(k) for k in ("a", "b", "min")) if isinstance(spec, dict) else (None, None, None)
        if not (isinstance(a, str) and len(a) == 1 and isinstance(b, str) and len(b) == 1 and a != b
                and isinstance(need, (int, float)) and not isinstance(need, bool) and 0 < need <= 1
                and set(spec) == {"a", "b", "min"}):
            errors.append(f"contrast {n}: want {{a: <char>, b: <other char>, min: 0-1}}, not {spec!r}")
            continue
        sa, sb = contrast_pairs(src, c, a, b)
        if not sa:
            errors.append(f"contrast {n}: no bare {a!r} cell next to a bare {b!r} cell")
            continue
        la, lb = cell_luma(c, sa), cell_luma(c, sb)
        if abs(la - lb) < need:
            errors.append(f"contrast {n}: {a!r} cells (luma {la:.3f}) and the {b!r} cells next to them (luma "
                          f"{lb:.3f}) differ by {abs(la - lb):.3f}, under {need} (they read as one texture)")
    return errors


def _unreachable(src: dict, c, seen: set[Cell]) -> list[str]:
    """Walkable cells reached neither from the first entrance nor from an `unreachable_ok` entrance (or cell)."""
    allowed = src.get("unreachable_ok") or []
    later = [c.entrances[e] for e in allowed if isinstance(e, str) and e in c.entrances]
    cells = {(int(e[0]), int(e[1])) for e in allowed if not isinstance(e, str)}
    ok = seen | reach(c.collision, later) | cells
    lost = [(x, y) for y in range(c.height) for x in range(c.width) if walkable(c.collision, x, y) and (x, y) not in ok]
    if not lost:
        return []
    return [f"no_unreachable_walkable: {len(lost)} walkable cells can't be reached from any entrance (fill them or "
            f"open a path): {_cells(lost, 10)}"]


def _road_check(src: dict, c, spec: dict) -> list[str]:
    errors = []
    mats = spec.get("materials", ["dirt"])
    road = np.isin(c.mat, list(mats)) | (c.mat == "bridge")
    islands_ok = {tuple(p) for p in spec.get("islands_ok") or []}
    comps = components(road)
    # a stub that is all bridge (a broken span's far half), or a listed island, is not a stray network
    comps = [cs for cs in comps if not (all(c.mat[y, x] == "bridge" for x, y in cs) or islands_ok & set(cs))] or comps[:1]
    if len(comps) > 1:
        comps.sort(key=len, reverse=True)
        errors.append(f"road_check: the roads form {len(comps)} separate networks; smaller ones at "
                      + ", ".join(f"({cs[0][0]}, {cs[0][1]}) [{len(cs)} cells]" for cs in comps[1:6]))
    allowed = np.zeros_like(road)
    marks = [(t["x"], t["y"]) for t in c.transitions] + [tuple(v) for v in c.entrances.values()]
    marks += [(g["x"], g["y"]) for g in src.get("keyItemGates") or []] + [tuple(e) for e in spec.get("ends") or []]
    for x, y in marks:
        if 0 <= x < c.width and 0 <= y < c.height:
            allowed[y, x] = True
    bad = []
    for cap in road_caps(road, spec.get("cap_width", 2)):
        if any(c.mat[y, x] == "bridge" or allowed[y, x] for x, y in cap) or _touches(allowed, cap):
            continue
        bad.append(cap[0])
    if bad:
        errors.append(f"road_check: dead ends that reach no gate, door, bridge or listed end: {_cells(bad, 10)}")
    # icons hiding roads (opt-in: towns have stalls and fountains on cobble on purpose)
    under = [(x, y) for (x, y) in c.owner if road[y, x] and int(c.collision[y, x]) in BLOCKED] if spec.get("check_under") else []
    if under:
        errors.append(f"road_check: road cells under a blocked object: {_cells(under)}")
    return errors


def _min_blob(mat: np.ndarray, spec: dict) -> list[str]:
    errors = []
    for name, least in spec.items():
        if name == "ocean_inlet":
            bad = ocean_inlets(mat, int(least))
            if bad:
                errors.append(f"min_blob: ocean narrower than {least} cells (an inlet) at {_cells(bad)}")
            continue
        small = [cs for cs in components(mat == name) if len(cs) < least]
        if small:
            errors.append(f"min_blob: {name} patches smaller than {least} cells at "
                          + _cells([min(cs, key=lambda p: (p[1], p[0])) for cs in small]))
    return errors


def ocean_inlets(mat: np.ndarray, least: int) -> list[Cell]:
    """Ocean cells in a horizontal or vertical water run (ocean or bridge) shorter than `least` that is closed by
    non-water on both sides (the map edge counts as open water)."""
    water = np.isin(mat, ["ocean", "bridge"])
    ocean = mat == "ocean"
    bad = set()
    for transpose in (False, True):                   # rows, then columns
        w, o = (water.T, ocean.T) if transpose else (water, ocean)
        for line in range(w.shape[0]):
            row, n, i = w[line], w.shape[1], 0
            while i < n:
                if not row[i]:
                    i += 1
                    continue
                j = i
                while j + 1 < n and row[j + 1]:
                    j += 1
                if i > 0 and j < n - 1 and j - i + 1 < least:
                    bad.update(((line, k) if transpose else (k, line)) for k in range(i, j + 1) if o[line, k])
                i = j + 1
    return sorted(bad, key=lambda p: (p[1], p[0]))


def _river_check(mat: np.ndarray, sources: tuple[str, ...]) -> list[str]:
    errors = []
    river = mat == "river"
    bridge = mat == "bridge"
    over = np.zeros_like(river)
    bridges = [b for b in components(bridge) if _touches(river, b)]
    for b in bridges:
        for x, y in b:
            over[y, x] = True
    src_mask = np.isin(mat, list(sources))
    ocean = mat == "ocean"
    for comp in components(river | over):
        if not _touches(src_mask, comp):
            errors.append(f"river_check: the river at {_cells(comp[:1])} has no source ({', '.join(sources)})")
        if not _touches(ocean, comp):
            errors.append(f"river_check: the river at {_cells(comp[:1])} never reaches the ocean")
    hgt, wid = mat.shape
    for b in bridges:
        xs, ys = sorted({x for x, _ in b}), sorted({y for _, y in b})
        for axis, span, (lo, hi) in ((0, xs, (ys[0] - 1, ys[-1] + 1)), (1, ys, (xs[0] - 1, xs[-1] + 1))):
            # axis 0: the river runs north-south under the bridge (rows above / below); 1: east-west
            for side in (lo, hi):
                if axis == 0:
                    if not 0 <= side < hgt or not any(river[side, x] for x in span):
                        continue
                    run = _run(river[side, :], [x for x in span if river[side, x]][0])
                else:
                    if not 0 <= side < wid or not any(river[y, side] for y in span):
                        continue
                    run = _run(river[:, side], [y for y in span if river[y, side]][0])
                if run != span:
                    where = f"row {side}" if axis == 0 else f"column {side}"
                    errors.append(f"river_check: beside the bridge at {_cells(b[:1])} the river in {where} uses "
                                  f"{run[0]}..{run[-1]}, not the bridge span {span[0]}..{span[-1]}")
    return errors


def _run(line: np.ndarray, i: int) -> list[int]:
    a = b = i
    while a - 1 >= 0 and line[a - 1]:
        a -= 1
    while b + 1 < len(line) and line[b + 1]:
        b += 1
    return list(range(a, b + 1))
