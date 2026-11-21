"""The `prewalk` check (docs/NATURAL_WORLD_PLAN.md 3.8, 2.4 rule 4b; rev 3.2's fix of NW-0's vacuity; NW-4).

For each stage S of S0-S14 (the canoe is granted inside Crescent at S14, so its dock-to-gate walk is included), every
**required entrance** of S is reachable on foot from one of S's **starts**, with S's **open patches** on. Read from
`assets/data/quest.yaml` (stage dependency is the `after` closure, never file order):

- open patches of S: the patches whose flag is granted to an ancestor of S (BRIDGE_BUILT, CANAL_OPEN);
- required entrances of S: the overworld entrances whose door transition targets a map matching one of S's `maps`;
- starts of S: S's `entry.at` spot (on the overworld); the world's root entrance for a stage with no `after`; every
  overworld entrance an exit of an **ancestor's** map leads to (`exits`: the `targetEntrance` of each
  `targetMap: overworld` in those maps' sources; never S's own, rev 3.2); the 4-neighbours of every dock the ship
  reaches (the Aldi's once an ancestor has the ship, the ocean's too once CANAL_OPEN is granted);
- a map of S with several entrances (the giant's tunnel) joins them once one is reached, to a fixed point.

A missing entrance is reported with its stage and the nearest blocking cell (a river, lake or ridge cell on the edge
of what the starts reach, `details`); an exit to an entrance the world lacks fails too. `vacuous=True` adds S's own
entrances to its starts (3.8 as rev 3 worded it): the sealed-Elfheim selftest passes that way and must fail the
corrected way (`selftest_gates.py`). NW2 adds `dock_towns` (docs/NW2_EDITS_PLAN.md 6) and shares the starts
(`starts_of`) with `gates_canoe`.
"""
from __future__ import annotations

import fnmatch
from functools import lru_cache
from pathlib import Path

import numpy as np
import yaml

from .gates import owner, walk, with_patches
from .geom import bfs_dist, flood

ROOT = Path(__file__).resolve().parents[3]
QUEST = ROOT / "assets" / "data" / "quest.yaml"
MAP_DIRS = (ROOT / "assets-src" / "maps", ROOT / "assets" / "maps")     # sources first, then the legacy maps
STAGES = tuple(f"S{i}" for i in range(15))
PATCH_FLAGS = {"bridge": "BRIDGE_BUILT", "canal": "CANAL_OPEN"}
WORLD = "overworld"
Loader = getattr(yaml, "CSafeLoader", yaml.SafeLoader)


def load_stages(path: Path = QUEST) -> dict:
    return {s["id"]: s for s in yaml.safe_load(path.read_text())["stages"]}


def closure(stages: dict, sid: str) -> set:
    out, todo = set(), list(stages[sid].get("after") or [])
    while todo:
        s = todo.pop()
        if s not in out:
            out.add(s)
            todo += stages[s].get("after") or []
    return out


@lru_cache(maxsize=None)
def _map_ids() -> dict[str, Path]:
    out: dict[str, Path] = {}
    for d in MAP_DIRS:
        for p in sorted(d.glob("*.yaml")):
            if p.stem != WORLD and p.stem not in out:
                out[p.stem] = p
    return out


@lru_cache(maxsize=None)
def _exits_of(path: Path) -> tuple[str, ...]:
    found: list[str] = []

    def scan(v):
        if isinstance(v, dict):
            if v.get("targetMap") == WORLD and isinstance(v.get("targetEntrance"), str):
                found.append(v["targetEntrance"])
            for x in v.values():
                scan(x)
        elif isinstance(v, list):
            for x in v:
                scan(x)
    scan(yaml.load(path.read_text(), Loader=Loader))
    return tuple(dict.fromkeys(found))


def exits(globs) -> list[str]:
    """The overworld entrances the exits of the maps matching `globs` lead to (sorted map order, each once)."""
    ids = _map_ids()
    out: list[str] = []
    for m in sorted(i for i in ids if any(fnmatch.fnmatch(i, g) for g in globs)):
        out += [e for e in _exits_of(ids[m]) if e not in out]
    return out


def stage_state(stages: dict, sid: str) -> tuple[set, set]:
    """(flags, vehicles) the ancestors of `sid` grant (its `after` closure, `sid` itself not counted)."""
    anc = sorted(closure(stages, sid))
    return ({f for a in anc for f in (stages[a]["grants"].get("flags") or [])},
            {v for a in anc for v in (stages[a]["grants"].get("vehicles") or [])})


def ship_docks(meta: dict, flags: set, vehicles: set, withhold: tuple[str, ...] = ()) -> list[dict]:
    """The docks the ship reaches with these grants: the Aldi's once it is held, the ocean's too with CANAL_OPEN."""
    if "ship" not in vehicles:
        return []
    return [d for d in meta["docks"] if d["id"] not in withhold
            and (d["basin"] == "aldi" or PATCH_FLAGS["canal"] in flags)]


def starts_of(g, meta: dict, stages: dict, sid: str, spots: dict, root: str = "cornelia",
              withhold: tuple[str, ...] = ()) -> dict:
    """Stage `sid`'s starts (the module doc; NW2's glossary "start"): {"ground": with its open patches, "cells",
    "names", "lost"}. `withhold`: docks left out (NW2 `canoe_gates` (iii))."""
    st, S = stages[sid], meta["entrances"]
    flags, vehicles = stage_state(stages, sid)
    h = with_patches(g, meta, bridge=PATCH_FLAGS["bridge"] in flags, canal=PATCH_FLAGS["canal"] in flags)
    cells, names, lost = [], [], []
    en = st.get("entry")
    if en and en.get("map") == WORLD and en.get("at"):
        cells.append(tuple(spots[en["at"]]["at"]))
        names.append(en["at"])
    if not st.get("after"):
        cells.append(tuple(S[root]))
        names.append(root)
    for e in exits([m for a in sorted(closure(stages, sid)) for m in stages[a].get("maps") or []]):
        if e in S:
            cells.append(tuple(S[e]))
            names.append(e)
        else:
            lost.append(e)
    for d in ship_docks(meta, flags, vehicles, withhold):
        cells += [(d["x"] + dx, d["y"] + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
        names.append(d["id"])
    return {"ground": h, "cells": cells, "names": names, "lost": lost}


def prewalk(g, meta: dict, ent_map: dict, spots: dict, stages: dict | None = None, vacuous: bool = False,
            root: str = "cornelia") -> dict:
    """`ent_map`: entrance -> the targetMap of its door; `spots`: name -> {"at": [x, y], ...}."""
    stages = stages or load_stages()
    S = meta["entrances"]
    res = {}
    for sid in STAGES:
        st = stages[sid]
        so = starts_of(g, meta, stages, sid, spots, root)
        h, starts, names, lost = so["ground"], so["cells"], so["names"], so["lost"]
        w = walk(h)

        def ents_of(maps):
            return [e for e, tm in ent_map.items() if any(fnmatch.fnmatch(tm, m) for m in maps)]
        req = ents_of(st.get("maps") or [])
        if vacuous:
            starts += [tuple(S[e]) for e in req]
        reach = flood(w, starts)
        joined, changed = set(), True
        while changed:                       # a multi-entrance map joins its entrances (a fixed point)
            changed = False
            for m in st.get("maps") or []:
                es = ents_of([m])
                if m in joined or not any(reach[S[e][1], S[e][0]] for e in es):
                    continue
                joined.add(m)
                if not all(reach[S[e][1], S[e][0]] for e in es):
                    starts += [tuple(S[e]) for e in es]
                    reach = flood(w, starts)
                    changed = True
        missing = [e for e in req if not reach[S[e][1], S[e][0]]]
        res[sid] = {"required": req, "starts": list(dict.fromkeys(names)), "missing": missing, "lost_exits": lost,
                    "blocks": {e: _block(h, w, reach, S[e]) for e in missing}}
    return {"ok": all(not v["missing"] and not v["lost_exits"] for v in res.values()), **res}


DOCK_GATE_STEPS = 12                         # NW2 8 `dock_towns`: a needs_dock town's gate from its dock's shore


def dock_towns(g, meta: dict, ent_map: dict, path: Path = QUEST, root: str = "cornelia") -> dict:
    """NW2 (docs/NW2_EDITS_PLAN.md 6, 8): each needs_dock town of quest.yaml's `towns` (no stage of its `bandStage`'s
    `after` closure, itself included, grants the airship; its gate not on foot from `root` with the patches its
    bandStage's ancestors open) has a dock whose basin the ship reaches at `bandStage` (the ancestors' grants), with
    its gate within DOCK_GATE_STEPS walking steps of the dock's shore."""
    q = yaml.safe_load(path.read_text())
    stages = {s["id"]: s for s in q["stages"]}
    S, rows, why = meta["entrances"], {}, []
    for t in q.get("towns") or []:
        band = t["bandStage"]
        gates = [e for e, tm in ent_map.items() if any(fnmatch.fnmatch(tm, m) for m in t["maps"]) and e in S]
        if not gates:
            why.append(f"town {t['id']}: no overworld entrance leads to {t['maps']}")
            continue
        gx, gy = S[gates[0]]
        flags, vehicles = stage_state(stages, band)
        w = walk(with_patches(g, meta, bridge=PATCH_FLAGS["bridge"] in flags, canal=PATCH_FLAGS["canal"] in flags))
        air = any("airship" in (stages[a]["grants"].get("vehicles") or []) for a in closure(stages, band) | {band})
        if air or flood(w, [tuple(S[root])])[gy, gx]:
            rows[t["id"]] = "airship" if air else "on foot"
            continue
        best = None
        for d in ship_docks(meta, flags, vehicles):
            n = bfs_dist(w, [(d["x"] + dx, d["y"] + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))])[gy, gx]
            if n >= 0 and (best is None or n < best[1]):
                best = (d["id"], int(n))
        rows[t["id"]] = best
        if best is None or best[1] > DOCK_GATE_STEPS:
            why.append(f"town {t['id']} (needs a dock at {band}): its gate {gates[0]} at {owner(meta, gx, gy)} "
                       f"({gx}, {gy}) is " + (f"{best[1]} steps from dock {best[0]}" if best
                                               else "reached from no dock the ship reaches")
                       + f" (want <= {DOCK_GATE_STEPS})")
    note = ", ".join(f"{k} {v[0]} {v[1]}" for k, v in rows.items() if isinstance(v, tuple))
    return {"ok": not why, "towns": rows, "note": f"needs a dock: {note or 'none'}", "why": why}


def _block(h: np.ndarray, w: np.ndarray, reach: np.ndarray, at) -> tuple[int, int, str] | None:
    """The river, lake or ridge cell on the edge of the reached land nearest to the entrance at `at`."""
    edge = np.zeros(reach.shape, bool)
    for a in (0, 1):
        for s in (1, -1):
            edge |= np.roll(reach, s, a)
    edge &= ~w & np.isin(h, ["r", "≈", "m"])
    pts = np.argwhere(edge)
    if not len(pts):
        return None
    y, x = pts[int(np.argmin((pts[:, 0] - at[1]) ** 2 + (pts[:, 1] - at[0]) ** 2))]
    return int(x), int(y), str(h[y, x])


def failures(result: dict) -> list[str]:
    """`S4 elf_elfheim`-style lines for every missing entrance (and `S2 exit to x` for an exit the world lacks)."""
    out = [f"{sid} {e}" for sid in STAGES if sid in result for e in result[sid]["missing"]]
    return out + [f"{sid} exit to {e}" for sid in STAGES if sid in result for e in result[sid]["lost_exits"]]


def details(result: dict, meta: dict) -> list[str]:
    """`failures` with the nearest blocking cell and its region."""
    out = []
    for sid in STAGES:
        v = result.get(sid) or {}
        for e in v.get("missing", []):
            b = v["blocks"].get(e)
            where = f"; nearest block {b[2]!r} at {owner(meta, b[0], b[1])} ({b[0]}, {b[1]})" if b else "; no start"
            out.append(f"{sid} {e} (from {', '.join(v['starts']) or 'nothing'}{where})")
        out += [f"{sid}: an exit leads to {e}, which the world lacks" for e in v.get("lost_exits", [])]
    return out
