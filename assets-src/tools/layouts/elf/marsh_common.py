"""Shared parts of the Marsh Cave floors (docs/WORLD_PLAN.md 4.2, stage S5; ELF-D): materials, the encounter tables,
the peat hazards and the floor writer. The floors are `marsh_b1.py`, `marsh_b2.py` and `marsh_b3.py`.

  python3 -I assets-src/tools/layouts/elf/marsh_b1.py   (and _b2, _b3)
  python3 -I assets-src/tools/build_map.py marsh-cave-b1 marsh-cave-b2 marsh-cave-b3

The cave is the brown `cave` remap of the temple stone. Black water (`≈`) fills the bog between the banks; the
boardwalks are plank floor (`_`); peat (`w`, swamp) is walkable but each step costs every living member 1 HP (the
map's `hazards`, rects made from the `w` cells); the fog-dark rooms are the `cave` remap at shade 0.7 (the `+`
material). Chests use `CHEST_ELF_D_*`; the guard's fight sets MARSH_GUARD_DEFEATED and `elf_d_crown` gives the crown.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parents[2]))
from common import Room as BaseRoom  # noqa: E402
from kit import remap  # noqa: E402

KITS = ["temple", "castle", "interior", "town"]
CAVE = remap("cave")
MATS = {"floor_stone": {"from": "ar_cave"}, "carpet": {"from": "ar_cave", "shade": 0.7},     # AR-T2: the AR cave floor
        "rubble": {**remap("cave", "ar_temple_rubble_cool"), "shade": 1.2},
        "in_wall_top": {"from": "temple_wall_top", "shade": 0.35},
        "in_wall_face": {**remap("cave", "temple_wall_face"), "shade": 1.1},
        "floor": {"from": "floor", "shade": 0.75},
        "water": {"from": "water", "hue": -20, "sat": 0.45, "shade": 0.4},        # the black bog water (`≈`)
        "swamp": {"from": "swamp", "hue": -65, "sat": 0.85, "shade": 0.72}}       # brown peat
LEGEND = ("legend: W rock  F rock face  - mud bank / barrow stone  _ boardwalk  = plank bridge  ≈ black water  "
          "w peat (hazard 1)  + fog-dark floor  % rubble")
EXIT = {"map": "overworld", "entrance": "elf_marsh"}
DONE = "MARSH_GUARD_DEFEATED"
RATE = {"min": 14, "max": 26}
BACKDROP = {"default": "swamp_cave"}


def group(*ids_counts) -> list[dict]:
    return [{"id": i, "min": lo, "max": hi} for i, lo, hi in ids_counts]


# the S5 roster (WORLD 3.2): the bog's oozes and stingers above, the dead below
TABLES = {
    "b1": [{"groups": group(("green_slime", 2, 4)), "weight": 3},
           {"groups": group(("gray_ooze", 1, 2)), "weight": 2},
           {"groups": group(("crawler", 1, 2)), "weight": 2},
           {"groups": group(("scorpion", 1, 2), ("zombie", 0, 2)), "weight": 2},
           {"groups": group(("zombie", 3, 5)), "weight": 2}],
    "b2": [{"groups": group(("ghoul", 1, 3)), "weight": 3},
           {"groups": group(("scorpion", 1, 3)), "weight": 2},
           {"groups": group(("shadow", 2, 3)), "weight": 2},
           {"groups": group(("crawler", 1, 1), ("gray_ooze", 1, 1)), "weight": 2},
           {"groups": group(("zombie", 2, 3), ("ghoul", 1, 1)), "weight": 2}],
    "b3": [{"groups": group(("ghast", 1, 3)), "weight": 3},
           {"groups": group(("bloodbones", 1, 2)), "weight": 2},
           {"groups": group(("shadow", 2, 4)), "weight": 2},
           {"groups": group(("ghoul", 2, 3), ("ghast", 0, 1)), "weight": 2},
           {"groups": group(("bloodbones", 1, 1), ("zombie", 2, 3)), "weight": 1}],
}


def chest(cid: str, item: str, label: str, x: int, y: int) -> dict:
    return {"id": f"chest_elf_d_{cid}", "sprite": "chest", "x": x, "y": y, "chestItem": item,
            "chestFlag": f"CHEST_ELF_D_{cid.upper()}", "dialog": [f"You found {label}!"]}


def talk(before: list[str], after: list[str]) -> list[dict]:
    """An NPC's lines: `after` once the marsh's guard has fallen."""
    return [{"condition": DONE, "text": after}, {"text": before}]


def peat_rects(rows: list[list[str]]) -> list[list[int]]:
    """The `w` cells as inclusive [x0, y0, x1, y1] rects: each row's runs, merged downward while they line up."""
    runs: list[list[int]] = []
    for y, row in enumerate(rows):
        x = 0
        while x < len(row):
            if row[x] != "w":
                x += 1
                continue
            x0 = x
            while x < len(row) and row[x] == "w":
                x += 1
            for r in runs:
                if r[0] == x0 and r[2] == x - 1 and r[3] == y - 1:
                    r[3] = y
                    break
            else:
                runs.append([x0, y, x - 1, y])
    return sorted(runs, key=lambda r: (r[1], r[0]))


class Floor(BaseRoom):
    """One Marsh Cave floor: the shared materials, its encounter table, the peat hazards from its grid, the exit."""

    def __init__(self, map_id: str, name: str, w: int, h: int):
        super().__init__(map_id, name, w, h)
        self.g.rect(0, 0, w - 1, h - 1, "W")

    def write(self, table: str, header: str, entrances: dict, extra: dict | None = None, roots: list | None = None):
        """`roots`: more entrances the reachability checks start from (B2's halves are joined only through B1). The
        compiler's `no_static_chokepoints` walks from the first entrance only, so a floor with roots leaves it to
        `tests/quest/elf/elf_d_marsh.test.ts`, which checks the chests from every arrival."""
        doc = dict(extra or {})
        rects = peat_rects(self.g.g)
        if rects:
            doc["hazards"] = [{"id": f"elf_d_peat_{table}", "rects": rects, "damage": 1}]
        quiet = {"encounterRate": RATE, "encounters": TABLES[table], "battleBackgrounds": BACKDROP,
                 **({} if roots else {"no_static_chokepoints": True}),
                 "no_unreachable_walkable": {"reach_roots": roots} if roots else True}
        return super().write(header, entrances, kits=KITS, mats=MATS, trim=None, quiet=quiet,
                             script=f"elf/marsh_{table}.py", legend=LEGEND, music="dungeon",
                             extra={"exit": EXIT, **doc})
