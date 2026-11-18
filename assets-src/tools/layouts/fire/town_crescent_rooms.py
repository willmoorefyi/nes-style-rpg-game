"""Crescent Lake's interiors (docs/WORLD_PLAN.md 4.0.1, 4.4; FIR-T) -> assets-src/maps/crescent-house-*.yaml, the five
crescent-*-shop / -magic maps and crescent-inn.

  python3 -I assets-src/tools/layouts/fire/town_crescent_rooms.py && python3 -I assets-src/tools/build_map.py <ids>

Every exit returns to the cell in front of the door it was entered by (`town_crescent.py` names the houses
`house_<slug>`, the shops and the inn by their canon entrance names). The plans live in `town_crescent_homes.py` and
`town_crescent_shops.py`; every generated header names this script, the one to run.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import town_crescent_homes  # noqa: E402
import town_crescent_shops  # noqa: E402

for p in [*town_crescent_homes.build(), *town_crescent_shops.build()]:
    print(p)
