"""Melmond's interiors (docs/WORLD_PLAN.md 4.0.1, 4.3; ERT-T) -> assets-src/maps/melmond-house-*.yaml (unne, miller,
vintner, ploughman, healer), the five shops and the inn.

  python3 -I assets-src/tools/layouts/earth/town_melmond_interiors.py && python3 -I assets-src/tools/build_map.py \
      melmond-house-unne melmond-inn

The plans live in `town_melmond_homes.py` and `town_melmond_shops.py` (`interiors_common.Town("melmond")`); every
generated header names this script, the one to run.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parent))
import town_melmond_homes  # noqa: E402
import town_melmond_shops  # noqa: E402

if __name__ == "__main__":
    for p in [*town_melmond_homes.build(), *town_melmond_shops.build()]:
        print(p)
