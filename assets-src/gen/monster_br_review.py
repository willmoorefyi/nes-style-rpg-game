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
