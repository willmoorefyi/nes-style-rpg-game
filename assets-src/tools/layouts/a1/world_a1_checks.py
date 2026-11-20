"""Act 1's promises as world checks on the NW world (docs/NATURAL_WORLD_PLAN.md 3.6.3; NW-0's pilot; NW-3).

`act1` (ported from `overworld.check()` and the act-1 tests; patches as stated):
- `spine_only_bridge`: with the bridge patch off, no walk leaves the peninsula (Cornelia joins neither the north shore
  nor Pravoka); with it on, they join (the bridge is the way off);
- the tomb pocket is reachable on foot, only over the east footbridge;
- the temple door is reachable from Cornelia before BRIDGE_BUILT; Matoya and Pravoka after it;
- Pravoka's channel keeps at least 6 Water cells on every channel row;
- the world map has exactly 2 key-item gates, the bridge's (`act1Flow.test.ts`), on the patch's gate cells;
- beyond the bridge the land walkable from `north_shore` is larger than the peninsula (OW-15);
- the boulders stand on grass; every act-1 road is routed, `road_check` ends at TOMB_END and no road has a stub
  (`stubs`, 3.10: a dead end must be a gate, door, entrance, bridge or TOMB_END cell itself, not one cell off);
- every pin cell has its material (`pins`: the entrances walkable, the gap rows Water, the gate cells, the jetty and
  the footbridges bridge `=`, Pravoka's dock Water).
`walks`: the four act-1 walks within +-10 % of today's (3.6.3's feel table; today's figures are derived from today's
ground into the pins, `TODAY_WALKS`), BFS on the new world.
Cells come from `a1/world_a1_pins.py` (Cornelia-relative): world = `spec.world(rel)`.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import world_a1_pins as P  # noqa: E402
from map_checks_terrain import road_caps  # noqa: E402
from worldgen import spec as S  # noqa: E402
from worldgen.gates import joined, walk, with_patches  # noqa: E402
from worldgen.geom import bfs_dist, flood  # noqa: E402

CHANNEL_MIN = 6
WALK_BAND = (0.9, 1.1)
ROAD = [",", ":"]


def W(p) -> tuple[int, int]:
    return S.world(p)


def stubs(g: np.ndarray, marks: list) -> list[tuple[int, int]]:
    """`road_check.no_stubs` on the char grid: every road cap (a dead end up to 2 wide) that holds no mark cell and
    no bridge; roads are `,` / `:`, bridges `=` count as road."""
    road = np.isin(g, ROAD + ["="])
    mark = np.zeros(g.shape, bool)
    for x, y in marks:
        mark[y, x] = True
    return [cap[0] for cap in road_caps(road, 2) if not any(g[y, x] == "=" or mark[y, x] for x, y in cap)]


def marks(meta: dict, trans: list[dict], gates: list[dict]) -> list[tuple[int, int]]:
    out = [(t["x"], t["y"]) for t in trans] + [(k["x"], k["y"]) for k in gates]
    return out + [tuple(c) for c in meta["entrances"].values()] + [W(P.TOMB_END)]


def pin_errors(g: np.ndarray, meta: dict) -> list[str]:
    bad = []
    want = [(e, c, "walkable") for e, c in P.ENTRANCES.items()]
    want += [("gap", c, "o") for c in P.BRIDGE_PATCH[:4]] + [("gate", c, "=") for c in P.BRIDGE_PATCH[4:]]
    want += [("jetty", c, "=") for c in P.JETTY] + [("footbridge", c, "=") for c in P.FOOTBRIDGE]
    want += [("city footbridge", P.CITY_FOOTBRIDGE, "="), ("dock", P.PRAVOKA_DOCK, "o"), ("seed", P.ALDI_SEED, "o")]
    for name, c, m in want:
        x, y = W(c)
        ok = walk(g)[y, x] if m == "walkable" else g[y, x] == m
        if not ok:
            bad.append(f"{name} {(x, y)} is {g[y, x]!r}, not {m}")
    return bad


def act1(g: np.ndarray, meta: dict, trans: list[dict] | None = None, gates: list[dict] | None = None) -> dict:
    E = meta["entrances"]
    on, off = with_patches(g, meta), with_patches(g, meta, bridge=False)
    r = {}
    r["spine_only_bridge"] = (not joined(walk(off), E["cornelia"], E["north_shore"])
                              and not joined(walk(off), E["cornelia"], E["a1_pravoka"])
                              and joined(walk(on), E["cornelia"], E["north_shore"]))
    tomb = W(P.TOMB_END)
    r["tomb_reachable"] = joined(walk(off), E["cornelia"], tomb)
    h = off.copy()
    for q in P.FOOTBRIDGE:
        x, y = W(q)
        h[y, x] = "r"
    r["tomb_only_over_footbridge"] = not joined(walk(h), E["cornelia"], tomb)
    r["temple_before_bridge"] = joined(walk(off), E["cornelia"], E["temple"])
    r["matoya_after_bridge"] = joined(walk(on), E["cornelia"], E["a1_matoya"])
    r["pravoka_after_bridge"] = joined(walk(on), E["cornelia"], E["a1_pravoka"])
    x0, y0, x1, y1 = P.CHANNEL
    rows = []
    for y in range(y0, y1 + 1):
        a, yy = W((x0, y))
        rows.append(sum(1 for x in range(a, a + 40) if all(on[yy, xx] == "o" for xx in range(a, x + 1))))
    r["channel_min_water"] = min(rows)
    pen = flood(walk(off), [E["cornelia"]]).sum()
    beyond = flood(walk(off), [E["north_shore"]]).sum()
    r["beyond_bridge_cells"], r["peninsula_cells"] = int(beyond), int(pen)
    r["boulders_on_grass"] = all(g[y, x] == "." for x, y in map(W, P.BOULDERS))
    r["roads_routed"] = meta["roads_ok"]
    r["tomb_end_on_road"] = g[tomb[1], tomb[0]] in ROAD
    ok_gates = True
    if gates is not None:
        cells = sorted((k["x"], k["y"]) for k in gates)
        ok_gates = len(gates) == 2 and cells == sorted(W(c) for c in P.BRIDGE_PATCH[4:])
    r["two_bridge_gates"] = ok_gates
    r["stubs"] = stubs(g, marks(meta, trans or [], gates or [])) if trans is not None else []
    r["pins_bad"] = pin_errors(g, meta)
    ok = (r["spine_only_bridge"] and r["tomb_reachable"] and r["tomb_only_over_footbridge"]
          and r["temple_before_bridge"] and r["matoya_after_bridge"] and r["pravoka_after_bridge"]
          and r["channel_min_water"] >= CHANNEL_MIN and beyond > pen and r["boulders_on_grass"]
          and all(r["roads_routed"]) and r["tomb_end_on_road"] and ok_gates and not r["stubs"] and not r["pins_bad"])
    return {"ok": bool(ok), **r}


def walks(g: np.ndarray, meta: dict) -> dict:
    gate = W(P.BRIDGE_GATE)
    E = {e: W(c) for e, c in P.ENTRANCES.items()}
    rows = [("south gate -> bridge gate", E["cornelia"], gate, False),
            ("Cornelia -> Temple door", E["cornelia"], E["temple"], False),
            ("bridge -> Pravoka gate", gate, E["a1_pravoka"], True),
            ("bridge -> Matoya's door", gate, E["a1_matoya"], True)]
    h_on, h_off = with_patches(g, meta), with_patches(g, meta, bridge=False)
    new = {n: int(bfs_dist(walk(h_on if br else h_off), [a])[b[1], b[0]]) for n, a, b, br in rows}
    out = {n: {"today": P.TODAY_WALKS[n], "new": new[n],
               "ratio": round(new[n] / P.TODAY_WALKS[n], 3) if new[n] >= 0 else None} for n in new}
    ok = all(v["ratio"] is not None and WALK_BAND[0] <= v["ratio"] <= WALK_BAND[1] for v in out.values())
    return {"ok": ok, **out}
