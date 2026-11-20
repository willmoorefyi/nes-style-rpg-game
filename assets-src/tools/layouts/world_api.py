"""The world contract of pass W (docs/WORLD_PLAN.md 2.4-2.9): the 192x192 world map, its region boxes, edge bands,
seams, the frozen act-1 core, the basins, the allowed docks, the Aldi walls and the module dataclasses.

W1-0b declares the constants and dataclasses below (they are read only for every other tranche; a needed change goes
to the integrator). W1-C2 implements the composer logic in `world.py`. All coordinates are world cells unless a name
says `local` (act-1 cells, world = local + A1_ORIGIN). Every Rect is inclusive.
"""
from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass, field

Cell = tuple[int, int]

WORLD_W = WORLD_H = 192
CHUNK = 16                                   # cells per chunk side (the compiler's 2x chunks)
EDGE = 2                                     # band half-width: 2 cells on each side of a box edge
A1_ORIGIN: Cell = (64, 64)                   # the act-1 72x72 block moves from (0, 0) to here (D-W1)
A1_SIZE: Cell = (72, 72)
UNSET = " "                                  # a RegionOut.ground cell the region leaves to the composer
WATER, MOUNTAIN, GRASS = "o", "m", "."       # build_map.py LEGEND chars the composer writes


@dataclass(frozen=True)
class Rect:
    x0: int
    y0: int
    x1: int
    y1: int

    @property
    def w(self) -> int:
        return self.x1 - self.x0 + 1

    @property
    def h(self) -> int:
        return self.y1 - self.y0 + 1

    def contains(self, x: int, y: int) -> bool:
        return self.x0 <= x <= self.x1 and self.y0 <= y <= self.y1

    def cells(self) -> Iterator[Cell]:
        """Row-major, so every walk over a rect is deterministic."""
        for y in range(self.y0, self.y1 + 1):
            for x in range(self.x0, self.x1 + 1):
                yield x, y

    def shift(self, dx: int, dy: int) -> Rect:
        return Rect(self.x0 + dx, self.y0 + dy, self.x1 + dx, self.y1 + dy)

    def chunks(self) -> set[tuple[int, int]]:
        """(col, row) of every chunk the rect touches."""
        return {(c, r) for r in range(self.y0 // CHUNK, self.y1 // CHUNK + 1)
                for c in range(self.x0 // CHUNK, self.x1 // CHUNK + 1)}


@dataclass(frozen=True)
class Region:
    id: str
    prefix: str                              # entrance, zone, flag and patch ids start with `<prefix>_`
    rects: tuple[Rect, ...]
    owner: str                               # the O tranche that writes `layouts/world_<id>.py`


# 2.4: the boxes, 1 or 2 chunk-aligned rects each; together they tile the world (144 chunks, each in one region)
BOXES: dict[str, list[Rect]] = {
    "a1": [Rect(64, 64, 143, 143)],
    "elf": [Rect(48, 112, 63, 143), Rect(0, 144, 111, 191)],
    "earth": [Rect(0, 64, 63, 111), Rect(0, 112, 47, 143)],
    "fire": [Rect(144, 64, 191, 143), Rect(112, 144, 191, 191)],
    "ordeal": [Rect(64, 0, 127, 63)],
    "water": [Rect(0, 0, 63, 63)],
    "wind": [Rect(128, 0, 191, 63)],
}
PREFIXES = {"a1": "a1", "elf": "elf", "earth": "ert", "fire": "fir", "ordeal": "ord", "water": "wat", "wind": "wnd"}
OWNERS = {"a1": "A1-O", "elf": "ELF-O", "earth": "ERT-O", "fire": "FIR-O", "ordeal": "ORD-O", "water": "WAT-O",
          "wind": "WND-O"}
REGION_DEFS: dict[str, Region] = {r: Region(r, PREFIXES[r], tuple(BOXES[r]), OWNERS[r]) for r in BOXES}

# 2.5: the act-1 frozen core (local x 0-71, y 0-71) and the cells inside it that may change
FROZEN_CORE = Rect(A1_ORIGIN[0], A1_ORIGIN[1], A1_ORIGIN[0] + A1_SIZE[0] - 1, A1_ORIGIN[1] + A1_SIZE[1] - 1)


@dataclass(frozen=True)
class FrozenException:
    local: Rect                              # act-1 local cells
    allowed: str                             # "any", or "o>m" (ocean may become mountain, nothing else changes)
    owners: tuple[str, ...]
    about: str

    @property
    def world(self) -> Rect:
        return self.local.shift(*A1_ORIGIN)


# LM4-INT (user ruling 2026-11-19): Pravoka's world icon may grow and break the frozen act-1 core. It grew from 2x1
# (130-131, 100) to the approved 3x3 icon over PRAVOKA_ICON_CELLS; those cells changed (their objects, collision and
# art; the ground under them is unchanged: the headland rock at 130-131, 98-99 and the channel water at 132, 98-100).
# Every one of them already lies in X_pravoka (local x 58-71, y 26-44), so no rect grew; tests/quest/a1/frozenCore
# pins the icon to exactly these cells.
PRAVOKA_ICON_CELLS = Rect(130, 98, 132, 100)
FROZEN_EXCEPTIONS: dict[str, FrozenException] = {
    "X_pravoka": FrozenException(Rect(58, 26, 71, 44), "any", ("A1-T", "A1-O"),
                                 "Pravoka, its dock and its shore (A1-T: town icon and dock; A1-O: ground)"),
    "X_matoya": FrozenException(Rect(6, 8, 14, 16), "any", ("A1-O",), "Matoya's grove and cave"),
    "X_west": FrozenException(Rect(0, 14, 7, 20), "o>m", ("A1-O", "composer"),
                              "part of the Aldi's north-west wall; local x 0-1 is seam_w"),
    "X_east": FrozenException(Rect(64, 12, 71, 18), "o>m", ("A1-O",), "the north end of Pravoka's range"),
}


@dataclass(frozen=True)
class Seam:
    rect: Rect                               # band cells the composer fills
    fill: str                                # MOUNTAIN or GRASS
    joins: tuple[str, str]                   # the two regions it joins
    about: str


# 2.5: a mountain seam must touch a wall cell of each joined region; a grass seam a walkable cell of each
SEAMS: dict[str, Seam] = {
    "seam_w": Seam(Rect(62, 78, 65, 84), MOUNTAIN, ("earth", "a1"), "the Aldi's north-west wall"),
    "seam_n": Seam(Rect(48, 110, 61, 113), GRASS, ("earth", "elf"), "the dwarf hall can be walked to from Elfland"),
    "seam_s": Seam(Rect(110, 146, 113, 165), MOUNTAIN, ("elf", "fire"), "the Aldi's south wall"),
    "seam_se": Seam(Rect(138, 142, 141, 145), MOUNTAIN, ("a1", "fire"), "the Aldi's east wall"),
}

# 2.6: the two basins and their seeds (aldi: the act-1 ship spawn's cell below Cornelia's jetty, local (28, 57))
BASIN_SEEDS: dict[str, Cell] = {"aldi": (92, 121), "ocean": (2, 2)}
CANAL_PATCH = "canal"                        # EARTH's patch (flag CANAL_OPEN), the only link between the basins


@dataclass(frozen=True)
class DockSpec:
    basin: str
    region: str
    owner: str
    place: str


# 2.6: any other dock fails the verifier with `DOCK ... not allowed`
DOCKS_ALLOWED: dict[str, DockSpec] = {
    "a1_pravoka": DockSpec("aldi", "a1", "A1-T", "Pravoka's quay, in the channel between the mainland and the range "
                                                  "(world x 129-135)"),
    "elf_port": DockSpec("aldi", "elf", "ELF-O", "Elfheim's harbour on Elfland's north coast"),
    "ert_dwarf": DockSpec("aldi", "earth", "ERT-O", "the dwarves' landing on the isthmus's east coast"),
    "ert_melmond": DockSpec("ocean", "earth", "ERT-O", "Melmond's harbour on the western strait"),
    "fir_crescent": DockSpec("ocean", "fire", "FIR-O", "Crescent Lake's harbour on the outer channel (x 142-147)"),
}


@dataclass(frozen=True)
class Wall:
    regions: tuple[str, ...]                 # the regions whose modules return a part of it (RegionOut.walls)
    seams: tuple[str, ...]                   # the composer-owned seams that are part of it
    about: str


# 2.6: the five walls that close the Aldi (the act-1 peninsula and mainland close the north). The composer exports
# each as a named cell set (its seams plus the regions' parts) for the mutations (6.3 GT-13).
WALLS: dict[str, Wall] = {
    "W_west": Wall(("a1", "earth"), ("seam_w",), "X_west, seam_w and EARTH's isthmus stub (y 76-87, mountain)"),
    "W_isthmus": Wall(("earth",), (), "the isthmus from the canal strip south to seam_n"),
    "W_arm": Wall(("elf",), ("seam_n",), "ELF's north arm and Elfland's north coast"),
    "W_south": Wall(("fire",), ("seam_s",), "seam_s and the north-west cliffs of the south-east continent"),
    "W_east": Wall(("a1", "fire"), ("seam_se",), "seam_se, Pravoka's range (x 138-141, y 76-141), the A1 cells "
                                                  "x 136-137, y 76-82 that join X_east to it, and X_east"),
}


@dataclass(frozen=True)
class PlaceholderWall:
    wall: str                                # a WALLS key
    region: str                              # the region whose cells it fills
    rect: Rect
    fill: str                                # MOUNTAIN (GRASS next to the grass seam, so seam_n has walkable sides)


# 5.1: until a region's module is built (RegionOut.stub), the composer fills these cells along the wall's planned
# path, Water cells only (so on the act-1 core only o -> m, as X_west and X_east allow). None is in a band.
PLACEHOLDER_WALLS: list[PlaceholderWall] = [
    PlaceholderWall("W_west", "a1", FROZEN_EXCEPTIONS["X_west"].world, MOUNTAIN),
    PlaceholderWall("W_west", "earth", Rect(48, 76, 61, 87), MOUNTAIN),
    PlaceholderWall("W_isthmus", "earth", Rect(48, 88, 61, 108), MOUNTAIN),
    PlaceholderWall("W_isthmus", "earth", Rect(48, 109, 61, 109), GRASS),
    PlaceholderWall("W_arm", "elf", Rect(50, 114, 61, 114), GRASS),
    PlaceholderWall("W_arm", "elf", Rect(50, 115, 61, 147), MOUNTAIN),
    PlaceholderWall("W_arm", "elf", Rect(62, 146, 109, 147), MOUNTAIN),
    PlaceholderWall("W_south", "fire", Rect(114, 146, 137, 147), MOUNTAIN),
    PlaceholderWall("W_east", "fire", Rect(138, 146, 141, 147), MOUNTAIN),
    PlaceholderWall("W_east", "a1", FROZEN_EXCEPTIONS["X_east"].world, MOUNTAIN),
    PlaceholderWall("W_east", "a1", Rect(136, 76, 137, 82), MOUNTAIN),
    PlaceholderWall("W_east", "a1", Rect(138, 76, 141, 141), MOUNTAIN),
]


@dataclass
class RegionOut:
    """What a region module returns (QUEST 3.5, with the pass W deltas of 2.9). Coordinates are world cells inside
    the region's rects and outside its bands. `ground` holds the rows of the bounding box of the region's rects (legend
    chars); cells outside the rects and band cells are UNSET. The list fields carry map-source entries as in a map
    YAML (their keys are the map keys, hence the camelCase names)."""
    ground: list[str]
    objects: list[dict] = field(default_factory=list)
    npcs: list[dict] = field(default_factory=list)
    inspect: list[dict] = field(default_factory=list)
    transitions: list[dict] = field(default_factory=list)
    entrances: dict[str, list[int]] = field(default_factory=dict)       # names `<prefix>_<place>`
    keyItemGates: list[dict] = field(default_factory=list)              # noqa: N815
    patches: list[dict] = field(default_factory=list)
    docks: list[dict] = field(default_factory=list)                     # ids from DOCKS_ALLOWED
    hazards: list[dict] = field(default_factory=list)
    encounterZones: list[dict] = field(default_factory=list)            # noqa: N815
    vehicles: list[dict] = field(default_factory=list)
    ambient: list[dict] = field(default_factory=list)                   # looping field effects (LM-INT: smoke)
    battleBackgrounds: dict = field(default_factory=dict)               # noqa: N815 ({"zones": {...}})
    notes: list[str] = field(default_factory=list)
    checks: dict = field(default_factory=dict)       # the region's map-check options (road_check, river_check, ...)
    # 2.9 (new): {name: (cells, side_a_seed, side_b_seed)}, a named land barrier with one walkable seed on each side;
    # the composer checks the seeds are walkable and not joined on foot, and exports the barrier's minimal cut
    barriers: dict[str, tuple[set[Cell], Cell, Cell]] = field(default_factory=dict)
    # this region's parts of the Aldi walls (WALLS keys); a built region must return its parts (5.1)
    walls: dict[str, set[Cell]] = field(default_factory=dict)
    stub: bool = False                       # a stub module: the composer applies the region's PLACEHOLDER_WALLS
    # NW-1 (docs/NATURAL_WORLD_PLAN.md 5.2): named world places for quest.yaml, the scenarios and the cutscenes,
    # {`<prefix>_s_<name>`: {"at": [x, y], "kind": "land" | "dock" | "landing"}}
    spots: dict[str, dict] = field(default_factory=dict)
