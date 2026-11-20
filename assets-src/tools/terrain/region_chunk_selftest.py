"""Chunk-digest selftests (build_map.py --selftest; docs/NATURAL_WORLD_PLAN.md 3.4, momus R3-5; NW-4): region_selftest's
synthetic 4x3-chunk world with its regions given as owner-grid rasters (`regions.<r>.raster`, sharing a chunk).

  chunk digests: OK     the compiled map records `build.chunks` (one digest per chunk); a `--region` compile over
                        its own full compile equals it
  chunk neighbour: OK   an edit in region A that changes a chunk of region B: `--region A` repaints that chunk too
                        and its result equals the full compile of the edited source (byte for byte)
  chunk refusals: OK    over the painted-chunk limit, a base from another compiler, and a base without chunk
                        digests each refuse with "run a full compile"
"""
from __future__ import annotations

import tempfile
from pathlib import Path

import yaml

from . import region as R
from . import region_chunks as RC
from .region_selftest import NAMES, REGIONS, _diff, _snapshot, world

SHARED = {"a": [[16, 0, 31, 15]]}                  # region a's raster also holds b's chunk (1, 0): a shared chunk


def nw_world(edit: bool = False) -> dict:
    """The synthetic world with raster regions; `edit` paints a rock blob in region a's chunk (0, 1) at its east
    edge, inside the window of region c's chunk (1, 1) (so that chunk's digest changes too)."""
    src = world()
    src["regions"] = {NAMES[k]: {"raster": v + SHARED.get(k, [])} for k, v in REGIONS.items()}
    if edit:
        rows = [list(r) for r in src["ground"].split("\n")]
        for y in range(20, 24):
            for x in range(11, 15):
                rows[y][x] = "m"
        src["ground"] = "\n".join("".join(r) for r in rows)
        src["objects"] = [o for o in src["objects"] if not (11 <= o["x"] <= 15 and 19 <= o["y"] <= 25)]
    return src


def _fix(snap: dict, a: Path, b: Path) -> dict:
    """A snapshot's yaml with folder a's path written as b's (the map yaml names its chunk files by path)."""
    out = dict(snap)
    out["rworld.yaml"] = snap["rworld.yaml"].replace(str(a.resolve()).encode(), str(b.resolve()).encode())
    return out


def selftest() -> int:
    import build_map as B  # noqa: PLC0415
    ok = 0
    with tempfile.TemporaryDirectory(prefix="ffg-chunk-") as tmp, \
            tempfile.TemporaryDirectory(prefix="ffg-chunk-") as t2:      # one prefix: the yaml wraps paths alike
        d, d2 = Path(tmp), Path(t2)
        src = nw_world()
        assert R.chunked(src) and not R.chunked(world())
        c, kit = B.compile_source(src)
        B.write(src, c, d, kit=kit)
        full = _snapshot(d)
        build = yaml.safe_load(full["rworld.yaml"])["build"]
        assert set(build) == {"compiler", "chunks"} and len(build["chunks"]) == 12, build
        B.build_region(src, NAMES["a"], d)
        assert not _diff(full, _snapshot(d)), _diff(full, _snapshot(d))
        print("chunk digests: OK (build.chunks has 12 digests; --region over its own full compile equals it)")
        ok += 1

        edited = nw_world(edit=True)
        ce, _ = B.compile_source(edited)
        B.write(edited, ce, d2, kit=kit)
        want = _fix(_snapshot(d2), d2, d)
        new = R.digests(edited, kit, 64, 48, B.footprint)["chunks"]
        changed = {k for k, v in new.items() if build["chunks"][k] != v}
        own = {f"{c_},{r_}" for c_, r_ in R.region_chunks([tuple(x) for x in edited["regions"]["water"]["raster"]])}
        assert "1,1" in changed and changed - own, (changed, own)
        try:                                       # box mode would refuse this base: region c changed
            R.check_base(yaml.safe_load(full["rworld.yaml"]), {"compiler": build["compiler"], "boxes": {"c": "x"}},
                         "a", 64, 48)
            raise AssertionError("box mode must refuse a base whose other region changed")
        except R.RegionError as e:
            assert "stale base" in str(e), e
        B.build_region(edited, NAMES["a"], d)
        diff = _diff(want, _snapshot(d))
        assert not diff, f"--region a of the edited source differs from its full compile: {diff}"
        print(f"chunk neighbour: OK (an edit in a changed {len(changed)} chunks, {sorted(changed - own)} outside a's "
              "raster; --region a repainted them and equals the full compile)")
        ok += 1

        refusals = []
        limit, RC.PAINT_LIMIT = RC.PAINT_LIMIT, 4
        try:
            B.build_region(edited, NAMES["b"], d)
        except R.RegionError as e:
            refusals.append("limit" if "chunk limit, run a full compile" in str(e) else str(e))
        finally:
            RC.PAINT_LIMIT = limit
        base = yaml.safe_load((d / "rworld.yaml").read_text())
        for why, edit in (("compiler", {"compiler": "0" * 16, "chunks": base["build"]["chunks"]}),
                          ("no chunks", {"compiler": base["build"]["compiler"], "boxes": {}})):
            (d / "rworld.yaml").write_text(yaml.safe_dump({**base, "build": edit}))
            try:
                B.build_region(edited, NAMES["c"], d)
            except R.RegionError as e:
                refusals.append(why if "stale base, run a full compile" in str(e) else str(e))
        assert refusals == ["limit", "compiler", "no chunks"], refusals
        print("chunk refusals: OK (over the limit, another compiler, no chunk digests: each says run a full compile)")
        ok += 1
    return ok
