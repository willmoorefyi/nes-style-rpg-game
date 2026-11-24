"""EF-G G4 helpers for gen/monster_hr_br.py: the screen-scale page (large and small cuts at x2 on a field colour), the
despur before / after page and the prepared monster_scale.yaml entry (the EF-A smoothing rule: `smooth: [despur]` with
a hi-res texture at T = S; despur left out when it eats wispy edges), and the monsters.yaml rewrite of the held
approval (size large, the EF4 brief and pose texts)."""
from __future__ import annotations

import re
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent


def screen(big: list[Image.Image], small: list[Image.Image], out: Path) -> Path:
    from gen import monster_br as MB
    rows = [MB.sheet(big), MB.sheet(small)]
    w = max(r.width for r in rows) * 2 + 40
    page = Image.new("RGBA", (w, sum(r.height * 2 + 20 for r in rows) + 20), (58, 74, 52, 255))
    y = 20
    for r in rows:
        page.alpha_composite(r.resize((r.width * 2, r.height * 2), Image.Resampling.NEAREST), (20, y))
        y += r.height * 2 + 20
    out.parent.mkdir(parents=True, exist_ok=True)
    page.save(out)
    return out


def despur_page(sid: str, frames: list[Image.Image], out: Path) -> Path:
    """Each frame before / after despur (x4, on dark ground) and the changed px; writes scale_entry.txt beside it."""
    from gen import monster_hires as H
    outline = H.outline_colour(np.asarray(frames[0]))
    w, h = frames[0].size
    page = Image.new("RGBA", (w * 4 * len(frames) + 20, h * 4 * 2 + 30), (30, 30, 34, 255))
    changed = []
    for k, f in enumerate(frames):
        pre = np.asarray(f)
        post, d, fl = H.despur(pre, outline)
        changed.append((d, fl))
        for row, a in enumerate((pre, post)):
            tile = Image.new("RGBA", (w, h), (52, 62, 52, 255))
            tile.alpha_composite(Image.fromarray(a))
            page.paste(tile.resize((w * 4, h * 4), Image.Resampling.NEAREST), (10 + k * w * 4, 10 + row * (h * 4 + 10)))
    page.save(out)
    entry = f"{sid}: {{scale: 2, tex: 2, smooth: [despur]}}   # EF4 (prepared, not applied): the large cut at 2x"
    (out.parent / "scale_entry.txt").write_text(entry + f"\n# despur per frame (dropped, filled): {changed}\n")
    return out


def write_monsters_yaml(sid: str, sm: dict, path: Path | None = None) -> None:
    """The held approve's monsters.yaml rewrite: the `- id: <sid>` entry becomes size large with the EF4 brief and
    pose texts (its Gemini fields are no longer used: the sheets are Bedrock records); `body` is kept."""
    path = path or HERE / "monsters.yaml"
    text = path.read_text()
    m = re.search(rf"^- id: {sid}\n(.*?)(?=^- id: |\Z)", text, re.S | re.M)
    if not m:
        raise SystemExit(f"{sid}: not in monsters.yaml")
    body = re.search(r"^  body: (\S+)$", m.group(1), re.M)
    fold = lambda s: "\n".join("    " + ln for ln in _wrap(" ".join(s.split())))
    new = (f"- id: {sid}\n  # EF4 (docs/ENEMY_FEEDBACK_PLAN.md EF-G): puppet-then-repaint, Bedrock SD 3.5 Large "
           f"(monster_hr.yaml#{sid}); approved/{sid}/*.json\n  # record the cache keys. The older looks are archived "
           f"(docs/RETIRED_SPRITES.md); the fields below are the EF4 brief.\n  size: large\n"
           + (f"  body: {body.group(1)}\n" if body else "") + f"  prompt: >-\n{fold(sm['brief'])}\n"
           f"  attack: {sm['poses']['attack']}\n  hurt: {sm['poses']['hurt']}\n  kneel: {sm['poses']['kneel']}\n"
           f"  seeds: [1234]\n")
    path.write_text(text[:m.start()] + new + text[m.end():])


def _wrap(s: str, width: int = 112) -> list[str]:
    out, cur = [], ""
    for word in s.split():
        if cur and len(cur) + 1 + len(word) > width:
            out.append(cur)
            cur = word
        else:
            cur = f"{cur} {word}".strip()
    return out + ([cur] if cur else [])
