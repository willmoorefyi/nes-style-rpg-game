"""The Mirage Tower's shared parts (docs/WORLD_PLAN.md 4.7, stage S27; WND-D1): the materials, the design note, the
per-floor encounter tables, the chest helper and the floor writer. `mirage_floors.py` draws the three floors.

The tower is built of bleached sandstone shot through with bronze: the floors are pale stone, the paths and the
bridge are bronze inlay (`+`), the shaft is open void (`x`) on 2F, and its foot on 1F is a well of fallen masonry (`%`).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import Room as BaseRoom  # noqa: E402

KITS = ["castle", "interior", "temple"]
MATS = {"floor_stone": {"from": "ar_temple_floor_cool", "hue": -170, "sat": 0.9, "shade": 1.6},
        "in_wall_face": {"from": "temple_wall_face", "hue": -170, "sat": 0.9, "shade": 1.45},
        "in_wall_top": {"from": "slate", "hue": -170, "sat": 1.0, "shade": 0.8},
        "carpet": {"from": "ar_marble", "hue": -20, "sat": 3.5, "shade": 0.65},
        "rubble": {"from": "ar_temple_rubble_cool", "hue": -170, "sat": 0.9, "shade": 1.3}}
TRIM = [176, 132, 64]                          # the bronze inlay's rim
LEGEND = "legend: W wall top  F wall face  - sandstone  + bronze inlay / bridge  % fallen masonry  x the open shaft"
NOTE = ("Concept: a tower that was raised in one night by people who left the ground for good; each floor is a stage of "
        "a machine for going up, and the last stage still waits for the key they took with them.\n"
        "Distinct: a spiral gallery wound twice round the shaft's foot, each turn walled off just short of where it was "
        "entered; a sealed well of fallen masonry at the shaft's foot, reached only from above (its own stair down from "
        "2F, or the fall) and left by its own stair back up; two half-floors either side of the open shaft, joined only "
        "by one bronze bridge, with a cracked span off it that drops the walker into that well; the console's dais of "
        "bronze inlay between two globes, with a reading stand.\n"
        "Topology: 1F (the chime door, then the spiral) -> 2F (one stair; a second stair from the well; the bridge; a "
        "one-way fall down the shaft 2F -> 1F) -> 3F the console, which lifts the party to the sky castle.")
ENCOUNTERS = {
    "1f": [{"groups": [{"id": "stone_golem", "min": 1, "max": 2}], "weight": 3},
           {"groups": [{"id": "guardian", "min": 1, "max": 2}], "weight": 3},
           {"groups": [{"id": "chimera", "min": 1, "max": 2}], "weight": 2},
           {"groups": [{"id": "stone_golem", "min": 1}, {"id": "chimera", "min": 1}], "weight": 1}],
    "2f": [{"groups": [{"id": "black_knight", "min": 1, "max": 3}], "weight": 3},
           {"groups": [{"id": "green_dragon", "min": 1}], "weight": 2},
           {"groups": [{"id": "guardian", "min": 1, "max": 2}, {"id": "black_knight", "min": 0, "max": 1}], "weight": 2},
           {"groups": [{"id": "chimera", "min": 1, "max": 2}], "weight": 2}],
    "3f": [{"groups": [{"id": "blue_dragon", "min": 1}], "weight": 2},
           {"groups": [{"id": "black_knight", "min": 2, "max": 3}], "weight": 3},
           {"groups": [{"id": "green_dragon", "min": 1}, {"id": "black_knight", "min": 0, "max": 1}], "weight": 2},
           {"groups": [{"id": "stone_golem", "min": 1, "max": 2}], "weight": 1}],
}
EXIT = {"map": "overworld", "entrance": "wnd_mirage"}
OPEN = "SKY_FORTRESS_OPEN"


class Room(BaseRoom):
    def __init__(self, map_id: str, name: str, w: int, h: int, floor: str):
        super().__init__(map_id, name, w, h)
        self.floor = floor

    def write(self, header: str, entrances: dict, extra: dict | None = None):
        quiet = {"encounterRate": {"min": 18, "max": 30}, "encounters": ENCOUNTERS[self.floor],
                 "battleBackgrounds": {"default": "tower_of_babel"}, "no_static_chokepoints": True,
                 "no_unreachable_walkable": True}
        return super().write(header + "\n" + NOTE, entrances, kits=KITS, mats=MATS, trim=TRIM, quiet=quiet,
                             script="wind/mirage_floors.py", legend=LEGEND, music="dungeon",
                             extra={"exit": EXIT, **(extra or {})})


def chest(cid: str, item: str, label: str, x: int, y: int) -> dict:
    return {"id": f"chest_{cid}", "sprite": "chest", "x": x, "y": y, "chestItem": item,
            "chestFlag": f"CHEST_WND_D1_{cid.upper()}", "dialog": [f"You found {label}!"]}
