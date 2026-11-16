"""colossus.py's offline review commands (docs/CHAOS_FORMS_PLAN.md 5.4, 5.3a; 0 images): glow, bake, review (split
sheet, limb strip and GIF), check (cover, alpha, palette, lock), lock, and mock (the form on the rim backdrop with the
party, like /tmp/stab2/scripts/stage_mock.py). Outputs in gen/out/colossus/review/<form>_*.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import yaml
from PIL import Image, ImageDraw

from gen import colossus_build as CB
from gen import colossus_layers as CL

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
REVIEW = HERE / "out" / "colossus" / "review"
GREY = (96, 96, 104, 255)
PARTY_X, PARTY_FEET = (1380, 1425, 1470, 1515), (425, 530, 635, 740)    # BattleDisplayManager.ts:22-23
PARTY = ("warrior", "thief", "white_mage", "black_mage")


def _spec(form: str) -> dict:
    path = CB.SPECS / f"{form}.yaml"
    if not path.exists():
        raise SystemExit(f"{path} is missing: the rigger writes the layer yaml after approval (5.4)")
    return yaml.safe_load(path.read_text())


def _master(form: str) -> Image.Image:
    path = CB.APPROVED / form / "master.png"
    if not path.exists():
        raise SystemExit(f"{path} is missing: approve a master first (colossus.py approve)")
    return Image.open(path).convert("RGBA")


def _on_grey(img: Image.Image, zoom: int = 1) -> Image.Image:
    bg = Image.new("RGBA", img.size, GREY)
    bg.alpha_composite(img)
    return bg.resize((img.width * zoom, img.height * zoom), Image.Resampling.NEAREST)


def _save(img: Image.Image, form: str, what: str) -> Path:
    REVIEW.mkdir(parents=True, exist_ok=True)
    path = REVIEW / f"{form}_{what}.png"
    img.convert("RGB").save(path)
    print(f"wrote {path} {img.size}")
    return path


def cmd_glow(a) -> int:
    layers = CL.split(_master(a.form), _spec(a.form))
    glow = next((layers[L["name"]] for L in _spec(a.form)["layers"] if L["kind"] == "glow"), None)
    if glow is None:
        raise SystemExit(f"{a.form}: the layer yaml has no glow layer")
    _save(_on_grey(glow, 2), a.form, "glow")
    return 0


def _limb_frames(form: str) -> list[tuple[str, Image.Image]]:
    spec, layers = _spec(form), CL.split(_master(form), _spec(form))
    return [(f"{L['name']}/{f}", CL.bake(layers[L["name"]], L["pivot"], deg)) for L in spec["layers"]
            if L["kind"] == "limb" for f, deg in [("rest", 0), *(L.get("frames") or {}).items()]]


def cmd_bake(a) -> int:
    frames = _limb_frames(a.form)
    if not frames:
        raise SystemExit(f"{a.form}: the layer yaml has no limb layer")
    w, h = frames[0][1].size
    strip = Image.new("RGBA", (w * len(frames), h + 14), GREY)
    d = ImageDraw.Draw(strip)
    for i, (name, f) in enumerate(frames):
        strip.alpha_composite(f, (i * w, 14))
        d.text((i * w + 2, 1), name, fill=(255, 255, 255, 255))
    _save(strip, a.form, "limbs")
    return 0


def cmd_review(a) -> int:
    spec, master = _spec(a.form), _master(a.form)
    layers = CL.split(master, spec)
    w, h = master.size
    sheet = Image.new("RGBA", (w * (len(layers) + 1), h + 14), GREY)
    d = ImageDraw.Draw(sheet)
    for i, (name, img) in enumerate([("master", master), *layers.items()]):
        sheet.alpha_composite(img, (i * w, 14))
        d.text((i * w + 2, 1), name, fill=(255, 255, 255, 255))
    _save(sheet, a.form, "split")
    frames = _limb_frames(a.form)
    if frames:
        cmd_bake(a)
        body = Image.new("RGBA", master.size, GREY)
        for name, img in layers.items():
            if not any(L["name"] == name and L["kind"] == "limb" for L in spec["layers"]):
                body.alpha_composite(img)
        gif = [Image.alpha_composite(body, f).convert("P", palette=Image.Palette.ADAPTIVE) for _, f in frames]
        path = REVIEW / f"{a.form}_limbs.gif"
        gif[0].save(path, save_all=True, append_images=gif[1:], duration=400, loop=0)
        print(f"wrote {path}")
    return 0


def problems(form: str) -> list[str]:
    spec, master = _spec(form), _master(form)
    probs = CL.cover_problems(master, spec) + CL.palette_problems(master)
    if not probs:
        for name, img in CL.split(master, spec).items():
            kind = next(L["kind"] for L in spec["layers"] if L["name"] == name)
            probs += CL.alpha_problems(name, kind, img)
    return probs + CB.lock_problems(CB.APPROVED, CB.SPECS, form)


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


def cmd_mock(a) -> int:
    from gen import colossus as C
    f = C._form(a.form)
    spec_p = CB.SPECS / f"{a.form}.yaml"
    spec = yaml.safe_load(spec_p.read_text()) if spec_p.exists() else {}
    img = Image.open(a.image).convert("RGBA") if a.image else _master(a.form)
    scale, place = int(spec.get("scale", 3)), tuple(spec.get("place", f["place"]))
    bg_p = Path(a.bg) if a.bg else ROOT / "assets" / "backgrounds" / "rim.webp"
    frame = Image.open(bg_p).convert("RGBA") if bg_p.exists() else Image.new("RGBA", (1920, 1080), (8, 8, 16, 255))
    big = img.resize((img.width * scale, img.height * scale), Image.Resampling.NEAREST)
    layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    layer.paste(big, place)                                   # paste clips negative offsets (the over-scan)
    frame.alpha_composite(layer)
    fl_p = Path(a.floor) if a.floor else ROOT / "assets" / "backgrounds" / "rim_floor.webp"
    if fl_p.exists():
        fl = Image.open(fl_p).convert("RGBA")
        frame.alpha_composite(fl, (0, 0), ((fl.width - 1920) // 2, 0))
    _party(frame)
    d = ImageDraw.Draw(frame)
    d.rectangle((0, 780, 1919, 1079), outline=(0, 255, 255, 255))
    vis = np.asarray(big)[..., 3] > 0
    print(f"{a.form}: canvas {big.size} screen px at {place}, scale {scale}; opaque art px {int(vis.sum() // scale ** 2)}")
    _save(frame, a.form, "mock")
    return 0
