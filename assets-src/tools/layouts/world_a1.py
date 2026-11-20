"""Region A1 of the world (docs/WORLD_PLAN.md 2.5, 2.9, 4.1): the act-1 overworld, translated by A1_ORIGIN.

`act1()` is the act-1 map document that `overworld.py main()` used to write (moved here by W1-C2, QUEST 3.5), on the
local 72x72 grid of `overworld.build()`, unchanged except that the canoe spawn is gone (QUEST 3.3: the canoe is an
ability). `build()` translates it by A1_ORIGIN into the region's world rect; the A1 cells outside the act-1 block
(the east strip x 136-143 and the south strip y 136-143) start as ocean.

The region part (A1-O, W2; docs/WORLD_PLAN.md 4.1) lives in `layouts/a1/`: `world_a1_ground.py` edits the four
FROZEN_EXCEPTIONS rects and builds Pravoka's range in the east strip (A1's parts of the walls W_west and W_east),
`world_a1_sites.py` places Matoya's cave mouth, Pravoka's icon, gate, quay and brig (read from A1-T's
`town_pravoka_site.py`), the lighthouse, the cairn and the `north_bridge` patch, and `world_a1_zones.py` adds the
mainland and sea zones.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(1, str(Path(__file__).resolve().parent / "a1"))
import overworld  # noqa: E402
from overworld_consts import (ARRIVE, BOULDERS, BX, E_WARP, GATE_MESSAGE, JETTY, N_WARP, NORTH_SHORE,  # noqa: E402
                              PIER_TEXT, S_STUB, S_WARP, TEMPLE_DOOR, TEMPLE_WARP, TOMB, TOMB_CHEST, TOMB_END, W_WARP,
                              BRIDGE_WORKERS)
from overworld_zones import FIELDS, ZONE_BACKDROPS, encounter_zones  # noqa: E402
from world_api import A1_ORIGIN, A1_SIZE, BOXES, UNSET, WATER, Cell, RegionOut  # noqa: E402
from world_geom import bbox, translate  # noqa: E402
import world_a1_ground as A1G  # noqa: E402
import world_a1_sites as A1S  # noqa: E402
from world_a1_zones import zones as a1_zones  # noqa: E402

# act-1 ids that predate the region prefixes (world check 3 exempts them)
LEGACY_IDS = frozenset({"cornelia", "cornelia_west", "cornelia_east", "cornelia_north", "castle", "north_shore",
                        "temple", "east_pocket", "temple_approach", "chest_tomb", "bridge_worker_w",
                        "bridge_worker_e", "north_bridge"})
# NW-1 (docs/NATURAL_WORLD_PLAN.md 5.2): today's cells of the act-1 places quest.yaml, the scenarios and the
# cutscenes name (stage entries, scenario spawns, parked vehicles); NW-3 re-pins them in the new world
SPOTS = {
    "a1_s_cornelia": {"at": [92, 111], "kind": "land"},        # Cornelia's south-gate arrival: S20-S22, S26, S27
    "a1_s_temple": {"at": [79, 103], "kind": "land"},          # the Temple door: S29
    "a1_s_temple_road": {"at": [79, 106], "kind": "land"},     # scenario r_ow_temple
    "a1_s_bridge": {"at": [93, 98], "kind": "land"},           # scenario r_ow_bridge
    "a1_s_bridge_foot": {"at": [93, 97], "kind": "land"},      # below the bridge gate: S2
    "a1_s_north_shore": {"at": [93, 92], "kind": "land"},      # past the bridge: S3
    "a1_s_east": {"at": [112, 110], "kind": "land"},           # scenario r_ow_east
    "a1_s_matoya": {"at": [74, 76], "kind": "land"},           # Matoya's door: S7
    "a1_s_pravoka": {"at": [131, 101], "kind": "land"},        # Pravoka's land gate: S4, S5
    "a1_s_pravoka_ship": {"at": [132, 102], "kind": "dock"},   # the ship at the a1_pravoka dock
    "a1_s_airship": {"at": [93, 111], "kind": "landing"},      # the airship by Cornelia: S20-S22
    "a1_s_airship_se": {"at": [94, 112], "kind": "landing"},   # S26, S27
    "a1_s_temple_airship": {"at": [82, 104], "kind": "landing"},   # by the Temple: S29, S30
}
# the map-level keys of the world source (the composer writes them once, from A1)
MAP_KEYS =("id", "name", "camp", "kits", "music", "terrain", "encounterRate", "encounters")


def act1() -> tuple[object, dict]:
    """The act-1 overworld source document on the local grid (the old `overworld.py main()`), and its grid."""
    g, notes = overworld.build()
    for x, y in BOULDERS:
        if g[x, y] != ".":
            raise SystemExit(f"boulder at ({x}, {y}) is on {g[x, y]!r}, not grass")
    errs = overworld.check(g)
    if errs:
        raise SystemExit("overworld layout: " + "; ".join(errs))
    for n in notes:
        print("  " + n)
    doc = {
        "id": "overworld",
        "name": "World Map",
        "camp": True,                     # MS-8: Tent and Cabin work on the world map only (FF1)
        "kits": ["overworld", "town", "temple"],
        "music": "overworld",
        "terrain": "organic",
        "road_check": {"materials": ["dirt"], "ends": [list(TOMB_END)], "check_under": True},
        "warp_leaves": True,
        "min_blob": {"mountain": 3, "sand": 3, "forest": 3, "ocean_inlet": 2},
        "river_check": True,
        "unreachable_ok": ["north_shore"],
        # `cornelia` first: safeSpawn moves old saves that are cut off from it (the act-1 component)
        "entrances": {**{k: list(v) for k, v in ARRIVE.items()}, "castle": list(ARRIVE["cornelia_north"]),
                      "north_shore": list(NORTH_SHORE), "temple": list(TEMPLE_DOOR)},
        "objects": overworld.objects(),
        "inspect": [{"x": TOMB[0], "y": TOMB[1], "text": ["Here lies Erdrick."]},
                    {"x": TOMB[0] + 1, "y": TOMB[1], "text": ["Here lies Erdrick."]},
                    {"x": JETTY[-1][0], "y": JETTY[-1][1] + 1, "text": list(PIER_TEXT)}],
        "npcs": [dict(TOMB_CHEST), *(dict(n) for n in BRIDGE_WORKERS)],
        # NW-1: the gates are named, so quest.yaml's nonLoadBearing names them (`ref`) instead of their cells
        "keyItemGates": [{"id": f"a1_bridge_gate_{side}", "x": x, "y": S_STUB, "requiredFlag": "BRIDGE_BUILT",
                          "message": [dict(m) for m in GATE_MESSAGE], "permanent": False}
                         for side, x in (("w", BX), ("e", BX + 1))],
        "encounterRate": {"min": 10, "max": 22},       # W4: the W / N gate -> temple walk (16 steps) sees a battle
        # T4 §1.6: FF1-style formations; no pirates in act 1 (EB-1). The first zone holding the cell wins.
        "encounters": FIELDS,
        "encounterZones": encounter_zones(g),
        # BA-12: sand compiles to TerrainType.Desert, so the beaches are keyed `desert` (keys are TerrainType names)
        "battleBackgrounds": {"default": "grassland", "terrain": {"forest": "forest", "desert": "shoreline",
                                                                  "swamp": "swamp", "water": "ocean", "river": "river"},
                              "zones": ZONE_BACKDROPS},
        # OW-10: the ship waits off the jetty (A1-T moves it to Pravoka's quay); the canoe has no spawn (QUEST 3.3)
        "vehicles": [{"type": "ship", "x": JETTY[-1][0], "y": JETTY[-1][1] + 1, "requiredFlag": "BIKKE_DEFEATED"}],
        "transitions": [{"x": p[0], "y": p[1], "targetMap": "cornelia", "targetEntrance": e} for p, e in
                        ((N_WARP, "castle"), (W_WARP, "west_gate"), (E_WARP, "east_gate"), (S_WARP, "south_gate"))]
        + [dict(TEMPLE_WARP)],
    }
    for v in doc["vehicles"]:
        assert g[v["x"], v["y"]] in "or", f"vehicle {v['type']} at ({v['x']}, {v['y']}) is on {g[v['x'], v['y']]!r}"
    return g, doc


def build(band: set[Cell]) -> tuple[RegionOut, dict]:
    """A1's RegionOut (world cells) and the map-level keys. Band cells are left to the composer: act-1 ocean there."""
    g, doc = act1()
    ox, oy = A1_ORIGIN
    b = bbox(BOXES["a1"])
    rows = [[WATER if (x, y) not in band else UNSET for x in range(b.x0, b.x1 + 1)] for y in range(b.y0, b.y1 + 1)]
    for ly in range(A1_SIZE[1]):
        for lx in range(A1_SIZE[0]):
            x, y = lx + ox, ly + oy
            if (x, y) in band:
                if g[lx, ly] != WATER:
                    raise SystemExit(f"world_a1: act-1 cell local ({lx}, {ly}) is {g[lx, ly]!r} in a band")
                continue
            rows[y - b.y0][x - b.x0] = g[lx, ly]
    walls = A1G.apply(A1G.Ground(rows, b.x0, b.y0), band)
    t = translate(doc, A1_ORIGIN)
    entrances = {k: [v[0] + ox, v[1] + oy] for k, v in doc["entrances"].items()}
    ground = {(x, y): rows[y - b.y0][x - b.x0] for y in range(b.y0, b.y1 + 1) for x in range(b.x0, b.x1 + 1)}
    checks = {k: t[k] for k in ("road_check", "warp_leaves", "min_blob", "river_check")}
    checks["unreachable_ok"] = list(doc["unreachable_ok"])
    checks["reach_roots"] = ["cornelia", "north_shore"]
    checks["legacy_ids"] = sorted(LEGACY_IDS)
    out = RegionOut(
        ground=["".join(r) for r in rows], objects=t["objects"] + A1S.objects(), npcs=t["npcs"],
        inspect=t["inspect"] + A1S.inspect(), transitions=t["transitions"] + A1S.transitions(),
        entrances={**entrances, **A1S.entrances()}, keyItemGates=t["keyItemGates"],
        patches=[dict(A1S.NORTH_BRIDGE)], docks=A1S.docks(),
        encounterZones=t["encounterZones"] + a1_zones(ground, band, tuple(entrances["north_shore"])),
        vehicles=[A1S.ship()], battleBackgrounds={"zones": t["battleBackgrounds"]["zones"]}, checks=checks,
        walls=walls, spots={k: dict(v) for k, v in SPOTS.items()})
    keys = {k: t[k] for k in MAP_KEYS}
    keys["battleBackgrounds"] = {k: v for k, v in t["battleBackgrounds"].items() if k != "zones"}
    keys["world"] = {"frames": {"a1": {"origin": list(A1_ORIGIN), "size": list(A1_SIZE)}}}
    return out, keys
