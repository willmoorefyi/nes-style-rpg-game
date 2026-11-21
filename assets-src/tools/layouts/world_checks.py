"""The world composer's global checks on the owner grid (docs/NATURAL_WORLD_PLAN.md 3.4, 3.7, 3.8; NW-4): pass W's
`world_checks.py` (ids, docks, anchors, reachability, the region tiling) fed by the NW owner grid instead of the
boxes, for the composer v2 (`world.py`), which prints them as one line, `world: OK (...)`.

  1. the raster: every region's `regions.<r>.raster` is chunk rects, each holding an owner cell of r; together they
     cover every chunk, and a chunk's bookkeeping owner (`owners.chunk_owner`) is a region whose raster holds it;
  2. ids: entrance, spot, dock, patch, NPC and zone ids are unique; a prefixed id (`<prefix>_...`, spots
     `<prefix>_s_<name>`) stands on a cell its region owns (a spot, an entrance or an NPC) and an unprefixed one is
     one of act 1's legacy ids (LEGACY) on an a1 cell;
  3. docks: exactly the DOCKS_ALLOWED ids, each once (the gate checks place them, `gates.docks`);
  4. anchors: every anchor of `assets/data/world-anchors.yaml` is an entrance within its tolerance;
  5. reach: with every patch on, every entrance is reachable on foot or by canoe from an arrival the game offers:
     Cornelia, a dock, or a cell the airship lands on (grass only), so no door stands in a sealed pocket.
Each check returns error strings; [] means OK.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import yaml

from world_api import CANAL_PATCH, CHUNK, DOCKS_ALLOWED, PREFIXES
from worldgen import gates, owners
from worldgen.geom import components

ANCHORS = Path(__file__).resolve().parents[3] / "assets" / "data" / "world-anchors.yaml"
LANDING = gates.LANDING                # grass only (NW2, D-NW2-4)
# act 1's ids from before the prefixes (pass W's world_a1.LEGACY_IDS): entrances, zones, NPCs and the bridge patch
LEGACY = frozenset({"cornelia", "cornelia_west", "cornelia_east", "cornelia_north", "castle", "north_shore", "temple",
                    "east_pocket", "temple_approach", "chest_tomb", "bridge_worker_w", "bridge_worker_e",
                    "north_bridge"})


def raster(region: np.ndarray, regions: tuple[str, ...], doc_regions: dict) -> list[str]:
    errs = []
    h, w = region.shape
    cover = np.zeros((h // CHUNK, w // CHUNK), int)
    for i, r in enumerate(regions):
        rects = (doc_regions.get(r) or {}).get("raster") or []
        if not rects:
            errs.append(f"raster: region {r} has none")
        for x0, y0, x1, y1 in rects:
            if x0 % CHUNK or y0 % CHUNK or (x1 + 1) % CHUNK or (y1 + 1) % CHUNK:
                errs.append(f"raster: {r} rect {[x0, y0, x1, y1]} is not chunk-aligned")
                continue
            for cy in range(y0 // CHUNK, (y1 + 1) // CHUNK):
                for cx in range(x0 // CHUNK, (x1 + 1) // CHUNK):
                    cover[cy, cx] += 1
                    if not (region[cy * CHUNK:(cy + 1) * CHUNK, cx * CHUNK:(cx + 1) * CHUNK] == i).any():
                        errs.append(f"raster: {r} lists chunk ({cx}, {cy}), which holds none of its cells")
    if (cover == 0).any():
        cy, cx = np.argwhere(cover == 0)[0]
        errs.append(f"raster: {int((cover == 0).sum())} chunks in no raster, first ({cx}, {cy})")
    for cy in range(h // CHUNK):
        for cx in range(w // CHUNK):
            o = regions[owners.chunk_owner(region, cx, cy)]
            if [cx * CHUNK, cy * CHUNK] not in [r[:2] for r in _chunks_of(doc_regions.get(o) or {})]:
                errs.append(f"raster: chunk ({cx}, {cy})'s owner {o} does not list it")
    return errs


def _chunks_of(reg: dict) -> list[list[int]]:
    return [[x, y0] for x0, y0, x1, _y1 in reg.get("raster") or [] for x in range(x0, x1 + 1, CHUNK)]


def ids(doc: dict, meta: dict, legacy: tuple[str, ...]) -> list[str]:
    errs, seen = [], {}
    pre = {v: k for k, v in PREFIXES.items()}
    named = [("entrance", e, tuple(c)) for e, c in doc["entrances"].items()]
    named += [("spot", s, tuple(v["at"])) for s, v in doc["spots"].items()]
    named += [("dock", d["id"], None) for d in doc["docks"]] + [("patch", p["id"], None) for p in doc["patches"]]
    named += [("NPC", n.get("id"), (n["x"], n["y"]) if "x" in n else None) for n in doc.get("npcs") or []]
    named += [("zone", z.get("id"), None) for z in doc.get("encounterZones") or []]
    for kind, i, at in named:
        if not isinstance(i, str):
            errs.append(f"ids: a {kind} has no id")
            continue
        if (kind, i) in seen:
            errs.append(f"ids: {kind} id {i!r} twice")
        seen[(kind, i)] = True
        p = i.split("_")[0]
        if kind == "spot" and not (p in pre and i.startswith(p + "_s_")):
            errs.append(f"ids: spot {i!r} is not <prefix>_s_<name>")
        elif p not in pre:
            if i not in LEGACY | set(legacy) and (kind, i) != ("patch", CANAL_PATCH):
                errs.append(f"ids: {kind} id {i!r} lacks a region prefix")
            elif at is not None and gates.owner(meta, *at) != "a1":
                errs.append(f"ids: act 1's {kind} {i} at {at} stands on a cell owned by {gates.owner(meta, *at)}")
        elif at is not None and gates.owner(meta, *at) != pre[p]:
            errs.append(f"ids: {kind} {i} at {at} stands on a cell owned by {gates.owner(meta, *at)}, not {pre[p]}")
    return errs


def docks(doc: dict) -> list[str]:
    have = [d["id"] for d in doc["docks"]]
    errs = [f"docks: {i} is not in DOCKS_ALLOWED" for i in have if i not in DOCKS_ALLOWED]
    errs += [f"docks: {i} placed {have.count(i)} times" for i in sorted(set(have)) if have.count(i) != 1]
    return errs + [f"docks: {i} is not placed" for i in DOCKS_ALLOWED if i not in have]


def anchors(entrances: dict, path: Path = ANCHORS) -> list[str]:
    a = yaml.safe_load(path.read_text(encoding="utf-8"))
    tol, errs = a["tolerance"], []
    for row in a["anchors"]:
        at = entrances.get(row["entrance"])
        if at is None:
            errs.append(f"anchors: {row['entrance']} ({row['region']}) is not an entrance")
        elif max(abs(at[0] - row["target"][0]), abs(at[1] - row["target"][1])) > tol:
            errs.append(f"anchors: {row['entrance']} at {tuple(at)} is more than {tol} from {tuple(row['target'])}")
    return errs


def reach(g: np.ndarray, meta: dict, root: str = "cornelia") -> list[str]:
    h = gates.with_patches(g, meta)
    lab, _ = components(gates.canoe(h))      # on foot, or by canoe once it is held (the waterfall's ledge)
    good = {int(lab[meta["entrances"][root][1], meta["entrances"][root][0]])}
    for d in meta["docks"]:
        good |= {int(lab[d["y"] + dy, d["x"] + dx]) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))}
    good |= {int(k) for k in np.unique(lab[np.isin(h, LANDING)])}
    good.discard(0)
    return [f"reach: entrance {e} at {tuple(c)} ({gates.owner(meta, *c)}) is reachable from no arrival (Cornelia, "
            "a dock, a landing cell)" for e, c in meta["entrances"].items() if int(lab[c[1], c[0]]) not in good]


def check(g: np.ndarray, meta: dict, doc: dict, legacy: tuple[str, ...]) -> tuple[list[str], str]:
    """(errors, the summary for the `world: OK (...)` line)."""
    errs = raster(meta["region"], meta["regions"], doc["regions"]) + ids(doc, meta, legacy) + docks(doc)
    errs += anchors(doc["entrances"]) + reach(g, meta)
    n = sum(len(_chunks_of(r)) for r in doc["regions"].values())
    summary = (f"{len(doc['entrances'])} entrances, {len(doc['spots'])} spots, {len(doc['docks'])} docks, "
               f"{len(doc['patches'])} patches; {len(meta['regions'])} regions, {n} raster chunks over "
               f"{(g.shape[0] // CHUNK) * (g.shape[1] // CHUNK)}")
    return errs, summary
