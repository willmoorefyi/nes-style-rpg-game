"""NW-2 (docs/NATURAL_WORLD_PLAN.md 2.6, D-NW9), NW2 (docs/NW2_EDITS_PLAN.md 3, D-NW2-4): the Python side of taiga
`t` (tundra before NW2) and snow `n`. Both compile (classic and organic) to TerrainType 12 / 13, are walkable (the
reachability and the layout scripts' WALKABLE), and the airship lands on grass, never on taiga or snow (a `landing`
spot). Run by map_selftest.run (build_map.py --selftest); the organic
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
    assert B.LEGEND["t"] == "taiga" and B.LEGEND["n"] == "snow" and (B.TAIGA, B.SNOW) == (12, 13)
    assert B.SOFT[-2:] == ["taiga", "snow"], "new soft materials go at the end (a layer's seed is its index)"
    for organic in (False, True):
        src = {"id": "cold", "ground": "..tt\n.nnt\n....", "entrances": {"a": [0, 0]},
               "spots": {"t_s_meadow": {"at": [1, 2], "kind": "landing"}}, **({"terrain": "organic"} if organic else {})}
        c = B.compile_map(src, kit, check_interiors=False)
        assert int(c.collision[0, 2]) == B.TAIGA and int(c.collision[1, 1]) == B.SNOW, "TerrainType 12 / 13"
        assert G.reach(c.collision, [(0, 0)]) >= {(1, 1), (2, 1), (3, 0)}, "taiga and snow are walkable"
        ok += 2
        for at, what in (([1, 1], "snow"), ([3, 0], "taiga")):
            try:
                B.compile_map({**src, "spots": {"t_s_drift": {"at": at, "kind": "landing"}}}, kit,
                              check_interiors=False)
            except B.MapError as e:
                assert f"(landing) at ({at[0]}, {at[1]}) is not a landing cell" in str(e), e
                ok += 1
            else:
                raise AssertionError(f"a landing spot on {what} must fail")
    assert "t" not in BLOCK and "n" not in BLOCK, "the composer's gates walk taiga and snow (worldgen.gates.BLOCK)"
    assert B.map_kit({"ground": "..."}, kit) is kit or "taiga" not in B.map_kit({"ground": "..."}, kit).materials, \
        "no taiga / snow fallback texture on a map without them (today's maps compile as before)"
    assert "taiga" in B.map_kit({"ground": ".t."}, kit).materials
    from worldgen.gates import LANDING  # noqa: E402
    assert LANDING == ["."], "the composer's landing cells are grass only (D-NW2-4)"
    assert "snow" in B.map_kit({"ground": "n"}, kit).materials
    return ok + 2
