"""A1's continent spec (docs/NATURAL_WORLD_PLAN.md 2.3, 3.6; NW-0's pilot, preset B; NW-3 owns it from here).

Cornelia's continent: an east-west mainland with a ragged north coast; the peninsula hanging south-west into the Aldi
(today's outline as the template, `a1_today`); the spine (barrier `spine`, the bridge its only cut); the mainland
ridges; Pravoka's range (wall W_east) with spurs; the outer fjord east of it; the Aldi's open water and two islets;
Cornelia's mild open fields. Act 1's pins keep today's cells relative to Cornelia (`spec.a1_pin`).
"""
from __future__ import annotations

from world_api_v2 import A1_DELTA, CORNELIA_TODAY, WORLD_W

from worldgen.bundle import (Barrier, ClimateHint, Continent, Corridor, Dock, InlandSea, IsleField, RegionSpec, Ridge,
                             Road, SeaLine, SpotDef, Template, WallLine)

from . import a1_today as T


def rel(p):
    """Today's act-1 cell -> its Cornelia-relative point (world = CORNELIA_NW + rel = p + A1_DELTA)."""
    return (p[0] - CORNELIA_TODAY[0], p[1] - CORNELIA_TODAY[1])


def pin(p):
    """Today's act-1 point -> its world point (spec.a1_pin, for fractional points too)."""
    return (p[0] + A1_DELTA[0], p[1] + A1_DELTA[1])


EXT_A1 = ((-47, -29), (-47, -36), (-41, -41), (-36, -47), (-28, -50), (-20, -47), (-12, -52), (-2, -50), (6, -54),
          (14, -50), (22, -53), (30, -47), (38, -49), (45, -45), (49, -41), (47, -34), (30, -31), (0, -31),
          (-30, -31), (-42, -27))
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
    Corridor("a1_bridge", ("cornelia", rel(T.BRIDGE_FOOT))),
    Corridor("a1_temple", ("cornelia", rel((86, 106)), "temple")),
    Corridor("a1_pravoka", ("north_shore", rel((101, 89)), rel((116, 88)), rel((124, 93)), rel((126, 97)),
                            "a1_pravoka")),
    Corridor("a1_matoya", ("north_shore", rel((88, 86)), rel((80, 80)), "a1_matoya")),
)


def template() -> Template:
    ch = T.chars()
    n = WORLD_W
    x0, y0, x1, y1 = T.CHANNEL
    return Template(
        land=T.place(T.template_land(ch), False, A1_DELTA, n), keep=T.place(T.keep_mask(ch), False, A1_DELTA, n),
        keepch=T.place(ch, "o", A1_DELTA, n), sound=tuple(pin(q) for q in T.SOUND_LINE),
        channel=(*pin((x0, y0)), *pin((x1, y1))), channel_wall="W_east", warp=0.25,
        road_keep=(pin(T.ROAD_KEEP[0]), T.ROAD_KEEP[1]),
        icons=tuple(pin(q) for q in T.CITY_ICON + T.PRAVOKA_ICON + T.TEMPLE_ICON),
        exempt=tuple(pin(q) for q in T.BRIDGE_PATCH + T.FOOTBRIDGE + T.JETTY),
        bridge=tuple(pin(q) for q in T.BRIDGE_PATCH), seed_cell=pin(T.ALDI_SEED))


def spots() -> list[SpotDef]:
    """Act 1's spots: today's cells, pinned relative to Cornelia (absolute world cells)."""
    return [SpotDef(k, "", pin(tuple(v["at"])), v["kind"]) for k, v in T.spots().items() if k.startswith("a1_s_")]


def spec() -> RegionSpec:
    ents = T.entrances()
    return RegionSpec(
        region="a1",
        continents=[Continent("a1_ext", "a1", EXT_A1, fjord=1.0)],
        ridges=list(RIDGES),
        barriers=[Barrier("spine", tuple(rel(q) for q in T.SPINE), base=1.6, rn=0.8, warped=False)],
        walls=[WallLine("W_east", W_EAST, wobble=0.5)],
        sea_lines=[OUTER_FJORD],
        inland_seas=[InlandSea("aldi", ALDI)],
        isles=[IsleField((-36, 2), 3, 1, 102), IsleField((-6, 23), 3, 1, 103)],
        climate=[ClimateHint("mild", (2, -6), 26)],
        sites={e: pin(tuple(ents[e])) for e in ents if e in T.ENTRANCES},
        towns=("cornelia", "a1_pravoka"),
        docks=[Dock("a1_pravoka", rel(T.PRAVOKA_DOCK), "aldi", "a1_pravoka", cove=False)],
        corridors=list(CORRIDORS),
        roads=[Road(f"a1_road_{i}", tuple(rel(q) for q in r)) for i, r in enumerate(T.ROADS)],
        spots=spots(),
        template=template(),
        barrier_seeds={"spine": ("cornelia", ("a1_pravoka",), True, True)},
    )
