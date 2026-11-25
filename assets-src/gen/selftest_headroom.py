"""Cutter option `cut: {fit: headroom, top_margin: N}` (monsters.yaml, per sprite; orchestrator ruling option (b) after
ROSTER_LOG R309 and R310-R312) self-tests, run from selftest.py (test_monster_anim, also --anim). RED first: the
default cutter keeps a figure 1:1 up to 10 % past the band's height, so a render a little taller than the cell's
feet-row height is cut 1:1 and runs off row 0 (R309 hollow_seraph boss_idle: 210 native px for a 193-row boss cell;
R310-R312 dragon monster_large: 126 / 126 / 123 for a 123-row large cell). With the option, a figure that would reach
above row N is shrunk nearest-neighbour (the cutter's existing scale path) to fit rows N..feet row, feet still on the
feet row; `keep_pieces: all_in_cell` combines with it (R309 keeps all 9 render pieces at N = 10, rev 13).
Without the option nothing changes: the cuts of a representative set of approved sheets' cached raws are byte-identical
to digests taken at eafbe84 (before the option; all approved monster / boss sheets were checked offline), and adding
the option never changes a request cache key, so a ledgered attempt re-cut with the option re-plans its own key and
`approve.py` can approve it at 0 images (as R288 / R289 after FW-C).

  python3 -I assets-src/gen/selftest_headroom.py
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
import yaml
from PIL import Image

HERE = Path(__file__).resolve().parent
FIX = HERE / "fixtures" / "cut"
# byte copies of the main checkout's cache/<key>.png (rejected attempts, so git-ignored there):
# {attempt: (fixture, sha256, cache key, seed, sheet, the entry fields the cut reads, the default cut's idle height)}
ATTEMPTS: dict[str, tuple[str, str, str, int, str, dict, int]] = {
    "R309": ("hollow_seraph_R309.png", "94e05033c86e1217e2d3abe01f93b79712e48d19c9a4106a3b4d7e227eb562b2",
             "ea9c18f6205f82d369da51b5", 1236, "boss_idle",
             {"id": "hollow_seraph", "kind": "monster", "size": "boss", "floating": True, "per_pose": True,
              "cut": {"keep_pieces": "all_in_cell"}}, 210),
    "R310": ("dragon_R310.png", "9566a32b34429fd6b32d38748bf57dd1b4387dc355dcd88980a357e4ac43e718",
             "e185a5906900b1220d8c29c4", 1234, "monster_large",
             {"id": "dragon", "kind": "monster", "size": "large"}, 126),
    "R311": ("dragon_R311.png", "070cde195f354c9e4da22a771ec967793445464768a2c6aaeda5b33b15ebd349",
             "b9329bf6f74e90ed5e30ea9f", 1235, "monster_large",
             {"id": "dragon", "kind": "monster", "size": "large"}, 126),
    "R312": ("dragon_R312.png", "fb2f063f4dcf9e4c136b89e85d70a085f10087da3d238313c5aa4a82cf6149c8",
             "c45d47377fc351e4f393a835", 1236, "monster_large",
             {"id": "dragon", "kind": "monster", "size": "large"}, 123),
}
MARGIN = {"R309": 10, "R310": 4, "R311": 4, "R312": 4}   # the margins measured in the report (any 1..32 is allowed)
R309_PIECES = 9          # the R309 render's pieces >= 40 native px (ROSTER_LOG R309: wings, helm, halo, plates, skirt)
PIECE_MIN = 24           # monster.KEEP_MIN_PX: a cut piece at least this big counts (the shrink scales areas by f^2)

# sha256[:24] of the cut frames (size + RGBA bytes) of approved sheets' cached raws through generate.cut_frames, taken
# at eafbe84 before the option (/tmp/vfw3/digest_all.py over every approved monster_* / boss_* sheet; the same run
# after the change matched all 155). A representative set, none of them a pass-V id (their entries may gain the option):
# small, large and boss bands, floating (ghost, shark, white_shark, death_eye), FW-C lifts (red_piranha, white_shark),
# haze (lich), a heavy raise, act 1. {sheet: (cache key, seed, digest)}; the raw is read by its pinned key.
BASELINE: dict[str, tuple[str, int, str]] = {
    "goblin/monster_small": ("cf039eec8f545b954bc9f3ef", 1234, "eeccdcd2edf1aee543b0afbd"),
    "wolf/monster_small": ("9ffa03946d95c1b1214cf6d6", 1234, "00f0166733c8dcf123be784d"),
    "ghost/monster_small": ("fdd556a102b3f75c95f6a6a9", 1234, "e8fbf4a9a1eb19602defe051"),
    "red_piranha/monster_small": ("19a3bccfa97e214bd940ce6a", 1236, "b0a429a6c518cc51de0a3d40"),
    "chimera/monster_large": ("4d9375967aedd0303d70b172", 1236, "dd3e729fce7db9147c78b9f2"),
    "shark/monster_large": ("19e8401d0ee9d9b082d4378f", 1236, "da5bd55f58cf4e9291a983ae"),
    "white_shark/monster_large": ("38351be46753975f50cd80dd", 1236, "f284bc43526124f3b9e41dfc"),
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


def _rows(frame: Image.Image) -> tuple[int, int]:
    ys = np.where(np.asarray(frame)[..., 3].any(1))[0]
    return int(ys.min()), int(ys.max())


def _pieces(frame: Image.Image, least: int) -> list[int]:
    from gen import pixelize as PX
    lab, _ = PX.components(np.asarray(frame)[..., 3] > 0)
    return sorted((s for s in np.bincount(lab.ravel())[1:].tolist() if s >= least), reverse=True)


def _entry(cid: str) -> list[dict]:
    """The entries that may plan a ledgered attempt's key: the live monsters.yaml entry, while the redesign is parked
    its pass-V text in retired/pending_<id>.yaml, and once the sprite is redesigned again its archived text in
    retired/monsters_v<N>.yaml (hollow_seraph R309 is the hollow_seraph_v2 text since V8 F4)."""
    from gen import generate as GEN
    out = [GEN.load_character(cid)]
    texts = [HERE / "retired" / f"pending_{cid}.yaml"] + sorted((HERE / "retired").glob("monsters_v*.yaml"))
    for path in texts:
        if path.exists():
            out += [{**{k: v for k, v in e.items() if k != "retired_as"}, "kind": "monster"}
                    for e in yaml.safe_load(path.read_text()) or [] if e.get("id") == cid]
    return out


def recut(name: str, margin: int | None) -> tuple[list[Image.Image], dict]:
    from gen import generate as GEN
    fix, _, _, seed, sheet, char, _ = ATTEMPTS[name]
    ch = json.loads(json.dumps(char))
    if margin is not None:
        ch["cut"] = {**(ch.get("cut") or {}), "fit": "headroom", "top_margin": margin}
    frames = GEN.cut_frames(Image.open(FIX / fix).convert("RGBA"), Image.new("RGB", (4, 4)), GEN.SHEETS[sheet], ch, seed)
    return frames, dict(GEN.LAST_RESAMPLE[sheet])


def run_headroom(check: Callable[[bool, str], None]) -> None:
    from gen import generate as GEN
    from gen import monster as M
    from gen import pixelize as PX

    # the option's schema (combinable with keep_pieces; the old keep_pieces accessor is unchanged)
    ok = {"fit": "headroom", "top_margin": 4}
    try:
        good = (M.cut_fit({"id": "x"}) is None and M.cut_fit({"id": "x", "cut": ok}) == 4
                and M.cut_fit({"id": "x", "cut": {**ok, "keep_pieces": "all_in_cell"}}) == 4
                and M.cut_options({"id": "x", "cut": {**ok, "keep_pieces": "all_in_cell"}}) == "all_in_cell"
                and M.cut_options({"id": "x", "cut": ok}) is None)
    except (AttributeError, ValueError) as e:
        good = False
        print(f"  info schema: {e!r}")
    check(good, "headroom: `cut: {fit: headroom, top_margin: N}` reads N, combines with keep_pieces, none is None")
    for bad in ({"fit": "headroom"}, {"top_margin": 4}, {"fit": "tight", "top_margin": 4}, {"fit": "headroom",
                "top_margin": 0}, {"fit": "headroom", "top_margin": 33}, {"fit": "headroom", "top_margin": 4.5},
                {"fit": "headroom", "top_margin": True}, {"fit": "headroom", "top_margin": 4, "x": 1}):
        try:
            M.cut_fit({"id": "x", "cut": bad})
            M.cut_options({"id": "x", "cut": bad})
            refused = False
        except ValueError as e:
            refused = "x" in str(e)
        except AttributeError:
            refused = False
        check(refused, f"headroom: `cut: {bad!r}` is refused naming the sprite")

    # the four ledgered attempts: RED (default cut clips at row 0), GREEN (fits rows N..feet with every piece)
    for name, (fix, sha, key, seed, sheet, char, h0) in ATTEMPTS.items():
        raw = (FIX / fix).read_bytes() if (FIX / fix).exists() else b""
        check(hashlib.sha256(raw).hexdigest() == sha, f"headroom: the {name} fixture is the cached render ({fix})")
        geom = GEN.SHEETS[sheet].geom if sheet.startswith("monster_") else M.S.pose_geom(char.get("size"))
        foot = geom.bottom_row if sheet.startswith("boss_") else M.S.MONSTER_BANDS[char["size"]].foot_row
        d, dinfo = recut(name, None)
        top0 = min(_rows(f)[0] for f in d)
        check(dinfo.get("native_heights", [0])[0] == h0 and dinfo.get("scale") == 1.0 and top0 == 0
              and "idle" in dinfo.get("clipped", []),
              f"headroom RED: the default cut of {name} keeps the {h0} px idle 1:1 and clips it at row 0 "
              f"(heights {dinfo.get('native_heights')}, scale {dinfo.get('scale')}, top {top0}, "
              f"clipped {dinfo.get('clipped')})")
        n = MARGIN[name]
        try:
            fr, info = recut(name, n)
        except (ValueError, TypeError) as e:
            check(False, f"headroom: {name} re-cut with top_margin {n} ({e!r})")
            continue
        tops = [_rows(f)[0] for f in fr]
        bots = [_rows(f)[1] for f in fr]
        fit = info.get("fit") or {}
        feet_ok = bots[0] == foot if char.get("floating") else all(b == foot for b in bots)
        check(min(tops) >= n and feet_ok and info.get("clipped") == [] and info.get("scale", 1) < 1.0
              and fit.get("top_margin") == n and info.get("shrink") == "nearest-neighbour (headroom)" and fr[0].size[1] == geom.grid[1],
              f"headroom: {name} re-cut with top_margin {n} fits rows {min(tops)}..{max(bots)} (feet row {foot}), "
              f"scale {info.get('scale')}, heights {info.get('report', {}).get('heights')}, cell {fr[0].size}, "
              f"clipped {info.get('clipped')}")
        rep = info.get("report", {})
        summary = {"heights": rep.get("heights"), "tops": tops, "bottoms": bots, "scale": info.get("scale"),
                   "cell": list(fr[0].size), "fit": fit, "pose_diff": rep.get("pose_diff"),
                   "colours": rep.get("colours"), "edges_ok": rep.get("edges_ok")}
        print(f"  info {name} re-cut: {json.dumps(summary)}")
        if name == "R309":
            # rev 13: every render piece >= 40 native px survives (keep_pieces all_in_cell with the shrink)
            native, _ = M.native_art(Image.open(FIX / fix).convert("RGBA"), guide_width=M.S.MONSTER_POSE_GUIDE[0])
            nlab, _ = PX.components(M._foreground(np.asarray(native.convert("RGB"))))
            big = int((np.bincount(nlab.ravel())[1:] >= 40).sum())
            cut_pcs = _pieces(fr[0], PIECE_MIN)
            check(big == R309_PIECES and len(cut_pcs) == R309_PIECES and info.get("keep_pieces") == "all_in_cell",
                  f"headroom: the R309 render has {R309_PIECES} pieces >= 40 native px ({big}) and the re-cut keeps "
                  f"all of them ({cut_pcs})")
        # approvable at 0 images: an entry (live or the parked pass-V text) re-plans this attempt's key, with the
        # option added as well as without it
        planned = []
        for e in _entry(char["id"]):
            if GEN.seed_for(e, sheet) != seed or sheet not in GEN.allowed_sheets(e):
                continue
            k0 = GEN.plan_request(e, GEN.SHEETS[sheet], seed, "gemini", None).key
            e1 = {**e, "cut": {**(e.get("cut") or {}), "fit": "headroom", "top_margin": n}}
            k1 = GEN.plan_request(e1, GEN.SHEETS[sheet], seed, "gemini", None).key
            planned.append((k0, k1))
        if name in ("R309", "R312"):          # the parked / archived pass-V texts are these attempts' (R310 / R311 reworded)
            check((key, key) in planned, f"headroom: {name}'s entry re-plans key {key} with and without the option "
                                         f"(approve.py finds it cached) {planned}")

    # the --repixelize re-cut report (generate.recut_source): approvable only when the live entry re-plans the cached
    # key whose render is the out/ dir's raw (a temporary cache holding the fixtures under their keys)
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        for name in ATTEMPTS:
            (Path(td) / f"{ATTEMPTS[name][2]}.png").write_bytes((FIX / ATTEMPTS[name][0]).read_bytes())
        for name in ("R309", "R312"):
            fix, _, key, seed, sheet, char, _ = ATTEMPTS[name]
            for e in _entry(char["id"]):
                if GEN.seed_for(e, sheet) == seed and sheet in GEN.allowed_sheets(e):
                    e1 = {**e, "cut": {**(e.get("cut") or {}), "fit": "headroom", "top_margin": MARGIN[name]}}
                    got = GEN.recut_source(e1, sheet, seed, (FIX / fix).read_bytes(), Path(td))
                    check(got[:2] == (key, True), f"headroom: --repixelize reports the {name} re-cut approvable {got}")
                    other = GEN.recut_source(e1, sheet, seed, (FIX / ATTEMPTS["R310"][0]).read_bytes(), Path(td))
                    wrong = GEN.recut_source(e1, sheet, seed + 1, (FIX / fix).read_bytes(), Path(td))
                    none = GEN.recut_source(e1, sheet, seed, (FIX / fix).read_bytes(), Path(td) / "empty")
                    check(not other[1] and "different render" in other[2] and not wrong[1] and not none[1]
                          and "not cached" in none[2], f"headroom: --repixelize refuses another raw, another seed and "
                                                       f"an uncached key ({other[2]}; {wrong[2]}; {none[2]})")
                    break

    # monster.cut directly: the margin applies to a figure that fits the band but would touch row 0; a figure that
    # already leaves the margin is untouched by the option (byte-identical frames)
    fr0, _ = recut("R312", None)
    fr1, _ = recut("R312", 1)
    check(_digest(fr0) != _digest(fr1) and min(_rows(f)[0] for f in fr1) >= 1,
          "headroom: top_margin 1 still shrinks R312 (its idle's horn tips are on row 0)")
    ga = GEN.load_character("garland")
    raw = Image.open(GEN.CACHE / f"{BASELINE_GARLAND[0]}.png").convert("RGBA")
    plain = GEN.cut_frames(raw, Image.new("RGB", (4, 4)), GEN.SHEETS["boss_idle"], ga, BASELINE_GARLAND[1])
    top = _rows(plain[0])[0]
    opt = GEN.cut_frames(raw, Image.new("RGB", (4, 4)), GEN.SHEETS["boss_idle"],
                         {**ga, "cut": {"fit": "headroom", "top_margin": max(1, top)}}, BASELINE_GARLAND[1])
    check(_digest(plain) == _digest(opt), f"headroom: a figure already at or below row N (garland idle, top row {top}, "
                                          f"N = {max(1, top)}) is cut byte-identically with the option")

    # no change without the option: approved cuts byte-identical, request keys unchanged with the option added
    bad = []
    for name, (key, seed, want) in sorted(BASELINE.items()):
        cid, sheet = name.split("/")
        fr = GEN.cut_frames(Image.open(GEN.CACHE / f"{key}.png").convert("RGBA"), Image.new("RGB", (4, 4)),
                            GEN.SHEETS[sheet], GEN.load_character(cid), seed)
        if _digest(fr) != want or "fit" in GEN.LAST_RESAMPLE[sheet]:
            bad.append(name)
    check(len(BASELINE) >= 11 and not bad, f"headroom: without the option the {len(BASELINE)} representative approved "
                                           f"cuts are byte-identical to eafbe84 {bad}")
    metas = {f"{p.parent.name}/{p.stem}": json.loads(p.read_text()) for p in sorted((GEN.HERE / "approved").glob("*/*.json"))}
    moved = []
    for sid, meta in sorted(metas.items()):
        if not meta.get("sheet", "").startswith(("monster_", "boss_")) or meta.get("revived_from") \
                or meta.get("backend") == "user":           # EF-H: a user-rendered sheet has no request to re-plan
            continue
        ch = GEN.load_character(meta["character"])
        k0 = GEN.plan_request(ch, GEN.SHEETS[meta["sheet"]], meta["seed"], "gemini", meta["model"]).key
        k1 = GEN.plan_request({**ch, "cut": {**(ch.get("cut") or {}), "fit": "headroom", "top_margin": 4}},
                              GEN.SHEETS[meta["sheet"]], meta["seed"], "gemini", meta["model"]).key
        if k0 != k1:
            moved.append(sid)
    check(not moved, f"headroom: adding the option never changes an approved monster request's cache key {moved[:3]}")


BASELINE_GARLAND = ("725729407d8e4ff145f82e12", 1234)


if __name__ == "__main__":
    fails: list[str] = []

    def _check(cond: bool, msg: str) -> None:
        print(("  ok   " if cond else "  FAIL ") + msg)
        if not cond:
            fails.append(msg)
    run_headroom(_check)
    print(f"\n{'ALL PASSED' if not fails else f'{len(fails)} FAILED'}")
    sys.exit(1 if fails else 0)
