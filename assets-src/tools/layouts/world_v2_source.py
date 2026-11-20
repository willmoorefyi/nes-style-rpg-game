"""The composer v2's content and writer (docs/NATURAL_WORLD_PLAN.md 3.1 `stamps` / `source`, 3.3, 5.2; NW-2).

On the generated ground the composer places the world's content: every overworld transition and key-item gate at its
entrance's new cell (act 1's from its pins, `a1/world_a1_pins.py`; the others at their door offset from today's
world, `world_specs/today_doors.py`), act 1's objects, inspect cells, NPCs and its vehicle where they lie wholly in
its kept cells (NW-0's rule; the other regions' icons and dressing are their NW-R work), the patches, the docks and
the spots. `write` emits `assets-src/maps-nw/overworld.yaml` in the map-source format of `common.write_map` (header,
the head keys, the ground block, the rest).
"""
from __future__ import annotations

import importlib
import importlib.util
from pathlib import Path

import numpy as np
import yaml

from a1 import world_a1_pins as P
from world_api_v2 import PREFIXES, REGIONS
from world_specs import today_doors as TD
from worldgen import spec as S
from worldgen.gates import BLOCK
from worldgen.geom import components, flood

OUT = Path(__file__).resolve().parents[2] / "maps-nw" / "overworld.yaml"
HEAD = ("id", "name", "kits", "music")


def _a1(o: dict) -> dict:
    """An act-1 record (Cornelia-relative x, y) at its world cell."""
    x, y = S.world((o["x"], o["y"]))
    return {**o, "x": x, "y": y}


def doors() -> tuple[dict, dict]:
    """(entrance -> door offset, entrance -> door targetMap): act 1's from its pins, the rest from today's world."""
    d = {**TD.door_of(P.ENTRANCES, P.TRANSITIONS), **TD.door_of(TD.entrances(), TD.transitions())}
    return {e: off for e, (off, _t) in d.items()}, {e: t["targetMap"] for e, (_o, t) in d.items()}


def transitions(sites: dict) -> list[dict]:
    """Every overworld transition at its entrance's new cell: act 1's pins, then today's others (today's order)."""
    out = [_a1(t) for t in P.TRANSITIONS]
    ents = TD.entrances()
    for t in TD.transitions():
        e = t.pop("_entrance")
        ex, ey = ents[e]
        out.append({**t, "x": int(sites[e][0] + t["x"] - ex), "y": int(sites[e][1] + t["y"] - ey)})
    return out


def gates() -> list[dict]:
    return [_a1(g) for g in P.GATES]


def _inside(keep: np.ndarray, x: int, y: int, w: int, h: int) -> bool:
    n = keep.shape[0]
    return all(keep[y + j, x + i] for j in range(-1, h + 1) for i in range(-1, w + 1)
               if 0 <= y + j < n and 0 <= x + i < n)


def act1_content(keep: np.ndarray) -> tuple[list[dict], list[dict]]:
    """Act 1's objects and inspect cells that lie wholly (with a one-cell ring) in its kept cells."""
    objs = []
    for o in map(_a1, P.OBJECTS):
        parts = o.get("parts") or [[None]]
        if _inside(keep, o["x"], o["y"], max(len(r) for r in parts), len(parts)):
            objs.append(o)
    insp = [i for i in map(_a1, P.INSPECT) if _inside(keep, i["x"], i["y"], 1, 1)]
    return objs, insp


def act1_people(g: np.ndarray, keep: np.ndarray) -> tuple[list[dict], list[dict]]:
    """Act 1's NPCs (the bridge workers, the tomb chest) on their kept walkable cells, and its vehicle (the brig at
    the `a1_pravoka` dock) on its kept Water cell."""
    npcs = [n for n in map(_a1, P.NPCS) if _inside(keep, n["x"], n["y"], 1, 1) and g[n["y"], n["x"]] not in BLOCK]
    ships = [v for v in map(_a1, P.VEHICLES) if keep[v["y"], v["x"]] and g[v["y"], v["x"]] == "o"]
    return npcs, ships


def covered(objs: list[dict]) -> set:
    """Every cell of an object's parts box (no spot is resolved under an icon or a deco)."""
    out = set()
    for o in objs:
        parts = o.get("parts") or [[None]]
        out |= {(o["x"] + i, o["y"] + j) for j in range(len(parts)) for i in range(max(len(r) for r in parts))}
    return out


def unreachable(g: np.ndarray, ents: dict, root: str = "cornelia") -> list[str]:
    """The entrances the compiler's reachability check may not reach from the root on foot (patches off)."""
    seen = flood(~np.isin(g, BLOCK), [tuple(ents[root])])
    return [e for e, (x, y) in ents.items() if not seen[y, x]]


def reach_roots(g: np.ndarray, ents: dict, cover: set) -> list:
    """The compiler's reach roots: every entrance (its door's land), then one cell of each walkable component that
    holds no entrance (the islands kept for the look, Q9's default): every transition is reached from its own land."""
    walk = ~np.isin(g, BLOCK)
    for x, y in cover:
        walk[y, x] = False
    lab, _ = components(walk)
    have = {int(lab[y, x]) for x, y in ents.values()}
    roots: list = list(ents)
    for k in range(1, int(lab.max()) + 1):
        if k not in have:
            y, x = np.argwhere(lab == k)[0]
            roots.append([int(x), int(y)])
    return roots


def region_content(g: np.ndarray, meta: dict, doors: dict) -> dict:
    """The regions' own content (NW-R, 3.3, 3.5): each region with a module `layouts/<r>/world_nw.py` has its
    `content(g, meta, doors)` stamp its ground in place (inside its pins) and return its objects, inspect cells,
    zones, backdrops, region record (`regions.<r>` keys: map checks, ...), errors and `road_islands` (a cell of each
    of its own road networks, `road_check.islands_ok`); merged in REGIONS order."""
    out: dict = {"objects": [], "inspect": [], "zones": [], "backdrops": {}, "regions": {}, "errors": [],
                 "road_islands": []}
    for r in REGIONS:
        if importlib.util.find_spec(f"{r}.world_nw") is None:
            continue
        c = importlib.import_module(f"{r}.world_nw").content(g, meta, doors)
        for k in ("objects", "inspect", "zones", "errors", "road_islands"):
            out[k] += c.get(k, [])
        out["backdrops"].update(c.get("backdrops", {}))
        out["regions"][r] = c.get("region", {})
    return out


def merge_regions(doc: dict, reg: dict) -> None:
    """The regions' zones, backdrops and region records into the document (after the rasters are written)."""
    doc["encounterZones"] = reg["zones"]
    if reg["backdrops"]:
        doc["battleBackgrounds"] = {"zones": reg["backdrops"]}
    for r, rec in reg["regions"].items():
        doc["regions"][r].update(rec)
    if reg["road_islands"]:                  # a region's own road network (on its own land) is not a stray one
        doc["road_check"]["islands_ok"] = [list(c) for c in reg["road_islands"]]


def coverage(g: np.ndarray, meta: dict, zones: list[dict]) -> dict:
    """3.8 `coverage`, for every region with zones: each of its walkable or canoe cells (River, Lake) lies in one of
    its walking zones (a zone of its prefix that applies on foot)."""
    why, done = [], []
    for i, r in enumerate(REGIONS):
        mine = [z for z in zones if z["id"].startswith(PREFIXES[r] + "_")
                and (not z.get("modes") or "walking" in z["modes"])]
        if not mine:
            continue
        held = np.zeros(g.shape, bool)
        for z in mine:
            for a, b, c, d in z["rects"]:
                held[b:d + 1, a:c + 1] = True
        lost = np.argwhere((meta["region"] == i) & ~np.isin(g, ["o", "m"]) & ~held)
        done.append(r)
        if len(lost):
            why.append(f"{r}: {len(lost)} walkable or canoe cells in no {r} zone, e.g. "
                       + ", ".join(str((int(x), int(y))) for y, x in lost[:5]))
    return {"ok": not why, "why": why, "regions": done}


def document(g: np.ndarray, meta: dict, trans: list, objs: list, insp: list, spots: dict) -> dict:
    ents = dict(meta["entrances"])
    ents = {"cornelia": ents.pop("cornelia"), **ents}       # the first entrance is the reachability root
    npcs, ships = act1_people(g, meta["keep"])
    return {
        "id": "overworld", "name": "World Map", "kits": ["overworld", "town", "temple"], "music": "overworld",
        "camp": True, "terrain": "organic", "sealed_edges": True,
        "no_unreachable_walkable": {"reach_roots": reach_roots(g, ents, covered(objs))},
        "unreachable_ok": unreachable(g, ents),
        "road_check": {"materials": ["dirt"], "ends": [list(S.world(P.TOMB_END))], "check_under": True,
                       "no_stubs": True},             # act 1's roads (3.10: no stub by Cornelia's gates)
        "entrances": ents, "transitions": trans, "keyItemGates": gates(), "objects": objs, "inspect": insp,
        "npcs": npcs, "vehicles": ships,
        "patches": [{"id": "north_bridge", "flag": "BRIDGE_BUILT", "ground": "=",
                     "cells": [list(c) for c in meta["bridge"]]},
                    {"id": "canal", "flag": "CANAL_OPEN", "ground": "o", "cells": [list(c) for c in meta["canal"]]}],
        "docks": meta["docks"], "spots": spots,
        "world": {"basins": {k: list(v) for k, v in meta["seeds"].items()}},
    }


HEADER = """GENERATED by assets-src/tools/layouts/world_v2.py (pass NW, composer v2: docs/NATURAL_WORLD_PLAN.md 3.1).
Do not edit: change a region's spec (layouts/world_specs/<region>.py) or the generator (tools/worldgen/) and re-run
python3 -I assets-src/tools/layouts/world_v2.py. The 256x256 world of pass NW, compiled only to scratch folders
until the cutover (NW-5): python3 -I assets-src/tools/build_map.py overworld --src-dir assets-src/maps-nw --out DIR"""


def write(g: np.ndarray, doc: dict, path: Path = OUT) -> Path:
    head = {k: doc[k] for k in HEAD}
    rest = {k: v for k, v in doc.items() if k not in head}
    body = yaml.safe_dump(head, sort_keys=False, width=140)
    body += "ground: |\n" + "".join("  " + "".join(r) + "\n" for r in g)
    body += yaml.safe_dump(rest, sort_keys=False, default_flow_style=None, width=140, allow_unicode=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(f"# {line}\n" for line in HEADER.strip().split("\n")) + body)
    return path
