"""The compose checks of the land gates (docs/NATURAL_WORLD_PLAN.md 3.8, 4.1; NW-2, hardened in NW-4): barriers on
foot and by canoe with their minimal cuts (`world.cuts`), north isolation, airship landings and walking detours.

- **barriers** (all on): each barrier's seed is joined to none of the cells beyond it on foot, nor on foot plus
  canoe (River and Lake passable) for the canoe barriers (world_api_v2.CANOE_BARRIERS: `spine`, `western_range`);
  `crescent_ring` is closed on foot only, since R-volcano and R-ice cross it by design. The spine is checked with
  the bridge patch off; with it on its seeds join, and its minimal vertex cut is exactly one row of the patch's cells
  (the bridge is the spine's only cut). Each barrier's minimal cut (the fewest non-walkable land cells across the
  barrier that, opened, join its seeds) is exported; for the spine that is the patch's gap, and every cut that
  avoids the patch is longer. The `links` (pairs that must join on foot) are checked too.
- **north** (all on): every walk+canoe component holding a cell owned by WATER, ORDEAL or WIND holds only such
  cells, and no dock touches one.
- **routes**: `gates.routes` plus the ledge rule (a canoe-only site is reached only by its route's river).
- **landings** (all on): every airship-only anchor has a landing cell (grass or tundra, never snow; no entrance,
  transition, gate or NPC) within 8 grid steps (the verifier's T6 rule), and every `landing` spot is such a
  cell.
"""
from __future__ import annotations

import numpy as np

from .cuts import min_cut, vertex_cut
from . import gates
from .gates import LANDING, WALL_GROW, canoe, cells, grow, joined, mask_cells, owner, walk, with_patches
from .geom import bfs_dist, components, ring1

LANDING_STEPS = 8
# WORLD 6.1's walking detour hops (2.5; melmond-sarda through the tunnel 3.0)
DETOURS = (("cornelia", "a1_pravoka"), ("cornelia", "a1_matoya"), ("elf_elfheim", "elf_keep"),
           ("elf_elfheim", "elf_marsh"), ("ert_melmond", "ert_earth_cave"), ("ert_melmond", "ert_giant"),
           ("fir_ice", "fir_desert"))
DETOUR_MAX, TUNNEL_MAX = 2.5, 3.0


def _one(shape, c) -> np.ndarray:
    m = np.zeros(shape, bool)
    m[c[1], c[0]] = True
    return m


def barriers(g, meta, seeds: dict, canoe_barriers: tuple[str, ...] = ("spine", "western_range"),
             doors: np.ndarray | None = None) -> dict:
    """`seeds`: {"barriers": {name: (seed, [beyond...], _canoe, cut by the bridge patch)}, "links": {name: (a, b)}},
    by entrance (bundle.RegionSpec.barrier_seeds / links)."""
    S = meta["entrances"]
    on, off = with_patches(g, meta), with_patches(g, meta, bridge=False)
    closed = np.zeros(g.shape, bool) if doors is None else doors.copy()
    r, why, cuts = {}, [], {}
    for name, (a, bs, _canoe, patch) in seeds["barriers"].items():
        h = off if patch else on
        sfx = "_bridge_off" if patch else ""
        foot = [x for x in bs if joined(walk(h), S[a], S[x])]
        boat = [x for x in bs if joined(canoe(h), S[a], S[x])]
        r[f"{name}_foot{sfx}"], r[f"{name}_canoe{sfx}"] = bool(foot), bool(boat)
        if foot:
            why.append(f"barrier {name}: {a} {cells(meta, [S[a]])} joins {foot} on foot")
        if boat and name in canoe_barriers:
            why.append(f"barrier {name}: {a} {cells(meta, [S[a]])} joins {boat} by canoe (River / Lake)")
        w = walk(h)
        ends = np.zeros(g.shape, bool)
        for x in bs:
            ends[S[x][1], S[x][0]] = True
        cost = ~w & (h != "o") & ~closed
        if patch:                            # the spine: its cut may open the bridge's gap (Water, patch off)
            for x, y in meta["bridge"]:
                cost[y, x] = not w[y, x]
            cut = min_cut(w, cost, _one(g.shape, S[a]), ends)
        else:                                # the others: across the barrier's own cells (its mask, grown as needed)
            area, n, cut = meta["barriers"][name], 0, []
            while not cut and n <= WALL_GROW:
                cut = min_cut(w, cost & area, _one(g.shape, S[a]), ends)
                area, n = grow(area), n + 1
            r[f"{name}_cut_grown"] = n - 1
        cuts[name] = [list(c) for c in cut]
        if not cut and not foot:
            why.append(f"barrier {name}: no cut across it joins {a} to {list(bs)}")
        if patch:
            why += _spine(g, meta, name, S[a], [S[x] for x in bs], on, off, cut, cuts, r)
    for name, (a, b) in seeds["links"].items():
        r[name] = joined(walk(on), S[a], S[b])
        if not r[name]:
            why.append(f"link {name}: {a} {cells(meta, [S[a]])} and {b} {cells(meta, [S[b]])} are apart on foot")
    return {"ok": not why, **r, "cuts": cuts, "why": why}


def _spine(g, meta, name, a, bs, on, off, cut, cuts, r) -> list[str]:
    """The bridge patch is the spine's only cut (3.8): on, the seeds join, and the minimal vertex cut is one row of
    patch cells; off, its minimal cut is patch cells, and any cut avoiding the patch is longer."""
    why = []
    patch = {tuple(c) for c in meta["bridge"]}
    r[f"{name}_foot_bridge_on"] = all(joined(walk(on), a, b) for b in bs)
    if not r[f"{name}_foot_bridge_on"]:
        why.append(f"barrier {name}: the bridge patch on does not join its seeds")
        return why
    sep = vertex_cut(walk(on), tuple(a), tuple(bs[0]))
    rows = {}
    for x, y in sorted(patch):
        rows.setdefault(y, []).append((x, y))
    def without(row):
        m = walk(on)
        for x, y in row:
            m[y, x] = False
        return m
    row_cut = [row for row in rows.values() if sep is not None and len(row) == len(sep)
               and not joined(without(row), a, bs[0])]
    r[f"{name}_vertex_cut"] = len(sep) if sep is not None else None
    if not row_cut:
        why.append(f"barrier {name}: its minimal cut with the bridge on ({cells(meta, sep or [])}) is not a row of "
                   "the bridge patch")
    if not cut or not set(map(tuple, cut)) <= patch:
        why.append(f"barrier {name}: its minimal cut with the bridge off is {cells(meta, cut)}, not patch cells")
    w = walk(off)
    block = np.zeros(g.shape, bool)
    for x, y in patch:
        block[y, x] = True
    ends = np.zeros(g.shape, bool)
    for x, y in bs:
        ends[y, x] = True
    other = min_cut(w & ~block, ~w & ~block & (off != "o"), _one(g.shape, a), ends)
    r[f"{name}_cut_avoiding_bridge"] = len(other)
    if other and len(other) <= len(cut):
        why.append(f"barrier {name}: a cut avoiding the bridge is as short ({len(other)} cells) at "
                   f"{cells(meta, other)}")
    return why


def routes(g, meta) -> dict:
    """`gates.routes` plus 4.1's ledge rule: a canoe-only site (`meta["ledges"]`, the waterfall) is walkable only
    on its ledge, which touches only rock and its route's river: its walk component (every patch on) holds no cell
    the airship lands on and borders a pinned route cell."""
    res = gates.routes(g, meta)
    h = with_patches(g, meta)
    lab, _ = components(walk(h))
    wet = np.isin(h, ["r", "≈"])
    wlab, _ = components(wet)
    routed = {int(wlab[y, x]) for cs in meta["routes"].values() for x, y in cs if wlab[y, x]}
    for e in meta.get("ledges") or []:
        x, y = meta["entrances"][e]
        mine = lab == lab[y, x]
        ring = ring1(mine) & ~mine
        other = ring & ~wet & (h != "m")
        touches = bool(set(np.unique(wlab[ring & wet]).tolist()) & routed)
        res[f"{e}_ledge"] = {"cells": int(mine.sum()), "other_neighbours": int(other.sum()), "on_route": touches}
        if other.any() or not touches:
            res["why"].append(f"ledge {e}: its walk component ({int(mine.sum())} cells) borders "
                              f"{cells(meta, mask_cells(other)) or 'only rock and river'}; on its route's river: "
                              f"{touches} (want only rock and river, and the route)")
    res["ok"] = not res["why"]
    return res


def north(g, meta, north_regions: tuple[str, ...]) -> dict:
    h = with_patches(g, meta)
    boat = canoe(h)
    lab, sz = components(boat)
    isn = np.isin(meta["region"], [meta["regions"].index(r) for r in north_regions])
    bad, why = [], []
    for k in np.unique(lab[isn & (lab > 0)]):
        mixed = (lab == k) & ~isn
        if mixed.any():
            bad.append((int(k), int(sz[k]), int(mixed.sum())))
            why.append(f"a walk+canoe component of {int(sz[k])} cells joins the north to "
                       f"{cells(meta, mask_cells(mixed))}")
    dock_north = [d["id"] for d in meta["docks"] if any(isn[d["y"] + dy, d["x"] + dx] and boat[d["y"] + dy, d["x"] + dx]
                                                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    why += [f"dock {i} touches a northern component" for i in dock_north]
    return {"ok": not why, "mixed_components": bad[:6], "north_docks": dock_north,
            "north_components": int(len(np.unique(lab[isn & (lab > 0)]))), "why": why}


def landings(g, meta, anchors: tuple[str, ...], spots: dict | None = None, taken: set | None = None) -> dict:
    """`taken`: the cells no airship may land on (entrances, transitions, gates, NPCs)."""
    h = with_patches(g, meta)
    taken = set(taken or ()) | {tuple(v) for v in meta["entrances"].values()}
    land = np.isin(h, LANDING)
    res, why = {}, []
    yy, xx = np.mgrid[0:g.shape[0], 0:g.shape[1]]
    for e in anchors:                        # the verifier's T6 rule (questTravel.landingNear): grid steps
        ex, ey = meta["entrances"][e]
        d = np.abs(xx - ex) + np.abs(yy - ey)
        near = [c for c in mask_cells(land & (d <= LANDING_STEPS)) if c not in taken]
        res[e] = bool(near)
        if not near:
            why.append(f"anchor {e} {cells(meta, [meta['entrances'][e]])}: no landing cell within "
                       f"{LANDING_STEPS} steps")
    for k, s in (spots or {}).items():
        x, y = s["at"]
        if s.get("kind") == "landing" and (h[y, x] not in LANDING or (x, y) in taken):
            why.append(f"spot {k} {cells(meta, [(x, y)])} is a landing on {str(h[y, x])!r} (grass or tundra, free)")
    return {"ok": not why, **res, "why": why}


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
    why = [f"detour {k}: {v} over {lim.get(k, DETOUR_MAX)}" for k, v in out.items()
           if v is None or v > lim.get(k, DETOUR_MAX)]
    return {"ok": not why, **out, "why": why}


__all__ = ["barriers", "routes", "north", "landings", "detours", "owner"]
