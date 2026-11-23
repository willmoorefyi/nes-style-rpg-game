"""FIRE's continent spec (docs/NATURAL_WORLD_PLAN.md 2.3; NW-0's pilot, preset B; NW-R FIRE tunes it; NW2-F moves
the Ice Cavern, docs/NW2_EDITS_PLAN.md 4).

The south-east continent: joined to Pravoka's range by a rock neck (wall W_south toward Elfland's fells), a long east
coast, the volcanic arc (Gurgu's cone; Crescent's caldera ring, barrier `crescent_ring`, closed on foot only, its
south side thickened into the Cinder Wall), Crescent Lake in the caldera with the pinned canoe route R-volcano down
the Cinder Gorge, the north hills, the Lykion desert in the south-east lee, an island group off the east coast.
Crescent's harbour (`fir_crescent`) is on the outer fjord. North of the ridge `ice_neck` the peninsula's cold tip:
the Rime Hollow (the Ice Cavern in a walled snow floor, barrier `ice_ring`, closed on foot only) whose tarn drains by
R-ice down the Rime Gorge through the Rime Fells to the Frost Shore and its own dock `fir_ice`.

Design note (NW-R FIRE, NW2-F). Concept: a lake country walled off by a fold of mountains, whose outlet carries the
canoe south through the fold into ash and dune, and a frozen tip beyond a ridge reached only by sea and then by
canoe. Distinct: Crescent Lake is bent into its crescent by a spur of the ring that carries the Circle's standing
stones; Gurgu's cone stands over the ash fields with its vents; the Ice Cavern opens in a rock ledge on the hollow's
north wall over a snow floor of pines; the buried hull lies in the dunes. Topology: Crescent's shore (dock, town,
lake) | the ring | the south lands (ash -> Gurgu; dunes -> the hull and the airship's grass), one land on foot (the
corridor `fir_south` keeps the generated rivers off that walk, a ford at most); R-volcano the only way through, by
canoe (S14 -> S15); the tip (the Frost Shore, by the `fir_ice` dock) | the Rime Fells | the hollow, R-ice the only
way in (S16); the hatch takes the levistone (S17). The neck to Elfland's east fells is rock
(`fire/world_fire_nw.neck`), so no river at the seam carries an early canoe in (NW-4's T2 row). Content, zones and
stamps: `fire/world_fire_nw.py`; the tables: `fire/fire_tables.py`.
"""
from __future__ import annotations

import math

from worldgen.bundle import (Barrier, ClimateHint, Cone, Continent, Corridor, Dock, Gorge, IsleField, Lake,
                             RegionSpec, Relation, Ridge, SpotDef, WallLine)

from .common import sites

SOUTHEAST = ((60, -40), (65, -44), (71, -40), (77, -30), (81, -16), (80, -2), (83, 12), (85, 26), (83, 40), (80, 54),
             (72, 64), (60, 69), (46, 68), (34, 64), (24, 58), (18, 48), (19, 40), (26, 35), (40, 33), (52, 30),
             (59, 24), (60, 10), (61, -8), (60, -24))
CRESCENT_RING = ((45, 29), (52, 31), (58, 32), (64, 32.5), (71, 32), (76, 27), (79, 18), (84, 10), (92, 6))
# NW2-F: the Rime Hollow's wall (a circle), the Rime Tarn, the neck across the peninsula, the two gorges
HOLLOW, HOLLOW_R = (69, -44), 6.0
TARN = ((70, -42), 2.0)
ICE_NECK = ((56, -21), (64, -21), (72, -22), (80, -23), (87, -24))
ROUTES = {
    "R-ice": ((70, -42), (71, -37), (76, -34), (77, -29), (72, -26), (66, -27), (64, -30), (62, -32), (60, -33)),
    "R-volcano": ((64, 25), (62, 28), (58, 31), (54, 35), (49, 38), (45, 41), (40, 43), (37, 45), (35, 46)),
}
# (route, first and last walled cell (bundle.Gorge), the site it gates, its stage, the dock that alone reaches it)
GORGES = (("R-volcano", 3, -6, "fir_volcano", "S15", ""), ("R-ice", 3, -9, "fir_ice", "S16", "fir_ice"))
DOCK = (58, 17)
ICE_DOCK, ICE_FACE, ICE_MOUTH = (59, -36), (60, -36), (60, -34)   # the dock, the cell it faces, R-ice's mouth side


def ring(c: tuple, r: float, n: int = 20) -> tuple:
    """A closed circle polyline of radius r round c (Cornelia-relative)."""
    return tuple((c[0] + r * math.cos(2 * math.pi * i / n), c[1] + r * math.sin(2 * math.pi * i / n))
                 for i in range(n + 1))


def spec() -> RegionSpec:
    return RegionSpec(
        region="fire",
        continents=[Continent("southeast", "fire", SOUTHEAST, fjord=1.0)],
        ridges=[Ridge(((62, -30), (70, -18), (74, -4)), 0.8, 3.0, "the north hills"),
                Ridge(((64, 46), (72, 56)), 0.6, 2.4, "the south hills"),
                Ridge(((61, 28), (54, 34), (46, 40), (41, 42)), 0.9, 4.0, "the Cinder Wall")],
        barriers=[Barrier("crescent_ring", CRESCENT_RING), Barrier("ice_neck", ICE_NECK),
                  Barrier("ice_ring", ring(HOLLOW, HOLLOW_R), warped=False)],
        walls=[WallLine("W_south", ((12, 39), (18, 35.5), (24, 37.5)))],
        cones=[Cone((28, 46), 1.25, 4.5)],
        lakes=[Lake((67, 22), 5.0, "Crescent Lake"), Lake(TARN[0], TARN[1], "the Rime Tarn")],
        routes=dict(ROUTES),
        isles=[IsleField((94, 30), 9, 4, 107)],
        climate=[ClimateHint("arid", (64, 56), 12), ClimateHint("arid", (48, 51), 8),
                 ClimateHint("cold", (73, -40), 22)],
        sites=sites("fire", nudges={"fir_crescent": (2, 0)}),
        towns=("fir_crescent",),
        docks=[Dock("fir_crescent", DOCK, "ocean", "fir_crescent"),
               Dock("fir_ice", ICE_DOCK, "ocean", "fir_ice", toward=ICE_FACE)],
        corridors=[Corridor("fir_crescent", (DOCK, "fir_crescent")),
                   Corridor("fir_south", ("fir_volcano", (37, 48), (46, 49), "fir_desert")),
                   Corridor("fir_ice_shore", (ICE_DOCK, ICE_MOUTH))],
        dock_links=("fir_crescent",),
        barrier_seeds={"crescent_ring": ("fir_crescent", ("fir_volcano", "fir_desert"), False, False),
                       "ice_neck": ("fir_crescent", ("spot:fir_s_ice_shore", "fir_ice"), True, False),
                       "ice_ring": ("spot:fir_s_ice_shore", ("fir_ice",), False, False)},
        gorges=[Gorge(*g) for g in GORGES],
        relations=[Relation("fir_ice", "fir_crescent", "north_of", 40),
                   Relation("fir_ice", "fir_crescent", "bearing", 30, 0),
                   Relation("fir_ice", "fir_volcano", "min_dist", 60)],
        spots=[SpotDef("fir_s_crescent", "fir_crescent", (0, 0), "land"),
               SpotDef("fir_s_crescent_road", "dock:fir_crescent", (1, 0), "land"),
               SpotDef("fir_s_desert", "fir_desert", (0, 0), "land"),
               SpotDef("fir_s_hull", "fir_desert", (6, 3), "land"),
               SpotDef("fir_s_crescent_ship", "dock:fir_crescent", (0, 0), "dock"),
               SpotDef("fir_s_airship", "fir_desert", (6, 2), "landing"),
               SpotDef("fir_s_ice_ship", "dock:fir_ice", (0, 0), "dock"),
               SpotDef("fir_s_ice_shore", "dock:fir_ice", (1, 0), "land"),
               SpotDef("fir_s_seam_e", "fir_desert", (59, -7), "dock")],     # WR: at sea by the east seam
    )


def content(g, meta, ctx) -> dict:
    """NW-R FIRE: the region's content on the composed ground (`fire/world_fire_nw.py`), for
    `world_content.merge` (`ctx.bundle`, `ctx.trans`)."""
    from fire import world_fire_nw
    return world_fire_nw.content(g, meta, ctx.bundle, ctx.trans)
