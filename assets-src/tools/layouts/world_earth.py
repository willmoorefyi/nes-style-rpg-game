"""Region EARTH of the world (docs/WORLD_PLAN.md 2.4, 2.6, 2.9, 4.3; ERT-O): the Duergar isthmus (the dwarves, the
canal) and the western continent (Melmond, the Cavern of Earth, the giant's tunnel, Sarda).

The ground is `earth/world_earth_ground.py`, the places, zones, walls and the barrier `earth/world_earth_sites.py`;
Melmond's icon, gate and harbour are ERT-T's `earth/town_melmond_site.py`. The region returns its two Aldi walls
(W_west's isthmus stub, W_isthmus), the real canal patch (flag CANAL_OPEN) and the barrier `western_range` (Melmond's
plain to Sarda's coast, crossed only by the giant's tunnel map). The site maps (`dwarf-hall`, `giant-tunnel`,
`sage-cave`) are written by `earth/dwarf.py`, `earth/giant.py` and `earth/sage.py`.

Design note (WORLD 4.0.4). Concept: a dwarf-held hogback walling the Aldi and, across a narrow strait, a dying
farm continent cut in two by a single unbroken range. Distinct: the canal saddle is a grass pass between the
hogback and the dwarves' downs, not a mine; the landing is a cove under the hall's ridge on the Aldi side; the range
runs sea-cliff to sea-cliff, so Sarda's coast is a sealed sliver reached only through the tunnel map; the Cavern of
Earth opens in the south face of a rock table in sand badlands. Topology: overworld -> dwarf-hall (one door);
overworld east mouth -> giant-tunnel -> west mouth -> Sarda's coast -> sage-cave; Melmond and the Cavern's B1 by their
doors.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "earth"))
import world_earth_ground as G  # noqa: E402
import world_earth_sites as S  # noqa: E402
from world_api import BOXES, UNSET, Cell, RegionOut  # noqa: E402
from world_geom import bbox  # noqa: E402


def build(band: set[Cell]) -> RegionOut:
    g = G.ground(band)
    b = bbox(BOXES["earth"])
    rows = ["".join(g.get((x, y), UNSET) for x in range(b.x0, b.x1 + 1)) for y in range(b.y0, b.y1 + 1)]
    box = {c for r in BOXES["earth"] for c in r.cells()}
    checks = {"min_blob": {"mountain": 3, "sand": 3, "forest": 3, "ocean_inlet": 2}, "warp_leaves": True,
              # Sarda's coast is walked from the tunnel's west mouth (the range parts it from every other root)
              "reach_roots": ["ert_dwarf", "ert_melmond", "ert_giant_west"]}
    return RegionOut(
        ground=rows, objects=S.objects(g), inspect=S.inspect(), transitions=S.transitions(),
        entrances={k: list(v) for k, v in S.ENTRANCES.items()}, patches=[S.canal()], docks=S.docks(),
        encounterZones=S.zones(g, band, box), battleBackgrounds={"zones": dict(S.BACKDROPS)}, checks=checks,
        walls=S.walls(g), barriers=S.barriers(g),
        notes=["EARTH: the isthmus, the canal saddle, the western range (ERT-O)"])
