"""Region EARTH of the world (docs/WORLD_PLAN.md 2.4, 2.6, 4.3): the Duergar isthmus (the dwarves, the canal) and the
western continent (Melmond, the Cavern of Earth, the giant's tunnel, Sarda).

STUB (W1-C2): until ERT-O builds the region, it is ocean in its rects and the composer fills its placeholder walls
(`world_api.PLACEHOLDER_WALLS`: W_west's isthmus stub and W_isthmus). The stub also declares a placeholder `canal`
patch (flag CANAL_OPEN) across the W_isthmus placeholder at the canal strip, so the composer's basin check 2 (the
canal joins `aldi` and `ocean`) holds from the start. ERT-O owns this file and replaces `build()` with the region's
RegionOut, the real isthmus and the real canal.
"""
from __future__ import annotations

from world_api import CANAL_PATCH, WATER, Cell, Rect, RegionOut
from world_geom import stub_region

CANAL_STRIP = Rect(48, 88, 61, 92)           # 2.6: about world x 48-61, y 88-92 (inside the W_isthmus placeholder)


def build(band: set[Cell]) -> RegionOut:
    canal = {"id": CANAL_PATCH, "flag": "CANAL_OPEN", "ground": WATER,
             "cells": [list(c) for c in CANAL_STRIP.cells()]}
    return stub_region("earth", band, patches=[canal])
