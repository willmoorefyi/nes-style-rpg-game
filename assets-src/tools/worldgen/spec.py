"""The continent-spec records of the NW generator and the reference-to-world transform (docs/NATURAL_WORLD_PLAN.md
3.1, 3.2, 2.2, 2.4, 3.10; NW-1).

A region's spec (`layouts/world_specs/<region>.py`, NW-2 / NW-R) is a list of these records. Points are given
**relative to Cornelia's south-gate arrival** in new-world cells (east +x, south +y), as NW-0's pilot spec wrote them;
`world()` turns them into world cells. Three kinds of place, three rules (2.2):

- a site anchor's target is `CORNELIA_NW + S_STAR x ref` (`ref` in classic tiles from `world-anchors.yaml`), `target()`;
- an act-1 pin keeps today's cell relative to Cornelia, `a1_pin()` (`p_today + A1_DELTA`);
- any other spec point is a new-world offset from Cornelia, `world()`.

`PRESETS` are NW-0's three coast presets; the user picked **B (classic)** (D-NW11), so `PRESET` is B and the world seed
`SEED` 1987 (3.10). NW-2 reproduces B's pilot metrics from these at that seed.
"""
from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "layouts"))
from world_api_v2 import A1_DELTA, CORNELIA_NW, S_STAR, WORLD_H, WORLD_W, Cell  # noqa: E402

Point = tuple[float, float]


@dataclass(frozen=True)
class Preset:
    """The coast knobs of 3.10 (amplitudes in cells unless noted)."""
    warp: float            # continent-scale domain warp amplitude
    swarp: float           # small-scale second warp (fjords, fingers)
    coast: float           # fbm amplitude on the polygon distance
    mid: float             # mid-scale bay and cape amplitude
    detail: float          # coast-only detail amplitude (faded inland)
    finger: float          # peninsula / finger strength
    fjord: float           # fjord carving on high-relief coasts
    grow: float            # polygon growth (land amount)
    isles: float           # island density multiplier
    a1: float              # coast roughness on act 1's spec polygon (kept low near its pins)


PRESETS: dict[str, Preset] = {
    "A_calm": Preset(warp=9, swarp=3.0, coast=9, mid=8, detail=12, finger=6, fjord=3.0, grow=6.5, isles=0.7, a1=0.25),
    "B_classic": Preset(warp=12, swarp=6.0, coast=12, mid=14, detail=22, finger=14, fjord=9.0, grow=6.5, isles=1.0,
                        a1=0.35),
    "C_rugged": Preset(warp=15, swarp=8.0, coast=15, mid=18, detail=30, finger=20, fjord=14.0, grow=6.5, isles=1.4,
                       a1=0.45),
}
PRESET = PRESETS["B_classic"]                # D-NW11 (user ruling 2026-11-20)
SEED = 1987                                  # the world seed of preset B (NW-0)


# ── the records (3.2); every polyline / polygon is a list of Cornelia-relative points ──

@dataclass(frozen=True)
class Continent:
    """A landmass: a control polygon whose warped signed distance (2.4 rule 1) makes its coast."""
    name: str
    region: str                              # the owner region (a continent may hold two, split by `owner_line`)
    polygon: tuple[Point, ...]
    fjord: float = 0.0                       # extra fjord warp on this coast (x Preset.fjord)
    owner_line: tuple[Point, ...] = ()       # the line that splits it between two regions (3.4: Pravoka's neck)
    owner_beyond: str = ""                   # the region on the far side of `owner_line`
    knobs: dict[str, float] = field(default_factory=dict)   # per-continent detail / finger / fjord (NW-2, 3.10)


@dataclass(frozen=True)
class Ridge:
    """A ridgeline (2.4 rule 3): Gaussian falloff of `width` cells, `height` in elevation units."""
    points: tuple[Point, ...]
    height: float
    width: float
    name: str = ""                           # a named barrier ridge (world_api_v2.BARRIERS) or ""


@dataclass(frozen=True)
class WallLine:
    """An Aldi wall (world_api_v2.WALLS id): forced land along the polyline, made mountain by its ridge."""
    id: str
    points: tuple[Point, ...]
    wobble: float = 1.0                      # x the line wobble (W_east, Pravoka's range, takes half: NW-0)


@dataclass(frozen=True)
class Pass:
    """A low point on a ridge (2.4 rule 3): the canal saddle on the hogback."""
    at: Point
    radius: float
    name: str = ""


@dataclass(frozen=True)
class Corridor:
    """A walking corridor of 2.4 rule 4b: 3 cells wide; unpinned rivers cross it only at a ford (at most 2)."""
    name: str
    points: tuple[Point, ...]
    width: int = 3
    max_fords: int = 2


@dataclass(frozen=True)
class Road:
    """A routed road (2.4 rule 8): A* between its ordered ends on the generated ground."""
    name: str
    ends: tuple[Point, ...]


@dataclass(frozen=True)
class ClimateHint:
    """A disc that pushes the climate (2.4 rule 5): `arid`, `wet` or `mild`."""
    kind: str
    centre: Point
    radius: float


@dataclass(frozen=True)
class IsleField:
    """Islands seeded inside a disc (2.4 rule 2): `count` islets of at least 8 cells, straits >= 3 cells."""
    centre: Point
    radius: float
    count: int
    seed: int
    owner: str = ""                          # a region the field's land always belongs to (Cardia: ordeal)


@dataclass
class Pin:
    """A world cell and the material it must have, with a clearing radius the relief flattens round it (2.4 rule 7)."""
    at: Cell
    material: str
    clear: int = 0
    about: str = ""


@dataclass
class Stamp:
    """A small ground override inside a region's pins (3.3): a world_api_v2.STAMP_KINDS kind, cells -> legend char."""
    kind: str
    cells: dict[Cell, str]
    about: str = ""


@dataclass
class Route:
    """A pinned canoe route (2.4 rule 4): its ends and the cells it may use; its valley is carved before the flow."""
    name: str
    ends: tuple[Cell, Cell]
    cells: list[Cell] = field(default_factory=list)


# ── the transform (2.2) ──

def world(p: Point) -> Cell:
    """A Cornelia-relative new-world point -> its world cell (Python round(), as the pilot)."""
    return (_round(CORNELIA_NW[0] + p[0]), _round(CORNELIA_NW[1] + p[1]))


def target(ref: Point, s_star: float = S_STAR) -> Cell:
    """A site anchor's target: CORNELIA_NW + s* x ref (`ref` in classic tiles from Cornelia)."""
    return (_round(CORNELIA_NW[0] + s_star * ref[0]), _round(CORNELIA_NW[1] + s_star * ref[1]))


def a1_pin(today: Cell) -> Cell:
    """An act-1 cell of today's world -> its pin: today's place relative to Cornelia, kept (3.6.2)."""
    return (today[0] + A1_DELTA[0], today[1] + A1_DELTA[1])


def poly(points: tuple[Point, ...] | list[Point]) -> list[Point]:
    """A Cornelia-relative polyline or polygon in (unrounded) world coordinates, for the signed-distance fields."""
    return [(CORNELIA_NW[0] + x, CORNELIA_NW[1] + y) for x, y in points]


def on_map(c: Cell, margin: int = 0) -> bool:
    return margin <= c[0] < WORLD_W - margin and margin <= c[1] < WORLD_H - margin


def _round(v: float) -> int:
    """Python's round() as the pilot used it (banker's rounding on .5); kept so NW-2 reproduces NW-0's cells."""
    return round(v)
