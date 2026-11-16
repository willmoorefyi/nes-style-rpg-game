"""Cutter option `cut: {match_height: idle | <px>, tolerance: t}` (monsters.yaml, per sprite; user ruling 2026-11-16:
a generated pose is never rejected or regenerated only because it is too big or too small, the pipeline resizes it)
self-tests, run from selftest.py (test_monster_anim, also --anim). RED first: hollow_seraph R328 (boss_cast, key
1faaad62d498f39cd15c9c6c) was rejected for 183 px against the approved idle's 138 (ROSTER_LOG R328): the live cut
(keep_pieces all_in_cell + fit headroom, top_margin 10) leaves it 183 rows tall. With `match_height: idle` an action
pose of a per-pose sprite whose figure falls outside idle +- tolerance is scaled nearest-neighbour (the headroom shrink
path) to the nearest edge of that band, feet on the feet row, every piece kept; a pose inside the band, and the idle
itself, cut exactly as without the option. Without the option nothing changes (every approved monster / boss sheet's
cached raw cuts byte-identically; a representative set is pinned in selftest_headroom.BASELINE), and the option never
changes a request cache key, so a ledgered attempt re-cuts at 0 images and `approve.py` can approve it.

  python3 -I assets-src/gen/selftest_match.py
"""
from __future__ import annotations

import hashlib
import json
import sys
import tempfile
from pathlib import Path
from typing import Callable

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
FIX = HERE / "fixtures" / "cut"
# byte copy of the main checkout's cache/1faaad62d498f39cd15c9c6c.png (a rejected attempt, git-ignored there)
R328 = ("hollow_seraph_R328.png", "72e73eff5900746408540a743003e5268e090eba90909f51133d4d2c4cecbd28",
        "1faaad62d498f39cd15c9c6c", 1239, "boss_cast")
IDLE_PX = 138            # the approved hollow_seraph boss_idle (R324): rows 55-192
R328_DEFAULT_PX = 183    # ROSTER_LOG R328: the live cut, rows 10-192
ATTACK = ("b7055e3da595a02e0f382ecb", 1240)   # the approved boss_attack (R326), 150 px: inside 138 +- 10 %
RENDER_MIN = 40          # a render piece counts at >= 40 native px (ROSTER_LOG piece checks, rev 13)
PIECE_MIN = 24           # monster.KEEP_MIN_PX: a cut piece counts at >= 24 px


def _digest(frames: list[Image.Image]) -> str:
    h = hashlib.sha256()
    for f in frames:
        h.update(str(f.size).encode())
        h.update(np.asarray(f).tobytes())
    return h.hexdigest()[:24]


def _rows(frame: Image.Image) -> tuple[int, int]:
    ys = np.where(np.asarray(frame)[..., 3].any(1))[0]
    return int(ys.min()), int(ys.max())


def _pieces(frame: Image.Image, least: int) -> list[int]:
    from gen import pixelize as PX
    lab, _ = PX.components(np.asarray(frame)[..., 3] > 0)
    return sorted((s for s in np.bincount(lab.ravel())[1:].tolist() if s >= least), reverse=True)


SURVIVE = 0.8            # a default-cut piece survives when this share of its pixels, mapped, lands on the re-cut


def _survive(a: Image.Image, b: Image.Image) -> list[float]:
    """Per piece (>= PIECE_MIN px) of frame `a`: the share of its pixels that, mapped into frame `b` by the height ratio
    about the figure's bottom row and horizontal centre (the cutter's anchors), land on an opaque pixel of `b` (+-1 px)."""
    from gen import pixelize as PX
    ma, mb = np.asarray(a)[..., 3] > 0, np.asarray(b)[..., 3] > 0
    (ta, ba), (tb, bb) = _rows(a), _rows(b)
    r = (bb - tb + 1) / (ba - ta + 1)
    xa, xb = np.where(ma.any(0))[0], np.where(mb.any(0))[0]
    ca, cb = (xa.min() + xa.max() + 1) / 2, (xb.min() + xb.max() + 1) / 2
    grown = mb.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            grown |= np.roll(np.roll(mb, dy, 0), dx, 1)
    lab, n = PX.components(ma)
    out = []
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if len(ys) < PIECE_MIN:
            continue
        y2 = np.clip(np.round(bb - (ba - ys) * r).astype(int), 0, mb.shape[0] - 1)
        x2 = np.clip(np.round(cb + (xs + 0.5 - ca) * r - 0.5).astype(int), 0, mb.shape[1] - 1)
        out.append(round(float(grown[y2, x2].mean()), 2))
    return out


def _cut(raw: Image.Image, sheet: str, char: dict, seed: int) -> tuple[list[Image.Image], dict]:
    from gen import generate as GEN
    frames = GEN.cut_frames(raw, Image.new("RGB", (4, 4)), GEN.SHEETS[sheet], char, seed)
    return frames, dict(GEN.LAST_RESAMPLE[sheet])


def _with(char: dict, **opts) -> dict:
    ch = json.loads(json.dumps(char))
    ch["cut"] = {**(ch.get("cut") or {}), **opts}
    return ch


def run_match(check: Callable[[bool, str], None]) -> None:
    from gen import generate as GEN
    from gen import monster as M
    from gen import pixelize as PX

    # the option's schema: idle or a px reference, a tolerance (default 0.10), per-pose sprites only, combinable
    base = {"id": "x", "per_pose": True}
    try:
        good = (M.cut_match(base) is None
                and M.cut_match({**base, "cut": {"match_height": "idle"}}) == ("idle", 0.10)
                and M.cut_match({**base, "cut": {"match_height": "idle", "tolerance": 0.05}}) == ("idle", 0.05)
                and M.cut_match({**base, "cut": {"match_height": 150, "tolerance": 0.2}}) == (150, 0.2)
                and M.cut_match({**base, "cut": {"match_height": "idle", "keep_pieces": "all_in_cell", "fit": "headroom",
                                                 "top_margin": 10}}) == ("idle", 0.10)
                and M.cut_options({**base, "cut": {"match_height": "idle", "keep_pieces": "all_in_cell"}}) == "all_in_cell"
                and M.cut_fit({**base, "cut": {"match_height": "idle", "fit": "headroom", "top_margin": 10}}) == 10)
    except (AttributeError, ValueError) as e:
        good = False
        print(f"  info schema: {e!r}")
    check(good, "match: `cut: {match_height: idle | px, tolerance: t}` reads (ref, t), default t 0.10, combines with "
                "keep_pieces and fit headroom")
    for bad in ({"match_height": "attack"}, {"match_height": 0}, {"match_height": 301}, {"match_height": True},
                {"match_height": 140.5}, {"tolerance": 0.1}, {"match_height": "idle", "tolerance": 0},
                {"match_height": "idle", "tolerance": 0.6}, {"match_height": "idle", "tolerance": "0.1"},
                {"match_height": "idle", "tolerance": True}):
        try:
            M.cut_match({**base, "cut": bad})
            refused = False
        except ValueError as e:
            refused = "x" in str(e)
        except AttributeError:
            refused = False
        check(refused, f"match: `cut: {bad!r}` is refused naming the sprite")
    try:
        M.cut_match({"id": "x", "cut": {"match_height": "idle"}})
        refused = False
    except ValueError as e:
        refused = "per_pose" in str(e)
    except AttributeError:
        refused = False
    check(refused, "match: match_height on a sprite without per_pose (three-cell monster sheet) is refused")

    # the reference: the approved idle's figure height; the idle itself has no reference (it is the reference)
    sera = GEN.load_character("hollow_seraph")
    # the plain entry: the live one minus match_height / tolerance (the live seraph now opts in, R331)
    sera = {**sera, "cut": {k: v for k, v in (sera.get("cut") or {}).items() if k not in ("match_height", "tolerance")}}
    opt = _with(sera, match_height="idle")
    try:
        ref_cast = GEN.match_ref(opt, "boss_cast")
        ref_idle = GEN.match_ref(opt, "boss_idle")
        ref_none = GEN.match_ref(sera, "boss_cast")
        ref_px = GEN.match_ref(_with(sera, match_height=175, tolerance=0.1), "boss_attack")
    except (AttributeError, ValueError) as e:
        ref_cast = ref_idle = ref_none = ref_px = repr(e)
    check(ref_cast == (IDLE_PX, 0.10) and ref_idle is None and ref_none is None and ref_px == (175, 0.1),
          f"match: the reference is the approved idle's {IDLE_PX} px for an action pose, none for the idle or without "
          f"the option, a px value as given ({ref_cast}, {ref_idle}, {ref_none}, {ref_px})")
    try:
        GEN.match_ref({"id": "no_such_sprite", "per_pose": True, "cut": {"match_height": "idle"}}, "boss_cast")
        refused = False
    except ValueError as e:
        refused = "boss_idle" in str(e)
    except AttributeError:
        refused = False
    check(refused, "match: match_height idle without an approved boss_idle is refused naming the missing idle")

    # R328: RED (the live cut is 183 px, outside 138 +- 10 %), GREEN (re-cut inside the band, nothing clipped, pieces)
    fix, sha, key, seed, sheet = R328
    raw_b = (FIX / fix).read_bytes() if (FIX / fix).exists() else b""
    check(hashlib.sha256(raw_b).hexdigest() == sha, f"match: the R328 fixture is the cached render ({fix})")
    raw = Image.open(FIX / fix).convert("RGBA")
    d, dinfo = _cut(raw, sheet, sera, seed)
    t0, b0 = _rows(d[0])
    check(b0 - t0 + 1 == R328_DEFAULT_PX and b0 - t0 + 1 > IDLE_PX * 1.1 and "match" not in dinfo,
          f"match RED: the live cut of R328 is {b0 - t0 + 1} px (rows {t0}-{b0}), outside {IDLE_PX} +- 10 %")
    try:
        fr, info = _cut(raw, sheet, opt, seed)
    except (ValueError, TypeError, AttributeError) as e:
        check(False, f"match: R328 re-cut with match_height idle ({e!r})")
        fr, info = d, {}
    t1, b1 = _rows(fr[0])
    h1 = b1 - t1 + 1
    geom = M.S.pose_geom(sera.get("size"))
    mt = info.get("match") or {}
    check(IDLE_PX * 0.9 <= h1 <= IDLE_PX * 1.1 and b1 == geom.bottom_row and t1 >= 10 and info.get("clipped") == []
          and fr[0].size[1] == geom.grid[1] and mt.get("ref") == IDLE_PX and mt.get("height") == h1
          and info.get("shrink") == "nearest-neighbour (match_height)",
          f"match GREEN: R328 re-cut is {h1} px (rows {t1}-{b1}, feet row {geom.bottom_row}), within {IDLE_PX} +- 10 %, "
          f"cell {fr[0].size}, clipped {info.get('clipped')}, scale {info.get('scale')}, match {mt}")
    native, _ = M.native_art(raw, guide_width=M.S.MONSTER_POSE_GUIDE[0])
    nlab, _ = PX.components(M._foreground(np.asarray(native.convert("RGB"))))
    render = int((np.bincount(nlab.ravel())[1:] >= RENDER_MIN).sum())
    p0, p1 = _pieces(d[0], PIECE_MIN), _pieces(fr[0], PIECE_MIN)
    cover = _survive(d[0], fr[0])
    check(len(p1) >= render and min(cover) >= SURVIVE and info.get("keep_pieces") == "all_in_cell",
          f"match: R328 render pieces >= {RENDER_MIN} px {render}, re-cut pieces >= {PIECE_MIN} px {p1} (default cut "
          f"{p0}; a shrink may join two pieces, e.g. a halo arc to the helm); every default-cut piece survives: "
          f"{cover} of its pixels land on the re-cut (>= {SURVIVE})")
    rep = info.get("report", {})
    print(f"  info R328 re-cut: {json.dumps({'height': h1, 'rows': [t1, b1], 'scale': info.get('scale'), 'match': mt, 'pieces': p1, 'colours': rep.get('colours'), 'edges_ok': rep.get('edges_ok'), 'fit': info.get('fit')})}")

    # inside the band and the idle: byte-identical with the option
    idle_meta = json.loads((GEN.HERE / "approved" / "hollow_seraph" / "boss_idle.json").read_text())
    iraw = Image.open(GEN.CACHE / f"{idle_meta['cache_key']}.png").convert("RGBA")
    i0, _ = _cut(iraw, "boss_idle", sera, idle_meta["seed"])
    i1, iinfo = _cut(iraw, "boss_idle", opt, idle_meta["seed"])
    check(_digest(i0) == _digest(i1) and "match" not in iinfo and _rows(i0[0])[1] - _rows(i0[0])[0] + 1 == IDLE_PX,
          "match: the approved idle cuts byte-identically with the option (it is the reference)")
    araw = Image.open(GEN.CACHE / f"{ATTACK[0]}.png").convert("RGBA")
    a0, _ = _cut(araw, "boss_attack", sera, ATTACK[1])
    a1, ainfo = _cut(araw, "boss_attack", opt, ATTACK[1])
    ah = _rows(a0[0])[1] - _rows(a0[0])[0] + 1
    check(_digest(a0) == _digest(a1) and ainfo.get("match", {}).get("height") == ah and "target" not in ainfo["match"],
          f"match: the approved attack ({ah} px, inside {IDLE_PX} +- 10 %) cuts byte-identically with the option")

    # a small pose: nearest upscale to the band's lower edge (reference 175 px: band 157.5-192.5, headroom 10 caps 183)
    try:
        u, uinfo = _cut(araw, "boss_attack", _with(sera, match_height=175, tolerance=0.1), ATTACK[1])
        ut, ub = _rows(u[0])
        um = uinfo.get("match", {})
        check(175 * 0.9 <= ub - ut + 1 <= 175 * 1.1 and ub == geom.bottom_row and ut >= 10 and uinfo.get("clipped") == []
              and uinfo.get("scale", 0) > 1.0 and len(_pieces(u[0], PIECE_MIN)) == len(_pieces(a0[0], PIECE_MIN))
              and min(_survive(a0[0], u[0])) >= SURVIVE and um.get("height") == ub - ut + 1,
              f"match: a {ah} px pose with reference 175 is upscaled nearest to {ub - ut + 1} px (rows {ut}-{ub}), "
              f"scale {uinfo.get('scale')}, match {um}, pieces {_pieces(u[0], PIECE_MIN)}")
    except (ValueError, TypeError, AttributeError) as e:
        check(False, f"match: upscale re-cut ({e!r})")

    # approvable at 0 images: the live entry re-plans R328's key with and without the option; --repixelize agrees
    k0 = GEN.plan_request(sera, GEN.SHEETS[sheet], seed, "gemini", None).key
    k1 = GEN.plan_request(opt, GEN.SHEETS[sheet], seed, "gemini", None).key
    check(k0 == k1 == key, f"match: R328's entry re-plans key {key} with and without the option ({k0}, {k1})")
    with tempfile.TemporaryDirectory() as td:
        (Path(td) / f"{key}.png").write_bytes(raw_b)
        got = GEN.recut_source(opt, sheet, seed, raw_b, Path(td))
        check(got[:2] == (key, True), f"match: --repixelize reports the R328 re-cut approvable {got}")
    metas = {f"{p.parent.name}/{p.stem}": json.loads(p.read_text()) for p in sorted((GEN.HERE / "approved").glob("*/*.json"))}
    moved = []
    for sid, meta in sorted(metas.items()):
        if not meta.get("sheet", "").startswith(("monster_", "boss_")) or meta.get("revived_from"):
            continue
        ch = GEN.load_character(meta["character"])
        a = GEN.plan_request(ch, GEN.SHEETS[meta["sheet"]], meta["seed"], "gemini", meta["model"]).key
        b = GEN.plan_request(_with(ch, match_height="idle", tolerance=0.1),
                             GEN.SHEETS[meta["sheet"]], meta["seed"], "gemini", meta["model"]).key
        if a != b:
            moved.append(sid)
    check(not moved, f"match: adding the option never changes an approved monster request's cache key {moved[:3]}")

    # no change without the option: the pinned representative approved cuts are byte-identical, no match info
    from gen import selftest_headroom as SHr
    bad = []
    for name, (k, s, want) in sorted(SHr.BASELINE.items()):
        cid, sh = name.split("/")
        frs = GEN.cut_frames(Image.open(GEN.CACHE / f"{k}.png").convert("RGBA"), Image.new("RGB", (4, 4)),
                             GEN.SHEETS[sh], GEN.load_character(cid), s)
        if _digest(frs) != want or "match" in GEN.LAST_RESAMPLE[sh]:
            bad.append(name)
    check(not bad, f"match: without the option the {len(SHr.BASELINE)} pinned approved cuts are byte-identical {bad}")


if __name__ == "__main__":
    fails: list[str] = []

    def _check(cond: bool, msg: str) -> None:
        print(("  ok   " if cond else "  FAIL ") + msg)
        if not cond:
            fails.append(msg)
    run_match(_check)
    print(f"\n{'ALL PASSED' if not fails else f'{len(fails)} FAILED'}")
    sys.exit(1 if fails else 0)
