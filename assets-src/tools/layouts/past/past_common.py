"""Shared parts of the Temple of the Past (docs/WORLD_PLAN.md 4.8, stages S29-S30; PST): the materials (the act-1
temple's stone as it stood whole and unworn; the flooded nave's black water `≈`; the kit's royal carpet as the
runner `+`), the encounter tables, the design note every floor carries, and the floor writer with its chest, boss and stair helpers.

  python3 -I assets-src/tools/layouts/past/past_upper.py   (past-temple-1..3)
  python3 -I assets-src/tools/layouts/past/past_lower.py   (past-temple-4, -5, past-chaos)
  python3 -I assets-src/tools/build_map.py past-temple-1 past-temple-2 past-temple-3 past-temple-4 past-temple-5 past-chaos

Each of floors 1-4 ends at one refight; its fight sets its PAST_* flag (also set by its cutscene), and only the stair
on to the next floor reads that flag (`requiredFlags`), so S30's milestones are enforced by the stairs alone. The
Death Eye guards floor 5's stair to the shrine (DEATH_EYE_DEFEATED); Chaos waits in `past-chaos` (CHAOS_DEFEATED,
set by the `ending`). Chests use `CHEST_PST_*`, local flags `PST_*`.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parents[2]))
from common import Room as BaseRoom  # noqa: E402

KITS = ["temple", "castle", "interior", "town"]
MATS = {"floor_stone": {"from": "ar_temple_floor_cool", "hue": 25, "sat": 0.55, "shade": 1.45},        # pale stone, whole and unworn
        "rubble": {"from": "ar_temple_rubble_cool", "hue": 25, "sat": 0.5, "shade": 1.3},             # fallen masonry, `%`
        "in_wall_top": {"from": "temple_wall_top", "shade": 0.4},
        "in_wall_face": {"from": "temple_wall_face", "hue": 25, "sat": 0.7, "shade": 1.35},
        "water": {"from": "water", "hue": 15, "sat": 0.6, "shade": 0.45}}                     # the nave's flood, `≈`
LEGEND = "legend: W rock  F wall face  - temple stone  + red runner  % fallen masonry  ≈ flood water (deep)"
EXIT = {"map": "overworld", "entrance": "temple"}
BACKDROP = "fiend_hall"
RATE = {"min": 16, "max": 28}
CONCEPT = ("Concept: the Temple of Fiends as it stood before it fell, kept whole by the power that holds Chaos; "
           "the four fiends wait in it a second time, each on its own floor, and the deeper you go the less of the "
           "temple has collapsed.")
TOPOLOGY = ("Topology: floor 1 boss -> floor 2 (twin stairs: the south arm and the sealed east arm) -> floor 3 -> "
            "floor 4 -> floor 5 (two routes to the stair) -> the shrine of Chaos.")
# each map's own Distinct line (QUEST 4.6 item 1: at least 2 features no classic version of the place has)
DISTINCT = {
    "past-temple-1": "a cloister ring round an open garth whose west walk has fallen in, leaving two blind stubs; "
                     "a chapter house outside the ring with twin stairs that land in two different arms of the cross",
    "past-temple-2": "a cross whose west and north arms are shut by doorway wards of light that stone acolytes lift "
                     "one arm at a time; an east arm that never opens onto the hub, reached only by floor 1's east "
                     "stair",
    "past-temple-3": "a nave flooded wall to wall, crossed only by its two aisles and two transepts; a dry apse lip "
                     "above the water; chapels reached only from the aisles",
    "past-temple-4": "three square rings, each plugged where it is entered so the way in winds the long way round; "
                     "a well room at the centre; the deepest alcove between the last ring and the well",
    "past-temple-5": "two routes, a colonnade and a chain of three chambers, either side of a wall of carved eyes "
                     "that can be read; a ring of eyes looking inward at its empty centre; a blind niche off the "
                     "south hall",
    "past-chaos": "a processional that ends at a blank wall where a shadow is painted, so the sanctum is entered "
                  "from the side; side aisles behind the pillars that climb to the sanctum's two ends",
}
UPPER = [{"groups": [{"id": "death_knight", "min": 1, "max": 3}], "weight": 3},
         {"groups": [{"id": "vampire_lord", "min": 1, "max": 2}], "weight": 3},
         {"groups": [{"id": "dark_fighter", "min": 2, "max": 3}], "weight": 2},
         {"groups": [{"id": "death_knight", "min": 1}, {"id": "dark_fighter", "min": 1, "max": 2}], "weight": 2}]
LOWER = [{"groups": [{"id": "rhyos", "min": 1, "max": 2}], "weight": 3},
         {"groups": [{"id": "purple_worm", "min": 1, "max": 2}], "weight": 2},
         {"groups": [{"id": "iron_golem", "min": 1}], "weight": 2},
         {"groups": [{"id": "blue_dragon", "min": 1}], "weight": 2},
         {"groups": [{"id": "vampire_lord", "min": 1}, {"id": "rhyos", "min": 1}], "weight": 1}]


def quiet(table: list, bg: str, reach_roots: list | None = None) -> dict:
    return {"encounterRate": RATE, "encounters": table, "battleBackgrounds": {"default": bg},
            "no_static_chokepoints": reach_roots is None,
            "no_unreachable_walkable": {"reach_roots": reach_roots} if reach_roots else True}


class Room(BaseRoom):
    def write(self, header: str, entrances: dict, *, table: list, script: str,  # type: ignore[override]
              bg: str = BACKDROP, reach_roots: list | None = None, extra: dict | None = None):
        doc = {"exit": EXIT, "canSave": False, **(extra or {})}
        note = f"{CONCEPT}\nDistinct: {DISTINCT[self.id]}.\n{TOPOLOGY}"
        return super().write(header + "\n" + note, entrances, kits=KITS, mats=MATS, trim=None,
                             quiet=quiet(table, bg, reach_roots), script=script, legend=LEGEND, music="dungeon",
                             extra=doc)

    def gated_stairs_down(self, x: int, y: int, to_map: str, to_entrance: str, flag: str) -> None:
        """A stairwell (common.Room.stairs_down) whose two cells need `flag`: the refight's stair on."""
        self.stairs_down(x, y, to_map, to_entrance)
        for t in self.transitions[-2:]:
            t["requiredFlags"] = [flag]

    def boss(self, npc: dict, enemies: list[str], flag: str, cutscene: str, message: str) -> dict:
        """The refight's NPC (hidden once beaten) and the battle its talk starts; returns the scripted encounter."""
        self.npcs.append({**npc, "hideIf": flag})
        return {"x": npc["x"], "y": npc["y"], "npc": npc["id"], "enemyIds": enemies, "flag": flag, "isBoss": True,
                "postVictoryCutscene": cutscene, "message": message}


def chest(cid: str, item: str, label: str, x: int, y: int) -> dict:
    return {"id": f"chest_{cid}", "sprite": "chest", "x": x, "y": y, "chestItem": item,
            "chestFlag": f"CHEST_PST_{cid.upper()}", "dialog": [f"You found {label}!"]}


def ward(wid: str, x: int, y: int, flag: str, cutscene: str, lines: list) -> dict:
    """A ward keeper (floor 2), a stone acolyte: one talk plays its cutscene, which sets `flag` and lifts the next
    arm's seal."""
    return {"id": f"ward_{wid}", "sprite": "mage", "tint": "#a7adb5", "x": x, "y": y,
            "dialog": [{"condition": flag, "text": lines[1:]}, {"text": lines[:1]}],
            "cutscene": {"id": cutscene, "onceFlag": flag}}
