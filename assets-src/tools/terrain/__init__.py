"""Organic overworld terrain for the map compiler (T3b: OW-4 / OW-5; docs/FIX_PLAN_PENINSULA.md).

Used by build_map.py for sources that set `terrain: organic`; every other map keeps the classic painting.
Only approved art is used: the pass-AR ground sheet (gen/terrain_cut.py: `ar_<m>` textures and their `@b` macro
variants, beach, shallows, the calm fresh water, swamp, taiga, snow, the cold rock, the `ar_tree_clump` and
`conifer_clump` parts; ecotone.tex_name), the `peak` and `boulder` parts.

  paint_soft(below, mat, kit, seed)            ground: organic outlines, ecotone bands, water by depth, beaches,
                                               banks, scree, cold ranges, the relief light (AR-T2)
  place_peaks(canvas, mat, owner, kit, rng)    mountain ranges from peak variants, foothill rocks
  metrics(src, compiled)                       boundary / peak / foothill / fidelity numbers (build_map --metrics)
  selftest()                                   synthetic maps; each case fails on the classic painting

Modules: base (constants, pixel helpers), ecotone (the AR textures, global-phase sampling, cluster bands, 15-bit
shading), outline (the material partition with its round cell cores, forest edges), water (water by depth, beach,
banks), bands (the land ecotones, cold ranges, relief light), peaks (peak variants and placement, cold-rock peaks),
roads, metrics, selftest.

Determinism and locality (GAP-14): every random choice comes from a per-chunk numpy generator (terrain.frame:
the map id, the chunk and a purpose), and the noise is defined on global pixels, so a chunk's pixels depend only on
its own cells plus about one cell of blend, in a full compile and in a `--region` window alike. Nothing iterates a
set.
"""
from __future__ import annotations

import numpy as np

import kit as K
from .bands import cold_px, land_bands, relief
from .base import WATERS, WILD, ROADS, _core, _dist, _up
from .ecotone import clump_name, macro, put, snap15, tex_name
from .metrics import boundary_stats, classify, fidelity, foothill_share, metrics, peak_stats  # noqa: F401
from .outline import _cached_partition, _forest, partition, wild_cells  # noqa: F401
from .peaks import place_peaks, plan_peaks, variants  # noqa: F401
from .roads import paint_roads
from .selftest import selftest  # noqa: F401
from .water import banks, beach, depth


def _texture(below: np.ndarray, mask: np.ndarray, kit: K.Kit, name: str, seed: int) -> None:
    """A texture over `mask`, its macro variant (`<name>@b`) mixed in by low-frequency noise."""
    put(below, mask, kit.material(name))
    alt = f"{name}@b"
    if alt in kit.materials and mask.any():
        put(below, mask & macro(*mask.shape, seed), kit.material(alt))


def paint_soft(below: np.ndarray, mat: np.ndarray, kit: K.Kit, seed: int) -> None:
    """Step 1 for `terrain: organic`: the soft ground with organic outlines and AR-T2's boundaries: textures (with
    macro variants; cold ranges in grey rock), water by depth, the beach, the land ecotones, banks, roads, forest
    and taiga edges, the relief light; every px 15-bit (see the module docstring)."""
    H, W = below.shape[:2]
    _, names, label = _cached_partition(mat, seed)
    lab = {m: label == i for i, m in enumerate(names)}
    none = np.zeros((H, W), bool)
    get = lambda m: lab.get(m, none)  # noqa: E731
    mountain = get("mountain")
    cold = cold_px(mat, mountain, seed) if "mountain_cold" in kit.materials else none
    for m in names:
        if m in WATERS:
            continue
        s = seed + 17 * WILD.index(m)              # per material, never per window (names differ by window)
        _texture(below, lab[m] & ~cold if m == "mountain" else lab[m], kit, tex_name(kit, m), s)
    if cold.any():
        _texture(below, cold, kit, "mountain_cold", seed + 17 * WILD.index("mountain"))
    sea, fresh = get("ocean"), get("river") | get("lake")
    land = ~(sea | fresh)
    road_cells = _up(np.isin(mat, ROADS))
    depth(below, sea, fresh, land, kit, seed)
    grass, sand = get("grass"), get("sand")
    soft = (grass | sand | get("swamp")) & ~road_cells       # no sand beach or earth bank on snow
    bm = beach(below, sea, soft, _dist(sea, 10), kit, seed) if sea.any() else none
    land_bands(below, get, kit, seed, ~road_cells & ~bm, cold)
    if fresh.any():
        banks(below, (grass | sand) & ~road_cells, _dist(fresh, 5), kit, seed)
    paint_roads(below, mat, kit, seed)
    core = _core(H, W)
    _forest(below, get("forest"), (grass | sand) & ~road_cells & ~core, kit, clump_name(kit, "tree_clump"))
    if "taiga" in lab:                            # the taiga's edges: the conifer clump (AR sheet)
        _forest(below, get("taiga"), (grass | sand | get("snow")) & ~road_cells & ~core & ~get("forest"), kit,
                clump_name(kit, "tree_clump@taiga"))
    relief(below, get, land)
    for y in range(0, H, 256):                     # every px 15-bit (row blocks: no full-window float copy)
        below[y:y + 256] = snap15(below[y:y + 256])
