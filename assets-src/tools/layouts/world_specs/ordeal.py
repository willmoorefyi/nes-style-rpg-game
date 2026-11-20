"""ORDEAL's continent spec (docs/NATURAL_WORLD_PLAN.md 2.3, 4.1; NW-0's pilot, preset B; tuned by NW-R ORDEAL).

The Citadel: a crescent island arc in the north centre, its bay open to the south, held clear of Onrac's coast to the
west and Gaia's to the east by open straits. A high spine runs along its outer (north and west) side, so the north
rim is snow and rock; the inner side is a sheltered heath (a `warm` climate hint) whose broad west arm is the
tableland of the Citadel of Trials, cut into a crag spur of the spine. South-east of the arc lies Cardia, an
archipelago owned by ORDEAL: Bahamut's isle and five named islets (the hermit's the northernmost) among seeded
look-only islets, warm enough for grass landings. A small group lies south of the arc's west horn. Dockless:
airship only. The north sea (forced open water between the north continents and the south) is listed here.

Every point is Cornelia-relative (spec.py): the arc is given as world-cell midline knots with an outer and an inner
half-width (`_arc`), which the polygon grows by the preset's `grow`. The content (icons, zones, backdrops) is
`ordeal/world_ordeal_nw.py`'s (`content`).
"""
from __future__ import annotations

import math

from worldgen.bundle import ClimateHint, Continent, IsleField, RegionSpec, Ridge, SeaDisc, SeaLine, SpotDef

from .common import sites

CX, CY = 146, 155                             # CORNELIA_NW (world_api): world -> rel
# the arc's midline (world x, y) with its outer and inner half-widths, south-west horn to south-east horn
MID = ((118, 73, 1.0, 1.0), (114, 65, 2.5, 4.0), (115, 56, 3.0, 7.0), (118, 47, 3.0, 5.0), (125, 39, 3.0, 4.0),
       (134, 34, 2.5, 3.0), (140, 32, 1.5, 1.5), (144, 32, 0.5, 0.5))
SPINE = ((112, 70), (110, 62), (110, 54), (113, 45), (120, 37), (130, 30), (138, 28), (142, 29))
CRAG = ((111, 52), (117, 52), (122, 51))      # the spur the Citadel is cut into (its icon's top row: the crag)
BAY = (136, 52)                               # the arc's bay, open to the south-east (Cardia)
BAY_MOUTH = ((136, 50), (145, 60))
NORTH_SEA = ((-140, -60), (-100, -61), (-60, -59), (-20, -60), (20, -60), (60, -58), (110, -59))
# the named islets (world cells; Cornelia-relative in EXTRA): the reach roots and the hermit's hut
ISLETS = {"ord_isle_hermit": (152, 70), "ord_isle_north": (151, 59), "ord_isle_stack": (154, 80),
          "ord_isle_west": (146, 88), "ord_isle_east": (165, 74)}
LOOK = ((144, 78), (141, 69), (137, 87))      # look-only islets of Cardia (Q9's default), at fixed cells
HORSESHOE = (169, 87)                         # the bite out of Bahamut's isle: its bay, open to the east
MEADOW = (125, 60)                            # the landing meadow below the Citadel's gate
EXTRA = {"ord_meadow": (MEADOW[0] - CX, MEADOW[1] - CY), **{e: (x - CX, y - CY) for e, (x, y) in ISLETS.items()}}
ISLE_R, ISLE_K = 2.8, 2.0                     # a site islet: radius, wobble (x coast noise)
HERMIT_R = 3.4                                # the hermit's islet holds his hut
BAHAMUT_R, BAHAMUT_K = 5.2, 3.0


def rel(p) -> tuple[float, float]:
    return (p[0] - CX, p[1] - CY)


def _arc() -> tuple:
    """The crescent's polygon: each midline knot offset along its normal by the outer (left of the walk) and the
    inner half-width, outer side out and inner side back."""
    outer, inner = [], []
    for i, (x, y, ho, hi) in enumerate(MID):
        ax, ay = MID[max(i - 1, 0)][:2]
        bx, by = MID[min(i + 1, len(MID) - 1)][:2]
        tx, ty = bx - ax, by - ay
        n = math.hypot(tx, ty)
        nx, ny = ty / n, -tx / n                      # the outer normal (the walk runs clockwise round the bay)
        outer.append(rel((x + ho * nx, y + ho * ny)))
        inner.append(rel((x - hi * nx, y - hi * ny)))
    return tuple(outer + inner[::-1])


def spec() -> RegionSpec:
    return RegionSpec(
        region="ordeal",
        continents=[Continent("citadel", "ordeal", _arc(), fjord=1.2)],
        ridges=[Ridge(tuple(map(rel, SPINE)), 1.1, 3.0, "the arc's spine"),
                Ridge(tuple(map(rel, CRAG)), 0.8, 1.6, "the Citadel's crag")],
        sea_lines=[SeaLine(NORTH_SEA, 3.2), SeaLine(tuple(map(rel, BAY_MOUTH)), 2.5)],
        sea_discs=[SeaDisc(rel(BAY), 4.0), SeaDisc(rel(HORSESHOE), 3.0)],
        isles=[*(IsleField(rel(c), 0.0, 1, 101 + i, owner="ordeal") for i, c in enumerate(LOOK)),
               IsleField((-40, -64), 7, 3, 109)],
        isle_sites={**{e: (HERMIT_R if e == "ord_isle_hermit" else ISLE_R, ISLE_K) for e in ISLETS},
                    "ord_bahamut": (BAHAMUT_R, BAHAMUT_K)},
        climate=[ClimateHint("warm", rel((120, 58)), 20), ClimateHint("warm", rel((158, 80)), 20)],
        sites=sites("ordeal", extra=EXTRA),
        spots=[SpotDef("ord_s_citadel", "ord_meadow", (0, -1), "land"),
               SpotDef("ord_s_citadel_airship", "ord_meadow", (0, 0), "landing"),
               SpotDef("ord_s_bahamut_airship", "ord_bahamut", (0, 2), "landing")],
        north=("ord_citadel", "ord_bahamut"),
    )


def content(g, meta, _ctx=None) -> dict:
    """ORDEAL's content on the composed ground (NW-R): `ordeal/world_ordeal_nw.py`, for `world_content.merge`
    (its `battleBackgrounds.zones` are the zones' backdrops)."""
    from ordeal import world_ordeal_nw
    c = dict(world_ordeal_nw.content(g, meta))
    c["backdrops"] = (c.pop("battleBackgrounds", None) or {}).get("zones", {})
    return c
