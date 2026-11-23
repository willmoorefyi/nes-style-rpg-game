"""WR (docs/WORLD_WRAP_PLAN.md 6.2): the compile checks of a wrapped map (`wrap: true`).

- `source_errors`: `wrap` needs `sealed_edges` (the seam must be open sea; map_checks runs it with the other source
  options).
- `check_seam` (after the chunks are written, `build_map.write` through `build_hooks.check_seam`): per chunk row it
  compares the 1-px column across the E-W seam (chunk (r, last)'s last column against chunk (r, 0)'s first) with that
  row's interior chunk boundaries, and per chunk column the 1-px row across the N-S seam with that column's interior
  boundaries (mean abs, RGB). It fails when a seam exceeds its row's (column's) max(interior) + SEAM_SLACK and prints
  the worst row and column, e.g. `seam: x 5.7 (interior max 6.7), y 7.3 (7.7)`.
"""
from __future__ import annotations

import re
from pathlib import Path

import numpy as np
from PIL import Image

SEAM_SLACK = 1.0
CHUNK_RE = re.compile(r"^below_(\d+)_(\d+)\.png$")


class SeamError(Exception):
    pass


def source_errors(src: dict) -> list[str]:
    if src.get("wrap") and not src.get("sealed_edges"):
        return ["wrap: a wrapped map needs sealed_edges (its seam is open sea, docs/WORLD_WRAP_PLAN.md D-WR-2)"]
    return []


def _grid(d: Path) -> list[list[Path]]:
    found = {}
    for p in d.glob("below_*.png"):
        m = CHUNK_RE.match(p.name)
        if m:
            found[(int(m[1]), int(m[2]))] = p
    rows = 1 + max(r for r, _ in found)
    cols = 1 + max(c for _, c in found)
    return [[found[(r, c)] for c in range(cols)] for r in range(rows)]


def _rgb(p: Path) -> np.ndarray:
    with Image.open(p) as im:
        return np.asarray(im.convert("RGB"), dtype=np.int16)


def seam_figures(d: Path) -> dict:
    """The mean abs RGB difference across each seam and the largest across an interior chunk boundary, per axis."""
    grid = _grid(d)
    rows, cols = len(grid), len(grid[0])
    first_col = [[None] * cols for _ in range(rows)]
    last_col = [[None] * cols for _ in range(rows)]
    first_row = [[None] * cols for _ in range(rows)]
    last_row = [[None] * cols for _ in range(rows)]
    for r in range(rows):
        for c in range(cols):
            a = _rgb(grid[r][c])
            first_col[r][c], last_col[r][c] = a[:, 0], a[:, -1]
            first_row[r][c], last_row[r][c] = a[0], a[-1]
    diff = lambda a, b: float(np.abs(a - b).mean())  # noqa: E731
    # per chunk row (column): the seam against that row's (column's) own interior boundaries; the worst margin wins
    xs = [(diff(last_col[r][cols - 1], first_col[r][0]),
           max(diff(last_col[r][c], first_col[r][c + 1]) for c in range(cols - 1))) for r in range(rows)]
    ys = [(diff(last_row[rows - 1][c], first_row[0][c]),
           max(diff(last_row[r][c], first_row[r + 1][c]) for r in range(rows - 1))) for c in range(cols)]
    (x, xi), (y, yi) = max(xs, key=lambda t: t[0] - t[1]), max(ys, key=lambda t: t[0] - t[1])
    return {"x": x, "x_inner": xi, "y": y, "y_inner": yi}


def check_seam(map_id: str, src: dict, out_dir: Path) -> dict | None:
    """The seam figures of a wrapped map's written chunks, printed; raises SeamError when a seam shows a line."""
    if not src.get("wrap"):
        return None
    errs = source_errors(src)
    if errs:
        raise SeamError("; ".join(errs))
    f = seam_figures(Path(out_dir) / map_id)
    print(f"seam: x {f['x']:.1f} (interior max {f['x_inner']:.1f}), y {f['y']:.1f} ({f['y_inner']:.1f})")
    bad = [f"{a} seam {f[a]:.1f} > interior max {f[a + '_inner']:.1f} + {SEAM_SLACK}" for a in ("x", "y")
           if f[a] > f[a + "_inner"] + SEAM_SLACK]
    if bad:
        raise SeamError(f"{map_id}: the wrap seam shows a line: {'; '.join(bad)}")
    return f
