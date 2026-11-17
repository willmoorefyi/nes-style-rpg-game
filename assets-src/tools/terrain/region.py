"""World regions in the map compiler (docs/QUEST_PLAN.md 3.5 with the pass W deltas of docs/WORLD_PLAN.md 2.9):
the regions of a map source, the build digests that make `--region` safe, and the world-compile lock.

- **Regions.** A source lists them as `regions: {name: [[x0, y0, x1, y1], ...]}` (inclusive cells, chunk-aligned;
  one or more rects each, GAP-19) or `{name: {rects: [...]}}`; for the composed world (`regions: {name: {stub,
  checks}}`, or only `world:`) the rects are `layouts/world_api.BOXES`. A map without regions compiles as before.
- **Build digests.** A compiled map with regions records `build: {compiler, boxes}`: a digest of the compiler (its
  code and the kit art it painted with) and one per region of what its pixels depend on (the region's ground
  cells, the objects anchored in it, and the map-wide painting keys). `--region r` repaints only r's chunks, so it
  refuses a base whose compiler or any other region's digest differs (`--region: stale base, run a full compile`).
- **The world-compile lock.** One world compile at a time across all worktrees: an exclusive `fcntl.flock` on
  LOCK_PATH, taken by the top-level CLI for any compile of a map with regions (and `overworld`). A waiter prints
  `waiting for the world-compile lock` and polls; after 30 min (`FFG_WORLD_LOCK_TIMEOUT` s) it prints
  `world-compile lock timeout after 30 min; holder pid <n>` and exits 3. Children run with FFG_WORLD_LOCK_HELD=1
  and skip it (the determinism check's subprocesses).
"""
from __future__ import annotations

import fcntl
import hashlib
import json
import os
import sys
import time
from contextlib import contextmanager
from pathlib import Path

from .frame import CHUNK

TOOLS = Path(__file__).resolve().parent.parent
LOCK_PATH = Path("/tmp/ff-game-world-compile.lock")
LOCK_TIMEOUT = 30 * 60
WORLD_IDS = ("overworld",)                     # compiled under the lock even before they have regions
PAINT_KEYS = ("id", "kit", "kits", "materials", "terrain", "carpet_trim")   # map-wide keys that change pixels
CODE = ["build_map.py", "kit.py", "terrain"]   # the compiler's code (terrain/*.py)

Rect = tuple[int, int, int, int]


class RegionError(ValueError):
    pass


def regions_of(src: dict, wid: int | None = None, hgt: int | None = None) -> dict[str, list[Rect]] | None:
    """{region: [rect, ...]} of a map source, or None for a map without regions."""
    spec = src.get("regions")
    if not spec and not src.get("world"):
        return None
    boxes = None
    regions = {}
    for name in (spec or _boxes()):
        v = (spec or {}).get(name)
        if isinstance(v, dict) and "rects" in v:
            v = v["rects"]
        if not isinstance(v, list):                 # the composer's {stub, checks}: the rects are world_api.BOXES
            boxes = boxes or _boxes()
            if name not in boxes:
                raise RegionError(f"region {name}: no rects (not in world_api.BOXES)")
            v = boxes[name]
        regions[str(name)] = [tuple(int(c) for c in r) for r in v]
    for name, rects in regions.items():
        for r in rects:
            if len(r) != 4 or r[0] % CHUNK or r[1] % CHUNK or r[0] > r[2] or r[1] > r[3]:
                raise RegionError(f"region {name}: rect {list(r)} is not a chunk-aligned [x0, y0, x1, y1]")
            if wid is not None and not (r[2] < wid and r[3] < hgt):
                raise RegionError(f"region {name}: rect {list(r)} is outside the {wid}x{hgt} map")
    return regions


def _boxes() -> dict[str, list[Rect]]:
    sys.path.insert(0, str(TOOLS / "layouts"))
    import world_api  # noqa: PLC0415
    return {k: [(r.x0, r.y0, r.x1, r.y1) for r in rects] for k, rects in world_api.BOXES.items()}


def region_of_cell(regions: dict[str, list[Rect]], x: int, y: int) -> str | None:
    for name, rects in regions.items():
        if any(r[0] <= x <= r[2] and r[1] <= y <= r[3] for r in rects):
            return name
    return None


def region_chunks(rects: list[Rect]) -> set[tuple[int, int]]:
    """(col, row) of every chunk the rects touch."""
    return {(c, r) for x0, y0, x1, y1 in rects
            for r in range(y0 // CHUNK, y1 // CHUNK + 1) for c in range(x0 // CHUNK, x1 // CHUNK + 1)}


def _anchor(o: dict) -> tuple[int, int] | None:
    if o.get("x") is not None and o.get("y") is not None:
        return int(o["x"]), int(o["y"])
    if o.get("from"):
        return int(o["from"][0]), int(o["from"][1])
    return None


def compiler_digest(kit) -> str:
    """The compiler's code plus the kit art it paints with (parts, materials, which are approved)."""
    h = hashlib.sha256()
    files = []
    for name in CODE:
        p = TOOLS / name
        files += sorted(p.glob("*.py")) if p.is_dir() else [p]
    for f in files:
        h.update(f.relative_to(TOOLS).as_posix().encode() + b"\0" + f.read_bytes() + b"\0")
    for name in sorted(n for n in kit.parts if "@" not in n):
        im = kit.parts[name]
        h.update(f"part {name} {im.mode} {im.size}".encode() + im.tobytes())
    for name in sorted(kit.materials):
        a = kit.materials[name]
        h.update(f"mat {name} {a.shape}".encode() + a.tobytes())
    h.update(" ".join(sorted(kit.approved)).encode())
    return h.hexdigest()[:16]


def digests(src: dict, kit, wid: int, hgt: int) -> dict:
    """`build: {compiler, boxes: {region: digest}}` for a map with regions (recorded in the compiled map)."""
    regions = regions_of(src, wid, hgt) or {}
    rows = src["ground"].rstrip("\n").split("\n")
    paint = json.dumps({k: src.get(k) for k in PAINT_KEYS}, sort_keys=True)
    objs: dict[str | None, list[dict]] = {}
    for o in src.get("objects") or []:
        a = _anchor(o)
        objs.setdefault(region_of_cell(regions, *a) if a else None, []).append(o)
    boxes = {}
    for name, rects in regions.items():
        h = hashlib.sha256(paint.encode())
        for x0, y0, x1, y1 in rects:
            h.update(f"rect {x0} {y0} {x1} {y1}\n".encode())
            for y in range(y0, y1 + 1):
                h.update(rows[y][x0:x1 + 1].encode() + b"\n")
        h.update(json.dumps(objs.get(name, []) + objs.get(None, []), sort_keys=True).encode())
        boxes[name] = h.hexdigest()[:16]
    return {"compiler": compiler_digest(kit), "boxes": boxes}


def check_base(base: dict | None, new: dict, region: str, wid: int, hgt: int) -> None:
    """Raise unless the compiled base can take a `--region` compile of `region` (every other region and the
    compiler unchanged since the base was compiled)."""
    why = None
    if base is None:
        why = "no compiled map"
    elif (base.get("width"), base.get("height")) != (wid, hgt):
        why = f"the base is {base.get('width')}x{base.get('height')}, the source {wid}x{hgt}"
    elif not isinstance(base.get("build"), dict):
        why = "the base has no build digests"
    elif base["build"].get("compiler") != new["compiler"]:
        why = "the compiler or the kit art changed"
    else:
        other = [r for r in new["boxes"] if r != region and base["build"].get("boxes", {}).get(r) != new["boxes"][r]]
        if other:
            why = f"region {', '.join(other)} changed"
    if why:
        raise RegionError(f"--region: stale base, run a full compile ({why})")


@contextmanager
def world_lock():
    """The exclusive world-compile lock (see the module docstring)."""
    if os.environ.get("FFG_WORLD_LOCK_HELD") == "1":
        yield
        return
    timeout = float(os.environ.get("FFG_WORLD_LOCK_TIMEOUT", LOCK_TIMEOUT))
    fd = os.open(LOCK_PATH, os.O_RDWR | os.O_CREAT, 0o666)
    start, waiting = time.monotonic(), False
    try:
        while True:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if not waiting:
                    print("waiting for the world-compile lock", flush=True)
                    waiting = True
                if time.monotonic() - start >= timeout:
                    holder = os.pread(fd, 32, 0).decode(errors="replace").strip() or "?"
                    print(f"world-compile lock timeout after {timeout / 60:g} min; holder pid {holder}", flush=True)
                    raise SystemExit(3)
                time.sleep(min(2.0, max(0.05, timeout / 20)))
        os.ftruncate(fd, 0)
        os.pwrite(fd, f"{os.getpid()}\n".encode(), 0)
        os.environ["FFG_WORLD_LOCK_HELD"] = "1"
        try:
            yield
        finally:
            os.environ.pop("FFG_WORLD_LOCK_HELD", None)
            fcntl.flock(fd, fcntl.LOCK_UN)
    finally:
        os.close(fd)
