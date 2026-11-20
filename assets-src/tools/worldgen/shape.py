"""Stage `shape` (docs/NATURAL_WORLD_PLAN.md 3.1, 2.4 rules 1-2): the land field and the forced masks.

Each continent is a polygon signed distance under a continent-scale domain warp (cells 48 / 24 / 12) and a small second
warp (fjords and fingers), grown by `grow`; the fields are combined by max with act 1's template (today's outline,
warped gently). On top: fbm coast noise, a mid-scale bay term, a coast-only detail term and ridged fingers, all faded
beyond 16 cells of the coast. Sea lines, discs and the Aldi are soft carves round a hard core; islands are seeded in
hint discs; the wall lines and barrier ridges are forced masks. NW-0's pilot math, unchanged (preset B, seed 1987).

Per-continent knobs (3.10, NW-2): `Continent.knobs` may set `detail`, `finger` or `fjord`; on the cells a continent
dominates they replace the preset's value (no knob anywhere: the preset's scalar, so B reproduces bit for bit).
"""
from __future__ import annotations

import numpy as np

from . import spec as S
from .bundle import RegionSpec
from .geom import bilinear, components, edt_signed, pline, sdist
from .noise import N, XX, YY, fbm, ridged

TEMPLATE = "a1_tpl"                          # the act-1 template's field name (its owner is region a1)
OCEAN_RING = 5                                     # cells of open ocean forced round the world's edge


def _knob(name: str, p: S.Preset, b: RegionSpec, cont: dict, a1: np.ndarray):
    """The preset's value of a knob, or per cell the dominant continent's override (3.10)."""
    if not any(name in c.knobs for c in b.continents):
        return getattr(p, name)
    names = list(cont)
    best = np.argmax(np.stack([cont[k] for k in names]), axis=0)
    vals = np.array([getattr(p, name) if k == TEMPLATE else
                     next(c for c in b.continents if c.name == k).knobs.get(name, getattr(p, name)) for k in names])
    return np.where(a1, getattr(p, name), vals[best])


def shape(b: RegionSpec, p: S.Preset, seed: int) -> dict:
    """The land mask and every field and forced mask the later stages read."""
    t = b.template
    wx = XX + p.warp * fbm(seed + 11, (48, 24, 12))
    wy = YY + p.warp * fbm(seed + 12, (48, 24, 12))
    sx_ = p.swarp * fbm(seed + 83, (14, 7, 3.5), 0.6)
    sy_ = p.swarp * fbm(seed + 84, (14, 7, 3.5), 0.6)
    fx = fbm(seed + 81, (9, 4.5, 2.2), 0.6)
    fy = fbm(seed + 82, (9, 4.5, 2.2), 0.6)
    lw = 4.0 * fbm(seed + 85, (16, 8)), 4.0 * fbm(seed + 86, (16, 8))      # the line features' wobble
    lpx, lpy = XX + .5 + lw[0], YY + .5 + lw[1]
    keep, keepch = t.keep, t.keepch
    cont = {}
    for c in b.continents:
        fj = c.knobs.get("fjord", p.fjord)
        cont[c.name] = sdist(S.poly(c.polygon), wx + .5 + sx_ + c.fjord * (fj * fx),
                             wy + .5 + sy_ + c.fjord * (fj * fy)) + p.grow
    cont[TEMPLATE] = bilinear(edt_signed(t.land), XX + .5 + t.warp * (wx - XX), YY + .5 + t.warp * (wy - YY))
    field = np.maximum.reduce(list(cont.values()))
    # the coast noise fades to 0 near act 1's kept cells, the sound and the channel
    prot = keep.copy()
    prot |= pline(list(t.sound)) < 2.5
    a, b_, c_, d = t.channel
    prot[b_:d + 1, a:c_ + 1] = True
    dprot = np.where(prot, 0, -edt_signed(prot))
    w = np.clip((dprot - 1.5) / 6, 0, 1)
    others = np.maximum.reduce([v for k, v in cont.items() if k != TEMPLATE])
    a1 = (cont[TEMPLATE] >= others) & (np.abs(cont[TEMPLATE]) < 30)
    w = np.where(a1, w * p.a1, 1.0)
    coastn = fbm(seed + 21, (24, 12, 6, 3, 1.5), 0.6)
    mid = fbm(seed + 22, (12, 6, 3), 0.65)
    detail = fbm(seed + 23, (8, 4, 2, 1), 0.7)
    fade = np.clip(1 - np.abs(field) / 16, 0, 1)
    fing = ridged(seed + 24, (10, 5, 2.5)) - 0.55
    wbig = np.where(a1, 0.0, 1.0)                        # act 1 keeps today's outline: only the small terms
    lw2 = 2.5 * fbm(seed + 88, (6, 3, 1.5)), 2.5 * fbm(seed + 89, (6, 3, 1.5))
    lpx2, lpy2 = lpx + lw2[0], lpy + lw2[1]
    carve, hard, inner = np.zeros((N, N)), np.zeros((N, N), bool), np.zeros((N, N), bool)
    for sl in b.sea_lines:                               # soft carves round a hard core (the coast stays fractal)
        dd = pline(S.poly(sl.points), lpx2, lpy2)
        carve = np.maximum(carve, np.clip((sl.radius + 6 - dd) / 6.0, 0, 1))
        hard |= dd < max(sl.radius - 0.6, 0.8)
        inner |= pline(S.poly(sl.points), lpx, lpy) < max(sl.radius - 0.8, 0.8)
    for sd in b.sea_discs:
        cx_, cy_ = S.poly([sd.centre])[0]
        dd = np.hypot(lpx2 - cx_ - .5, lpy2 - cy_ - .5)
        carve = np.maximum(carve, np.clip((sd.radius + 3 - dd) / 3.0, 0, 1))
        hard |= dd < sd.radius - 1
    for isea in b.inland_seas:
        sda = np.where(cont[TEMPLATE] < -1, sdist(S.poly(isea.polygon), lpx2, lpy2), -99)
        carve = np.maximum(carve, np.clip((sda + 4) / 6, 0, 1))
        hard |= sda > 2.5
    de = np.minimum.reduce([XX, YY, N - 1 - XX, N - 1 - YY])
    carve = np.maximum(carve, np.clip((14 - de) / 8, 0, 1))
    kd, kf = _knob("detail", p, b, cont, a1), _knob("finger", p, b, cont, a1)
    f2 = field - 10 * carve + wbig * p.coast * coastn + w * (p.mid * mid + kd * detail + kf * fing) * fade
    land = f2 > 0
    for isle in b.isles:                                 # islands seeded in hint discs (2.4 rule 2)
        cx, cy = S.poly([isle.centre])[0]
        k = max(1, int(round(isle.count * p.isles))) if isle.count > 1 else isle.count
        r2 = np.random.default_rng(isle.seed)
        for _ in range(k):
            ang, dd = r2.random() * 6.283, r2.random() * isle.radius
            x, y = cx + dd * np.cos(ang), cy + dd * np.sin(ang)
            rad = 2.0 + r2.random() * 2.2
            land |= np.hypot(XX + .5 - x + 3 * coastn, YY + .5 - y + 3 * mid) < rad
    for e, (rad, k) in b.isle_sites.items():             # an islet under a site (ORDEAL's isles, Bahamut's)
        x, y = b.sites[e]
        land |= np.hypot(XX - x + k * coastn, YY - y + k * mid) < rad
    rn = ridged(seed + 31)
    walls, cores = np.zeros((N, N), bool), np.zeros((N, N), bool)
    wall_masks, wall_cores = {}, {}
    for wl in b.walls:
        dw = pline(S.poly(wl.points), XX + .5 + lw[0] * wl.wobble, YY + .5 + lw[1] * wl.wobble)
        wall_masks[wl.id] = dw < np.maximum(1.6 + 1.2 * rn + 1.5 * np.clip(detail, -0.3, 1), 1.5)
        cores |= dw < 1.5
        wall_cores[wl.id] = dw < 1.5
        walls |= wall_masks[wl.id]
    barriers = {}
    for br in b.barriers:
        hx, hy = (lpx, lpy) if br.warped else (None, None)
        barriers[br.name] = pline(S.poly(br.points), hx, hy) < br.base + br.rn * rn
    land |= walls
    sea = hard | (pline(list(t.sound)) < 1.3)
    wcore = np.zeros((N, N), bool)
    fjord = np.zeros((N, N), bool)
    for sl in b.sea_lines:
        if sl.fjord:                                     # the fjord wins over the walls, but not over one's core
            fjord |= pline(S.poly(sl.points), lpx, lpy) < sl.radius - 0.6
    for wl in b.walls:
        if wl.id == t.channel_wall:                      # that wall's core is never carved
            wcore |= pline(S.poly(wl.points), XX + .5 + lw[0] * wl.wobble, YY + .5 + lw[1] * wl.wobble) < 1.6
    land &= ~(sea & ~walls)
    fjord &= ~wcore
    land &= ~fjord
    land &= ~(inner & ~cores)
    chan = np.zeros((N, N), bool)                        # Pravoka's channel (>= 6 Water cells per row)
    chan[b_:d + 1, a:c_ + 1] = True
    extra = (XX > c_) & (XX <= c_ + 2) & (YY >= b_) & (YY <= d) & (XX - c_ < 1 + 3 * (fbm(seed + 87, (4, 2)) + .5))
    chan |= extra & ~wcore
    land &= ~chan
    for k in wall_masks:
        wall_masks[k] &= ~chan & ~fjord
    land[:OCEAN_RING, :] = land[-OCEAN_RING:, :] = False
    land[:, :OCEAN_RING] = land[:, -OCEAN_RING:] = False
    land = np.where(keep, keepch != "o", land)           # act 1's kept cells: today's land / water exactly
    return dict(land=land, field=f2, cont=cont, keep=keep, keepch=keepch, walls=walls & ~chan & ~fjord,
                wall_masks=wall_masks, hard=hard, cores=cores, inner=inner, wall_cores=wall_cores, barriers=barriers,
                sea=sea, rn=rn, coastn=coastn, wx=wx, wy=wy)


def tidy_land(land: np.ndarray, pinned: np.ndarray, seeds: list, min_island: int = 8):
    """Drop land components under `min_island` cells (unless pinned) and fill enclosed sea pockets (under 6 cells:
    land; else lakes). `seeds`: the (x, y) cells of the basins kept as sea. Returns (land, lake)."""
    lab, sz = components(land)
    small = sz < min_island
    small[0] = False
    small[np.unique(lab[pinned & land])] = False
    land = land & ~small[lab]
    lab, sz = components(~land)
    keep = {int(lab[y, x]) for x, y in seeds}
    lake = np.zeros((N, N), bool)
    for k in range(1, len(sz)):
        if k in keep:
            continue
        m = lab == k
        if sz[k] < 6:
            land = land | m
        else:
            lake |= m
    return land, lake
