"""The seven continent specs of pass NW (docs/NATURAL_WORLD_PLAN.md 3.2, 3.5): one module per region, each building
its `worldgen.bundle.RegionSpec` (its continents, ridges, walls, barriers, sea forces, islands, climate hints, sites,
docks, corridors, roads and spots). A region tranche (NW-3, NW-R) edits only its own module; the composer v2
(`layouts/world.py`) merges them in world_api.REGIONS order.

NW-2 seeded every spec from NW-0's pilot (preset B), split by region.
"""
from __future__ import annotations

import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parents[2]
for p in (TOOLS, TOOLS / "layouts"):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))


def load() -> list:
    """Every region's RegionSpec, in world_api.REGIONS order."""
    from world_api import REGIONS

    from . import a1, earth, elf, fire, ordeal, water, wind
    mods = {"a1": a1, "elf": elf, "earth": earth, "fire": fire, "ordeal": ordeal, "water": water, "wind": wind}
    return [mods[r].spec() for r in REGIONS]
