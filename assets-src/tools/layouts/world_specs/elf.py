"""ELF's continent spec (docs/NATURAL_WORLD_PLAN.md 2.3; NW-0's pilot, preset B; tuned by NW-R ELF).

Design note (NW-R ELF).
- Concept: Elfland, the Aldi's south shore: a broad lobed continent between the inner sea and the southern ocean.
  Its north-west arm climbs to the Western Keep's crag above a tarn, where it meets the dwarves' isthmus (wall W_arm
  closes the Aldi there); the low fells run east-west across its middle with the elves' forest heartland on their
  wet south flank; the east fells and the march (a rock spine from W_south down to the southern sea) wall it from
  the volcanic land; the marsh lies in the south-west delta, a lobed fen round three wet hints, with two firths
  biting into the south coast and an archipelago of grass isles off it (the second archipelago of 0.1).
- Sites (world-anchors.yaml targets, no nudge): Elfheim's gate (132, 196) on the harbour plain south of `elf_port`,
  its approved 3x3 icon below the gate; the Western Keep (105, 176) on its crag with the slate watchtower; the
  Marsh Cave (98, 220) in the fen. The king's road runs from Elfheim's gate north-west by the harbour bay, round the
  fells and up the arm to the Keep, with a branch south-west through the fen to the cave; the waystone stands
  beside it a third of the way to the Keep. Content: `elf/world_nw.py`; zones: `elf/world_nw_zones.py` (today's ids
  and rosters).
- Gates: S4-S9 walk from `elf_port` (the corridors keep the walks under mountain height; prewalk proves them).
  `--worst-canoe` row T2 (NW-4): a one-cell FIRE river on the seam (x 164, y 192-205) gave an early canoe from
  Elfland a way to Crescent and the south lands. The march ridge closes it: rock between Elfland's walkable land
  and the seam river from W_south to the sea. A strait there (the first try) closed it too but refilled the westerly
  moisture sweep, which shrank FIRE's Lykion desert by 40 %; the ridge leaves FIRE's climate as it was.
- Coast: the firths, the isles and the fjord warp raise ELF's coast index from 8.1 to about 10.5 (reported, not
  gated). The per-continent knobs (`detail`, `finger`) were tried (12.7) and dropped: the sweep carries Elfland's
  coast changes east along every row into FIRE (its desert shrank by a fifth).
"""
from __future__ import annotations

from worldgen.bundle import (ClimateHint, Continent, Corridor, Dock, IsleField, RegionSpec, Ridge, SeaLine, SpotDef,
                             WallLine)

from .common import sites

ELFLAND = ((-52, 15), (-44, 16), (-38, 19), (-32, 25), (-24, 31), (-16, 36), (-8, 35), (0, 37), (8, 36), (16, 34),
           (22, 34), (20, 42), (14, 50), (8, 58), (-2, 64), (-14, 70), (-28, 74), (-42, 77), (-54, 74), (-62, 66),
           (-64, 54), (-61, 42), (-58, 32), (-55, 22))
PORT = (-12, 33)


def spec() -> RegionSpec:
    return RegionSpec(
        region="elf",
        continents=[Continent("elfland", "elf", ELFLAND, fjord=0.5)],
        ridges=[Ridge(((-36, 44), (-20, 50), (-4, 50)), 0.55, 2.5, "the low fells"),
                Ridge(((6, 42), (12, 50)), 0.7, 2.6, "the east fells"),
                Ridge(((13, 38), (14, 45), (14.5, 52)), 0.9, 1.6, "the march")],
        walls=[WallLine("W_arm", ((-49, 10), (-48, 19), (-42, 24), (-34, 28)))],
        sea_lines=[SeaLine(((-38, 84), (-41, 75), (-45, 69)), 1.0), SeaLine(((-20, 80), (-23, 72), (-25, 67)), 1.0)],
        isles=[IsleField((-22, 88), 12, 4, 106), IsleField((-60, 88), 12, 5, 109)],
        climate=[ClimateHint("wet", (-47, 61), 6), ClimateHint("wet", (-41, 67), 6), ClimateHint("wet", (-51, 68), 5),
                 ClimateHint("wet", (-24, 49), 10)],
        sites=sites("elf"),
        towns=("elf_elfheim",),
        docks=[Dock("elf_port", PORT, "aldi", "elf_elfheim")],
        corridors=[Corridor("elf_port", (PORT, (-12, 36), "elf_elfheim")),
                   Corridor("elf_keep", ("elf_elfheim", (-26, 38), (-36, 30), "elf_keep")),
                   Corridor("elf_marsh", ("elf_elfheim", (-24, 50), (-38, 60), "elf_marsh"))],
        dock_links=("elf_port",),
        spots=[SpotDef("elf_s_keep", "elf_keep", (0, 0), "land"),
               SpotDef("elf_s_elfheim", "elf_elfheim", (0, 0), "land"),
               SpotDef("elf_s_port_ship", "dock:elf_port", (0, 0), "dock")],
    )


def content(g, meta, ctx) -> dict:
    """ELF's content on the composed ground (`layouts/elf/world_nw.py`, NW-R ELF) for `world_v2_content.merge`: its
    `zones` are the encounter zones, its `region` record (`checks`, `land`) joins `regions.elf`."""
    from elf import world_nw
    c = dict(world_nw.content(g, meta, ctx.doors))
    c["encounterZones"] = c.pop("zones", [])
    return c
