"""Organic overworld terrain for the map compiler (T3b: OW-4 / OW-5; docs/FIX_PLAN_PENINSULA.md).

Used by build_map.py for sources that set `terrain: organic`; every other map keeps the classic painting.
Only the approved kit art is used: the overworld textures and the `peak`, `tree_clump` and `boulder` parts.

  paint_soft(below, mat, kit, seed)            ground: organic outlines, dithered blends, beaches, banks, foothills
  place_peaks(canvas, mat, owner, kit, rng)    mountain ranges from peak variants, foothill rocks
  metrics(src, compiled)                       boundary / peak / foothill / fidelity numbers (build_map --metrics)
  selftest()                                   synthetic maps; each case fails on the classic painting

Modules: base (constants, pixel helpers), outline (the material partition, sand band, forest edges), water (beach,
banks, shallows, foam), peaks (foothills, peak variants and placement), roads, metrics, selftest.

Determinism and locality (GAP-14): every random choice comes from a per-chunk numpy generator (terrain.frame:
the map id, the chunk and a purpose), and the noise is defined on global pixels, so a chunk's pixels depend only on
its own cells plus about one cell of blend, in a full compile and in a `--region` window alike. Nothing iterates a
set.
"""
from __future__ import annotations

import numpy as np

import kit as K
from .base import TEX, WATERS, ROADS, _bayer, _core, _tile, _up
from .metrics import boundary_stats, classify, fidelity, foothill_share, metrics, peak_stats  # noqa: F401
from .outline import _cached_partition, _forest, partition, sand_band, wild_cells  # noqa: F401
from .peaks import foothills, place_peaks, plan_peaks, variants  # noqa: F401
from .roads import paint_roads
from .selftest import selftest  # noqa: F401
from .water import banks, beach, shallows


def paint_soft(below: np.ndarray, mat: np.ndarray, kit: K.Kit, seed: int) -> None:
    """Step 1 for `terrain: organic`: the soft ground with organic outlines and blends (see the module docstring)."""
    H, W = below.shape[:2]
    _, names, label = _cached_partition(mat, seed)
    lab = {m: label == i for i, m in enumerate(names)}
    none = np.zeros((H, W), bool)
    get = lambda m: lab.get(m, none)  # noqa: E731
    mtex = None                                    # NW-2 (G-NW8): one tiled texture alive at a time, not one each
    for m in names:
        tex = _tile(kit.material(TEX.get(m, m)), H, W)
        below[lab[m]] = tex[lab[m]]
        if m == "mountain":
            mtex = tex                             # the foothills read it below
        del tex
    bayer, core = _bayer(H, W), _core(H, W)
    road_cells = _up(np.isin(mat, ROADS))
    grass, sand = get("grass").copy(), get("sand").copy()
    sand_tex = _tile(kit.material("sand"), H, W)
    grass_tex = _tile(kit.material("grass"), H, W)
    soil = _tile(kit.material("dirt"), H, W)
    ocean = get("ocean")
    grass, sand = beach(below, ocean, grass, sand, core, road_cells, bayer, sand_tex, seed)
    grass, sand = sand_band(below, grass, sand, core, bayer, sand_tex, grass_tex)
    grass = banks(below, get("river") | get("lake"), grass, sand, core, bayer, soil)
    foothills(below, get("mountain"), grass, ocean, core, bayer, mtex, seed)
    paint_roads(below, mat, kit, seed)
    _forest(below, get("forest"), (grass | sand) & ~road_cells & ~core, kit)
    if "taiga" in lab:                            # NW2: taiga edges, its recoloured clumps (build_map.map_kit)
        _forest(below, get("taiga"), (grass | sand) & ~road_cells & ~core & ~get("forest"), kit, "tree_clump@taiga")
    shallows(below, [get(m) for m in WATERS], {m: get(m) for m in WATERS}, bayer, seed)
