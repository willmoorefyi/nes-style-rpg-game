"""FIRE's continent spec (docs/NATURAL_WORLD_PLAN.md 2.3; NW-0's pilot, preset B; NW-R FIRE tunes it).

The south-east continent: joined to Pravoka's range by a rock neck (wall W_south toward Elfland's fells), a long east
coast, the volcanic arc (Gurgu's cone; Crescent's caldera ring, barrier `crescent_ring`, closed on foot only),
Crescent Lake in the caldera with the pinned canoe routes R-volcano and R-ice down the outer slope, the north hills,
the Lykion desert in the south-east lee, an island group off the east coast. Crescent's harbour (`fir_crescent`)
is on the outer fjord.
"""
from __future__ import annotations

from worldgen.bundle import (Barrier, ClimateHint, Cone, Continent, Corridor, Dock, IsleField, Lake, RegionSpec,
                             Ridge, SpotDef, WallLine)

from .common import sites

SOUTHEAST = ((60, -40), (65, -44), (71, -40), (77, -30), (81, -16), (80, -2), (83, 12), (85, 26), (83, 40), (80, 54),
             (72, 64), (60, 69), (46, 68), (34, 64), (24, 58), (18, 48), (19, 40), (26, 35), (40, 33), (52, 30),
             (59, 24), (60, 10), (61, -8), (60, -24))
CRESCENT_RING = ((45, 29), (52, 31), (58, 32), (64, 32.5), (71, 32), (76, 27), (79, 18), (84, 10), (92, 6))
ROUTES = {
    "R-ice": ((64, 26), (61, 31), (55, 34.5), (48, 33.5), (42, 36.5), (40, 38)),
    "R-volcano": ((70, 26), (72, 33), (68, 44), (58, 56), (44, 58), (34, 52), (32, 50)),
}
DOCK = (58, 17)


def spec() -> RegionSpec:
    return RegionSpec(
        region="fire",
        continents=[Continent("southeast", "fire", SOUTHEAST, fjord=1.0)],
        ridges=[Ridge(((62, -30), (70, -18), (74, -4)), 0.8, 3.0, "the north hills"),
                Ridge(((64, 46), (72, 56)), 0.6, 2.4, "the south hills")],
        barriers=[Barrier("crescent_ring", CRESCENT_RING)],
        walls=[WallLine("W_south", ((12, 39), (18, 35.5), (24, 37.5)))],
        cones=[Cone((28, 46), 1.25, 4.5)],
        lakes=[Lake((67, 22), 5.0, "Crescent Lake")],
        routes=dict(ROUTES),
        isles=[IsleField((94, 30), 9, 4, 107)],
        climate=[ClimateHint("arid", (64, 56), 12), ClimateHint("arid", (48, 51), 8)],
        sites=sites("fire", nudges={"fir_crescent": (2, 0)}),
        towns=("fir_crescent",),
        docks=[Dock("fir_crescent", DOCK, "ocean", "fir_crescent")],
        corridors=[Corridor("fir_crescent", (DOCK, "fir_crescent"))],
        dock_links=("fir_crescent",),
        barrier_seeds={"crescent_ring": ("fir_crescent", ("fir_volcano", "fir_ice", "fir_desert"), False, False)},
        spots=[SpotDef("fir_s_crescent", "fir_crescent", (0, 0), "land"),
               SpotDef("fir_s_crescent_road", "dock:fir_crescent", (1, 0), "land"),
               SpotDef("fir_s_desert", "fir_desert", (0, 0), "land"),
               SpotDef("fir_s_hull", "fir_desert", (6, 3), "land"),
               SpotDef("fir_s_crescent_ship", "dock:fir_crescent", (0, 0), "dock"),
               SpotDef("fir_s_airship", "fir_desert", (6, 2), "landing")],
    )
