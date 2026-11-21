"""A1's continent spec (docs/NATURAL_WORLD_PLAN.md 2.3, 3.6; NW-0's pilot, preset B; NW-3).

Cornelia's continent: an east-west mainland with a ragged north coast; the peninsula hanging south-west into the Aldi
(today's outline as the template); the spine (barrier `spine`, the bridge its only cut); the mainland ridges;
Pravoka's range (wall W_east) with spurs; the outer fjord east of it; the Aldi's open water and two islets;
Cornelia's mild open fields. Every act-1 pin comes from `a1/world_a1_pins.py` (derived by NW-3 from pass W's
world; the source since NW-5), Cornelia-relative: its world cell is CORNELIA_NW + rel. The spec's own lines below are
Cornelia-relative too.

The roads (2.4 rule 8, 3.10's stub fix) are today's network, routed through its points: every gate road starts on
its gate's warp cell, the ring joins the gates, and the east road crosses the footbridge onto the tomb road, so no
road ends one cell off a gate (`a1/world_a1_checks.stubs`).
"""
from __future__ import annotations

import numpy as np

from a1 import world_a1_pins as P
from world_api import CORNELIA_NW, WORLD_W

from worldgen import spec as S
from worldgen.bundle import (Barrier, ClimateHint, Continent, Corridor, Dock, InlandSea, IsleField, RegionSpec, Ridge,
                             Road, SeaLine, SpotDef, Template, WallLine)

EXT_A1 = ((-25, -34), (-26, -40), (-28, -47), (-28, -50), (-20, -47), (-12, -52), (-2, -50), (6, -54),
          (14, -50), (22, -53), (30, -47), (38, -49), (45, -45), (49, -41), (47, -34), (30, -31), (0, -31),
          (-26, -31))
# NW2-E (docs/NW2_EDITS_PLAN.md 5): the mainland east of the Duergar range, a fjord-free field beside EARTH's lobe so
# the owner line follows the range's crest (EXT_A1's fjord warp folds there, so it is trimmed east of the crest)
DUERGAR_EAST = ((-32, -47), (-22, -47), (-22, -32), (-29, -30), (-32, -32))
W_EAST = ((48, -42), (51, -36), (48.5, -30), (51, -24), (48.5, -18), (51.5, -12), (49, -6), (51.5, 0), (49, 6),
          (51.5, 12), (49, 18), (50.5, 24), (45, 30), (34, 35), (24, 36))
RIDGES = (
    Ridge(((-36, -44), (-24, -46), (-12, -44)), 0.8, 2.6, "mainland north-west downs"),
    Ridge(((8, -48), (20, -47), (30, -42), (38, -40)), 0.85, 2.8, "mainland north-east ridge"),
    Ridge(((50, -30), (54, -28)), 0.8, 1.6, "W_east spur"),
    Ridge(((51, -6), (54.5, -3)), 0.8, 1.6, "W_east spur"),
    Ridge(((50, 18), (54, 20)), 0.8, 1.6, "W_east spur"),
)
OUTER_FJORD = SeaLine(((56.5, -52), (56.5, -30), (56, -10), (56.5, 10), (56, 27)), 2.8, fjord=True, keep_wall="W_east")
ALDI = ((-42, -26), (-30, -28), (-27, -22), (-27, -12), (-26, 0), (-20, 12), (0, 12), (16, 8), (20, -2), (32, -4),
        (36, -16), (39, -20), (46, -20), (46, 30), (36, 31), (22, 32), (8, 31), (-6, 30), (-8, 34), (-15, 34),
        (-18, 30), (-30, 25), (-38, 19), (-43, 10), (-43, 0), (-43, -14))
# 2.4 rule 4b: the walks of S0-S3 (Cornelia -> the bridge, the temple; the north shore -> Pravoka, Matoya)
CORRIDORS = (
    Corridor("a1_bridge", ("cornelia", P.BRIDGE_FOOT)),
    Corridor("a1_temple", ("cornelia", (-6, -5), "temple")),
    Corridor("a1_pravoka", ("north_shore", (9, -22), (24, -23), (32, -18), (34, -14), "a1_pravoka")),
    Corridor("a1_matoya", ("north_shore", (-4, -25), (-12, -31), "a1_matoya")),
)


def at(p) -> tuple:
    """A Cornelia-relative point -> its unrounded world point (fractional lines)."""
    return (CORNELIA_NW[0] + p[0], CORNELIA_NW[1] + p[1])


def grids(n: int = WORLD_W) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """(land, keep, keepch) world rasters from the pins' template grid."""
    land, keep, keepch = np.zeros((n, n), bool), np.zeros((n, n), bool), np.full((n, n), "o")
    ox, oy = S.world(P.TEMPLATE_AT)
    for j, row in enumerate(P.TEMPLATE):
        for i, c in enumerate(row):
            x, y = ox + i, oy + j
            land[y, x] = c not in " o"
            if c not in " #":
                keep[y, x], keepch[y, x] = True, c
    return land, keep, keepch


def template() -> Template:
    land, keep, keepch = grids()
    x0, y0, x1, y1 = P.CHANNEL
    return Template(
        land=land, keep=keep, keepch=keepch, sound=tuple(at(q) for q in P.SOUND_LINE),
        channel=(*S.world((x0, y0)), *S.world((x1, y1))), channel_wall="W_east", warp=0.25,
        road_keep=((0, 0), 0.0),                          # no road of today is kept: all are routed
        icons=tuple(S.world(q) for q in P.CITY_ICON + P.PRAVOKA_ICON + P.TEMPLE_ICON),
        exempt=tuple(S.world(q) for q in P.BRIDGE_PATCH + P.FOOTBRIDGE + P.JETTY),
        bridge=tuple(S.world(q) for q in P.BRIDGE_PATCH), seed_cell=S.world(P.ALDI_SEED))


def spots() -> list[SpotDef]:
    """Act 1's spots (absolute world cells)."""
    return [SpotDef(k, "", S.world(v["at"]), v["kind"]) for k, v in P.SPOTS.items()]


def spec() -> RegionSpec:
    return RegionSpec(
        region="a1",
        continents=[Continent("a1_ext", "a1", EXT_A1, fjord=1.0), Continent("a1_duergar_east", "a1", DUERGAR_EAST)],
        ridges=list(RIDGES),
        barriers=[Barrier("spine", tuple(P.SPINE), base=1.6, rn=0.8, warped=False)],
        walls=[WallLine("W_east", W_EAST, wobble=0.5)],
        sea_lines=[OUTER_FJORD],
        inland_seas=[InlandSea("aldi", ALDI)],
        isles=[IsleField((-36, 2), 3, 1, 102), IsleField((-6, 23), 3, 1, 103)],
        climate=[ClimateHint("mild", (2, -6), 26)],
        sites={e: S.world(c) for e, c in P.ENTRANCES.items()},
        towns=("cornelia", "a1_pravoka"),
        docks=[Dock("a1_pravoka", P.PRAVOKA_DOCK, "aldi", "a1_pravoka", cove=False)],
        corridors=list(CORRIDORS),
        roads=[Road(f"a1_road_{i}", tuple(r)) for i, r in enumerate(P.ROADS)],
        spots=spots(),
        template=template(),
        barrier_seeds={"spine": ("cornelia", ("a1_pravoka",), True, True)},
    )


def content(g, meta, _ctx=None) -> dict:
    """Act 1's content beyond its kept pins (NW-RINT: its zones, the map default, Pravoka's lighthouse):
    `a1/world_a1_nw.py`, for `world_content.merge`."""
    from a1 import world_a1_nw
    return world_a1_nw.content(g, meta)
