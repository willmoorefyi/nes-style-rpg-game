"""The generator's selftests (docs/NATURAL_WORLD_PLAN.md 3.2, 2.5; NW-2). Synthetic specs, then the real world:

  python3 -I assets-src/tools/worldgen/selftest.py        # prints one OK line per case; exit 1 on a failure

1. a straight-edged (square) continent ends with no straight coast run > 6 (the bare polygon has 40-cell runs);
2. a ridge becomes a range with foothills: mountain along the ridgeline only, high ground beside it;
3. every river reaches the sea or a lake;
4. a pinned canoe route connects its ends;
5. a river across a corridor gets a ford (and past `max_fords`, a cut);
6. locality (2.5): editing one continent changes the land field only within its box plus a 24-cell margin;
7. determinism (G-NW5): the composer v2's source is byte-identical under PYTHONHASHSEED 0 and 1;
8. preset B at seed 1987 meets NW-0's gates (G-NW1-3, the land band, the exemption cap, no ford cut) and every
   check passes (NW-RINT: the exact NW-0 figures are a record in the plan; the region tranches move them).
Gate checks on mutated worlds are `selftest_gates.py`.
"""
from __future__ import annotations

import hashlib
import os
import subprocess
import sys
from pathlib import Path

import numpy as np

TOOLS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOLS))
sys.path.insert(0, str(TOOLS / "layouts"))
from worldgen import compose, gates, hydro, metrics, shape  # noqa: E402
from worldgen import spec as S  # noqa: E402
from worldgen.bundle import Continent, Corridor, RegionSpec, Ridge, empty_template  # noqa: E402
from worldgen.geom import components, pline  # noqa: E402

SQUARE = ((-60, -60), (20, -60), (20, 20), (-60, 20))
RIDGE = Ridge(((-50, -20), (10, -24)), 1.0, 3.0, "a test range")
ROUTE = ((-30, 0), (-10, 4), (8, 10))
# NW-RINT: NW-0's preset-B figures (land 28,874, coast edges 5,204, index 30.6, jogs 33, ...) are a historical record
# in docs/NATURAL_WORLD_PLAN.md 12 and 15; the region tranches tune them on purpose, so case 8 asserts NW-0's gates
# on the world as it is now (G-NW1-3, the land band, the exemption cap, no ford cut, every check OK); case 7 is the
# exact one (the source byte-identical under two hash seeds and equal to the committed one).


def synthetic(**kw) -> RegionSpec:
    b = RegionSpec(region="t", continents=[Continent("square", "a1", SQUARE)], template=empty_template(),
                   sites={"t_site": S.world((-20, 10))})
    for k, v in kw.items():
        setattr(b, k, v)
    return b


def case_square() -> str:
    g, m = compose.compose(synthetic())
    r = metrics.gates(g, m["exempt"])
    bare = np.full(g.shape, "o")
    x0, y0 = S.world(SQUARE[0])
    x1, y1 = S.world(SQUARE[2])
    bare[y0:y1, x0:x1] = "."
    longest = max(run[3] for run in metrics.coast_runs(bare)[0])
    assert longest >= 40 and r["G1_fail_runs_gt6"] == 0, (longest, r["G1_fail_list"])
    return f"square: bare polygon's longest run {longest}, generated {r['G1_longest_nonexempt']} (jogs {m['jogs']})"


def case_ridge(g, m) -> str:
    d = pline(S.poly(RIDGE.points))
    mtn = g == "m"
    near = (mtn & (d <= 3 * RIDGE.width)).sum() / max(mtn.sum(), 1)
    beside = (g != "o") & ~mtn & (d > 1.5) & (d <= 2 * RIDGE.width)
    high = (m["elev"][beside] > 0.25).mean()
    assert mtn[d <= 1].mean() > 0.8 and near > 0.9 and high > 0.5, (mtn[d <= 1].mean(), near, high)
    return f"ridge: {mtn[d <= 1].mean():.0%} of the ridgeline mountain, {near:.0%} of the mountain on it, " \
           f"{high:.0%} of the flanks high (foothills)"


def case_rivers(g) -> str:
    river = np.isin(g, ["r", "="])           # a river course: its cells and its fords
    lab, sz = components(river)
    wet = np.isin(g, ["o", "≈"])
    near = np.zeros(g.shape, bool)
    for s, a in ((1, 0), (-1, 0), (1, 1), (-1, 1)):
        near |= np.roll(wet, s, a)
    ends = [k for k in range(1, len(sz)) if (near & (lab == k)).any()]
    assert len(sz) > 1 and len(ends) == len(sz) - 1, (len(sz) - 1, len(ends))
    return f"rivers: {len(sz) - 1} river systems, every one ends in the sea or a lake"


def case_route(g, m) -> str:
    r = gates.routes(g, m)
    assert r["ok"], r
    return f"route: R-test connects ({len(m['routes']['R-test'])} cells, no ford)"


def case_fords() -> str:
    grid = np.full((20, 20), ".")
    for x in (4, 9, 14):
        grid[:, x] = "r"
    corr = {"c": [(x, 10) for x in range(1, 19)]}
    fl, cut = hydro.fords(grid, corr, [], np.zeros((20, 20), bool))
    assert len(fl["c"]) == 2 and cut == 1 and all(grid[10, x] == "=" for x, _ in fl["c"]), (fl, cut)
    assert sum(grid[10, x] == "." for x in (4, 9, 14)) == 1, "the third crossing is cut to grass"
    return "fords: 3 crossings -> 2 fords on the centre line, 1 cut"


def case_locality() -> str:
    import world_specs
    from worldgen.bundle import merge
    specs = world_specs.load()
    base = shape.shape(merge(specs), S.PRESET, S.SEED)["land"]
    wind = specs[-1]
    poly = list(wind.continents[0].polygon)
    poly[3] = (poly[3][0] + 6, poly[3][1] - 4)
    wind.continents[0] = Continent(wind.continents[0].name, "wind", tuple(poly), wind.continents[0].fjord)
    land = shape.shape(merge(specs), S.PRESET, S.SEED)["land"]
    xs, ys = zip(*S.poly(poly))
    m = 24
    box = np.zeros(land.shape, bool)
    box[max(0, int(min(ys)) - m):int(max(ys)) + m + 1, max(0, int(min(xs)) - m):int(max(xs)) + m + 1] = True
    changed = base != land
    assert changed.any() and not (changed & ~box).any(), int((changed & ~box).sum())
    return f"locality: a Gaia edit changes {int(changed.sum())} land cells, none outside its box + {m}"


def case_determinism() -> str:
    out = {}
    script = TOOLS / "layouts" / "world.py"
    target = TOOLS.parent / "maps" / "overworld.yaml"
    for seed in ("0", "1"):
        env = {**os.environ, "PYTHONHASHSEED": seed}
        subprocess.run([sys.executable, "-I", str(script), "--check", "--out", f"/tmp/nw2_det_{seed}.yaml"],
                       check=True, env=env, capture_output=True)
        out[seed] = hashlib.sha256(Path(f"/tmp/nw2_det_{seed}.yaml").read_bytes()).hexdigest()
    same = out["0"] == out["1"]
    committed = target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == out["0"]
    assert same and committed, (out, committed)
    return "determinism: the source is identical under PYTHONHASHSEED 0 and 1 and equals the committed one"


def case_b(fig: dict) -> str:
    from world_api import EXEMPT_CAP, G2_MIN, LAND_TARGET
    r, r32 = fig["gates"], fig["gates_rev32"]
    lo, hi = LAND_TARGET
    want = {"G1 (no non-exempt coast run over 6)": r32["G1_fail_runs_gt6"] == 0,
            f"G2 (coast index >= {G2_MIN})": r32["G2_index"] >= G2_MIN,
            "G3 (no chunk-line class run over 6)": r32["G3_fail_runs_gt6"] == 0 and r["G3_fail_runs_gt6"] == 0,
            f"land in [{lo}, {hi}]": lo <= r32["land"] <= hi,
            f"exempt <= {EXEMPT_CAP}": fig["exempt_cells"] <= EXEMPT_CAP, "no ford cut": fig["ford_cuts"] == 0}
    bad = [k for k, v in want.items() if not v] + [k for k, v in fig["checks"].items() if not v["ok"]]
    assert not bad, bad
    return f"preset B: NW-0's gates hold on the merged world (land {r32['land']}, index {r32['G2_index']}, " \
           f"longest coast run {r32['G1_longest_nonexempt']}, jogs {fig['jogs']}), every check OK"


def main() -> int:
    import world
    fails = 0
    g, m = compose.compose(synthetic(ridges=[RIDGE], routes={"R-test": ROUTE},
                                     corridors=[Corridor("c", ((-55, -40), (15, -40)))]))
    g0, meta, _b, _doc, ch = world.build()
    cases = [case_square, lambda: case_ridge(g, m), lambda: case_rivers(g), lambda: case_route(g, m), case_fords,
             case_locality, case_determinism, lambda: case_b(world.figures(g0, meta, ch))]
    for c in cases:
        try:
            print("OK", c())
        except AssertionError as e:
            fails += 1
            print("FAIL", getattr(c, "__name__", "case"), e)
    print(f"worldgen selftest: {len(cases) - fails} of {len(cases)} OK")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
