"""WIND's continent spec (docs/NATURAL_WORLD_PLAN.md 2.3, 4.1; NW-0's pilot, preset B; tuned in NW-R WIND).

Concept: Gaia's continent in the far north-east, a desert basin walled by mountains with a long cold arm and a
  forested tail, every part of it reached only by air.
Distinct: the Mirage sands, a dune basin closed on every side by a mountain ring, with a salt pan and a broken stone
  spine; Gaia's arm, a snow-rimmed upland hooking north-east, its grass bowl and crater tarn round the town; the
  Sundering, a sea sound between the ring and the tail; the Pinewold, the forested upper tail; Lufenia's mesa at the
  tail's end, a wet moor cut off from the Pinewold by a line of cliffs.
Topology: three walkable parts never joined on foot (Gaia's arm with the Pinewold and the ring's outer slopes, the
  sands, Lufenia's mesa), Gaia with an airship meadow by its door, the Mirage and Lufenia with a hike (NW2-N,
  `Hike`: no landing within K 25 steps, the meadow the hike pass stamps within U 50); no dock (WORLD 2.8), so the ship sails the north
  seas but lands nowhere.

Every point is written in world cells where the feature should stand (`W`). The ridges, barriers, sea lines and
hints are placed there as given; a continent polygon is drawn against the generator's continent warp (`_unwarp`:
the shape stage samples a polygon's distance at the warped cell, so a vertex is moved by the warp at its place and
the coast lands where it is drawn, give or take the fjord and coast noise). The ring and the mesa cliffs are forced
high ground (`Barrier` records outside world_api.BARRIERS: they gate no stage, so they carry no seeds and no cut;
`wind/world_nw.py` checks that the three parts stay apart). The places, stamps and zones on the generated ground are
`wind/world_nw.py` (`content`).
"""
from __future__ import annotations

from functools import lru_cache

from worldgen import spec as S
from worldgen.bundle import (Barrier, ClimateHint, Continent, Hike, IsleField, Lake, RegionSpec, Ridge, SeaDisc,
                             SeaLine, SpotDef)
from worldgen.noise import fbm

from .common import sites

CX, CY = S.CORNELIA_NW


def W(*pts: tuple[float, float]) -> tuple[tuple[float, float], ...]:
    """World cells -> Cornelia-relative points (the generator's frame)."""
    return tuple((x - CX, y - CY) for x, y in pts)


@lru_cache(maxsize=1)
def _warp():
    p = S.PRESET                             # shape.shape's continent warp and its small second warp
    return (p.warp * fbm(S.SEED + 11, (48, 24, 12)) + p.swarp * fbm(S.SEED + 83, (14, 7, 3.5), 0.6),
            p.warp * fbm(S.SEED + 12, (48, 24, 12)) + p.swarp * fbm(S.SEED + 84, (14, 7, 3.5), 0.6))


def _unwarp(pts) -> tuple:
    """World points -> Cornelia-relative polygon vertices, each moved by the warp at its cell."""
    wx, wy = _warp()
    return tuple((x + float(wx[int(y), int(x)]) - CX, y + float(wy[int(y), int(x)]) - CY) for x, y in pts)


def _band(line, halves) -> list:
    """A polygon round a polyline (world), each side offset by its point's half width."""
    left, right = [], []
    for i, ((x, y), h) in enumerate(zip(line, halves)):
        (ax, ay), (bx, by) = line[max(i - 1, 0)], line[min(i + 1, len(line) - 1)]
        dx, dy = bx - ax, by - ay
        n = (dx * dx + dy * dy) ** 0.5 or 1.0
        left.append((x - h * dy / n, y + h * dx / n))
        right.append((x + h * dy / n, y - h * dx / n))
    return left + right[::-1]


# the anchors, nudged inside their +-2 window off the chunk lines (0.1.1): Gaia's door row off x 208, the Mirage
# Tower's three rows off y 64
NUDGES = {"wnd_gaia": (2, 0), "wnd_mirage": (2, 2)}
RING_C = (190, 58)                          # the sands' middle
RING_PTS = ((184, 43), (192, 40), (199, 42), (204, 48), (206, 56), (204, 64), (199, 71), (191, 75), (183, 75),
            (178, 72), (177, 66), (179, 58), (181, 50), (184, 43))
RING = W(*RING_PTS)
# the basin's coast: the ring's outer slopes, a few cells beyond it (the polygon is grown by the preset's `grow`);
# each arc drawn in or out by k: out in the north and the south-west, where the coast noise eats most; in on the
# north-west, which faces the Citadel's coast across a narrow strait, and on the east, along the Sundering
RING_K = (0.8, 1.08, 1.08, 0.9, 0.9, 0.9, 0.9, 0.85, 0.82, 0.95, 1.0, 0.78, 0.74)
BASIN = _unwarp([(RING_C[0] + k * (x - RING_C[0]), RING_C[1] + k * (y - RING_C[1]))
                 for (x, y), k in zip(RING_PTS[:-1], RING_K)])
# Gaia's arm hooking north-east from the ring, then the tail south along the east coast to Lufenia
ARM_LINE = ((196, 46), (203, 43), (210, 39), (218, 35), (226, 31), (232, 36), (231, 46), (228, 58), (226, 70),
            (224, 80), (222, 87))
ARM = _unwarp(_band(ARM_LINE, (5.0, 5.0, 4.8, 4.6, 4.2, 3.8, 3.8, 3.8, 3.0, 2.8, 2.0)))
# the ring's west spur: where the basin's north-west slope meets the Citadel's east horn the two coasts touch, and
# the spur keeps that neck rock (no walk from the Citadel's land onto WIND's)
SPUR = W((177, 35), (176, 43), (176, 51))
CLIFFS = W((205, 61), (214, 60), (224, 62), (232, 60), (240, 61))           # Lufenia's mesa cliffs
MIRAGE_LANDING, LUFENIA_LANDING = (9, -25), (25, -6)    # NW2-N: the hike landings (spot offsets from the arrivals)
SUNDERING = W((210, 55), (211, 62), (211, 68), (209, 76), (206, 86))         # the sound between the ring and the tail


def spec() -> RegionSpec:
    return RegionSpec(
        region="wind",
        continents=[Continent("mirage", "wind", BASIN, fjord=0.5, knobs={"detail": 12, "finger": 6}),
                    Continent("gaia", "wind", ARM, fjord=0.8, knobs={"detail": 16, "finger": 10})],
        ridges=[Ridge(RING, 1.0, 3.0, "the Mirage ring"),
                Ridge(W((203, 37), (212, 32), (222, 28), (231, 30)), 0.9, 2.4, "Gaia's north range"),
                Ridge(W((229, 47), (227, 54)), 0.7, 1.8, "the Pinewold's knot"),
                Ridge(CLIFFS, 1.0, 2.2, "Lufenia's mesa cliffs"),
                Ridge(W((188, 50), (191, 55), (189, 60)), 0.55, 1.1, "the stone spine")],
        barriers=[Barrier("wnd_mirage_ring", RING, base=1.5), Barrier("wnd_mesa_cliffs", CLIFFS, base=1.5),
                  Barrier("wnd_west_spur", SPUR, base=1.2)],
        sea_lines=[SeaLine(SUNDERING, 2.4)],
        sea_discs=[SeaDisc(W((178, 81))[0], 4.0)],         # the bight between the ring and Cardia (no land bridge)
        lakes=[Lake(W((215, 37))[0], 2.2, "Gaia's crater tarn")],
        isles=[IsleField(W((238, 18))[0], 6, 3, 108)],
        climate=[ClimateHint("arid", W(RING_C)[0], 22), ClimateHint("arid", W((185, 64))[0], 14),
                 ClimateHint("wet", W((221, 80))[0], 10),
                 # NW2-T (D-NW2-8): taiga over the east lobe and round Lufenia (Gaia keeps its meadow)
                 ClimateHint("cold", W((228, 52))[0], 10), ClimateHint("cold", W((220, 80))[0], 8)],
        sites=sites("wind", nudges=NUDGES),
        towns=("wnd_gaia", "wnd_lufenia"),
        spots=[SpotDef("wnd_s_gaia", "wnd_gaia", (0, 0), "land"),
               SpotDef("wnd_s_gaia_airship", "wnd_gaia", (2, 2), "landing"),
               # NW2-N (docs/NW2_EDITS_PLAN.md 7): the hike meadows, the Mirage's on the sands' north shore (191, 43),
               # Lufenia's on the mesa's east tip (243, 70); offsets from the (nudged) arrivals (182, 68), (218, 76)
               SpotDef("wnd_s_sky_airship", "wnd_mirage", MIRAGE_LANDING, "landing"),
               SpotDef("wnd_s_mirage_airship", "wnd_mirage", MIRAGE_LANDING, "landing"),
               SpotDef("wnd_s_lufenia_airship", "wnd_lufenia", LUFENIA_LANDING, "landing"),
               SpotDef("wnd_s_ship", "wnd_lufenia", (20, 16), "dock"),
               SpotDef("wnd_s_seam_landing", "wnd_gaia", (39, -10), "landing")],     # WR: grass by the east seam
        north=("wnd_gaia", "wnd_mirage", "wnd_lufenia"),
        hikes=[Hike("wnd_mirage", "wnd_s_mirage_airship"), Hike("wnd_lufenia", "wnd_s_lufenia_airship")],
    )


def content(g, meta, ctx) -> dict:
    """WIND's content on the generated ground (`wind/world_nw.py`, a RegionOut), for `world_content.merge`."""
    from wind import world_nw
    out = world_nw.content(g, meta, ctx.bundle)
    return {"objects": out.objects, "inspect": out.inspect, "npcs": out.npcs, "vehicles": out.vehicles,
            "ambient": out.ambient, "hazards": out.hazards, "encounterZones": out.zones,
            "backdrops": out.battleBackgrounds.get("zones") or {}, "checks": out.checks}
