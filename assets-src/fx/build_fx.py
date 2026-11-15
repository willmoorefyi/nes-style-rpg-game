"""Build the battle-fx atlas (docs/FEEDBACK_PLAN_2026-11-14.md §3.4): every glyph of glyphs.py in every ramp that
assets/data/spell-effects.yaml (or the status overlays) uses -> assets/sprites/battle-fx.png (x2, nearest) + .json.

  python3 -I assets-src/build_assets.py fx      # the build stage
  python3 -I assets-src/fx/build_fx.py --preview /tmp/fd/sheet.png   # every key on a dark and a light strip, x4

Deterministic (sorted keys, fixed packing, no randomness); every frame passes check_glyph or the build fails.
"""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))

import yaml  # noqa: E402
from PIL import Image  # noqa: E402

from pixel import Canvas, scaled  # noqa: E402

import fx_palette as P  # noqa: E402
import glyphs as G  # noqa: E402

Color = tuple[int, int, int]
ASSETS = HERE.parent.parent / "assets"
EFFECTS_YAML = ASSETS / "data" / "spell-effects.yaml"
SCALE = 2
PAGE_W = 512  # native px per atlas row
PAD = 1

# Keys the status overlays and icons use (pass F's Fe), whatever the spell table names.
ALWAYS: set[tuple[str, str]] = {
    ("z", "sleep"), ("star", "stun"), ("spark", "stun"), ("bubble", "poison"), ("ink", "blind"), ("sweat", "ether"),
    ("sparkle", "ice"), ("skull", "fear"), ("glint", "holy"), ("dust", "dust"),
    *((name, "icon") for name, spec in G.GLYPHS.items() if spec.fixed == "icon"),
}


def is_c15(c: Color) -> bool:
    """True when every channel is a 5-bit value expanded the SNES way ((v << 3) | (v >> 2))."""
    return all(((v >> 3) << 3 | (v >> 3) >> 2) == v for v in c)


def check_glyph(c: Canvas, colors: list[Color], where: str = "", tile: str | None = None) -> list[str]:
    """Problems with one frame: off-palette or non-5-bit colours, semi-alpha, pixels on the 1-px border (a vertically
    tiling glyph may touch its top and bottom edges), or no pixels at all."""
    allowed = set(colors)
    problems: list[str] = []
    opaque = 0
    tag = f"{where}: " if where else ""
    for y in range(c.h):
        for x in range(c.w):
            r, g, b, a = c.px[x, y]
            if a == 0:
                continue
            if a != 255:
                problems.append(f"{tag}semi-alpha {a} at {x},{y}")
                continue
            opaque += 1
            if (r, g, b) not in allowed or not is_c15((r, g, b)):
                problems.append(f"{tag}off-palette {(r, g, b)} at {x},{y}")
            side = x in (0, c.w - 1) or (tile != "v" and y in (0, c.h - 1))
            if side:
                problems.append(f"{tag}border pixel at {x},{y}")
    if opaque == 0:
        problems.append(f"{tag}empty frame")
    return problems


def _effect_keys(e: dict) -> set[tuple[str, str]]:
    ramp = e.get("ramp")
    keys = set()
    for gk, rk in (("glyph", "ramp"), ("accent", "accentRamp"), ("mark", "markRamp")):
        glyph = e.get(gk)
        if not glyph:
            continue
        if glyph not in G.GLYPHS:
            raise SystemExit(f"spell-effects.yaml: unknown glyph {glyph}")
        keys.add((glyph, G.GLYPHS[glyph].fixed or e.get(rk) or ramp))
    return keys


def needed_keys(path: Path = EFFECTS_YAML) -> set[tuple[str, str]]:
    """Every (glyph, ramp) pair an effect in spell-effects.yaml draws."""
    data = yaml.safe_load(path.read_text()) or {}
    keys: set[tuple[str, str]] = set()
    for e in (data.get("effects") or {}).values():
        keys |= _effect_keys(e)
    return keys


def atlas_keys() -> list[tuple[str, str]]:
    keys = sorted(ALWAYS | needed_keys())
    for glyph, ramp in keys:
        if glyph not in G.GLYPHS or (ramp not in P.RAMPS and ramp not in P.RAMPS_EXTRA):
            raise SystemExit(f"fx atlas: unknown glyph or ramp {glyph}.{ramp}")
    return keys


def build_atlas() -> tuple[bytes, str]:
    """The atlas PNG bytes (x2) and its JSON text."""
    rendered = []
    for glyph, ramp in atlas_keys():
        spec = G.GLYPHS[glyph]
        frames = G.render(glyph, ramp)
        problems = [p for i, f in enumerate(frames)
                    for p in check_glyph(f, G.colors_for(glyph, ramp), f"{glyph}.{ramp} frame {i}", spec.tile)]
        if problems:
            raise SystemExit("fx glyph check failed:\n  " + "\n  ".join(problems[:20]))
        rendered.append((f"{glyph}.{ramp}", spec, frames, P.colors(ramp)))
    # shelf packing: one row band per glyph key, frames side by side, rows wrap at PAGE_W
    x = y = band = 0
    places = []
    for key, spec, frames, cols in rendered:
        w, h = spec.cell
        row_w = len(frames) * (w + PAD)
        if x + row_w > PAGE_W:
            x, y, band = 0, y + band + PAD, 0
        places.append((key, spec, frames, cols, x, y))
        x += row_w
        band = max(band, h)
    page = Image.new("RGBA", (PAGE_W, y + band), (0, 0, 0, 0))
    meta: dict = {"scale": SCALE, "glyphs": {}}
    for key, spec, frames, cols, gx, gy in places:
        w, h = spec.cell
        coords = []
        for i, f in enumerate(frames):
            fx = gx + i * (w + PAD)
            page.paste(f.img, (fx, gy))
            coords.append([fx * SCALE, gy * SCALE])
        entry = {"cell": [w, h], "frames": coords, "color": P.hex_of(cols[min(3, len(cols) - 1)])}
        if spec.tile:
            entry["tile"] = spec.tile
        if spec.fixed:
            entry["fixed"] = True
        meta["glyphs"][key] = entry
    buf = io.BytesIO()
    scaled(page, SCALE).save(buf, format="PNG", optimize=False, compress_level=9)
    return buf.getvalue(), json.dumps(meta, indent=1, sort_keys=True) + "\n"


def build(assets: Path = ASSETS) -> None:
    png, meta = build_atlas()
    out = assets / "sprites"
    (out / "battle-fx.png").write_bytes(png)
    (out / "battle-fx.json").write_text(meta)
    print(f"fx: {len(json.loads(meta)['glyphs'])} glyph keys -> {out / 'battle-fx.png'}")


def preview(path: str, zoom: int = 4) -> None:
    """Every key's frames on a dark strip and a light strip (to judge contrast on both kinds of background)."""
    rows = []
    for glyph, ramp in atlas_keys():
        frames = G.render(glyph, ramp)
        w, h = G.GLYPHS[glyph].cell
        strip = Image.new("RGBA", (len(frames) * (w + 2) * 2 + 4, h + 2), (0, 0, 0, 0))
        for half, bg in enumerate(((24, 28, 48, 255), (176, 168, 136, 255))):
            ox = half * (len(frames) * (w + 2) + 4)
            strip.paste(Image.new("RGBA", (len(frames) * (w + 2), h + 2), bg), (ox, 0))
            for i, f in enumerate(frames):
                strip.alpha_composite(f.img, (ox + 1 + i * (w + 2), 1))
        rows.append(strip)
    width = max(r.width for r in rows)
    sheet = Image.new("RGBA", (width, sum(r.height + 1 for r in rows)), (90, 90, 90, 255))
    yy = 0
    for r in rows:
        sheet.paste(r, (0, yy))
        yy += r.height + 1
    scaled(sheet, zoom).save(path)
    print(f"preview: {path}")


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--preview":
        preview(sys.argv[2])
    else:
        build()
