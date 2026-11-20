"""ORDEAL's continent spec (docs/NATURAL_WORLD_PLAN.md 2.3; NW-0's pilot, preset B; NW-R ORDEAL tunes it).

The Citadel: a crescent island arc in the north centre with a high spine; Cardia an archipelago round Bahamut's isle
(owned by ORDEAL); the hermit's and the other site islets; a small group south of the arc. Dockless: airship only.
The north sea (forced open water between the north continents and the south) is listed here.
"""
from __future__ import annotations

from worldgen.bundle import Continent, IsleField, RegionSpec, Ridge, SeaLine, SpotDef

from .common import sites

CITADEL = ((-46, -84), (-44, -98), (-36, -112), (-22, -122), (-6, -126), (10, -122), (16, -114), (6, -110), (-8, -112),
           (-14, -104), (-16, -96), (-22, -86), (-34, -80))
NORTH_SEA = ((-140, -60), (-100, -61), (-60, -59), (-20, -60), (20, -60), (60, -58), (110, -59))
EXTRA = {"ord_meadow": (-21, -95), "ord_isle_hermit": (0, -82), "ord_isle_north": (11, -86),
         "ord_isle_east": (27, -66), "ord_isle_stack": (20, -79), "ord_isle_west": (-2, -64)}
ISLE_R, ISLE_K = 2.8, 2.0                    # a site islet: radius, wobble (x coast noise)
BAHAMUT_R, BAHAMUT_K = 4.2, 3.0


def spec() -> RegionSpec:
    return RegionSpec(
        region="ordeal",
        continents=[Continent("citadel", "ordeal", CITADEL, fjord=1.2)],
        ridges=[Ridge(((-42, -92), (-36, -106), (-20, -118), (-2, -121), (8, -118)), 1.05, 3.0, "the arc's spine")],
        sea_lines=[SeaLine(NORTH_SEA, 3.2)],
        isles=[IsleField((10, -73), 13, 7, 101, owner="ordeal"), IsleField((-40, -64), 7, 3, 109)],
        isle_sites={**{e: (ISLE_R, ISLE_K) for e in EXTRA if e.startswith("ord_isle")},
                    "ord_bahamut": (BAHAMUT_R, BAHAMUT_K)},
        sites=sites("ordeal", extra=EXTRA),
        spots=[SpotDef("ord_s_citadel", "ord_meadow", (0, -1), "land"),
               SpotDef("ord_s_citadel_airship", "ord_meadow", (0, 0), "landing"),
               SpotDef("ord_s_bahamut_airship", "ord_bahamut", (0, 2), "landing")],
        north=("ord_citadel", "ord_bahamut"),
    )
