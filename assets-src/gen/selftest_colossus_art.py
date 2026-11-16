"""Pass C framework self-tests, part 2 (docs/CHAOS_FORMS_PLAN.md 4.6, 5.3, 5.4, 7.2, 9.3; FW-C), run by
selftest_colossus.run_colossus: `colossus.py pix` (base palette lock, binary alpha, specks, determinism), the layer
split (masks cover the master exactly once except declared fills), binary alpha outside `glow`, the 4 glow levels, the
bake rotation cap, the lock mismatch, the `colossus` build stage (no-op without approved masters, R25; tiles <= 2048;
deterministic under PYTHONHASHSEED 0 / 1 with `--out` and its sha256 manifest, R26) and tools/stage_rim.py (the rim
staging, pad_bottom, the floor-front cut, the `rim` check profile, the 1-line hook in stage_backgrounds.py).
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
import yaml
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
TOOLS = HERE.parent / "tools"
ACCEPTED = (Path("/tmp/stab2/sd35_v3_raw.png"), Path("/tmp/stab2/sd35_v3_bg.webp"))   # user-accepted (7.1), volatile

DARK, GOLD, WHITE = (24, 24, 33), (222, 165, 82), (231, 239, 222)
W, H = 120, 80
ARM = [[70, 30], [110, 30], [110, 44], [70, 44]]
CORE = [[40, 30], [52, 30], [52, 42], [40, 42]]


def fixture_master() -> Image.Image:
    """A 120x80 test master: a dark body block, a gold right arm (x 70-110) and a white core square."""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((20, 20, 100, 70), fill=DARK + (255,))
    d.rectangle((70, 30, 109, 43), fill=GOLD + (255,))
    d.rectangle((40, 30, 51, 41), fill=WHITE + (255,))
    return im


def fixture_spec(**over) -> dict:
    spec = {"form": "fx_test", "canvas": [W, H], "scale": 3, "place": [-60, -30],
            "anchors": {"target": [60, 40], "core": [46, 36], "head": [60, 22], "hands": [[22, 60], [108, 36]],
                        "melee": [100, 50], "feet": [60, 70]},
            "target_rect": [30, 22, 100, 68],
            "layers": [{"name": "body", "kind": "body"},
                       {"name": "arm_r", "kind": "limb", "mask": ARM, "pivot": [72, 37], "fill": ARM,
                        "frames": {"raise": -12, "slam": 15, "recoil": 4}},
                       {"name": "core", "kind": "core", "mask": CORE},
                       {"name": "glow", "kind": "glow", "sources": {"core": 6}}]}
    spec.update(over)
    return spec


def write_fixture(root: Path, spec: dict | None = None, master: Image.Image | None = None) -> tuple[Path, Path]:
    """approved/chaos_forms/fx_test/master.png + colossus/fx_test.yaml under root; returns (approved root, spec root)."""
    app, specs = root / "approved" / "chaos_forms", root / "colossus"
    (app / "fx_test").mkdir(parents=True)
    specs.mkdir(parents=True)
    (master or fixture_master()).save(app / "fx_test" / "master.png")
    (specs / "fx_test.yaml").write_text(yaml.safe_dump(spec or fixture_spec(), sort_keys=False))
    return app, specs


def _raises(fn: Callable[[], object], *words: str) -> str:
    try:
        fn()
    except (ValueError, SystemExit) as e:
        return str(e) if all(w in str(e) for w in words) else ""
    return ""


def run_art(check: Callable[[bool, str], None]) -> None:
    from gen.selftest_colossus import sections
    sections(check, _pix, _layers, _build, _stage_rim)


def _nobg() -> Image.Image:
    """A soft-edged 'remove_bg' result: near-gold and near-dark ellipses, partial alpha at the rim, a 2 px speck."""
    im = Image.new("RGBA", (600, 400), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((40, 60, 560, 380), fill=(30, 28, 40, 255))
    d.ellipse((200, 120, 420, 300), fill=(219, 161, 86, 255))
    d.ellipse((260, 160, 330, 230), fill=(120, 200, 90, 255))           # a free colour
    d.rectangle((5, 5, 6, 6), fill=(219, 161, 86, 255))                 # speck < 0.2 % of the blob
    a = np.asarray(im).copy()
    edge = (a[..., 3] > 0) & (np.arange(600)[None, :] < 60)
    a[edge, 3] = 90                                                     # partial alpha (dropped below 128)
    return Image.fromarray(a)


def _pix(check) -> None:
    from gen import colossus_layers as CL
    from gen import pixelize as PX
    base = list(CL.BASE_PALETTE.values())
    f1 = set()
    for p in sorted((HERE / "approved" / "chaos").glob("boss_*.png")):
        a = np.asarray(Image.open(p).convert("RGBA"))
        f1 |= set(map(tuple, a[a[..., 3] > 0][:, :3].tolist()))
    check(len(base) >= 8 and all(c in f1 for c in base)
          and all(tuple(PX.snap15(np.array(c, float)).tolist()) == c for c in base if c != PX.OUTLINE),
          f"base palette: {len(base)} colours, each in F1's approved sheets and an exact 15-bit value ({CL.BASE_PALETTE})")
    out = CL.pix(_nobg(), (W, H), colors=8)
    a = np.asarray(out)
    cols = set(map(tuple, a[a[..., 3] > 0][:, :3].tolist()))
    near = [c for c in cols if c not in base and c != PX.OUTLINE and
            min(sum((x - y) ** 2 for x, y in zip(c, b)) for b in base) < CL.NEAR ** 2]
    check(out.size == (W, H) and set(np.unique(a[..., 3]).tolist()) <= {0, 255} and GOLD in cols and not near
          and CL.palette_problems(out) == [],
          f"pix: canvas {W}x{H}, binary alpha, near-gold snapped to the exact base gold, no free colour within "
          f"{CL.NEAR} of a base colour ({len(cols)} colours; near {near})")
    check(a[:8, :8, 3].max() == 0, "pix: specks under 0.2 % of the largest blob are dropped")
    bad = out.copy()
    bad.putpixel((60, 40), (220, 160, 80, 255))
    check(any("near" in x for x in CL.palette_problems(bad)), "pix: palette_problems flags a colour near a base colour")
    with tempfile.TemporaryDirectory() as t:
        src = Path(t) / "nobg.png"
        _nobg().save(src)
        outs = []
        for seed in ("0", "1"):
            dst = Path(t) / f"pix{seed}.png"
            r = subprocess.run([sys.executable, "-I", str(HERE / "colossus.py"), "pix", "chaos_horizon", str(src),
                                "--colors", "8", "--canvas", f"{W}x{H}", "--out", str(dst)],
                               env={**os.environ, "PYTHONHASHSEED": seed}, capture_output=True, text=True)
            outs.append(dst.read_bytes() if r.returncode == 0 and dst.exists() else r.stderr[-200:].encode())
        check(outs[0] == outs[1] and outs[0][:4] == b"\x89PNG", f"pix: byte-identical under PYTHONHASHSEED 0 and 1 "
                                                                 f"({outs[0][:60]!r})")


def _layers(check) -> None:
    from gen import colossus_layers as CL
    m, spec = fixture_master(), fixture_spec()
    layers = CL.split(m, spec)
    ma = np.asarray(m)[..., 3] > 0
    union = np.zeros_like(ma)
    for name, img in layers.items():
        if name != "glow":
            union |= np.asarray(img)[..., 3] > 0
    check(set(layers) == {"body", "arm_r", "core", "glow"} and (union == ma).all() and CL.cover_problems(m, spec) == [],
          "split: body + layers cover the master's opaque pixels exactly (no gap)")
    body = np.asarray(layers["body"])
    check(body[37, 90, 3] == 255 and tuple(body[37, 90, :3]) == DARK,
          "split: a declared fill paints the body under the limb with the nearest body colour")
    bad = fixture_spec(layers=[*fixture_spec()["layers"][:3],
                               {"name": "core2", "kind": "core", "mask": [[45, 30], [80, 30], [80, 40], [45, 40]]}])
    probs = CL.cover_problems(m, bad)
    check(any("overlap" in p for p in probs), f"split: two layers over the same pixel are refused ({probs[:1]})")
    nofill = fixture_spec(layers=[{**L, "fill": None} if L["name"] == "arm_r" else L for L in fixture_spec()["layers"]])
    check(CL.cover_problems(m, nofill) == [], "split: a limb without a fill is fine (the body keeps a hole behind it)")
    g = np.asarray(layers["glow"])[..., 3]
    lv = set(np.unique(g).tolist())
    check(lv == {0, *CL.GLOW_LEVELS} and len(CL.GLOW_LEVELS) == 4 and (g[np.asarray(layers["core"])[..., 3] > 0] == 0).all(),
          f"glow: exactly the 4 stepped levels {CL.GLOW_LEVELS} outside the source mask ({sorted(lv)})")
    check(CL.alpha_problems("glow", "glow", layers["glow"]) == [] and CL.alpha_problems("arm_r", "limb", layers["arm_r"]) == [],
          "alpha: glow's 4 levels and a binary limb pass")
    soft = np.asarray(layers["arm_r"]).copy()
    soft[35, 80, 3] = 100
    check(any("binary" in p for p in CL.alpha_problems("arm_r", "limb", Image.fromarray(soft))),
          "alpha: a partial alpha outside glow is refused")
    g2 = np.asarray(layers["glow"]).copy()
    g2[g2[..., 3] == 64, 3] = 70
    check(any("level" in p for p in CL.alpha_problems("glow", "glow", Image.fromarray(g2))), "alpha: a 5th glow level is refused")
    arm = layers["arm_r"]
    f20 = CL.bake(arm, (72, 37), 20)
    fa = np.asarray(f20)
    src_cols = set(map(tuple, np.asarray(arm)[np.asarray(arm)[..., 3] > 0][:, :3].tolist()))
    out_cols = set(map(tuple, fa[fa[..., 3] > 0][:, :3].tolist()))
    check(f20.size == arm.size and set(np.unique(fa[..., 3]).tolist()) <= {0, 255} and out_cols <= src_cols,
          "bake: a 20 degree limb frame keeps the canvas, binary alpha and only the limb's colours")
    r = _raises(lambda: CL.bake(arm, (72, 37), 21), "20")
    check(bool(r), f"bake: a rotation over the 20 degree cap is refused ({r[:70]!r})")
    r = _raises(lambda: CL.split(m, fixture_spec(layers=[*fixture_spec()["layers"][:1],
                                                         {**fixture_spec()["layers"][1], "frames": {"slam": 25}}])), "20")
    check(bool(r), f"bake: a spec frame over the cap is refused at split ({r[:70]!r})")


def _build(check) -> None:
    from gen import colossus_build as CB
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        out = tmp / "out"
        res = CB.build(out, approved=tmp / "none", specs=tmp / "none")
        check(res is None and not out.exists(), "build: no approved master -> nothing written, no output dir (R25)")
        r = subprocess.run([sys.executable, "-I", str(HERE.parent / "build_assets.py"), "colossus", "--out", str(out)],
                           capture_output=True, text=True, cwd=ROOT)
        real = list((HERE / "approved" / "chaos_forms").glob("*/master.png"))
        check(real or (r.returncode == 0 and r.stdout.strip() == "" and not out.exists()),
              f"build_assets.py colossus with no approved master: exit 0, silent, no output ({r.returncode}, "
              f"{(r.stdout + r.stderr).strip()[-120:]!r})")
        app, specs = write_fixture(tmp / "fx")
        with contextlib.redirect_stdout(io.StringIO()):
            res = CB.build(out, approved=app, specs=specs)
        meta = json.loads((out / "colossus.json").read_text())
        form = meta["forms"]["fx_test"]
        names = [L["name"] for L in form["layers"]]
        files = [tl["file"] for L in form["layers"] for tl in L["image"] + [x for f in L.get("frames", {}).values() for x in f]]
        man = (out / "manifest.sha256").read_text().splitlines()
        check(res is not None and names == ["body", "arm_r", "core", "glow"] and all((out / f).exists() for f in files)
              and {L["name"]: L.get("blend") for L in form["layers"]}["glow"] == "add"
              and set(form["layers"][1]["frames"]) == {"raise", "slam", "recoil"}
              and form["canvas"] == [W, H] and form["scale"] == 3 and form["targetRect"] == [30, 22, 100, 68]
              and meta["bytes"] > 0 and len(man) == len(files) + 1,
              f"build: fixture -> colossus.json (layers, limb frames, glow blend add, canvas, scale, targetRect, bytes) and "
              f"a sha256 manifest of every file ({len(files)} files)")
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
        soft = np.asarray(fixture_master()).copy()
        soft[25, 25, 3] = 120
        app2, specs2 = write_fixture(tmp / "fx2", master=Image.fromarray(soft))
        r = _raises(lambda: CB.build(tmp / "o2", approved=app2, specs=specs2), "binary")
        check(bool(r), f"build: a master with partial alpha (outside glow) is refused ({r[:80]!r})")
        lock = CB.lock(app, specs, "fx_test")
        check(lock.exists() and CB.lock_problems(app, specs, "fx_test") == [], "lock: written, and a fresh build matches it")
        m2 = fixture_master()
        m2.putpixel((30, 30), GOLD + (255,))
        m2.save(app / "fx_test" / "master.png")
        probs = CB.lock_problems(app, specs, "fx_test")
        check(any("hash differs" in p and "body" in p for p in probs), f"lock: a changed layer is reported ({probs[:1]})")


def _stage_rim(check) -> None:
    sys.path.insert(0, str(TOOLS))
    import stage_backgrounds as SB
    import stage_rim as SR
    lines = len((TOOLS / "stage_backgrounds.py").read_text().splitlines())
    check(lines <= 249, f"stage_backgrounds.py stays line-neutral ({lines} <= 249 lines)")
    check(SR.RIM == ("rim-src.png", 485, 1.05, "center", 370), f"stage_rim: the user-accepted entry {SR.RIM}")
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
