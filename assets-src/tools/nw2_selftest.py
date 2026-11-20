"""NW-2 (docs/NATURAL_WORLD_PLAN.md 2.6, D-NW9): the Python side of tundra `t` and snow `n`. Both compile (classic and
organic) to TerrainType 12 / 13, walk like grass (the reachability and the layout scripts' WALKABLE), and the airship
lands on tundra, never on snow (a `landing` spot). Run by map_selftest.run (build_map.py --selftest); the organic
painting's blend case is terrain/selftest.py's `_cold_case`."""
from __future__ import annotations

import sys
from pathlib import Path

import kit as K
import map_graph as G

sys.path.insert(0, str(Path(__file__).resolve().parent))
from worldgen.gates import BLOCK  # noqa: E402


def run(B) -> int:
    kit = K.load_kit("overworld", placeholders_only=True)
    ok = 0
    assert B.LEGEND["t"] == "tundra" and B.LEGEND["n"] == "snow" and (B.TUNDRA, B.SNOW) == (12, 13)
    assert B.SOFT[-2:] == ["tundra", "snow"], "new soft materials go at the end (a layer's seed is its index)"
    for organic in (False, True):
        src = {"id": "cold", "ground": "..tt\n.nnt\n....", "entrances": {"a": [0, 0]},
               "spots": {"t_s_moss": {"at": [3, 0], "kind": "landing"}}, **({"terrain": "organic"} if organic else {})}
        c = B.compile_map(src, kit, check_interiors=False)
        assert int(c.collision[0, 2]) == B.TUNDRA and int(c.collision[1, 1]) == B.SNOW, "TerrainType 12 / 13"
        assert G.reach(c.collision, [(0, 0)]) >= {(1, 1), (2, 1), (3, 0)}, "tundra and snow are walkable"
        ok += 2
        try:
            B.compile_map({**src, "spots": {"t_s_drift": {"at": [1, 1], "kind": "landing"}}}, kit,
                          check_interiors=False)
        except B.MapError as e:
            assert "(landing) at (1, 1) is not a landing cell" in str(e), e
            ok += 1
        else:
            raise AssertionError("a landing spot on snow must fail")
    assert "t" not in BLOCK and "n" not in BLOCK, "the composer's gates walk tundra and snow (worldgen.gates.BLOCK)"
    assert B.map_kit({"ground": "..."}, kit) is kit or "tundra" not in B.map_kit({"ground": "..."}, kit).materials, \
        "no tundra / snow fallback texture on a map without them (today's maps compile as before)"
    assert "tundra" in B.map_kit({"ground": ".t."}, kit).materials
    assert "snow" in B.map_kit({"ground": "n"}, kit).materials
    return ok + 2
