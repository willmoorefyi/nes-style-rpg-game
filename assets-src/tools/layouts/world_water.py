"""Region WATER of the world (docs/WORLD_PLAN.md 2.4, 2.7, 4.6; WAT-O): Onrac's cold coast, the waterfall at the
head of Onrac's river and the caravan dunes. The Sea Shrine is entered from inside Onrac (WAT-T's dry dock).

Design note (4.0.4):
  Concept: a long frozen coast hung from a wall of northern peaks. A spill tarn in the peaks pours over a cliff as
    the falls; the river below runs south down a sheer gorge to the meadow by Onrac and out into Onrac's bay. The
    west is upland heath and a wind-combed dune field on the open coast, where the caravan pitches by an oasis.
  Distinct: a spill tarn in the peaks that feeds the falls; a sheer two-walled gorge with no bank to walk; a ring of
    basalt sea-stacks across the mouth of Onrac's bay; an oasis meadow with a caravan track in the dunes; an upland
    tarn wood on the heath.
  Topology: airship-only (no dock, 2.8). Landings: the meadow round Onrac (4 cells from its gate) and the oasis
    meadow (5 cells from the tent). The cave behind the falls stands on a 2-cell sand ledge that touches only rock,
    the falls and the river, so the canoe is the only way in (2.7, GT-25); the nearest grass, 4 cells off on the
    upland side of the gorge's west wall, is not joined to it on foot.

The pieces live in `layouts/water/`: `world_water_land.py` (ground), `world_water_sites.py` (icons, transitions, anchors,
inspect cells), `world_water_zones.py` (encounter zones). Onrac's icon, door and gate come from WAT-T's
`water/town_onrac_site.py`. WATER has no Aldi wall, no dock, no patch and no barrier.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "water"))
import world_water_land as world_land  # noqa: E402
import world_water_sites as world_sites  # noqa: E402
import world_water_zones as world_zones  # noqa: E402
from world_api import BOXES, UNSET, Cell, RegionOut  # noqa: E402
from world_geom import bbox  # noqa: E402

NOTES = ["water: the R-waterfall gorge (x 31-32, y 11-27) has no walkable bank; the ledge behind the falls is sand"]


def build(band: set[Cell]) -> RegionOut:
    b = bbox(BOXES["water"])
    g = world_land.ground(band)
    rows = ["".join(UNSET if (x, y) in band else g[x, y] for x in range(b.x0, b.x1 + 1))
            for y in range(b.y0, b.y1 + 1)]
    zones = world_zones.zones(g)
    backdrops = {z["id"]: world_zones.BACKDROPS[z["id"]] for z in zones}
    checks = {"river_check": True, "warp_leaves": True, "min_blob": {"mountain": 3, "sand": 3, "forest": 3}}
    return RegionOut(ground=rows, objects=world_sites.objects(g), inspect=world_sites.inspect(),
                     transitions=world_sites.transitions(), entrances=world_sites.entrances(), encounterZones=zones,
                     battleBackgrounds={"zones": backdrops}, notes=list(NOTES), checks=checks)
