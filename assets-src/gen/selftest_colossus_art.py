"""Pass C framework self-tests, part 2 (docs/CHAOS_FORMS_PLAN.md 18.5, 18.6, 7.2; rev 4; FW-C), run by
selftest_colossus.run_colossus: the `colossus` build stage on the painted contract form (colossus_fixture.py): the TS
contract shape (frames.base with at / size / frame-relative tiles, targetRect [x, y, w, h], blend, alpha, the glow at
texScale 2, no image / variants), soft alpha and full colour kept, the empty core base, the bestiary still, the spec
refusals, the 24 MB budget, the lock mismatch, no-op without approved masters (R25), tiles <= 2048, deterministic under
PYTHONHASHSEED 0 / 1 with `--out` and its sha256 manifest (R26); the TS side's committed
tests/fixtures/colossus/contract.json against the Python build of the same form (parsed); and tools/stage_rim.py (the
rim staging, pad_bottom, the floor-front cut, the `rim` check profile, the 1-line hook in stage_backgrounds.py). The rev-3 pixel rules (pix, palette
lock, binary alpha, the 4 glow levels, the limb bake) are gone with D-U10.
"""
from __future__ import annotations

import contextlib
import io
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
TOOLS = HERE.parent / "tools"
ACCEPTED = (Path("/tmp/stab2/sd35_v3_raw.png"), Path("/tmp/stab2/sd35_v3_bg.webp"))   # user-accepted (7.1), volatile


def _raises(fn: Callable[[], object], *words: str) -> str:
    try:
        fn()
    except (ValueError, SystemExit) as e:
        return str(e) if all(w in str(e) for w in words) else ""
    return ""


def run_art(check: Callable[[bool, str], None]) -> None:
    from gen.selftest_colossus import sections
    sections(check, _build, _contract, _stage_rim)


FORM_KEYS = {"canvas", "scale", "place", "anchors", "targetRect", "skyDim", "layers"}   # visibleBox / coverBox: defaults
LAYER_KEYS = {"name", "kind", "over", "blend", "alpha", "frames"}


def frame_problems(fr: dict) -> list[str]:
    """colossusIndex.ts formProblems for one frame with the B3 texScale rule: tiles in texture px, inside and covering
    exactly ceil(size / texScale)."""
    ts = fr.get("texScale", 1)
    tw, th = -(-fr["size"][0] // ts), -(-fr["size"][1] // ts)
    out = [f"tile {t['file']} over 2048" for t in fr["tiles"] if t["w"] > 2048 or t["h"] > 2048]
    out += [f"tile {t['file']} leaves its frame" for t in fr["tiles"]
            if t["x"] < 0 or t["y"] < 0 or t["x"] + t["w"] > tw or t["y"] + t["h"] > th]
    if fr["tiles"] and sum(t["w"] * t["h"] for t in fr["tiles"]) != tw * th:
        out.append("tiles do not cover the frame exactly")
    return out


def _build(check) -> None:
    from gen import colossus_build as CB
    from gen import colossus_fixture as FX
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        out = tmp / "out"
        res = CB.build(out, approved=tmp / "none", specs=tmp / "none")
        check(res is None and not out.exists(), "build: no approved master -> nothing written, no output dir (R25)")
        r = subprocess.run([sys.executable, "-I", str(HERE.parent / "build_assets.py"), "colossus", "--out", str(out)],
                           capture_output=True, text=True, cwd=ROOT)
        real = [p for p in (HERE / "approved" / "chaos_forms").glob("*/master.png")
                if (HERE / "colossus" / f"{p.parent.name}.yaml").exists()]
        check(r.returncode == 0 and (real or not out.exists()),
              f"build_assets.py colossus: exit 0; an approved master without a layer yaml is skipped, nothing written "
              f"({r.returncode}, {(r.stdout + r.stderr).strip()[-120:]!r})")
        app, specs = FX.write(tmp / "fx")
        bg = tmp / "rim.png"
        Image.new("RGB", (1920, 1080), (180, 190, 200)).save(bg)
        with contextlib.redirect_stdout(io.StringIO()):
            res = CB.build(out, approved=app, specs=specs, bg=bg)
        meta = json.loads((out / "colossus.json").read_text())
        form = meta["forms"][FX.FORM]
        L = {x["name"]: x for x in form["layers"]}
        # 18.5 / selftest lines 200-204 (rev 4): the TS shape, no rev-3 keys
        check(set(form) == FORM_KEYS and all(set(x) <= LAYER_KEYS and "base" in x["frames"] for x in form["layers"])
              and not any(k in x for x in form["layers"] for k in ("image", "variants", "z", "pivot"))
              and form["targetRect"] == [1170, 345, 360, 495] and form["canvas"] == [2700, 1080] and form["scale"] == 1
              and form["skyDim"] == 0.6,
              f"build: the TS shape: form {sorted(form)}, every layer frames.base, targetRect [x, y, w, h], skyDim 0.6, "
              f"no image / variants / z")
        check(L["glow"]["blend"] == "add" and L["glow"]["alpha"] == 1.0 and L["corona"]["blend"] == "add"
              and "blend" not in L["body"] and "alpha" not in L["body"] and L["glow"]["frames"]["base"].get("texScale") == 2
              and "texScale" not in L["body"]["frames"]["base"],
              "build: glow blend add, alpha 1.0, texScale 2 (half res); corona add; body at the reader's defaults "
              "(no blend / alpha key) and texScale 1")
        probs = [f"{x['name']}/{n}: {p}" for x in form["layers"] for n, fr in x["frames"].items() for p in frame_problems(fr)]
        bt = [(t["file"].rsplit("/", 1)[1], t["x"], t["w"]) for t in L["body"]["frames"]["base"]["tiles"]]
        check(not probs and bt == [("body_base_0.png", 0, 2048), ("body_base_1.png", 2048, 652)],
              f"build: frame-relative tiles abut and cover ceil(size / texScale) exactly; the 2700 px body in 2048 + 652 "
              f"(body_base_0 / _1) ({probs[:2]}, {bt})")
        g = L["glow"]["frames"]["base"]
        gpx = Image.open(out / g["tiles"][0]["file"])
        check(g["at"][0] % 2 == 0 and g["at"][1] % 2 == 0 and g["tiles"][0]["w"] == gpx.width
              and sum(t["w"] for t in g["tiles"] if t["y"] == 0) == -(-g["size"][0] // 2),
              f"build: the glow frame sits on the 2 px texture grid, stored at half res ({g['at']}, {g['size']})")
        b = L["body"]["frames"]["base"]
        src = Image.open(app / FX.FORM / "master.png").convert("RGBA")
        t0 = b["tiles"][0]
        tex = np.asarray(Image.open(out / t0["file"]).convert("RGBA"))
        want = np.asarray(src.crop((b["at"][0] + t0["x"], b["at"][1] + t0["y"], b["at"][0] + t0["x"] + t0["w"],
                                    b["at"][1] + t0["y"] + t0["h"])))
        check((tex == want).all() and len(np.unique(tex[..., 3])) > 8 and len(np.unique(tex[..., :3].reshape(-1, 3), axis=0)) > 64,
              "build: the body tiles are the approved pixels as is: soft 8-bit alpha, full colour (no quantize, no "
              "binary alpha)")
        core = L["core"]["frames"]
        check(set(core) == {"base", "crack", "open"} and core["base"]["tiles"] == [] and core["crack"]["tiles"]
              and core["base"]["at"] == core["crack"]["at"],
              f"build: core base is an empty frame (the body carries it) at the patches' box; crack / open are frames "
              f"({core['base']})")
        cb = L["corona"]["frames"]["base"]
        check(cb["at"] == [997, 160] and cb["size"] == [700, 700] and "texScale" not in cb,
              f"build: the corona is the glow file cut to its box at full res ({cb['at']}, {cb['size']})")
        pv = Image.open(out / "colossus" / FX.FORM / "preview.png")
        check(pv.width <= 940 and pv.height <= 720 and (pv.width == 940 or pv.height == 720)
              and np.asarray(pv)[..., 3].min() == 255,
              f"build: the bestiary still preview.png fits 940x720 and is opaque ({pv.size})")
        files = [x["file"] for y in form["layers"] for fr in y["frames"].values() for x in fr["tiles"]]
        man = (out / "manifest.sha256").read_text().splitlines()
        check(res is not None and meta["bytes"] > 0 and len(man) == len(files) + 2 and all((out / f).exists() for f in files),
              f"build: every texture, the still and colossus.json in the sha256 manifest ({len(man)} lines)")
        runs = []
        for seed in ("0", "1"):
            o = tmp / f"col{seed}"
            subprocess.run([sys.executable, "-I", str(HERE / "colossus_build.py"), "--approved", str(app), "--specs",
                            str(specs), "--out", str(o)], env={**os.environ, "PYTHONHASHSEED": seed}, capture_output=True)
            runs.append({p.relative_to(o).as_posix(): p.read_bytes() for p in sorted(o.rglob("*")) if p.is_file()})
        check(runs[0] and runs[0] == runs[1], f"build: --out twice under PYTHONHASHSEED 0 / 1 gives identical files and "
                                              f"manifest (R26, {len(runs[0])} files)")
        tiles = CB.tiles(Image.new("RGBA", (2100, 2050), (24, 24, 33, 255)))
        boxes = sorted((x, y, im.width, im.height) for x, y, im in tiles)
        check(boxes == [(0, 0, 2048, 2048), (0, 2048, 2048, 2), (2048, 0, 52, 2048), (2048, 2048, 52, 2)],
              f"build: a layer over 2048 px is split into abutting tiles <= 2048 ({boxes})")
        for label, over, word in (("a targetRect with w 0", {"target_rect": [1170, 345, 0, 495]}, "target_rect"),
                                  ("a targetRect outside the canvas", {"target_rect": [2500, 345, 360, 495]},
                                   "target_rect"),
                                  ("an anchor outside the canvas", {"anchors": {**FX.spec()["anchors"], "core": [9999, 9]}},
                                   "anchors"),
                                  ("a blend other than normal | add",
                                   {"layers": [{**FX.spec()["layers"][1], "blend": "x"}]}, "blend")):
            a2, s2 = FX.write(tmp / f"bad{len(word)}{label[:4]}", over)
            r = _raises(lambda: CB.build(tmp / "o2", approved=a2, specs=s2, bg=None), word)
            check(bool(r), f"build: {label} is refused ({r[:80]!r})")
        r = _raises(lambda: CB.build(tmp / "o3", approved=app, specs=specs, bg=None, max_bytes=1000), "budget")
        check(bool(r) and not (tmp / "o3").exists(), f"build: over the 24 MB texture budget is refused, nothing written "
                                                      f"({r[:70]!r})")
        lock = CB.lock(app, specs, FX.FORM)
        check(lock.exists() and CB.lock_problems(app, specs, FX.FORM) == [], "lock: written, and a fresh build matches it")
        m2 = np.asarray(src).copy()
        m2[900, 1350, :3] = (1, 2, 3)
        Image.fromarray(m2).save(app / FX.FORM / "master.png")
        probs = CB.lock_problems(app, specs, FX.FORM)
        check(any("hash differs" in p and "body" in p for p in probs), f"lock: a changed layer is reported ({probs[:1]})")


def _contract(check) -> None:
    """18.5: the TS side's committed tests/fixtures/colossus/contract.json (makeFixture.mjs) is exactly what
    colossus_build.py writes for colossus_fixture's form (parsed json: Python's 1.0 equals JS's 1)."""
    from gen import colossus_build as CB
    want = json.loads(CB.CONTRACT.read_text()) if CB.CONTRACT.exists() else {}
    have = CB.contract_forms()
    diff = sorted({L["name"] for L in want.get("forms", {}).get("contract_form", {}).get("layers", [])} ^
                  {L["name"] for L in have["contract_form"]["layers"]})
    check(want.get("version") == 1 and want.get("forms") == have,
          f"contract: colossus_build.py writes exactly the committed {CB.CONTRACT.relative_to(ROOT)} form (parsed; "
          f"layer-name diff {diff}; `colossus_build.py --contract` prints the Python side)")


def _stage_rim(check) -> None:
    sys.path.insert(0, str(TOOLS))
    import stage_backgrounds as SB
    import stage_rim as SR
    lines = len((TOOLS / "stage_backgrounds.py").read_text().splitlines())
    # the accepted ceiling since pass INT (AGENTS.md "over 250 and not split": 255); C1 had pinned 249 before it
    check(lines <= 255, f"stage_backgrounds.py stays line-neutral ({lines} <= 255 lines)")
    check(SR.RIM == ("rim-src-up.png", 485, 1.05, "center", 370), f"stage_rim: the user-accepted entry {SR.RIM}")
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        yy, xx = np.mgrid[0:768, 0:1344]
        src = np.stack([(xx * 7 + yy) % 256, (yy * 3) % 256, (xx // 5) % 256], -1).astype(np.uint8)
        Image.fromarray(src).save(tmp / "rim-src.png")
        screen, wide, info = SR.stage(tmp / "rim-src.png", *SR.RIM[1:])
        a = np.asarray(screen)
        check(screen.size == (1920, 1080) and wide.size == (1920 + 2 * SR.BLEED, 1080)
              and (info["src_size"], info["scale"], info["top"], info["bottom"]) == ((1344, 768), 1.5, -358, 794),
              f"stage_rim: src_size from the image, scale 1.5, top -358, bottom 794 ({info})")
        check((a[794:800] == a[793:787:-1]).all() and SR.coverage(screen) == 1.0,
              "stage_rim: pad_bottom mirrors the floor below the source bottom; no uncovered row in 0..1080")
        check((np.asarray(wide)[:, SR.BLEED:-SR.BLEED] == a).all(), "stage_rim: the bleed-wide stage equals the screen in "
                                                                     "its middle 1920 columns")
        SR.write(screen, wide, tmp)
        rim, floor = Image.open(tmp / "rim.webp").convert("RGB"), Image.open(tmp / "rim_floor.webp")
        fa, ra = np.asarray(floor.convert("RGBA")), np.asarray(rim)
        hz = SR.RIM[4]
        check(floor.size == (1944, 1080) and (fa[:hz, :, 3] == 0).all() and (fa[hz:, :, 3] == 255).all()
              and (fa[hz:, SR.BLEED:-SR.BLEED, :3] == ra[hz:]).all(),
              "stage_rim: rim_floor.webp is 1944 wide, alpha 0 above the horizon row, and pixel-exact with rim.webp below it")
        flat = tmp / "flat.webp"
        Image.new("RGB", (1920, 1080), (90, 90, 90)).save(flat)
        ok, line = SR.check(flat)
        check(not ok and "FAIL" in line and "edge_delta" in line, f"stage_rim --check rim fails a flat image ({line[:90]!r})")
        with contextlib.redirect_stdout(io.StringIO()):
            r = _raises(lambda: SB.main(["stage_backgrounds.py", "--check", "rim", "--image", str(flat)]), "rim")
        check(bool(r), f"stage_backgrounds.py --check rim dispatches to stage_rim ({r[:60]!r})")
        if ACCEPTED[0].exists() and ACCEPTED[1].exists():
            screen, wide, _ = SR.stage(ACCEPTED[0], *SR.RIM[1:])
            SR.write(screen, wide, tmp)
            same = (tmp / "rim.webp").read_bytes() == ACCEPTED[1].read_bytes()
            ok, line = SR.check(tmp / "rim.webp")
            check(same and ok, f"stage_rim: the accepted source stages byte-identical to sd35_v3_bg.webp and passes "
                               f"--check rim ({line})")
        else:
            print("  info /tmp/stab2 accepted render not present; byte-identity check skipped")
