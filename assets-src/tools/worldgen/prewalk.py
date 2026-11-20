"""The `prewalk` check (docs/NATURAL_WORLD_PLAN.md 3.8, 2.4 rule 4b; rev 3.2's fix of NW-0's vacuity).

For each stage S of S0-S14 (the canoe is granted inside Crescent at S14, so its dock-to-gate walk is included), every
**required entrance** of S is reachable on foot from one of S's **starts**, with S's **open patches** on. Read from
`assets/data/quest.yaml` (stage dependency is the `after` closure, never file order):

- open patches of S: the patches whose flag is granted to an ancestor of S (BRIDGE_BUILT, CANAL_OPEN);
- required entrances of S: the overworld entrances whose door transition targets a map matching one of S's `maps`;
- starts of S: S's `entry.at` spot (on the overworld); the world's root entrance for a stage with no `after`; every
  entrance whose door targets a map of an **ancestor** (never S's own: rev 3.2); the 4-neighbours of every dock the
  ship reaches (the Aldi's once an ancestor has the ship, the ocean's too once CANAL_OPEN is granted);
- a map of S with several entrances (the giant's tunnel) joins them once one is reached, to a fixed point.

`vacuous=True` adds S's own entrances to its starts (3.8 as rev 3 worded it): the sealed-Elfheim selftest passes
that way and must fail the corrected way (`selftest_gates.py`).
"""
from __future__ import annotations

import fnmatch
from pathlib import Path

import yaml

from .gates import walk, with_patches
from .geom import flood

QUEST = Path(__file__).resolve().parents[3] / "assets" / "data" / "quest.yaml"
STAGES = tuple(f"S{i}" for i in range(15))
PATCH_FLAGS = {"bridge": "BRIDGE_BUILT", "canal": "CANAL_OPEN"}


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
        starts = []
        en = st.get("entry")
        if en and en.get("map") == "overworld" and en.get("at"):
            starts.append(tuple(spots[en["at"]]["at"]))
        if not st.get("after"):
            starts.append(tuple(S[root]))
        for a in sorted(anc):
            starts += [tuple(S[e]) for e in ents_of(stages[a].get("maps") or [])]
        if vacuous:
            starts += [tuple(S[e]) for e in req]
        if "ship" in vehicles:
            for d in meta["docks"]:
                if d["basin"] == "aldi" or PATCH_FLAGS["canal"] in flags:
                    starts += [(d["x"] + dx, d["y"] + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
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
        res[sid] = {"required": req, "missing": [e for e in req if not reach[S[e][1], S[e][0]]]}
    return {"ok": all(not v["missing"] for v in res.values()), **res}


def failures(result: dict) -> list[str]:
    """`S4 elf_elfheim`-style lines for every missing entrance."""
    return [f"{sid} {e}" for sid in STAGES if sid in result for e in result[sid]["missing"]]
