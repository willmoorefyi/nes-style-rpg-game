"""Grid helpers for the overworld layout (layouts/overworld.py): walkability, flood fills, clearing and tidying."""
from __future__ import annotations

from collections import deque

import numpy as np

from common import Grid
from overworld_consts import ARRIVE, BOULDERS, BX, CX, CY, H, N_STUB, NORTH_SHORE, S_STUB, TOMB, TX, TY, W


def fill_unreachable(g: Grid, notes: list[str]) -> None:
    """Walkable cells that can be reached neither from the city nor from the north shore (a grass hole in a range)
    take the blocking ground around them (mountain before ocean); the compiler's no_unreachable_walkable agrees."""
    ok = walk_grid(g)
    seen = set(bfs(ok, ARRIVE["cornelia"])) | set(bfs(ok, NORTH_SHORE))
    for y in range(H):
        for x in range(W):
            if ok[y, x] and (x, y) not in seen and g[x, y] in ".fs":
                near = [g[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if g.inside(x + dx, y + dy)]
                g.set(x, y, "m" if "m" in near or "o" not in near else "o")
                notes.append(f"filled the unreachable cell ({x}, {y}) with {g[x, y]!r}")


def walk_grid(g: Grid) -> np.ndarray:
    """Walkable cells on foot, as the compiler will make them (icons blocked except their gates)."""
    ok = np.array([[g[x, y] not in "mor≈" for x in range(W)] for y in range(H)])
    for j in range(4):
        for i in range(5):
            ok[CY + j, CX + i] = False
    for j in range(2):
        for i in range(2):
            ok[TY + j, TX + i] = False
    ok[TOMB[1], TOMB[0]:TOMB[0] + 2] = False
    ok[TOMB[1] - 1:TOMB[1] + 1, [TOMB[0] - 1, TOMB[0] + 2]] = False       # the two columns
    for x, y in BOULDERS:
        ok[y, x] = False
    return ok


def bfs(ok: np.ndarray, start: tuple[int, int], blocked: set = frozenset()) -> dict[tuple[int, int], int]:
    dist = {start: 0}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if 0 <= n[0] < W and 0 <= n[1] < H and n not in dist and n not in blocked and ok[n[1], n[0]]:
                dist[n] = dist[(x, y)] + 1
                q.append(n)
    return dist


def clear_rect(g: Grid, x0: int, y0: int, x1: int, y1: int) -> None:
    g.rect(x0, y0, x1, y1, ".", only="fms")


def clear_disc(g: Grid, cx: float, cy: float, r: float, only: str = "fms") -> None:
    for y in range(H):
        for x in range(W):
            if np.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r:
                g.set(x, y, ".", only=only)


def near(g: Grid, x: int, y: int, chars: str, r: int) -> bool:
    return any(g.inside(x + dx, y + dy) and g[x + dx, y + dy] in chars
               for dy in range(-r, r + 1) for dx in range(-r, r + 1) if abs(dx) + abs(dy) <= r)


def extend_to_sea(g: Grid, start: tuple[int, int], width: int) -> None:
    """Carry a river on south (then south-west) from its last point until it meets the ocean."""
    x, y = start
    for _ in range(12):
        if any(g.inside(x + i, y + 1) and g[x + i, y + 1] == "o" for i in range(width)):
            return
        y += 1
        for i in range(width):
            g.set(x + i, y, "r", only=".fs")
    raise SystemExit(f"river from {start} never reaches the sea")


def components(mask: np.ndarray) -> list[list[tuple[int, int]]]:
    seen = np.zeros_like(mask, bool)
    out = []
    for y in range(H):
        for x in range(W):
            if mask[y, x] and not seen[y, x]:
                comp, q = [], deque([(x, y)])
                seen[y, x] = True
                while q:
                    cx, cy = q.popleft()
                    comp.append((cx, cy))
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < W and 0 <= ny < H and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            q.append((nx, ny))
                out.append(comp)
    return out


def tidy_land(land: np.ndarray) -> np.ndarray:
    """One landmass, no enclosed sea, and no ocean run shorter than 2 cells between land (1-cell inlets)."""
    for _ in range(8):
        comps = sorted(components(land), key=len, reverse=True)
        for cs in comps[1:]:
            for x, y in cs:
                land[y, x] = False
        for cs in components(~land):
            if not any(x in (0, W - 1) or y in (0, H - 1) for x, y in cs):
                for x, y in cs:
                    land[y, x] = True
        changed = False
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                if land[y, x]:
                    continue
                if (land[y, x - 1] and land[y, x + 1]) or (land[y - 1, x] and land[y + 1, x]):
                    land[y, x] = True
                    changed = True
        # land one cell wide between two waters reads as a stray spit: drop it
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                if land[y, x] and ((not land[y, x - 1] and not land[y, x + 1]) or (not land[y - 1, x] and not land[y + 1, x])):
                    if not (BX - 3 <= x <= BX + 3 and N_STUB - 3 <= y <= S_STUB + 3):
                        land[y, x] = False
                        changed = True
        if not changed:
            break
    return land


def tidy_blobs(g: Grid, notes: list[str]) -> None:
    """No mountain, forest or sand patch smaller than 4 cells (the compiler's min_blob asks for 3)."""
    for ch, fill in (("m", "."), ("f", "."), ("s", ".")):
        mask = np.array([[g[x, y] == ch for x in range(W)] for y in range(H)])
        for cs in components(mask):
            if len(cs) < 4:
                for x, y in cs:
                    g.set(x, y, fill)
                notes.append(f"dropped a {len(cs)}-cell {ch} patch at {cs[0]}")
