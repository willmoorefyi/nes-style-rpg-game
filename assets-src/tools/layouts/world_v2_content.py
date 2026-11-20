"""The regions' own content on the NW world (docs/NATURAL_WORLD_PLAN.md 3.3, 3.5, 3.8 `coverage`; NW-R, NW-RINT).

The one content hook of the composer v2. A region spec module (`world_specs/<region>.py`) may define
`content(g, meta, ctx) -> dict`: its icons, dressing, NPCs, inspect cells, vehicles, ambient effects, hazards and
encounter zones on the composed ground, its zones' battle backdrops and its `regions.<r>` record (map_checks_region
options and the like). It may stamp small ground edits on `g` in place, on its own cells only (the rock under an
icon, a sea-stack): the composer calls every region in `REGIONS` order right after the generator and the
transitions, before the spots, checks and metrics read the ground. `ctx` (`Ctx`) carries what some regions read:
the door offsets, the merged spec, the transitions and the taken cells (transitions, gates, entrances, docks).
`merge` collects them; `coverage` is the 3.8 check for the regions that place zones (every walkable cell a region
owns is in one of its walking zones, every River and Lake cell in one of its canoe zones), one entry per region.

Keys of a region's dict (all optional): CONTENT_LISTS; `backdrops` {zone id: {default?, terrain?}}; `checks` (its
map_checks_region options, written as `regions.<r>.checks`); `region` (more `regions.<r>` keys, e.g. ELF's `land`);
`patches` {patch id: extra keys} (EARTH's canal dressing). `errors` join the `pins` check; `road_islands` (a cell
of each of a region's own road networks) become `road_check.islands_ok`.
"""
from __future__ import annotations

import importlib
from dataclasses import dataclass

import numpy as np

from worldgen import gates

CONTENT_LISTS = ("objects", "inspect", "npcs", "vehicles", "ambient", "hazards", "encounterZones", "errors",
                 "road_islands")
DEFAULT_MODES = ("walking", "canoe")          # a zone without `modes` (the runtime's default)


@dataclass(frozen=True)
class Ctx:
    doors: dict                               # entrance -> door offset (dx, dy)
    bundle: object                            # the merged RegionSpec (sites, spots, ...)
    trans: list                               # every overworld transition at its new cell
    taken: frozenset                          # transition, gate, entrance and dock cells


def merge(g: np.ndarray, meta: dict, ctx: Ctx) -> dict:
    out: dict = {k: [] for k in CONTENT_LISTS}
    out.update(backdrops={}, regions={}, patches={}, zones_of={})
    for r in meta["regions"]:
        fn = getattr(importlib.import_module(f"world_specs.{r}"), "content", None)
        if fn is None:
            continue
        c = fn(g, meta, ctx)
        for k in CONTENT_LISTS:
            out[k] += [dict(i) if isinstance(i, dict) else i for i in c.get(k) or []]
        out["backdrops"].update(c.get("backdrops") or {})
        rec = dict(c.get("region") or {})
        if c.get("checks"):
            rec["checks"] = dict(c["checks"])
        if rec:
            out["regions"][r] = rec
        for pid, extra in (c.get("patches") or {}).items():
            out["patches"].setdefault(pid, {}).update(extra)
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
