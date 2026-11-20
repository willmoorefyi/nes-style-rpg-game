"""Region FIRE's world-map tables, shared by today's world (`world_fire_data.py`, pass W) and the NW world
(`world_fire_nw.py`, pass NW): the encounter tables and zones with their bestiary names and battle backdrops, the
buried hull's hatch and the volcano's smoke offset. No cells live here, so both worlds keep the same zone ids and
rosters (docs/NATURAL_WORLD_PLAN.md 3.3, 3.6.4). Every line of dialogue here is original.
"""
from __future__ import annotations


def _g(enemy: str, lo: int, hi: int | None = None) -> dict:
    return {"id": enemy, "min": lo, "max": lo if hi is None else hi}


def _t(*rows: tuple[int, list[dict]]) -> list[dict]:
    return [{"groups": groups, "weight": w} for w, groups in rows]


# WORLD 3.2: S14 land and river, S15's ash, S16's frost, S17's dunes; the Aldi and the outer seas (4.4)
LAKESHORE = _t((4, [_g("ankheg", 1, 3)]), (3, [_g("ochu", 1, 2)]), (2, [_g("hydra", 1, 2)]),
               (2, [_g("ankheg", 1, 2), _g("ochu", 1)]), (1, [_g("neochu", 1)]))
ASHLANDS = _t((4, [_g("fire_lizard", 1, 2)]), (3, [_g("hellhound", 2, 4)]), (3, [_g("lava_worm", 1, 2)]),
              (2, [_g("hellhound", 1, 2), _g("fire_lizard", 1)]))
TUNDRA = _t((4, [_g("winter_wolf", 3, 5)]), (2, [_g("ice_gigas", 1)]), (2, [_g("winter_wolf", 2, 3), _g("ice_gigas", 1)]))
DESERT = _t((3, [_g("desert_baretta", 1, 2)]), (3, [_g("sand_worm", 1, 2)]), (2, [_g("sabertooth", 1, 3)]),
            (2, [_g("manticore", 1, 3)]), (2, [_g("basilisk", 1, 2)]), (2, [_g("baretta", 1, 2)]),
            (1, [_g("wyvern", 1, 2), _g("wyrm", 1)]), (1, [_g("allosaurus", 1)]))
RIVERS = _t((4, [_g("red_piranha", 2, 4)]), (3, [_g("crocodile", 1, 2)]), (1, [_g("white_crocodile", 1)]))
ALDI = _t((4, [_g("sahagin", 3, 5)]), (3, [_g("shark", 1, 2)]), (2, [_g("buccaneer", 2, 4)]), (1, [_g("bigeyes", 2, 4)]))
SEA = _t((4, [_g("sahagin_chief", 2, 4)]), (3, [_g("shark", 1, 3)]), (2, [_g("bigeyes", 3, 5)]))

# zone id -> (bestiary name, modes, table, battle backdrop of the zone)
ZONES = {
    "fir_lakeshore": ("Crescent Shore", ["walking"], LAKESHORE, None),
    "fir_ashlands": ("Ashlands", ["walking"], ASHLANDS, {"default": "desert"}),
    "fir_tundra": ("Frost Hollow", ["walking"], TUNDRA, {"terrain": {"forest": "forest"}}),
    "fir_desert": ("Hull Desert", ["walking"], DESERT, {"default": "desert"}),
    "fir_rivers": ("Crescent Waters", ["canoe"], RIVERS, {"default": "river"}),
    "fir_aldi": ("Aldi Sea", ["ship"], ALDI, {"default": "ocean"}),
    "fir_sea": ("Southern Seas", ["ship"], SEA, {"default": "ocean"}),
}


def zones(cells: dict, row_rects) -> list[dict]:
    """The zone records of the zones that hold cells, in ZONES order (`cells`: zone id -> its cells)."""
    out = []
    for zid, (name, modes, table, _bg) in ZONES.items():
        if cells.get(zid):
            out.append({"id": zid, "name": name, "modes": modes, "rects": row_rects(cells[zid]), "encounters": table})
    return out


def backdrops() -> dict:
    return {z: bg for z, (_n, _m, _t, bg) in ZONES.items() if bg}


# LM-INT: the approved volcano icon has no smoke; the engine loops it from the crater, art px (26, 12) of the icon's
# top middle cell
SMOKE_AT = (1, 0, 26, 12)                # (dx, dy) from the icon's top-left, then the art px (ox, oy)


def hull_npc(x: int, y: int) -> dict:
    """The buried hull's hatch (S17): it takes the levistone and plays fir_airship_rises."""
    return {
        "id": "fir_hull_hatch", "sprite": "chest", "tint": "#9a7a52", "x": x, "y": y,
        "requiredItem": "levistone", "hideIf": "AIRSHIP_RAISED",
        "cutscene": {"id": "fir_airship_rises", "onceFlag": "AIRSHIP_RAISED"},
        "dialog": [
            {"condition": "item:levistone",
             "text": ["The levistone hums against the hatch. Sand begins to trickle upward around the buried keel..."]},
            {"text": ["A brass hatch juts from the dune. Scratched beside the latch: \"She sleeps till the floatstone "
                      "wakes her.\"",
                      "There is a socket beside it, shaped for a stone that weighs less than nothing."]},
        ],
    }
