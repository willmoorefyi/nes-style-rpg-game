"""Region EARTH's ground stamps on the NW world (docs/NATURAL_WORLD_PLAN.md 3.3 `stamps` of kind `rock`, 3.8; NW-R
EARTH), run by `world_earth_nw.content` on the generated ground, on EARTH's own cells only:

- `thicken`: the western range at least 3 rock cells thick everywhere (rock on the flanks of its thinnest cells);
- `tidy`: today's EARTH map checks (`min_blob` mountain / sand / forest 3, `ocean_inlet` 2) on the cells the stamps,
  docks, roads and the canal left (a dock's cove widened, a cut-off pond made a lake).

Neither moves a cell of another region, so no world-wide figure (the forest quantile, the moisture sweep) changes
and a `--region earth` compile repaints only EARTH's chunks.
"""
from __future__ import annotations

import numpy as np

from worldgen.gates import BLOCK

REGION = "earth"
SIDES = ((1, 0), (-1, 0), (0, 1), (0, -1))


def thicken(g: np.ndarray, meta: dict, ents: dict, taken: set, need: int = 3, rounds: int = 8) -> int:
    """Rock on the flanks of the western range's thinnest cells until its minimal cut (as 3.8 `barriers` measures
    it: the fewest blocked land cells of its mask, grown as needed, that join Melmond to Sarda) is `need` cells:
    each round turns the walkable 4-neighbours of the cut cells inside the mask, grown by 2, to mountain (no door,
    entrance or dock). Returns the cut's size."""
    from worldgen.cuts import min_cut  # noqa: PLC0415
    from worldgen.gates import WALL_GROW, grow  # noqa: PLC0415
    mask = meta["barriers"]["western_range"]
    near = grow(grow(mask))
    src, dst = np.zeros(g.shape, bool), np.zeros(g.shape, bool)
    src[ents["ert_melmond"][1], ents["ert_melmond"][0]] = True
    dst[ents["ert_sarda"][1], ents["ert_sarda"][0]] = True
    cut: list = []
    for _ in range(rounds):
        w = ~np.isin(g, BLOCK)
        cost = ~w & (g != "o")
        area, cut = mask, []
        for _n in range(WALL_GROW + 1):
            cut = min_cut(w, cost & area, src, dst)
            if cut:
                break
            area = grow(area)
        if not cut or len(cut) >= need:
            break
        for x, y in cut:
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if near[ny, nx] and w[ny, nx] and (nx, ny) not in taken:
                    g[ny, nx] = "m"
    return len(cut)


BAD_SEED, BAD_R, BAD_T = 5011, 15.0, 0.42   # the badlands: noise seed, reach from the Cavern's mouth, threshold


def badlands(g: np.ndarray, meta: dict, ents: dict, plain: np.ndarray, south: int) -> None:
    """The Grey Badlands (today's sand south of Melmond round the Cavern's mesa): the plain's grass south of row
    `south` turns to sand where a seeded fbm plus a fall-off from the Cavern's mouth is high (ragged, never a disc;
    the generator's own arid hint dries only a patch there, and a stronger hint would move the world-wide sand
    quantile). `plain`: the plain's cells (EARTH's, east of the range)."""
    from worldgen.noise import XX, YY, fbm  # noqa: PLC0415
    cx, cy = ents["ert_earth_cave"]
    near = 1 - np.hypot(XX - cx, YY - cy) / BAD_R
    score = near + 0.55 * fbm(BAD_SEED, (12, 6, 3))
    dry = plain & (g == ".") & (YY >= south) & (score > BAD_T) & (meta["elev"] < 0.4)
    g[dry] = "s"


def _blobs(g: np.ndarray, mine: np.ndarray, taken: set) -> bool:
    from worldgen.climate import TIE  # noqa: PLC0415
    from worldgen.geom import components  # noqa: PLC0415
    changed = False
    for ch in "mfs":
        lab, sz = components(g == ch)
        for k in np.nonzero(sz < 3)[0]:
            cells = [tuple(c) for c in np.argwhere(lab == k)] if k else []
            if not cells or not all(mine[y, x] and (x, y) not in taken for y, x in cells):
                continue
            for y, x in cells:
                nb = [g[y + b, x + a] for a, b in SIDES if g[y + b, x + a] in ".fstwn" and g[y + b, x + a] != ch]
                g[y, x] = max(sorted(set(nb), key=TIE.index), key=nb.count) if nb else "."
                changed = True
    return changed


def _inlets(g: np.ndarray, mine: np.ndarray, taken: set, docks: set) -> bool:
    from map_checks_terrain import ocean_inlets  # noqa: PLC0415
    changed = False
    mat = np.where(g == "o", "ocean", np.where(g == "=", "bridge", "grass"))
    for x, y in ocean_inlets(mat, 2):
        if not mine[y, x]:
            continue
        if (x, y) in docks:                  # widen the cove across its closed axis
            land = [(x + a, y + b) for a, b in SIDES if g[y + b, x + a] != "o" and (x + a, y + b) not in taken
                    and g[y - b, x - a] != "o"]
            if land:
                c = max(land, key=lambda c: (sum(g[c[1] + b, c[0] + a] == "o" for a, b in SIDES), -c[1], -c[0]))
                g[c[1], c[0]] = "o"
                changed = True
        elif (x, y) not in taken:
            g[y, x] = "."
            changed = True
    return changed


def _ponds(g: np.ndarray, meta: dict, mine: np.ndarray) -> None:
    """Water cut off from both basins (an inlet's mouth filled), wholly EARTH's, becomes a lake."""
    from worldgen.geom import components, flood  # noqa: PLC0415
    sea = flood(g == "o", [tuple(meta["seeds"]["aldi"]), tuple(meta["seeds"]["ocean"])])
    lab, _sz = components((g == "o") & ~sea)
    for k in range(1, int(lab.max()) + 1):
        cells = lab == k
        if mine[cells].all():
            g[cells] = "≈"


def tidy(g: np.ndarray, meta: dict, taken: set, docks: dict, rounds: int = 4) -> None:
    """Today's EARTH map checks on its own cells: a patch under 3 cells wholly EARTH's takes its most common land
    neighbour (the generator's tidy, `climate.TIE`); a dock in a one-cell inlet gets its cove widened by one Water
    cell beside it; any other one-cell inlet becomes grass, and water it cuts off a lake."""
    mine = meta["region"] == meta["regions"].index(REGION)
    for _ in range(rounds):
        if not (_blobs(g, mine, taken) | _inlets(g, mine, taken, set(docks.values()))):
            break
    _ponds(g, meta, mine)
