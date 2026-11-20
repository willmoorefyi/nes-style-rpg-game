"""Act 1's content on the NW world beyond its kept pins (docs/NATURAL_WORLD_PLAN.md 3.6.4, 3.8 `coverage`; NW-RINT).

NW-3 left two things of act 1 for later; the integrator adds them here, through the composer's one content hook
(`world_specs/a1.content` -> `world_content.merge`):

- **The zones (3.6.4).** Today's ids and tables, unchanged (`overworld_zones.py`, `a1/world_a1_zones.py`), their
  cells from today's rules on the NW ground and the owner grid:
  - the fields: the map default (`encounters`: FIELDS, `encounterRate`, the default battle backdrops), as today; it
    holds the peninsula: every walkable or canoe cell Cornelia reaches with the bridge patch off, less the two zones;
  - `east_pocket`: what TOMB_END reaches with the east footbridge shut;
  - `temple_approach`: with the footbridge shut, the cells strictly nearer on foot to the temple than to the nearest
    of Cornelia's four gates; each forest component joins it whole when at least half of it is in, else leaves whole;
  - `a1_mainland`: every A1-owned walkable cell the north shore reaches on foot with the bridge off, plus the A1
    River and Lake cells of its walk+canoe component (today's mainland rivers fell to the fields' table; the canoe
    reaches them only from the mainland, so they take its roster);
  - `a1_aldi` / `a1_north_sea` (ship): the A1-owned Water cells in the Aldi basin (patches off) / the rest.
  `fallback` tells the coverage check which A1 cells the map default holds (the peninsula).
- **Pravoka's lighthouse.** Today's icon (LM4 art, `lighthouse` 2x3) stood on the range strip across the fjord from
  Pravoka, at rel (46, -13). On the NW world the channel is 2 cells wider and that cell is Water, so it stands on the
  range's west face across the channel from Pravoka's icon, 2 cells further east and 2 rows higher, on rock.
"""
from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from a1 import world_a1_pins as P  # noqa: E402
from a1.world_a1_zones import ALDI, MAINLAND, NORTH_SEA  # noqa: E402
from overworld_zones import EAST_POCKET, FIELDS, TEMPLE_APPROACH, ZONE_BACKDROPS, row_rects  # noqa: E402
from worldgen import gates  # noqa: E402
from worldgen import spec as S  # noqa: E402
from worldgen.geom import components, flood  # noqa: E402

LIGHTHOUSE = (194, 140)              # world cell of the icon's top-left (its 2x3 cells all rock, Water to the west)
# today's map-level tables of act 1 (world_a1.py): the encounter rate and the backdrops of the fields
ENCOUNTER_RATE = {"min": 10, "max": 22}
DEFAULT_BACKDROPS = {"default": "grassland", "terrain": {"forest": "forest", "desert": "shoreline", "swamp": "swamp",
                                                         "water": "ocean", "river": "river"}}
D4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def _w(c) -> tuple[int, int]:
    return tuple(int(v) for v in S.world(c))


def _dist(ok: np.ndarray, start, shut: set) -> dict:
    """BFS steps on `ok` from `start`, never through `shut`."""
    out, q = {start: 0}, deque([start])
    h, w = ok.shape
    while q:
        x, y = q.popleft()
        for dx, dy in D4:
            n = (x + dx, y + dy)
            if 0 <= n[0] < w and 0 <= n[1] < h and n not in out and n not in shut and ok[n[1], n[0]]:
                out[n] = out[(x, y)] + 1
                q.append(n)
    return out


def walk_grid(g: np.ndarray) -> np.ndarray:
    """On foot with the patches off, the city's and the temple's icons, the tomb and the boulders blocked (as pass W's
    `overworld_grid.walk_grid`; NW-5 added the boulders, so no zone holds a boulder's cell)."""
    ok = gates.walk(g)
    for c in P.CITY_ICON + P.TEMPLE_ICON + P.BOULDERS:
        x, y = _w(c)
        ok[y, x] = False
    tx, ty = _w(P.TOMB)
    ok[ty, tx:tx + 2] = False
    ok[ty - 1:ty + 1, [tx - 1, tx + 2]] = False
    return ok


def _mask(shape, cells) -> np.ndarray:
    m = np.zeros(shape, bool)
    for x, y in cells:
        m[y, x] = True
    return m


def zones(g: np.ndarray, meta: dict) -> tuple[list[dict], np.ndarray]:
    """(act 1's zones, the fields' cells: the map default's area)."""
    ok, mine = walk_grid(g), meta["region"] == meta["regions"].index("a1")
    shut = {_w(c) for c in P.FOOTBRIDGE}
    ent = {e: tuple(meta["entrances"][e]) for e in ("cornelia", "cornelia_west", "cornelia_east", "cornelia_north",
                                                     "temple", "north_shore")}
    pocket = set(_dist(ok, _w(P.TOMB_END), shut))
    to_temple = _dist(ok, ent["temple"], shut)
    to_city: dict = {}
    for gate in ("cornelia", "cornelia_west", "cornelia_east", "cornelia_north"):
        for p, d in _dist(ok, ent[gate], shut).items():
            to_city[p] = min(d, to_city.get(p, d))
    approach = {p for p, d in to_temple.items() if d < to_city.get(p, float("inf"))}
    forest = _mask(g.shape, [p for p in set(to_temple) | set(to_city) if g[p[1], p[0]] == "f"])
    lab, _n = components(forest)
    for k in range(1, int(lab.max()) + 1):
        comp = {(int(x), int(y)) for y, x in np.argwhere(lab == k)}
        approach = approach | comp if 2 * len(comp & approach) >= len(comp) else approach - comp
    assert not pocket & approach and not pocket & set(to_city), "the east pocket is cut off by the east footbridge"
    river = np.isin(g, ["r", "≈"])
    need = (gates.walk(g) | river) & mine
    peninsula = flood(need, [ent["cornelia"]])            # the icons' cells included (they roll nothing)
    land = flood(ok & mine, [ent["north_shore"]])
    wet = river & flood((ok | river) & mine, [ent["north_shore"]]) & ~peninsula
    zoned = _mask(g.shape, pocket | approach)
    # the fields: the peninsula, and (as today, where any act-1 cell outside a zone rolled the map default) the A1
    # cells neither Cornelia nor the north shore reaches: the islands kept for the look and the pockets in the hills
    fields = (peninsula | (need & ~land & ~wet)) & ~zoned
    sea = (g == "o") & mine
    aldi = sea & flood(g == "o", [tuple(meta["seeds"]["aldi"])])

    def rects(m: np.ndarray) -> list:
        return row_rects({(int(x), int(y)) for y, x in np.argwhere(m)})
    return [{"id": "east_pocket", "rects": rects(_mask(g.shape, pocket)), "encounters": EAST_POCKET},
            {"id": "temple_approach", "rects": rects(_mask(g.shape, approach)), "encounters": TEMPLE_APPROACH},
            {"id": "a1_mainland", "name": "Northern Mainland", "rects": rects(land | wet), "encounters": MAINLAND},
            {"id": "a1_aldi", "name": "Aldi Sea", "modes": ["ship"], "rects": rects(aldi), "encounters": ALDI},
            {"id": "a1_north_sea", "name": "Northern Sea", "modes": ["ship"], "rects": rects(sea & ~aldi),
             "encounters": NORTH_SEA}], fields


def lighthouse(g: np.ndarray) -> dict:
    o = dict(next(o for o in P.OBJECTS if o.get("name") == "lighthouse"))
    x, y = LIGHTHOUSE
    w, h = max(len(r) for r in o["parts"]), len(o["parts"])
    assert all(g[y + j, x + i] == "m" for j in range(h) for i in range(w)), "the lighthouse's rock"
    assert all(g[y + j, x - 1] == "o" for j in range(h)), "the lighthouse stands on the coast"
    return {**o, "x": x, "y": y}


def content(g: np.ndarray, meta: dict) -> dict:
    zs, fields = zones(g, meta)
    return {"objects": [lighthouse(g)], "encounterZones": zs, "backdrops": dict(ZONE_BACKDROPS),
            "fallback": row_rects({(int(x), int(y)) for y, x in np.argwhere(fields)}),
            "map": {"encounterRate": dict(ENCOUNTER_RATE), "encounters": FIELDS,
                    "battleBackgrounds": dict(DEFAULT_BACKDROPS)}}
