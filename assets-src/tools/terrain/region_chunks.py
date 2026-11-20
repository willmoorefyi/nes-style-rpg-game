"""The chunk-digest mode of `--region` (docs/NATURAL_WORLD_PLAN.md 3.4, momus R3-5; NW-4), used by `region.py`.

A source whose regions are owner-grid rasters (`regions: {r: {raster: [...]}}`, the 256x256 NW world, whose regions
share chunks) records one digest per chunk (`build.chunks`), so a `--region r` over a shared compiled base repaints
r's raster plus whatever differs from the base, instead of refusing the base when a neighbour's coast moved.
"""
from __future__ import annotations

import hashlib
import json

from .frame import CHUNK

OBJ_REACH = 3            # cells: an object's art reaches at most this far outside its footprint (raster windows)
RING_PAD = 4             # cells beyond a raster window's 1-chunk ring (what a ring chunk's placements read)
PAINT_LIMIT = 160        # painted chunks, ring included (3.4; integrator 2026-11-20: a full 256x256 compile now peaks
                         # at 14.8 GB with banded painting, so this caps time, not memory; NW-4 measured 49 painted at 6.0 GB)
PAINT_KEYS = ("id", "kit", "kits", "materials", "terrain", "carpet_trim")   # map-wide keys that change pixels

Rect = tuple[int, int, int, int]


class RegionError(ValueError):
    pass


def chunked(src: dict) -> bool:
    """A source whose regions come from an owner grid (`regions.<r>.raster`): chunk-digest mode."""
    return any(isinstance(v, dict) and "raster" in v for v in (src.get("regions") or {}).values())


def chunk_digests(src: dict, wid: int, hgt: int, footprint) -> dict[str, str]:
    """{"col,row": digest} of what each chunk's pixels read: the map-wide painting keys, the source cells of the
    chunk plus a ring of CHUNK + RING_PAD cells (the window `--region` paints it in), and every object whose
    footprint (build_map's `footprint`), OBJ_REACH cells wider, meets that window (build_map's rule for the objects a
    window draws)."""
    rows = src["ground"].rstrip("\n").split("\n")
    paint = json.dumps({k: src.get(k) for k in PAINT_KEYS}, sort_keys=True).encode()
    boxes = []
    for o in src.get("objects") or []:
        cells = footprint(o)
        xs, ys = [c[0] for c in cells], [c[1] for c in cells]
        boxes.append((min(xs) - OBJ_REACH, min(ys) - OBJ_REACH, max(xs) + OBJ_REACH, max(ys) + OBJ_REACH,
                      json.dumps(o, sort_keys=True).encode()))
    m = CHUNK + RING_PAD
    out = {}
    for row in range((hgt + CHUNK - 1) // CHUNK):
        for col in range((wid + CHUNK - 1) // CHUNK):
            x0, y0 = max(0, col * CHUNK - m), max(0, row * CHUNK - m)
            x1, y1 = min(wid, (col + 1) * CHUNK + m) - 1, min(hgt, (row + 1) * CHUNK + m) - 1
            h = hashlib.sha256(paint + f"\nwindow {x0} {y0} {x1} {y1}\n".encode())
            for y in range(y0, y1 + 1):
                h.update(rows[y][x0:x1 + 1].encode() + b"\n")
            for bx0, by0, bx1, by1, blob in boxes:
                if bx1 >= x0 and bx0 <= x1 and by1 >= y0 and by0 <= y1:
                    h.update(blob + b"\n")
            out[f"{col},{row}"] = h.hexdigest()[:16]
    return out


def changed_chunks(base_build: dict, new: dict) -> set[tuple[int, int]] | None:
    """The (col, row) chunks whose digests differ from the base's; None when the base has no chunk digests."""
    old = base_build.get("chunks")
    if not isinstance(old, dict):
        return None
    return {tuple(int(v) for v in k.split(",")) for k, d in new["chunks"].items() if old.get(k) != d}


def painted(own: set[tuple[int, int]], changed: set[tuple[int, int]], wid: int, hgt: int,
            limit: int | None = None) -> tuple[set[tuple[int, int]], list[Rect]]:
    """The chunks to repaint and write (the region's raster plus every chunk whose digest changed) and their rects
    merged row by row. The limit counts everything painted: those chunks plus their 1-chunk ring (each rect is
    painted in a window with it); over it, refuse."""
    cols, rows = (wid + CHUNK - 1) // CHUNK, (hgt + CHUNK - 1) // CHUNK
    paint = own | changed
    ring = {(c + dc, r + dr) for c, r in paint for dc in (-1, 0, 1) for dr in (-1, 0, 1)
            if 0 <= c + dc < cols and 0 <= r + dr < rows}
    limit = PAINT_LIMIT if limit is None else limit
    if len(ring) > limit:
        raise RegionError(f"--region: {len(ring)} painted chunks (the raster's {len(own)}, {len(changed - own)} more "
                          f"changed, their ring) is over the {limit}-chunk limit, run a full compile")
    rects: list[Rect] = []
    for r in range(rows):
        for c in sorted(c for c, rr in paint if rr == r):
            x1, y1 = min(wid, (c + 1) * CHUNK) - 1, min(hgt, (r + 1) * CHUNK) - 1
            if rects and rects[-1][1] == r * CHUNK and rects[-1][2] == c * CHUNK - 1:
                rects[-1] = (rects[-1][0], r * CHUNK, x1, y1)
            else:
                rects.append((c * CHUNK, r * CHUNK, x1, y1))
    return paint, rects
