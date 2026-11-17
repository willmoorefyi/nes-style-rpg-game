"""Per-region map checks of the world map (QUEST 3.5 `RegionOut.checks`, docs/WORLD_PLAN.md 2.9; W1-C2).

A world source carries `regions: {<r>: {stub, checks}}`. `check(src, ground, region)` runs that region's options
(`road_check`, `river_check`, `min_blob`, `warp_leaves`) on the region's cells only: every cell outside the region's
rects reads as ocean, and only the transitions, entrances, gates and objects inside the rects count. So one region's
roads and rivers are checked against its own ends and sources. The world-level options (`sealed_edges`,
`art_coverage`, `no_unreachable_walkable` with `reach_roots`) stay on the source's top level and run once on the
whole compiled map (map_checks.run). With `region=None`, `check` runs every region's options.

The view is built from the source alone, before compiling: the collision comes from the ground and the object
footprints, with `collide: alpha` approximated by "a named part blocks, a null cell does not" (the compiled map
measures the art). `build_hooks.region_checks` calls this; so does `layouts/world.py` before it writes the source.
"""
from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(1, str(Path(__file__).resolve().parent / "layouts"))
from map_checks_terrain import RIVER_SOURCES, _min_blob, _river_check, _road_check  # noqa: E402
from map_graph import DIRS, walkable  # noqa: E402

ROAD, WALL = 8, 1
REGION_OPTIONS = ("road_check", "river_check", "min_blob", "warp_leaves")


@dataclass
class View:
    """The part of build_map.Compiled the region checks read."""
    width: int
    height: int
    mat: np.ndarray
    collision: np.ndarray
    transitions: list[dict]
    entrances: dict[str, list[int]]
    gates: list[dict]
    owner: dict[tuple[int, int], int] = field(default_factory=dict)


def _cells(o: dict) -> list[tuple[int, int, int | None]]:
    """(x, y, collision) of an object's footprint without its art (None: the ground's own), see the docstring."""
    t, x, y = o["type"], o.get("x"), o.get("y")
    if t == "deco":
        above = o.get("above_rows", len(o["parts"]) if o.get("above") else 0)
        walk_rows, walk = set(o.get("walkable_rows") or []), o.get("walk_cells") or []
        out = []
        for j, row in enumerate(o["parts"]):
            for i, name in enumerate(row):
                if (j < above and not o.get("above")) or (not name and o.get("collide") != "alpha"):
                    continue
                if j in walk_rows or [i, j] in walk:
                    out.append((x + i, y + j, ROAD))
                else:
                    out.append((x + i, y + j, WALL if name and o.get("block", True) else None))
        return out
    if t == "flowers":
        return []
    if t == "tree":
        return [(x, y, WALL)]
    if t in ("house", "prefab"):
        return [(x + i, y + j, WALL) for j in range(o["h"]) for i in range(o["w"])]
    if t == "fountain":
        return [(x + i, y + j, WALL) for j in range(2) for i in range(2)]
    return [(x, y, WALL)]


def view(src: dict, ground: list[str], rects: list[tuple[int, int, int, int]] | None,
         composer: list[tuple[int, int, int, int]] = ()) -> View:
    hgt, wid = len(ground), len(ground[0])
    inside = np.zeros((hgt, wid), bool)
    for x0, y0, x1, y1 in rects or [(0, 0, wid - 1, hgt - 1)]:
        inside[y0:y1 + 1, x0:x1 + 1] = True
    for x0, y0, x1, y1 in composer:                  # composer-owned cells (seams, placeholder walls) read as ocean
        inside[y0:y1 + 1, x0:x1 + 1] = False
    inn = lambda x, y: 0 <= x < wid and 0 <= y < hgt and inside[y, x]      # noqa: E731
    import build_map as BM  # noqa: PLC0415  (the compiler's legend and terrain table; lazy: build_map imports us)
    mat = np.array([[BM.LEGEND[ch] if inside[y, x] else "ocean" for x, ch in enumerate(row)]
                    for y, row in enumerate(ground)])
    coll = np.vectorize(BM.TERRAIN.get)(mat).astype(np.int16)
    owner = {}
    for n, o in enumerate(src.get("objects") or []):
        if o.get("x") is None or not inn(o["x"], o["y"]):
            continue
        for x, y, v in _cells(o):
            if inn(x, y):
                owner[(x, y)] = n
                if v is not None:
                    coll[y, x] = v
    trans = [t for t in src.get("transitions") or [] if inn(t["x"], t["y"])]
    ents = {k: v for k, v in (src.get("entrances") or {}).items() if inn(*v)}
    gates = [g for g in src.get("keyItemGates") or [] if inn(g["x"], g["y"])]
    return View(wid, hgt, mat, coll, trans, ents, gates, owner)


def _warp_leaves(c: View) -> list[str]:
    errs, trans = [], {(t["x"], t["y"]) for t in c.transitions}
    for p in sorted(trans, key=lambda q: (q[1], q[0])):
        out = [(p[0] + dx, p[1] + dy) for dx, dy in DIRS
               if walkable(c.collision, p[0] + dx, p[1] + dy) and (p[0] + dx, p[1] + dy) not in trans]
        if len(out) != 1:
            errs.append(f"warp_leaves: transition at {p} has {len(out)} walkable non-warp neighbours (want 1)")
    return errs


def run_options(src: dict, c: View, opts: dict) -> list[str]:
    errs: list[str] = []
    if opts.get("road_check") not in (None, False):
        errs += _road_check({**src, "keyItemGates": c.gates}, c, opts["road_check"] if isinstance(opts["road_check"], dict) else {})
    if opts.get("river_check"):
        spec = opts["river_check"] if isinstance(opts["river_check"], dict) else {}
        errs += _river_check(c.mat, tuple(spec.get("sources", RIVER_SOURCES)))
    if opts.get("min_blob"):
        errs += _min_blob(c.mat, opts["min_blob"])
    if opts.get("warp_leaves"):
        errs += _warp_leaves(c)
    return errs


def check(src: dict, ground, region: str | None) -> list[str]:
    """The region's own checks on its cells (all regions when `region` is None). `ground` is the source's ground
    text, its rows, or a [y][x] grid of legend chars."""
    if isinstance(ground, str):
        ground = ground.rstrip("\n").split("\n")
    ground = ["".join(r) for r in ground]
    regs = src.get("regions") or {}
    if region is None:
        return [f"{r}: {e}" for r in regs for e in check(src, ground, r)]
    if region not in regs:
        return []
    from world_api import BOXES, PLACEHOLDER_WALLS, SEAMS  # noqa: PLC0415
    rects = [(b.x0, b.y0, b.x1, b.y1) for b in BOXES[region]]
    composer = [s.rect for s in SEAMS.values()]
    composer += [p.rect for p in PLACEHOLDER_WALLS if p.region == region and regs[region].get("stub")]
    opts = {k: v for k, v in (regs[region].get("checks") or {}).items() if k in REGION_OPTIONS}
    view_ = view(src, ground, rects, [(r.x0, r.y0, r.x1, r.y1) for r in composer])
    return run_options(src, view_, opts) if opts else []
