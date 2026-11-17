"""The world composer (docs/WORLD_PLAN.md 2.9) - SKELETON from W1-0b.

  python3 -I assets-src/tools/layouts/world.py --check-bands   # checks 1, 2 and 4: prints `bands: OK`
  python3 -I assets-src/tools/layouts/world.py                 # the bands, then the basins on the stub world

This skeleton composes the stub world only: A1 is the act-1 block (`overworld.build()`, unchanged) translated by
`A1_ORIGIN`, every other region is ocean, the composer fills the seams, and the placeholder walls stand in for the
Aldi walls of the regions that are not built yet. It runs the band checks (rects tile the world, no region writes
outside its rects or into a band, the seams hold) and the basin checks that need no patch. It writes nothing:
`assets-src/maps/overworld.yaml` is still the act-1 map written by `overworld.py`. W1-C2 replaces this file with the
real composer (the region modules `world_<r>.py`, the world source, ids, anchors, docks, the canal patch, barriers).
"""
from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import overworld  # noqa: E402
from world_api import (A1_ORIGIN, BASIN_SEEDS, BOXES, CHUNK, EDGE, GRASS, MOUNTAIN, PLACEHOLDER_WALLS,  # noqa: E402
                       SEAMS, UNSET, WATER, WORLD_H, WORLD_W, Cell, Rect, RegionOut)

REGIONS = ["a1", "elf", "earth", "fire", "ordeal", "water", "wind"]      # pre-seeded; no tranche edits the list
WALKABLE = set(".,:fs=u%")
DIRS = ((1, 0), (-1, 0), (0, 1), (0, -1))


def owner_grid() -> list[list[str | None]]:
    own: list[list[str | None]] = [[None] * WORLD_W for _ in range(WORLD_H)]
    for r in REGIONS:
        for rect in BOXES[r]:
            for x, y in rect.cells():
                if 0 <= x < WORLD_W and 0 <= y < WORLD_H and own[y][x] is None:
                    own[y][x] = r
    return own


def band_cells(own: list[list[str | None]]) -> set[Cell]:
    """Cells within EDGE (Chebyshev) of a cell of another region or of the world's outer edge."""
    out = set()
    for y in range(WORLD_H):
        for x in range(WORLD_W):
            for dy in range(-EDGE, EDGE + 1):
                for dx in range(-EDGE, EDGE + 1):
                    nx, ny = x + dx, y + dy
                    if not (0 <= nx < WORLD_W and 0 <= ny < WORLD_H) or own[ny][nx] != own[y][x]:
                        out.add((x, y))
                        break
                else:
                    continue
                break
    return out


def bbox(rects: list[Rect]) -> Rect:
    return Rect(min(r.x0 for r in rects), min(r.y0 for r in rects), max(r.x1 for r in rects), max(r.y1 for r in rects))


def stub_out(region: str, band: set[Cell]) -> RegionOut:
    """A region that is not built: ocean in its rects, nothing written in its bands."""
    b = bbox(BOXES[region])
    rows = ["".join(WATER if any(r.contains(x, y) for r in BOXES[region]) and (x, y) not in band else UNSET
                    for x in range(b.x0, b.x1 + 1)) for y in range(b.y0, b.y1 + 1)]
    return RegionOut(ground=rows, stub=True)


def a1_out(band: set[Cell]) -> tuple[RegionOut, list[str]]:
    """The act-1 block, translated; its band cells are left to the composer (they must be act-1 ocean)."""
    g, _ = overworld.build()
    out, errs = stub_out("a1", band), []
    rows = [list(r) for r in out.ground]
    b = bbox(BOXES["a1"])
    for ly in range(g.h):
        for lx in range(g.w):
            x, y = lx + A1_ORIGIN[0], ly + A1_ORIGIN[1]
            if (x, y) in band:
                if g[lx, ly] != WATER:
                    errs.append(f"act-1 cell local ({lx}, {ly}) is {g[lx, ly]!r} in a band")
                continue
            rows[y - b.y0][x - b.x0] = g[lx, ly]
    out.ground = ["".join(r) for r in rows]
    return out, errs


def compose(outs: dict[str, RegionOut]) -> list[list[str]]:
    world = [[WATER] * WORLD_W for _ in range(WORLD_H)]       # bands default to ocean, the outer edge always
    for r, out in outs.items():
        b = bbox(BOXES[r])
        for j, row in enumerate(out.ground):
            for i, ch in enumerate(row):
                if ch != UNSET:
                    world[b.y0 + j][b.x0 + i] = ch
    for p in PLACEHOLDER_WALLS:
        if outs[p.region].stub:
            for x, y in p.rect.cells():
                if world[y][x] == WATER:
                    world[y][x] = p.fill
    for s in SEAMS.values():
        for x, y in s.rect.cells():
            world[y][x] = s.fill
    return world


def check_bands(outs: dict[str, RegionOut], own, band: set[Cell], world) -> list[str]:
    errs = []
    cover = [[0] * WORLD_W for _ in range(WORLD_H)]           # 1. the rects tile the world, chunk-aligned
    for r in REGIONS:
        for rect in BOXES[r]:
            if rect.x0 % CHUNK or rect.y0 % CHUNK or (rect.x1 + 1) % CHUNK or (rect.y1 + 1) % CHUNK:
                errs.append(f"{r} rect {rect} is not chunk-aligned")
            for x, y in rect.cells():
                if 0 <= x < WORLD_W and 0 <= y < WORLD_H:
                    cover[y][x] += 1
                else:
                    errs.append(f"{r} rect {rect} leaves the world")
                    break
    bad = [(x, y) for y in range(WORLD_H) for x in range(WORLD_W) if cover[y][x] != 1]
    if bad:
        errs.append(f"rects do not tile the world: {len(bad)} cells, first {bad[0]} covered {cover[bad[0][1]][bad[0][0]]}x")
    for r, out in outs.items():                               # 2. no region writes outside its rects or into a band
        b = bbox(BOXES[r])
        for j, row in enumerate(out.ground):
            for i, ch in enumerate(row):
                x, y = b.x0 + i, b.y0 + j
                if ch == UNSET:
                    continue
                if own[y][x] != r:
                    errs.append(f"cell ({x}, {y}) outside its rects written by {r}")
                elif (x, y) in band:
                    errs.append(f"band cell ({x}, {y}) written by {r}")
    for name, s in SEAMS.items():                             # 4. the seams hold
        cells = set(s.rect.cells())
        if not cells <= band:
            errs.append(f"{name}: {len(cells - band)} cells outside the bands")
        for r in s.joins:
            side = {(x + dx, y + dy) for x, y in cells for dx, dy in DIRS} - cells
            side = {(x, y) for x, y in side if 0 <= x < WORLD_W and 0 <= y < WORLD_H and own[y][x] == r}
            want = (lambda c: c == MOUNTAIN) if s.fill == MOUNTAIN else (lambda c: c in WALKABLE)
            if not any(want(world[y][x]) for x, y in side):
                kind = "a wall" if s.fill == MOUNTAIN else "a walkable"
                errs.append(f"{name}: no {kind} cell of {r} next to it")
    return errs


def flood(world, seed: Cell) -> set[Cell]:
    seen, q = {seed}, deque([seed])
    while q:
        x, y = q.popleft()
        for dx, dy in DIRS:
            n = (x + dx, y + dy)
            if 0 <= n[0] < WORLD_W and 0 <= n[1] < WORLD_H and n not in seen and world[n[1]][n[0]] == WATER:
                seen.add(n)
                q.append(n)
    return seen


def check_basins(world) -> tuple[list[str], str]:
    """Basin checks 1 and 4 of 2.6 (no patch exists yet: the canal's check 2 and the docks' check 3 come with
    W1-C2 and ERT-O)."""
    errs = []
    for name, (x, y) in BASIN_SEEDS.items():
        if world[y][x] != WATER:
            return [f"basins: seed {name} ({x}, {y}) is {world[y][x]!r}, not Water"], ""
    aldi, ocean = flood(world, BASIN_SEEDS["aldi"]), flood(world, BASIN_SEEDS["ocean"])
    if aldi & ocean:
        x, y = min(aldi & ocean, key=lambda c: (c[1], c[0]))
        own = owner_grid()[y][x]
        errs.append(f"basins: LEAK aldi-ocean at ({x}, {y}), region {own}")
    stray = [(x, y) for y in range(WORLD_H) for x in range(WORLD_W)
             if world[y][x] == WATER and (x, y) not in aldi and (x, y) not in ocean]
    if stray:
        errs.append(f"basins: {len(stray)} Water cells in neither basin, first {stray[0]}")
    return errs, f"aldi {len(aldi)} cells, ocean {len(ocean)} cells; canal: no patch yet"


def main(argv: list[str]) -> int:
    own = owner_grid()
    band = band_cells(own)
    a1, errs = a1_out(band)
    outs = {r: (a1 if r == "a1" else stub_out(r, band)) for r in REGIONS}
    world = compose(outs)
    errs += check_bands(outs, own, band, world)
    if errs:
        print("bands: FAIL\n  " + "\n  ".join(errs))
        return 1
    print("bands: OK")
    if argv == ["--check-bands"]:
        return 0
    if argv:
        raise SystemExit("usage: world.py [--check-bands]")
    errs, summary = check_basins(world)
    if errs:
        print("\n".join(errs))
        return 1
    print(f"basins: OK ({summary})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
