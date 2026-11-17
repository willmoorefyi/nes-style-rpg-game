"""Compiler hooks of pass W (docs/WORLD_PLAN.md 5.1): the seam between the compiler core and the world composer.

W1-0b declared the four signatures; W1-C1 calls them from `build_map.py`; W1-C2 wrote the bodies:

- `passthrough` copies the quest fields of a source into its compiled map (a source patch names its terrain by a
  legend char, `ground`; the compiled patch carries the TerrainType, `terrain`) and lists the patch overlays in
  `art.patches`;
- `bake_patches` draws each patch's cells, as the patched ground (plus the patch's own `objects`), into
  `<out_dir>/<map_id>/patch_<pid>.png`. The image covers the bounding box of the patch's cells, from its top-left
  cell, and is opaque exactly on the patch cells. It must run after `build_map.write`, which clears the folder;
- `region_checks` runs a world region's own map checks (`map_checks_region.py`), or, with `region` None, the
  world-level source checks (the basins and docks of 2.6; sealed edges, art coverage and the unreachable cells are
  map_checks.run's, on the compiled map);
- `owned_chunks` is the region's rect union in chunks (`world_geom.owned_chunks`).
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import TYPE_CHECKING

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(1, str(Path(__file__).resolve().parent / "layouts"))

if TYPE_CHECKING:
    from kit import Kit

    Grid = list[list[str]]                   # build_map.parse_ground's ground rows (material names)

MARGIN = 2                                   # cells of ground context compiled round a patch (blends and coasts)


def _patch_terrain(p: dict) -> int:
    if "terrain" in p:
        return int(p["terrain"])
    import build_map as BM  # noqa: PLC0415
    return int(BM.TERRAIN[BM.LEGEND[p["ground"]]])


def passthrough(src: dict, out: dict) -> None:
    """Copy the quest fields of a map source into its compiled map: `docks`, `patches`, `hazards`, `exit` and `world`
    (GAP-17: `world.frames.a1`, plus the composer's `cuts`). `out` is the compiled map document, changed in place."""
    for k in ("docks", "hazards", "exit", "world"):
        if src.get(k) is not None:
            out[k] = src[k]
    patches = src.get("patches") or []
    if not patches:
        return
    out["patches"] = [{"id": p["id"], "flag": p["flag"], "cells": [list(c) for c in p["cells"]],
                       "terrain": _patch_terrain(p)} for p in patches]
    art = out.get("art")
    if isinstance(art, dict) and art.get("below"):
        folder = art["below"][0].rsplit("/", 1)[0]
        art["patches"] = {p["id"]: f"{folder}/patch_{p['id']}.png" for p in patches}


def bake_patches(map_id: str, src: dict, grid: "Grid", kit: "Kit", out_dir: Path) -> list[str]:
    """Rasterise each patch of `src["patches"]` (its cells drawn as the patched terrain over the base art) into
    `out_dir/<map_id>/patch_<pid>.png`; returns the written paths, repo-relative, in patch order."""
    patches = src.get("patches") or []
    if not patches:
        return []
    import numpy as np  # noqa: PLC0415
    from PIL import Image  # noqa: PLC0415

    import build_map as BM  # noqa: PLC0415
    rows = src["ground"].rstrip("\n").split("\n")
    hgt, wid = len(rows), len(rows[0])
    d = Path(out_dir) / map_id
    d.mkdir(parents=True, exist_ok=True)
    written = []
    for p in patches:
        cells = [tuple(c) for c in p["cells"]]
        ch = p.get("ground") or next(k for k, v in BM.LEGEND.items() if BM.TERRAIN[v] == p["terrain"])
        x0, y0 = min(x for x, _ in cells), min(y for _, y in cells)
        x1, y1 = max(x for x, _ in cells), max(y for _, y in cells)
        cx0, cy0 = max(0, x0 - MARGIN), max(0, y0 - MARGIN)
        cx1, cy1 = min(wid - 1, x1 + MARGIN), min(hgt - 1, y1 + MARGIN)
        sub = [list(r[cx0:cx1 + 1]) for r in rows[cy0:cy1 + 1]]
        for x, y in cells:
            sub[y - cy0][x - cx0] = ch
        objs = [{**o, "x": o["x"] - cx0, "y": o["y"] - cy0} for o in p.get("objects") or []]
        psrc = {k: src[k] for k in ("terrain", "materials", "kits") if k in src}
        psrc.update({"id": f"{map_id}_patch_{p['id']}", "ground": "\n".join("".join(r) for r in sub) + "\n",
                     "objects": objs})
        validate, BM.validate = BM.validate, (lambda s, c: None)    # an art-only crop: no entrances, no checks
        try:
            c = BM.compile_map(psrc, kit, check_interiors=False)
        finally:
            BM.validate = validate
        t = BM.T
        img = np.zeros(((y1 - y0 + 1) * t, (x1 - x0 + 1) * t, 4), np.uint8)
        below = np.asarray(Image.alpha_composite(Image.fromarray(c.below).convert("RGBA"), Image.fromarray(c.above)))
        for x, y in cells:
            sy, sx = (y - cy0) * t, (x - cx0) * t
            img[(y - y0) * t:(y - y0 + 1) * t, (x - x0) * t:(x - x0 + 1) * t, :3] = below[sy:sy + t, sx:sx + t, :3]
            img[(y - y0) * t:(y - y0 + 1) * t, (x - x0) * t:(x - x0 + 1) * t, 3] = 255
        path = d / f"patch_{p['id']}.png"
        Image.fromarray(img).save(path, optimize=True)
        written.append(path.resolve().relative_to(BM.ROOT).as_posix() if path.resolve().is_relative_to(BM.ROOT)
                       else path.resolve().as_posix())
    return written


def patch_errors(src: dict, out_dir: Path) -> list[str]:
    """QUEST 4.3: a patch overlay that is not opaque on every patch cell (or is missing) is an error."""
    import numpy as np  # noqa: PLC0415
    from PIL import Image  # noqa: PLC0415
    errs = []
    for p in src.get("patches") or []:
        path = Path(out_dir) / src["id"] / f"patch_{p['id']}.png"
        if not path.exists():
            errs.append(f"patch {p['id']}: no overlay {path.name}")
            continue
        a = np.asarray(Image.open(path).convert("RGBA"))[..., 3]
        x0, y0 = min(c[0] for c in p["cells"]), min(c[1] for c in p["cells"])
        t = a.shape[1] // (max(c[0] for c in p["cells"]) - x0 + 1)
        bad = [c for c in p["cells"] if not (a[(c[1] - y0) * t:(c[1] - y0 + 1) * t, (c[0] - x0) * t:(c[0] - x0 + 1) * t]
                                            == 255).all()]
        if bad:
            errs.append(f"patch {p['id']}: overlay not opaque on {len(bad)} cells, first {tuple(bad[0])}")
    return errs


def region_checks(src: dict, grid: "Grid", region: str | None) -> list[str]:
    """Run the map checks of one world region (`RegionOut.checks`, on that region's cells), or of the whole map when
    `region` is None (the world-level source checks: the basins and the docks). Returns error strings; [] means OK.
    A map without `regions` (any map but the world) has no region checks. `grid` is unused: the checks read the
    source's legend chars."""
    import map_checks_region as MR  # noqa: PLC0415
    if region is not None:
        return MR.check(src, src["ground"], region)
    import world_checks as WC  # noqa: PLC0415
    return WC.source_checks(src)


def owned_chunks(region: str) -> set[tuple[int, int]]:
    """The (col, row) of every chunk of the region's rect union (`world_api.BOXES`); band cells belong to the chunk
    that contains them."""
    from world_geom import owned_chunks as owned  # noqa: PLC0415
    return owned(region)
