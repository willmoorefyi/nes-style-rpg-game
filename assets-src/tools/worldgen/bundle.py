"""A region's spec bundle and the records `spec.py` lacks (docs/NATURAL_WORLD_PLAN.md 3.2, 3.3; NW-2).

Each `layouts/world_specs/<region>.py` builds one `RegionSpec`; the composer v2 (`layouts/world_v2.py`) merges the
seven in `world_api_v2.REGIONS` order (`merge`) and hands the result to `compose.compose`. Points follow `spec.py`'s
rule: **Cornelia-relative** new-world offsets (east +x, south +y), turned into world coordinates by `spec.poly` in the
generator. Only the act-1 template (`Template`) holds world rasters, and `sites` hold world cells.

A corridor or road end may also be an entrance name (a string): the composer resolves it to the site's cell.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .spec import (Cell, ClimateHint, Continent, Corridor, IsleField, Pass, Point, Ridge, Road, WallLine)


@dataclass(frozen=True)
class Cone:
    """A volcanic peak (relief): a round Gaussian of `height`, `width` cells (Gurgu)."""
    at: Point
    height: float
    width: float


@dataclass(frozen=True)
class SeaLine:
    """Forced open water along a polyline (shape): a soft carve of `radius` + 6 round a hard core. `fjord`: the line
    also wins over the wall lines, except the core of `keep_wall` (Pravoka's outer fjord against W_east)."""
    points: tuple[Point, ...]
    radius: float
    fjord: bool = False
    keep_wall: str = ""


@dataclass(frozen=True)
class SeaDisc:
    centre: Point
    radius: float


@dataclass(frozen=True)
class InlandSea:
    """A basin's open water (the Aldi): forced sea inside the polygon, outside the act-1 template's land."""
    name: str
    polygon: tuple[Point, ...]


@dataclass(frozen=True)
class Lake:
    centre: Point
    radius: float
    name: str = ""


@dataclass(frozen=True)
class Barrier:
    """A named barrier ridge (world_api_v2.BARRIERS): forced high ground within `base` + `rn` x ridged noise of the
    line. `warped`: the line takes the shared line wobble (the spine does not)."""
    name: str
    points: tuple[Point, ...]
    base: float = 1.7
    rn: float = 1.0
    warped: bool = True


@dataclass(frozen=True)
class Dock:
    """A dock (world_api_v2.DOCKS_ALLOWED id) at a Cornelia-relative cell, its basin, the entrance it serves; `cove`:
    open the water from the dock away from that entrance (8 cells at most) until the basin's forced sea."""
    id: str
    at: Point
    basin: str
    town: str
    cove: bool = True


@dataclass(frozen=True)
class SpotDef:
    """A spot (5.2) placed relative to a base: an entrance name, a dock id, or "" (then `offset` is an absolute
    world cell). The composer resolves it to the nearest cell of its kind (`spots.resolve`)."""
    name: str
    base: str
    offset: Cell
    kind: str


@dataclass
class Template:
    """Act 1's template (3.6, NW-0): today's outline and the cells copied from today's world, in world rasters."""
    land: np.ndarray                         # today's act-1 land, placed by A1_DELTA
    keep: np.ndarray                         # cells whose chars are copied (the pins and stamps of 3.6.2)
    keepch: np.ndarray                       # today's chars, placed (every cell; read where `keep`)
    sound: tuple[Point, ...]                 # the sound's centre line (forced sea < 1.3, protected < 2.5)
    channel: tuple[int, int, int, int]       # Pravoka's channel rect (world x0, y0, x1, y1): forced Water
    channel_wall: str                        # the wall whose core the channel's jagged east edge never cuts
    warp: float = 0.25                       # share of the continent warp the template outline takes
    road_keep: tuple[Cell, float] = ((0, 0), 0.0)   # today's roads are kept only in this disc (Cornelia's gates)
    icons: tuple[Cell, ...] = ()             # icon cells (exempt, 0.1.1)
    exempt: tuple[Cell, ...] = ()            # the bridge, the footbridge, the jetty (exempt)
    bridge: tuple[Cell, ...] = ()            # the north bridge patch cells (the first 4 are the gap rows)
    seed_cell: Cell = (0, 0)                 # the Aldi seed (world_api_v2.BASIN_SEEDS["aldi"])


@dataclass
class RegionSpec:
    region: str
    continents: list[Continent] = field(default_factory=list)
    ridges: list[Ridge] = field(default_factory=list)
    barriers: list[Barrier] = field(default_factory=list)
    walls: list[WallLine] = field(default_factory=list)
    passes: list[Pass] = field(default_factory=list)
    cones: list[Cone] = field(default_factory=list)
    sea_lines: list[SeaLine] = field(default_factory=list)
    sea_discs: list[SeaDisc] = field(default_factory=list)
    inland_seas: list[InlandSea] = field(default_factory=list)
    lakes: list[Lake] = field(default_factory=list)
    routes: dict[str, tuple[Point, ...]] = field(default_factory=dict)
    isles: list[IsleField] = field(default_factory=list)
    isle_sites: dict[str, tuple[float, float]] = field(default_factory=dict)   # entrance -> (radius, wobble)
    climate: list[ClimateHint] = field(default_factory=list)
    sites: dict[str, Cell] = field(default_factory=dict)          # entrance -> world cell
    towns: tuple[str, ...] = ()
    docks: list[Dock] = field(default_factory=list)
    corridors: list[Corridor] = field(default_factory=list)
    dock_links: tuple[str, ...] = ()        # corridors forced to land (a dock's walk to its town)
    roads: list[Road] = field(default_factory=list)
    spots: list[SpotDef] = field(default_factory=list)
    canal: tuple[tuple[int, ...], tuple[int, int]] | None = None  # (rel rows, rel x range) of the canal patch
    template: Template | None = None
    north: tuple[str, ...] = ()             # airship-only anchors (3.8 `landings`)
    ledges: tuple[str, ...] = ()            # canoe-only sites: a ledge on their pinned route (4.1, `stamps.ledges`)
    # 3.8 `barriers`: barrier -> (seed entrance, [entrances beyond], closed by canoe too, cut by the bridge patch)
    barrier_seeds: dict[str, tuple[str, tuple[str, ...], bool, bool]] = field(default_factory=dict)
    links: dict[str, tuple[str, str]] = field(default_factory=dict)   # pairs that must join on foot (patches on)


def empty_template(n: int = 256) -> Template:
    """No act-1 template (the selftests' synthetic worlds): no kept cells, no sound, no channel."""
    return Template(land=np.zeros((n, n), bool), keep=np.zeros((n, n), bool), keepch=np.full((n, n), "o"), sound=(),
                    channel=(0, 0, -1, -1), channel_wall="", road_keep=((0, 0), 0.0), seed_cell=(2, 2))


def merge(specs: list[RegionSpec]) -> RegionSpec:
    """One bundle of every region's records, in the order given (world_api_v2.REGIONS)."""
    out = RegionSpec(region="world")
    for s in specs:
        for f in ("continents", "ridges", "barriers", "walls", "passes", "cones", "sea_lines", "sea_discs",
                  "inland_seas", "lakes", "isles", "climate", "docks", "corridors", "roads", "spots"):
            getattr(out, f).extend(getattr(s, f))
        for f in ("routes", "isle_sites", "sites", "barrier_seeds", "links"):
            getattr(out, f).update(getattr(s, f))
        out.towns += s.towns
        out.dock_links += s.dock_links
        out.north += s.north
        out.ledges += s.ledges
        out.canal = out.canal or s.canal
        out.template = out.template or s.template
    return out


__all__ = ["Barrier", "Cone", "Dock", "InlandSea", "Lake", "RegionSpec", "SeaDisc", "SeaLine", "SpotDef", "Template",
           "empty_template", "merge", "Cell", "ClimateHint", "Continent", "Corridor", "IsleField", "Pass", "Ridge",
           "Road", "WallLine"]
