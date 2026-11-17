"""Region ELF of the world (docs/WORLD_PLAN.md 2.4-2.6, 4.2; ELF-O): Elfland, the Aldi Sea's south and west shore.

Concept: a broad forested continent whose north coast closes the Aldi, with a long moorland arm climbing north
between the Aldi and the western strait to the dwarves' grass seam.
Distinct: a moor arm with a broken tor ridge on its ocean side; a sheltered two-row harbour bay and a second cove on
the straight Aldi shore; a chain of tarns inside the fens; the Greyfells, a mountain spine along the south coast;
the east fells that wall the Aldi against seam_s.
Topology: one road from Elfheim's gate west along the Aldi shore and up the arm to the Western Keep, with a branch
south-west to the Marsh Cave in the fens; the arm's north end meets seam_n (on foot to the dwarves).

The ground comes from layouts/elf/world_land.py, the sites from layouts/elf/world_sites.py (Elfheim's icon, gate and
dock from ELF-T's town_elfheim_site.py), the zones from layouts/elf/world_zones.py. The region returns its part of
the Aldi wall W_arm (the arm and the north-coast rows), which replaces the composer's placeholder wall.
"""
from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from elf import world_land as LAND  # noqa: E402  (layouts/elf/ as a namespace package: no clash with other regions)
from elf import world_sites as SITES  # noqa: E402
from elf import world_zones as ZONES  # noqa: E402
from world_api import BOXES, SEAMS, UNSET, WATER, Cell, RegionOut  # noqa: E402
from world_geom import WALKABLE, bbox  # noqa: E402

ALDI_SEED = (63, 130)                     # a band cell on the arm's Aldi side (aldi water)
WALL_ROWS = 150                           # W_arm: the arm, its root and the north coast down to this row


def _in_box(x: int, y: int) -> bool:
    return any(r.contains(x, y) for r in BOXES["elf"])


def _flood(start: list[Cell], ok) -> set[Cell]:
    seen, q = set(start), deque(start)
    while q:
        x, y = q.popleft()
        for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if n not in seen and _in_box(*n) and ok(n):
                seen.add(n)
                q.append(n)
    return seen


def _ground(band: set[Cell]) -> dict[Cell, str]:
    g = LAND.paint(band)
    LAND.beaches(g, band)
    seam = {c for s in SEAMS.values() for c in s.rect.cells()}
    LAND.tidy(g, band, seam)
    g.update(SITES.clear_cells())
    # walkable cells the sites can't reach on foot (a pocket behind the tors or a tarn) become mountain
    blocked = SITES.blocked_cells()
    walk = lambda c: c not in blocked and (g.get(c, "") in WALKABLE or c in seam and c[1] >= 112)  # noqa: E731
    roots = [tuple(v) for v in SITES.entrances().values()]
    reached = _flood(roots, walk)
    for c, ch in g.items():
        if ch in WALKABLE and c not in reached and c not in blocked:
            g[c] = "m"
    return g


def build(band: set[Cell]) -> RegionOut:
    g = _ground(band)
    b = bbox(BOXES["elf"])
    rows = ["".join(g.get((x, y), UNSET) for x in range(b.x0, b.x1 + 1)) for y in range(b.y0, b.y1 + 1)]
    seam = {c for s in SEAMS.values() for c in s.rect.cells()}
    water = lambda c: c not in seam and (g.get(c) == WATER or c in band)  # noqa: E731
    wet = {(x, y) for y in range(b.y0, b.y1 + 1) for x in range(b.x0, b.x1 + 1) if _in_box(x, y) and water((x, y))}
    aldi = _flood([ALDI_SEED], water)
    fen = {c for c, ch in g.items() if ch == "w" or (ch in ".,f" and 31 <= c[0] <= 68 and 154 <= c[1] <= 177
                                                       and any(g.get((c[0] + dx, c[1] + dy)) == "w"
                                                               for dx in (-1, 0, 1) for dy in (-1, 0, 1)))}
    wall = {c for c, ch in g.items() if ch != WATER and (c[1] <= WALL_ROWS)}
    return RegionOut(
        ground=rows, objects=SITES.objects(), inspect=SITES.inspect(), transitions=SITES.transitions(),
        entrances=SITES.entrances(), docks=SITES.docks(), encounterZones=ZONES.zones(fen, aldi, wet - aldi),
        battleBackgrounds={"zones": ZONES.BACKDROPS},
        checks={"road_check": {"materials": ["dirt"], "check_under": True}, "warp_leaves": True,
                "min_blob": {"mountain": 3, "forest": 3, "sand": 3, "swamp": 3, "ocean_inlet": 2},
                "reach_roots": list(SITES.entrances())},
        walls={"W_arm": wall})
