"""FW-H self-tests (orchestrator ruling for hollow_seraph after R329 / R330: its boss_hurt renders keep adding a fifth
blade, so the hurt is built from the idle at 0 images), run from selftest.py (test_monster_anim, also --anim). A rig
`hurt_from: idle` (allowlisted sprites only, monster_keys.HURT_FROM_ALLOW) makes a per-pose boss with approved idle and
attack but no approved boss_hurt complete: the hurt key is the (padded) idle key, which the rig's `key_offset` and
keyframe `paint` may then edit for a recoil; the hurt in-betweens and daze are generated as usual and the lock holds
the derived key as `kf:hurt`. RED first: without the option such a boss is "boss poses incomplete, skipped". The
fixture tree is death_eye's approved idle / attack / cast under the allowlisted id (its rig, hurt joints = idle's);
nothing in approved/ is written. Every other sheet is untouched (no live rig but the allowlisted has `hurt_from`; the
atlas build and `check --all` are byte-identical / OK).

  python3 -I assets-src/gen/selftest_hurtfrom.py
"""
from __future__ import annotations

import contextlib
import copy
import io
import json
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Callable

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import yaml

SID = "hollow_seraph"          # the allowlisted id the fixture tree is written under
SRC = "death_eye"              # a rigged per-pose floating boss with idle, attack, hurt, cast


def _tree(root: Path, poses: tuple[str, ...], sid: str = SID) -> None:
    from gen import monster_anim as MA
    d = root / sid
    d.mkdir(parents=True)
    for p in poses:
        meta = json.loads((MA.APPROVED / SRC / f"boss_{p}.json").read_text())
        meta["character"] = sid
        (d / f"boss_{p}.json").write_text(json.dumps(meta))
        shutil.copyfile(MA.APPROVED / SRC / f"boss_{p}.png", d / f"boss_{p}.png")


def _cfg(**extra) -> dict:
    from gen import monster_anim as MA
    cfg = yaml.safe_load((MA.RIGS / f"{SRC}.yaml").read_text())
    cfg["sprite"] = SID
    cfg["keyframes"]["hurt"] = dict(cfg["keyframes"]["idle"])
    for n in ("hurt_in1", "hurt_in2"):              # death_eye's moves are tuned to its own hurt key, not the idle
        cfg["frames"].pop(n, None)
    cfg.update(copy.deepcopy(extra))
    return cfg


@contextlib.contextmanager
def _patched(root: Path, cfgs: dict[str, dict | None]):
    from gen import monster_anim as MA
    from gen import monster_keys as MK
    real_a, real_r = MA.APPROVED, MA.load_rig
    MA.APPROVED = root
    MA.load_rig = lambda s: MK.offset_cfg(s, copy.deepcopy(cfgs[s])) if s in cfgs and cfgs[s] is not None else None
    try:
        yield
    finally:
        MA.APPROVED, MA.load_rig = real_a, real_r


def _load(root: Path, cfgs: dict[str, dict | None]) -> tuple[list, str, str | None]:
    """(entries, printed text, error) of load_entries over the fixture tree."""
    from gen import monster_anim as MA
    buf = io.StringIO()
    with _patched(root, cfgs), contextlib.redirect_stdout(buf):
        try:
            return MA.load_entries(), buf.getvalue(), None
        except ValueError as e:
            return [], buf.getvalue(), str(e)


def run_hurt_from(check: Callable[[bool, str], None]) -> None:
    from gen import monster_anim as MA
    from gen import monster_check as MC
    from gen import monster_keys as MK

    with tempfile.TemporaryDirectory() as td:
        root = Path(td) / "approved"
        _tree(root, ("idle", "attack", "cast"))
        # RED: idle + attack + cast, no hurt, no option: incomplete, skipped
        ents, out, err = _load(root, {SID: _cfg()})
        check(not ents and err is None and f"{SID} boss poses incomplete, skipped" in out,
              f"hurt_from RED: without the option a boss with no approved hurt is skipped ({out.strip()!r}, {err})")

        # GREEN: hurt_from idle -> complete, the hurt key is the padded idle key, marked derived
        ents, out, err = _load(root, {SID: _cfg(hurt_from="idle")})
        got = [e for e in ents if e[0] == SID]
        ok = bool(got) and err is None and "incomplete" not in out
        meta, kfs = (got[0][1], got[0][2]) if got else ({}, {})
        check(ok and "hurt" in kfs and np.array_equal(np.asarray(kfs["hurt"]), np.asarray(kfs["idle"]))
              and kfs["hurt"] is not kfs["idle"] and meta.get("kf_derived") == {"hurt": "idle"}
              and meta.get("poses", [])[:3] == ["idle", "attack", "hurt"] and "cast" in meta.get("poses", []),
              f"hurt_from: with `hurt_from: idle` the boss is complete, hurt = the idle key ({out.strip()!r}, {err}, "
              f"poses {meta.get('poses')}, derived {meta.get('kf_derived')})")
        if ok:
            cfg = MK.offset_cfg(SID, _cfg(hurt_from="idle"))
            gen = MA.generate(SID, cfg, kfs, meta)
            need = ("hurt_in1", "hurt_in2", "daze", "daze_b")
            check(all(n in gen for n in need), f"hurt_from: the hurt in-betweens and daze are generated "
                                               f"{[n for n in need if n not in gen]} missing")
            lf = MC.lock_frames(gen, kfs, meta)
            check("kf:hurt" in lf and np.array_equal(lf["kf:hurt"], np.asarray(kfs["idle"].convert("RGBA"))),
                  "hurt_from: the lock holds the derived key as kf:hurt")
            rep = MC.check_sprite(SID, cfg, kfs, meta, gen, with_lock=False)
            bad = {k: v for k, v in rep.items() if v and (k.startswith(("hurt", "daze", "sequence:hurt",
                                                                        "sequence:daze", "kf:")))}
            check(not bad, f"hurt_from: the hurt / daze frames and sequences pass the checks {bad}")

        # the recoil: key_offset and keyframe paint act on the derived key only (paint xy in the unmoved art, FW-O)
        dx, dy = 3, 2
        a_idle = np.asarray(kfs["idle"].convert("RGBA")) if kfs else np.zeros((1, 1, 4), np.uint8)
        ys, xs = np.nonzero(a_idle[..., 3] > 0)
        y0, x0 = (int(ys[len(ys) // 2]), int(xs[len(xs) // 2])) if len(ys) else (0, 0)
        rgb = [int(c) for c in a_idle[y0, x0, :3]]
        ents, _, err = _load(root, {SID: _cfg(hurt_from="idle", key_offset={"hurt": [dx, dy]},
                                              paint=[{"frame": "hurt", "xy": [[x0, y0]], "rgb": None}])})
        got = [e for e in ents if e[0] == SID]
        if got:
            m2, k2 = got[0][1], got[0][2]
            h = np.asarray(k2["hurt"].convert("RGBA"))
            want = np.zeros_like(a_idle)
            H, W = a_idle.shape[:2]
            want[dy:, dx:] = a_idle[:H - dy, :W - dx]
            want[y0 + dy, x0 + dx] = 0
            check(np.array_equal(h, want) and np.array_equal(np.asarray(k2["idle"].convert("RGBA")), a_idle)
                  and "hurt" in m2.get("kf_offset", []) and "hurt" in m2.get("kf_painted", []) and rgb is not None,
                  "hurt_from: key_offset and keyframe paint edit the derived hurt key (the idle key unchanged)")
        else:
            check(False, f"hurt_from: key_offset / paint on the derived hurt ({err})")

        # refusals, each naming the rig: a sprite off the allowlist, a source other than idle, an approved hurt
        other = Path(td) / "other"
        _tree(other, ("idle", "attack", "cast"), sid=SRC)
        cfg_src = {**_cfg(hurt_from="idle"), "sprite": SRC}
        _, _, e1 = _load(other, {SRC: cfg_src})
        _, _, e2 = _load(root, {SID: _cfg(hurt_from="attack")})
        full = Path(td) / "full"
        _tree(full, ("idle", "attack", "hurt", "cast"))
        _, _, e3 = _load(full, {SID: _cfg(hurt_from="idle")})
        check(bool(e1) and SRC in e1 and "HURT_FROM_ALLOW" in e1, f"hurt_from: off the allowlist is refused ({e1})")
        check(bool(e2) and SID in e2 and "idle" in e2, f"hurt_from: a source other than idle is refused ({e2})")
        check(bool(e3) and SID in e3 and "boss_hurt" in e3, f"hurt_from: with an approved boss_hurt it is refused ({e3})")
        # a full boss without the option is loaded exactly as before (the same hurt key as approved)
        ents, out, err = _load(full, {SID: _cfg()})
        got = [e for e in ents if e[0] == SID]
        check(bool(got) and "kf_derived" not in got[0][1] and err is None,
              "hurt_from: a boss with an approved hurt and no option loads unchanged (no derived key)")

    # the allowlist is exactly the ruling's, and no live rig outside it has the option
    check(getattr(MK, "HURT_FROM_ALLOW", None) == {"hollow_seraph"},
          f"hurt_from: HURT_FROM_ALLOW is exactly {{hollow_seraph}} ({getattr(MK, 'HURT_FROM_ALLOW', None)})")
    live = sorted(p.stem for p in MA.RIGS.glob("*.yaml") if "hurt_from" in (yaml.safe_load(p.read_text()) or {}))
    check(set(live) <= {"hollow_seraph"}, f"hurt_from: only allowlisted live rigs use it {live}")


if __name__ == "__main__":
    fails: list[str] = []

    def _check(cond: bool, msg: str) -> None:
        print(("  ok   " if cond else "  FAIL ") + msg)
        if not cond:
            fails.append(msg)
    run_hurt_from(_check)
    print(f"\n{'ALL PASSED' if not fails else f'{len(fails)} FAILED'}")
    sys.exit(1 if fails else 0)
