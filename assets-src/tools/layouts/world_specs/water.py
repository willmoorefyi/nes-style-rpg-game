"""WATER's continent spec and content (docs/NATURAL_WORLD_PLAN.md 2.3, 3.3, 3.5, 7; NW-0's pilot, preset B; NW-R WATER).

Design note (NW-R WATER; WAT-O's note of 4.0.4 carried to the generated world):
  Concept: a big cold continent in the north-west, hung from a central north-south ridge (Onrac's spine). Its north
    is a snowfield over tundra; the waterfall pours off the spine's east flank onto a rock ledge, and R-waterfall (the
    pinned canoe route) runs south down a valley of tundra to Onrac's meadow and out into Onrac's bay. West of the
    spine, in its lee, the caravan camps in an oasis meadow at the edge of a dune field; the south is cold forest
    and lakes; the Sunken isles (the second archipelago, for the look) lie south of it.
  Distinct: the falls on a rock ledge reached only by canoe; a ring of basalt sea-stacks across the mouth of Onrac's
    bay (with them WATER's coast index is 12.2, NW-0's lumpy 11.7; 3.10's target 12); the camp nudged (+2, +2) into
    the dunes, its clearing the oasis meadow; the snow and tundra north (D-NW9) with their own backdrops.
  Not tuned here (NW-R WATER's finding): a coast knob (`finger` 22, `fjord` 11: index 12.5) or a stronger arid hint
    at the camp (a 144-cell desert) changes 29 / 22 chunks outside WATER, since the westerly moisture sweep runs the
    whole row and the forest and sand thresholds are quantiles over all the land (12, Locality); that is over
    `--region`'s 160 painted chunks, so it waits for per-continent thresholds (the integrator's generator).
  Topology: airship-only (no dock, 2.8; `north`: its land joins only ORDEAL's and WIND's). Landings on grass: two
    cells west of Onrac's gate (S24's entry), in the oasis meadow by the camp, and the grass bank NW-4 put within 8
    steps of the ledge. The ledge (NW-4, `stamps.ledges`: kept) touches only rock and R-waterfall, so the cave is the
    canoe's (T6b, GT-25).

The content (icons, dressing, inspect cells, sea-stacks, zones, backdrops, the region's map checks) is placed on the
composed ground by `content`, from `water/world_water_nw.py` and `water/world_water_nw_zones.py`.
"""
from __future__ import annotations

from worldgen.bundle import ClimateHint, Continent, IsleField, RegionSpec, Ridge, SeaDisc, SpotDef

from .common import sites

ONRAC = ((-110, -128), (-98, -136), (-84, -138), (-70, -132), (-62, -122), (-62, -110), (-66, -100), (-68, -94),
         (-71, -90), (-73, -82), (-80, -73), (-92, -70), (-104, -74), (-114, -80), (-122, -92), (-124, -106),
         (-120, -120))
# the region's map checks on its raster (map_checks_region): every door leaves by one cell. Today's `river_check` and
# `min_blob` are not carried: the generated rivers rise in snow and tundra (the generator's hydrology; `routes`
# guards R-waterfall), the ledge is 2 sand cells by design (NW-4), and a raster's shared chunks hold other regions' cells
CHECKS = {"warp_leaves": True}


def spec() -> RegionSpec:
    from water import world_water_nw as NW
    return RegionSpec(
        region="water",
        continents=[Continent("onrac", "water", ONRAC, fjord=1.6)],
        ridges=[Ridge(((-90, -132), (-88, -116), (-86, -100), (-89, -84)), 1.1, 3.8, "Onrac's spine"),
                Ridge(((-114, -96), (-106, -84)), 0.6, 2.5, "the caravan's hills")],
        sea_discs=[SeaDisc((-66, -83), 4.5)],
        routes={"R-waterfall": ((-76, -118), (-75, -110), (-74, -100), (-72, -92), (-69, -86))},
        isles=[IsleField((-98, -46), 16, 9, 105)],
        climate=[ClimateHint("arid", (-103, -100), 16)],
        sites=sites("water", {"wat_caravan": (2, 2)}),   # the camp at the dunes' edge (inside the +-2 window)
        towns=("wat_onrac",),
        spots=[SpotDef("wat_s_onrac", "wat_onrac", (0, 0), "land"),
               SpotDef("wat_s_onrac_airship", "wat_onrac", NW.LANDING_OFF, "landing"),
               SpotDef("wat_s_caravan_airship", "wat_caravan", NW.CARAVAN_LANDING_OFF, "landing")],
        north=("wat_onrac", "wat_waterfall", "wat_caravan"),
        ledges=("wat_waterfall",),           # NW-4: the cave mouth is a ledge on R-waterfall, reached by canoe only
    )


def content(g, meta, _ctx=None) -> dict:
    """WATER's content on the composed ground (`world_content.merge`); stamps its own cells first."""
    from water import world_water_nw as NW
    from water import world_water_nw_zones as Z
    p = NW.Places(g, meta)
    p.ground()
    return {"objects": p.objects(), "inspect": p.inspect(), "encounterZones": Z.zones(g, p),
            "backdrops": Z.backdrops(), "checks": dict(CHECKS)}
