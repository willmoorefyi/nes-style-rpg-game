"""Region FIRE of the world (docs/WORLD_PLAN.md 2.4, 4): the south-east continent: Crescent Lake, the rivers, the volcano, the ice cavern, the airship desert.

STUB (W1-C2): until FIR-O builds the region, it is ocean in its rects, and the composer fills its placeholder walls
(`world_api.PLACEHOLDER_WALLS`). FIR-O owns this file and replaces `build()` with the region's RegionOut.
"""
from __future__ import annotations

from world_api import Cell, RegionOut
from world_geom import stub_region


def build(band: set[Cell]) -> RegionOut:
    return stub_region("fire", band)
