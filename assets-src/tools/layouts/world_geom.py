"""Grid logic of the world composer (docs/WORLD_PLAN.md 2.4-2.9; W1-C2): region ownership, edge bands, chunk
ownership, floods, minimal cuts and the act-1 translation. `world_api.py` holds the declarations; this module only
computes from them. All coordinates are world cells; a world grid is `[y][x]` legend chars.
"""
from __future__ import annotations

from collections import deque
from collections.abc import Callable, Iterable

from world_api import BOXES, CHUNK, EDGE, UNSET, WATER, WORLD_H, WORLD_W, Cell, Rect, RegionOut

# legend chars a walker may stand on (build_map.TERRAIN values outside map_graph.BLOCKED)
WALKABLE = frozenset(".,:fs=%w_+-tn")         # pass NW adds tundra `t` and snow `n` (2.6)
DIRS = ((1, 0), (-1, 0), (0, 1), (0, -1))
World = list[list[str]]


def bbox(rects: Iterable[Rect]) -> Rect:
    rects = list(rects)
    return Rect(min(r.x0 for r in rects), min(r.y0 for r in rects), max(r.x1 for r in rects), max(r.y1 for r in rects))


def region_at(x: int, y: int) -> str | None:
    """The region whose rects hold the cell (None outside the world)."""
    for r, rects in BOXES.items():
        if any(rect.contains(x, y) for rect in rects):
            return r
    return None


def owner_grid() -> list[list[str | None]]:
    own: list[list[str | None]] = [[None] * WORLD_W for _ in range(WORLD_H)]
    for r, rects in BOXES.items():
        for rect in rects:
            for x, y in rect.cells():
                if 0 <= x < WORLD_W and 0 <= y < WORLD_H and own[y][x] is None:
                    own[y][x] = r
    return own


def band_cells(own: list[list[str | None]]) -> set[Cell]:
    """2.5: the cells within EDGE (Chebyshev) of a cell of another region or of the world's outer edge."""
    out = set()
    for y in range(WORLD_H):
        for x in range(WORLD_W):
            me = own[y][x]
            if any(not (0 <= x + dx < WORLD_W and 0 <= y + dy < WORLD_H) or own[y + dy][x + dx] != me
                   for dy in range(-EDGE, EDGE + 1) for dx in range(-EDGE, EDGE + 1)):
                out.add((x, y))
    return out


def owned_chunks(region: str) -> set[tuple[int, int]]:
    """(col, row) of every chunk of the union of the region's rects. The rects are chunk-aligned, so a band cell
    belongs to the chunk that holds it, and that chunk to the region whose rect holds it."""
    return set().union(*(r.chunks() for r in BOXES[region]))


def inside(x: int, y: int) -> bool:
    return 0 <= x < WORLD_W and 0 <= y < WORLD_H


def flood(world: World, seeds: Iterable[Cell], passable: Callable[[str], bool]) -> set[Cell]:
    """The 4-connected cells reachable from `seeds` over cells whose char passes `passable`."""
    seen: set[Cell] = set()
    q: deque[Cell] = deque()
    for s in seeds:
        if s not in seen and passable(world[s[1]][s[0]]):
            seen.add(s)
            q.append(s)
    while q:
        x, y = q.popleft()
        for dx, dy in DIRS:
            n = (x + dx, y + dy)
            if inside(*n) and n not in seen and passable(world[n[1]][n[0]]):
                seen.add(n)
                q.append(n)
    return seen


def is_water(ch: str) -> bool:
    return ch == WATER


def is_walkable(ch: str) -> bool:
    return ch in WALKABLE


def min_cut(world: World, sources: set[Cell], targets: set[Cell], cells: set[Cell],
            free: Callable[[str], bool]) -> list[Cell]:
    """The fewest `cells` whose opening joins `sources` to `targets` (2.9, 6.3 GT-13 / GT-35): a 0-1 search where a
    cell of `cells` costs 1, any other cell passing `free` costs 0, and the rest is closed. Returns the cut cells of
    the cheapest path in path order, or [] when even opening every cell joins nothing. Sources are seeded in
    row-major order and the queue is FIFO per cost, so the result is deterministic."""
    dist: dict[Cell, int] = {}
    prev: dict[Cell, Cell | None] = {}
    q: deque[tuple[int, Cell]] = deque()
    for s in sorted(sources, key=lambda c: (c[1], c[0])):
        dist[s], prev[s] = 0, None
        q.append((0, s))
    end = None
    while q:
        d, c = q.popleft()
        if d != dist[c]:
            continue
        if c in targets:
            end = c
            break
        for dx, dy in DIRS:
            n = (c[0] + dx, c[1] + dy)
            if not inside(*n):
                continue
            w = 1 if n in cells else 0 if free(world[n[1]][n[0]]) else None
            if w is None or dist.get(n, 1 << 30) <= d + w:
                continue
            dist[n], prev[n] = d + w, c
            if w:
                q.append((d + w, n))
            else:
                q.appendleft((d, n))
    path: list[Cell] = []
    while end is not None:
        if end in cells:
            path.append(end)
        end = prev[end]
    return path[::-1]


def translate(v, d: Cell):
    """A map-source value moved by d (the act-1 translation, D-W11): every int `x` / `y` key of a dict and every
    `[x0, y0, x1, y1]` of a `rects` list or `[x, y]` of an `ends` list, recursively. Relative values (`walk_cells`,
    `offset`, `parts`) and every other value are unchanged."""
    dx, dy = d
    if isinstance(v, dict):
        out = {}
        for k, val in v.items():
            if k in ("x", "y") and isinstance(val, int) and not isinstance(val, bool):
                out[k] = val + (dx if k == "x" else dy)
            elif k == "rects":
                out[k] = [[r[0] + dx, r[1] + dy, r[2] + dx, r[3] + dy] for r in val]
            elif k == "ends":
                out[k] = [[c[0] + dx, c[1] + dy] for c in val]
            else:
                out[k] = translate(val, d)
        return out
    if isinstance(v, list):
        return [translate(e, d) for e in v]
    return v


def chunk_files(map_id: str, chunks: Iterable[tuple[int, int]]) -> list[str]:
    """Repo-relative chunk PNG paths (build_map.write names them `<layer>_<row>_<col>.png`), row-major."""
    out = []
    for c, r in sorted(chunks, key=lambda cr: (cr[1], cr[0])):
        out += [f"assets/maps/ai/{map_id}/below_{r}_{c}.png", f"assets/maps/ai/{map_id}/above_{r}_{c}.png"]
    return out


def chunk_count() -> int:
    return (WORLD_W // CHUNK) * (WORLD_H // CHUNK)


def stub_region(region: str, band: set[Cell], **fields) -> RegionOut:
    """A region that is not built yet (D-W8, 2.9): ocean in its rects, nothing in its bands, `stub` set so the
    composer applies its PLACEHOLDER_WALLS. `fields` are extra RegionOut fields (a placeholder patch)."""
    b = bbox(BOXES[region])
    rows = ["".join(WATER if any(r.contains(x, y) for r in BOXES[region]) and (x, y) not in band else UNSET
                    for x in range(b.x0, b.x1 + 1)) for y in range(b.y0, b.y1 + 1)]
    return RegionOut(ground=rows, stub=True, **fields)
