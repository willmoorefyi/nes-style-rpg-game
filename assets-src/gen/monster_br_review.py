"""EF-F review pages for monster_br.py (written to ~/temp/ff-game/ef/bedrock/<id>/v<N>/)."""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

POSES = ("idle", "attack", "hurt", "kneel")


def review(raws: list[Image.Image], frames: list[Image.Image], info: dict, out: Path, sheet) -> Path:
    """raw(s), the cut sheet, the kneel key and a review page (frames x4 on dark and light ground + the renders)."""
    out.mkdir(parents=True, exist_ok=True)
    for k, r in enumerate(raws):
        r.save(out / (f"raw_{POSES[k]}.png" if len(raws) > 1 else "raw.png"))
    sheet(frames).save(out / "sheet.png")
    frames[3].save(out / "kneel.png")
    (w, h), z = frames[0].size, 4
    th = h * z * 2 + 10
    thumbs = [r.convert("RGBA").resize((round(r.width * th / r.height / (2 if len(raws) == 1 else 4)),
                                        round(th / (1 if len(raws) == 1 else 2)))) for r in raws]
    tw = sum(t.width for t in thumbs[:2]) if len(raws) > 1 else thumbs[0].width
    page = Image.new("RGBA", (w * z * 4 + 50 + tw, h * z * 2 + 30), (30, 30, 34, 255))
    for row, bg in enumerate(((52, 62, 52, 255), (150, 150, 140, 255))):
        for k, f in enumerate(frames):
            tile = Image.new("RGBA", (w, h), bg)
            tile.alpha_composite(f)
            page.paste(tile.resize((w * z, h * z), Image.Resampling.NEAREST), (10 + k * (w * z + 4), 10 + row * (h * z + 10)))
    for k, t in enumerate(thumbs):
        page.paste(t, (w * z * 4 + 40 + (k % 2) * (thumbs[0].width), 10 + (k // 2) * t.height))
    page.save(out / "review.png")
    (out / "report.json").write_text(json.dumps(info, indent=1, default=str) + "\n")
    return out / "review.png"


def preview(sid: str, sp: dict, out: Path, cut, sprite) -> list[Path]:
    """Review only (EF3): the set cut at the small 80-cell size too, and both cuts at screen scale (x2) on a field."""
    from gen import monster_br as MB
    big, _, raws = cut(sid, sp)
    small_sp = {**sp, "sprites": {**sp["sprites"], sid: {**sprite(sid, sp), "size": "small"}}}
    small, info, _ = cut(sid, small_sp)
    review(raws, small, info, out / "set_small", MB.sheet)
    rows = [MB.sheet(big), MB.sheet(small)]
    w = max(r.width for r in rows) * 2 + 40
    page = Image.new("RGBA", (w, sum(r.height * 2 + 20 for r in rows) + 20), (58, 74, 52, 255))
    y = 20
    for r in rows:
        page.alpha_composite(r.resize((r.width * 2, r.height * 2), Image.Resampling.NEAREST), (20, y))
        y += r.height * 2 + 20
    page.save(out / "screen_x2.png")
    return [out / "set_small" / "review.png", out / "screen_x2.png"]
