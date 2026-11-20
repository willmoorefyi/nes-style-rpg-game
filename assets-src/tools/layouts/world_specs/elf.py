"""ELF's continent spec (docs/NATURAL_WORLD_PLAN.md 2.3; NW-0's pilot, preset B; NW-R ELF tunes it).

Elfland: a lobed continent on the Aldi's south shore, its long north-west arm the Western Keep's cape (wall W_arm),
low fells in the east toward W_south, the marsh in a wet lowland round the south-west delta, an island group off the
south coast. Elfheim's harbour (`elf_port`) is on the north coast.
"""
from __future__ import annotations

from worldgen.bundle import ClimateHint, Continent, Corridor, Dock, IsleField, RegionSpec, Ridge, SpotDef, WallLine

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
                Ridge(((6, 42), (12, 50)), 0.7, 2.6, "the east fells")],
        walls=[WallLine("W_arm", ((-49, 10), (-48, 19), (-42, 24), (-34, 28)))],
        isles=[IsleField((-22, 88), 12, 4, 106)],
        climate=[ClimateHint("wet", (-46, 64), 12)],
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
