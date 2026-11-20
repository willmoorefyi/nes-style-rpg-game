"""The composer v2's content and writer (docs/NATURAL_WORLD_PLAN.md 3.1 `stamps` / `source`, 3.3, 5.2; NW-2).

On the generated ground the composer places the world's content: every overworld transition and key-item gate at its
entrance's new cell (act 1's by the pin rule, the others at their door offset from today's world), act 1's objects
and inspect cells where they lie wholly in its kept cells (NW-0's rule; the other regions' icons and dressing are
their NW-R work), the patches, the docks and the spots. `write` emits `assets-src/maps-nw/overworld.yaml` in the
map-source format of `common.write_map` (header, the head keys, the ground block, the rest).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import yaml

from world_api_v2 import A1_DELTA
from world_specs import a1_today as T
from worldgen.gates import BLOCK
from worldgen.geom import components, flood

OUT = Path(__file__).resolve().parents[2] / "maps-nw" / "overworld.yaml"
HEAD = ("id", "name", "kits", "music")


def _a1(x: int, y: int) -> tuple[int, int]:
    return (x + A1_DELTA[0], y + A1_DELTA[1])


def doors() -> tuple[dict, dict]:
    """(entrance -> door offset, entrance -> door targetMap), from today's transitions."""
    d = T.door_of()
    return {e: off for e, (off, _t) in d.items()}, {e: t["targetMap"] for e, (_o, t) in d.items()}


def transitions(sites: dict) -> list[dict]:
    """Today's overworld transitions at their entrances' new cells (each once, in today's order)."""
    ents = T.entrances()
    out = []
    for t in T.transitions():
        near = sorted((abs(t["x"] - x) + abs(t["y"] - y), e) for e, (x, y) in ents.items()
                      if abs(t["x"] - x) + abs(t["y"] - y) <= 1)
        e = near[0][1]
        if e in T.ENTRANCES:
            x, y = _a1(t["x"], t["y"])
        else:
            ex, ey = ents[e]
            x, y = sites[e][0] + t["x"] - ex, sites[e][1] + t["y"] - ey
        out.append({**t, "x": int(x), "y": int(y)})
    return out


def gates() -> list[dict]:
    return [{**g, "x": _a1(g["x"], g["y"])[0], "y": _a1(g["x"], g["y"])[1]} for g in T.gates()]


def _inside(keep: np.ndarray, x: int, y: int, w: int, h: int) -> bool:
    n = keep.shape[0]
    return all(keep[y + j, x + i] for j in range(-1, h + 1) for i in range(-1, w + 1)
               if 0 <= y + j < n and 0 <= x + i < n)


def act1_content(keep: np.ndarray) -> tuple[list[dict], list[dict]]:
    """Act 1's objects and inspect cells that lie wholly (with a one-cell ring) in its kept cells."""
    objs = []
    for o in T.objects():
        x, y = _a1(o["x"], o["y"])
        parts = o.get("parts") or [[None]]
        if _inside(keep, x, y, max(len(r) for r in parts), len(parts)):
            objs.append({**o, "x": x, "y": y})
    insp = []
    for i in T.inspect():
        x, y = _a1(i["x"], i["y"])
        if _inside(keep, x, y, 1, 1):
            insp.append({**i, "x": x, "y": y})
    return objs, insp


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


def document(g: np.ndarray, meta: dict, trans: list, objs: list, insp: list, spots: dict) -> dict:
    ents = dict(meta["entrances"])
    ents = {"cornelia": ents.pop("cornelia"), **ents}       # the first entrance is the reachability root
    return {
        "id": "overworld", "name": "World Map", "kits": ["overworld", "town", "temple"], "music": "overworld",
        "camp": True, "terrain": "organic", "sealed_edges": True,
        "no_unreachable_walkable": {"reach_roots": reach_roots(g, ents, covered(objs))},
        "unreachable_ok": unreachable(g, ents),
        "entrances": ents, "transitions": trans, "keyItemGates": gates(), "objects": objs, "inspect": insp,
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
