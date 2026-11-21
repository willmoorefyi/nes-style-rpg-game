"""Stage `stamps` (docs/NATURAL_WORLD_PLAN.md 3.1, 2.4 rule 7, 0.1.1's footprint rule): the sites, lakes, pinned
routes, the canal, the docks and their coves, and the exemption list.

- A site (outside act 1, whose cells are kept from today's world) gets a grass clearing of 1.6 cells, its entrance
  and door cells grass; a town's 3x3 footprint round its door is exempt, any other site's door cell.
- The lakes and the pinned canoe routes are stamped (`≈`, `r`); the canal's patch cells are grass (Water when
  CANAL_OPEN) and exempt.
- A canoe-only site (`RegionSpec.ledges`, the waterfall; 4.1) is a ledge: its entrance and door cells sand, joined
  to its nearest pinned route cell by river, and every other cell within LEDGE_R rock, so the ledge touches only
  rock and river (NW-4; today's world draws it so); a grass cell on the route's bank within 8 steps when no
  grass is that near (the airship's landing).
- A dock's cell is Water with one grass cell toward its town; its cove opens the water away from the town (at most 8
  cells) until the basin's forced sea. Every dock cell is exempt.
"""
from __future__ import annotations

import numpy as np

from . import spec as S
from .bundle import RegionSpec
from .geom import disc

CLEAR_R = 1.6                                # a site's grass clearing
LEDGE_R = 2                                  # a ledge's rock ring (Chebyshev cells round its entrance)
LANDING_STEPS = 8                            # ... and an airship landing within this many grid steps of it
COVE_MAX = 8


def sites(g: np.ndarray, exempt: np.ndarray, b: RegionSpec, doors: dict, skip: tuple[str, ...]) -> None:
    for e, (x, y) in b.sites.items():
        if e in skip:
            continue
        dx, dy = doors.get(e, (0, -1))
        for q in np.argwhere(disc(x, y, CLEAR_R)):
            if g[q[0], q[1]] not in ",:=":
                g[q[0], q[1]] = "."
        g[y, x] = "."
        g[y + dy, x + dx] = "."
        if e in b.towns:
            exempt[y + dy - 1:y + dy + 2, x + dx - 1:x + dx + 2] = True
        else:
            exempt[y + dy, x + dx] = True


def lakes_routes(g: np.ndarray, b: RegionSpec, routes: dict) -> None:
    for lk in b.lakes:
        g[disc(*S.poly([lk.centre])[0], lk.radius)] = "≈"
    for cells in routes.values():
        for x, y in cells:
            if g[y, x] != "≈":
                g[y, x] = "r"


def ledges(g: np.ndarray, b: RegionSpec, routes: dict, doors: dict) -> None:
    on_route = {c for cells in routes.values() for c in cells}
    for e in b.ledges:
        x, y = b.sites[e]
        dx, dy = doors.get(e, (0, -1))
        rx, ry = min(on_route, key=lambda c: (abs(c[0] - x) + abs(c[1] - y), c[1], c[0]))
        for yy in range(y - LEDGE_R, y + LEDGE_R + 1):
            for xx in range(x - LEDGE_R, x + LEDGE_R + 1):
                if (xx, yy) not in on_route:
                    g[yy, xx] = "m"
        cx, cy = x, y                        # the ledge to the route: river, x first then y
        while (cx, cy) != (rx, ry):
            cx, cy = (cx + int(np.sign(rx - cx)), cy) if cx != rx else (cx, cy + int(np.sign(ry - cy)))
            g[cy, cx] = "r"
        g[y, x] = g[y + dy, x + dx] = "s"     # sand: walkable, and never an airship landing
        _landing_by(g, x, y, on_route)


def _landing_by(g: np.ndarray, x: int, y: int, on_route: set) -> None:
    """A ledge needs an airship landing within LANDING_STEPS grid steps (the verifier's T6 rule): when no grass cell
    is there, the nearest snow, sand or taiga cell on its route's bank outside the rock ring becomes grass (a bank
    clearing; the airship lands on grass only, NW2 D-NW2-4)."""
    near = [(abs(xx - x) + abs(yy - y), yy, xx) for yy in range(y - LANDING_STEPS, y + LANDING_STEPS + 1)
            for xx in range(x - LANDING_STEPS, x + LANDING_STEPS + 1)
            if abs(xx - x) + abs(yy - y) <= LANDING_STEPS and max(abs(xx - x), abs(yy - y)) > LEDGE_R]
    if any(g[yy, xx] == "." for _d, yy, xx in near):
        return
    bank = [c for c in sorted(near) if g[c[1], c[2]] in "nst"
            and any((c[2] + ax, c[1] + ay) in on_route for ax, ay in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    if bank:
        g[bank[0][1], bank[0][2]] = "."


def canal_cells(b: RegionSpec) -> list[tuple[int, int]]:
    """The canal patch cells (world), from the spec's rel rows and x range."""
    if not b.canal:
        return []
    rows, (x0, x1) = b.canal
    return [S.world((x, y)) for y in rows for x in range(x0, x1 + 1)]


def docks(g: np.ndarray, exempt: np.ndarray, b: RegionSpec, hard: np.ndarray, keep: np.ndarray) -> list[dict]:
    out = []
    for d in b.docks:
        x, y = S.world(d.at)
        if d.cove:
            g[y, x] = "o"
            tx, ty = b.sites[d.town]
            sx, sy = int(np.sign(tx - x)), int(np.sign(ty - y))
            nx, ny = (x + sx, y) if abs(tx - x) >= abs(ty - y) else (x, y + sy)
            g[ny, nx] = "."
            ddx, ddy = (-sx, 0) if abs(tx - x) >= abs(ty - y) else (0, -sy)
            cx, cy = x + ddx, y + ddy
            for _ in range(COVE_MAX):
                if hard[cy, cx] and g[cy, cx] == "o":
                    break
                if not keep[cy, cx]:
                    g[cy, cx] = "o"
                cx, cy = cx + ddx, cy + ddy
        exempt[y, x] = True
        out.append({"id": d.id, "x": int(x), "y": int(y), "basin": d.basin})
    return out
