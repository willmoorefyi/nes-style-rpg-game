"""WATER's continent spec (docs/NATURAL_WORLD_PLAN.md 2.3; NW-0's pilot, preset B; NW-R WATER tunes it).

Onrac's continent: a big cold continent in the north-west with a central north-south ridge, the waterfall's river
(the pinned canoe route R-waterfall) down to Onrac's bay, the Sea Shrine bay on the east coast, the caravan desert in
the west lee of the ridge, snow and tundra in the north, the Sunken isles south of it (the second archipelago, for the
look). Dockless: airship only.
"""
from __future__ import annotations

from worldgen.bundle import ClimateHint, Continent, IsleField, RegionSpec, Ridge, SeaDisc, SpotDef

from .common import sites

ONRAC = ((-110, -128), (-98, -136), (-84, -138), (-70, -132), (-62, -122), (-62, -110), (-66, -100), (-68, -94),
         (-71, -90), (-73, -82), (-80, -73), (-92, -70), (-104, -74), (-114, -80), (-122, -92), (-124, -106),
         (-120, -120))


def spec() -> RegionSpec:
    return RegionSpec(
        region="water",
        continents=[Continent("onrac", "water", ONRAC, fjord=1.6)],
        ridges=[Ridge(((-90, -132), (-88, -116), (-86, -100), (-89, -84)), 1.1, 3.8, "Onrac's spine"),
                Ridge(((-114, -96), (-106, -84)), 0.6, 2.5, "the caravan's hills")],
        sea_discs=[SeaDisc((-66, -83), 4.5)],
        routes={"R-waterfall": ((-76, -118), (-75, -110), (-74, -100), (-72, -92), (-69, -86))},
        isles=[IsleField((-98, -46), 16, 9, 105)],
        climate=[ClimateHint("arid", (-103, -100), 16)],
        sites=sites("water"),
        towns=("wat_onrac",),
        spots=[SpotDef("wat_s_onrac", "wat_onrac", (0, 0), "land"),
               SpotDef("wat_s_onrac_airship", "wat_onrac", (-2, 0), "landing"),
               SpotDef("wat_s_caravan_airship", "wat_caravan", (4, 2), "landing")],
        north=("wat_onrac", "wat_waterfall", "wat_caravan"),
        ledges=("wat_waterfall",),           # NW-4: the cave mouth is a ledge on R-waterfall, reached by canoe only
    )
