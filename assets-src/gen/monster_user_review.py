"""EF-H (docs/ENEMY_FEEDBACK_PLAN.md EF-H): gen/monster_user.py's measures, review pages and approved json shapes."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

from gen import spec as S

REVIEW = Path.home() / "temp" / "ff-game" / "ef" / "user"


def colour_error(cells, frames: list[Image.Image], s: float, info: dict) -> dict:
    """The quantizer's colour error over the render's figure px (s = 1.0: the same px, so a direct diff), and the
    glow: render px that are bright yellow-green, and the share of them still green after the cut."""
    if s != 1.0:
        return {"note": "rescaled: no per-px error"}
    errs, glow, kept = [], 0, 0
    for (rc, m), fr, (ox, oy) in zip(cells, frames, info["offsets"]):
        a = np.asarray(fr)
        vy, vx = np.where(m)
        q = a[vy + oy, vx + ox, :3].astype(np.float32)
        o = rc[vy, vx].astype(np.float32)
        errs.append(np.sqrt(((q - o) ** 2).sum(1)))
        g = (o[:, 1] >= 120) & (o[:, 1] > o[:, 0] + 10) & (o[:, 1] > o[:, 2] + 40)
        glow += int(g.sum())
        kept += int(((q[g, 1] >= 110) & (q[g, 1] > q[g, 2] + 30)).sum())
    e = np.concatenate(errs)
    return {"max": round(float(e.max()), 1), "p99": round(float(np.percentile(e, 99)), 1),
            "mean": round(float(e.mean()), 1), "glow_px": glow, "glow_kept": round(kept / max(1, glow), 3)}


def review(sid: str, out: Path | None = None) -> list[Path]:
    """Before / after at 1x and at screen x2 (on battle-green), the cut sheet and kneel, and info.json."""
    from gen import monster_user as U
    rec = U.recipe(sid)
    frames, info = U.cut(sid, rec)
    out = out or REVIEW / sid
    out.mkdir(parents=True, exist_ok=True)
    src = U.source(rec)
    U.sheet(frames).save(out / f"monster_{rec.get('size', 'large')}.png")
    frames[3].save(out / "kneel.png")
    cut4 = Image.new("RGBA", (frames[0].width * 4, frames[0].height))
    for k, f in enumerate(frames):
        cut4.paste(f, (k * f.width, 0))
    paths = []
    for name, k in (("before_after_1x.png", 1), ("before_after_x2.png", 2)):
        a, b = src.resize((src.width * k, src.height * k), Image.Resampling.NEAREST), cut4.resize(
            (cut4.width * k, cut4.height * k), Image.Resampling.NEAREST)
        page = Image.new("RGBA", (max(a.width, b.width) + 20, a.height + b.height + 30), (58, 74, 52, 255))
        page.alpha_composite(a, (10, 10))
        page.alpha_composite(b, (10, a.height + 20))
        page.save(out / name)
        paths.append(out / name)
    (out / "info.json").write_text(json.dumps(info, indent=2) + "\n")
    return paths + [out / f"monster_{rec.get('size', 'large')}.png", out / "kneel.png", out / "info.json"]


def metas(sid: str, rec: dict, info: dict, today: str) -> tuple[dict, dict]:
    """approved/<id>/monster_<size>.json and kneel.json (backend: user)."""
    size, (cw, ch) = rec.get("size", "large"), (info["cw"], S.MONSTER_BANDS[rec.get("size", "large")].cell)
    band = S.MONSTER_BANDS[size]
    common = {"backend": "user", "source": rec["file"], "sha256": rec["sha256"], "recipe": f"monster_user.yaml#{sid}",
              "tool": rec["tool"], "rendered": str(rec["rendered"]), "author": rec.get("author", "user"),
              "refs": rec.get("refs"), "approved": today, "grid": [cw, ch], "bottom_row": band.foot_row}
    meta = {"character": sid, "sheet": f"monster_{size}", **common, "layout": [3, 1], "size": size,
            "floating": False, "flip_frames": [], "poses": ["idle", "attack", "hurt"],
            "route": "EF-H: user-rendered sheet imported by monster_user.py (house quantizer, no AI call)",
            "cut": {k: info[k] for k in ("scale", "scale_why", "native_heights", "anchors", "anchor_x", "error")}}
    kneel = {"character": sid, "sheet": "kneel", **common, "foot_row": band.foot_row,
             "settings": {"route": "EF-H: the user sheet's 4th pose in the idle's cell (monster_user.py)"}}
    return meta, kneel


def check(meta: dict, gen: Path | None = None) -> str | None:
    """A `backend: user` approved json (monster sheet or kneel): its recipe's source matches the recorded sha256
    and re-importing it gives the approved png byte for byte. None when it holds, else the reason."""
    from gen import monster_user as U
    gen = gen or U.HERE
    sid, name = meta.get("character"), meta.get("sheet")
    try:
        rec = U.recipe(sid, gen / "monster_user.yaml")
        if rec["sha256"] != meta.get("sha256") or rec["file"] != meta.get("source"):
            return "the recipe's source / sha256 differ from the approved json"
        frames, _ = U.cut(sid, rec, gen)
    except SystemExit as e:
        return str(e)
    img = frames[3] if name == "kneel" else U.sheet(frames)
    have = np.asarray(Image.open(gen / "approved" / sid / f"{name}.png").convert("RGBA"))
    return None if np.array_equal(np.asarray(img), have) else f"approved/{sid}/{name}.png differs from the re-import"
