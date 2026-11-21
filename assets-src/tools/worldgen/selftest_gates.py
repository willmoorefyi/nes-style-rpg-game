"""The gate checks' selftests (docs/NATURAL_WORLD_PLAN.md 3.2, 3.8, 4.5; NW-2, NW-4): each check passes on the
composed world and fails on a fixture that breaks its rule, made by mutating that world's ground (or its meta / its
document), and every exported cut opens the leak its gate prevents.

  python3 -I assets-src/tools/worldgen/selftest_gates.py      # one OK line per case; exit 1 on a failure

- the composed world: every check of 3.8 OK;
- the former GT-38: a river across `western_range` (Melmond to Sarda) fails `barriers` (by canoe);
- the former GT-39: a river joining a northern island to a southern coast (a walk+canoe link) fails `north`;
- a ford on a pinned canoe route fails `routes`; a river joining R-waterfall to R-ice (two regions) fails it too,
  and so does a grass path onto the waterfall's ledge (canoe only);
- a Water cell across a wall line fails `walls`; a sea lane joining the Aldi to the ocean fails `basins`; a canal
  cell turned to rock fails it (the canal pass);
- a second way across the spine (a land bridge beside the north bridge) fails `barriers`;
- a dock moved onto land fails `docks`; a landing spot on snow fails `landings`; an ELF entrance moved onto FIRE's
  land fails `world` (the owner grid's ids);
- prewalk's vacuity (rev 3.2, NW-0's `vacuity_demo`): Elfheim's gate ringed with rock passes prewalk as rev 3 worded
  it (a stage's own entrances as starts) and fails the corrected prewalk with `S4 elf_elfheim` and a blocking cell;
- `world.cuts`: each wall's cut opened to Water joins aldi and ocean; each barrier's opened to grass joins its seeds.
"""
from __future__ import annotations

import copy
import sys
from pathlib import Path

import numpy as np

TOOLS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOLS))
sys.path.insert(0, str(TOOLS / "layouts"))
from worldgen import bundle, gates, gates_canoe, gates_hike, gates_reach, prewalk  # noqa: E402
from worldgen.geom import raster_line  # noqa: E402
from world_api import CANOE_BARRIERS, DOCKS_ALLOWED, NORTH_REGIONS  # noqa: E402


def _line(g, a, b, ch, keep=()):
    h = g.copy()
    for x, y in raster_line([tuple(a), tuple(b)]):
        if (x, y) not in keep:
            h[y, x] = ch
    return h


def main() -> int:
    import world_checks as WC2
    import world
    import world_source as SRC
    from a1 import world_a1_pins as T
    from world_specs.common import hike
    g, meta, b, doc, ch = world.build()
    E = meta["entrances"]
    _off, ent_map = SRC.doors()
    seeds = {"barriers": b.barrier_seeds, "links": b.links}
    cases = []

    def case(name, ok, detail):
        cases.append((name, ok, detail))

    bad = [k for k, v in ch.items() if not v["ok"]]
    case("the composed world passes every check", not bad, f"{len(ch)} checks" if not bad else f"failing: {bad}")
    ends = {tuple(E["ert_melmond"]), tuple(E["ert_sarda"])}
    h = _line(g, E["ert_melmond"], E["ert_sarda"], "r", ends)
    r = gates_reach.barriers(h, meta, seeds, CANOE_BARRIERS)
    case("GT-38: a river across western_range fails barriers", not r["ok"] and r["western_range_canoe"],
         f"western_range_canoe {r['western_range_canoe']}; {r['why'][:1]}")
    h = _line(g, E["wat_onrac"], E["ert_melmond"], "r", {tuple(E["wat_onrac"]), tuple(E["ert_melmond"])})
    r = gates_reach.north(h, meta, NORTH_REGIONS)
    case("GT-39: a river from a northern island to a southern coast fails north", not r["ok"],
         f"{len(r['mixed_components'])} mixed components")
    route = meta["routes"]["R-ice"]
    h = g.copy()
    x, y = route[len(route) // 2]
    h[y, x] = "="
    r = gates.routes(h, meta)
    case("a ford on R-ice fails routes", not r["ok"] and r["R-ice"]["ford_cells"] == 1, f"R-ice {r['R-ice']}")
    wf, ice = meta["routes"]["R-waterfall"], meta["routes"]["R-ice"]
    r = gates.routes(_line(g, wf[-1], ice[0], "r"), meta)
    case("a river joining R-waterfall (water) to R-ice (fire) fails routes",
         not r["ok"] and any("one River / Lake system" in w for w in r["why"]), f"{r['why'][-1:]}")
    h = g.copy()                             # the waterfall's ledge given a grass path to the snowfield
    x, y = E["wat_waterfall"]
    h[y, x - 1] = h[y, x - 2] = h[y, x - 3] = "."
    r = gates_reach.routes(h, meta)
    case("a grass path onto the waterfall's ledge fails routes (canoe only, 4.1)",
         not r["ok"] and any("ledge wat_waterfall" in w for w in r["why"]), f"{r['why'][-1:]}")
    m = meta["wall_masks"]["W_isthmus"]
    h = g.copy()
    ys, xs = m.nonzero()
    h[ys[len(ys) // 2], xs[len(xs) // 2]] = "o"
    r = gates.walls(h, meta)
    case("a Water cell in W_isthmus fails walls", not r["ok"],
         f"{r['water_cells_in_wall_core_3wide']['W_isthmus']} cell")
    docks = {d["id"]: (d["x"], d["y"]) for d in meta["docks"]}
    h = _line(g, docks["ert_dwarf"], docks["ert_melmond"], "o")
    r = gates.basins(h, meta)
    case("a sea lane from the Aldi to the ocean fails basins", not r["ok"] and not r["disjoint"],
         f"disjoint {r['disjoint']}")
    h = g.copy()
    for x, y in meta["canal"][:3]:
        h[y, x] = "m"
    r = gates.basins(h, meta)
    case("a canal cell turned to rock fails basins (the canal pass)",
         not r["ok"] and any("canal cells not walkable" in w for w in r["why"]), f"{r['why'][:1]}")
    h = g.copy()                             # a causeway beside the bridge: the spine has a second way across
    bx = max(x for x, _ in meta["bridge"]) + 2
    for y in range(min(y for _, y in meta["bridge"]) - 3, max(y for _, y in meta["bridge"]) + 4):
        h[y, bx] = "."
    r = gates_reach.barriers(h, meta, seeds, CANOE_BARRIERS)
    case("a causeway beside the north bridge fails barriers (spine)", not r["ok"] and r["spine_foot_bridge_off"],
         f"{r['why'][:1]}")
    m2 = copy.deepcopy(meta)
    d = next(d for d in m2["docks"] if d["id"] == "elf_port")
    d["x"], d["y"] = E["elf_elfheim"]
    r = gates.docks(g, m2, DOCKS_ALLOWED)
    case("a dock moved onto land fails docks", not r["ok"], f"{r['why'][:1]}")
    snow = np.argwhere(g == "n")[0]
    sp = {**doc["spots"], "wnd_s_test_airship": {"at": [int(snow[1]), int(snow[0])], "kind": "landing"}}
    r = gates_reach.landings(g, meta, b.north, hike(), sp)
    case("a landing spot on snow fails landings", not r["ok"], f"{r['why'][:1]}")
    d2 = copy.deepcopy(doc)
    d2["entrances"]["elf_keep"] = list(E["fir_crescent"])
    errs, _s = WC2.check(g, meta, d2, tuple(T.ENTRANCES))
    case("an ELF entrance on FIRE's land fails world (the owner grid's ids)",
         any("elf_keep" in e and "owned by fire" in e for e in errs), f"{[e for e in errs if 'elf_keep' in e][:1]}")
    x, y = E["elf_elfheim"]
    h = g.copy()
    for yy in range(y - 3, y + 4):
        for xx in range(x - 3, x + 4):
            if max(abs(xx - x), abs(yy - y)) == 3:
                h[yy, xx] = "m"
    vac = prewalk.prewalk(h, meta, ent_map, doc["spots"], vacuous=True)
    fixed = prewalk.prewalk(h, meta, ent_map, doc["spots"])
    det = prewalk.details(fixed, meta)
    case("sealed Elfheim: rev 3's prewalk passes, the corrected one fails with S4 elf_elfheim and a blocking cell",
         vac["ok"] and not fixed["ok"] and "S4 elf_elfheim" in prewalk.failures(fixed)
         and any(s.startswith("S4 elf_elfheim") and "nearest block 'm'" in s for s in det),
         f"as worded {'OK' if vac['ok'] else 'FAIL'}, corrected {det[:1]}")
    cuts = doc["world"]["cuts"]
    opened = []
    for k in meta["wall_masks"]:
        h = gates.with_patches(g, meta, False, False)
        for x, y in cuts[k]:
            h[y, x] = "o"
        aldi, _ocean = gates.seas(h, meta)
        opened.append((k, bool(_ocean[np.nonzero(aldi)].any()) if aldi.any() else False))
    SE = gates_reach.seed_cells(meta, doc["spots"])
    for k, (a, bs, _c, patch) in b.barrier_seeds.items():
        h = gates.with_patches(g, meta, bridge=not patch)
        for x, y in cuts[k]:
            h[y, x] = "."
        opened.append((k, any(gates.joined(gates.walk(h), SE[a], SE[x]) for x in bs)))
    case("every cut of world.cuts opens its leak (walls to Water join aldi and ocean; barriers to grass join their "
         "seeds)", all(v for _, v in opened), f"{[k for k, v in opened if not v] or len(opened)}")
    nw2_cases(g, meta, b, doc, ent_map, case)
    fails = 0
    for name, ok, detail in cases:
        print("OK" if ok else "FAIL", f"{name} ({detail})")
        fails += not ok
    print(f"worldgen gate selftest: {len(cases) - fails} of {len(cases)} OK")
    return 1 if fails else 0


def nw2_cases(g, meta, b, doc, ent_map, case) -> None:
    """NW2-0 (docs/NW2_EDITS_PLAN.md 8): the six new checks, each failing on a record declared on today's world (the
    specs declare none yet), with a declared record that passes where today's world allows one; a `spot:` seed."""
    from world_specs.common import hike
    sp, hk = doc["spots"], hike()
    gurgu = bundle.Gorge("R-volcano", 0, 1, "fir_volcano", "S15")
    r = gates_canoe.canoe_gates(g, meta, [gurgu], sp)
    ok = r["ok"] and not r["fir_volcano"]["foot"] and r["fir_volcano"]["canoe"]
    r2 = gates_canoe.canoe_gates(g, meta, [bundle.Gorge("x", 0, 1, "ert_melmond", "S11")], sp)
    r3 = gates_canoe.canoe_gates(g, meta, [bundle.Gorge("x", 0, 1, "fir_volcano", "S15", "elf_port")], sp)
    case("canoe_gates: Gurgu (S15) passes; a site on foot (Melmond, S11) fails, and so does Gurgu with a dock "
         "withheld that does not cut it (elf_port)", ok and not r2["ok"] and r2["ert_melmond"]["foot"]
         and not r3["ok"] and r3["fir_volcano"]["without_elf_port"], f"{r['note']}; {r2['why'][:1]}")
    r = gates_canoe.gorges(g, meta, [gurgu], sp, doc)
    v = r.get("fir_volcano", {})
    case(f"gorges: today's Gurgu way ({v.get('canoe')} canoe steps, {v.get('pass')} pass cells, E {v.get('E')}) "
         "fails M / N / E", not r["ok"] and 0 < v.get("canoe", 0) < 26, f"{r['why'][:1]}")
    rels = [bundle.Relation("fir_ice", "fir_crescent", "north_of", 40),
            bundle.Relation("ert_dwarf", "canal", "north_of", 10),
            bundle.Relation("fir_crescent", "fir_volcano", "bearing", 50, 0)]
    r = gates_canoe.relations(meta, rels)
    ok = gates_canoe.relations(meta, [bundle.Relation("fir_volcano", "fir_crescent", "min_dist", 10)])["ok"]
    case("relations: today's Ice Cavern south of Crescent and dwarves south of the canal fail; true ones pass",
         not r["ok"] and len(r["why"]) == 2 and ok, f"{r['note']}")
    r = gates_canoe.duergar_south(g, meta, [bundle.Apart("duergar_south", "ert_dwarf", "elf_keep")])
    case("duergar_south: today's dwarves join the Western Keep with the canal off",
         not r["ok"] and r["duergar_south"]["foot"], f"{r['why'][:1]}")
    ok = gates_hike.hikes(g, meta, b.hikes, hk, sp, doc)["ok"]      # NW2-W: the declared hikes pass on the world
    g2, (ox, oy) = g.copy(), meta["entrances"]["wat_onrac"]
    g2[oy, ox - 2] = "."                     # ... and a grass cell planted 2 steps from Onrac's gate fails the floor
    r = gates_hike.hikes(g2, meta, [bundle.Hike("wat_onrac", "wat_s_onrac_airship")], hk, sp, doc)
    v = r.get("wat_onrac", {})
    case(f"hikes: the declared hikes pass; a landing planted {v.get('floor')} steps from Onrac fails the floor K "
         f"{hk['floor']}", ok and not r["ok"] and v.get("floor") is not None and v["floor"] < hk["floor"],
         f"{r['note']}")
    m2 = copy.deepcopy(meta)
    m2["docks"] = [d for d in m2["docks"] if d["id"] != "elf_port"]
    r = prewalk.dock_towns(g, m2, ent_map)
    rf = gates_reach.landings(g, meta, b.north, {**hk, "cap": 0})
    case("dock_towns: Elfheim without elf_port fails; landings with the cap 0 fails",
         not r["ok"] and any("elfheim" in w for w in r["why"]) and not rf["ok"], f"{r['why'][:1]}")
    seeds = {"barriers": {"crescent_ring": ("spot:fir_s_crescent", ("fir_volcano",), False, False)}, "links": {}}
    r = gates_reach.barriers(g, meta, seeds, (), None, sp)
    case("a `spot:` barrier seed resolves (crescent_ring from fir_s_crescent holds on foot, with a cut)",
         r["ok"] and not r["crescent_ring_foot"] and bool(r["cuts"]["crescent_ring"]),
         f"cut {len(r['cuts']['crescent_ring'])}")


if __name__ == "__main__":
    sys.exit(main())
