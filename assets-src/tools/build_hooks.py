"""Compiler hooks of pass W (docs/WORLD_PLAN.md 5.1): the seam between the compiler core and the world composer.

W1-0b declares the four signatures with no-op bodies; W1-C1 calls them from `build_map.py`, and W1-C2 fills the
bodies (the passthrough of the quest fields, the patch art, the per-region checks and the owned chunks). Until then
each returns its neutral value, so calling them changes no compiled output.
"""
from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from kit import Kit

    Grid = list[list[str]]                   # build_map.parse_ground's ground rows (legend chars)


def passthrough(src: dict, out: dict) -> None:
    """Copy the quest fields of a map source into its compiled map: `docks`, `patches`, `hazards`, `exit` and `world`
    (GAP-17: `world.frames.a1`). `out` is the compiled map document, changed in place. No-op until W1-C2."""
    return None


def bake_patches(map_id: str, src: dict, grid: "Grid", kit: "Kit", out_dir: Path) -> list[str]:
    """Rasterise each patch of `src["patches"]` (its cells drawn as the patched terrain over the base art) into
    `out_dir/<map_id>/patch_<pid>.png`; returns the written paths, repo-relative, in patch order. No-op until W1-C2:
    returns []."""
    return []


def region_checks(src: dict, grid: "Grid", region: str | None) -> list[str]:
    """Run the map checks of one world region (`RegionOut.checks`, on that region's sub-grid), or of the whole map when
    `region` is None (the world-level options: sealed edges, art coverage, the basin checks). Returns error strings;
    [] means OK. No-op until W1-C2: returns []."""
    return []


def owned_chunks(region: str) -> set[tuple[int, int]]:
    """The (col, row) of every chunk of the region's rect union (`world_api.BOXES`); band cells belong to the chunk
    that contains them. No-op until W1-C2: returns an empty set."""
    return set()
