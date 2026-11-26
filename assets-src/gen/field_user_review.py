"""Pass PT review pages for gen/field_user.py (docs/PLAYTEST_ART_PLAN.md 4.1 step 10): the imported sheet at x2 and x4,
the 7-column walk of each direction as build_field_ai makes it (puppet.walk_row) as a strip and an animated GIF, and
the sheet beside a hero and existing townsfolk at field scale. Written to ~/temp/ff-game/playtest/art/user/<id>/."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from gen import field_user as F

OUT = Path.home() / "temp/ff-game/playtest/art/user"
FIELD_SCALE = 2                                         # characters-ai.json fieldScale
BG = (112, 136, 96, 255)                                # a grass-like field green
COMPARE = ("warrior", "villager", "villager_f", "dwarf_child")
STEP_MS = 130


def rows_of(sheet: Image.Image) -> dict[str, list[Image.Image]]:
    return {d: [sheet.crop((c * F.GW, r * F.GH, (c + 1) * F.GW, (r + 1) * F.GH)) for c in range(3)]
            for r, d in enumerate(F.ROWS)}


def walk(sheet: Image.Image, hop: bool) -> dict[str, list[Image.Image]]:
    """The 7 walk columns per direction (right = left mirrored), as build_assets.build_field_ai makes them."""
    from gen import puppet as PU
    cfg = {"field": {k: {"skip": True} for k in ("down", "up", "side")}} if hop else None
    out = {}
    for d, three in rows_of(sheet).items():
        out[d] = PU.walk_row("side" if d == "left" else d, three, cfg, F.FOOT)
    out["right"] = [f.transpose(Image.Transpose.FLIP_LEFT_RIGHT) for f in out["left"]]
    return out


def on_bg(img: Image.Image, k: int) -> Image.Image:
    bg = Image.new("RGBA", (img.width * k, img.height * k), BG)
    bg.alpha_composite(img.resize((img.width * k, img.height * k), Image.Resampling.NEAREST))
    return bg


def approved_sheet(cid: str) -> Image.Image:
    import build_assets as B                             # the game's own rows (flip_rows applied)
    rows = B.field_rows()[cid]
    s = Image.new("RGBA", (3 * F.GW, 3 * F.GH))
    for r, d in enumerate(F.ROWS):
        s.alpha_composite(rows[d][1], (0, r * F.GH))
    return s


def review(sid: str, out: Path | None = None) -> list[Path]:
    from gen import puppet as PU
    out = out or OUT / sid
    out.mkdir(parents=True, exist_ok=True)
    rec = F.recipe(sid)
    sheet, info = F.cut(sid, rec)
    paths = []
    for k in (2, 4):
        on_bg(sheet, k).save(p := out / f"{sid}_sheet_x{k}.png")
        paths.append(p)
    w = walk(sheet, rec.get("walk") == "hop")
    k = 4
    strip = Image.new("RGBA", (7 * F.GW * k, 4 * F.GH * k), BG)
    for r, d in enumerate(("down", "up", "left", "right")):
        for c, f in enumerate(w[d]):
            strip.alpha_composite(f.resize((F.GW * k, F.GH * k), Image.Resampling.NEAREST), (c * F.GW * k, r * F.GH * k))
        seq = [w[d][i] for i in PU.WALK_SEQUENCE] * 2
        gif = [on_bg(f, 4).convert("P", palette=Image.Palette.ADAPTIVE) for f in seq]
        gif[0].save(p := out / f"{sid}_walk_{d}.gif", save_all=True, append_images=gif[1:], duration=STEP_MS, loop=0,
                    disposal=2)
        paths.append(p)
    frames = []
    for i in [i for i in PU.WALK_SEQUENCE] * 2:              # every facing side by side, one GIF
        f = Image.new("RGBA", (4 * F.GW, F.GH))
        for k, d in enumerate(("down", "up", "left", "right")):
            f.alpha_composite(w[d][i], (k * F.GW, 0))
        frames.append(on_bg(f, 4).convert("P", palette=Image.Palette.ADAPTIVE))
    frames[0].save(p := out / f"{sid}_walk_all.gif", save_all=True, append_images=frames[1:], duration=STEP_MS, loop=0,
                   disposal=2)
    paths.append(p)
    strip.save(p := out / f"{sid}_walk_columns_x4.png")
    paths.append(p)
    # beside a hero and existing townsfolk at field scale (stand frames of every row, then the new sheet)
    others = [(c, approved_sheet(c)) for c in COMPARE] + [(sid, sheet)]
    cmp_ = Image.new("RGBA", (len(others) * (3 * F.GW + 8) * FIELD_SCALE, (3 * F.GH + 12) * FIELD_SCALE), BG)
    d = ImageDraw.Draw(cmp_)
    for i, (cid, s) in enumerate(others):
        x = i * (3 * F.GW + 8) * FIELD_SCALE
        cmp_.alpha_composite(s.resize((s.width * FIELD_SCALE, s.height * FIELD_SCALE), Image.Resampling.NEAREST),
                             (x, 12 * FIELD_SCALE))
        d.text((x + 4, 4), cid + (" (NEW)" if cid == sid else ""), fill=(255, 255, 255, 255))
    cmp_.save(p := out / f"{sid}_compare_field_scale.png")
    paths.append(p)
    a = np.asarray(sheet)
    info["drawn_heights"] = [int(np.ptp(np.where(a[r * F.GH:(r + 1) * F.GH, c * F.GW:(c + 1) * F.GW, 3].any(1))[0]) + 1)
                             for r in range(3) for c in range(3)]
    (p := out / f"{sid}_info.json").write_text(json.dumps(info, indent=2) + "\n")
    paths.append(p)
    return paths


def contact(ids: list[str], out: Path | None = None) -> Path:
    """Every imported sheet at x2 (all nine frames) beside a hero and existing townsfolk, on the field green."""
    out = out or OUT
    sheets = [(c, approved_sheet(c)) for c in ("warrior", "villager", "villager_f")] + [(i, F.cut(i)[0]) for i in ids]
    k, cols = FIELD_SCALE, 6
    cw, ch = (3 * F.GW + 6) * k, (3 * F.GH + 10) * k
    img = Image.new("RGBA", (cols * cw, ((len(sheets) + cols - 1) // cols) * ch), BG)
    d = ImageDraw.Draw(img)
    for n, (cid, s) in enumerate(sheets):
        x, y = (n % cols) * cw, (n // cols) * ch
        img.alpha_composite(s.resize((s.width * k, s.height * k), Image.Resampling.NEAREST), (x, y + 10 * k))
        d.text((x + 4, y + 4), cid + ("" if cid in ids else " (existing)"), fill=(255, 255, 255, 255))
    img.save(p := out / "contact_all_x2.png")
    return p
