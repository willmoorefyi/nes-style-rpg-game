"""EF-I self-tests (docs/ENEMY_FEEDBACK_PLAN.md EF-I), run from selftest.py (test_monster_anim, also --anim): the
review tool's `<id>_daze.gif` plays the in-game kneel track (src/scenes/battle/kneelChoreography.ts), its frame counts
live once in Python (monster_recipes) and are pinned to the TS constants, and the legacy daze frames are only a PNG
strip `<id>_daze_legacy.png`."""
from __future__ import annotations

import re
import tempfile
from pathlib import Path
from typing import Callable

from gen import monster_recipes as RC

GEN = Path(__file__).resolve().parent
TS = GEN.parent.parent / "src" / "scenes" / "battle" / "kneelChoreography.ts"
IDLE_HOLD = 24                                   # the review's idle lead-in and tail (frames at 60 fps)


def _ts_const(src: str, name: str) -> int | None:
    m = re.search(rf"export const {name} = (\d+);", src)
    return int(m.group(1)) if m else None


def _track_from_ts(src: str) -> list[tuple[str, int]] | None:
    """The review track derived from the TS numbers alone (in, two full hold periods, out, idle on both sides)."""
    i, o, p = (_ts_const(src, n) for n in ("KNEEL_IN_FRAMES", "KNEEL_OUT_FRAMES", "KNEEL_PERIOD"))
    if None in (i, o, p):
        return None
    return [("idle", IDLE_HOLD), ("kneel_in1", i // 2), ("kneel_in2", i - i // 2), ("kneel", p), ("kneel_b", p),
            ("kneel", p), ("kneel_b", p), ("kneel_in2", o // 2), ("kneel_in1", o - o // 2), ("idle", IDLE_HOLD)]


def run_review_daze(check: Callable[[bool, str], None]) -> None:
    from gen import kneel_review as KR
    from gen import monster_review as MR
    src = TS.read_text()
    for n in ("KNEEL_IN_FRAMES", "KNEEL_OUT_FRAMES", "KNEEL_PERIOD", "KNEEL_PHASE"):
        check(_ts_const(src, n) == getattr(RC, n, None), f"EF-I: Python {n} = TS {_ts_const(src, n)}")
    for branch in ("e < KNEEL_IN_FRAMES / 2 ? 'kneel_in1' : 'kneel_in2'",
                   "e < KNEEL_OUT_FRAMES / 2 ? 'kneel_in2' : 'kneel_in1'", "% 2 === 0 ? 'kneel' : 'kneel_b'"):
        check(branch in src, f"EF-I: KneelTrack.frame still has `{branch}`")
    want = _track_from_ts(src)
    check(want is not None and MR.TIMELINES["daze"] == want, f"EF-I: the review daze track is the TS kneel track "
          f"({MR.TIMELINES['daze']})")
    check(getattr(KR, "KNEEL_IN", None) is getattr(RC, "KNEEL_IN", 0)
          and getattr(KR, "KNEEL_OUT", None) is getattr(RC, "KNEEL_OUT", 0),
          "EF-I: kneel_review uses monster_recipes' KNEEL_IN / KNEEL_OUT")
    krs = (GEN / "kneel_review.py").read_text()
    check(not re.search(r"^KNEEL_PERIOD.*=\s*48", krs, re.M) and "KNEEL_IN = ((" not in krs,
          "EF-I: kneel_review.py types no kneel constant of its own")

    names = [n for n, _ in MR.TIMELINES["daze"]]
    full = set(names) | {"idle", "attack", "hurt", "hurt_in1", "daze", "daze_b"}
    dn = getattr(MR, "daze_names", lambda _h: None)
    check(dn(full) == names, f"EF-I: daze_names on an opted sheet is the track ({dn(full)})")
    check(dn({"idle", "attack", "hurt", "hurt_in1", "daze", "daze_b"}) ==
          ["idle", "idle", "daze", "daze", "daze_b", "daze", "daze_b", "daze", "idle", "idle"],
          "EF-I: daze_names on an unopted rigged sheet follows FALLBACK (kneel -> daze, kneel_in1 -> idle)")
    check(dn({"idle", "attack", "hurt"}) == ["idle"] * 10, "EF-I: daze_names without a rig is idle throughout")
    _render(check, MR)


def _render(check: Callable[[bool, str], None], MR) -> None:
    from PIL import Image, ImageChops
    from gen import monster_anim as MA
    sid = "goblin"
    _, meta, kfs = next(e for e in MA.load_entries() if e[0] == sid)
    cfg = MA.load_rig(sid)
    frames = {**kfs, **{n: Image.fromarray(f["img"], "RGBA") for n, f in MA.generate(sid, cfg, kfs, meta).items()}}
    check(all(n in frames for n in RC.KNEEL_FRAMES), "EF-I: goblin has its four kneel cells (AI kneel)")
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp)
        MR.review(sid, out=out)
        gif = out / f"{sid}_daze.gif"
        check(gif.exists() and (out / f"{sid}_daze_legacy.png").exists()
              and not (out / f"{sid}_daze_legacy.gif").exists(),
              "EF-I: <id>_daze.gif and <id>_daze_legacy.png written, no legacy GIF")
        if not gif.exists():
            return
        im = Image.open(gif)
        got, durs = [], []
        for k in range(getattr(im, "n_frames", 1)):
            im.seek(k)
            got.append(im.convert("RGB"))
            durs.append(im.info.get("duration"))
    track = MR.TIMELINES["daze"]
    check(durs == [10 * (round(n * 1000 / 60) // 10) for _, n in track],
          f"EF-I: goblin_daze.gif has the track's {len(track)} frames and durations ({durs})")
    L = MA.lunge_px(kfs["idle"]) // 2
    comp = getattr(MR, "gif_frame", None)
    if comp is None:
        check(False, "EF-I: monster_review.gif_frame (the GIF frame composer) exists")
        return
    same = lambda a, b: a.size == b.size and ImageChops.difference(a, b).getbbox() is None   # noqa: E731
    check(len(got) == len(track) and all(same(g, comp(frames[n], L)) for g, (n, _) in zip(got, track)),
          "EF-I: every goblin_daze.gif frame is its track cell (kneel_in1 / kneel_in2 / kneel / kneel_b, idle)")
    check(not any(same(g, comp(frames["daze"], L)) for g in got), "EF-I: the legacy daze cell is not in the GIF")
    real = MR.daze_names
    MR.daze_names = lambda have: ["idle"] * len(MR.TIMELINES["daze"])
    try:
        with tempfile.TemporaryDirectory() as tmp:
            MR.review(sid, out=Path(tmp))
            n = Image.open(Path(tmp) / f"{sid}_daze.gif").n_frames
    finally:
        MR.daze_names = real
    check(n == 1, f"EF-I: review() builds the daze GIF from daze_names (all idle -> 1 merged frame, got {n})")
