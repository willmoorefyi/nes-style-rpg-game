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


def write_monsters_yaml(sid: str, sm: dict, path: Path | None = None, rows: dict | None = None) -> None:
    """The held approve's monsters.yaml rewrite: the `- id: <sid>` entry becomes size large with the EF4 brief and
    pose texts (its Gemini fields are no longer used: the sheets are Bedrock records); `body` is kept. `rows`
    {pose: picked variation row}: a picked row's `prompt_pose` is written instead of `poses[pose]` (amendment B0)."""
    path = path or HERE / "monsters.yaml"
    txt = {p: ((rows or {}).get(p) or {}).get("prompt_pose") or sm["poses"][p] for p in ("attack", "hurt", "kneel")}
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
           f"  attack: {txt['attack']}\n  hurt: {txt['hurt']}\n  kneel: {txt['kneel']}\n"
           f"  seeds: [1234]\n")
    path.write_text(text[:m.start()] + new + text[m.end():])


def approve_json(sid: str, sm: dict, pk: list[tuple], info: dict, size: tuple[int, int], model: str) -> tuple:
    """The held approve's monster_large.json and kneel.json (Bedrock shapes) from the picks `pk` = [(pose, n, key,
    row)]; each `sources[]` entry carries its own row's pass / purpose / arm (the EF4 idle with EF5 poses)."""
    import time
    from gen.monster_hr_br import row_pass
    today, (w, h) = time.strftime("%Y-%m-%d"), size
    srcs = [{"pose": p, "cache_key": k, "variation": n, "seed": int(v["seed"]), "strength": float(v["strength"]),
             "pass": row_pass(v)[0], "purpose": row_pass(v)[1], "arm": f"{row_pass(v)[0].lower()}_sd35"}
            for p, n, k, v in pk]
    inputs = {"idle": {"master_sha256": sm["master_sha256"], "raw_keys": [sm["prep"]["source"]] + (
        [sm["prep"]["graft"]["source"]] if sm["prep"].get("graft") else []) + (
        [sm["prep"]["nobg_key"]] if sm["prep"].get("nobg_key") else [])}}   # B0: the remove_bg render too
    inputs.update({p: {"posed_sha256": sm[f"{v.get('input', p)}_sha256"], "master_sha256": sm["master_sha256"]}
                   for p, n, _, v in pk[1:]})
    meta = {"character": sid, "sheet": "monster_large", "backend": "bedrock", "model": model,
            "seed": srcs[0]["seed"], "cache_key": srcs[0]["cache_key"], "purpose": srcs[0]["purpose"],
            "pass": srcs[0]["pass"], "approved": today, "grid": [w, h], "bottom_row": 122, "layout": [3, 1],
            "poses": ["idle", "attack", "hurt"], "size": "large", "floating": False, "flip_frames": [],
            "sources": srcs[:3], "inputs": inputs, "recipe": f"monster_hr.yaml#{sid}",
            "route": "EF4: puppet-then-repaint (monster_hr_prep.py, monster_hr_puppet.py, SD 3.5 Large image-to-image "
            "monster_hr_br.py)", "cut": {k: info.get(k) for k in ("mode", "scale", "fit", "native_heights", "cell_px")}}
    kv = pk[3][3]
    kneel = {"character": sid, "sheet": "kneel", "arm": srcs[3]["arm"], "seed": srcs[3]["seed"],
             "try": srcs[3]["variation"], "grid": [w, h], "bottom_row": 122, "foot_row": 122, "models": [model],
             "br_cache_keys": [srcs[3]["cache_key"]], "approved": today,
             "settings": {"route": "EF4 kneel: puppet pose repainted by SD 3.5 (monster_hr_br.py)",
                          "pass": srcs[3]["pass"], "strength": srcs[3]["strength"],
                          "posed_sha256": sm[f"{kv.get('input', 'kneel')}_sha256"]}}
    return meta, kneel, srcs


def _wrap(s: str, width: int = 112) -> list[str]:
    out, cur = [], ""
    for word in s.split():
        if cur and len(cur) + 1 + len(word) > width:
            out.append(cur)
            cur = word
        else:
            cur = f"{cur} {word}".strip()
    return out + ([cur] if cur else [])
