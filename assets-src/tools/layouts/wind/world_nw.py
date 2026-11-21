"""Region WIND's content on the generated world of pass NW (docs/NATURAL_WORLD_PLAN.md 3.3, 3.8, 5.2; NW-R WIND).

The spec (`world_specs/wind.py`) shapes the land; `content` places WIND's content on the ground the generator made,
as pass W's `world_wind.py` / `wind/world_sites.py` placed it on today's world, each piece relative to its door:

- the stamps (small ground overrides, on WIND's own cells only): the Mirage sands (the ring's floor is sand, but for
  the salt pan, the stone spine and the oasis meadow), the airship meadows by the three doors (Gaia's grass bowl),
  the rocky knoll behind Gaia's door and the ground under each icon;
- the objects (`wind/world_nw_objects.py`): the three approved icons, the tree clump and the fallen block by their
  doors, the cairn in the neck between Gaia's arm and the Pinewold and the bronze dial in the sands;
- the encounter zones, with pass W's ids, names and rosters: one walking zone per part, each the flood from its
  door's arrival, the walkable islets with the nearest part, each canoe water (river, lake) with the part it
  touches, the canoe-only water left over in `wnd_tarns`, every Water cell WIND owns in `wnd_sea`, and their battle
  backdrops (snow and taiga included, D-NW9, NW2). Every walkable or canoe cell WIND owns lands in a zone (3.8
  `coverage`).

A small walkable pocket of WIND's outside the three parts that touches another region's land on foot is sealed to
rock (`seal`, pass W's rule for stray pockets). It fails (SystemExit) when two parts join on foot, when a part (or a
pocket over SEAL_MAX cells) reaches another region's land, when the sands reach the sea (the ring is open), or when a
stamp would fall outside WIND's cells.
"""
from __future__ import annotations

import numpy as np

from world_api import REGIONS, RegionOut
from worldgen import spec as S
from worldgen.gates import BLOCK
from worldgen.geom import components, flood, sdist
from worldgen.noise import XX, YY, fbm
from wind import world_nw_objects as OB
from wind import world_sites as WS
from world_specs import wind as SPEC

R = REGIONS.index("wind")
WET = ["r", "≈"]
PARTS = (("wnd_highlands", "wnd_gaia"), ("wnd_mirage_sands", "wnd_mirage"), ("wnd_lufen_moor", "wnd_lufenia"))
MEADOWS = {"wnd_gaia": ((1, 2), 4.0), "wnd_mirage": ((4, 1), 2.4), "wnd_lufenia": ((3, 2), 2.6)}  # offset, radius
SEAL_MAX = 80                                # the largest pocket `seal` turns to rock
PAN = ((196, 53), 2.4)                       # the salt pan in the sands (world cell, radius of a ragged disc)
SNOW, TAIGA = "ice_cave", "dark_forest"      # the staged backdrops of snow and taiga (D-NW9, NW2 Q8; no new art)
BACKDROPS = {
    "wnd_highlands": {"default": "grassland", "terrain": {"forest": "forest", "taiga": TAIGA, "snow": SNOW}},
    "wnd_mirage_sands": {"default": "desert", "terrain": {"forest": "forest", "taiga": TAIGA, "snow": SNOW}},
    "wnd_lufen_moor": {"default": "grassland", "terrain": {"swamp": "marsh", "forest": "forest", "taiga": TAIGA,
                                                           "snow": SNOW}},
    "wnd_tarns": {"default": "river"},
    "wnd_sea": {"default": "ocean"},
}
TABLES = {z[0]: (z[1], z[3]) for z in WS.ZONES}  # pass W's names and rosters, by zone id


def row_rects(m: np.ndarray) -> list[list[int]]:
    """A mask as inclusive [x0, y, x1, y] runs, row-major (pass W's `overworld_zones.row_rects`)."""
    out = []
    for y in range(m.shape[0]):
        xs = np.flatnonzero(m[y])
        if xs.size:
            cut = np.flatnonzero(np.diff(xs) > 1)
            for a, b in zip(np.r_[0, cut + 1], np.r_[cut, xs.size - 1]):
                out.append([int(xs[a]), y, int(xs[b]), y])
    return out


def _ragged(c, r: float, seed: int) -> np.ndarray:
    """The cells within r of cell c, the edge moved by up to about a cell of noise (not a circle)."""
    return np.hypot(XX - c[0], YY - c[1]) <= r + 3 * fbm(seed, (4, 2))


def _near(m: np.ndarray) -> np.ndarray:
    """The cells of m and their 4-neighbours."""
    return m | np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1)


def _put(g, mine, cells, ch: str) -> None:
    for x, y in cells:
        if not mine[y, x]:
            raise SystemExit(f"wind: a stamp at ({x}, {y}) lies outside WIND's cells")
        g[y, x] = ch


def parts(g, mine, ent) -> dict:
    """Each part's walkable cells (its door's arrival flooded on foot over WIND's cells); fails on a join."""
    walk = ~np.isin(g, BLOCK)
    out = {}
    for zid, e in PARTS:
        out[zid] = flood(walk & mine, [ent[e]])
        if (flood(walk, [ent[e]]) & ~mine).any():
            raise SystemExit(f"wind: {e}'s part reaches another region's land on foot")
    for (a, _), (b, _) in ((PARTS[0], PARTS[1]), (PARTS[0], PARTS[2]), (PARTS[1], PARTS[2])):
        if (out[a] & out[b]).any():
            raise SystemExit(f"wind: {a} and {b} join on foot at {tuple(np.argwhere(out[a] & out[b])[0][::-1])}")
    return out


def stamp(g, mine, ent) -> None:
    ring = sdist(S.poly(SPEC.RING)) > 0
    floor = flood(~np.isin(g, ["o", "m"]) & mine & ring, [ent["wnd_mirage"]])
    shore = floor & _near(g == "o")
    if shore.any():
        raise SystemExit(f"wind: the Mirage sands reach the sea at {tuple(np.argwhere(shore)[0][::-1])}: the ring "
                         "is open")
    g[floor] = "s"                            # the sands (the basin's own pools and streams dry out) ...
    g[_ragged(*PAN, 1297) & floor] = "≈"      # ... but for the salt pan
    for e, ((ox, oy), r) in MEADOWS.items():  # the airship meadows: snow, taiga, sand, moor -> grass
        x, y = ent[e]
        g[_ragged((x + ox, y + oy), r, 1301 + len(e)) & mine & np.isin(g, ["t", "n", "s", "w"])] = "."
    for cells, ch in OB.ground(ent):
        _put(g, mine, cells, ch)


def seal(g, mine, ent) -> int:
    """A walkable pocket of WIND's outside its three parts that touches another region's walkable land (the
    Citadel's coast against the basin's north-west slope) becomes rock, as pass W sealed its stray pockets; fails if
    such a pocket is larger than SEAL_MAX cells. Returns the cells sealed."""
    walk = ~np.isin(g, BLOCK)
    lab, sz = components(walk & mine & ~np.logical_or.reduce(list(parts(g, mine, ent).values())))
    foreign = _near(walk & ~mine)
    n = 0
    for k in sorted({int(v) for v in np.unique(lab[foreign & (lab > 0)])}):
        if sz[k] > SEAL_MAX:
            y, x = np.argwhere(lab == k)[0]
            raise SystemExit(f"wind: {sz[k]} walkable cells at ({x}, {y}) join another region's land on foot")
        g[lab == k] = "m"
        n += int(sz[k])
    return n


def zones(g, mine, ent) -> tuple[list[dict], dict]:
    walk, wet = ~np.isin(g, BLOCK), np.isin(g, WET) & mine
    own = parts(g, mine, ent)
    lab, sz = components(walk & mine & ~np.logical_or.reduce(list(own.values())))
    pts = {z: np.argwhere(m) for z, m in own.items()}
    for k in range(1, len(sz)):              # a walkable islet (or a pocket) goes with the nearest part
        y, x = np.argwhere(lab == k)[0]
        near = min(pts, key=lambda z: (float(np.min(np.hypot(pts[z][:, 0] - y, pts[z][:, 1] - x))), z))
        own[near] |= lab == k
    wlab, wsz = components(wet)
    held = np.zeros(g.shape, bool)
    for zid, _e in PARTS:                    # each canoe water goes with the first part it touches
        m = own[zid]
        ks = [k for k in np.unique(wlab[_near(m) & wet]) if k]
        add = np.isin(wlab, ks) & ~held
        own[zid] = m | add
        held |= add
    out = []
    for zid, _e in PARTS:
        name, table = TABLES[zid]
        out.append({"id": zid, "name": name, "rects": row_rects(own[zid]), "encounters": table})
    tarns = wet & ~held
    if tarns.any():
        out.append({"id": "wnd_tarns", "name": "Highland Tarns", "modes": ["canoe"], "rects": row_rects(tarns),
                    "encounters": WS.TARNS})
    out.append({"id": "wnd_sea", "name": "North Seas", "modes": ["ship"], "rects": row_rects((g == "o") & mine),
                "encounters": WS.SEA})
    return out, {z["id"]: BACKDROPS[z["id"]] for z in out}


def content(g: np.ndarray, meta: dict, _b) -> RegionOut:
    """WIND's content on the generated ground `g` (its stamps are written into `g`)."""
    mine = meta["region"] == R
    ent = {e: tuple(int(v) for v in meta["entrances"][e]) for _z, e in PARTS}
    parts(g, mine, ent)                       # the three parts are apart before any stamp
    stamp(g, mine, ent)
    sealed = seal(g, mine, ent)
    objs, insp = OB.objects(g, ent, parts(g, mine, ent))
    zs, bg = zones(g, mine, ent)
    return RegionOut(objects=objs, inspect=insp, zones=zs, battleBackgrounds={"zones": bg},
                     notes=list(OB.NOTES) + [f"NW-R WIND: {sealed} cells sealed"])
