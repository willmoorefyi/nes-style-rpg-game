"""Cutter option `cut: {keep_pieces: all_in_cell}` (monsters.yaml, per sprite; orchestrator ruling for hollow_seraph,
ROSTER_LOG R298) self-tests, run from selftest.py (test_monster_anim, also --anim). RED first: the default figure mask
keeps only the largest blob and the blobs near its box, so the seraph's deliberately separate helm, halo and blade wings
are dropped (R298: 14 pieces in the render, 7 in the cut); with the option every in-cell piece survives, while specks,
thin guide lines and pieces touching the cell border (a neighbouring cell's bleed, a painted guide frame) are still
dropped. Without the option nothing changes: the cuts of a representative set of approved sheets' cached raws are
byte-identical to digests taken at b75421a (before the option), and adding the option to an entry never changes its
request cache key (the prompt reads named fields only).

  python3 -I assets-src/gen/selftest_pieces.py
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path
from typing import Callable

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
# a byte copy of the main checkout's cache/6b3cd582d2f7124a9a10aee0.png (R298, hollow_seraph boss_idle seed 1235;
# rejected, so its cache file is git-ignored there)
R298 = HERE / "fixtures" / "cut" / "hollow_seraph_R298.png"
R298_SHA = "9a47e3b5d61f2aed9a439aeeb32468f63f2350e4a991623768d07b257dd34c5d"
R298_PIECES = 14             # the render's pieces >= 40 native px: 4 wings, helm, 2 halo arcs, 2 shoulder plates,
                             # 2 cuirass halves, 2 gauntlets, the skirt (ROSTER_LOG R298 piece check)
R298_DEFAULT = 7             # what the default figure mask keeps (helm, halo and three of the four wings dropped)
OPT = {"keep_pieces": "all_in_cell"}

# sha256[:24] of the cut frames (size + RGBA bytes) of approved sheets' cached raws through generate.cut_frames, taken
# at b75421a before the option existed (/tmp/vfw2/digest_all.py over every approved monster_* / boss_* sheet; the same
# run after the change matched all 155). A representative set, none of them a pass-V id: small, large and boss bands,
# floating (ghost, shark, death_eye), haze (lich), a heavy raise, act 1. {sheet: (cache key, seed, digest)}; the raw is
# read by its pinned key, so a later re-approval of the sheet does not break the pin.
BASELINE: dict[str, tuple[str, int, str]] = {
    "goblin/monster_small": ("cf039eec8f545b954bc9f3ef", 1234, "eeccdcd2edf1aee543b0afbd"),
    "wolf/monster_small": ("9ffa03946d95c1b1214cf6d6", 1234, "00f0166733c8dcf123be784d"),
    "ghost/monster_small": ("fdd556a102b3f75c95f6a6a9", 1234, "e8fbf4a9a1eb19602defe051"),
    "chimera/monster_large": ("4d9375967aedd0303d70b172", 1236, "dd3e729fce7db9147c78b9f2"),
    "shark/monster_large": ("19e8401d0ee9d9b082d4378f", 1236, "da5bd55f58cf4e9291a983ae"),
    "garland/boss_idle": ("725729407d8e4ff145f82e12", 1234, "eea0ad0d99fb47390ffde4d2"),
    "garland/boss_attack_raise": ("f98cf659f26ded791c9fb262", 1235, "e3bc540c826b15bc985746c6"),
    "lich/boss_idle": ("a93fe92cbfc51785f137d1f6", 1234, "591439e1339930ef5ffe6273"),
    "death_eye/boss_idle": ("5560f540ccfddbd1a3870cbb", 1234, "1ad9f64cf1e6192c1927d87e"),
}


def _digest(frames: list[Image.Image]) -> str:
    h = hashlib.sha256()
    for f in frames:
        h.update(str(f.size).encode())
        h.update(np.asarray(f).tobytes())
    return h.hexdigest()[:24]


def _pieces(frame: Image.Image) -> list[int]:
    from gen import pixelize as PX
    lab, _ = PX.components(np.asarray(frame)[..., 3] > 0)
    return sorted(np.bincount(lab.ravel())[1:].tolist(), reverse=True)


def _synthetic() -> np.ndarray:
    """One native cell on magenta: a main body, a floating piece far outside its box (kept only by the option), a
    10 px speck, a piece touching the left border (neighbour bleed) and a 1 px guide line (both modes drop those)."""
    a = np.zeros((120, 120, 3), np.uint8)
    a[:] = (255, 0, 255)

    def blob(y0: int, y1: int, x0: int, x1: int, fill: tuple[int, int, int]) -> None:
        a[y0:y1, x0:x1] = (0, 0, 0)
        a[y0 + 1:y1 - 1, x0 + 1:x1 - 1] = fill
    blob(60, 110, 50, 80, (60, 140, 60))          # the body: box x 50-79, y 60-109
    blob(5, 20, 5 + 90, 20 + 90, (200, 180, 60))   # a floating crown piece up and right, far outside the box + 15 %
    a[30:32, 20:25] = (0, 0, 0)                    # a speck (10 px)
    blob(40, 60, 0, 12, (90, 90, 200))             # touches the left border
    a[115, 10:110] = (0, 0, 0)                     # a thin line
    return a


def run_pieces(check: Callable[[bool, str], None]) -> None:
    from gen import generate as GEN
    from gen import monster as M
    from gen import pixelize as PX

    # the option's schema
    check(M.cut_options({"id": "x"}) is None and M.cut_options({"id": "x", "cut": OPT}) == "all_in_cell",
          "keep_pieces: no `cut` block is None, `cut: {keep_pieces: all_in_cell}` is all_in_cell")
    for bad in ({"keep_pieces": "all"}, {"keep_pieces": "all_in_cell", "x": 1}, "all_in_cell", {"keeppieces": 1}):
        try:
            M.cut_options({"id": "x", "cut": bad})
            ok = False
        except ValueError as e:
            ok = "x" in str(e)
        check(ok, f"keep_pieces: `cut: {bad!r}` is refused naming the sprite")

    # synthetic cell: what each mode keeps
    a = _synthetic()
    lab, n = PX.components(M._foreground(a))
    d, k = M._figure_mask(a), M._figure_mask(a, keep_pieces="all_in_cell")
    kept = lambda m: sorted(int(i) for i in np.unique(lab[m]) if i)       # noqa: E731
    body, crown = int(lab[85, 65]), int(lab[12, 102])
    check(kept(d) == [body], f"keep_pieces RED: the default mask drops a floating piece far outside the body's box "
                             f"({kept(d)} of {n})")
    check(kept(k) == sorted([body, crown]), f"keep_pieces: all_in_cell keeps the body and the floating piece, drops the "
                                            f"speck, the border-touching piece and the thin line ({kept(k)} of {n})")

    # R298 (the real render): every planned piece survives the option
    raw_bytes = R298.read_bytes() if R298.exists() else b""
    check(hashlib.sha256(raw_bytes).hexdigest() == R298_SHA, f"keep_pieces: the R298 fixture is the cached render ({R298})")
    raw = Image.open(R298).convert("RGBA")
    native, _ = M.native_art(raw, guide_width=M.S.MONSTER_POSE_GUIDE[0])
    nlab, _ = PX.components(M._foreground(np.asarray(native.convert("RGB"))))
    big = int((np.bincount(nlab.ravel())[1:] >= 40).sum())
    check(big == R298_PIECES, f"keep_pieces: the R298 render has {R298_PIECES} pieces >= 40 native px ({big})")
    char = {k: v for k, v in GEN.load_character("hollow_seraph").items() if k != "cut"}  # the plain cut, whatever the live entry opts into
    sheet = GEN.SHEETS["boss_idle"]
    plain = GEN.cut_frames(raw, Image.new("RGB", (4, 4)), sheet, char, 1235)
    pinfo = dict(GEN.LAST_RESAMPLE["boss_idle"])
    opt = GEN.cut_frames(raw, Image.new("RGB", (4, 4)), sheet, {**char, "cut": OPT}, 1235)
    oinfo = dict(GEN.LAST_RESAMPLE["boss_idle"])
    pp, po = _pieces(plain[0]), _pieces(opt[0])
    check(len(pp) == R298_DEFAULT and "keep_pieces" not in pinfo,
          f"keep_pieces RED: the default cut of R298 keeps {R298_DEFAULT} pieces (helm, halo, 3 wings dropped) ({pp})")
    check(len(po) == R298_PIECES and min(po) >= 40 and oinfo.get("keep_pieces") == "all_in_cell"
          and oinfo.get("mode") == "grid" and oinfo.get("scale") == 1.0,
          f"keep_pieces: with the option all {R298_PIECES} R298 pieces survive the cut, grid mode, scale 1.0 ({po})")
    print(f"  info R298 with keep_pieces: cell {opt[0].size}, native height {oinfo.get('native_heights')}, clipped "
          f"{oinfo.get('clipped')} (the render is taller than the boss cell: not approvable as drawn)")

    # no change without the option: approved cuts byte-identical, request keys unchanged with the option added
    metas = {f"{p.parent.name}/{p.stem}": json.loads(p.read_text()) for p in sorted((GEN.HERE / "approved").glob("*/*.json"))}
    bad = []
    for name, (key, seed, want) in sorted(BASELINE.items()):
        cid, sheet = name.split("/")
        fr = GEN.cut_frames(Image.open(GEN.CACHE / f"{key}.png").convert("RGBA"), Image.new("RGB", (4, 4)),
                            GEN.SHEETS[sheet], GEN.load_character(cid), seed)
        if _digest(fr) != want or "keep_pieces" in GEN.LAST_RESAMPLE[sheet]:
            bad.append(name)
    check(len(BASELINE) >= 8 and not bad, f"keep_pieces: without the option the {len(BASELINE)} representative approved "
                                          f"cuts are byte-identical to b75421a {bad}")
    moved = []
    for sid, meta in sorted(metas.items()):
        if not meta.get("sheet", "").startswith(("monster_", "boss_")) or meta.get("revived_from"):
            continue
        ch = GEN.load_character(meta["character"])
        k0 = GEN.plan_request(ch, GEN.SHEETS[meta["sheet"]], meta["seed"], "gemini", meta["model"]).key
        k1 = GEN.plan_request({**ch, "cut": OPT}, GEN.SHEETS[meta["sheet"]], meta["seed"], "gemini", meta["model"]).key
        if k0 != k1:
            moved.append(sid)
    check(not moved, f"keep_pieces: adding the option never changes an approved monster request's cache key {moved[:3]}")


if __name__ == "__main__":
    fails: list[str] = []

    def _check(cond: bool, msg: str) -> None:
        print(("  ok   " if cond else "  FAIL ") + msg)
        if not cond:
            fails.append(msg)
    run_pieces(_check)
    print(f"\n{'ALL PASSED' if not fails else f'{len(fails)} FAILED'}")
    sys.exit(1 if fails else 0)
