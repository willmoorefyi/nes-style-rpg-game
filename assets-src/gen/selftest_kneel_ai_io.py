"""Pass KA self-tests, part 2 (selftest_kneel_ai.run_kneel_ai): approve.py's overwrite gate on the kneel keys and
approve_kneel, retire_kneel (`<id>` and `--key`) on a temporary tree, and an approved kneel.png being unread by the
monster loader (no `source: ai` yet: nothing changes). All on temporary trees; the real approved/ is never written.
"""
from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path
from typing import Callable

import yaml
from PIL import Image

HERE = Path(__file__).resolve().parent


def _png(path: Path, colour) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGBA", (4, 4), colour).save(path)
    return path


def _approve(check) -> None:
    from gen import approve as AP
    from gen.selftest_colossus import _refused
    with tempfile.TemporaryDirectory() as t:
        app = Path(t) / "gen" / "approved"
        old, new = _png(app / "goblin" / "kneel.png", (1, 2, 3, 255)), _png(Path(t) / "new.png", (9, 9, 9, 255))
        r = _refused(lambda: AP.overwrite_gate("goblin", "kneel", new, app), "overwritten")
        check(bool(r), f"approve: an approved kneel.png is not overwritten without an archive copy ({r[:60]!r})")
        check(not _refused(lambda: AP.overwrite_gate("goblin", "kneel", old, app)), "approve: identical bytes pass")
        shutil.copytree(app / "goblin", app / "_retired" / "goblin_kneel_try1")
        check(not _refused(lambda: AP.overwrite_gate("goblin", "kneel", new, app)),
              "approve: a byte copy under _retired/<id>_kneel_try<N>/ lets the new key in")
        out = AP.approve_kneel("goblin", "kneel", new, {"arm": "b", "seed": 1234}, app)
        meta = json.loads(out.read_text())
        check((app / "goblin" / "kneel.png").read_bytes() == new.read_bytes() and meta["arm"] == "b"
              and "approved" in meta, "approve_kneel writes kneel.png + kneel.json (arm, seed, approved date)")
        hero = _png(app / "warrior" / "battle_kneel.png", (5, 5, 5, 255))
        check(bool(_refused(lambda: AP.overwrite_gate("warrior", "battle_kneel", new, app), "overwritten"))
              and hero.exists(), "approve: battle_kneel.png is gated the same way")


def _retire(check) -> None:
    from gen import retire_kneel as RK
    from gen.selftest_colossus import _refused
    with tempfile.TemporaryDirectory() as t:
        gen, index = Path(t) / "gen", Path(t) / "RETIRED.md"
        rigs = gen / "anim" / "monsters"
        rigs.mkdir(parents=True)
        (rigs / "goblin.yaml").write_text("sprite: goblin\nkneel: {}\n")
        (rigs / "goblin.lock.json").write_text("{}\n")
        frames = {n: f"png-{n}".encode() for n in ("kneel", "kneel_in1", "kneel_in2", "kneel_b")}
        row = RK.retire("goblin", gen, index, frames)
        arc = gen / "approved" / "_retired" / "goblin_kneel_v1"
        check(sorted(p.name for p in arc.iterdir()) == sorted(f"{n}.png" for n in frames)
              and (rigs / "_retired" / "goblin_kneel_v1.yaml").read_text() == (rigs / "goblin.yaml").read_text()
              and (rigs / "_retired" / "goblin_kneel_v1.lock.json").exists() and row in index.read_text(),
              "retire_kneel <id>: rig + lock + the 4 derived frames archived as goblin_kneel_v1, indexed")
        check(RK.retire("goblin", gen, index, frames) == row and index.read_text().count(row) == 1,
              "retire_kneel <id>: a re-run with identical bytes is a no-op")
        r = _refused(lambda: RK.retire("goblin", gen, index, {**frames, "kneel": b"other"}), "different")
        check(bool(r), f"retire_kneel <id>: refused when a target exists with different bytes ({r[:50]!r})")
        live = _png(gen / "approved" / "goblin" / "kneel.png", (7, 7, 7, 255))
        (gen / "approved" / "goblin" / "kneel.json").write_text("{}\n")
        data = live.read_bytes()
        RK.retire_key("goblin", 2, gen, index)
        tr = gen / "approved" / "_retired" / "goblin_kneel_try2"
        check((tr / "kneel.png").read_bytes() == data and (tr / "kneel.json").exists() and not live.exists(),
              "retire_kneel --key: the failed key moves to _kneel_try2 (byte copy first, then the live file goes)")


def _unread(check) -> None:
    """A sheet whose rig has no kneel block: approved/<id>/kneel.png beside it changes no loaded key or meta."""
    from gen import monster_anim as MA
    sid = next(p.stem for p in sorted(MA.RIGS.glob("*.yaml")) if "kneel" not in (yaml.safe_load(p.read_text()) or {})
               and list((MA.APPROVED / p.stem).glob("monster_*.json")))
    real = MA.APPROVED
    out = []
    try:
        for with_key in (False, True):
            with tempfile.TemporaryDirectory() as t:
                shutil.copytree(real / sid, Path(t) / sid)
                if with_key:
                    _png(Path(t) / sid / "kneel.png", (1, 1, 1, 255))
                    (Path(t) / sid / "kneel.json").write_text("{}\n")
                MA.APPROVED = Path(t)
                e = MA.load_entries()
                out.append([(s, sorted(m), {k: v.tobytes() for k, v in kf.items()}) for s, m, kf in e])
    finally:
        MA.APPROVED = real
    check(out[0] == out[1] and len(out[0]) == 1, f"an approved kneel.png without source: ai changes nothing ({sid})")


def run_io(check: Callable[[bool, str], None]) -> None:
    from gen.selftest_colossus import sections
    sections(check, _approve, _retire, _unread)
