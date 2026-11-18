"""Gaia's rooms (docs/WORLD_PLAN.md 4.0.1, 4.7; WND-T) -> assets-src/maps/gaia-house-*.yaml (windmiller, ropemaker,
spinner, healer, beekeeper, shepherd), the five shops, the inn and the spring (`gaia-spring`).

  python3 -I assets-src/tools/layouts/wind/town_gaia_interiors.py && python3 -I assets-src/tools/build_map.py \
      gaia-house-healer gaia-inn gaia-spring

The plans live in `town_gaia_homes.py`, `town_gaia_shops.py` (`interiors_common.Town("gaia")`) and
`town_gaia_spring.py`; every generated header names this script, the one to run.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parent))
import town_gaia_homes  # noqa: E402
import town_gaia_shops  # noqa: E402
import town_gaia_spring  # noqa: E402

if __name__ == "__main__":
    for p in [*town_gaia_homes.build(), *town_gaia_shops.build(), town_gaia_spring.build()]:
        print(p)
