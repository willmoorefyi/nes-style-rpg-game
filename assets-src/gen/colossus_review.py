"""colossus.py's offline review commands for the painted forms (docs/CHAOS_FORMS_PLAN.md 18.2 step 5, 18.7; 0 images):

  python3 -I assets-src/gen/colossus.py mock <form> [--body B] [--glow G] [--raw ORIGINAL] [--sky SKY_BASE] [--bg F]
                                         [--place X,Y] [--sky-dim D]
  python3 -I assets-src/gen/colossus.py review|check|lock <form>

mock: the form at rest at scale 1 (body normal, glow additive, the 18.4 place) on the rim backdrop with the sky dim and
the party (<form>_mock.png), plus the side-by-side sheet (<form>_side.png): the original raw, the in-game composite over
a sky_base plate (scaled to the raw's size) and on rim, and a 1:1 detail crop (disc, ring, a shoulder). Defaults: the
approved master.png / glow.png and the form's FORMS place / sky_dim. review: every exported layer frame of the built
form on grey (<form>_layers.png). check: the layer yaml and build problems plus the lock. lock: the lock file (commit
right after it). Outputs in gen/out/colossus/review/.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from gen import colossus_build as CB
from gen import colossus_paint as P
from gen.colossus_spec import draw_order

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
REVIEW = HERE / "out" / "colossus" / "review"
GREY = (96, 96, 104)
PARTY_X, PARTY_FEET = (1380, 1425, 1470, 1515), (425, 530, 635, 740)    # BattleDisplayManager.ts:22-23
PARTY = ("warrior", "thief", "white_mage", "black_mage")
STRIP_Y = 780


def _save(img: Image.Image, form: str, what: str) -> Path:
    REVIEW.mkdir(parents=True, exist_ok=True)
    path = REVIEW / f"{form}_{what}.png"
    img.convert("RGB").save(path)
    print(f"wrote {path} {img.size}")
    return path


def _party(frame: Image.Image) -> None:
    meta_p = ROOT / "assets" / "sprites" / "battle-characters-ai.json"
    if not meta_p.exists():
        return
    meta = json.loads(meta_p.read_text())
    atlas = Image.open(meta_p.with_suffix(".png")).convert("RGBA")
    cw, ch, s = meta["cell"][0] * meta["scale"], meta["cell"][1] * meta["scale"], meta["scale"]
    for i, cid in enumerate(PARTY):
        r = meta["sheets"].get(cid, {}).get("row")
        if r is not None:
            frame.alpha_composite(atlas.crop((0, r * ch, cw, r * ch + ch)), (PARTY_X[i], PARTY_FEET[i] - meta["footRow"] * s))


def _rgb(img: np.ndarray) -> Image.Image:
    return Image.fromarray(np.clip(np.round(img), 0, 255).astype(np.uint8), "RGB")


def compose(bg: np.ndarray, body: Image.Image, glow: Image.Image | None, at: tuple[int, int]) -> np.ndarray:
    out = P.place_layer(bg, body, at, "normal")
    return P.place_layer(out, glow, at, "add") if glow is not None else out


def cmd_mock(a) -> int:
    from gen import colossus as C
    f = C._form(a.form)
    app = CB.APPROVED / a.form
    body = Image.open(a.body or app / "master.png").convert("RGBA")
    gp = Path(a.glow) if a.glow else app / "glow.png"
    glow = Image.open(gp).convert("RGBA") if gp.exists() else None
    place = tuple(int(v) for v in a.place.split(",")) if a.place else tuple(f["place"])
    dim = f.get("sky_dim", 1.0) if a.sky_dim is None else a.sky_dim
    bg_p = Path(a.bg) if a.bg else ROOT / "assets" / "backgrounds" / "rim.webp"
    bg = Image.open(bg_p).convert("RGB").resize((1920, 1080), Image.Resampling.LANCZOS) if bg_p.exists() else \
        Image.new("RGB", (1920, 1080), (8, 8, 16))
    shot = _rgb(compose(np.asarray(bg).astype(float) * dim, body, glow, place)).convert("RGBA")
    _party(shot)
    ImageDraw.Draw(shot).rectangle((0, STRIP_Y, 1919, 1079), outline=(0, 255, 255, 255))
    _save(shot, a.form, "mock")
    if a.raw:
        raw = Image.open(a.raw).convert("RGB")
        plate = Image.open(a.sky).convert("RGB").resize(body.size) if a.sky else Image.new("RGB", body.size, GREY)
        comp = _rgb(compose(np.asarray(plate).astype(float), body, glow, (0, 0))).resize(raw.size, Image.Resampling.LANCZOS)
        cx, cy = (f.get("corona") or (body.width / 2, body.height / 2))[:2]
        detail = _rgb(compose(np.asarray(plate).astype(float), body, glow, (0, 0))).crop(
            (int(cx) - 450, int(cy) - 300, int(cx) + 450, int(cy) + 300))
        w = raw.width
        rows = [("original raw", raw), ("in game over sky_base", comp),
                ("in game on rim (rest, dim)", shot.convert("RGB").resize((w, round(w * 1080 / 1920)))),
                ("1:1 detail (disc, ring)", detail)]
        sheet = Image.new("RGB", (max(w, detail.width), sum(im.height + 18 for _, im in rows)), (24, 24, 28))
        d, y = ImageDraw.Draw(sheet), 0
        for label, im in rows:
            d.text((4, y + 3), label, fill=(255, 255, 255))
            sheet.paste(im, (0, y + 18))
            y += im.height + 18
        _save(sheet, a.form, "side")
    vis = np.asarray(body)[..., 3] > 0
    print(f"{a.form}: canvas {body.size} at {place}, scale 1, sky dim {dim}; opaque px {int(vis.sum())}")
    return 0


def problems(form: str) -> list[str]:
    try:
        CB.export_form(form, CB.APPROVED, CB.SPECS)
    except (ValueError, FileNotFoundError) as e:
        return [str(e)]
    return CB.lock_problems(CB.APPROVED, CB.SPECS, form)


def _layer_canvas(fr: dict, imgs: dict, canvas) -> Image.Image:
    """One exported frame back on a canvas-sized RGBA, as the game draws it: tiles at their texture px, scaled by
    texScale with linear filtering, at the frame's `at`."""
    ts = fr.get("texScale", 1)
    tex = Image.new("RGBA", (-(-fr["size"][0] // ts), -(-fr["size"][1] // ts)))
    for t in fr["tiles"]:
        tex.paste(imgs[t["file"]], (t["x"], t["y"]))
    if ts != 1:
        tex = tex.resize(tuple(fr["size"]), Image.Resampling.BILINEAR)
    out = Image.new("RGBA", tuple(canvas))
    out.paste(tex, tuple(fr["at"]))
    return out


def rest_view(entry: dict, imgs: dict, spec: dict, dy: float = 0, glow: float = 1.0, frames: dict | None = None,
              party: bool = True) -> Image.Image:
    """The form on rim with its sky dim from the exported textures (each layer's base or `frames` / the yaml's
    `variant` frame, its blend and rest alpha x `glow` for the light layers), shifted dy (whole px), with the party
    and the strip line."""
    bg_p = ROOT / "assets" / "backgrounds" / "rim.webp"
    bg = np.asarray(Image.open(bg_p).convert("RGB").resize((1920, 1080), Image.Resampling.LANCZOS)).astype(float)
    out = bg * float(entry.get("skyDim", 1.0))
    pick = {**(spec.get("variant") or {}), **(frames or {})}
    for L in (entry["layers"][i] for i in draw_order(spec)):      # far orbs under the body (EF-E)
        fr = L["frames"].get(pick.get(L["name"], "base"))
        if not fr or not fr["tiles"]:
            continue
        al = L.get("alpha", 1.0) * (glow if L["kind"] in ("glow", "corona") else 1.0)
        out = P.place_layer(out, _layer_canvas(fr, imgs, entry["canvas"]),
                            (entry["place"][0], entry["place"][1] + round(dy)), L.get("blend", "normal"), al)
    shot = _rgb(out).convert("RGBA")
    if party:
        _party(shot)
    ImageDraw.Draw(shot).line((0, STRIP_Y, 1919, STRIP_Y), fill=(0, 255, 255, 255), width=2)
    ImageDraw.Draw(shot).line((0, 120, 1919, 120), fill=(0, 255, 255, 255), width=2)
    return shot


def cmd_review(a) -> int:
    entry, imgs, spec = CB.export_form(a.form, CB.APPROVED, CB.SPECS)
    _save(rest_view(entry, imgs, spec), a.form, "rest")
    crop = (0, 100, 1920, 800)                  # breathing (0 / -4 px) and the glow pulse floor (0.85), side by side
    tiles = [("rest", rest_view(entry, imgs, spec, party=False)), ("breath -4 px", rest_view(entry, imgs, spec, -4, party=False)),
             ("glow pulse 0.85", rest_view(entry, imgs, spec, 0, 0.85, party=False))]
    tiles += [(f"core {f}", rest_view(entry, imgs, spec, frames={"core": f}, party=False))
              for L in entry["layers"] if L["kind"] == "core" for f in L["frames"] if f != "base"]
    w, h = 960, 350
    strip = Image.new("RGB", (w, len(tiles) * (h + 18)), (24, 24, 28))
    d = ImageDraw.Draw(strip)
    for i, (label, im) in enumerate(tiles):
        d.text((4, i * (h + 18) + 3), label, fill=(255, 255, 255))
        strip.paste(im.crop(crop).convert("RGB").resize((w, h), Image.Resampling.LANCZOS), (0, i * (h + 18) + 18))
    _save(strip, a.form, "motion")
    thumbs = [(rel.split("/")[-1], im) for rel, im in sorted(imgs.items())]
    th = [im.copy() for _, im in thumbs]
    for im in th:
        im.thumbnail((480, 300))
    sheet = Image.new("RGB", (sum(im.width + 8 for im in th) or 8, max([im.height for im in th] or [0]) + 18), GREY)
    d, x = ImageDraw.Draw(sheet), 0
    for (name, _), im in zip(thumbs, th):
        plate = Image.new("RGBA", im.size, GREY + (255,))
        plate.alpha_composite(im)
        sheet.paste(plate.convert("RGB"), (x, 18))
        d.text((x + 2, 3), name, fill=(255, 255, 255))
        x += im.width + 8
    _save(sheet, a.form, "layers")
    print(f"{a.form}: {len(entry['layers'])} layers, {len(imgs)} textures")
    return 0


def cmd_check(a) -> int:
    probs = problems(a.form)
    print(f"{a.form}: OK" if not probs else "\n".join(f"{a.form}: {p}" for p in probs))
    return 1 if probs else 0


def cmd_lock(a) -> int:
    probs = [p for p in problems(a.form) if "lock" not in p and "hash differs" not in p]
    if probs:
        raise SystemExit(f"refused: {a.form} has check problems, fix them before lock: {probs[:3]}")
    print(f"wrote {CB.lock(CB.APPROVED, CB.SPECS, a.form)} (commit it right after the lock)")
    return 0


def add_parsers(sub) -> None:
    m = sub.add_parser("mock", help="offline: the painted form on rim with the party, plus the side-by-side sheet")
    m.add_argument("form"); m.add_argument("--body"); m.add_argument("--glow"); m.add_argument("--raw")
    m.add_argument("--sky"); m.add_argument("--bg"); m.add_argument("--place", help="X,Y screen px (default FORMS)")
    m.add_argument("--sky-dim", type=float)
    for name in ("review", "check", "lock"):
        sub.add_parser(name).add_argument("form")
