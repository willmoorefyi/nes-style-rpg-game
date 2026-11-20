"""Region WIND of the world (docs/WORLD_PLAN.md 2.4, 2.8, 4.7; WND-O): Gaia's bowl, the Mirage sands and tower door,
Lufenia's mesa, and the north seas round them.

Concept: a rugged north-eastern continent of tangled ranges with three basins carved out of it, each reached only by
  air: Gaia's grass bowl in the north, the Mirage sands in the south-west, Lufenia's cliff-ringed mesa in the south.
Distinct: a crater tarn on the bowl's floor (Gaia's icon draws its own windmill, WL); a wind-gap in the bowl's east rim onto the
  Pinewold, a forested upland on the east coast cut by two sea lochs; a broken stone spine and a dry salt pan in the
  sands, with a buried bronze dial; the Sundering, a sea fjord that splits the mesa from the sands.
Topology: three walkable components with no walk between them (bowl + Pinewold, sands, mesa top), each with its
  airship meadow within 8 steps of its door; no dock (2.8), so the ship can sail the north seas but land nowhere.

The ground is `wind/world_ground.py`, the places and zones `wind/world_sites.py` (Gaia's site: WND-T's
`wind/town_gaia_site.py`). WIND borders no Aldi wall (2.6), so it returns no `walls`.
"""
from __future__ import annotations

from world_api import BOXES, UNSET, WATER, Cell, RegionOut
from world_geom import bbox
from wind import world_ground, world_sites

# NW-1 (docs/NATURAL_WORLD_PLAN.md 5.2): the places quest.yaml and the scenarios name (a stage entry, parked vehicles)
SPOTS = {
    "wnd_s_gaia": {"at": [150, 14], "kind": "land"},             # Gaia's land gate: S23
    "wnd_s_gaia_airship": {"at": [152, 16], "kind": "landing"},  # by Gaia: S23
    "wnd_s_sky_airship": {"at": [135, 38], "kind": "landing"},   # where the sky castle's party left it: S28, S31
    "wnd_s_mirage_airship": {"at": [136, 38], "kind": "landing"},    # by the Mirage Tower: scenario w_s27_start
    "wnd_s_lufenia_airship": {"at": [155, 48], "kind": "landing"},   # by Lufenia: scenario w_s26_start
    "wnd_s_ship": {"at": [172, 62], "kind": "dock"},             # the ship left at sea in the north-east: S23-S27
}

NOTES = [
    "WND-O: Gaia's bowl (grass, a crater tarn, a pine grove; WL: no separate windmills) and the Pinewold beyond the wind-gap",
    "WND-O: the Mirage sands (stone spine, salt pan, oasis meadow), the tower door on the west spit",
    "WND-O: Lufenia's mesa (grass, moor, a copse) ringed by cliffs, split from the sands by the Sundering fjord",
]


def build(band: set[Cell]) -> RegionOut:
    g = world_ground.build()
    for note in world_sites.seal(g):
        print("  " + note)
    b = bbox(BOXES["wind"])
    rows = []
    for y in range(b.y0, b.y1 + 1):
        row = []
        for x in range(b.x0, b.x1 + 1):
            if (x, y) in band:
                if g[(x, y)] != WATER:
                    raise SystemExit(f"world_wind: band cell ({x}, {y}) is {g[(x, y)]!r}, not ocean")
                row.append(UNSET)
            else:
                row.append(g[(x, y)])
        rows.append("".join(row))
    for x, y in (world_sites.blocked() - set(world_sites.KNOLL)) | {tuple(v) for v in world_sites.entrances().values()}:
        if g[(x, y)] not in world_sites.WALKABLE:
            raise SystemExit(f"world_wind: a place at ({x}, {y}) stands on {g[(x, y)]!r}")
    zones, backdrops = world_sites.zones(g)
    checks = {"warp_leaves": True, "min_blob": {"mountain": 3, "sand": 3, "forest": 3, "ocean_inlet": 2}}
    return RegionOut(ground=rows, objects=world_sites.objects(), inspect=world_sites.inspect(),
                     transitions=world_sites.transitions(), entrances=world_sites.entrances(), encounterZones=zones,
                     battleBackgrounds={"zones": backdrops}, notes=list(NOTES), checks=checks,
                     spots={k: dict(v) for k, v in SPOTS.items()})
