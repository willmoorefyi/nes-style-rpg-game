"""Offline selftest of monster_br.py (EF-F): the guide, the request bodies, the 2x2 cut and the approved records."""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

if str(Path(__file__).resolve().parent.parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
from PIL import Image, ImageDraw

from gen import bedrock as B
from gen import monster_br as MB
from gen import spec as S

SP = {"style": "s", "background": "b", "negative": "n",
      "sprites": {"t": {"size": "small", "body": "biped", "canvas": "square", "subject": "x",
                        "poses": {p: p for p in MB.POSES},
                        "variations": [{"n": 1, "seed": 5, "strength": 0.8},
                                       {"n": 2, "seed": 5, "strength": 0.8, "model": "sd35"},
                                       {"n": 6, "seed": 5, "strength": 0.8}]}}}


def synthetic() -> Image.Image:
    """A 2x2 render: four outlined figures on magenta, the kneel lower; drawn at about 6 px per sprite px."""
    img = Image.new("RGB", (1024, 1024), MB.KEY)
    d = ImageDraw.Draw(img)
    for k, (w, h, lean) in enumerate(((150, 400, 0), (230, 380, 60), (170, 390, -40), (200, 270, 0))):
        x0, y0 = (k % 2) * 512 + 256 - w // 2, (k // 2) * 512 + 460 - h
        d.polygon([(x0 + lean, y0), (x0 + w + lean, y0), (x0 + w, y0 + h), (x0, y0 + h)], fill=(16, 16, 24))
        d.polygon([(x0 + lean + 12, y0 + 12), (x0 + w + lean - 12, y0 + 12), (x0 + w - 12, y0 + h - 12),
                   (x0 + 12, y0 + h - 12)], fill=(150, 60, 40))
        d.ellipse([x0 + w // 2 - 30, y0 + 40, x0 + w // 2 + 30, y0 + 100], fill=(230, 200, 160))
    return img


def _ef2(check) -> None:
    """EF2 (monster_br2_key): the page keyed offline, the figure kept; the pose warp leans and squashes."""
    from gen import monster_br2_key as K
    img = Image.new("RGB", (1024, 1024), (140, 144, 142))
    d = ImageDraw.Draw(img)
    d.rectangle([450, 200, 570, 900], fill=(20, 18, 24))
    d.rectangle([470, 220, 550, 300], fill=(120, 120, 122))         # a grey patch inside the figure: kept
    a = np.asarray(K.key_bg(img))
    check(tuple(a[10, 10]) == K.KEY and tuple(a[500, 500]) == (20, 18, 24) and tuple(a[250, 500]) == (120, 120, 122),
          "EF2 key_bg: the grey page keyed, the figure and its inner grey kept")
    _, m0 = K.figure(img, 2)
    _, m1 = K.figure(K.warp(img, {"rot": 15, "key": 2}), 2)
    _, m2 = K.figure(K.warp(img, {"hip": 0.5, "legs": 0.3, "key": 2}), 2)
    top = lambda m: np.where(m[np.where(m.any(1))[0].min()])[0].mean()
    h = lambda m: np.ptp(np.where(m.any(1))[0])
    check(top(m1) > top(m0) + 20, "EF2 warp: + rot leans the top toward the heroes (right)")
    check(h(m2) < 0.75 * h(m0) and np.where(m2.any(1))[0].max() == np.where(m0.any(1))[0].max(),
          "EF2 warp: the hip squash lowers the figure, feet on the same row")


def main() -> int:
    fails = []

    def check(ok: bool, msg: str) -> None:
        print(("  ok   " if ok else "  FAIL ") + msg)
        if not ok:
            fails.append(msg)

    sm = SP["sprites"]["t"]
    g = MB.guide(sm)
    a = np.asarray(g)
    check(g.size == MB.CANVAS["square"] and tuple(a[0, 0]) == MB.KEY and tuple(a[-1, -1]) == MB.KEY,
          "guide: 1024 square, magenta page")
    check(all(tuple(a[int(r * 512 + 400), int(c * 512 + 256)]) != MB.KEY for r in (0, 1) for c in (0, 1)),
          "guide: a figure box in every 2x2 cell")
    u, s = MB.body("t", 1, SP), MB.body("t", 2, SP)
    check("mode" not in u and s.get("mode") == "image-to-image" and {"image", "strength", "seed"} <= set(u),
          "body: Ultra takes image + strength, SD 3.5 adds mode image-to-image")
    check(B.cache_key("ultra", u) != B.cache_key("sd35", s), "body: the two models have their own cache keys")
    try:
        MB.body("t", 6, SP)
        check(False, "variation 6 refused (at most 5 per sprite)")
    except SystemExit:
        check(True, "variation 6 refused (at most 5 per sprite)")
    try:
        B.invoke("ultra", {**u, "seed": 987654321}, paid=False, purpose=MB.PURPOSE)
        check(False, "bedrock.invoke refuses an uncached call without paid")
    except SystemExit:
        check(True, "bedrock.invoke refuses an uncached call without paid")
    frames, info = MB.cut([synthetic()], sm, SP["sprites"]["t"]["variations"][0])
    band = S.MONSTER_BANDS["small"]
    al = [np.asarray(f)[..., 3] > 0 for f in frames]
    rows = [np.where(m.any(1))[0] for m in al]
    check(len(frames) == 4 and len({f.size for f in frames}) == 1, f"cut: 4 frames of one cell ({frames[0].size})")
    check(all(r.max() == band.foot_row for r in rows), f"cut: feet on row {band.foot_row} ({[int(r.max()) for r in rows]})")
    check(all(r.min() >= MB.TOP_MARGIN for r in rows) and max(r.max() - r.min() + 1 for r in rows) <= band.height[1],
          f"cut: headroom of {MB.TOP_MARGIN} rows, height <= {band.height[1]} ({[int(r.min()) for r in rows]})")
    check(rows[3].max() - rows[3].min() < rows[0].max() - rows[0].min(), "cut: the kneel cell is lower than the idle")
    check(info["report"]["colours"] <= 16 and info["report"]["outline"], "cut: <= 16 colours, the shared outline")
    with tempfile.TemporaryDirectory() as td:
        root = Path(td) / "approved"
        paths = MB.approve("t", 1, root=root, frames=frames, info=info, keys=["k" * 24], sp=SP)
        meta = json.loads(paths[1].read_text())
        kn = json.loads(paths[3].read_text())
        sh = Image.open(paths[0])
        check(meta["backend"] == "bedrock" and meta["cache_key"] == "k" * 24 and meta["purpose"] == MB.PURPOSE
              and meta["sheet"] == "monster_small" and meta["layout"] == [3, 1],
              "approve: monster_small.json is a Bedrock record with cache_key and purpose")
        check(sh.size == (frames[0].size[0] * 3, frames[0].size[1]) and Image.open(paths[2]).size == frames[0].size,
              "approve: the sheet is 3 cells, the kneel key is the idle's cell")
        check(kn["arm"] != "g" and kn["br_cache_keys"] == ["k" * 24] and "backend" not in kn and kn["sheet"] == "kneel",
              "approve: kneel.json in the Bedrock kneel shape (arm, br_cache_keys, no backend)")
    _ef2(check)
    print(f"monster_br selftest: {'ALL PASSED' if not fails else f'{len(fails)} FAILED'}")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
