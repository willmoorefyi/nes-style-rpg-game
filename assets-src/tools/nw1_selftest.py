"""NW-1 (docs/NATURAL_WORLD_PLAN.md 5.2, 6.1): a map source's `spots` reach the compiled map
(`build_hooks.passthrough`) and every spot lies on a cell of its kind (map_checks_spots.py); the Mode 7 atlas's cell
size comes from the world's width. Run by map_selftest.run (build_map.py --selftest)."""
from __future__ import annotations

import build_hooks as HOOKS
import kit as K
import mode7_atlas as M7


def run(B) -> int:
    kit = K.load_kit("town", placeholders_only=True)
    ok = 0
    assert M7.cell_px(192) == (16, 8) and M7.cell_px(256) == (12, 6), "3072 // width and half that"
    for bad in (200, 1000):
        try:
            M7.cell_px(bad)
        except M7.AtlasError:
            ok += 1
            continue
        raise AssertionError(f"cell_px({bad}) has no whole box and must be refused")
    ok += 1
    good = {"id": "spots", "ground": "....\n.oo.\n....", "entrances": {"a": [0, 0]},
            "spots": {"t_s_meadow": {"at": [0, 2], "kind": "land"}, "t_s_moor": {"at": [1, 1], "kind": "dock"},
                      "t_s_field": {"at": [3, 0], "kind": "landing"}}}
    c = B.compile_map(good, kit, check_interiors=False)
    doc = {"id": c.id, "width": c.width, "height": c.height}
    HOOKS.passthrough(good, doc)
    assert doc["spots"] == good["spots"], f"passthrough lost the spots: {doc.get('spots')}"
    ok += 1
    bad = {"t_s_wet": ({"at": [2, 1], "kind": "land"}, "(land) at (2, 1) is not walkable"),
           "t_s_dry": ({"at": [0, 0], "kind": "dock"}, "(dock) at (0, 0) is not Water"),
           "t_s_far": ({"at": [9, 0], "kind": "land"}, "is off the 4x3 map"),
           "t_s_odd": ({"at": [0, 0], "kind": "harbour"}, "expected {at: [x, y], kind: land | dock | landing}"),
           "t_s_warp": ({"at": [3, 2], "kind": "landing"}, "a transition, gate or static NPC")}
    for name, (spot, needle) in bad.items():
        src = {**good, "spots": {name: spot}, "transitions": [{"x": 3, "y": 2, "targetMap": "x", "targetEntrance": "a"}]}
        try:
            B.compile_map(src, kit, check_interiors=False)
        except B.MapError as e:
            assert needle in str(e), f"{name}: expected {needle!r} in: {e}"
            ok += 1
            continue
        raise AssertionError(f"{name}: expected a MapError containing {needle!r}")
    return ok
