"""The Mode 7 far atlas of the world map (docs/MODE7_PLAN.md 3.1, tranche M7-1).

  python3 -I assets-src/tools/mode7_atlas.py overworld [--maps DIR] [--out DIR]
  python3 -I assets-src/tools/mode7_atlas.py --check-determinism overworld

It stitches the compiled `below_<r>_<c>.png` chunks of a map (48 px per cell) and box-downsamples them to two RGB
atlases with no added border: `mode7.png` at 16 px per cell (3x3 boxes; the 192x192 world gives 3072x3072) and
`mode7_low.png` at 8 px per cell (6x6 boxes, 1536x1536). Every box average rounds half up in integers, and the
PNGs are written by Pillow with fixed options, so the bytes depend only on the chunk files (no randomness, no
PYTHONHASHSEED). `mode7.json` records the sizes and `inputs`, the sha256 over the chunk files' bytes in row-major
order (the order of the compiled map's `art.below`); `tests/data/mode7Atlas.test.ts` fails on a stale atlas.

The bake refuses a map whose four edges are not all Water in its source: off the map the runtime clamps to the
atlas's edge texels, which must be sea (MODE7_PLAN 2.5). The patch overlays stay out of the atlas (the runtime
`WorldAtlas` draws them over it while their flags are set).

`--maps` is the folder of compiled maps (default `assets/maps/ai`), `--out` the folder the atlas goes to (default
`<maps>/<id>`). `build_hooks.bake_mode7` runs the bake inside `build_map.write()`, so every full and `--region`
world compile re-bakes it. `--check-determinism` bakes twice, under PYTHONHASHSEED 0 and 1, into two temp dirs
through `--out`, compares the bytes and exits non-zero on a difference; it writes nothing else.
"""
from __future__ import annotations

import contextlib
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import yaml
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

ROOT = Path(__file__).resolve().parents[2]
MAPS = ROOT / "assets" / "maps" / "ai"
SRC = ROOT / "assets-src" / "maps"
SRC_PX = 48                       # px per cell of the compiled chunks (build_map.T)
CELL_PX = 16                      # mode7.png
LOW_CELL_PX = 8                   # mode7_low.png
VERSION = 1
FILES = ("mode7.png", "mode7_low.png", "mode7.json")
CHUNK_RE = re.compile(r"^below_(\d+)_(\d+)\.png$")


class AtlasError(Exception):
    pass


def chunk_files(chunk_dir: Path) -> list[list[Path]]:
    """The `below_<r>_<c>.png` files of a compiled map folder as rows of columns; a gap in the grid is an error."""
    found = {}
    for p in chunk_dir.glob("below_*.png"):
        m = CHUNK_RE.match(p.name)
        if m:
            found[(int(m.group(1)), int(m.group(2)))] = p
    if not found:
        raise AtlasError(f"no below chunks in {chunk_dir}")
    rows, cols = 1 + max(r for r, _ in found), 1 + max(c for _, c in found)
    missing = [f"below_{r}_{c}.png" for r in range(rows) for c in range(cols) if (r, c) not in found]
    if missing:
        raise AtlasError(f"{chunk_dir}: {len(missing)} chunks missing, first {missing[0]}")
    return [[found[(r, c)] for c in range(cols)] for r in range(rows)]


def inputs_hash(grid: list[list[Path]]) -> str:
    h = hashlib.sha256()
    for row in grid:
        for p in row:
            h.update(p.read_bytes())
    return h.hexdigest()


def box_down(img: np.ndarray, k: int) -> np.ndarray:
    """Average k x k boxes of an RGB uint8 image (its sides divisible by k), rounding half up."""
    h, w = img.shape[0] // k, img.shape[1] // k
    s = img.reshape(h, k, w, k, 3).astype(np.uint32).sum(axis=(1, 3))
    return ((s + (k * k) // 2) // (k * k)).astype(np.uint8)


def edge_errors(src: dict) -> list[str]:
    """MODE7_PLAN 2.5: every cell of the source's 4 edges must be Water (TerrainType 2)."""
    import build_map as BM  # noqa: PLC0415  (the legend; build_hooks imports this module lazily, so no cycle)
    rows = src["ground"].rstrip("\n").split("\n")
    hgt, wid = len(rows), len(rows[0])
    edge = {(x, 0) for x in range(wid)} | {(x, hgt - 1) for x in range(wid)} | \
           {(0, y) for y in range(hgt)} | {(wid - 1, y) for y in range(hgt)}
    bad = sorted((y, x) for x, y in edge if BM.TERRAIN.get(BM.LEGEND.get(rows[y][x], ""), -1) != BM.WATER)
    if not bad:
        return []
    y, x = bad[0]
    return [f"{src['id']}: {len(bad)} edge cells are not sea, first ({x}, {y}) {rows[y][x]!r}"]


def bake(map_id: str, maps_dir: Path = MAPS, out_dir: Path | None = None, src: dict | None = None) -> Path:
    """Bake `mode7.png`, `mode7_low.png` and `mode7.json` of map_id from `<maps_dir>/<map_id>/below_*.png` into
    out_dir (default the map's own folder); returns the path of mode7.png. `src`: the map source (default read from
    assets-src/maps) for the sea-edge check."""
    src = src if src is not None else yaml.load((SRC / f"{map_id}.yaml").read_text(), Loader=_loader())
    errs = edge_errors(src)
    if errs:
        raise AtlasError("; ".join(errs))
    grid = chunk_files(Path(maps_dir) / map_id)
    out = Path(out_dir) if out_dir is not None else Path(maps_dir) / map_id
    out.mkdir(parents=True, exist_ok=True)
    k, kl = SRC_PX // CELL_PX, SRC_PX // LOW_CELL_PX
    far_rows, low_rows = [], []
    for row in grid:
        far, low = [], []
        for p in row:
            with Image.open(p) as im:
                a = np.asarray(im.convert("RGB"))
            if a.shape[0] % kl or a.shape[1] % kl:
                raise AtlasError(f"{p.name}: {a.shape[1]}x{a.shape[0]} px is not whole {SRC_PX} px cells")
            far.append(box_down(a, k))
            low.append(box_down(a, kl))
        far_rows.append(np.concatenate(far, axis=1))
        low_rows.append(np.concatenate(low, axis=1))
    far_img, low_img = np.concatenate(far_rows, axis=0), np.concatenate(low_rows, axis=0)
    if far_img.shape[0] != far_img.shape[1]:
        raise AtlasError(f"{map_id}: the atlas is {far_img.shape[1]}x{far_img.shape[0]}, not square")
    path = out / "mode7.png"
    Image.fromarray(far_img).save(path, optimize=True)
    Image.fromarray(low_img).save(out / "mode7_low.png", optimize=True)
    meta = {"version": VERSION, "cellPx": CELL_PX, "size": int(far_img.shape[1]), "lowCellPx": LOW_CELL_PX,
            "lowSize": int(low_img.shape[1]), "inputs": inputs_hash(grid)}
    (out / "mode7.json").write_text(json.dumps(meta, indent=2) + "\n")
    return path


def _loader():
    return getattr(yaml, "CSafeLoader", yaml.SafeLoader)


def _take(args: list[str], flag: str) -> str | None:
    if flag not in args:
        return None
    i = args.index(flag)
    if i + 1 >= len(args):
        raise SystemExit(f"{flag} needs a value")
    val = args[i + 1]
    del args[i:i + 2]
    return val


def check_determinism(map_id: str, maps_dir: Path = MAPS) -> bool:
    """Bake twice in subprocesses, under PYTHONHASHSEED 0 and 1, into two temp dirs; the same bytes or False."""
    with tempfile.TemporaryDirectory(prefix="ffg-mode7-") as tmp:
        digests = []
        for seed in ("0", "1"):
            out = Path(tmp) / f"seed{seed}"
            cmd = [sys.executable, "-s", str(Path(__file__).resolve()), map_id, "--maps", str(maps_dir),
                   "--out", str(out)]
            run = subprocess.run(cmd, env={"PYTHONHASHSEED": seed}, cwd=ROOT, capture_output=True, text=True)
            if run.returncode:
                print(f"{map_id}: bake under PYTHONHASHSEED={seed} failed: {run.stderr.strip() or run.stdout.strip()}")
                return False
            digests.append({f: hashlib.sha256((out / f).read_bytes()).hexdigest() for f in FILES})
    diff = [f for f in FILES if digests[0][f] != digests[1][f]]
    print(f"{map_id}: mode7 atlas {'differs in ' + ', '.join(diff) if diff else 'deterministic'} "
          f"({', '.join(f'{f} {digests[0][f][:12]}' for f in FILES)})")
    return not diff


def main(args: list[str]) -> None:
    maps = Path(_take(args, "--maps") or MAPS).resolve()
    out = _take(args, "--out")
    check = "--check-determinism" in args
    ids = [a for a in args if not a.startswith("--")]
    if len(ids) != 1 or len(ids) != len(args) - int(check):
        raise SystemExit(__doc__.split("\n\n")[1])
    if check:
        raise SystemExit(0 if check_determinism(ids[0], maps) else 1)
    t0 = time.monotonic()
    # writing into a compiled map folder: wait for any world compile (it writes the chunks we read)
    lock = contextlib.nullcontext()
    if out is None:
        from terrain import region as R  # noqa: PLC0415
        lock = R.world_lock()
    with lock:
        try:
            path = bake(ids[0], maps, Path(out).resolve() if out else None)
        except AtlasError as e:
            raise SystemExit(f"mode7_atlas: {e}") from None
    meta = json.loads((path.parent / "mode7.json").read_text())
    print(f"{ids[0]}: {path} {meta['size']}² + mode7_low.png {meta['lowSize']}² in {time.monotonic() - t0:.1f} s")


if __name__ == "__main__":
    main(sys.argv[1:])
