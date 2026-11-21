"""The generator pipeline (docs/NATURAL_WORLD_PLAN.md 3.1): shape -> relief -> hydro -> climate -> biomes -> stamps
-> roads -> finish -> owners, for one merged spec bundle (`bundle.merge` of the seven region specs), one preset and
one seed. Returns the char grid (`ground`, 256x256 legend chars) and the meta the checks, the metrics and the source
writer read. Deterministic (2.5): seeded numpy only, row-major loops, no set iteration.

NW-0's pilot pipeline (`~/temp/ff-game/worldplan/nw0/scripts/compose.py`), split into the stage modules; at preset B
and seed 1987 it reproduces the pilot's world cell for cell (`selftest.py`'s reproduction case).
"""
from __future__ import annotations

import time

import numpy as np

from . import climate, finish, gorges, hydro, owners, relief, roads, shape, stamps
from . import spec as S
from .bundle import RegionSpec
from .geom import disc, raster_line, ring1
from .noise import N

PIN_R = 2.5                                  # every site is pinned land within this radius
FROZEN_R = 1.6                               # ... and frozen against the tidy and the jogs within this one


def resolve(points, sites: dict) -> list:
    """A corridor's or road's points: entrance names -> their site cells, rel points -> world cells (unrounded)."""
    return [tuple(sites[p]) if isinstance(p, str) else S.poly([p])[0] for p in points]


def compose(b: RegionSpec, preset: S.Preset = S.PRESET, seed: int = S.SEED, doors: dict | None = None,
            regions: tuple[str, ...] = ("a1", "elf", "earth", "fire", "ordeal", "water", "wind"),
            a1_sites: tuple[str, ...] = ()) -> tuple[np.ndarray, dict]:
    """(ground, meta). `doors`: entrance -> door offset (default (0, -1)); `a1_sites`: the entrances whose cells are
    kept from the template (not stamped)."""
    t0 = time.time()
    doors = doors or {}
    t = b.template
    sh = shape.shape(b, preset, seed)
    seeds = [(2, 2), t.seed_cell]
    pinned = sh["keep"].copy()
    for x, y in b.sites.values():
        pinned |= disc(x, y, PIN_R)
    for lk in b.lakes:
        pinned |= disc(*S.poly([lk.centre])[0], lk.radius)
    land = sh["land"] | (pinned & ~sh["keep"])
    corr = {c.name: raster_line(resolve(c.points, b.sites)) for c in b.corridors}
    for name in b.dock_links:                # a dock's walk to its town is land (2.4 rule 4b)
        for x, y in corr[name][1:]:
            land[y - 1:y + 2, x - 1:x + 2] |= ~sh["sea"][y - 1:y + 2, x - 1:x + 2]
            land[y, x] = True
    land = np.where(sh["keep"], sh["keepch"] != "o", land)
    land, lake0 = shape.tidy_land(land, pinned, seeds)
    elev = relief.relief(sh, b, seed, land)
    routes = {k: raster_line(S.poly(v)) for k, v in b.routes.items()}
    rmask = np.zeros((N, N), bool)
    for cells in routes.values():
        for x, y in cells:
            rmask[y, x] = True
    bank = gorges.banks(b, routes, (N, N))   # NW2: the gorges' rock banks (raised here, stamped after the routes)
    high = gorges.banks(b, routes, (N, N), gorges.RAISE_R)
    elev = relief.carve(elev, land, sh, rmask, relief.corridor_mask(corr), b.sites, high)
    moist, cold, wet = climate.climate(b, land, elev, sh["field"], seed)
    banned = relief.walls_all(sh) | sh["keep"] | pinned | gorges.banks(b, routes, (N, N), gorges.DRY_R)
    river, lake, _acc = hydro.rivers(land, elev, moist, seed, banned)
    g = climate.biomes(land, elev, moist, cold, wet, river, lake, seed)
    g[lake0] = "≈"
    g = climate.tidy_blobs(g, pinned | rmask | sh["hard"])
    keepch = sh["keepch"].copy()             # today's roads stay only by Cornelia's gates (the rest are routed)
    (rx, ry), rr = t.road_keep
    keepch[np.isin(keepch, [",", ":"]) & ~disc(rx, ry, rr)] = "."
    g = np.where(sh["keep"], keepch, g)
    exempt = np.zeros((N, N), bool)
    stamps.sites(g, exempt, b, doors, a1_sites)
    for x, y in t.icons:
        exempt[y, x] = True
    stamps.lakes_routes(g, b, routes)
    gorges.stamp(g, bank, b)
    stamps.ledges(g, b, routes, doors)
    canal = stamps.canal_cells(b)
    for x, y in canal:
        g[y, x] = "."
        exempt[y, x] = True
    docks = stamps.docks(g, exempt, b, sh["hard"], sh["keep"])
    limits = {c.name: c.max_fords for c in b.corridors}
    fl, cut = hydro.fords(g, corr, [c for v in routes.values() for c in v], sh["keep"], limits)
    for cells in fl.values():
        for x, y in cells:
            exempt[y, x] = True
    for x, y in t.exempt:
        exempt[y, x] = True
    roads_ok = roads.lay(g, [[tuple(int(v) for v in p) for p in resolve(r.ends, b.sites)] for r in b.roads])
    exempt = ring1(exempt)
    frozen = sh["keep"] | exempt | rmask | sh["inner"] | high
    for x, y in b.sites.values():
        frozen |= disc(x, y, FROZEN_R)
    gap = list(t.bridge[:4])
    sealed = finish.seal(g, gap, seeds)
    jogs = finish.jog(g, exempt, sh["keep"], frozen, sh["cores"])
    sealed += finish.seal(g, gap, seeds)
    tarns = hydro.tarns(g, elev, frozen)
    region = owners.owners(sh, g, b, regions)
    meta = dict(entrances={e: [int(x), int(y)] for e, (x, y) in b.sites.items()}, docks=docks, routes=routes,
                corridors=corr, fords=fl, ford_cuts=cut, canal=canal, bridge=list(t.bridge), exempt=exempt,
                region=region, regions=regions, roads_ok=roads_ok, elev=elev, walls=sh["walls"],
                barriers=sh["barriers"], keep=sh["keep"], wall_masks=sh["wall_masks"], inner=sh["inner"],
                sealed=sealed, jogs=jogs, tarns=tarns, hard=sh["hard"], seeds={"aldi": t.seed_cell, "ocean": (2, 2)},
                frozen=frozen, ledges=list(b.ledges), gen_s=time.time() - t0)
    return g, meta
