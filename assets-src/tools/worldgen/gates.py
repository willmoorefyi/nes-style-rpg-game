"""The compose checks of the travel gates (docs/NATURAL_WORLD_PLAN.md 3.8): basins, docks, walls, barriers, routes,
north, landings, straits and detours, on the composed ground with the stated patches. NW-0's pilot checks, made
generic over the merged spec (`bundle.RegionSpec`): its sites, docks, barrier seeds and north anchors.

NW-4 hardens these (the minimal cuts exported as `world.cuts`, the owner-grid `world_checks`, the failing cells in
each message) and wires them into `world.py`'s G-NW4 lines; NW-2 lands them so its gate (B's pilot checks reproduced
at seed 1987) is measured by the repo's code. Each returns a dict with `ok` and the figures B's json reports.
"""
from __future__ import annotations

import numpy as np

from .geom import bfs_dist, components, flood

BLOCK = ["o", "m", "r", "≈"]                 # on foot
LANDING = [".", "t"]                         # the airship lands on grass and tundra, never on snow (D-NW9)
LANDING_STEPS = 8
STRAIT_W = 3                                 # a ship lane is at least 3 Water cells wide (3x3 erosion)
# WORLD 2.6's ship lanes: (name, dock a, dock b, canal open)
STRAITS = (("pravoka-elf_port", "a1_pravoka", "elf_port", False), ("pravoka-dwarf", "a1_pravoka", "ert_dwarf", False),
           ("dwarf-melmond (canal)", "ert_dwarf", "ert_melmond", True),
           ("melmond-crescent", "ert_melmond", "fir_crescent", True))
# WORLD 6.1's walking detour hops (2.5; melmond-sarda through the tunnel 3.0)
DETOURS = (("cornelia", "a1_pravoka"), ("cornelia", "a1_matoya"), ("elf_elfheim", "elf_keep"),
           ("elf_elfheim", "elf_marsh"), ("ert_melmond", "ert_earth_cave"), ("ert_melmond", "ert_giant"),
           ("fir_ice", "fir_desert"))
DETOUR_MAX, TUNNEL_MAX = 2.5, 3.0


def with_patches(g: np.ndarray, meta: dict, bridge: bool = True, canal: bool = True) -> np.ndarray:
    """The ground with the bridge patch on (`=`) or its gap rows open, and the canal patch on (Water) or off."""
    h = g.copy()
    if bridge:
        for x, y in meta["bridge"]:
            h[y, x] = "="
    else:
        for x, y in meta["bridge"][:4]:
            h[y, x] = "o"
    if canal:
        for x, y in meta["canal"]:
            h[y, x] = "o"
    return h


def walk(h: np.ndarray) -> np.ndarray:
    return ~np.isin(h, BLOCK)


def canoe(h: np.ndarray) -> np.ndarray:
    return walk(h) | np.isin(h, ["r", "≈"])


def joined(mask: np.ndarray, a, b) -> bool:
    return bool(flood(mask, [tuple(a)])[b[1], b[0]])


def basins(g, meta) -> dict:
    (ax, ay), (ox, oy) = meta["seeds"]["aldi"], meta["seeds"]["ocean"]
    off = with_patches(g, meta, False, False)
    lab, sz = components(off == "o")
    a, o = lab[ay, ax], lab[oy, ox]
    stray = int(((off == "o") & (lab != a) & (lab != o)).sum())
    lab2, _ = components(with_patches(g, meta, True, True) == "o")
    joins = lab2[ay, ax] == lab2[oy, ox]
    off = with_patches(g, meta, True, False)
    lab, _ = components(off == "o")
    a, o = lab[ay, ax], lab[oy, ox]
    docks = [(d["id"], bool(lab[d["y"], d["x"]] == (a if d["basin"] == "aldi" else o) and off[d["y"], d["x"]] == "o"))
             for d in meta["docks"]]
    ok = a != o and a > 0 and stray == 0 and joins and all(v for _, v in docks)
    return dict(ok=bool(ok), aldi_cells=int(sz[a]), ocean_cells=int(sz[o]), disjoint=bool(a != o), stray_water=stray,
                canal_joins=bool(joins), docks=docks)


def docks(g, meta) -> dict:
    h = with_patches(g, meta)
    w = walk(h)
    bad = [d["id"] for d in meta["docks"] if h[d["y"], d["x"]] != "o"
           or not any(w[d["y"] + dy, d["x"] + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    return {"ok": not bad, "bad": bad}


def walls(g, meta) -> dict:
    off = with_patches(g, meta, False, False)
    res = {k: int(np.isin(off[m], ["o", "r", "≈"]).sum()) for k, m in meta["wall_masks"].items()}
    return {"ok": all(v == 0 for v in res.values()), "water_cells_in_wall_core_3wide": res}


def barriers(g, meta, seeds: dict) -> dict:
    """`seeds`: {barrier: (a, [b...], canoe too, cut patch)} by entrance; `links` (pairs joined on foot) in
    seeds["links"]. Closed on foot (and by canoe where asked); the cut patch on, the spine's seeds must join."""
    S = meta["entrances"]
    on, off = with_patches(g, meta), with_patches(g, meta, bridge=False)
    r, ok = {}, True
    for name, (a, bs, by_canoe, patch) in seeds["barriers"].items():
        h = off if patch else on
        sfx = "_bridge_off" if patch else ""
        r[f"{name}_foot{sfx}"] = foot = any(joined(walk(h), S[a], S[x]) for x in bs)
        if patch:
            r[f"{name}_foot_bridge_on"] = any(joined(walk(on), S[a], S[x]) for x in bs)
            ok &= r[f"{name}_foot_bridge_on"]
        r[f"{name}_canoe{sfx}"] = boat = any(joined(canoe(h), S[a], S[x]) for x in bs)
        ok &= not foot and (not boat or not by_canoe)
    for name, (a, b) in seeds["links"].items():
        r[name] = joined(walk(on), S[a], S[b])
        ok &= r[name]
    return {"ok": bool(ok), **r}


def routes(g, meta) -> dict:
    res = {}
    for name, cells in meta["routes"].items():
        conn = joined(np.isin(g, ["r", "≈"]), cells[0], cells[-1])
        res[name] = {"connected": conn, "ford_cells": sum(1 for x, y in cells if g[y, x] == "=")}
    return {"ok": all(v["connected"] and not v["ford_cells"] for v in res.values()), **res}


def north(g, meta, north_regions: tuple[str, ...]) -> dict:
    h = with_patches(g, meta)
    boat = canoe(h)
    lab, sz = components(boat)
    isn = np.isin(meta["region"], [meta["regions"].index(r) for r in north_regions])
    bad = []
    for k in np.unique(lab[isn & (lab > 0)]):
        mixed = int(((lab == k) & ~isn).sum())
        if mixed:
            bad.append((int(k), int(sz[k]), mixed))
    dock_north = [d["id"] for d in meta["docks"] if any(isn[d["y"] + dy, d["x"] + dx] and boat[d["y"] + dy, d["x"] + dx]
                                                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    return {"ok": not bad and not dock_north, "mixed_components": bad[:6], "north_docks": dock_north}


def landings(g, meta, anchors: tuple[str, ...]) -> dict:
    h = with_patches(g, meta)
    w = walk(h)
    ents = {tuple(v) for v in meta["entrances"].values()}
    res = {}
    for e in anchors:
        d = bfs_dist(w, [tuple(meta["entrances"][e])])
        cells = [tuple(c[::-1]) for c in np.argwhere(np.isin(h, LANDING) & (d >= 0) & (d <= LANDING_STEPS))]
        res[e] = any(c not in ents for c in cells)
    return {"ok": all(res.values()), **res}


def _lane(h, a, b) -> bool:
    wat = h == "o"
    er = wat.copy()
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            er &= np.roll(np.roll(wat, dy, 0), dx, 1)

    def near(d):
        x, y = d["x"], d["y"]
        for r in range(0, 5):
            for yy in range(y - r, y + r + 1):
                for xx in range(x - r, x + r + 1):
                    if er[yy, xx]:
                        return (xx, yy)
        return None
    pa, pb = near(a), near(b)
    return bool(pa and pb and joined(er, pa, pb))


def straits(g, meta) -> dict:
    D = {d["id"]: d for d in meta["docks"]}
    hs = {False: with_patches(g, meta, True, False), True: with_patches(g, meta, True, True)}
    res = {name: _lane(hs[canal], D[a], D[b]) for name, a, b, canal in STRAITS}
    return {"ok": all(res.values()), **res}


def detours(g, meta) -> dict:
    S = meta["entrances"]
    w = walk(with_patches(g, meta))
    out = {}
    for a, b in DETOURS:
        d = bfs_dist(w, [tuple(S[a])])[S[b][1], S[b][0]]
        e = float(np.hypot(S[a][0] - S[b][0], S[a][1] - S[b][1]))
        out[f"{a}-{b}"] = round(d / e, 2) if d >= 0 else None
    d1 = bfs_dist(w, [tuple(S["ert_melmond"])])[S["ert_giant"][1], S["ert_giant"][0]]
    d2 = bfs_dist(w, [tuple(S["ert_giant_west"])])[S["ert_sarda"][1], S["ert_sarda"][0]]
    e = float(np.hypot(S["ert_melmond"][0] - S["ert_sarda"][0], S["ert_melmond"][1] - S["ert_sarda"][1]))
    out["ert_melmond-ert_sarda (tunnel)"] = round((d1 + d2) / e, 2) if d1 >= 0 and d2 >= 0 else None
    lim = {"ert_melmond-ert_sarda (tunnel)": TUNNEL_MAX}
    return {"ok": all(v is not None and v <= lim.get(k, DETOUR_MAX) for k, v in out.items()), **out}
