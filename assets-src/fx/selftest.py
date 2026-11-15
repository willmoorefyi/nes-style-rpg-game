"""Offline self-checks for the battle-fx glyph generator (docs/FEEDBACK_PLAN_2026-11-14.md §3.4).

  python3 -I assets-src/fx/selftest.py

The checker itself (it must reject an off-palette pixel, a semi-transparent pixel and a glyph touching its cell
border), every glyph against it, determinism (two builds give equal bytes), the atlas page size, coverage of every
glyph and ramp that assets/data/spell-effects.yaml names, and that the committed atlas is the current build.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))

from pixel import Canvas  # noqa: E402

import build_fx as B  # noqa: E402
import fx_palette as P  # noqa: E402
import glyphs as G  # noqa: E402

FAILS: list[str] = []


def check(cond: bool, msg: str) -> None:
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        FAILS.append(msg)


def checker_rejects_bad_glyphs() -> None:
    print("checker")
    ramp = P.RAMPS["fire"]
    good = Canvas(8, 8)
    good.rect(2, 2, 5, 5, ramp[2])
    check(B.check_glyph(good, ramp) == [], "a clean glyph passes")
    off = Canvas(8, 8)
    off.rect(2, 2, 5, 5, ramp[2])
    off.set(3, 3, (1, 2, 3))
    check(any("off-palette" in p for p in B.check_glyph(off, ramp)), "an off-palette pixel fails")
    semi = Canvas(8, 8)
    semi.rect(2, 2, 5, 5, ramp[2])
    semi.px[4, 4] = (*ramp[1], 128)
    check(any("semi-alpha" in p for p in B.check_glyph(semi, ramp)), "a semi-transparent pixel fails")
    edge = Canvas(8, 8)
    edge.rect(0, 2, 5, 5, ramp[2])
    check(any("border" in p for p in B.check_glyph(edge, ramp)), "a pixel on the 1-px border fails")
    empty = Canvas(8, 8)
    check(any("empty" in p for p in B.check_glyph(empty, ramp)), "an empty frame fails")
    not15 = Canvas(8, 8)
    not15.rect(2, 2, 5, 5, (13, 13, 13))
    check(any("off-palette" in p for p in B.check_glyph(not15, [(13, 13, 13)])), "a colour that is not 5-bit fails")


def palette_is_5bit() -> None:
    print("palette")
    for name, ramp in P.RAMPS.items():
        ok = len(ramp) == 5 and all(B.is_c15(c) for c in ramp)
        lum = [0.299 * r + 0.587 * g + 0.114 * b for r, g, b in ramp]
        check(ok and lum == sorted(lum), f"ramp {name}: 5 colours, 5-bit, darkest -> lightest")


def every_glyph_is_clean() -> None:
    print("glyphs")
    keys = B.atlas_keys()
    check(len(keys) > 0, f"{len(keys)} glyph keys")
    for glyph, ramp in keys:
        spec = G.GLYPHS[glyph]
        frames = G.render(glyph, ramp)
        problems = [p for i, f in enumerate(frames) for p in B.check_glyph(f, G.colors_for(glyph, ramp), f"frame {i}", spec.tile)]
        sizes = {(f.w, f.h) for f in frames}
        check(1 <= len(frames) <= 4 and sizes == {spec.cell} and not problems,
              f"{glyph}.{ramp}: {len(frames)} frame(s) {spec.cell} " + ("; ".join(problems[:3]) or "clean"))
        if len(frames) > 1:
            distinct = len({f.img.tobytes() for f in frames})
            check(distinct == len(frames), f"{glyph}.{ramp}: every frame differs")


def deterministic_and_small() -> None:
    print("atlas")
    png1, meta1 = B.build_atlas()
    png2, meta2 = B.build_atlas()
    check(png1 == png2 and meta1 == meta2, "two builds give equal bytes")
    from io import BytesIO
    from PIL import Image
    img = Image.open(BytesIO(png1))
    check(img.width <= 4096 and img.height <= 4096, f"battle-fx.png {img.width}x{img.height} <= 4096")
    alphas = {a for a in img.getchannel("A").getdata()}
    check(alphas <= {0, 255}, "binary alpha in the atlas")
    meta = json.loads(meta1)
    check(meta.get("scale") == B.SCALE == 2, "json scale 2 (nearest-neighbour x2)")


def yaml_is_covered() -> None:
    print("spell-effects.yaml")
    have = set(B.atlas_keys())
    need = B.needed_keys()
    missing = sorted(need - have)
    check(len(need) > 0 and not missing, f"{len(need)} glyph/ramp pairs named by the effects; missing {missing}")


def committed_is_current() -> None:
    print("committed")
    png, meta = B.build_atlas()
    out = B.ASSETS / "sprites"
    same = (out / "battle-fx.png").exists() and (out / "battle-fx.png").read_bytes() == png \
        and (out / "battle-fx.json").read_text() == meta
    check(same, "assets/sprites/battle-fx.{png,json} equal a fresh build (run build_assets.py fx)")


def main() -> int:
    checker_rejects_bad_glyphs()
    palette_is_5bit()
    every_glyph_is_clean()
    deterministic_and_small()
    yaml_is_covered()
    committed_is_current()
    print(f"\n{len(FAILS)} failure(s)" if FAILS else "\nall fx checks passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
