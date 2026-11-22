"""Shared parts of the sky castle's floors (docs/WORLD_PLAN.md 4.7, stage S28; WND-D2): the materials (pale marble
walks, light-bridges as the glowing `+`, amber conveyor belts as `%`, the open sky as the wall top), the encounter
tables (the engine halls' own zone `wnd_d2_engine` holds the rare Warmech, 1 in 64), the design note every floor
carries, the chest helper and the conveyor helper (a belt of same-map transitions: every belt cell carries the
walker to the belt's far end, so a belt is walked one way only).

sky_lower.py writes 1F and 2F, sky_upper.py 3F to 5F; both import this module.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parents[2]))
from common import Room as BaseRoom  # noqa: E402
from kit import remap  # noqa: E402

KITS = ["castle", "interior", "temple", "town"]
# in_wall_top first: it recolours the kit's own red carpet (a soft weave) before `carpet` is remapped below
MATS = {"in_wall_top": {"from": "carpet", "hue": 215, "sat": 0.45, "shade": 1.75},             # the open sky below
        "floor_stone": {"from": "ar_marble", "hue": 15, "sat": 0.6, "shade": 1.05},              # pale sky-marble walks
        "carpet": {"from": "ar_marble", "hue": 175, "sat": 2.2, "shade": 1.3},                     # light-bridges, `+`
        "rubble": {"from": "floor", "hue": 8, "sat": 1.3, "shade": 1.45},                      # amber belts, `%`
        "in_wall_face": remap("sky")}                                                           # slate parapets
LEGEND = "legend: W open sky / masonry top  F parapet face  - marble walk  + light-bridge  % conveyor belt (one way)"
EXIT = {"map": "overworld", "entrance": "wnd_mirage"}
WON = "WIND_CRYSTAL_LIT"
NOTE = ("Concept: a castle the sky folk built to hold the wind still while they charted the stars; when they left, its "
        "steward, a hollow seraph of brass, kept the engines turning and the wind of the world locked in its spire.\n"
        "Distinct: a dock ring of empty sky berths round a hub, joined to it by four spokes over open air; amber "
        "conveyor belts that carry the walker one way between floating islands of a light-bridge maze; an archive of "
        "star charts whose sealed vault keeps a lump of adamant; engine halls whose watchman, a war machine, walks "
        "the stokers' aisles; a spire whose wind has stopped, the seraph waiting straight up the nave from the "
        "stair.\n"
        "Topology: 1F -> 2F (twin stairs: the hub's to the arrival island, the east berth's to the east island; "
        "the islands joined by bridges and one-way belts) -> 3F -> 4F -> 5F boss; a beam on 1F's south berth "
        "drops back to the Mirage Tower's top.")
LOWER = [{"groups": [{"id": "air_elemental", "min": 1, "max": 2}], "weight": 3},
         {"groups": [{"id": "earth_medusa", "min": 2, "max": 4}], "weight": 3},
         {"groups": [{"id": "black_flan", "min": 1, "max": 3}], "weight": 2},
         {"groups": [{"id": "soldier", "min": 1}, {"id": "earth_medusa", "min": 0, "max": 2}], "weight": 2},
         {"groups": [{"id": "spirit_naga", "min": 1, "max": 2}], "weight": 1}]
UPPER = [{"groups": [{"id": "death_knight", "min": 1, "max": 3}], "weight": 3},
         {"groups": [{"id": "vampire_lord", "min": 1, "max": 2}], "weight": 3},
         {"groups": [{"id": "dark_fighter", "min": 1, "max": 2}], "weight": 2},
         {"groups": [{"id": "spirit_naga", "min": 1}, {"id": "death_knight", "min": 0, "max": 2}], "weight": 2},
         {"groups": [{"id": "soldier", "min": 1, "max": 2}], "weight": 1}]
# 4F's zone: 63 parts of engine-hall formations and 1 of the Warmech with the whirlwind its fans draw in (WORLD 3.2)
ENGINE = [{"groups": [{"id": "soldier", "min": 1, "max": 2}], "weight": 20},
          {"groups": [{"id": "black_flan", "min": 2, "max": 3}], "weight": 12},
          {"groups": [{"id": "death_knight", "min": 1, "max": 2}], "weight": 12},
          {"groups": [{"id": "air_elemental", "min": 1, "max": 2}], "weight": 10},
          {"groups": [{"id": "dark_fighter", "min": 1}, {"id": "soldier", "min": 0, "max": 1}], "weight": 9},
          {"groups": [{"id": "warmech", "min": 1}, {"id": "air_elemental", "min": 1}], "weight": 1}]
ENGINE_ZONE = "wnd_d2_engine"
RATE = {"min": 18, "max": 30}


class Room(BaseRoom):
    def write(self, header: str, entrances: dict, *, table: list, bg: str, script: str,  # type: ignore[override]
              extra: dict | None = None):
        quiet = {"encounterRate": RATE, "encounters": table, "battleBackgrounds": {"default": bg},
                 "no_static_chokepoints": True, "no_unreachable_walkable": True}
        return super().write(header + "\n" + NOTE, entrances, kits=KITS, mats=MATS, trim=None, quiet=quiet,
                             script=script, legend=LEGEND, music="dungeon", extra={"exit": EXIT, **(extra or {})})

    def belt(self, cells: list[tuple[int, int]], to_entrance: str) -> None:
        """A conveyor: every cell is a `%` belt cell and a transition to this map's entrance `to_entrance`."""
        for x, y in cells:
            self.g.set(x, y, "%")
            self.transitions.append({"x": x, "y": y, "targetMap": self.id, "targetEntrance": to_entrance})


def chest(cid: str, item: str, label: str, x: int, y: int) -> dict:
    return {"id": f"chest_{cid}", "sprite": "chest", "x": x, "y": y, "chestItem": item,
            "chestFlag": f"CHEST_WND_D2_{cid.upper()}", "dialog": [f"You found {label}!"]}
