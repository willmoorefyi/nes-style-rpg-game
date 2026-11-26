"""AR-W2: the approved town themes on the town exteriors (docs/TOWN_THEMES.md, user rulings 2026-11-21).

Each town script calls `apply(doc, town, grid)` once before it writes its source. The theme's art is the sheet
assets-src/gen/approved/town/theme_<town>.{png,json} (gen/town_theme_cut.py): every house takes roof=<theme> and a
wall style picked from its old wall colour (the theme or one of its tints), the inn its themed prefab (same 4x5
footprint, door column and sign row), named houses whole-house prefabs of the same footprint, and the set pieces are
decos. Doors, names, signs, `enter` transitions and every NPC stay as the town script made them. Exteriors only:
the shop and house interiors keep their art. Crescent's terrace rock bands become canals and their stairs bridges.
"""
from __future__ import annotations

ALPHA, WATER = {"collide": "alpha"}, {"on_water": True}
HOUSE_KEYS = ("roof", "wall", "storeys", "windows", "chimney")
# the old wall colours -> the theme's wall (base, tint 1, tint 2)
WALL_SLOT = {"plaster": 0, "white": 0, "ochre": 1, "rose": 2, "stone": 2}


def cells(name: str, w: int, h: int) -> list[list[str]]:
    return [[f"{name}_{r}_{c}" for c in range(w)] for r in range(h)]


# town: theme, its walls (base first), the house -> prefab swaps {name: (prefab, w, h, door)}, the decos
# (cells name, w, h, x, y, extra keys)
TOWNS: dict[str, dict] = {
    "cornelia": dict(theme="cor_timber", walls=["cor_timber", "cor_timber_ochre", "cor_timber_rose"],
                     drop=[("deco", 23, 46), ("flowers", 24, 49)],   # the market hall stands in for a stall
                     decos=[("cor_hall", 4, 4, 22, 46, ALPHA), ("cor_well", 2, 2, 17, 53, ALPHA),
                            ("cor_haycart", 2, 2, 42, 63, ALPHA), ("cor_board", 2, 1, 27, 61, ALPHA)]),
    "pravoka": dict(theme="pra_tar", walls=["pra_tar", "pra_tar_drift", "pra_tar_red"],
                    decos=[("pra_stall", 2, 2, 23, 31, ALPHA), ("pra_cargo", 2, 1, 17, 18, ALPHA),
                           ("pra_stall", 2, 2, 21, 4, ALPHA)],
                    swaps={"pirates_den": ("pra_tavern", 5, 4, 3), "house_harbormaster": ("pra_house_a5", 5, 5, 2),
                           "house_cooper": ("pra_house_a4", 5, 4, 2)}),
    "elfheim": dict(theme="elf_moon", walls=["elf_moon", "elf_moon_jade", "elf_moon_lilac"],
                    decos=[("elf_tree", 3, 4, 37, 28, ALPHA), ("elf_moongate", 2, 2, 39, 34, ALPHA),
                           ("elf_pool", 2, 1, 31, 40, ALPHA), ("elf_lamp", 1, 2, 16, 24, ALPHA),
                           ("elf_lamp", 1, 2, 24, 35, ALPHA)]),
    "melmond": dict(theme="mel_siege", walls=["mel_siege", "mel_siege_ash", "mel_siege_rot"],   # static (ruling 3)
                    decos=[("mel_barricade", 3, 2, 26, 26, ALPHA), ("mel_cross", 1, 1, 37, 31, ALPHA),
                           ("mel_stone", 1, 1, 34, 31, ALPHA), ("mel_stone", 1, 1, 31, 31, ALPHA),
                           ("mel_brazier", 1, 1, 16, 31, ALPHA), ("mel_brazier", 1, 1, 27, 11, ALPHA)]),
    "crescent": dict(theme="cre_venice", walls=["cre_venice", "cre_venice_ochre", "cre_venice_sienna"],
                     decos=[("cre_wellhead", 1, 2, 11, 33, ALPHA), ("cre_gondola", 2, 2, 8, 10, WATER),
                            ("cre_gondola2", 1, 2, 35, 24, WATER), ("cre_gondola", 2, 2, 16, 24, WATER)],
                     materials={"bridge_v": "cre_bridge_v"}),
    "lufenia": dict(theme="luf_roman", walls=["luf_roman", "luf_roman_azure", "luf_roman"],   # AR-W3
                    swaps={"house_stargazer": ("luf_villa_m4", 5, 4, 2), "house_healer": ("luf_villa_t4", 5, 4, 2),
                           "white_magic": ("luf_villa_t4", 5, 4, 2), "black_magic": ("luf_villa_m4", 5, 4, 2)},
                    decos=[("luf_cupola", 2, 1, 17, 4, ALPHA),         # the dome cap behind the elder hall's ridge
                           ("luf_forum", 2, 3, 11, 19, ALPHA), ("luf_pylon", 1, 2, 12, 10, ALPHA),
                           ("luf_pylon", 1, 2, 24, 18, ALPHA), ("luf_legionary", 1, 2, 4, 25, ALPHA),
                           ("luf_legionary", 1, 2, 21, 11, ALPHA), ("luf_aqueduct", 3, 2, 28, 5, ALPHA)]),
    "onrac": dict(theme="onr_coral", walls=["onr_coral", "onr_coral_pink", "onr_coral_sea"],
                  decos=[("onr_netrack", 1, 2, 22, 11, ALPHA), ("onr_shells", 1, 1, 11, 25, ALPHA),
                         ("onr_lantern", 1, 2, 36, 19, ALPHA), ("onr_lantern", 1, 2, 16, 21, ALPHA)]),
    "gaia": dict(theme="gai_turf", walls=["gai_turf", "gai_turf_sand", "gai_turf_slate"],
                 decos=[("gai_kite", 2, 3, 7, 25, ALPHA), ("gai_flagpole", 1, 3, 17, 36, ALPHA),
                        ("gai_shrine", 1, 2, 14, 6, ALPHA)]),
}


def canals(grid) -> None:
    """Crescent: the two rock bands between the terraces (rows 10-11, 24-25, x 2..44) become canals, and the stairs
    through them bridges; the east road (rows 10-11, x 44-45) stays a road."""
    for y in (10, 11, 24, 25):
        for x in range(2, 45):
            ch = grid[x, y]
            if ch == "m":
                grid.set(x, y, "~")
            elif ch == ":" and not (y < 20 and x >= 44):
                grid.set(x, y, "=")


def apply(doc: dict, town: str, grid=None) -> dict:
    t = TOWNS[town]
    theme, walls = t["theme"], t["walls"]
    for o in doc["objects"]:
        if o["type"] == "house":
            swap = (t.get("swaps") or {}).get(o.get("name"))
            if swap:
                prefab, w, h, door = swap
                assert (o["w"], o["h"]) == (w, h), f"{town}: {o.get('name')} is not {w}x{h}"
                for k in HOUSE_KEYS:
                    o.pop(k, None)
                o.update({"type": "prefab", "prefab": prefab, "ridge_rows": 1})
                if door is None:
                    o.pop("door", None)
                else:
                    o["door"] = door                 # PT-3: the prefab's drawn door column (the den's is 3)
                continue
            o["roof"] = t.get("roof", theme)
            o["wall"] = walls[WALL_SLOT.get(o.get("wall"), 0)]
        elif o["type"] == "prefab" and o.get("prefab") == "inn":
            o["prefab"] = f"inn_{theme}"
    drop = set(t.get("drop", []))
    doc["objects"] = [o for o in doc["objects"] if (o["type"], o.get("x"), o.get("y")) not in drop]
    for name, w, h, x, y, extra in t["decos"]:
        doc["objects"].append({"type": "deco", "parts": cells(name, w, h), "x": x, "y": y, **extra})
    if t.get("materials"):
        doc["materials"] = {**doc.get("materials", {}), **t["materials"]}
    if town == "crescent" and grid is not None:
        canals(grid)
    return doc
