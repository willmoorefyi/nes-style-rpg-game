"""Region WATER of the world (docs/WORLD_PLAN.md 2.4, 4): Onrac's coast, the waterfall and the caravan dunes.

STUB (W1-C2): until WAT-O builds the region, it is ocean in its rects, and the composer fills its placeholder walls
(`world_api.PLACEHOLDER_WALLS`). WAT-O owns this file and replaces `build()` with the region's RegionOut.
"""
from __future__ import annotations

from world_api import Cell, RegionOut
from world_geom import stub_region


def build(band: set[Cell]) -> RegionOut:
    return stub_region("water", band)
