"""The world contract of pass NW, v2 (docs/NATURAL_WORLD_PLAN.md 3.2, 3.3, 0.1.1, 2.2; NW-1).

v2 is declared beside v1 (`world_api.py`, pass W's 192x192 boxed world, which `mainline` still builds). Nothing of
today's world reads this module: the NW generator (`assets-src/tools/worldgen/`, NW-2) and the composer v2 do, and NW-5
deletes v1. It is self-contained on purpose (no import from v1), so v1 can go without touching it.

What v2 drops from v1: `BOXES`, `SEAMS`, `EDGE`, `PLACEHOLDER_WALLS`, `A1_ORIGIN`, `A1_SIZE`, `FROZEN_CORE`,
`FROZEN_EXCEPTIONS` and `PRAVOKA_ICON_CELLS` (no region boxes, no act-1 frame: act 1's cells are world cells, pinned
relative to Cornelia, 3.6). Regions own content, not ground: a `RegionOut` v2 has no `ground` rows. The NW integrator
owns this file; a region that needs a constant changed asks the integrator (3.5).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:                            # the generator's records (worldgen/spec.py imports this module)
    from worldgen.spec import Pin, Route, Stamp

Cell = tuple[int, int]

WORLD_W = WORLD_H = 256                      # D-NW1 (user ruling 2026-11-20): 16 x 16 = 256 chunks
CHUNK = 16                                   # cells per chunk side (the compiler's 2x chunks)
WATER, MOUNTAIN, GRASS = "o", "m", "."       # build_map.py LEGEND chars the composer writes
TUNDRA, SNOW = "t", "n"                      # D-NW9 (2.6): the airship lands on tundra, never on snow

# 2.2: Cornelia's south-gate arrival in the new world (fixed by NW-0) and the act-1 delta from today's world. An act-1
# pin sits at CORNELIA_NW + (p_today - CORNELIA_TODAY); every other anchor's target is CORNELIA_NW + S_STAR x ref.
CORNELIA_NW: Cell = (146, 155)
CORNELIA_TODAY: Cell = (92, 111)
A1_DELTA: Cell = (CORNELIA_NW[0] - CORNELIA_TODAY[0], CORNELIA_NW[1] - CORNELIA_TODAY[1])     # (+54, +44)
S_STAR = 0.86                                # cells per classic tile (D-NW1; today 0.735)

REGIONS = ("a1", "elf", "earth", "fire", "ordeal", "water", "wind")     # tie-break order (owner grid, 3.4)
PREFIXES = {"a1": "a1", "elf": "elf", "earth": "ert", "fire": "fir", "ordeal": "ord", "water": "wat", "wind": "wnd"}
NORTH_REGIONS = ("water", "ordeal", "wind")  # 3.8 `north`: their walk+canoe components hold only their own cells

# 0.1.1 G-NW2 (D-NW11, preset B measured 30.6 in NW-0): the whole-world coast index gate
G2_MIN = 30.0
G1_MAX_RUN = 6                               # G-NW1 / G-NW3: a straight run longer than this fails (unless exempt)
EXEMPT_KINDS = ("quay", "dock", "canal", "bridge", "icon")    # 0.1.1: the stamp kinds whose cells (+ ring) are exempt
STAMP_KINDS = EXEMPT_KINDS + ("pond", "rock")                 # 3.3: every kind a region's stamp may have
EXEMPT_CAP = 600                             # 0.1.1: the exemption list may hold at most this many cells
LAND_TARGET = (26_000, 31_800)               # D-NW12: preset B's 28,874 land cells +- 10 %
SPOT_KINDS = ("land", "dock", "landing")     # 5.2: a spot's kind (walkable, Water, a landing cell)

# 3.8 `basins`: the two seas and their seeds (aldi: the cell below Cornelia's jetty, today (92, 121) + A1_DELTA)
BASIN_SEEDS: dict[str, Cell] = {"aldi": (146, 165), "ocean": (2, 2)}
CANAL_PATCH = "canal"                        # EARTH's patch (flag CANAL_OPEN), the only link between the basins


@dataclass(frozen=True)
class DockSpec:
    basin: str
    region: str
    place: str


# 4.1: the same ids as pass W; each dock cell is a pin on a natural cove. Any other dock fails `docks` (3.8).
DOCKS_ALLOWED: dict[str, DockSpec] = {
    "a1_pravoka": DockSpec("aldi", "a1", "Pravoka's quay, in the channel between the mainland and its range"),
    "elf_port": DockSpec("aldi", "elf", "Elfheim's harbour on Elfland's north coast"),
    "ert_dwarf": DockSpec("aldi", "earth", "the dwarves' landing on the isthmus's Aldi side"),
    "ert_melmond": DockSpec("ocean", "earth", "Melmond's harbour on the western strait"),
    "fir_crescent": DockSpec("ocean", "fire", "Crescent Lake's harbour on the outer fjord"),
}


@dataclass(frozen=True)
class WallLine:
    region: str                              # the region whose spec draws the line (`world_specs/<region>.py`)
    about: str


# 4.1: the five wall lines that close the Aldi, by id. Each is forced land in the shape stage and a ridge in relief;
# the `walls` check (3.8) wants it unbroken land >= 3 cells wide with no water across, and exports it as world.cuts.
WALLS: dict[str, WallLine] = {
    "W_west": WallLine("earth", "the mainland's west headland to the isthmus's north end"),
    "W_isthmus": WallLine("earth", "the hogback along the isthmus (the canal saddle is its one pass)"),
    "W_arm": WallLine("elf", "Elfland's north coast to the Western Keep's cape"),
    "W_south": WallLine("fire", "Elfland's east fells to the volcanic arc, a mountain neck"),
    "W_east": WallLine("a1", "Pravoka's range, from the mainland to the south-east's rock neck"),
}
# 3.8 `barriers`: the named ridge or ring barriers (seeds and the minimal cut are derived by the composer)
BARRIERS = ("spine", "western_range", "crescent_ring")
CANOE_BARRIERS = ("spine", "western_range")  # also closed on foot plus canoe; crescent_ring is closed on foot only


@dataclass
class RegionOut:
    """What a region module returns in pass NW (3.3). No `ground`: the generator paints the whole world from the
    region's `spec`; the region places its content on it. The list fields carry map-source entries as in a map YAML
    (their keys are the map keys, hence the camelCase names). Coordinates are world cells."""
    spec: list = field(default_factory=list)                            # worldgen.spec Continent / Ridge / ... records
    pins: list[Pin] = field(default_factory=list)
    stamps: list[Stamp] = field(default_factory=list)
    routes: list[Route] = field(default_factory=list)
    corridors: dict[str, list[Cell]] = field(default_factory=dict)      # 2.4 rule 4b: polylines, 3 cells wide
    roads: dict[str, list[Cell]] = field(default_factory=dict)          # 2.4 rule 8: ordered road ends
    # 5.2: {`<prefix>_s_<name>`: {"at": [x, y], "kind": SPOT_KINDS, "reason": str}}; each is also a pin
    spots: dict[str, dict] = field(default_factory=dict)
    objects: list[dict] = field(default_factory=list)
    npcs: list[dict] = field(default_factory=list)
    inspect: list[dict] = field(default_factory=list)
    transitions: list[dict] = field(default_factory=list)
    entrances: dict[str, list[int]] = field(default_factory=dict)       # names `<prefix>_<place>`
    keyItemGates: list[dict] = field(default_factory=list)              # noqa: N815
    patches: list[dict] = field(default_factory=list)
    docks: list[dict] = field(default_factory=list)                     # ids from DOCKS_ALLOWED
    hazards: list[dict] = field(default_factory=list)
    # 3.3: named zone areas (a polygon, a biome of the region's land, or the cells near a spec feature); the owner
    # grid turns them into `row_rects` after the ground is built
    zones: list[dict] = field(default_factory=list)
    vehicles: list[dict] = field(default_factory=list)
    ambient: list[dict] = field(default_factory=list)
    battleBackgrounds: dict = field(default_factory=dict)               # noqa: N815 ({"zones": {...}})
    notes: list[str] = field(default_factory=list)
    checks: dict = field(default_factory=dict)       # the region's map-check options (road_check, river_check, ...)
    # 3.3: a barrier is a ridge or ring id (BARRIERS) plus one walkable seed on each side
    barriers: dict[str, tuple[Cell, Cell]] = field(default_factory=dict)
    walls: tuple[str, ...] = ()                      # the WALLS ids this region's spec draws
