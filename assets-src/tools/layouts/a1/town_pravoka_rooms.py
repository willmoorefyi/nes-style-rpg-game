"""Pravoka's interiors (docs/WORLD_PLAN.md 4.0.1, 4.1; A1-T) -> assets-src/maps/pravoka-house-*.yaml, the five
pravoka-*-shop / -magic maps and pravoka-inn.

  python3 -I assets-src/tools/layouts/a1/town_pravoka_rooms.py && python3 -I assets-src/tools/build_map.py <ids>

Every exit returns to the cell in front of the door it was entered by (`town_pravoka.py` names the houses
`house_<slug>`, the shops and the inn by their canon entrance names). The plans live in `town_pravoka_homes.py` and
`town_pravoka_shops.py`; every generated header names this script, the one to run.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import town_pravoka_homes  # noqa: E402
import town_pravoka_shops  # noqa: E402

for p in [*town_pravoka_homes.build(), *town_pravoka_shops.build()]:
    print(p)
