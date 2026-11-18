"""The runner for Elfheim's rooms (docs/WORLD_PLAN.md 4.2; ELF-T): the six homes, the five shops and the inn, and
the castle's hall, the prince's chamber and the vault -> assets-src/maps/elfheim-*.yaml. Every generated header names
this script, the one to run:

  python3 -I assets-src/tools/layouts/elf/town_elfheim_rooms.py && python3 -I assets-src/tools/build_map.py <ids>
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import town_elfheim_castle  # noqa: E402
import town_elfheim_homes  # noqa: E402
import town_elfheim_shops  # noqa: E402

if __name__ == "__main__":
    for p in [*town_elfheim_homes.build(), *town_elfheim_shops.build(), *town_elfheim_castle.build()]:
        print(p)
