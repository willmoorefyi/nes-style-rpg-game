"""Region EARTH's world-map tables (docs/WORLD_PLAN.md 4.3; ERT-O): the encounter zones' tables, names and
backdrops, the shrine's text and Melmond's dressing seed. Pass W's cell logic (the landmarks, entrances, docks, the
canal, the zones' cells, the walls and the western range) retired at NW-5 (docs/NATURAL_WORLD_PLAN.md 3.6.1, 7): the
NW world places EARTH's content in `earth/world_earth_nw.py` on the generated ground.
"""
from __future__ import annotations

DRESS_SEED = 6113                               # Melmond's scattered dressing (world_dress.scatter)

def _g(enemy: str, lo: int, hi: int | None = None) -> dict:
    return {"id": enemy, "min": lo, "max": lo if hi is None else hi}


def _t(*rows: tuple[int, list[dict]]) -> list[dict]:
    return [{"groups": groups, "weight": w} for w, groups in rows]


# 3.2 rosters: S10 isthmus, S11 plain, S12-S13 badlands, Sarda's coast; the Aldi and the western sea (ship zones)
TABLES = {
    "ert_isthmus": _t((4, [_g("mummy", 2, 3)]), (3, [_g("wraith", 1, 3)]), (3, [_g("anaconda", 1, 2)]),
                      (2, [_g("mummy", 1, 2), _g("wraith", 1, 2)])),
    "ert_plain": _t((4, [_g("hyenadon", 1, 3)]), (3, [_g("lesser_tiger", 1, 2)]), (3, [_g("anaconda", 2, 3)]),
                    (2, [_g("troll", 1, 2), _g("hyenadon", 0, 1)])),
    "ert_badlands": _t((4, [_g("ogre_mage", 1, 2)]), (3, [_g("sphinx", 1)]), (2, [_g("earth_elemental", 1)]),
                       (2, [_g("hill_gigas", 1)]), (3, [_g("wight", 2, 4)])),
    "ert_sarda_coast": _t((4, [_g("ogre_mage", 1, 3)]), (3, [_g("sphinx", 1, 2)])),
    "ert_aldi": _t((4, [_g("sahagin", 3, 5)]), (3, [_g("shark", 1, 2)]), (2, [_g("buccaneer", 2, 4)]),
                   (1, [_g("bigeyes", 2, 4)])),
    "ert_sea": _t((4, [_g("sahagin_chief", 2, 4)]), (3, [_g("shark", 1, 3)]), (3, [_g("buccaneer", 3, 5)])),
}
NAMES = {"ert_isthmus": "Duergar Isthmus", "ert_plain": "Melmond Plain", "ert_badlands": "Grey Badlands",
         "ert_sarda_coast": "Sarda's Coast", "ert_aldi": "Aldi Sea", "ert_sea": "Western Sea"}
BACKDROPS = {"ert_badlands": {"default": "cracked_earth"}}

SHRINE_TEXT = ["A shrine to the earth, its roof fallen in. Grey roots have split the altar stone.",
               "Someone has scratched a line under the carved crystal: \"It will wake again.\""]
