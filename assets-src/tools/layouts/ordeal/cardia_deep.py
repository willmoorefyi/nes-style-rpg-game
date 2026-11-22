"""Cardia Deep, the dragon great village under the Cardia isles (pass CD, docs/CARDIA_PLAN.md 5; brief
docs/DRAGON_CITY_BRIEF.md; stage S19, optional; ORD-O) -> assets-src/maps/cardia-deep.yaml.

  python3 -I assets-src/tools/layouts/ordeal/cardia_deep.py && python3 -I assets-src/tools/build_map.py cardia-deep

One map, no floors: five island stairs (Bahamut's isle, the north, east, stack and west islets; the hermit's islet has
none, ruling R1), each down through a short wild warren (zone `ord_deep_warrens`, the old cave's fights and rate) and a
ward arch into the village (no encounters): the Wyrmhall at the crossroads, the Processional up to Bahamut's Court, the
Roost, the Sanctum, the Hatchery, the Ember Market, the Sea Gate hall, the Tide Grotto and the Hoard Vaults. Every
stair leads back up to its own islet. It replaced `bahamut-cave` and `bahamut-lair` (retired: src/systems/retiredMaps.ts).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import Room  # noqa: E402
from cardia_people import people  # noqa: E402

W, H = 72, 60
NOTE = ("Concept: one dragon-kin city carved in the basalt under the whole Cardia archipelago, every islet's cave a "
        "stair down into it, every road meeting in the Wyrmhall below Bahamut's Court.\n"
        "Distinct: five island stairs that all end under one roof, each through a short wild warren of roosting "
        "wyverns and a wing-shaped ward arch; a hatchery of ember nests beside a steaming spring channel; a sea grotto "
        "pool under the west islet; a court where the eldest receives the party before a throne carved as a seated "
        "dragon.\n"
        "Topology: one map, no floors: overworld (ord_bahamut, ord_isle_north, ord_isle_east, ord_isle_stack, "
        "ord_isle_west) -> five warrens -> Wyrmhall -> Court | Roost | Sanctum | Hatchery | Market | Gate hall | "
        "Grotto -> Hoard; every stair leads back to its own islet; no boss.\n"
        "The north and west warrens join their districts from the side (east-west), where no wall face takes the "
        "4x3 wing arch: two drg_statue gate-posts flank those mouths instead (plan 5.4).")
KITS = ["castle", "interior", "temple", "town"]
MATS = {"in_wall_face": {"from": "drg_wall"}, "floor_stone": {"from": "drg_floor", "shade": 0.9},
        "in_wall_top": {"from": "slate", "shade": 0.3}, "grass": {"from": "slate", "shade": 0.45},
        "rubble": {"from": "ar_temple_rubble_cool", "shade": 1.2, "hue": 12, "sat": 0.8},
        "water": {"from": "water_calm"}}
TRIM = [200, 160, 70]                          # the dais cloth's gold trim (the old lair's)
LEGEND = ("legend: W wall top  F wall face  - village floor  % warren floor (rubble)  + the dais's crimson cloth  "
          "~ sea water  = bridge")
CAVE_FIGHTS = [{"groups": [{"id": "wyrm", "min": 1}], "weight": 2},           # the old bahamut-cave's, verbatim
               {"groups": [{"id": "basilisk", "min": 1, "max": 2}], "weight": 3},
               {"groups": [{"id": "wyvern", "min": 1, "max": 2}], "weight": 2}]
WARREN_CELLS = (150, 204)                      # D-CD5: 177 (the old cave's walkable cells) +- 15 %
# the map's rate is the warrens' too: EncounterSystem counts down on the map's rate until the first fight (a zone's rate
# only resets the counter after a battle in it), and a step where no table applies does not count, so the village
# (no map table) stays quiet while the first warren fight comes at 24-36 steps, as in the old cave (plan 5.3 said 999)
WARREN_RATE = {"min": 24, "max": 36}

D = {"court": (42, 6, 67, 17), "roost": (12, 6, 34, 15), "hall": (14, 23, 46, 34), "sanctum": (2, 21, 10, 32),
     "hatchery": (52, 24, 66, 37), "market": (20, 39, 38, 48), "gatehall": (42, 39, 50, 47),
     "grotto": (2, 37, 16, 46), "hoard": (2, 51, 10, 57)}
LINKS = [(44, 18, 46, 22),        # the Processional: Wyrmhall <-> Court
         (22, 16, 23, 22),        # Roost <-> Wyrmhall
         (11, 27, 13, 28),        # Sanctum <-> Wyrmhall
         (47, 28, 51, 29),        # Wyrmhall <-> Hatchery
         (29, 35, 30, 38),        # Wyrmhall <-> Market
         (39, 43, 41, 44),        # Market <-> Gate hall
         (44, 35, 45, 38),        # Wyrmhall <-> Gate hall
         (14, 35, 15, 36),        # Wyrmhall <-> Grotto
         (5, 47, 6, 50)]          # Grotto <-> Hoard
# entrance: (chamber, tunnel polyline, the overworld entrance its stair climbs to). bahamut_gate FIRST: its stair's
# transitions come first, so NW2's wayOutSearch (worldRevalidate.ts) leaves a v4 save by Bahamut's isle (plan 5.2)
WARRENS = {"bahamut_gate": ((50, 52, 55, 55), [(48, 53), (46, 53), (46, 48)], "ord_bahamut"),
           "north": ((2, 6, 7, 8), [(4, 9), (4, 13), (10, 13)], "ord_isle_north"),
           "east": ((62, 42, 67, 44), [(60, 43), (56, 43), (56, 38)], "ord_isle_east"),
           "stack": ((27, 53, 32, 56), [(33, 54), (36, 54), (36, 49)], "ord_isle_stack"),
           "west": ((14, 52, 19, 55), [(12, 53), (11, 53)], "ord_isle_west")}
ARCHES = ((56, 38), (36, 49), (46, 48))         # the north-south mouths (east, stack, Sea Gate): the opening's west x, y
POSTS = (((12, 11), (12, 14)), ((10, 51), (10, 54)))   # the east-west mouths (north, west): statue gate-posts
COURT = [54, 11]                                # before the dais: the retired-save relocation target, the debug start

r = Room("cardia-deep", "Cardia Deep", W, H)
g = r.g
for x0, y0, x1, y1 in [*D.values(), *LINKS]:
    g.carve(x0, y0, x1, y1)
zone_rects, warren = [], set()
for (x0, y0, x1, y1), line, _ow in WARRENS.values():
    g.carve(x0, y0, x1, y1, "%")
    cells = g.line(line, "%", 2)
    warren |= {(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)} | set(cells)
    xs = [x for x, _ in cells] + [x0, x1]
    ys = [y for _, y in cells] + [y0, y1]
    zone_rects.append([min(xs), min(ys), max(xs), max(ys)])
g.carve(50, 6, 59, 9, "+")                       # the dais's crimson cloth
g.rect(6, 40, 12, 43, "~")                       # the Tide Grotto's pool (sea water under the isle)
g.rect(58, 24, 59, 37, "~")                      # the Hatchery's warm spring channel (one liquid per map: D-CD8)
g.rect(58, 30, 59, 31, "=")                      # its bridge
g.faces(2)
for (x0, y0, _x1, _y1), _line, ow in WARRENS.values():
    r.stairs_up(x0 + 2, y0 - 2, "overworld", ow)
ents = {name: [x0 + 2, y0] for name, ((x0, y0, _x1, _y1), _l, _o) in WARRENS.items()}
ents["court"] = COURT


def P(n: str, w: int, h: int) -> list[list[str]]:
    return [[f"{n}_{rr}_{c}" for c in range(w)] for rr in range(h)]


# ── set pieces (the approved `dragon` theme sheet, gen/approved/town/theme_dragon) ──
r.deco(P("drg_throne", 3, 3), 53, 4, on_wall=True, collide="alpha")
for x in (47, 62):
    r.deco(P("drg_statue_big", 2, 2), x, 7, collide="alpha")
for x, y in ((44, 12), (49, 12), (60, 12), (65, 12), (18, 25), (26, 25), (34, 25), (42, 25), (18, 31), (26, 31),
             (34, 31), (42, 31)):
    r.deco(P("drg_pillar", 1, 2), x, y, fit=True)
for x in (28, 32):
    r.deco(P("drg_statue", 1, 2), x, 24, collide="alpha")
for x, y in ((53, 26), (62, 26), (53, 33), (62, 33)):
    r.deco(P("drg_nest", 2, 2), x, y, collide="alpha")
for x in (14, 19, 24, 29):
    r.deco(P("drg_perch", 1, 2), x, 8, collide="alpha")
for x, y in ((3, 53), (7, 56)):
    r.deco(P("drg_hoard", 2, 1), x, y, collide="alpha")
r.deco([["gold_heap"]], 8, 52)
for ox, oy in ARCHES:                            # the ward arches: jambs on the wall, the opening over the warren floor
    for i in range(4):
        parts = [[f"drg_arch_{j}_{i}"] for j in range(3)]
        if i in (1, 2):
            r.deco(parts, ox - 1 + i, oy, above_rows=3, passage=True)
        else:
            r.deco(parts, ox - 1 + i, oy, on_wall=True)
for (nx, ny), (sx, sy) in POSTS:                 # the side mouths' gate-posts: one north of the mouth, one south of it
    r.deco(P("drg_statue", 1, 2), nx, ny, collide="alpha")
    r.deco(P("drg_statue", 1, 2), sx, sy, above_rows=1)
r.npcs += [{"id": "chest_grotto", "sprite": "chest", "x": 15, "y": 45, "chestItem": "diamond_armlet",
            "chestFlag": "CHEST_ORD_O_GROTTO", "dialog": ["You found a Diamond Armlet!"]}]
r.npcs += people()

# ── source checks (plan 5.2, K7, D-CD5) ──
assert r.transitions[0]["targetEntrance"] == "ord_bahamut" and r.transitions[1]["targetEntrance"] == "ord_bahamut"
assert "." not in g.text(), "cardia-deep: a '.' cell would take the remapped grass material (K7)"
n_warren = sum(1 for x, y in warren if g[x, y] == "%")
assert WARREN_CELLS[0] <= n_warren <= WARREN_CELLS[1], f"cardia-deep: {n_warren} warren cells, want {WARREN_CELLS}"
r.write("Cardia Deep: the dragon great village under the Cardia isles (pass CD).\n" + NOTE, ents, kits=KITS,
        mats=MATS, trim=TRIM, quiet={"encounterRate": WARREN_RATE, "encounters": []},
        script="ordeal/cardia_deep.py", legend=LEGEND, music="town",
        extra={"exit": {"map": "overworld", "entrance": "ord_bahamut"}, "battleBackgrounds": {"default": "cave"},
               "encounterZones": [{"id": "ord_deep_warrens", "name": "Cardia Warrens", "rects": zone_rects,
                                   "encounterRate": WARREN_RATE, "encounters": CAVE_FIGHTS}],
               "contrast": [{"a": "W", "b": "-", "min": 0.2}, {"a": "W", "b": "%", "min": 0.2}],
               "no_static_chokepoints": True, "no_unreachable_walkable": True})
print(f"cardia-deep written ({n_warren} warren cells; zone rects {zone_rects})")
