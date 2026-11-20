"""WIND's continent spec (docs/NATURAL_WORLD_PLAN.md 2.3; NW-0's pilot, preset B; NW-R WIND tunes it).

Gaia's continent: a big north-east continent with a long southern tail; ranges ring the interior Mirage desert; Gaia's
hills in the north-east; Lufenia's mesa cliffed at the end of the tail; a few islets off the north-east. Dockless:
airship only (`wnd_s_ship` is the ship parked in the open ocean east of the tail).
"""
from __future__ import annotations

from worldgen.bundle import ClimateHint, Continent, IsleField, RegionSpec, Ridge, SpotDef

from .common import sites

GAIA = ((20, -102), (22, -114), (32, -124), (46, -130), (62, -134), (76, -130), (86, -120), (88, -106), (82, -96),
        (84, -86), (82, -74), (76, -67), (68, -69), (66, -80), (70, -90), (62, -94), (52, -86), (40, -80), (28, -82),
        (20, -90))


def spec() -> RegionSpec:
    return RegionSpec(
        region="wind",
        continents=[Continent("gaia", "wind", GAIA, fjord=1.4)],
        ridges=[Ridge(((26, -96), (30, -112), (46, -124), (64, -126), (80, -114), (82, -100)), 1.0, 3.6,
                      "Gaia's north ring"),
                Ridge(((42, -86), (56, -92), (66, -100)), 0.9, 3.0, "the Mirage's south ring"),
                Ridge(((78, -92), (78, -78)), 0.9, 2.4, "Lufenia's mesa cliffs")],
        isles=[IsleField((98, -126), 7, 3, 108)],
        climate=[ClimateHint("arid", (40, -100), 18)],
        sites=sites("wind"),
        towns=("wnd_gaia", "wnd_lufenia"),
        spots=[SpotDef("wnd_s_gaia", "wnd_gaia", (0, 0), "land"),
               SpotDef("wnd_s_gaia_airship", "wnd_gaia", (2, 2), "landing"),
               SpotDef("wnd_s_sky_airship", "wnd_mirage", (3, 1), "landing"),
               SpotDef("wnd_s_mirage_airship", "wnd_mirage", (4, 1), "landing"),
               SpotDef("wnd_s_lufenia_airship", "wnd_lufenia", (3, 2), "landing"),
               SpotDef("wnd_s_ship", "wnd_lufenia", (20, 16), "dock")],
        north=("wnd_gaia", "wnd_mirage", "wnd_lufenia"),
    )
