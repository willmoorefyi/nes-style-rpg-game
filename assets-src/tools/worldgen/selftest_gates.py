"""The gate checks' selftests (docs/NATURAL_WORLD_PLAN.md 3.2, 3.8, 4.5; NW-2): each check passes on the composed
world and fails on a fixture that breaks its rule, made by mutating that world's ground.

  python3 -I assets-src/tools/worldgen/selftest_gates.py      # one OK line per case; exit 1 on a failure

- the composed world: every check of 3.8 OK;
- the former GT-38: a river across `western_range` (Melmond to Sarda) fails `barriers` (by canoe);
- the former GT-39: a river joining a northern island to a southern coast (a walk+canoe link) fails `north`;
- a ford on a pinned canoe route fails `routes`;
- a Water cell across a wall line fails `walls`; a sea lane joining the Aldi to the ocean fails `basins`;
- prewalk's vacuity (rev 3.2, NW-0's `vacuity_demo`): Elfheim's gate ringed with rock passes prewalk as rev 3 worded
  it (a stage's own entrances as starts) and fails the corrected prewalk with `S4 elf_elfheim`.
"""
from __future__ import annotations

import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOLS))
sys.path.insert(0, str(TOOLS / "layouts"))
from worldgen import gates, prewalk  # noqa: E402
from worldgen.geom import raster_line  # noqa: E402
from world_api_v2 import NORTH_REGIONS  # noqa: E402


def _line(g, a, b, ch, keep=()):
    h = g.copy()
    for x, y in raster_line([tuple(a), tuple(b)]):
        if (x, y) not in keep:
            h[y, x] = ch
    return h


def main() -> int:
    import world_v2
    import world_v2_source as SRC
    g, meta, b, doc, ch = world_v2.build()
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
    r = gates.barriers(h, meta, seeds)
    case("GT-38: a river across western_range fails barriers", not r["ok"] and r["western_range_canoe"],
         f"western_range_canoe {r['western_range_canoe']}")
    h = _line(g, E["wat_onrac"], E["ert_melmond"], "r", {tuple(E["wat_onrac"]), tuple(E["ert_melmond"])})
    r = gates.north(h, meta, NORTH_REGIONS)
    case("GT-39: a river from a northern island to a southern coast fails north", not r["ok"],
         f"{len(r['mixed_components'])} mixed components")
    route = meta["routes"]["R-ice"]
    h = g.copy()
    x, y = route[len(route) // 2]
    h[y, x] = "="
    r = gates.routes(h, meta)
    case("a ford on R-ice fails routes", not r["ok"] and r["R-ice"]["ford_cells"] == 1, f"R-ice {r['R-ice']}")
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
    x, y = E["elf_elfheim"]
    h = g.copy()
    for yy in range(y - 3, y + 4):
        for xx in range(x - 3, x + 4):
            if max(abs(xx - x), abs(yy - y)) == 3:
                h[yy, xx] = "m"
    vac = prewalk.prewalk(h, meta, ent_map, doc["spots"], vacuous=True)
    fixed = prewalk.prewalk(h, meta, ent_map, doc["spots"])
    case("sealed Elfheim: rev 3's prewalk passes, the corrected one fails with S4 elf_elfheim",
         vac["ok"] and not fixed["ok"] and "S4 elf_elfheim" in prewalk.failures(fixed),
         f"as worded {'OK' if vac['ok'] else 'FAIL'}, corrected {prewalk.failures(fixed)}")
    fails = 0
    for name, ok, detail in cases:
        print("OK" if ok else "FAIL", f"{name} ({detail})")
        fails += not ok
    print(f"worldgen gate selftest: {len(cases) - fails} of {len(cases)} OK")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
