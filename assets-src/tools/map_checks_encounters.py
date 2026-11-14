"""Encounter-table and encounter-zone checks for the map compiler (docs/FIX_PLAN_PENINSULA.md T4 §2.5).

Every table entry has a weight and exactly one of `enemies` (ids) or `groups` ({id, min, max?} with
0 <= min <= max); a formation's largest roll is at most MAX_FORMATION enemies; every id is in
assets/data/enemies.yaml. A zone has a unique id, inclusive [x0, y0, x1, y1] rects inside the map that cover at
least one walkable cell, its own table and an optional encounterRate.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

from map_checks_util import _is_int
from map_graph import walkable

MAX_FORMATION = 9                                   # EncounterTable.MAX_FORMATION (src/systems/EncounterTable.ts)
ENEMIES_FILE = Path(__file__).resolve().parents[2] / "assets" / "data" / "enemies.yaml"


@lru_cache(maxsize=1)
def known_enemies() -> frozenset[str]:
    return frozenset(e["id"] for e in yaml.safe_load(ENEMIES_FILE.read_text()) or [])


def table_errors(where: str, table, enemies: frozenset[str]) -> list[str]:
    """An encounter list: each entry has a weight and exactly one of `enemies` (ids) or `groups` ({id, min, max?});
    a formation's largest roll is at most MAX_FORMATION enemies, and every id is in enemies.yaml."""
    if not isinstance(table, list):                 # [] is a map (or zone) without random battles
        return [f"{where}: expected a list of encounter entries"]
    errors = []
    for i, e in enumerate(table):
        p = f"{where}[{i}]"
        if not isinstance(e, dict):
            errors.append(f"{p}: expected an object")
            continue
        w = e.get("weight")
        if not isinstance(w, (int, float)) or isinstance(w, bool) or w < 0:
            errors.append(f"{p}: weight must be a number >= 0")
        if set(e) - {"weight", "enemies", "groups"}:
            errors.append(f"{p}: unknown keys {sorted(set(e) - {'weight', 'enemies', 'groups'})}")
        if ("enemies" in e) == ("groups" in e):
            errors.append(f"{p}: give exactly one of enemies or groups")
            continue
        if "enemies" in e:
            ids = e["enemies"]
            if not isinstance(ids, list) or not ids or not all(isinstance(x, str) for x in ids):
                errors.append(f"{p}: enemies must be a non-empty list of enemy ids")
                continue
            most = len(ids)
        else:
            groups = e["groups"]
            if not isinstance(groups, list) or not groups:
                errors.append(f"{p}: groups must be a non-empty list")
                continue
            ids, most = [], 0
            for j, gr in enumerate(groups):
                q = f"{p}.groups[{j}]"
                if not isinstance(gr, dict) or not isinstance(gr.get("id"), str):
                    errors.append(f"{q}: expected {{id, min, max?}}")
                    continue
                if set(gr) - {"id", "min", "max"}:
                    errors.append(f"{q}: unknown keys {sorted(set(gr) - {'id', 'min', 'max'})}")
                lo, hi = gr.get("min"), gr.get("max", gr.get("min"))
                if not (_is_int(lo) and _is_int(hi) and 0 <= lo <= hi):
                    errors.append(f"{q}: expected integers 0 <= min <= max, got min {lo}, max {hi}")
                    continue
                ids.append(gr["id"])
                most += hi
        if most > MAX_FORMATION:
            errors.append(f"{p}: up to {most} enemies, more than {MAX_FORMATION}")
        unknown = sorted({x for x in ids if x not in enemies})
        if unknown:
            errors.append(f"{p}: unknown enemy ids {unknown} (not in assets/data/enemies.yaml)")
    return errors


def encounter_errors(src: dict, c) -> list[str]:
    """The map's `encounters` and its `encounterZones` (docs/FIX_PLAN_PENINSULA.md T4 §2.5)."""
    enemies = known_enemies()
    errors = table_errors("encounters", src["encounters"], enemies) if "encounters" in src else []
    zones = src.get("encounterZones")
    if zones is None:
        return errors
    if not isinstance(zones, list):
        return errors + ["encounterZones: expected a list"]
    ids: set[str] = set()
    for i, z in enumerate(zones):
        p = f"encounterZones[{i}]"
        if not isinstance(z, dict) or not isinstance(z.get("id"), str) or not z["id"]:
            errors.append(f"{p}: needs a non-empty string id")
            continue
        p = f"encounterZones[{i}] ({z['id']})"
        if z["id"] in ids:
            errors.append(f"{p}: duplicate zone id")
        ids.add(z["id"])
        if set(z) - {"id", "rects", "encounters", "encounterRate"}:
            errors.append(f"{p}: unknown keys {sorted(set(z) - {'id', 'rects', 'encounters', 'encounterRate'})}")
        rects = z.get("rects")
        if not isinstance(rects, list) or not rects:
            errors.append(f"{p}: rects must be a non-empty list of [x0, y0, x1, y1]")
            rects = []
        walk = 0
        for j, r in enumerate(rects):
            if not (isinstance(r, list) and len(r) == 4 and all(_is_int(v) for v in r)):
                errors.append(f"{p}.rects[{j}]: expected [x0, y0, x1, y1] integers")
                continue
            x0, y0, x1, y1 = r
            if not (0 <= x0 <= x1 < c.width and 0 <= y0 <= y1 < c.height):
                errors.append(f"{p}.rects[{j}]: {r} is not an inclusive rect inside the {c.width}x{c.height} map")
                continue
            walk += sum(walkable(c.collision, x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1))
        if rects and not walk:
            errors.append(f"{p}: covers no walkable cell")
        errors += table_errors(f"{p}.encounters", z.get("encounters"), enemies)
        rate = z.get("encounterRate")
        if rate is not None and not (isinstance(rate, dict) and _is_int(rate.get("min")) and _is_int(rate.get("max"))
                                     and 1 <= rate["min"] <= rate["max"]):
            errors.append(f"{p}: encounterRate must be {{min, max}} integers with 1 <= min <= max")
    return errors
