"""Onrac's interiors (docs/WORLD_PLAN.md 4.0.1, 4.6; WAT-T) -> assets-src/maps/onrac-house-*.yaml (bellringer,
netmender, smoker, shipwright, healer, tanner), the five shops and the inn.

  python3 -I assets-src/tools/layouts/water/town_onrac_interiors.py && python3 -I assets-src/tools/build_map.py \
      onrac-house-bellringer onrac-inn

The plans live in `town_onrac_homes.py` and `town_onrac_shops.py` (`interiors_common.Town("onrac")`); every
generated header names this script, the one to run.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(1, str(Path(__file__).resolve().parent))
import town_onrac_homes  # noqa: E402
import town_onrac_shops  # noqa: E402

if __name__ == "__main__":
    for p in [*town_onrac_homes.build(), *town_onrac_shops.build()]:
        print(p)
