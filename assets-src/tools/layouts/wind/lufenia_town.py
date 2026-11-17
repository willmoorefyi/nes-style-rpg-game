"""Lufenia, the sky-folk's village on the mesa (docs/WORLD_PLAN.md 4.0.1, 4.7; WND-O) -> assets-src/maps/lufenia.yaml.

  python3 -I assets-src/tools/layouts/wind/lufenia_town.py && python3 -I assets-src/tools/build_map.py lufenia

An original layout: the mesa top inside a low cliff rim (wall), entered by one cut in the south rim. Pale houses
stand round a paved star-court with a brass orrery at its heart and armillary lecterns at its corners; observatory
domes sit at the rim's four quarters. The elder's hall closes the court's north side; the stargazer and the healer
live west and east of it, the two magic shops face each other across the lower court and the inn stands by the
gate road. The keepers appear only once the party can read Lufenian (`showIf: LUFENIAN_LEARNED`).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parent))
from common import Grid, polygon_mask, write_map  # noqa: E402
from town_common import Outdoor  # noqa: E402
import lufenia_people  # noqa: E402

W, H = 36, 32
GATE_X = 17                                      # the gate cut: columns 17-18 of the bottom rim
DOME = [["dome_icon_0_0", "dome_icon_0_1"], ["dome_icon_1_0", "dome_icon_1_1"]]
NOTE = """Concept: a sky-folk village on a cliff-rimmed mesa: pale houses round a paved star-court with a brass orrery,
observatory domes on the rim, the elder's hall at the head of the court.
Distinct: a brass orrery and armillary lecterns in the star-court; observatory domes on the rim's four quarters;
a single cut through the south rim as the only way in; a moon-lily garden by the inn.
Topology: one outdoor map, gate in the south rim -> star-court; 3 houses (stargazer, elder, healer), 2 magic shops
and the inn open off the court; no stairs."""

g = Grid(W, H, "#")
RIM = [(4, 3), (31, 3), (34, 6), (34, 25), (31, 29), (4, 29), (1, 25), (1, 6)]
inside = polygon_mask(W, H, RIM)
for y in range(H):
    for x in range(W):
        if inside[y][x]:
            g.set(x, y, ".")
g.rect(GATE_X, 28, GATE_X + 1, H - 1, ":")       # the gate cut
g.rect(12, 13, 23, 18, ":")                      # the star-court
g.rect(GATE_X, 19, GATE_X + 1, 27, ":")          # the gate road
g.rect(17, 10, 18, 12, ":")                      # to the elder's door
g.rect(6, 12, 6, 13, ":")                        # the stargazer's lane
g.rect(6, 13, 11, 13, ":")
g.rect(29, 12, 29, 13, ":")                      # the healer's lane
g.rect(24, 13, 29, 13, ":")
g.rect(6, 23, 16, 23, ":")                       # the lower court, between the magic shops
g.rect(19, 23, 29, 23, ":")
g.rect(19, 26, 22, 26, ":")                      # the inn's step

town = Outdoor()
obj, deco, fir = town.obj, town.deco, town.fir
HOUSE = dict(type="house", wall="white")
obj(**HOUSE, name="house_elder", x=14, y=5, w=8, h=5, door=4, windows=[1, 3, 5, 6], storeys=2, roof="slate",
    enter={"map": "lufenia-house-elder", "entrance": "door"})
obj(**HOUSE, name="house_stargazer", x=4, y=8, w=5, h=4, door=2, windows=[1, 3], roof="blue",
    enter={"map": "lufenia-house-stargazer", "entrance": "door"})
obj(**HOUSE, name="house_healer", x=27, y=8, w=5, h=4, door=2, windows=[1, 3], roof="teal", sign="shrine",
    enter={"map": "lufenia-house-healer", "entrance": "door"})
obj(**HOUSE, name="white_magic", x=4, y=19, w=5, h=4, door=2, windows=[1, 3], roof="blue", sign="white_magic",
    enter={"map": "lufenia-white-magic", "entrance": "door"})
obj(**HOUSE, name="black_magic", x=27, y=19, w=5, h=4, door=2, windows=[1, 3], roof="slate", sign="black_magic",
    enter={"map": "lufenia-black-magic", "entrance": "door"})
obj(type="prefab", prefab="inn", name="inn", x=20, y=21, w=4, h=5, door=2, sign="inn",
    enter={"map": "lufenia-inn", "entrance": "door"})
for x, y in [(9, 4), (25, 4), (3, 14), (31, 14)]:     # the observatory domes on the rim's quarters
    deco(DOME, x, y, collide="alpha")
deco([["globe"]], 17, 15)                         # the brass orrery and its armillary lecterns
deco([["globe"]], 18, 15)
for x, y in [(13, 14), (22, 14), (13, 17), (22, 17)]:
    deco([["lectern"]], x, y)
for x, y in [(23, 27), (24, 27), (25, 28)]:       # the moon-lily garden by the inn
    obj(type="flowers", x=x, y=y)
for x, y in [(8, 27), (6, 26), (30, 27), (32, 22), (3, 22), (32, 9), (3, 10)]:
    if g[x, y] == "." and g[x, y - 1] == ".":
        fir(x, y)

npcs = lufenia_people.outdoor()
doc = {
    "id": "lufenia",
    "name": "Lufenia",
    "kits": ["town", "castle"],
    "music": "town",
    "entrances": {"gate": [GATE_X, 29]},
    "objects": town.objects,
    "npcs": npcs,
    "transitions": [{"x": x, "y": H - 1, "targetMap": "overworld", "targetEntrance": "wnd_lufenia"}
                    for x in (GATE_X, GATE_X + 1)],
    "encounterRate": {"min": 999, "max": 999},
    "encounters": [],
    "canSave": True,
    "no_static_chokepoints": True,
    "no_unreachable_walkable": True,
}
HEADER = f"""GENERATED by assets-src/tools/layouts/wind/lufenia_town.py - edit the script, not this file.
{NOTE}
ground legend: . grass  : cobble  # wall (the mesa's cliff rim)"""

if __name__ == "__main__":
    print(write_map("lufenia", HEADER, doc, g.text()))
