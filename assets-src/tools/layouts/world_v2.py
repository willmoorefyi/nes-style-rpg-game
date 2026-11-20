"""The composer v2 of pass NW (docs/NATURAL_WORLD_PLAN.md 3.1, 3.3, 3.8; NW-2) -> assets-src/maps-nw/overworld.yaml.

  python3 -I assets-src/tools/layouts/world_v2.py                     # compose, check, write the NW world source
  python3 -I assets-src/tools/layouts/world_v2.py --metrics           # ... and print the metrics (0.1.1, 2.5)
  python3 -I assets-src/tools/layouts/world_v2.py --json FILE         # ... and write B's NW-0 metrics json shape
  python3 -I assets-src/tools/layouts/world_v2.py --check             # compose and check only (writes nothing)
  python3 -I assets-src/tools/layouts/world_v2.py --out FILE          # ... and write the source to FILE instead
  python3 -I assets-src/tools/layouts/world_v2.py --owned-chunks <r>  # region r's chunks on the owner grid (3.4)

It merges the seven region specs (`world_specs/`), runs the generator (`tools/worldgen/compose.py`) at preset B and
seed 1987 (D-NW11), places the content (`world_v2_source.py`), resolves the spots, runs the checks of 3.8 (one line
each) and the metrics, and writes the source. Today's 192x192 world (`world.py`) is untouched: the NW world compiles
only to scratch folders until the cutover (NW-5), which renames this file over `world.py`. Exit 1 on a failed check.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(1, str(HERE.parent))
import numpy as np  # noqa: E402

import world_checks_v2 as WC2  # noqa: E402
import world_specs  # noqa: E402
import world_v2_source as SRC  # noqa: E402
from a1 import world_a1_checks as A1C  # noqa: E402
from a1 import world_a1_pins as P  # noqa: E402
from world_api_v2 import (CANOE_BARRIERS, DOCKS_ALLOWED, EXEMPT_CAP, G2_MIN, LAND_TARGET, NORTH_REGIONS,  # noqa: E402
                          REGIONS)
from worldgen import bundle, compose, gates, gates_reach, metrics, owners, prewalk, spots  # noqa: E402
from worldgen import spec as S  # noqa: E402

CHECKS = ("world", "basins", "docks", "walls", "barriers", "routes", "north", "landings", "straits", "prewalk", "act1",
          "walks", "detours", "pins")


def build(preset: S.Preset = S.PRESET, seed: int = S.SEED):
    """(ground, meta, the merged spec, the source document, the check results). The document carries each region's
    raster (`regions.<r>.raster`, 3.4) and the walls' and barriers' minimal cuts (`world.cuts`, 3.8)."""
    b = bundle.merge(world_specs.load())
    door_off, ent_map = SRC.doors()
    g, meta = compose.compose(b, preset, seed, door_off, REGIONS, tuple(P.ENTRANCES))
    trans = SRC.transitions(b.sites)
    objs, insp = SRC.act1_content(meta["keep"])
    blocked = {(t["x"], t["y"]) for t in trans} | {(k["x"], k["y"]) for k in SRC.gates()}
    blocked |= {tuple(v) for v in meta["entrances"].values()}
    docks = {d["id"]: (d["x"], d["y"]) for d in meta["docks"]}
    rc = SRC.region_content(g, meta, door_off, blocked | set(docks.values()))   # NW-R: the regions' content
    objs, insp = objs + rc["objects"], insp + rc["inspect"]
    sp, sp_err = spots.resolve(g, b.spots, b.sites, docks, blocked, SRC.covered(objs))
    doc = SRC.document(g, meta, trans, objs, insp, sp, rc)
    doc["regions"] = {r: {"raster": [list(x) for x in owners.raster(meta["region"], i)]} for i, r in enumerate(REGIONS)}
    ch = run_checks(g, meta, b, doc, ent_map, sp, sp_err, blocked)
    doc["world"]["cuts"] = {**ch["walls"]["cuts"], **ch["barriers"]["cuts"]}
    return g, meta, b, doc, ch


def run_checks(g, meta, b, doc, ent_map, sp, sp_err, blocked) -> dict:
    walk = gates.walk(g)
    pins_bad = list(sp_err)
    pins_bad += [f"entrance {e} at {tuple(c)} is not walkable" for e, c in meta["entrances"].items()
                 if not walk[c[1], c[0]] and e not in P.ENTRANCES]
    doors = np.zeros(g.shape, bool)                    # no cut runs through a door or an arrival (INT-W2c)
    for x, y in blocked:
        doors[y, x] = True
    taken = set(blocked) | {(n["x"], n["y"]) for n in doc.get("npcs") or []}
    werr, wsum = WC2.check(g, meta, doc, tuple(P.ENTRANCES))
    return {"world": {"ok": not werr, "why": werr, "summary": wsum},
            "basins": gates.basins(g, meta), "docks": gates.docks(g, meta, DOCKS_ALLOWED),
            "walls": gates.walls(g, meta, doors),
            "barriers": gates_reach.barriers(g, meta, {"barriers": b.barrier_seeds, "links": b.links}, CANOE_BARRIERS,
                                             doors),
            "routes": gates_reach.routes(g, meta), "north": gates_reach.north(g, meta, NORTH_REGIONS),
            "landings": gates_reach.landings(g, meta, b.north, sp, taken), "straits": gates.straits(g, meta),
            "prewalk": prewalk.prewalk(g, meta, ent_map, sp),
            "act1": A1C.act1(g, meta, doc["transitions"], SRC.gates()), "walks": A1C.walks(g, meta),
            "detours": gates_reach.detours(g, meta), "pins": {"ok": not pins_bad, "bad": pins_bad}}


def figures(g, meta, ch) -> dict:
    """The metrics in B's NW-0 json shape (`B_classic_metrics.json`), plus NW-2's G-NW3 (rev 3.2 classes)."""
    nw0 = metrics.gates(g, meta["exempt"], nw0=True)
    return {"generation_s": round(meta["gen_s"], 2), "gates": nw0, "gates_rev32": metrics.gates(g, meta["exempt"]),
            "shares_pct_of_land": metrics.shares(g),
            "coast_index_by_region": metrics.region_index(g, meta["region"], REGIONS),
            "exempt_cells": int(meta["exempt"].sum()), "jogs": meta["jogs"], "tarns": meta["tarns"],
            "ford_cuts": meta["ford_cuts"],
            "fords": {k: v for k, v in meta["fords"].items() if v}, "checks": ch,
            "kept_rects_on_chunk_lines": metrics.kept_rect_edges(_kept_rects()), "anchors": anchor_table(meta)}


def anchor_table(meta: dict) -> dict:
    """Each anchor's cell against its s* target (NW-0's table; act 1's are pins by rule, not targets)."""
    from world_specs.common import anchors
    rows = {}
    for e, a in anchors().items():
        (tx, ty), (x, y) = S.target(tuple(a["ref"])), meta["entrances"][e]
        rows[a["name"]] = {"cell": [x, y], "s*_target": [tx, ty], "dx": x - tx, "dy": y - ty,
                           "rule": "act-1 pin (today's cell relative to Cornelia)" if e in P.ENTRANCES else "anchor"}
    return rows


def _kept_rects() -> list:
    # act 1's keep rects (its template's forced cells), in world cells
    return [(*S.world((x0, y0)), *S.world((x1, y1))) for x0, y0, x1, y1 in P.KEEP_RECTS.values()]


def gate_lines(fig: dict) -> list[str]:
    """G-NW1-3 and the land, exemption and jog figures (0.1.1, D-NW12), one line each; `FAIL` marks a gate."""
    r, j = fig["gates_rev32"], fig["jogs"]
    lo, hi = LAND_TARGET
    return [f"G-NW1: {'OK' if not r['G1_fail_runs_gt6'] else 'FAIL'} (longest non-exempt coast run "
            f"{r['G1_longest_nonexempt']}; {r['G1_fail_list']})",
            f"G-NW2: {'OK' if r['G2_index'] >= G2_MIN else 'FAIL'} (coast index {r['G2_index']} >= {G2_MIN}; "
            f"{r['coast_edges']} coast edges, {r['land']} land cells)",
            f"G-NW3: {'OK' if not r['G3_fail_runs_gt6'] else 'FAIL'} (longest chunk-line class run "
            f"{r['G3_longest']}; NW-0's measure {fig['gates']['G3_longest']}; {r['G3_fail_list']})",
            f"land: {'OK' if lo <= r['land'] <= hi else 'FAIL'} ({r['land']} in [{lo}, {hi}])",
            f"exempt: {'OK' if fig['exempt_cells'] <= EXEMPT_CAP else 'FAIL'} ({fig['exempt_cells']} cells, "
            f"cap {EXEMPT_CAP})",
            f"kept: {'FAIL' if fig['kept_rects_on_chunk_lines'] else 'OK'} (no kept rectangle with an edge on a "
            f"chunk line; {fig['kept_rects_on_chunk_lines']})",
            f"jogs: {j}{' (WARNING: over 100, a spec has a straight edge)' if j > 100 else ''}; "
            f"tarns: {fig['tarns']}; ford cuts: {fig['ford_cuts']}"]


def _ok_note(k: str, v: dict) -> str:
    """The figures after a check's OK (G-NW4's lines: `basins: OK (...)`, `barriers: OK (walk, canoe)`)."""
    if k == "world":
        return f" ({v['summary']})"
    if k == "basins":
        return (f" (aldi {v['aldi_cells']} cells, ocean {v['ocean_cells']} cells; canal joins; the canal pass "
                f"{v['canal']['length']} cells long)")
    if k == "walls":
        return " (minimal water cuts " + ", ".join(f"{w} {r['cut']}" + (f" (mask grown {r['grown']})" if r["grown"]
                                                                          else "") for w, r in v["walls"].items()) + ")"
    if k == "barriers":
        return " (walk, canoe; cuts " + ", ".join(f"{b} {len(c)}" for b, c in v["cuts"].items()) + ")"
    if k == "prewalk":
        return f" ({prewalk.STAGES[0]}-{prewalk.STAGES[-1]})"
    return ""


def check_lines(ch: dict, meta: dict | None = None) -> list[str]:
    out = []
    for k in CHECKS:
        v = ch[k]
        if v["ok"]:
            out.append(f"{k}: OK{_ok_note(k, v)}")
        elif k == "prewalk":
            out.append(f"prewalk: FAIL ({'; '.join(prewalk.details(v, meta) if meta else prewalk.failures(v))})")
        else:
            out.append(f"{k}: FAIL" + ("\n  " + "\n  ".join(v["why"]) if v.get("why") else f" {_brief(v)}"))
    return out


def _brief(v: dict) -> str:
    return json.dumps({a: b for a, b in v.items() if a != "ok"}, default=str)[:400]


def owned_files(meta: dict, doc: dict, r: str) -> list[str]:
    """`--owned-chunks <r>`: the chunk files of r's raster (what `build_map.py --region r` writes, besides the chunks
    whose digests changed), row-major, then the patch overlays whose first cell r owns (as world.py prints them)."""
    out = []
    for cx, cy in owners.owned_chunks(meta["region"], REGIONS.index(r)):
        out += [f"assets/maps/ai/overworld/below_{cy}_{cx}.png", f"assets/maps/ai/overworld/above_{cy}_{cx}.png"]
    return out + [f"assets/maps/ai/overworld/patch_{p['id']}.png" for p in doc["patches"]
                  if gates.owner(meta, *p["cells"][0]) == r]


def main(argv: list[str]) -> int:
    if argv[:1] == ["--owned-chunks"]:
        if len(argv) != 2 or argv[1] not in REGIONS:
            print(f"usage: world_v2.py --owned-chunks <{'|'.join(REGIONS)}>", file=sys.stderr)
            return 2
        _g, meta, _b, doc, _ch = build()
        print("\n".join(owned_files(meta, doc, argv[1])))
        return 0
    g, meta, _b, doc, ch = build()
    fig = figures(g, meta, ch)
    lines = check_lines(ch, meta) + gate_lines(fig)
    print("\n".join(lines))
    if "--metrics" in argv:
        print(json.dumps({k: v for k, v in fig.items() if k != "checks"}, indent=1, default=_plain))
    if "--json" in argv:
        Path(argv[argv.index("--json") + 1]).write_text(json.dumps(fig, indent=1, default=_plain))
    bad = [ln for ln in lines if ": FAIL" in ln]
    if "--out" in argv:
        print(SRC.write(g, doc, Path(argv[argv.index("--out") + 1])))
    elif "--check" not in argv:
        print(SRC.write(g, doc))
    return 1 if bad else 0


def _plain(o):
    return o.item() if hasattr(o, "item") else (o.tolist() if isinstance(o, np.ndarray) else str(o))


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
