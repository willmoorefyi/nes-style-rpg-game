"""Reachability and chokepoint report for a compiled map (assets/maps/ai/<id>.yaml).

  python3 -I assets-src/tools/map_report.py <id> [<id> ...] [--point name=x,y ...] [--from name]

Prints, per map:
  - reachability from every entrance (cells, and which entrances / transitions are cut off), with and without the
    static NPCs (no `wander`) blocking their cells, and NPCs nobody can talk to;
  - walkable edge cells that are not exits;
  - single-cell chokepoints once static NPCs block their cells (a cell whose blocking cuts off a transition or an
    NPC), found as articulation points of the walkable graph;
  - BFS step distances between the named points (entrances and every --point), from --from or between all pairs.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import map_checks as MC  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets" / "maps" / "ai"


def load(map_id: str, out_dir: Path = OUT) -> dict:
    return yaml.safe_load((out_dir / f"{map_id}.yaml").read_text())


def collision(doc: dict) -> np.ndarray:
    return np.array(doc["collision"], np.int16).reshape(doc["height"], doc["width"])


def report(doc: dict, points: dict[str, tuple[int, int]] | None = None, origin: str | None = None) -> dict:
    """The report as data (map_report prints it; the compiler selftest checks it)."""
    coll = collision(doc)
    wid, hgt = doc["width"], doc["height"]
    ents = {k: tuple(v) for k, v in (doc.get("entrances") or {}).items()}
    trans = {(t["x"], t["y"]): t["targetMap"] for t in doc.get("transitions") or []}
    npcs = doc.get("npcs") or []
    static = MC.static_npc_cells(npcs)
    start = next(iter(ents.values()))
    out: dict = {"id": doc["id"], "reach": {}, "edge_not_exit": [], "chokepoints": [], "distances": {}}
    for name, pos in ents.items():
        free, plugged = MC.reach(coll, [pos]), MC.reach(coll, [pos], static)
        out["reach"][name] = {
            "cells": len(free),
            "lost_entrances": sorted(k for k, v in ents.items() if v not in free),
            "lost_transitions": sorted(p for p in trans if p not in free),
            "static_lost_entrances": sorted(k for k, v in ents.items() if v in free and v not in plugged and v not in static),
            "static_lost_transitions": sorted(p for p in trans if p in free and p not in plugged),
            "untalkable": sorted(n["id"] for n in npcs if not MC.talkable(coll, n, plugged)),
        }
    seen = MC.reach(coll, [start])
    out["edge_not_exit"] = sorted((p for p in MC.edge_cells(wid, hgt) if MC.walkable(coll, *p) and p not in trans),
                                  key=lambda p: (p[1], p[0]))
    out["edge_unreachable"] = sorted((p for p in MC.edge_cells(wid, hgt) if MC.walkable(coll, *p) and p not in seen),
                                     key=lambda p: (p[1], p[0]))
    base = MC.reach(coll, [start], static)
    for p in sorted(MC.articulation_points(coll, start, static), key=lambda p: (p[1], p[0])):
        if p in trans:
            continue
        r = MC.reach(coll, [start], static | {p})
        lost = sorted({trans[t] for t in trans if t in base and t not in r})
        lostn = sorted(n["id"] for n in npcs if MC.talkable(coll, n, base) and not MC.talkable(coll, n, r))
        if lost or lostn:
            out["chokepoints"].append({"cell": p, "cuts_off": lost, "npcs": lostn})
    named = dict(ents)
    named.update(points or {})
    sources = [origin] if origin else list(named)
    for a in sources:
        dist = MC.distances(coll, named[a])
        for b in named:
            if b != a and (origin or (b, a) not in out["distances"]):
                out["distances"][(a, b)] = dist.get(named[b])
    return out


def print_report(r: dict) -> None:
    print(f"== {r['id']}")
    for name, s in r["reach"].items():
        extra = []
        for key in ("lost_entrances", "lost_transitions", "static_lost_entrances", "static_lost_transitions",
                    "untalkable"):
            if s[key]:
                extra.append(f"{key.replace('_', ' ')}: {s[key]}")
        print(f"  from {name}: {s['cells']} cells" + ("; " + "; ".join(extra) if extra else ""))
    print(f"  walkable edge cells that are not exits: {len(r['edge_not_exit'])}"
          + (f" {r['edge_not_exit'][:60]}" if r["edge_not_exit"] else ""))
    if r["edge_unreachable"]:
        print(f"  walkable edge cells not reachable from the first entrance: {r['edge_unreachable'][:60]}")
    print(f"  chokepoints with static NPCs in place: {len(r['chokepoints'])}")
    for ch in r["chokepoints"]:
        print(f"    {ch['cell']}: cuts off {ch['cuts_off'] or '-'}; NPCs {ch['npcs'] or '-'}")
    print("  distances (steps):")
    for (a, b), d in r["distances"].items():
        print(f"    {a} -> {b}: {'unreachable' if d is None else d}")


def main(args: list[str]) -> None:
    points: dict[str, tuple[int, int]] = {}
    origin = None
    ids = []
    it = iter(args)
    for a in it:
        if a == "--point":
            name, xy = next(it).split("=")
            x, y = xy.split(",")
            points[name] = (int(x), int(y))
        elif a == "--from":
            origin = next(it)
        elif a.startswith("--"):
            raise SystemExit(__doc__)
        else:
            ids.append(a)
    if not ids:
        raise SystemExit(__doc__)
    for mid in ids:
        print_report(report(load(mid), points, origin))


if __name__ == "__main__":
    main(sys.argv[1:])
