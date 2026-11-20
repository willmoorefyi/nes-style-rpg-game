"""The world map's shim: running it is the same as running layouts/world.py (QUEST 3.5).

  python3 -I assets-src/tools/layouts/overworld.py && python3 -I assets-src/tools/build_map.py overworld

The composer writes assets-src/maps/overworld.yaml, the 256x256 world of pass NW (docs/NATURAL_WORLD_PLAN.md 3.1). Pass
W's 72x72 act-1 block (`build()`, `objects()`, `check()`, with `overworld_consts.py`, `overworld_grid.py` and
`overworld_noise.py`) retired at NW-5 (3.6.1): act 1 is generated with the rest of the world, its sites and features
pinned relative to Cornelia (`a1/world_a1_pins.py`), its promises checked by `a1/world_a1_checks.py`. Act 1's
encounter tables stay in `overworld_zones.py` and `a1/world_a1_zones.py` (3.6.4).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import world  # noqa: E402

if __name__ == "__main__":
    sys.exit(world.main(sys.argv[1:]))
