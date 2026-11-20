"""The compose checks of the sea gates (docs/NATURAL_WORLD_PLAN.md 3.8, 4.1; NW-2, hardened in NW-4): basins with the
canal pass, docks, walls (with their minimal water cuts, `world.cuts`), straits and routes, on the composed ground
with the stated patches. The reach checks (barriers, north, landings, detours) are `gates_reach.py`.

Each check returns a dict with `ok`, its figures and, on a failure, `why`: lines naming the rule, the region (the
owner grid's, 3.4) and the cells. NW-0's pilot checks, made generic over the merged spec (`bundle.RegionSpec`).
"""
from __future__ import annotations

import numpy as np

from .cuts import min_cut
from .geom import components, flood

BLOCK = ["o", "m", "r", "≈"]                 # on foot
WET = ["o", "r", "≈"]                        # no wall cell may be any of these (3.8 `walls`)
LANDING = [".", "t"]                         # the airship lands on grass and tundra, never on snow (D-NW9)
STRAIT_W = 3                                 # a ship lane is at least 3 Water cells wide (3x3 erosion)
WALL_W = 3                                   # a wall's minimal water cut is at least this many cells (its width)
WALL_GROW = 12                               # ... searched in its mask grown by at most this many steps
CANAL_LEN = (5, 8)                           # 4.1: the canal saddle is 5-8 cells long
# WORLD 2.6's ship lanes: (name, dock a, dock b, canal open)
STRAITS = (("pravoka-elf_port", "a1_pravoka", "elf_port", False), ("pravoka-dwarf", "a1_pravoka", "ert_dwarf", False),
           ("dwarf-melmond (canal)", "ert_dwarf", "ert_melmond", True),
           ("melmond-crescent", "ert_melmond", "fir_crescent", True))
SHOW = 6                                     # cells listed per failure line


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


def owner(meta: dict, x: int, y: int) -> str:
    return meta["regions"][int(meta["region"][y, x])]


def cells(meta: dict, pts, n: int = SHOW) -> str:
    """`elf (12, 30), (13, 30) ...`: the first n cells, each run of one region named once."""
    out, last = [], None
    pts = [(int(x), int(y)) for x, y in pts]
    for x, y in pts[:n]:
        r = owner(meta, x, y)
        out.append(f"{r + ' ' if r != last else ''}({x}, {y})")
        last = r
    return ", ".join(out) + (f" ... ({len(pts)} cells)" if len(pts) > n else "")


def mask_cells(m: np.ndarray) -> list[tuple[int, int]]:
    return [(int(x), int(y)) for y, x in np.argwhere(m)]


def seas(off: np.ndarray, meta: dict) -> tuple[np.ndarray, np.ndarray]:
    """The aldi and ocean basins (boolean masks) of a ground with every patch off."""
    (ax, ay), (ox, oy) = meta["seeds"]["aldi"], meta["seeds"]["ocean"]
    lab, _ = components(off == "o")
    return (lab == lab[ay, ax]) & (off[ay, ax] == "o"), (lab == lab[oy, ox]) & (off[oy, ox] == "o")


def basins(g, meta) -> dict:
    """Patches off: aldi and ocean disjoint, no Water in neither; the canal on joins them; every dock in its basin
    (every patch on but the canal); the canal pass (`canal`)."""
    off = with_patches(g, meta, False, False)
    aldi, ocean = seas(off, meta)
    why = []
    if (aldi & ocean).any() or not aldi.any():
        leak = [c for c in mask_cells(aldi & ocean) if any(m[c[1], c[0]] for m in meta["wall_masks"].values())]
        why.append(f"aldi and ocean are one sea with every patch off (Water in a wall: "
                   f"{cells(meta, leak) if leak else 'none; a coast elsewhere'})")
    stray = (off == "o") & ~aldi & ~ocean
    if stray.any():
        why.append(f"{int(stray.sum())} Water cells in neither basin: {cells(meta, mask_cells(stray))}")
    a2, o2 = seas(with_patches(g, meta, True, True), meta)
    joins = bool((a2 & o2).any())
    if not joins:
        why.append("the canal patch on does not join aldi and ocean")
    on = with_patches(g, meta, True, False)
    a3, o3 = seas(on, meta)
    docks = []
    for d in meta["docks"]:
        inside = bool((a3 if d["basin"] == "aldi" else o3)[d["y"], d["x"]])
        docks.append((d["id"], inside))
        if not inside:
            why.append(f"dock {d['id']} at {cells(meta, [(d['x'], d['y'])])} is not in its basin {d['basin']}")
    cp = canal(g, meta, aldi, ocean)
    why += cp["why"]
    return dict(ok=not why, aldi_cells=int(aldi.sum()), ocean_cells=int(ocean.sum()),
                disjoint=bool(not (aldi & ocean).any()), stray_water=int(stray.sum()), canal_joins=joins, docks=docks,
                canal=cp["figures"], why=why)


def canal(g, meta, aldi, ocean) -> dict:
    """4.1's canal pass: patch off, its cells are walkable land, 5-8 cells long across the isthmus, one end on the
    Aldi and the other on the ocean."""
    cs = [tuple(c) for c in meta["canal"]]
    why = []
    if not cs:
        return {"why": ["no canal patch cells"], "figures": {}}
    dry = [c for c in cs if not walk(g)[c[1], c[0]]]
    if dry:
        why.append(f"canal cells not walkable with the patch off: {cells(meta, dry)}")
    xs, ys = [c[0] for c in cs], [c[1] for c in cs]
    length = max(max(xs) - min(xs), max(ys) - min(ys)) + 1
    if not CANAL_LEN[0] <= length <= CANAL_LEN[1]:
        why.append(f"the canal is {length} cells long (want {CANAL_LEN[0]}-{CANAL_LEN[1]}): {cells(meta, cs)}")
    near = {(x + dx, y + dy) for x, y in cs for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))} - set(cs)
    ends = {"aldi": any(aldi[y, x] for x, y in near), "ocean": any(ocean[y, x] for x, y in near)}
    why += [f"the canal does not meet the {k} (its ends {cells(meta, sorted(near))})" for k, v in ends.items() if not v]
    return {"why": why, "figures": {"cells": len(cs), "length": length, **{f"meets_{k}": v for k, v in ends.items()}}}


def docks(g, meta, allowed: dict | None = None) -> dict:
    """All on: every dock is an allowed id (once), in its basin's sea, on Water beside a walkable cell, and its land
    is owned by the dock's region (`allowed`: world_api.DOCKS_ALLOWED)."""
    h = with_patches(g, meta)
    w = walk(h)
    why, seen = [], set()
    for d in meta["docks"]:
        x, y, i = d["x"], d["y"], d["id"]
        land = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if w[y + dy, x + dx]]
        if h[y, x] != "o" or not land:
            why.append(f"dock {i} at {cells(meta, [(x, y)])} is not Water beside a walkable cell")
        spec = (allowed or {}).get(i)
        if allowed is not None and (spec is None or spec.basin != d["basin"] or i in seen):
            why.append(f"dock {i} at {cells(meta, [(x, y)])} is not allowed (DOCKS_ALLOWED, once, basin {d['basin']})")
        elif spec is not None and land and all(owner(meta, *c) != spec.region for c in land):
            why.append(f"dock {i}: its land {cells(meta, land)} is not owned by {spec.region}")
        seen.add(i)
    missing = sorted(set(allowed or ()) - seen)
    why += [f"dock {i} is missing" for i in missing]
    return {"ok": not why, "docks": len(meta["docks"]), "why": why}


def grow(m: np.ndarray) -> np.ndarray:
    """The mask and its 8 neighbours (one Chebyshev step)."""
    out = m.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


def walls(g, meta, doors: np.ndarray | None = None) -> dict:
    """All off: each wall line (its mask) is one piece of land with no Water, River or Lake cell in it, and its
    minimal water cut (the fewest of its land cells that, opened to Water, join aldi and ocean; doors and patch cells
    never) is at least WALL_W cells: so the wall is that wide where it is thinnest. A wall whose mask does not reach
    both seas (the Aldi's shore there is other land) is cut through its mask grown by `grow` steps until a cut exists
    (at most WALL_GROW; the figure `grown`). The cuts are exported as `world.cuts` (`result["cuts"]`)."""
    off = with_patches(g, meta, False, False)
    aldi, ocean = seas(off, meta)
    closed = np.zeros(g.shape, bool) if doors is None else doors.copy()
    for x, y in list(meta["canal"]) + list(meta["bridge"]):
        closed[y, x] = True
    why, res, cuts = [], {}, {}
    for k, m in meta["wall_masks"].items():
        wet = m & np.isin(off, WET)
        _lab, sz = components(m & ~np.isin(off, WET))
        area, n, cut = m, 0, []
        while n <= WALL_GROW:
            cut = min_cut(off == "o", area & (off != "o") & ~closed, aldi, ocean)
            if cut:
                break
            area, n = grow(area), n + 1
        res[k] = {"wet_cells": int(wet.sum()), "pieces": len(sz) - 1, "cut": len(cut), "grown": n}
        cuts[k] = [list(c) for c in cut]
        if wet.any():
            why.append(f"wall {k}: Water / River / Lake in it at {cells(meta, mask_cells(wet))}")
        if len(sz) - 1 != 1:
            why.append(f"wall {k}: broken into {len(sz) - 1} pieces of land")
        if len(cut) < WALL_W:
            why.append(f"wall {k}: its minimal water cut is {len(cut)} cells (want >= {WALL_W}) at "
                       f"{cells(meta, cut) if cut else 'nowhere (no cut joins aldi and ocean)'}")
    return {"ok": not why, "water_cells_in_wall_core_3wide": {k: v["wet_cells"] for k, v in res.items()},
            "walls": res, "cuts": cuts, "why": why}


def routes(g, meta) -> dict:
    """All on: each pinned canoe route joins its ends over River / Lake, has no bridge or ford `=` on it, and no
    River / Lake component joins the routes of two regions (an unpinned river between them)."""
    h = with_patches(g, meta)
    wet = np.isin(h, ["r", "≈"])
    lab, _ = components(wet)
    res, why, comp = {}, [], {}
    for name, cs in meta["routes"].items():
        conn = joined(wet, cs[0], cs[-1])
        fords = [c for c in cs if h[c[1], c[0]] == "="]
        res[name] = {"connected": conn, "ford_cells": len(fords)}
        if not conn:
            why.append(f"route {name}: its ends {cells(meta, [cs[0], cs[-1]])} are not joined by River / Lake")
        if fords:
            why.append(f"route {name}: a bridge or ford on it at {cells(meta, fords)}")
        for k in {int(lab[y, x]) for x, y in cs if lab[y, x]}:
            comp.setdefault(k, set()).add((owner(meta, *cs[0]), name))
    for k, rs in sorted(comp.items()):
        if len({r for r, _ in rs}) > 1:
            why.append(f"one River / Lake system joins the routes {sorted(n for _, n in rs)} of regions "
                       f"{sorted({r for r, _ in rs})}")
    return {"ok": not why, **res, "why": why}


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
    """All on but the canal (the canal's lane with it on): each WORLD 2.6 ship lane is >= 3 Water cells wide."""
    D = {d["id"]: d for d in meta["docks"]}
    hs = {False: with_patches(g, meta, True, False), True: with_patches(g, meta, True, True)}
    res = {name: _lane(hs[canal], D[a], D[b]) for name, a, b, canal in STRAITS}
    why = [f"lane {n} ({a} {cells(meta, [(D[a]['x'], D[a]['y'])])} to {b}) is under {STRAIT_W} Water cells wide"
           for n, a, b, _c in STRAITS if not res[n]]
    return {"ok": not why, **res, "why": why}
