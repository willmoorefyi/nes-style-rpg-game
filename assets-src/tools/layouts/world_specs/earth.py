"""EARTH's continent spec (docs/NATURAL_WORLD_PLAN.md 2.3; NW-0's pilot, preset B; NW-R EARTH tunes it).

The Duergar isthmus (a curved neck west of the Aldi with its hogback, walls W_west and W_isthmus, the canal saddle a
pass on it) and the western continent: the western range from sea cliff to sea cliff (barrier `western_range`, the
giant's tunnel the only crossing), Melmond on its east shore in the range's rain shadow (the badlands), Sarda's wet
coast west of it, Melmond's strait to the ocean, islands off Sarda.

NW-R EARTH: the giant's two mouths sit 9 cells apart (the west mouth at rel (-87, 3), the east one +1 x inside its
anchor window), so the ridge between them is 3 rock cells thick where it was 1 (at (64, 157)); the range's line is
NW-0's (moving it shifts the world-wide forest quantile and so repaints far chunks, 12's locality note), and the
range is thickened where its cut is thinner than 3 by `earth/world_earth_nw.thicken` (rock on the flanks of its
thinnest cells, inside its mask). The content (icons, zones, backdrops, the canal's dressing) is
`earth/world_earth_nw.py`, with the design note.
"""
from __future__ import annotations

import sys
from pathlib import Path

from worldgen.bundle import (Barrier, ClimateHint, Continent, Corridor, Dock, IsleField, Pass, RegionSpec, Ridge,
                             SeaLine, SpotDef, WallLine)

from .common import sites

ISTHMUS = ((-53, -31), (-45, -31), (-43, -22), (-45, -17), (-46, -12), (-44, -6), (-43, 2), (-44, 10), (-42, 17),
           (-48, 21), (-53, 14), (-55, 6), (-54, -4), (-53, -10), (-54, -16), (-56, -24))
MELMOND = ((-60, -13), (-66, -18), (-76, -16), (-86, -20), (-96, -16), (-104, -10), (-110, -2), (-108, 8), (-102, 14),
           (-98, 24), (-90, 30), (-80, 34), (-72, 30), (-66, 24), (-62, 16), (-61, 8), (-61, 0), (-61, -6))
WESTERN_RANGE = ((-86, -22), (-81, -12), (-84, -4), (-82, 3), (-79, 10), (-83, 18), (-80, 27), (-84, 37))
DWARF_DOCK, MELMOND_DOCK = (-42, -3), (-60, 3)


def spec() -> RegionSpec:
    return RegionSpec(
        region="earth",
        continents=[Continent("isthmus", "earth", ISTHMUS, fjord=0.0),
                    Continent("melmond", "earth", MELMOND, fjord=0.5)],
        ridges=[Ridge(((-100, -8), (-94, 6)), 0.6, 2.4, "Sarda's hills")],
        barriers=[Barrier("western_range", WESTERN_RANGE)],
        walls=[WallLine("W_west", ((-44, -31), (-47, -28), (-50, -24))),
               WallLine("W_isthmus", ((-50, -24), (-49.5, -16), (-49, -6), (-48.5, 4), (-48, 12)))],
        passes=[Pass((-49.5, -14), 4.0, "the canal saddle")],
        sea_lines=[SeaLine(((-56.5, -24), (-57, 0), (-57.5, 10), (-61, 22), (-66, 34), (-74, 44)), 1.6),
                   SeaLine(((-57.5, -14), (-54.5, -14)), 1.7), SeaLine(((-44.5, -14), (-41.5, -14)), 1.7)],
        isles=[IsleField((-118, 8), 10, 4, 104)],
        climate=[ClimateHint("arid", (-70, 18), 10), ClimateHint("wet", (-98, 4), 9)],
        sites=sites("earth", nudges={"ert_melmond": (-2, 0), "ert_giant": (1, 0)},
                    extra={"ert_giant_west": (-87, 3)}),
        towns=("ert_melmond",),
        docks=[Dock("ert_dwarf", DWARF_DOCK, "aldi", "ert_dwarf"),
               Dock("ert_melmond", MELMOND_DOCK, "ocean", "ert_melmond")],
        corridors=[Corridor("ert_dwarf", (DWARF_DOCK, "ert_dwarf")),
                   Corridor("ert_melmond", (MELMOND_DOCK, "ert_melmond")),
                   Corridor("ert_cave", ("ert_melmond", (-70, 10), (-75, 17), "ert_earth_cave")),
                   Corridor("ert_giant", ("ert_melmond", (-72, 4), "ert_giant")),
                   Corridor("ert_sarda", ("ert_giant_west", "ert_sarda"))],
        dock_links=("ert_dwarf", "ert_melmond"),
        canal=((-15, -14, -13), (-53, -46)),
        barrier_seeds={"western_range": ("ert_melmond", ("ert_sarda",), True, False)},
        links={"giant_west_to_sarda_foot": ("ert_giant_west", "ert_sarda")},
        spots=[SpotDef("ert_s_dwarf", "ert_dwarf", (0, 0), "land"),
               SpotDef("ert_s_melmond", "ert_melmond", (0, 0), "land"),
               SpotDef("ert_s_giant", "ert_giant", (0, 0), "land"),
               SpotDef("ert_s_earth_cave", "ert_earth_cave", (0, 0), "land"),
               SpotDef("ert_s_dwarf_ship", "dock:ert_dwarf", (0, 0), "dock"),
               SpotDef("ert_s_melmond_ship", "dock:ert_melmond", (0, 0), "dock"),
               SpotDef("ert_s_melmond_airship", "ert_melmond", (-2, -3), "landing")],
    )


def content(g, meta: dict, ctx) -> dict:
    """EARTH's content on the generated ground (objects, inspect cells, zones, backdrops, the canal's dressing, its
    map checks): `earth/world_earth_nw.py` (NW-R EARTH), for `world_content.merge` (`ctx.doors`, `ctx.taken`)."""
    here = str(Path(__file__).resolve().parents[1] / "earth")
    if here not in sys.path:
        sys.path.insert(0, here)
    import world_earth_nw  # noqa: PLC0415
    return world_earth_nw.content(g, meta, ctx.doors, set(ctx.taken))
