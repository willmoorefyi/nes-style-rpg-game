"""The regions' own content on the NW world (docs/NATURAL_WORLD_PLAN.md 3.3, 3.5, 3.8 `coverage`; NW-R).

A region spec module (`world_specs/<region>.py`) may define `content(g, meta) -> dict`: its icons, dressing, NPCs,
inspect cells, vehicles, ambient effects and encounter zones on the composed ground, its zones' battle backdrops and
its map_checks_region options. It may stamp small ground edits on `g` in place, on its own cells only
(the rock under an icon, a sea-stack): the composer calls it right after the generator, before the transitions,
spots, checks and metrics read the ground. `merge` collects every region's in `REGIONS` order; `coverage` is the 3.8
check for the regions that place zones (every walkable or canoe cell a region owns is in one of its zones).

Keys of a region's dict (all optional): CONTENT_LISTS; `backdrops` {zone id: {default?, terrain?}}; `checks` (its
`regions.<r>.checks`, the map_checks_region options).
"""
from __future__ import annotations

import importlib

import numpy as np

from worldgen import gates

CONTENT_LISTS = ("objects", "inspect", "npcs", "vehicles", "ambient", "encounterZones")
DEFAULT_MODES = ("walking", "canoe")          # a zone without `modes` (the runtime's default)


def merge(g: np.ndarray, meta: dict) -> dict:
    out: dict = {k: [] for k in CONTENT_LISTS}
    out.update(backdrops={}, checks={}, zones_of={})
    for r in meta["regions"]:
        fn = getattr(importlib.import_module(f"world_specs.{r}"), "content", None)
        if fn is None:
            continue
        c = fn(g, meta)
        for k in CONTENT_LISTS:
            out[k] += [dict(i) for i in c.get(k) or []]
        out["backdrops"].update(c.get("backdrops") or {})
        if c.get("checks"):
            out["checks"][r] = dict(c["checks"])
        if c.get("encounterZones"):
            out["zones_of"][r] = [z["id"] for z in c["encounterZones"]]
    return out


def _mask(shape: tuple[int, int], rects: list) -> np.ndarray:
    m = np.zeros(shape, bool)
    for x0, y0, x1, y1 in rects:
        m[y0:y1 + 1, x0:x1 + 1] = True
    return m


def coverage(g: np.ndarray, meta: dict, zones: list[dict], zones_of: dict) -> dict:
    """3.8 `coverage` (patches off), for each region that places zones: its walkable cells in a walking zone of its
    own, its River and Lake cells in a canoe zone of its own. The other regions are listed as pending."""
    walk, wet = gates.walk(g), np.isin(g, ["r", "≈"])
    why, done = [], []
    for r, ids in zones_of.items():
        mine = meta["region"] == meta["regions"].index(r)
        wz, cz = np.zeros(g.shape, bool), np.zeros(g.shape, bool)
        for z in zones:
            if z["id"] in ids:
                m, modes = _mask(g.shape, z["rects"]), z.get("modes") or DEFAULT_MODES
                wz |= m if "walking" in modes else False
                cz |= m if "canoe" in modes else False
        miss = (mine & walk & ~wz) | (mine & wet & ~cz)
        if miss.any():
            ys, xs = np.nonzero(miss)
            why.append(f"coverage: {r}: {int(miss.sum())} walkable or canoe cells in no zone of {r}, first "
                       + ", ".join(f"({x}, {y})" for y, x in list(zip(ys, xs))[:6]))
        done.append(r)
    pending = [r for r in meta["regions"] if r not in zones_of]
    return {"ok": not why, "why": why, "regions": done, "pending": pending}
