"""Changed-chunk determinism (TS-D, docs/TEST_SPEED_PLAN.md 6): `build_map.py --check-determinism --changed`. Against a base commit REV (default `git merge-base HEAD mainline`), it compiles only the chunks whose build digest
(terrain/region_chunks.py: the chunk's cells plus a CHUNK + RING_PAD ring, the objects reaching it, the painting
keys) differs from REV's compiled map, each in a window with its 1-chunk ring as `--region` paints, under
PYTHONHASHSEED 1 and 3 at once (`--serial`: in turn). It requires (6) equal per-chunk below / above / collision
hashes under both seeds, (7) the working-tree chunk files and compiled collision of those chunks equal to the compile
(and the compiled map's digests equal to the source's), and (8) every chunk file outside the changed set
byte-equal to REV's (no untracked chunk file either). It falls back to the full check (build_map.check_determinism)
when `--full` is given, the base has no chunk digests or another size, the compiler digest differs, a file of the
compiler closure (terrain/closure.py `compiler_closure`, taken from the current tree) changed since REV, is missing
at REV or is untracked, the base's `build.runtime` is missing or differs, or the painted set with its ring has
FULL_ABOVE chunks or more. Selftest: det_changed_selftest.py (in build_map.py --selftest).
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import re
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
import numpy as np
import yaml
from PIL import Image

from terrain import region as R

FULL_ABOVE = 120                      # R12: painted chunks (ring included) at which the full check runs
SEEDS = ("1", "3")
INJECT_ENV = "FFG_DET_SELFTEST_SEEDED"   # test only: the --hash child paints a seed-dependent pixel (step 6's case)
CHUNK_FILE = re.compile(r"(below|above)_(\d+)_(\d+)\.png$")


def git(root: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess:
    out = subprocess.run(["git", "-C", str(root), *args], capture_output=True)
    if check and out.returncode:
        raise R.RegionError(f"git {' '.join(args)}: {out.stderr.decode(errors='replace').strip()}")
    return out


def default_base(root: Path) -> str:
    return git(root, "merge-base", "HEAD", "mainline").stdout.decode().strip()


def base_doc(root: Path, rev: str, rel: str) -> dict | None:
    out = git(root, "show", f"{rev}:{rel}", check=False)
    return yaml.safe_load(out.stdout) if out.returncode == 0 else None


def closure_changes(root: Path, rev: str, files: list[str]) -> list[str]:
    """Closure files that differ from REV (committed or not), are missing at REV, or are untracked; plus any untracked
    .py file beside them (a new module that could shadow an import)."""
    changed = set(git(root, "diff", "--name-only", rev, "--", *files).stdout.decode().split())
    missing = {f for f in files if git(root, "cat-file", "-e", f"{rev}:{f}", check=False).returncode}
    dirs = sorted({str(Path(f).parent) for f in files})
    others = git(root, "ls-files", "--others", "--exclude-standard", "--", *dirs).stdout.decode().split()
    untracked = {f for f in others if f.endswith(".py") and str(Path(f).parent) in dirs}
    return sorted(changed | missing | untracked)


def ring_of(chunks: set, cols: int, rows: int) -> set:
    return {(c + dc, r + dr) for c, r in chunks for dc in (-1, 0, 1) for dr in (-1, 0, 1)
            if 0 <= c + dc < cols and 0 <= r + dr < rows}


def fallback_reason(src: dict, base: dict | None, current: dict, wid: int, hgt: int, cc_changed: list[str],
                    full: bool, rev: str) -> str | None:
    """Step 3: why the full check must run, or None."""
    build = (base or {}).get("build")
    if full:
        return "--full"
    if not R.chunked(src):
        return "the map has no chunk digests"
    if base is None:
        return f"no compiled map at {rev[:12]}"
    if (base.get("width"), base.get("height")) != (wid, hgt):
        return f"the base is {base.get('width')}x{base.get('height')}, the source {wid}x{hgt}"
    if not isinstance(build, dict) or not isinstance(build.get("chunks"), dict):
        return "the base has no chunk digests"
    if build.get("compiler") != current["compiler"]:
        return "the compiler digest differs from the base's"
    if cc_changed:
        return f"compiler files changed since {rev[:12]}: {', '.join(cc_changed)}"
    if build.get("runtime") != current["runtime"]:
        return "the base has no build.runtime" if build.get("runtime") is None else \
            f"the runtime differs from the base's ({build.get('runtime')} -> {current['runtime']})"
    return None


def _slices(c, col: int, row: int, T: int, CHUNK: int):
    y0, y1, x0, x1 = row * CHUNK, min(c.height, (row + 1) * CHUNK), col * CHUNK, min(c.width, (col + 1) * CHUNK)
    return (c.below[y0 * T:y1 * T, x0 * T:x1 * T], c.above[y0 * T:y1 * T, x0 * T:x1 * T],
            np.asarray(c.collision)[y0:y1, x0:x1])


def _h(a: np.ndarray, dtype=None) -> str:
    return hashlib.sha256(np.ascontiguousarray(a, dtype=dtype).tobytes()).hexdigest()


def chunk_hashes(c, chunks: list, T: int, CHUNK: int) -> dict:
    """The --hash child's `--per-chunk` output: per chunk the sha256 of its below / above pixels and collision."""
    if os.environ.get(INJECT_ENV) and chunks:
        col, row = chunks[0]
        c.below[row * CHUNK * T, col * CHUNK * T, 0] ^= int(os.environ.get("PYTHONHASHSEED", "0")) & 0xFF
    out = {}
    for col, row in chunks:
        below, above, coll = _slices(c, col, row, T, CHUNK)
        out[f"{col},{row}"] = {"below": _h(below), "above": _h(above), "collision": _h(coll, np.int16),
                               "channels": int(below.shape[2]), "above_any": bool(above[..., 3].any())}
    return out


def _file_hash(path: Path, channels: int) -> str | None:
    if not path.exists():
        return None
    im = Image.open(io.BytesIO(path.read_bytes()))
    return _h(np.asarray(im.convert("RGBA" if channels == 4 else "RGB")))


def _spawn(BM, src_file: str, rects_file: str, chunks_file: str, seed: str) -> subprocess.Popen:
    cmd = BM.hash_cmd([], src_file, False) + ["--rects", rects_file, "--per-chunk", chunks_file]
    env = {"PYTHONHASHSEED": seed, "FFG_WORLD_LOCK_HELD": "1"}
    if os.environ.get(INJECT_ENV):
        env[INJECT_ENV] = os.environ[INJECT_ENV]
    return subprocess.Popen(cmd, env=env, cwd=BM.ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


def compile_seeds(BM, src: dict, rects: list, chunks: list, serial: bool) -> dict[str, dict]:
    """Step 5: the two seeds' partial compiles (in parallel unless `serial`): {seed: {chunk: hashes}}."""
    with tempfile.TemporaryDirectory(prefix="ffg-det-") as tmp:
        files = {}
        for name, v in (("src", src), ("rects", [list(r) for r in rects]), ("chunks", [list(c) for c in chunks])):
            files[name] = str(Path(tmp) / f"{name}.json")
            Path(files[name]).write_text(json.dumps(v))
        runs, procs = {}, {}
        for seed in SEEDS:
            procs[seed] = _spawn(BM, files["src"], files["rects"], files["chunks"], seed)
            if serial:
                runs[seed] = procs[seed].communicate()
        for seed in SEEDS:
            if seed not in runs:
                runs[seed] = procs[seed].communicate()
        out = {}
        for seed in SEEDS:
            stdout, stderr = runs[seed]
            if procs[seed].returncode:
                raise BM.MapError(f"--hash under PYTHONHASHSEED={seed} failed: {stderr.strip() or stdout.strip()}")
            out[seed] = json.loads(stdout)[src["id"]]["chunks"]
    return out


def compare_files(doc: dict, current: dict, out_dir: Path, mid: str, hashes: dict, T: int, CHUNK: int) -> list[str]:
    """Step 7: the working tree's compiled map and chunk files equal the compile on the changed chunks."""
    errs = []
    if (doc.get("build") or {}).get("chunks") != current["chunks"] or doc["build"].get("compiler") != current["compiler"]:
        errs.append("the compiled map's build digests differ from the source's (stale: recompile)")
    coll = np.asarray(doc["collision"], dtype=np.int16).reshape(doc["height"], doc["width"])
    cols = (doc["width"] + CHUNK - 1) // CHUNK
    for key, h in sorted(hashes.items()):
        col, row = (int(v) for v in key.split(","))
        below = _file_hash(out_dir / mid / f"below_{row}_{col}.png", h["channels"])
        above = _file_hash(out_dir / mid / f"above_{row}_{col}.png", 4)
        if below != h["below"]:
            errs.append(f"chunk {key}: below_{row}_{col}.png differs from the compile")
        if h["above_any"] != (above is not None) or (above is not None and above != h["above"]):
            errs.append(f"chunk {key}: above_{row}_{col}.png differs from the compile")
        if h["above_any"] != (doc["art"]["above"][row * cols + col] is not None):
            errs.append(f"chunk {key}: art.above entry differs from the compile")
        y0, x0 = row * CHUNK, col * CHUNK
        if _h(coll[y0:y0 + CHUNK, x0:x0 + CHUNK], np.int16) != h["collision"]:
            errs.append(f"chunk {key}: collision differs from the compile")
    return errs


def unchanged_files(root: Path, rev: str, folder: str, changed: set) -> list[str]:
    """Step 8: chunk files outside the changed set that differ from REV's or are untracked."""
    diff = git(root, "diff", "--name-only", rev, "--", folder).stdout.decode().split()
    others = git(root, "ls-files", "--others", "--exclude-standard", "--", folder).stdout.decode().split()
    bad = []
    for f in sorted(set(diff) | set(others)):
        m = CHUNK_FILE.search(f)
        if m and (int(m.group(3)), int(m.group(2))) not in changed:
            bad.append(Path(f).name)
    return bad


@dataclass
class Outcome:
    ok: bool
    reason: str | None = None                  # the full check's reason, when it ran
    changed: set = field(default_factory=set)
    painted: int = 0
    errs: list = field(default_factory=list)


def check_changed(BM, mid: str, rev: str | None = None, full: bool = False, serial: bool = False,
                  src_dir: Path | None = None, out_dir: Path | None = None, root: Path | None = None,
                  closure: tuple[Path, list[str]] | None = None) -> Outcome:
    """`--check-determinism --changed` of one map; prints one line (and its errors) and returns the outcome.
    `closure`: the (git root, files) the compiler-closure check reads (default: the tools' repository and the current
    tree's `compiler_closure()`, never a list stored in a compiled map)."""
    root, out_dir = Path(root or BM.ROOT), Path(out_dir or BM.OUT)
    rev = rev or default_base(root)
    src = yaml.safe_load(((src_dir or BM.SRC) / f"{mid}.yaml").read_text())
    rows = src["ground"].rstrip("\n").split("\n")
    wid, hgt = len(rows[0]), len(rows)
    kit = BM.load_map_kit(src)
    current = R.digests(src, kit, wid, hgt, BM.footprint)
    folder = (out_dir / mid).resolve().relative_to(root.resolve()).as_posix()
    base = base_doc(root, rev, f"{folder}.yaml")
    cc_root, cc_files = closure or (R.REPO, R.compiler_closure())
    cc_changed = closure_changes(cc_root, rev, cc_files) if R.chunked(src) else []
    reason = fallback_reason(src, base, current, wid, hgt, cc_changed, full, rev)
    changed: set = set()
    if reason is None:
        changed = R.changed_chunks(base["build"], current) or set()
        try:
            _, rects = R.painted(set(), changed, wid, hgt, limit=FULL_ABOVE - 1)
        except R.RegionError:
            cols, nrows = (wid + BM.CHUNK - 1) // BM.CHUNK, (hgt + BM.CHUNK - 1) // BM.CHUNK
            reason = f"painted {len(ring_of(changed, cols, nrows))} >= {FULL_ABOVE}"
    if reason is not None:
        print(f"{mid}: full check ({reason})")
        return Outcome(BM.check_determinism([mid], src_dir=src_dir), reason)
    cols, nrows = (wid + BM.CHUNK - 1) // BM.CHUNK, (hgt + BM.CHUNK - 1) // BM.CHUNK
    order = sorted(changed, key=lambda c: (c[1], c[0]))
    runs = compile_seeds(BM, src, rects, order, serial) if order else {s: {} for s in SEEDS}
    a, b = runs[SEEDS[0]], runs[SEEDS[1]]
    errs = [] if set(a) == set(b) == {f"{c},{r}" for c, r in order} else ["the two seeds' compiles report other chunks"]
    errs += [f"chunk {k}: {f} differs between PYTHONHASHSEED {SEEDS[0]} and {SEEDS[1]}"
             for k in sorted(set(a) & set(b)) for f in ("below", "above", "collision") if a[k][f] != b[k][f]]
    if not errs:
        doc = yaml.safe_load((out_dir / f"{mid}.yaml").read_text())
        errs += compare_files(doc, current, out_dir, mid, runs[SEEDS[0]], BM.T, BM.CHUNK)
        errs += [f"{f}: changed since {rev[:12]} but its chunk digest did not (run --full)"
                 for f in unchanged_files(root, rev, folder, changed)]
    painted = len(ring_of(changed, cols, nrows))
    what = f"changed {len(changed)} chunks, painted {painted} with the ring, base {rev[:12]}"
    if errs:
        print(f"{mid}: NOT deterministic ({what})")
        for e in errs:
            print(f"  {e}")
    else:
        print(f"{mid}: deterministic ({what}; files match)")
    return Outcome(not errs, None, changed, painted, errs)

