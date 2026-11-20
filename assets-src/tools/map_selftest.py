"""Self-test cases for the map compiler's core features (run by `build_map.py --selftest`).

Each case fails on the compiler before these features: hash-seed determinism, object offsets / styles /
`collide: alpha`, edge exits, inspect cells, the map checks (map_checks.py), the map report and the preview.
"""
from __future__ import annotations

import json
import tempfile
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

import kit as K
import map_checks as MC
import map_report as MR


def run(B) -> int:
    """B is the build_map module. Returns the number of checks passed (raises AssertionError on a failure)."""
    kit = K.load_kit("town", placeholders_only=True)
    T = B.T
    ok = 0

    def comp(src):
        return B.compile_map(src, kit, check_interiors=False)

    def expect_error(src, needle):
        nonlocal ok
        try:
            comp(src)
        except B.MapError as e:
            assert needle in str(e), f"expected {needle!r} in: {e}"
            ok += 1
            return
        raise AssertionError(f"expected MapError containing {needle!r}")

    def grass_map(rows, cols, **kw):
        return {"id": "t", "ground": "\n".join(["." * cols] * rows), "entrances": {"a": [0, rows - 1]}, **kw}

    assert MC.BLOCKED == {B.WALL, B.WATER, B.COUNTER, B.TERRAIN["mountain"], B.TERRAIN["river"], B.TERRAIN["lake"]}
    assert MC.COUNTER == B.COUNTER and MC.WALL == B.WALL

    # ── 1. determinism: a water cell outside the canal outline between 3 grass and 3 cobble cells
    tie = {"id": "tie", "ground": ".....\n.#.:.\n.:~:.\n.#...\n.....", "entrances": {"a": [0, 0]}}
    assert B.most_common_soft(Counter({"cobble": 3, "grass": 3})) == "grass", "ties go to the earlier SOFT material"
    assert B.most_common_soft(Counter({"cobble": 4, "grass": 3})) == "cobble"
    c = comp(tie)
    cell = c.below[2 * T:3 * T, 2 * T:3 * T]
    grass = B._tile(kit.material("grass"), *c.below.shape[:2])[2 * T:3 * T, 2 * T:3 * T]
    assert np.all(cell == grass, axis=2).mean() > 0.9, "the tie cell shows grass (the earlier SOFT material)"
    with tempfile.TemporaryDirectory() as tmp:
        f = Path(tmp) / "tie.json"
        f.write_text(json.dumps(tie))
        below = {B.hash_run([], str(f), True, str(s))["tie"]["below"] for s in range(8)}
    assert len(below) == 1, f"below differs across PYTHONHASHSEED 0..7: {len(below)} variants"
    ok += 3

    # ── 2. objects: offset, style, collide: alpha (null cells included), alpha_min, walk_cells, prefab
    base = grass_map(4, 6)
    shifted = comp({**base, "objects": [{"type": "deco", "parts": [["bush", None]], "x": 1, "y": 1,
                                         "offset": [36, 0], "collide": "alpha"}]})
    assert shifted.collision[1, 1] == B.GRASS and shifted.collision[1, 2] == B.WALL, \
        f"collide: alpha follows the shifted art ({shifted.collision[1, 1:3]})"
    bush = np.array([40, 120, 50])
    at = lambda img, px, py: np.abs(img[py, px].astype(int) - bush).sum() < 30  # noqa: E731
    assert at(shifted.below, T + 23 + 36, T + 26) and not at(shifted.below, T + 23, T + 26), "offset moves the part"
    plain = comp({**base, "objects": [{"type": "deco", "parts": [["bush"]], "x": 1, "y": 1}]})
    blue = comp({**base, "objects": [{"type": "deco", "parts": [["bush"]], "x": 1, "y": 1, "style": "blue"}]})
    assert not np.array_equal(plain.below[T + 26, T + 23], blue.below[T + 26, T + 23]), "deco style recolours"
    flowers = {"type": "deco", "parts": [["flowers"]], "x": 1, "y": 1}
    assert comp({**base, "objects": [flowers]}).collision[1, 1] == B.WALL
    assert comp({**base, "objects": [{**flowers, "collide": "alpha"}]}).collision[1, 1] == B.GRASS, \
        "a cell with a few opaque pixels stays walkable"
    one_bush = {"type": "deco", "parts": [["bush"]], "x": 1, "y": 1, "collide": "alpha"}
    assert comp({**base, "objects": [one_bush]}).collision[1, 1] == B.WALL
    assert comp({**base, "objects": [{**one_bush, "alpha_min": 0.9}]}).collision[1, 1] == B.GRASS, "alpha_min"
    assert comp({**base, "objects": [{**one_bush, "walk_cells": [[0, 0]]}]}).collision[1, 1] == B.ROAD, "walk_cells win"
    expect_error({**base, "objects": [{"type": "deco", "parts": [["bush", None]], "x": 1, "y": 1},
                                      {"type": "bush", "x": 2, "y": 1}]}, "overlaps")   # null cells are footprint
    expect_error({**base, "objects": [{**one_bush, "collide": "round"}]}, "collide must be")
    pf = {"type": "prefab", "prefab": "pf", "x": 1, "y": 1, "w": 2, "h": 1, "ridge_rows": 0, "offset": [24, 0],
          "collide": "alpha", "alpha_min": 0.6}
    pc = comp({**base, "objects": [pf]})
    assert pc.collision[1, 1] == B.GRASS and pc.collision[1, 2] == B.WALL, "prefab offset + collide: alpha"
    ok += 9

    # ── 3. edge exits
    edge = {"id": "edge", "ground": "......\n......\n..##..\n......\n......", "entrances": {"a": [2, 1]},
            "transitions": [{"x": 0, "y": 2, "targetMap": "explicit", "targetEntrance": "x"}],
            "edge_exits": {s: {"targetMap": "overworld", "targetEntrance": s} for s in B.SIDES}}
    edge["edge_exits"]["split"] = [{"side": "east", "from": 3, "to": 4, "targetEntrance": "e2"}]
    ec = comp(edge)
    by = {(t["x"], t["y"]): t for t in ec.transitions}
    walk_edge = [p for p in MC.edge_cells(6, 5) if MC.walkable(ec.collision, *p)]
    assert len(walk_edge) == 18 and all(p in by for p in walk_edge), "every walkable edge cell is an exit"
    assert by[(0, 0)]["targetEntrance"] == "north" and by[(5, 4)]["targetEntrance"] == "south", "corners: N / S"
    assert by[(5, 1)]["targetEntrance"] == "east" and by[(5, 3)]["targetEntrance"] == "e2", "split"
    assert by[(0, 2)]["targetMap"] == "explicit" and len(ec.transitions) == 18, "explicit transitions win"
    expect_error({**edge, "edge_exits": {"north": {"targetMap": "overworld", "targetEntrance": "n"}}},
                 "walkable edge cells are not exits")
    pocket = {**edge, "ground": ".#....\n.#....\n##....\n......", "entrances": {"a": [3, 3]}, "transitions": []}
    expect_error(pocket, "can't be reached from the first entrance")
    ok += 4

    # ── 4. inspect cells
    insp = {**grass_map(5, 6), "ground": "......\n......\n..##..\n......\n......",
            "inspect": [{"x": 3, "y": 2, "text": ["Here lies Erdrick."]}]}
    ic = comp(insp)
    with tempfile.TemporaryDirectory() as tmp:
        import yaml
        doc = yaml.safe_load(B.write(insp, ic, Path(tmp)).read_text())
        assert doc.get("inspect") == insp["inspect"], "inspect is passed through to the runtime map"
    expect_error({**insp, "inspect": [{"x": 99, "y": 2, "text": ["?"]}]}, "off the map")
    expect_error({**insp, "inspect": [{"x": 3, "y": 2, "text": []}]}, "non-empty text")
    expect_error({**pocket, "edge_exits": None, "inspect": [{"x": 0, "y": 0, "text": ["?"]}]},
                 "no reachable walkable neighbour")
    ok += 1

    # ── 4b. encounter tables and zones (T4e): passed through; group / enemies form, <= 9, known ids, rects in bounds
    table = [{"groups": [{"id": "goblin", "min": 3, "max": 5}], "weight": 5}, {"enemies": ["wolf"], "weight": 1}]
    zoned = {**grass_map(5, 6), "encounters": table,
             "encounterZones": [{"id": "east", "rects": [[3, 0, 5, 4]], "encounters": table}]}
    zc = comp(zoned)
    with tempfile.TemporaryDirectory() as tmp:
        import yaml
        doc = yaml.safe_load(B.write(zoned, zc, Path(tmp)).read_text())
        assert doc.get("encounterZones") == zoned["encounterZones"], "encounterZones is passed through to the runtime map"
    zone = zoned["encounterZones"][0]
    bad = lambda **kw: {**zoned, "encounterZones": [{**zone, **kw}]}  # noqa: E731
    expect_error(bad(rects=[[3, 0, 6, 4]]), "not an inclusive rect inside the 6x5 map")
    expect_error(bad(rects=[[4, 0, 3, 4]]), "not an inclusive rect")
    expect_error(bad(encounters=[{"groups": [{"id": "goblin", "min": 6}, {"id": "wolf", "min": 1, "max": 4}],
                                  "weight": 1}]), "up to 10 enemies, more than 9")
    expect_error(bad(encounters=[{"groups": [{"id": "goblin", "min": 3, "max": 2}], "weight": 1}]), "0 <= min <= max")
    expect_error(bad(encounters=[{"enemies": ["goblin"], "groups": [{"id": "goblin", "min": 1}], "weight": 1}]),
                 "exactly one of enemies or groups")
    expect_error({**zoned, "encounters": [{"enemies": ["dragon_of_nowhere"], "weight": 1}]}, "unknown enemy ids")
    expect_error(bad(encounters=[{"groups": [{"id": "gobln", "min": 1}], "weight": 1}]), "unknown enemy ids ['gobln']")
    walled = {**zoned, "ground": "......\n......\n......\n......\n.....#"}
    expect_error({**walled, "encounterZones": [{**zone, "rects": [[5, 4, 5, 4]]}]}, "covers no walkable cell")
    expect_error({**zoned, "encounterZones": [zone, zone]}, "duplicate zone id")
    expect_error(bad(id=""), "non-empty string id")
    ok += 1

    # ── 5. map checks
    ok_src = lambda s: comp(s) and True  # noqa: E731
    open_map = grass_map(3, 5)
    expect_error({**open_map, "sealed_edges": True}, "sealed_edges")
    assert ok_src({"id": "s", "ground": "ooooo\no...o\nooooo", "entrances": {"a": [1, 1]}, "sealed_edges": True})
    ok += 1
    road = {"id": "r", "ground": "..........\n.,,,,,,,..\n..........", "entrances": {"a": [0, 1]}}
    expect_error({**road, "road_check": {"materials": ["dirt"]}}, "dead ends")
    assert ok_src({**road, "road_check": {"materials": ["dirt"], "ends": [[7, 1]]}})
    expect_error({**road, "road_check": {"ends": [[7, 1]], "no_stubs": True}}, "one cell off")   # NW 3.10
    assert ok_src({**road, "entrances": {"a": [1, 1]}, "road_check": {"ends": [[7, 1]], "no_stubs": True}})
    expect_error({**road, "ground": "..........\n.,,,..,,..\n..........",
                  "road_check": {"ends": [[3, 1], [6, 1], [7, 1]]}}, "separate networks")
    expect_error({**road, "road_check": {"ends": [[7, 1]], "check_under": True},
                  "objects": [{"type": "bush", "x": 4, "y": 1}]}, "under a blocked object")
    # town props standing on cobble are fine unless check_under is asked for
    assert ok_src({**road, "road_check": {"ends": [[7, 1], [3, 1], [5, 1]]}, "objects": [{"type": "bush", "x": 4, "y": 1}]})
    # a broken bridge: the far stub (all bridge cells) is not a stray network; listed islands are fine too
    span = {"id": "br", "ground": "..........\n.,,,,=~~=.\n..........", "entrances": {"a": [0, 1]}}
    assert ok_src({**span, "road_check": {"ends": [[1, 1]]}})
    isle = {**road, "ground": "..........\n.,,,..,,..\n.........."}
    assert ok_src({**isle, "road_check": {"ends": [[3, 1], [6, 1], [7, 1], [1, 1]], "islands_ok": [[6, 1]]}})
    ok += 3
    wide = {"id": "w", "ground": "........\n.,,,,,..\n.,,,,,..\n........", "entrances": {"a": [0, 1]}}
    expect_error({**wide, "road_check": {}}, "dead ends")                         # a 2-wide dead end
    assert ok_src({**wide, "road_check": {"ends": [[6, 2]]}})
    mask = np.zeros((8, 8), bool)
    mask[1:3, 1:7] = True
    mask[3:7, 5:7] = True
    caps = sorted(sorted(cp) for cp in MC.road_caps(mask))
    assert caps == [[(1, 1), (1, 2)], [(5, 6), (6, 6)]], f"a 2-wide bend has only its two ends as caps: {caps}"
    ok += 3
    warp = {"id": "wp", "ground": "#####\n.....\n.....", "entrances": {"a": [0, 2]},
            "transitions": [{"x": 2, "y": 1, "targetMap": "x", "targetEntrance": "y"}], "warp_leaves": True,
            "objects": [{"type": "deco", "parts": [["bush", "bush", "bush"]], "x": 1, "y": 1, "walk_cells": [[1, 0]]}]}
    assert ok_src(warp)
    expect_error({**warp, "ground": ".....\n.....\n....."}, "warp_leaves")
    # a walkable cell inside the icon also leads away: the warp is a junction
    expect_error({**warp, "objects": [{**warp["objects"][0], "walk_cells": [[0, 0], [1, 0]]}]}, "warp_leaves")
    # an arrival on a warp cell is an error
    expect_error({**warp, "warp_leaves": False, "entrances": {"a": [0, 2], "door": [2, 1]}}, "is on a transition cell")
    # inspect: a misspelt condition key is rejected
    expect_error({**grass_map(3, 3), "inspect": [{"x": 1, "y": 1, "text": [{"requiredFlag": "F", "text": ["x"]}]}]},
                 "no other keys")
    ok += 3
    blob = {"id": "b", "ground": "......\n.m....\n......", "entrances": {"a": [5, 2]},
            "min_blob": {"mountain": 3, "ocean_inlet": 2}}
    expect_error(blob, "mountain patches smaller than 3")
    assert ok_src({**blob, "ground": "......\n.mmm..\n......"})
    expect_error({**blob, "ground": "oooooo\noooooo\n...o..\n......"}, "ocean narrower than 2")
    assert ok_src({**blob, "ground": "oooooo\noooooo\n..oo..\n......"})
    river = {"id": "rv", "ground": "mmmmmmm\n..rr...\n..==...\n..rr...\nooooooo", "entrances": {"a": [0, 2]},
             "river_check": True}
    assert ok_src(river)
    expect_error({**river, "ground": "mmmmmmm\n..rr...\n..==...\n...rr..\nooooooo"}, "not the bridge span")
    expect_error({**river, "ground": "mmmmmmm\n..rr...\n..==...\n..rr...\n......."}, "never reaches the ocean")
    expect_error({**river, "ground": ".......\n..rr...\n..==...\n..rr...\nooooooo"}, "has no source")
    ok += 3
    walled = {"id": "n", "ground": ".....\n.###.\n.#.#.\n.###.\n.....", "entrances": {"a": [0, 0]},
              "npcs": [{"id": "hermit", "x": 2, "y": 2, "sprite": "villager", "dialog": []}]}
    expect_error(walled, "no reachable cell to be talked to")
    shop = {"id": "sh", "ground": "#####\n##.##\n##c##\n.....", "entrances": {"a": [0, 3]},
            "npcs": [{"id": "keeper", "x": 2, "y": 1, "sprite": "merchant", "dialog": []}]}
    assert ok_src(shop), "talked to across a counter"
    expect_error({**base, "art_coverage": True, "objects": [flowers]}, "invisible walls")
    assert ok_src({**base, "art_coverage": True, "objects": [{**flowers, "parts": [["bush"]]}]})
    choke = {"id": "ch", "ground": "#####\n.....\n##.##\n##.##", "entrances": {"a": [0, 1]},
             "transitions": [{"x": 2, "y": 3, "targetMap": "x", "targetEntrance": "y"}],
             "npcs": [{"id": "guard", "x": 2, "y": 2, "sprite": "guard", "dialog": []}], "no_static_chokepoints": True}
    expect_error(choke, "static NPCs cut off the transition")
    assert ok_src({**choke, "npcs": [{**choke["npcs"][0], "wander": True}]})
    ok += 3
    # no_unreachable_walkable: a walled-in grass cell is an error unless listed, or reached from an allowed entrance
    pocket = {"id": "pk", "ground": "......\n.###..\n.#.#..\n.###..\n......", "entrances": {"a": [0, 0]}}
    assert ok_src(pocket), "the check is opt-in"
    expect_error({**pocket, "no_unreachable_walkable": True}, "1 walkable cells can't be reached from any entrance")
    assert ok_src({**pocket, "no_unreachable_walkable": True, "unreachable_ok": [[2, 2]]}), "a listed cell"
    assert ok_src({**pocket, "no_unreachable_walkable": True, "entrances": {"a": [0, 0], "inner": [2, 2]},
                   "unreachable_ok": ["inner"]}), "a region reached from an unreachable_ok entrance"
    ok += 1
    # contrast (TF-2): wall tops cut from the floor's own texture read as one surface; a darkened copy reads apart
    hall = {"id": "hl", "ground": "WWWWW\nW---W\nW---W\nWWWWW", "entrances": {"a": [2, 1]},
            "materials": {"in_wall_top": "floor_stone"}, "contrast": [{"a": "W", "b": "-", "min": 0.2}]}
    expect_error(hall, "contrast 0: 'W' cells")
    dark = {**hall, "materials": {"in_wall_top": {"from": "floor_stone", "shade": 0.3}}}
    dc = comp(dark)
    sa, sb = MC.contrast_pairs(dark, dc, "W", "-")
    assert len(sa) == 10 and len(sb) == 6 and MC.cell_luma(dc, sa) < MC.cell_luma(dc, sb) - 0.2, \
        "the wall cells next to the floor, against the floor, sampled at their centres"
    expect_error({**dark, "contrast": [{"a": "W", "b": "-"}]}, "want {a: <char>, b: <other char>, min: 0-1}")
    expect_error({**dark, "contrast": [{"a": "W", "b": "%", "min": 0.2}]}, "no bare 'W' cell next to a bare '%'")
    # the real temple: its old material list (one slab texture for wall tops and floor) fails; the source passes
    temple = __import__("yaml").safe_load((B.SRC / "temple-of-fiends.yaml").read_text())
    assert temple.get("contrast"), "the temple opts in to the contrast check"
    B.compile_source(temple)
    old = {**temple, "materials": {"floor_stone": "temple_floor", "rubble": "temple_rubble",
                                   "in_wall_top": "temple_wall_top", "in_wall_face": "temple_wall_face"}}
    try:
        B.compile_source(old)
        raise AssertionError("the temple's old materials must fail the contrast check")
    except B.MapError as e:
        assert "contrast 0" in str(e), e
    ok += 5

    # ── 6. map report and 7. preview, on a compiled map written to a temp dir
    with tempfile.TemporaryDirectory() as tmp:
        src = {**choke, "no_static_chokepoints": False, "npcs": [{**choke["npcs"][0], "wander": True}]}
        cc = comp(src)
        B.write(src, cc, Path(tmp))
        r = MR.report(MR.load("ch", Path(tmp)), {"door": (2, 3)})
        assert [ch["cell"] for ch in r["chokepoints"]] == [(1, 1), (2, 1), (2, 2)], r["chokepoints"]
        assert all(ch["cuts_off"] == ["x"] for ch in r["chokepoints"])
        assert r["distances"][("a", "door")] == 4 and (0, 1) in r["edge_not_exit"]
        assert MC.articulation_points(cc.collision, (0, 1)) == {(1, 1), (2, 1), (3, 1), (2, 2)}
        out = B.preview("ch", 1, 1, 3, 3, Path(tmp) / "p.png", grid=True, collision=True, scale=0.5, out_dir=Path(tmp))
        assert Image.open(out).size == (3 * T // 2, 3 * T // 2)
        ok += 2

    # ── kit `paint` fixes (copy-rect, applied before cutting) and the lake legend
    with tempfile.TemporaryDirectory() as tmp:
        d = Path(tmp) / "pt"
        d.mkdir()
        sheet = Image.new("RGBA", (2 * T, T), (0, 0, 255, 255))
        sheet.paste((255, 0, 0, 255), (0, 0, T, T))
        sheet.save(d / "s.png")
        meta = {"tile": T, "cells": [["a", "b"]], "paint": [{"from": [0, 0, 24, T], "to": [T, 0]},
                                                            {"from": [0, 0, 8, 8], "to": [T + 40, 40], "flip": "h"}]}
        (d / "s.json").write_text(json.dumps(meta))
        b = np.asarray(K.load_kit("pt", Path(tmp)).part("b"))
        assert (b[:, :24, 0] == 255).all() and (b[:24, 24:40, 2] == 255).all() and (b[40:, 40:, 0] == 255).all(), \
            "paint copies a rect of the sheet before the cells are cut"
        (d / "s.json").write_text(json.dumps({**meta, "paint": [{"from": [90, 0, 24, T], "to": [0, 0]}]}))
        try:
            K.load_kit("pt", Path(tmp))
            raise AssertionError("a paint rect outside the sheet must fail")
        except ValueError as e:
            assert "outside" in str(e)
    lake = comp({"id": "lk", "ground": "....\n.≈≈.\n....", "entrances": {"a": [0, 0]}})
    assert lake.collision[1, 1] == B.LAKE and lake.mat[1, 2] == "lake"          # pass W: Lake = 11 (blocked on foot)
    if not __import__("importlib").util.find_spec("terrain"):
        expect_error({**base, "terrain": "organic"}, "needs assets-src/tools/terrain/")
    ok += 2
    ok += __import__("recolor_selftest").run(B)     # W8: the restyled north-bridge debris matches the stubs
    ok += __import__("nw1_selftest").run(B)         # NW-1: spots (passthrough, kinds), the atlas cell size
    ok += __import__("nw2_selftest").run(B)         # NW-2: tundra and snow (legend, TerrainType, walk, landing)
    return ok
