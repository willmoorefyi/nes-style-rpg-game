"""Helpers for map layout scripts: draw shapes into an ASCII ground grid and emit a map source YAML
(assets-src/maps/<id>.yaml) for the map compiler. Each layout script in this folder writes one source map; the YAML
it writes is what the compiler reads (rerun the script after changing it)."""
from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]
MAPS = ROOT / "assets-src" / "maps"


class Grid:
    def __init__(self, w: int, h: int, fill: str = "."):
        self.w, self.h = w, h
        self.g = [[fill] * w for _ in range(h)]

    def __getitem__(self, xy):
        x, y = xy
        return self.g[y][x]

    def inside(self, x: int, y: int) -> bool:
        return 0 <= x < self.w and 0 <= y < self.h

    def set(self, x: int, y: int, ch: str, only: str | None = None) -> None:
        if self.inside(x, y) and (only is None or self.g[y][x] in only):
            self.g[y][x] = ch

    def rect(self, x0: int, y0: int, x1: int, y1: int, ch: str, only: str | None = None) -> None:
        """Inclusive rectangle."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, ch, only)

    def line(self, pts: list[tuple[int, int]], ch: str, width: int = 2, only: str | None = None) -> list[tuple[int, int]]:
        """A thick polyline (square brush, `width` cells, anchored top-left); returns the cells drawn."""
        cells = []
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            for x, y in _bresenham(x0, y0, x1, y1):
                for dy in range(width):
                    for dx in range(width):
                        if self.inside(x + dx, y + dy):
                            cells.append((x + dx, y + dy))
                            self.set(x + dx, y + dy, ch, only)
        return cells

    def text(self) -> str:
        return "\n".join("".join(r) for r in self.g) + "\n"


class Interior(Grid):
    """An interior: solid wall top (W) everywhere, rooms carved out; faces() then turns the wall cells just north
    of a floor into a back wall (F), `rows` cells tall, so every room shows its north wall in 3/4 view."""

    def __init__(self, w: int, h: int):
        super().__init__(w, h, "W")

    def carve(self, x0: int, y0: int, x1: int, y1: int, ch: str = "-") -> None:
        self.rect(x0, y0, x1, y1, ch)

    def faces(self, rows: int = 2) -> None:
        floor = [[c not in "WF" for c in r] for r in self.g]
        for y in range(self.h):
            for x in range(self.w):
                if floor[y][x] and y > 0 and self.g[y - 1][x] == "W":
                    for k in range(1, rows + 1):
                        if y - k >= 0 and self.g[y - k][x] == "W":
                            self.g[y - k][x] = "F"


def _bresenham(x0, y0, x1, y1):
    """4-connected line (no diagonal-only steps, so thick lines stay watertight): each step goes along x or y,
    whichever stays closer to the ideal line."""
    x, y = x0, y0
    sx, sy = (1 if x1 > x0 else -1), (1 if y1 > y0 else -1)
    dist = lambda px, py: abs((px - x0) * (y1 - y0) - (py - y0) * (x1 - x0))  # noqa: E731
    out = [(x, y)]
    while (x, y) != (x1, y1):
        if x != x1 and (y == y1 or dist(x + sx, y) <= dist(x, y + sy)):
            x += sx
        else:
            y += sy
        out.append((x, y))
    return out


def polygon_mask(w: int, h: int, pts: "Sequence[tuple[float, float]]") -> list[list[bool]]:
    """Cells whose centre lies inside the polygon."""
    out = [[False] * w for _ in range(h)]
    n = len(pts)
    for y in range(h):
        cy = y + 0.5
        for x in range(w):
            cx = x + 0.5
            inside = False
            for i in range(n):
                (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
                if (y0 > cy) != (y1 > cy) and cx < x0 + (cy - y0) * (x1 - x0) / (y1 - y0):
                    inside = not inside
            out[y][x] = inside
    return out


def ring(mask: list[list[bool]], thick: int = 2) -> set[tuple[int, int]]:
    """Cells outside the mask within `thick` cells (Chebyshev) of it: a wall that follows the outline."""
    h, w = len(mask), len(mask[0])
    out = set()
    for y in range(h):
        for x in range(w):
            if mask[y][x]:
                continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and mask[y + dy][x + dx]
                   for dy in range(-thick, thick + 1) for dx in range(-thick, thick + 1)):
                out.add((x, y))
    return out


def write_map(map_id: str, header: str, doc: dict, ground: str) -> Path:
    """Write assets-src/maps/<id>.yaml: header comment, id, then the ground grid as a block, then the rest."""
    path = MAPS / f"{map_id}.yaml"
    head = {k: doc[k] for k in doc if k in ("id", "name", "kits", "kit", "music", "materials")}
    rest = {k: v for k, v in doc.items() if k not in head}
    body = yaml.safe_dump(head, sort_keys=False, width=140)
    body += "ground: |\n" + "".join(f"  {row}\n" for row in ground.rstrip("\n").split("\n"))
    body += yaml.safe_dump(rest, sort_keys=False, default_flow_style=None, width=140)
    path.write_text("".join(f"# {line}\n" for line in header.strip().split("\n")) + body)
    return path
