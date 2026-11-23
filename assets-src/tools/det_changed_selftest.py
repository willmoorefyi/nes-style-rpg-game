"""Selftests of the changed-chunk determinism check (det_changed.py; build_map.py --selftest; docs/TEST_SPEED_PLAN.md
8), on region_chunk_selftest's synthetic 64x48 world with chunk digests, compiled into a temporary git repository:

  changed: OK        an unedited tree passes with 0 changed chunks; one edited cell changes exactly the chunks whose
                     digest window holds it, painted with their ring, and passes
  reach: OK          a moved object marks every chunk its art can reach (old and new place)
  rects: OK          an explicit-rects compile of the changed chunks equals the full compile on those chunks
  fallbacks: OK      a changed, an untracked and a missing closure file, no build.chunks, another size, no or another
                     build.runtime, another compiler digest, and the painted count at the limit each run the full check
  stale: OK          a tampered unchanged chunk file fails step 8, a stale changed file fails step 7
  seeds: OK          a seed-dependent paint (the test-only hook) fails step 6
  closure: OK        a --hash child's pre-compile compiler closure equals the one recorded after its compile
"""
from __future__ import annotations

import contextlib
import io
import json
import os
import subprocess
import sys
import tempfile
import types
from pathlib import Path

import yaml

import det_changed as DC
from terrain import region as R
from terrain.region_chunk_selftest import nw_world

MID = "rworld"


def _git(root: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(root), "-c", "user.name=t", "-c", "user.email=t@t", *args],
                          check=True, capture_output=True, text=True).stdout.strip()


def _edit(src: dict, cells: list[tuple[int, int]]) -> dict:
    """Each cell becomes forest (or grass, where it is forest)."""
    rows = [list(r) for r in src["ground"].split("\n")]
    for x, y in cells:
        rows[y][x] = "." if rows[y][x] == "f" else "f"
    return {**src, "ground": "\n".join("".join(r) for r in rows)}


def _windows(x0: int, y0: int, x1: int, y1: int, wid: int, hgt: int) -> set:
    """The chunks whose digest window (the chunk plus CHUNK + RING_PAD cells) meets the cell box."""
    m, C = R.CHUNK + R.RING_PAD, R.CHUNK
    return {(c, r) for r in range((hgt + C - 1) // C) for c in range((wid + C - 1) // C)
            if max(0, c * C - m) <= x1 and min(wid, (c + 1) * C + m) - 1 >= x0
            and max(0, r * C - m) <= y1 and min(hgt, (r + 1) * C + m) - 1 >= y0}


def selftest() -> int:
    import build_map as B  # noqa: PLC0415
    ok = 0
    quiet = contextlib.redirect_stdout(io.StringIO())
    with tempfile.TemporaryDirectory(prefix="ffg-detc-") as tmp:
        root = Path(tmp)
        out, srcd, tools = root / "assets/maps/ai", root / "assets-src/maps", root / "assets-src/tools"
        for d in (out, srcd, tools):
            d.mkdir(parents=True)
        (tools / "fake_compiler.py").write_text("X = 1\n")
        closure = (root, ["assets-src/tools/fake_compiler.py"])
        _git(root, "init", "-q")

        def compile_write(src: dict) -> None:
            (srcd / f"{MID}.yaml").write_text(yaml.safe_dump(src))
            c, kit = B.compile_source(src)
            B.write(src, c, out, kit=kit)

        def check(**kw) -> DC.Outcome:
            with quiet:
                return DC.check_changed(kw.pop("bm", B), MID, rev, src_dir=srcd, out_dir=out, root=root,
                                        closure=closure, **kw)

        base = nw_world()
        compile_write(base)
        _git(root, "add", "-A")
        _git(root, "commit", "-qm", "base")
        rev = _git(root, "rev-parse", "HEAD")
        res = check()
        assert res.ok and res.reason is None and not res.changed, res
        cell = (8, 8)
        edited = _edit(base, [cell])
        compile_write(edited)
        res = check()
        want = _windows(*cell, *cell, 64, 48)
        assert res.ok and res.changed == want and res.painted == len(DC.ring_of(want, 4, 3)), (res, want)
        print(f"changed: OK (0 chunks unedited; one cell -> {len(want)} changed, {res.painted} painted, passes)")
        ok += 1

        kit = B.load_map_kit(base)
        old = R.digests(base, kit, 64, 48, B.footprint)
        o = base["objects"][0]
        moved = {**base, "objects": [{**o, "x": o["x"] + 1}] + base["objects"][1:]}
        new = R.digests(moved, kit, 64, 48, B.footprint)
        reach = set()
        for obj in (o, moved["objects"][0]):
            cells = B.footprint(obj)
            xs, ys = [c[0] for c in cells], [c[1] for c in cells]
            reach |= _windows(min(xs) - R.OBJ_REACH, min(ys) - R.OBJ_REACH, max(xs) + R.OBJ_REACH,
                              max(ys) + R.OBJ_REACH, 64, 48)
        assert R.changed_chunks(old, new) == reach, (R.changed_chunks(old, new), reach)
        print(f"reach: OK (a moved object changes the {len(reach)} chunks its art can reach)")
        ok += 1

        order = sorted(want, key=lambda c: (c[1], c[0]))
        _, rects = R.painted(set(), want, 64, 48)
        part = B.compile_map(edited, kit, raster=rects)
        whole = B.compile_map(edited, kit)
        assert DC.chunk_hashes(part, order, B.T, B.CHUNK) == DC.chunk_hashes(whole, order, B.T, B.CHUNK)
        print(f"rects: OK (the explicit-rects compile equals the full compile on {len(order)} chunks)")
        ok += 1

        full_ran = []
        bm = types.SimpleNamespace(**{k: getattr(B, k) for k in dir(B) if not k.startswith("__")})
        bm.check_determinism = lambda ids, **kw: full_ran.append(ids) or True     # the full check itself is B's
        reasons = []
        (tools / "fake_compiler.py").write_text("X = 2\n")
        reasons.append(check(bm=bm).reason)
        (tools / "fake_compiler.py").write_text("X = 1\n")
        (tools / "fake_new.py").write_text("Y = 1\n")
        reasons.append(check(bm=bm).reason)
        (tools / "fake_new.py").unlink()
        with quiet:
            reasons.append(DC.check_changed(bm, MID, rev, src_dir=srcd, out_dir=out, root=root,
                                            closure=(root, closure[1] + ["assets-src/tools/fake_gone.py"])).reason)
        limit, DC.FULL_ABOVE = DC.FULL_ABOVE, 4
        try:
            reasons.append(check(bm=bm).reason)
        finally:
            DC.FULL_ABOVE = limit
        reasons.append(check(bm=bm, full=True).reason)
        assert [r.split(":")[0].split(" >=")[0] for r in reasons] == [
            "compiler files changed since " + rev[:12]] * 3 + [f"painted {res.painted}", "--full"], reasons
        assert "fake_compiler.py" in reasons[0] and "fake_new.py" in reasons[1] and "fake_gone.py" in reasons[2], reasons
        cur = R.digests(edited, kit, 64, 48, B.footprint)
        doc = yaml.safe_load(DC.git(root, "show", f"{rev}:assets/maps/ai/{MID}.yaml").stdout)
        pure = {
            "no build.chunks": {**doc, "build": {"compiler": doc["build"]["compiler"]}},
            "the base is 32": {**doc, "width": 32},
            "the base has no build.runtime": {**doc, "build": {k: v for k, v in doc["build"].items() if k != "runtime"}},
            "the runtime differs": {**doc, "build": {**doc["build"], "runtime": {"python": "0"}}},
            "the compiler digest differs": {**doc, "build": {**doc["build"], "compiler": "0" * 16}},
        }
        for want_reason, b in pure.items():
            got = DC.fallback_reason(edited, b, cur, 64, 48, [], False, rev) or ""
            assert got.startswith(want_reason.replace("no build.chunks", "the base has no chunk digests")), (want_reason, got)
        assert DC.fallback_reason(edited, doc, cur, 64, 48, [], False, rev) is None
        assert len(full_ran) == 5, full_ran
        print(f"fallbacks: OK ({len(reasons) + len(pure)} cases run the full check, each with its reason)")
        ok += 1

        changed_name = f"below_{order[0][1]}_{order[0][0]}.png"
        other = next(p for p in sorted((out / MID).glob("below_*.png")) if p.name not in
                     {f"below_{r}_{c}.png" for c, r in want})
        saved = {p: p.read_bytes() for p in (out / MID / changed_name, other)}
        other.write_bytes(saved[other] + b"\0")
        B.save_chunk(B.compile_map(base, kit).below[:B.CHUNK * B.T, :B.CHUNK * B.T], out / MID / changed_name)
        res = check()
        for p, b in saved.items():
            p.write_bytes(b)
        assert not res.ok and any(other.name in e and "changed since" in e for e in res.errs) \
            and any(changed_name in e and "differs from the compile" in e for e in res.errs), res.errs
        print("stale: OK (a tampered unchanged chunk fails step 8; a stale changed chunk fails step 7)")
        ok += 1

        os.environ[DC.INJECT_ENV] = "1"
        try:
            res = check()
        finally:
            del os.environ[DC.INJECT_ENV]
        assert not res.ok and any("differs between PYTHONHASHSEED" in e for e in res.errs), res.errs
        assert check().ok
        print("seeds: OK (a seed-dependent paint fails step 6)")
        ok += 1

        f = root / "src.json"
        f.write_text(json.dumps(edited))
        run = subprocess.run([sys.executable, "-s", str(Path(B.__file__).resolve()), "--hash", "--src", str(f),
                              "--closure"], env={"PYTHONHASHSEED": "1", "FFG_WORLD_LOCK_HELD": "1"},
                             capture_output=True, text=True, check=True)
        cl = json.loads(run.stdout)["_closure"]
        assert cl["pre"] == cl["post"] and "assets-src/tools/build_map.py" in cl["pre"], cl
        print(f"closure: OK (the pre-compile closure equals the recorded one: {len(cl['pre'])} files)")
        ok += 1
    return ok
