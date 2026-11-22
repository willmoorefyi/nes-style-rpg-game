"""WR's wrap checks' selftests (docs/WORLD_WRAP_PLAN.md 6.1): `wrap` passes on an open-sea fixture and fails on its
RED fixtures, and every ship zone of the composed world is in SEA_CLASS.

  python3 -I assets-src/tools/worldgen/selftest_wrap.py      # one OK line per case; exit 1 on a failure

- green: a 64x64 sea with an island in the middle; no component joins, the margin is the island's;
- RED: land on an edge (two walkers joined across the seam) fails (i) and (iii);
- RED: land 3 cells from an edge fails (ii) (SEAM_MARGIN 4);
- RED: a ship zone missing from SEA_CLASS is reported `UNCLASSED <id>`; and the committed world source's ship zones
  are all classed (the assertion of plan 2).
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import yaml

TOOLS = Path(__file__).resolve().parents[1]
ROOT = TOOLS.parents[1]
sys.path.insert(0, str(TOOLS))
sys.path.insert(0, str(TOOLS / "layouts"))
from worldgen import gates_wrap  # noqa: E402
from world_api import SEA_CLASS, SEAM_MARGIN  # noqa: E402

FAILS: list[str] = []


def case(name: str, ok: bool, detail: str = "") -> None:
    print(f"{'OK  ' if ok else 'FAIL'} {name}{f'  ({detail})' if detail else ''}")
    if not ok:
        FAILS.append(name)


def sea(n: int = 64) -> np.ndarray:
    g = np.full((n, n), "o", dtype="<U1")
    g[24:40, 24:40] = "."
    return g


def main() -> int:
    r = gates_wrap.wrap_check(sea(), {}, SEAM_MARGIN)
    case("green: an island in an open sea passes", r["ok"] and r["least_margin"] == 24 and r["joins"] == 0, r["note"])
    g = sea()
    g[10:12, 0] = "."
    g[10:12, -1] = "."
    r = gates_wrap.wrap_check(g, {}, SEAM_MARGIN)
    case("RED: land on both edges is not Water and joins two walkers across the seam",
         not r["ok"] and r["joins"] >= 2 and any("edge cells are not Water" in w for w in r["why"])
         and any("joins two walk components" in w for w in r["why"]), r["why"][0] if r["why"] else "")
    g = sea()
    g[30, 3] = "."
    r = gates_wrap.wrap_check(g, {}, SEAM_MARGIN)
    case(f"RED: land 3 cells from an edge breaks SEAM_MARGIN {SEAM_MARGIN}",
         not r["ok"] and any("within SEAM_MARGIN" in w for w in r["why"]) and r["joins"] == 0, r["why"][:1])
    zones = [{"id": "x_sea", "modes": ["ship"], "rects": [[0, 0, 63, 63]]}]
    rep = gates_wrap.seam_report(sea(), zones, SEA_CLASS)
    case("RED: a ship zone missing from SEA_CLASS is reported UNCLASSED", rep["unclassed"] == ["x_sea"]
         and "UNCLASSED x_sea" in rep["note"], rep["note"])
    zones = [{"id": "elf_sea", "modes": ["ship"], "rects": [[0, 0, 31, 63]]},
             {"id": "wat_sea", "modes": ["ship"], "rects": [[32, 0, 63, 63]]}]
    rep = gates_wrap.seam_report(sea(), zones, SEA_CLASS)
    case("seam_zones reports an early | late stretch with its length",
         len(rep["stretches"]) == 1 and rep["note"] == "E-W 0-63 (64): elf_sea | wat_sea", rep["note"])
    src = yaml.load((ROOT / "assets-src" / "maps" / "overworld.yaml").read_text(),
                    Loader=getattr(yaml, "CSafeLoader", yaml.SafeLoader))
    ship = sorted(z["id"] for z in src.get("encounterZones") or [] if "ship" in (z.get("modes") or []))
    missing = [z for z in ship if z not in SEA_CLASS]
    case("every ship zone of the composed world is in SEA_CLASS", bool(ship) and not missing,
         f"{len(ship)} ship zones; missing {missing}")
    print(f"selftest_wrap: {'FAIL' if FAILS else 'OK'} ({len(FAILS)} failed)")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
