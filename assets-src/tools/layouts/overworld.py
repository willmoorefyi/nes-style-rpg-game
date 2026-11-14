"""The act-1 overworld -> assets-src/maps/overworld.yaml.

  python3 -I assets-src/tools/layouts/overworld.py && python3 -I assets-src/tools/build_map.py overworld

An original layout on the classic idea (docs/FIX_PLAN_PENINSULA.md, T3c and the T3 review fixes). The Cornelia peninsula
hangs south-west from a larger landmass: the mainland, DY rows deeper than the T3c map, has more walkable cells than the
peninsula (OW-15). A sound opens to the western ocean north of it, narrows eastward to a strait (the broken north
bridge) and ends in a fjord head. From there an unbroken range, the spine, runs south-east to the eastern sea and seals
the land route, so the north bridge is the only way out. The east river rises at a tarn in the spine's foothills and
runs south-west to the south bay; the east pocket between the river and the spine holds Erdrick's tomb. The city stream
feeds the moat ponds at the walled city's corners, runs under the town (as the icon draws it) and leaves for the bay.

Shapes come from polygons perturbed by seeded value noise (overworld_noise.py; numpy only, no `random`, no `hash()`),
then tidied (overworld_grid.py) so the compiler's map checks pass. Constants and shape tables: overworld_consts.py;
encounter tables and zones: overworld_zones.py.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import Grid, write_map  # noqa: E402
from overworld_consts import (ARRIVE, BEACHES, BOULDERS, BRIDGE_FOOT, BROKEN_BRIDGE, BX, CX, CY, E_WARP,  # noqa: E402
                              FOOT_ROAD, FOOTBRIDGE, FOREST_ADD, FOREST_CUT, FOREST_ZONES, GATE_MESSAGE, GULF, H, HEADER,
                              JETTY, LAND, MOUNTAIN_BLOBS, N_STUB, N_WARP, NORTH_LAKE, NORTH_SHORE, PIER_TEXT, PONDS,
                              RIVER, ROADS, RX, RY, S_STUB, S_WARP, SEED, SHORE_LAND, SHORE_SEA, SOUND, SOUTH_BAY, SPINE,
                              SPUR, STREAM, TARN, TEMPLE_DOOR, TEMPLE_GRASS, TEMPLE_ROCK, TOMB, TOMB_CHEST, TOMB_END,
                              TOMB_OBJECTS, TOMB_ROCK, TX, TY, UNDER_TOWN, W, W_WARP)
from overworld_grid import (bfs, clear_disc, clear_rect, extend_to_sea, fill_unreachable, near, tidy_blobs,  # noqa: E402
                            tidy_land, walk_grid)
from overworld_noise import blob, fbm, polyline_distance, signed_distance  # noqa: E402
from overworld_zones import FIELDS, ZONE_BACKDROPS, encounter_zones  # noqa: E402


def build() -> tuple[Grid, list[str]]:
    notes: list[str] = []
    land_f = signed_distance(LAND)
    for water in (SOUND, GULF, SOUTH_BAY):
        land_f = np.minimum(land_f, -signed_distance(water))
    land = land_f + 8.0 * fbm(SEED) > 0
    # hard constraints: ocean ring on the map edge, the strait at the bridge, dry ground round the city and temple
    land[:4, :] = land[-4:, :] = False
    land[:, :4] = land[:, -3:] = False
    for x in range(BX - 2, BX + 3):
        land[N_STUB:S_STUB + 1, x] = False
        land[N_STUB - 2:N_STUB, x] = True
        land[S_STUB + 1:S_STUB + 4, x] = True
    land[34:53, 13:41] |= True
    land[34:53, 13:41] &= ~(np.asarray(signed_distance(SOUTH_BAY)) > 0)[34:53, 13:41]
    land[TY - 2:TY + 3, TX - 2:TX + 4] = True
    for x, y in SHORE_LAND:                          # OW-5: no long straight or stepped run of the cell mask
        land[y, x] = True
    for x, y in SHORE_SEA:
        land[y, x] = False
    land = tidy_land(land)

    g = Grid(W, H, "o")
    for y in range(H):
        for x in range(W):
            if land[y, x]:
                g.set(x, y, ".")

    # mountains: the spine (seals the isthmus), the hills behind the temple, a south-west ridge and two mainland ranges
    n1 = fbm(SEED + 20)
    spine = (polyline_distance(SPINE) < 2.7 + 0.8 * n1) | (polyline_distance(SPUR) < 1.3)
    mountain = np.logical_or.reduce([spine] + [blob(cx, cy, rx, ry) + k * n1 > t
                                               for cx, cy, rx, ry, k, t in MOUNTAIN_BLOBS]) & land
    # forests: noise inside loose zones, kept off the roads' surroundings below
    n2 = fbm(SEED + 30)
    zones = np.maximum.reduce([blob(*z) for z in FOREST_ZONES])
    forest = (zones + 0.55 * n2 > 0.12) & land & ~mountain
    for x, y in FOREST_ADD:
        forest[y, x] = land[y, x] and not mountain[y, x]
    for x, y in FOREST_CUT:
        forest[y, x] = False
    for y in range(H):
        for x in range(W):
            if mountain[y, x]:
                g.set(x, y, "m")
            elif forest[y, x]:
                g.set(x, y, "f")
    # keep the city surroundings, the strait headlands and the tomb clearing open grass
    clear_rect(g, CX - 3, CY - 3, CX + 7, CY + 7)
    clear_rect(g, BX - 3, S_STUB + 1, BX + 3, S_STUB + 3)
    clear_rect(g, BX - 3, N_STUB - 3, BX + 3, N_STUB - 1)
    clear_disc(g, TOMB[0] + 1, TOMB[1] + 0.5, 2.6, "fs")
    for x, y in TEMPLE_GRASS:
        g.set(x, y, ".")
    # the temple sits against the hills and the tomb backs onto the range
    for x, y in TEMPLE_ROCK + TOMB_ROCK:
        g.set(x, y, "m")

    # sand beaches: coastal land in some stretches
    n3 = fbm(SEED + 40)
    beach = np.maximum.reduce([blob(*b) for b in BEACHES])
    for y in range(H):
        for x in range(W):
            if g[x, y] in ".f" and beach[y, x] + 0.4 * n3[y, x] > 0 and near(g, x, y, "o", 1 + (n3[y, x] > 0.1)):
                g.set(x, y, "s")

    # water features: the tarn and the east river, the moat ponds and the city stream
    for x, y in TARN + NORTH_LAKE:
        g.set(x, y, "≈")
    g.line(RIVER, "r", 2)
    extend_to_sea(g, RIVER[-1], 2)
    for y in range(RY - 1, RY + 2):                  # straight through the east bridge: exactly the span's columns
        g.set(RX - 1, y, ".", only="r")
        g.set(RX + 2, y, ".", only="r")
        g.set(RX, y, "r")
        g.set(RX + 1, y, "r")
    for x, y in PONDS:
        g.set(x, y, "≈")
    for x, y in UNDER_TOWN:
        g.set(x, y, "r")
    g.line(STREAM, "r", 1)
    extend_to_sea(g, STREAM[-1], 1)

    # roads, bridges and the jetty (no road under the icons; the river stays straight through the east bridge)
    shore = next(y for y in range(CY + 5, H) if g[CX + 2, y + 1] == "o")
    g.set(CX + 2, shore + 1, ".")                    # W9: the road ends on land, so the jetty head has water both sides
    JETTY[:] = [(CX + 2, shore + 2 + i) for i in range(3)]
    before = [row[:] for row in g.g]
    for pts in ROADS + [[S_WARP, ARRIVE["cornelia"], (CX + 2, shore + 1)]]:          # S: to the jetty
        for x, y in g.line(pts, ",", 1):
            if before[y][x] in "r≈om":
                raise SystemExit(f"road crosses {before[y][x]!r} at ({x}, {y})")
    g.set(RX, RY, "=")
    g.set(RX + 1, RY, "=")
    for x in (BX, BX + 1):
        g.set(x, S_STUB, "=")
        g.set(x, N_STUB, "=")
    for x, y in JETTY:
        g.set(x, y, "=")
    g.set(*FOOTBRIDGE, "=")                          # W6: the S gate's footbridge over the stream, to the west
    g.set(*FOOT_ROAD, ",")
    tidy_blobs(g, notes)
    fill_unreachable(g, notes)
    return g, notes

def check(g: Grid) -> list[str]:
    """The layout's own promises (the compiler and the vitest suite check the compiled map again)."""
    errs = []
    ok = walk_grid(g)
    d = bfs(ok, ARRIVE["cornelia"])
    if NORTH_SHORE in d:
        errs.append("north_shore is reachable on foot: the range does not seal the land route")
    mainland = bfs(ok, NORTH_SHORE)
    if len(mainland) <= 1.15 * len(d):
        errs.append(f"the mainland ({len(mainland)} cells) is not clearly larger than the peninsula ({len(d)})")
    rock = ok | np.array([[g[x, y] == "m" for x in range(W)] for y in range(H)])
    if NORTH_SHORE not in bfs(rock, ARRIVE["cornelia"]):
        errs.append("no isthmus: with the mountains open the north shore is still cut off")
    for name, (lo, hi), p in (("temple door", (20, 40), TEMPLE_DOOR), ("bridge foot", (18, 30), BRIDGE_FOOT)):
        if not lo <= d.get(p, 999) <= hi:
            errs.append(f"south gate to the {name}: {d.get(p)} steps, want {lo}-{hi}")
    pocket = bfs(ok, TOMB_END, {(RX, RY), (RX + 1, RY)})
    if ARRIVE["cornelia"] in pocket:
        errs.append("the east pocket can be reached without the east bridge")
    if not 60 <= len(pocket) <= 90:
        errs.append(f"the east pocket has {len(pocket)} walkable cells, want 60-90")
    water = np.array([[g[x, y] in "o=" for x in range(W)] for y in range(H)])
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if g[x, y] == "o" and ((not water[y, x - 1] and not water[y, x + 1]) or (not water[y - 1, x] and not water[y + 1, x])):
                errs.append(f"1-cell ocean inlet at ({x}, {y})")
    print(f"  reachable from cornelia: {len(d)} cells; to the temple door {d.get(TEMPLE_DOOR)}, to the bridge foot "
          f"{d.get(BRIDGE_FOOT)}; east pocket {len(pocket)} cells; the mainland {len(mainland)} cells")
    return errs


# ───────────────────────────── objects and the source map ─────────────────────────────

def objects() -> list[dict]:
    city = [[f"city_{j}_{i}" for i in range(4)] + [None] for j in range(4)]
    objs = [
        {"type": "deco", "parts": city, "x": CX, "y": CY, "offset": [24, 0], "collide": "alpha",
         # the four gates, one doorway cell each (N: the wall's top edge; W and E: the flank arches; S: the main arch)
         "walk_cells": [[x - CX, y - CY] for x, y in (N_WARP, W_WARP, E_WARP, S_WARP)]},
        {"type": "prefab", "prefab": "temple_icon", "name": "temple", "x": TX, "y": TY, "w": 2, "h": 2, "door": 1,
         "ridge_rows": 0, "collide": "alpha", "enter": {"map": "temple-of-fiends", "entrance": "entry"}},
        *(dict(o) for o in TOMB_OBJECTS),          # Erdrick's tomb
        *(dict(o) for o in BROKEN_BRIDGE),         # OW-9: debris in the north bridge's gap (art only)
    ]
    for x, y in BOULDERS:          # a few boulders on open grass, never on a road
        objs.append({"type": "deco", "parts": [["boulder"]], "x": x, "y": y, "collide": "alpha"})
    return objs


def main() -> None:
    g, notes = build()
    for x, y in BOULDERS:
        if g[x, y] != ".":
            raise SystemExit(f"boulder at ({x}, {y}) is on {g[x, y]!r}, not grass")
    # the canoe: on the east river below the bridge (the river cell of that row nearest the bridge, not the stream)
    canoe = (min((x for x in range(W) if g[x, RY + 5] == "r"), key=lambda x: (abs(x - RX), x)), RY + 5)
    doc = {
        "id": "overworld",
        "name": "World Map",
        "camp": True,                     # MS-8: Tent and Cabin work on the world map only (FF1)
        "kits": ["overworld", "town", "temple"],
        "music": "overworld",
        "terrain": "organic",
        "sealed_edges": True,
        "road_check": {"materials": ["dirt"], "ends": [list(TOMB_END)], "check_under": True},
        "warp_leaves": True,
        "min_blob": {"mountain": 3, "sand": 3, "forest": 3, "ocean_inlet": 2},
        "river_check": True,
        "art_coverage": True,
        "no_unreachable_walkable": True,
        "unreachable_ok": ["north_shore"],
        # `cornelia` first: safeSpawn moves old saves that are cut off from it (the act-1 component)
        "entrances": {**{k: list(v) for k, v in ARRIVE.items()}, "castle": list(ARRIVE["cornelia_north"]),
                      "north_shore": list(NORTH_SHORE)},
        "objects": objects(),
        "inspect": [{"x": TOMB[0], "y": TOMB[1], "text": ["Here lies Erdrick."]},
                    {"x": TOMB[0] + 1, "y": TOMB[1], "text": ["Here lies Erdrick."]},
                    {"x": JETTY[-1][0], "y": JETTY[-1][1] + 1, "text": list(PIER_TEXT)}],
        "npcs": [dict(TOMB_CHEST)],
        "keyItemGates": [{"x": x, "y": S_STUB, "requiredFlag": "BRIDGE_BUILT", "message": [dict(m) for m in GATE_MESSAGE],
                          "permanent": False} for x in (BX, BX + 1)],
        "encounterRate": {"min": 10, "max": 22},       # W4: the W / N gate -> temple walk (16 steps) sees a battle
        # T4 §1.6: FF1-style formations; no pirates in act 1 (EB-1). The first zone holding the cell wins.
        "encounters": FIELDS,
        "encounterZones": encounter_zones(g),
        # BA-12: sand compiles to TerrainType.Desert, so the beaches are keyed `desert` (keys are TerrainType names)
        "battleBackgrounds": {"default": "grassland", "terrain": {"forest": "forest", "desert": "shoreline",
                                                                  "swamp": "swamp", "water": "ocean", "river": "river"},
                              "zones": ZONE_BACKDROPS},
        # OW-10 stays open: the ship waits off the jetty, the canoe on the east river
        "vehicles": [{"type": "ship", "x": JETTY[-1][0], "y": JETTY[-1][1] + 1, "requiredFlag": "BIKKE_DEFEATED"},
                     {"type": "canoe", "x": canoe[0], "y": canoe[1], "requiredFlag": "EARTH_CAVE_COMPLETE"}],
        "transitions": [{"x": p[0], "y": p[1], "targetMap": "cornelia", "targetEntrance": e} for p, e in
                        ((N_WARP, "castle"), (W_WARP, "west_gate"), (E_WARP, "east_gate"), (S_WARP, "south_gate"))],
    }
    for v in doc["vehicles"]:
        assert g[v["x"], v["y"]] in "or", f"vehicle {v['type']} at ({v['x']}, {v['y']}) is on {g[v['x'], v['y']]!r}"
    print(write_map("overworld", HEADER, doc, g.text()))
    for n in notes:
        print("  " + n)
    errs = check(g)
    if errs:
        raise SystemExit("overworld layout: " + "; ".join(errs))


if __name__ == "__main__":
    main()
