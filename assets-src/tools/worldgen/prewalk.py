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
corrected way (`selftest_gates.py`).
"""
from __future__ import annotations

import fnmatch
from functools import lru_cache
from pathlib import Path

import numpy as np
import yaml

from .gates import owner, walk, with_patches
from .geom import flood

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


def prewalk(g, meta: dict, ent_map: dict, spots: dict, stages: dict | None = None, vacuous: bool = False,
            root: str = "cornelia") -> dict:
    """`ent_map`: entrance -> the targetMap of its door; `spots`: name -> {"at": [x, y], ...}."""
    stages = stages or load_stages()
    S = meta["entrances"]
    res = {}
    for sid in STAGES:
        st = stages[sid]
        anc = closure(stages, sid)
        flags = {f for a in sorted(anc) for f in (stages[a]["grants"].get("flags") or [])}
        vehicles = {v for a in sorted(anc) for v in (stages[a]["grants"].get("vehicles") or [])}
        h = with_patches(g, meta, bridge=PATCH_FLAGS["bridge"] in flags, canal=PATCH_FLAGS["canal"] in flags)
        w = walk(h)

        def ents_of(maps):
            return [e for e, tm in ent_map.items() if any(fnmatch.fnmatch(tm, m) for m in maps)]
        req = ents_of(st.get("maps") or [])
        starts, names, lost = [], [], []
        en = st.get("entry")
        if en and en.get("map") == WORLD and en.get("at"):
            starts.append(tuple(spots[en["at"]]["at"]))
            names.append(en["at"])
        if not st.get("after"):
            starts.append(tuple(S[root]))
            names.append(root)
        for e in exits([m for a in sorted(anc) for m in stages[a].get("maps") or []]):
            if e in S:
                starts.append(tuple(S[e]))
                names.append(e)
            else:
                lost.append(e)
        if vacuous:
            starts += [tuple(S[e]) for e in req]
        if "ship" in vehicles:
            for d in meta["docks"]:
                if d["basin"] == "aldi" or PATCH_FLAGS["canal"] in flags:
                    starts += [(d["x"] + dx, d["y"] + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                    names.append(d["id"])
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
