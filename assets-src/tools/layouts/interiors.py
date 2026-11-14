"""Cornelia's house, shop and inn interiors (original layouts) -> assets-src/maps/cornelia-house-*.yaml and the six
cornelia-*shop*, -magic and -inn maps.

  python3 -I assets-src/tools/layouts/interiors.py && python3 -I assets-src/tools/build_map.py

Ten houses (CT-1), each with a purpose, its own plan and its own material aliases, and the six shops and the inn
(IN-5), each with its own counter layout; the keepers stay behind their counters, so you talk to them across it.
Every exit returns to the cell in front of the door it was entered by (`cornelia.py` names the house `house_<name>`
and the inn and shops by their old names). Homes play the town music; shops and the inn the shop music.

The plans live in `homes_a.py`, `homes_b.py` (five homes each) and `shops.py`; the shared room class and constructors
in `interiors_common.py`. Every generated header still names this script, the one to run.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import homes_a  # noqa: E402
import homes_b  # noqa: E402
import shops  # noqa: E402

written: list[Path] = [*homes_a.build(), *homes_b.build(), *shops.build()]
for p in written:
    print(p)
