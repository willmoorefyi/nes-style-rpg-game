"""Region ORDEAL of the world (docs/WORLD_PLAN.md 2.4, 4): the Citadel plateau and the Cardia isles (Bahamut).

STUB (W1-C2): until ORD-O builds the region, it is ocean in its rects, and the composer fills its placeholder walls
(`world_api.PLACEHOLDER_WALLS`). ORD-O owns this file and replaces `build()` with the region's RegionOut.
"""
from __future__ import annotations

from world_api import Cell, RegionOut
from world_geom import stub_region


def build(band: set[Cell]) -> RegionOut:
    return stub_region("ordeal", band)
