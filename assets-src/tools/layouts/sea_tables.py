"""WR F-WR (docs/WORLD_WRAP_PLAN.md 8.4): the early seas' tables for the late regions' seam zones, and the bands.

The late seas (WATER's, ORDEAL's, WIND's) meet the early ones (ELF's and FIRE's) across the wrap seams. Each late
region takes a SEAM_BAND-cell band of its sea along the seam out of its own sea zone and gives it the table of the
early sea it meets, imported here so it stays in sync: EARLY_SOUTH is ELF's Southern Sea, EARLY_EAST FIRE's.
"""
from __future__ import annotations

import numpy as np

from elf.world_zones import SEA as EARLY_SOUTH  # noqa: F401
from fire.fire_tables import SEA as EARLY_EAST  # noqa: F401
from world_api import SEAM_BAND


def band(shape: tuple[int, int], x0: int, y0: int, x1: int, y1: int) -> np.ndarray:
    """An inclusive cell box as a mask."""
    m = np.zeros(shape, bool)
    m[y0:y1 + 1, x0:x1 + 1] = True
    return m


def north(shape: tuple[int, int], x0: int, x1: int) -> np.ndarray:
    """The band along the north edge (y < SEAM_BAND) over x0..x1, which meets the south seas across y 255 | 0."""
    return band(shape, x0, 0, x1, SEAM_BAND - 1)
