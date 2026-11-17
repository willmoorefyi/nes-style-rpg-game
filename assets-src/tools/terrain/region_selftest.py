"""Region selftests (build_map.py --selftest): a synthetic 4x3-chunk world with four regions compiled in full and by
region (docs/QUEST_PLAN.md 3.5, docs/WORLD_PLAN.md 2.9 and 5.2 W1-C1).

  region yaml: OK        a region compile's map yaml and chunk files equal the full compile's (a window that does not
                         start at the map's origin)
  region multi-rect: OK  the same for regions of two rects (an L), with organic and classic terrain
  locality: OK           editing one region (cells and objects) changes only that region's chunk files, byte for byte
  region stale: OK       a region compile over a base whose other regions changed fails; the edited region's own
                         compile equals the full compile of the edited source
  lock: OK               a second world compile waits for the lock, then exits 3 at its timeout
"""
from __future__ import annotations

import os
import random
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from .region import LOCK_PATH, RegionError, region_chunks, world_lock

CW, CH = 64, 48                                    # cells: 4 x 3 chunks
# d's window (its ring) starts at (16, 16) and b's second rect's at (32, 0): windows off the map's origin
REGIONS = {"a": [[0, 0, 15, 47]], "b": [[16, 0, 63, 15], [48, 16, 63, 47]], "c": [[16, 16, 31, 47], [32, 16, 47, 31]],
           "d": [[32, 32, 47, 47]]}
# the source names them as world regions (so build_hooks.region_checks finds them; they declare no checks)
NAMES = {"a": "water", "b": "ordeal", "c": "wind", "d": "fire"}
BAND = 2


def _owner(x: int, y: int) -> str:
    for name, rects in REGIONS.items():
        if any(r[0] <= x <= r[2] and r[1] <= y <= r[3] for r in rects):
            return name
    raise AssertionError((x, y))


def _band(x: int, y: int) -> bool:
    me = _owner(x, y)
    for dy in range(-BAND, BAND + 1):
        for dx in range(-BAND, BAND + 1):
            nx, ny = x + dx, y + dy
            if not (0 <= nx < CW and 0 <= ny < CH) or _owner(nx, ny) != me:
                return True
    return False


def world(edit: bool = False, organic: bool = True) -> dict:
    """The synthetic source: per region, blobs of every wild material, a road, a river, trees and a boulder deco,
    with 2-cell ocean bands on every region edge and the map edge. `edit` changes region d only."""
    g = [["." for _ in range(CW)] for _ in range(CH)]
    objects, entrances = [], {}
    for name in REGIONS:
        rng = random.Random(f"{name}{'+' if edit and name == 'd' else ''}")
        cells = [(x, y) for y in range(CH) for x in range(CW) if _owner(x, y) == name and not _band(x, y)]
        for m in "ffmmmsw≈o" * 2:
            cx, cy = rng.choice(cells)
            rad = rng.uniform(1.2, 2.8) * (1.6 if m == "m" else 1)       # wide ranges: many peaks per chunk
            for x, y in cells:
                if (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad:
                    g[y][x] = m
        x0, y0 = min(cells)[0], min(c[1] for c in cells)
        x1, y1 = max(c[0] for c in cells), max(c[1] for c in cells)
        ry = rng.randint(y0, y1)
        for x in range(x0, x1 + 1):                # a road across the region, a river down it
            g[ry][x] = ","
        rx = rng.randint(x0, x1)
        for y in range(y0, y1 + 1):
            g[y][rx] = "=" if y == ry else "r"
        ex, ey = (x0 + 1, ry) if g[ry][x0 + 1] == "," else (x0, ry)
        entrances[f"{name}_in"] = [ex, ey]
        for x, y in rng.sample(cells, 12):
            if g[y][x] == "." and y > y0 and g[y - 1][x] == "." and (x, y) != (ex, ey) and (x, y - 1) != (ex, ey):
                if not any((x, y) == (o["x"], o["y"]) or (x, y - 1) == (o["x"], o["y"]) or (x, y) == (o["x"], o["y"] - 1)
                           for o in objects):
                    objects.append({"type": "tree", "x": x, "y": y})
    for y in range(CH):
        for x in range(CW):
            if _band(x, y):
                g[y][x] = "o"
    src = {"id": "rworld", "kits": ["overworld", "town"], "ground": "\n".join("".join(r) for r in g),
           "entrances": entrances, "objects": objects, "unreachable_ok": [k for k in entrances][1:],
           "regions": {NAMES[k]: {"rects": v, "checks": {}} for k, v in REGIONS.items()}}
    if organic:
        src["terrain"] = "organic"
    return src


def _snapshot(d: Path) -> dict[str, bytes]:
    return {p.relative_to(d).as_posix(): p.read_bytes() for p in sorted(d.rglob("*")) if p.is_file()}


def _diff(a: dict[str, bytes], b: dict[str, bytes]) -> list[str]:
    return sorted(k for k in set(a) | set(b) if a.get(k) != b.get(k))


def _chunk_files(d: Path, mid: str, region: str) -> list[str]:
    out = []
    for c, r in sorted(region_chunks([tuple(x) for x in REGIONS[region]])):
        out += [f"{mid}/below_{r}_{c}.png", f"{mid}/above_{r}_{c}.png"]
    return out


def selftest() -> int:
    import build_map as B  # noqa: PLC0415
    ok = 0
    with tempfile.TemporaryDirectory(prefix="ffg-region-") as tmp:
        d = Path(tmp)
        for organic in (True, False):
            src = world(organic=organic)
            c, kit = B.compile_source(src)
            B.write(src, c, d, kit=kit)
            full = _snapshot(d)
            assert all(f in full for f in _chunk_files(d, "rworld", "a") if "below" in f), "full compile wrote no chunks"
            for region in ("d", "b", "c"):
                for f in _chunk_files(d, "rworld", region):
                    (d / f).unlink(missing_ok=True)
                B.build_region(src, NAMES[region], d)
                diff = _diff(full, _snapshot(d))
                assert not diff, f"region {region} ({'organic' if organic else 'classic'}) differs from full: {diff}"
            if organic:
                print("region yaml: OK (region d, a window off the map origin: rworld.yaml and its chunks equal "
                      "the full compile's)")
                ok += 1
        print("region multi-rect: OK (regions b and c, two rects each, equal the full compile, organic and classic "
              "terrain)")
        ok += 1

        # locality: edit region d; a full compile changes only d's chunk files (and d's digest)
        src = world()
        c, kit = B.compile_source(src)
        B.write(src, c, d, kit=kit)
        before = _snapshot(d)
        edited = world(edit=True)
        assert edited["ground"] != src["ground"]
        ce, _ = B.compile_source(edited)
        with tempfile.TemporaryDirectory(prefix="ffg-region-e-") as tmp2:
            d2 = Path(tmp2)
            shutil.copytree(d, d2, dirs_exist_ok=True)
            B.write(edited, ce, d2, kit=kit)
            after = _snapshot(d2)
            mine = set(_chunk_files(d, "rworld", "d"))
            changed = _diff(before, after)
            chunk_changes = [f for f in changed if f.endswith(".png")]
            assert chunk_changes and set(chunk_changes) <= mine, f"locality: edit of d changed {chunk_changes}"
            assert changed == sorted(chunk_changes + ["rworld.yaml"]), changed
            import yaml  # noqa: PLC0415
            b0 = yaml.safe_load(before["rworld.yaml"])["build"]["boxes"]
            b1 = yaml.safe_load(after["rworld.yaml"])["build"]["boxes"]
            assert [k for k in b0 if b0[k] != b1[k]] == [NAMES["d"]], (b0, b1)
            print(f"locality: OK (editing region d changed {len(chunk_changes)} of its {len(mine)} chunk files, "
                  "nothing else)")
            ok += 1
            # stale: d holds the base of the unedited source; a region a compile of the edited source must fail
            try:
                B.build_region(edited, NAMES["a"], d)
                raise AssertionError("--region over a base whose region d changed must fail")
            except RegionError as e:
                assert "stale base, run a full compile" in str(e), e
            B.build_region(edited, NAMES["d"], d)
            after["rworld.yaml"] = after["rworld.yaml"].replace(str(d2.resolve()).encode(), str(d.resolve()).encode())
            diff = _diff(after, _snapshot(d))
            assert not diff, f"region d of the edited source differs from its full compile: {diff}"
            print("region stale: OK (a over a changed d fails; d's own compile equals the full compile)")
            ok += 1
    ok += _lock_case()
    return ok


def _lock_case() -> int:
    """Hold the lock here; a child that wants it prints the waiting line and exits 3 at its (short) timeout."""
    child = ("import sys; sys.path.insert(0, %r); from terrain.region import world_lock\n"
             "with world_lock():\n    print('got it')\n") % str(Path(__file__).resolve().parent.parent)
    env = {k: v for k, v in os.environ.items() if k != "FFG_WORLD_LOCK_HELD"}
    env["FFG_WORLD_LOCK_TIMEOUT"] = "1"
    held = os.environ.get("FFG_WORLD_LOCK_HELD") == "1"
    if held:                                       # inside a locked compile: the child would really wait for us
        os.environ.pop("FFG_WORLD_LOCK_HELD")
    try:
        with world_lock():
            out = subprocess.run([sys.executable, "-I", "-c", child], env=env, capture_output=True, text=True,
                                 timeout=60)
    finally:
        if held:
            os.environ["FFG_WORLD_LOCK_HELD"] = "1"
    assert out.returncode == 3, (out.returncode, out.stdout, out.stderr)
    assert "waiting for the world-compile lock" in out.stdout and "holder pid" in out.stdout, out.stdout
    assert f"holder pid {os.getpid()}" in out.stdout, out.stdout
    env["FFG_WORLD_LOCK_HELD"] = "1"               # a child of a holder skips the lock
    out = subprocess.run([sys.executable, "-I", "-c", child], env=env, capture_output=True, text=True, timeout=60)
    assert out.returncode == 0 and "got it" in out.stdout, (out.returncode, out.stdout, out.stderr)
    print(f"lock: OK (a second compile waits, then exits 3 after its timeout; {LOCK_PATH})")
    return 1
