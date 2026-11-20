"""The world composer's global checks (docs/WORLD_PLAN.md 2.5, 2.6, 2.9; W1-C2), run by layouts/world.py:

  1. the rects tile the world, chunk-aligned;          5. the basins hold (2.6 checks 1-4) and every dock is allowed;
  2. no region writes outside its rects or a band;     6. every built region's anchors exist as entrances (2.2);
  3. ids are unique and prefixed;                      7. every entrance is reachable on foot from a reach root,
  4. the seams hold (2.5);                                with every patch on.

Plus the Aldi walls' and the barriers' minimal cuts (2.9, exported for the mutations 6.3 GT-13 / GT-35). Each check
returns error strings; [] means OK.
"""
from __future__ import annotations

from pathlib import Path

import yaml

from world_api import (BASIN_SEEDS, BOXES, CANAL_PATCH, CHUNK, DOCKS_ALLOWED, MOUNTAIN, PLACEHOLDER_WALLS, PREFIXES,
                       SEAMS, UNSET, WALLS, WATER, WORLD_H, WORLD_W, Cell, RegionOut)
from world_geom import DIRS, World, bbox, flood, inside, is_walkable, is_water, min_cut, region_at

ANCHORS = Path(__file__).resolve().parents[3] / "assets" / "data" / "world-anchors.yaml"


def check_bands(outs: dict[str, RegionOut], own, band: set[Cell], world: World) -> list[str]:
    """Checks 1, 2 and 4."""
    errs = []
    cover = [[0] * WORLD_W for _ in range(WORLD_H)]
    for r, rects in BOXES.items():
        for rect in rects:
            if rect.x0 % CHUNK or rect.y0 % CHUNK or (rect.x1 + 1) % CHUNK or (rect.y1 + 1) % CHUNK:
                errs.append(f"{r} rect {rect} is not chunk-aligned")
            for x, y in rect.cells():
                if not inside(x, y):
                    errs.append(f"{r} rect {rect} leaves the world")
                    break
                cover[y][x] += 1
    bad = [(x, y) for y in range(WORLD_H) for x in range(WORLD_W) if cover[y][x] != 1]
    if bad:
        errs.append(f"rects do not tile the world: {len(bad)} cells, first {bad[0]} covered "
                    f"{cover[bad[0][1]][bad[0][0]]}x")
    for r, out in outs.items():
        b = bbox(BOXES[r])
        if len(out.ground) != b.h or any(len(row) != b.w for row in out.ground):
            errs.append(f"{r}: ground is not {b.w}x{b.h} (the bounding box of its rects)")
            continue
        for j, row in enumerate(out.ground):
            for i, ch in enumerate(row):
                x, y = b.x0 + i, b.y0 + j
                if ch == UNSET:
                    continue
                if own[y][x] != r:
                    errs.append(f"cell ({x}, {y}) outside its rects written by {r}")
                elif (x, y) in band:
                    errs.append(f"band cell ({x}, {y}) written by {r}")
    for name, s in SEAMS.items():
        cells = set(s.rect.cells())
        if not cells <= band:
            errs.append(f"{name}: {len(cells - band)} cells outside the bands")
        for r in s.joins:
            side = {(x + dx, y + dy) for x, y in cells for dx, dy in DIRS} - cells
            side = {(x, y) for x, y in side if inside(x, y) and own[y][x] == r}
            want = (lambda c: c == MOUNTAIN) if s.fill == MOUNTAIN else is_walkable
            if not any(want(world[y][x]) for x, y in side):
                errs.append(f"{name}: no {'wall' if s.fill == MOUNTAIN else 'walkable'} cell of {r} next to it")
    return errs


def patched(world: World, patches: list[dict], skip: set[str] = frozenset()) -> World:
    """The world with every patch on (except the ids in `skip`)."""
    out = [row[:] for row in world]
    for p in patches:
        if p["id"] not in skip:
            for x, y in p["cells"]:
                out[y][x] = p["ground"]
    return out


def basins(world: World, patches: list[dict]) -> tuple[set[Cell], set[Cell], list[str]]:
    """2.6 checks 1, 2 and 4; returns the two basins of the unpatched world."""
    for name, (x, y) in BASIN_SEEDS.items():
        if world[y][x] != WATER:
            return set(), set(), [f"basins: seed {name} ({x}, {y}) is {world[y][x]!r}, not Water"]
    errs = []
    aldi, ocean = flood(world, [BASIN_SEEDS["aldi"]], is_water), flood(world, [BASIN_SEEDS["ocean"]], is_water)
    if aldi & ocean:
        x, y = min(aldi & ocean, key=lambda c: (c[1], c[0]))
        errs.append(f"basins: LEAK aldi-ocean at ({x}, {y}), region {region_at(x, y)}")
    stray = [(x, y) for y in range(WORLD_H) for x in range(WORLD_W)
             if world[y][x] == WATER and (x, y) not in aldi and (x, y) not in ocean]
    if stray:
        errs.append(f"basins: {len(stray)} Water cells in neither basin, first {stray[0]}, region "
                    f"{region_at(*stray[0])}")
    canal = [p for p in patches if p["id"] == CANAL_PATCH]
    if len(canal) != 1:
        errs.append(f"basins: {len(canal)} `{CANAL_PATCH}` patches (want 1)")
    elif not errs:
        others = {p["id"] for p in patches} - {CANAL_PATCH}
        wet = patched(world, patches, others)
        if BASIN_SEEDS["ocean"] not in flood(wet, [BASIN_SEEDS["aldi"]], is_water):
            errs.append("basins: the canal does not join aldi and ocean")
        if any(p["id"] != CANAL_PATCH and p["ground"] == WATER for p in patches):
            join = flood(patched(world, patches, {CANAL_PATCH}), [BASIN_SEEDS["aldi"]], is_water)
            if BASIN_SEEDS["ocean"] in join:
                errs.append("basins: a patch other than the canal joins aldi and ocean")
    return aldi, ocean, errs


def docks(world: World, patches: list[dict], placed: list[tuple[str, dict]]) -> list[str]:
    """2.6 check 3 and DOCKS_ALLOWED: every (region, dock) is allowed in that region and lies in its declared basin,
    with every patch on except the canal."""
    errs = []
    wet = patched(world, patches, {CANAL_PATCH})
    member = {b: flood(wet, [s], is_water) for b, s in BASIN_SEEDS.items()}
    for r, d in placed:
        spec = DOCKS_ALLOWED.get(d.get("id"))
        if spec is None or spec.region != r:
            errs.append(f"DOCK {d.get('id')} at ({d.get('x')}, {d.get('y')}) not allowed in {r}")
        elif d.get("basin") != spec.basin or (d["x"], d["y"]) not in member[spec.basin]:
            errs.append(f"DOCK {d['id']} at ({d['x']}, {d['y']}) is not in basin {spec.basin}")
    return errs


def source_checks(src: dict) -> list[str]:
    """The basin and dock checks on a written world source (build_hooks.region_checks with region None)."""
    if not (src.get("world") or {}).get("frames"):
        return []                                      # not the world map
    world = [list(r) for r in src["ground"].rstrip("\n").split("\n")]
    if len(world) != WORLD_H or any(len(r) != WORLD_W for r in world):
        return [f"world source is not {WORLD_W}x{WORLD_H}"]
    patches = src.get("patches") or []
    errs = basins(world, patches)[2]
    return errs + docks(world, patches, [(region_at(d["x"], d["y"]), d) for d in src.get("docks") or []])


def ids(outs: dict[str, RegionOut]) -> list[str]:
    """Check 3: entrance, zone, patch, dock, hazard and NPC ids are unique and carry the region prefix."""
    errs, seen = [], {}
    for r, out in outs.items():
        legacy = set(out.checks.get("legacy_ids") or [])
        named = [("entrance", e) for e in out.entrances] + [("NPC", n.get("id")) for n in out.npcs]
        named += [("spot", s) for s in out.spots]                     # NW-1: `<prefix>_s_<name>`
        errs += [f"{r}: spot id {s!r} is not {PREFIXES[r]}_s_<name>" for s in out.spots
                 if not s.startswith(PREFIXES[r] + "_s_")]
        for kind, items in (("zone", out.encounterZones), ("patch", out.patches), ("dock", out.docks),
                            ("hazard", out.hazards)):
            named += [(kind, i.get("id")) for i in items]
        for kind, i in named:
            if not isinstance(i, str):
                errs.append(f"{r}: a {kind} has no id")
                continue
            if i not in legacy and not i.startswith(PREFIXES[r] + "_") and (kind, i) != ("patch", CANAL_PATCH):
                errs.append(f"{r}: {kind} id {i!r} lacks the prefix {PREFIXES[r]}_")
            if (kind, i) in seen:
                errs.append(f"{kind} id {i!r} in {seen[(kind, i)]} and {r}")
            seen[(kind, i)] = r
    return errs


def anchors(outs: dict[str, RegionOut], entrances: dict[str, list[int]]) -> list[str]:
    """Check 6: a built region's anchors (and every `built` anchor) are entrances within the tolerance (2.2)."""
    doc = yaml.safe_load(ANCHORS.read_text(encoding="utf-8"))
    tol, errs = doc["tolerance"], []
    for a in doc["anchors"]:
        out = outs[a["region"]]
        need = a.get("built") or (not out.stub and a["entrance"] not in (out.checks.get("anchors_pending") or []))
        at = entrances.get(a["entrance"])
        if at is None:
            if need:
                errs.append(f"anchor {a['entrance']} ({a['region']}) is not an entrance")
        elif max(abs(at[0] - a["target"][0]), abs(at[1] - a["target"][1])) > tol:
            errs.append(f"anchor {a['entrance']} at {tuple(at)} is more than {tol} from {tuple(a['target'])}")
    return errs


def reachable(world: World, patches: list[dict], outs: dict[str, RegionOut]) -> list[str]:
    """Check 7: with every patch on, every entrance is reachable on foot from a reach root of some region (a region's
    `checks.reach_roots`; by default every one of its entrances is a root)."""
    walk = patched(world, patches)
    ents = {k: tuple(v) for out in outs.values() for k, v in out.entrances.items()}
    roots = [ents[k] for out in outs.values() for k in (out.checks.get("reach_roots") or list(out.entrances))
             if k in ents]
    seen = flood(walk, roots, is_walkable)
    return [f"entrance {k} at {p} is not reachable on foot from any reach root (every patch on)"
            for k, p in ents.items() if p not in seen]


def wall_cells(world: World, outs: dict[str, RegionOut]) -> tuple[dict[str, set[Cell]], list[str]]:
    """Each Aldi wall's cells: its seams, the placeholder cells of its stub regions, the parts of its built ones."""
    errs, out = [], {}
    for name, w in WALLS.items():
        cells = set().union(*(set(SEAMS[s].rect.cells()) for s in w.seams))
        for r in w.regions:
            if outs[r].stub:
                cells |= {c for p in PLACEHOLDER_WALLS if p.wall == name and p.region == r for c in p.rect.cells()
                          if world[c[1]][c[0]] != WATER}
            elif not outs[r].walls.get(name):
                errs.append(f"wall {name}: built region {r} returns no part of it")
            else:
                cells |= set(outs[r].walls[name])
        out[name] = cells
    return out, errs


def cuts(world: World, aldi: set[Cell], ocean: set[Cell], outs: dict[str, RegionOut], walls: dict[str, set[Cell]]
         ) -> tuple[dict[str, list[list[int]]], list[str]]:
    """The minimal water cut of each wall (aldi to ocean through its cells), and the minimal walkable cut of each
    barrier, whose seeds must be walkable and apart with the barrier in place (every patch on but the canal)."""
    errs, res = [], {}
    # a cut never runs through a site's door or arrival cell (INT-W2c: W_isthmus ran through the dwarf hall's door, so
    # opening it also flooded the door and the mutation proved nothing about the wall)
    doors = ({(t["x"], t["y"]) for out in outs.values() for t in out.transitions}
             | {tuple(e) for out in outs.values() for e in out.entrances.values()})
    for name, cells in walls.items():
        cut = min_cut(world, aldi, ocean, cells - doors, is_water)
        if not cut:
            errs.append(f"wall {name}: no water cut through its {len(cells)} cells joins aldi and ocean")
        res[name] = [list(c) for c in cut]
    walk = patched(world, [p for out in outs.values() for p in out.patches], {CANAL_PATCH})
    for r, out in outs.items():
        for name, (cells, a, b) in sorted(out.barriers.items()):
            if not (is_walkable(walk[a[1]][a[0]]) and is_walkable(walk[b[1]][b[0]])):
                errs.append(f"barrier {name} ({r}): a seed is not walkable")
                continue
            open_ = [row[:] for row in walk]
            for x, y in cells:
                open_[y][x] = MOUNTAIN
            if tuple(b) in flood(open_, [tuple(a)], is_walkable):
                errs.append(f"barrier {name} ({r}): its seeds are joined on foot with the barrier in place")
            cut = min_cut(open_, {tuple(a)}, {tuple(b)}, set(map(tuple, cells)), is_walkable)
            if not cut:
                errs.append(f"barrier {name} ({r}): no walkable cut joins its seeds")
            res[name] = [list(c) for c in cut]
    return res, errs
