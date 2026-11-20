"""A1's encounter tables beyond act 1 (docs/WORLD_PLAN.md 3.2 S2 / S4 rosters, 4.0.3, 4.1; A1-O): `MAINLAND`
(`a1_mainland`, walking, the S2 roster at band 3-6), `ALDI` (`a1_aldi`, ship, the S4 sea roster) and `NORTH_SEA`
(`a1_north_sea`, ship, the outer water). Pass W's zone cells retired at NW-5 (docs/NATURAL_WORLD_PLAN.md 3.6.4): the NW
world builds the zones in `a1/world_a1_nw.py`.
"""
from __future__ import annotations


def _g(enemy: str, lo: int, hi: int | None = None) -> dict:
    return {"id": enemy, "min": lo, "max": lo if hi is None else hi}


# S2 (band 3-6): the mainland's hills and woods. Heavier packs are rare; the werewolf and the grey wolves travel alone
MAINLAND = [{"groups": [_g("black_widow", 2, 4)], "weight": 4},
            {"groups": [_g("zombie", 2, 4)], "weight": 4},
            {"groups": [_g("crazy_horse", 1, 2)], "weight": 3},
            {"groups": [_g("gigas_worm", 1)], "weight": 3},
            {"groups": [_g("ghoul", 1), _g("zombie", 1, 2)], "weight": 2},
            {"groups": [_g("gr_wolf", 1), _g("black_widow", 0, 2)], "weight": 2},
            {"groups": [_g("werewolf", 1)], "weight": 1}]
# S4 (band 5-9): the Aldi's open water
ALDI = [{"groups": [_g("sahagin", 2, 4)], "weight": 5},
        {"groups": [_g("bigeyes", 2, 4)], "weight": 3},
        {"groups": [_g("buccaneer", 1, 3)], "weight": 3},
        {"groups": [_g("sahagin", 1, 2), _g("buccaneer", 1)], "weight": 2},
        {"groups": [_g("shark", 1)], "weight": 1}]
# the outer water: a later sea, met only by a ship that has left the Aldi (after CANAL_OPEN)
NORTH_SEA = [{"groups": [_g("sahagin_chief", 1, 3)], "weight": 4},
             {"groups": [_g("shark", 1, 2)], "weight": 3},
             {"groups": [_g("bigeyes", 3, 5)], "weight": 2},
             {"groups": [_g("sahagin_chief", 1), _g("sahagin", 2, 3)], "weight": 2}]
