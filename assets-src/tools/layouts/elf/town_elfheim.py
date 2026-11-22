"""Elfheim, the elf town of Elfland (docs/WORLD_PLAN.md 4.0.1, 4.2; ELF-T) -> assets-src/maps/elfheim.yaml.

  python3 -I assets-src/tools/layouts/elf/town_elfheim.py && python3 -I assets-src/tools/build_map.py elfheim

An original layout. A ring of living hedges, thick and bent into bastions, closes the town; the only way in is the
south gate. A spring wells up under the castle rise in the north-west and its stream winds through the middle of the
town to a pond in the south-east, crossed by the high street and two footbridges. The houses stand among great oaks,
green-roofed (the `elf` roof style); the shops face the high street and the lanes. North of an inner hedge the
ground climbs to a wooded rise where the castle stands; its gate (`north_gate`) leads to `elfheim-castle`.
The people are in `town_elfheim_people.py`, the houses in `town_elfheim_homes.py`, the shops and the inn in
`town_elfheim_shops.py` and the castle in `town_elfheim_castle.py`.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parent))
from common import Grid, polygon_mask, write_map  # noqa: E402
from town_common import TURRET, Outdoor, flag, win  # noqa: E402
import town_theme as THEME  # noqa: E402
import town_elfheim_people as people  # noqa: E402

W, H = 52, 50
CX = 25                                          # the high street, x 25-26; the castle door column
NOTE = """Concept: an elven town closed by a ring of living hedges, its houses among great oaks, a spring stream through
the middle and the castle on a wooded rise beyond an inner hedge.
Distinct: a hedge ring bent into green bastions with a single south gate; a spring pool under the castle rise feeding
a stream that ends in a lily pond; an inner hedge with topiary guards between the town and the castle rise; a herb
garden by the herbalist's house.
Topology: one outdoor map, the south gate -> the high street -> the north gate (elfheim-castle); 6 houses, 5 shops
and the inn open off the high street and five lanes; no stairs."""

g = Grid(W, H, ".")
RING = [(5, 2), (46, 2), (49, 5), (49, 20), (46, 24), (49, 28), (49, 43), (45, 47), (6, 47), (2, 43), (2, 28),
        (5, 24), (2, 20), (2, 5)]
inside = polygon_mask(W, H, RING)
HEDGE_LINE = [(x, 16) for x in range(2, 23)] + [(x, 16) for x in range(29, 50)]    # the inner hedge

# ── water: the spring pool, the stream, the lily pond ──
g.rect(7, 18, 11, 20, "~")
g.line([(8, 20), (8, 24), (13, 28), (19, 29), (24, 30), (31, 30), (34, 33), (36, 37), (37, 40)], "~", 2)
g.rect(35, 40, 41, 43, "~")

# ── streets and lanes ──
ROAD = ".,"
g.rect(CX, 13, CX + 1, H - 1, ":", only=ROAD + "~")       # the high street, south gate to the castle door
g.rect(CX, 30, CX + 1, 31, "=")                           # its bridge over the stream
g.rect(16, 13, 35, 14, ":", only=ROAD)                    # the castle apron
g.rect(12, 23, 45, 23, ",", only=ROAD)                    # the north lane, along the shop and house doors
g.rect(4, 23, 11, 23, ",", only=ROAD + "~")               # ... west over the footbridge to the herb garden
g.rect(8, 23, 9, 23, "=")
g.rect(6, 24, 6, 37, ",", only=ROAD)                      # the west lane, down to the south lane
g.rect(7, 34, 10, 34, ",", only=ROAD)                     # ... and the healer's door
g.rect(6, 37, 24, 37, ",", only=ROAD)                     # the south lane, past the bard's door and the item shop
g.rect(9, 44, 24, 44, ",", only=ROAD)                     # the magic lane, before the two magic shops
g.rect(27, 39, 32, 39, ",", only=ROAD)                    # the inn's step
g.rect(27, 33, 44, 33, ",", only=ROAD + "~")              # the east lane, over the second footbridge to the warden
g.rect(32, 33, 33, 33, "=")
g.rect(44, 32, 44, 32, ",", only=ROAD)

town = Outdoor()
obj, deco, oak, lamp, fir = town.obj, town.deco, town.oak, town.lamp, town.fir

# ── the castle on the rise ──
obj(type="facade", name="north_gate", x=CX - 7, y=3, w=15,
    bands=[{"kind": "roof", "rows": 3, "ridge": 1}, {"kind": "wall", "rows": 3}, {"kind": "battlement", "rows": 1},
           {"kind": "wall", "rows": 3}],
    parts=[win(3, 3), win(11, 3), flag(7, 3),
           {"parts": [["gate_0_0", "gate_0_1", "gate_0_2"], ["gate_1_0", "gate_1_1", "gate_1_2"],
                      ["gate_2_0", "gate_2_1", "gate_2_2"]], "x": 6, "y": 7, "match": "castle_face"},
           {"parts": TURRET, "x": 0, "y": 7}, {"parts": TURRET, "x": 13, "y": 7}],
    door=[7, 9], enter={"map": "elfheim-castle", "entrance": "gate"})

# ── houses (doors on the lanes; each home has its interior, town_elfheim_homes.py) ──
HOUSE = dict(type="house", w=5, door=2, windows=[1, 3])
SHOPS = [("weapon_shop", "elfheim-weapon-shop", 19, 18, 5, 2, "teal", "plaster", "weapon"),
         ("armor_shop", "elfheim-armor-shop", 28, 18, 5, 2, "elf", "white", "armor"),
         ("item_shop", "elfheim-item-shop", 18, 32, 5, 2, "elf", "ochre", "item"),
         ("white_magic", "elfheim-white-magic", 8, 39, 5, 2, "blue", "white", "white_magic"),
         ("black_magic", "elfheim-black-magic", 15, 39, 5, 2, "slate", "stone", "black_magic")]
for (name, mid, x, y, h, st, roof, wall, sign) in SHOPS:
    obj(**HOUSE, name=name, x=x, y=y, h=h, storeys=st, roof=roof, wall=wall, sign=sign,
        enter={"map": mid, "entrance": "door"})
HOMES = [("herbalist", 13, 19, 4, 1, "elf", "rose", 1), ("bowyer", 34, 19, 4, 1, "green", "ochre", 3),
         ("scribe", 40, 18, 5, 2, "elf", "white", None), ("healer", 8, 30, 4, 1, "elf", "white", 3),
         ("bard", 13, 33, 4, 1, "green", "rose", 1), ("warden", 42, 28, 4, 1, "elf", "stone", 3)]
for (name, x, y, h, st, roof, wall, ch) in HOMES:
    obj(**HOUSE, name=f"house_{name}", x=x, y=y, h=h, storeys=st, roof=roof, wall=wall,
        **({"sign": "shrine"} if name == "healer" else {}), **({"chimney": ch} if ch is not None else {}),
        enter={"map": f"elfheim-house-{name}", "entrance": "door"})
obj(type="prefab", prefab="inn", name="inn", x=28, y=34, w=4, h=5, door=2, sign="inn",
    enter={"map": "elfheim-inn", "entrance": "door"})

# ── the inner hedge, its gap at the high street, and the topiary that guard it ──
for (x, y) in HEDGE_LINE:
    if inside[y][x]:
        deco([["hedge"]], x, y)
for x in (23, 28):
    deco([["topiary"]], x, 16)
for x in (CX - 1, CX + 2):
    lamp(x, 17)

# ── the wooded rise: oaks round the castle ──
for (x, y) in [(4, 4), (8, 6), (12, 3), (13, 9), (5, 10), (37, 4), (41, 7), (44, 3), (36, 10), (44, 11)]:
    oak(x, y)
for (x, y) in [(9, 12), (16, 5), (34, 6), (40, 13), (47, 9), (3, 14)]:
    fir(x, y)
for x in (17, 34):
    deco([["urn"]], x, 12)

# ── gardens, trees and the water's edge ──
for (x, y) in [(4, 19), (5, 19), (6, 19), (4, 21), (5, 21), (6, 21)]:      # the herb garden
    deco([["crops"]], x, y)
obj(type="fence", **{"from": [4, 22], "to": [7, 22]})
obj(type="bush", x=7, y=21)                               # the garden's corner by the spring pool
for (x, y) in [(36, 41), (38, 42), (40, 41)]:
    deco([["lilies"]], x, y, on_water=True)
for (x, y) in [(31, 25), (19, 25), (45, 36), (43, 40), (20, 41), (33, 43)]:
    oak(x, y)
for (x, y) in [(29, 26), (38, 26), (14, 46), (40, 46), (3, 40)]:
    fir(x, y)
for (x, y) in [(12, 21), (18, 21), (27, 21), (33, 21), (39, 25), (40, 25), (6, 41), (7, 42), (24, 42),
               (27, 42), (43, 37), (44, 37)]:
    obj(type="flowers", x=x, y=y)
for (x, y) in [(23, 32), (28, 32), (23, 45), (28, 45)]:
    lamp(x, y)
obj(type="well", x=22, y=26)
obj(type="bench", x=34, y=38)
obj(type="bench", x=12, y=38)
SIGNPOST = (CX + 2, 46)
obj(type="signpost", x=SIGNPOST[0], y=SIGNPOST[1])
INSPECT = [{"x": SIGNPOST[0], "y": SIGNPOST[1], "text": [
    "The sign reads: \"ELFHEIM. Walk softly; the hedges listen.\"",
    "North up the high street: the lanes to the shops and houses, then the castle on the rise.",
    "The magic shops: west along the south lane, then down to the magic lane. The inn stands east of the street.",
]}]

# ── the ring of living hedges: every cell outside the ring is hedge (round bushes on the bastion bends) ──
roads = {(x, y) for y in range(H) for x in range(W) if g[x, y] in ":,=~"}
BENDS = {(46, 24), (5, 24), (49, 5), (2, 5), (45, 47), (6, 47)}
for y in range(H):
    for x in range(W):
        if inside[y][x] or (x, y) in roads:
            continue
        near_bend = any(abs(x - bx) <= 1 and abs(y - by) <= 1 for bx, by in BENDS)
        if near_bend:
            obj(type="bush", x=x, y=y)
        else:
            deco([["hedge"]], x, y)

doc = {
    "id": "elfheim",
    "name": "Elfheim",
    "kits": ["town", "castle"],
    "music": "town",
    "entrances": {"gate": [CX, 46]},
    "objects": town.objects,
    "npcs": people.outdoor(),
    "inspect": INSPECT,
    "transitions": [{"x": x, "y": H - 1, "targetMap": "overworld", "targetEntrance": "elf_elfheim"} for x in (CX, CX + 1)],
    "encounterRate": {"min": 999, "max": 999},
    "encounters": [],
    "canSave": True,
    "no_static_chokepoints": True,
    "no_unreachable_walkable": True,
}
HEADER = f"""GENERATED by assets-src/tools/layouts/elf/town_elfheim.py - edit the script, not this file.
{NOTE}
ground legend: . grass  : cobble  , dirt  ~ water  = bridge"""

THEME.apply(doc, "elfheim", g)               # AR-W2: the approved town theme (docs/TOWN_THEMES.md)
if __name__ == "__main__":
    print(write_map("elfheim", HEADER, doc, g.text()))
