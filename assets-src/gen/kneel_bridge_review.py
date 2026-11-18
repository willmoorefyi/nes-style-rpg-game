"""Pass KT review artefacts for the AI kneel bridge (docs/KNEEL_TWEEN_PLAN.md 7; offline, no AI call).

  python3 -I assets-src/gen/kneel_bridge_review.py --out DIR <id ...>     # monsters (rig ids) and hero classes

Per id, from the real pipeline frames (monster_anim.monster_frames / puppet_kneel.kneel_frames, so exactly what the
atlas gets): `<id>_x2.gif` and `<id>_x3.gif` (idle -> kneel_in1 4 -> kneel_in2 4 -> hold kneel / kneel_b 48 each x2 ->
kneel_in2 3 -> kneel_in1 3 -> idle, at 60 fps game timing, on the grassland stage), `<id>_slow.gif` (the same at 1/8
speed), `<id>_strip.png` (idle, kneel_in1, kneel_in2, kneel, kneel_b, then hurt / down for comparison, at x4 with the
feet row), and for all ids `contact.gif` / `contact.png` (every id side by side at x2, in sync).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
if __name__ == "__main__":
    sys.path.insert(0, str(HERE.parent))

TRACK = [("idle", 24), ("kneel_in1", 4), ("kneel_in2", 4), ("kneel", 48), ("kneel_b", 48), ("kneel", 48),
         ("kneel_b", 48), ("kneel_in2", 3), ("kneel_in1", 3), ("idle", 24)]
STAGE = ROOT / "assets" / "backgrounds" / "grassland.webp"


def frames_of(sid: str) -> tuple[dict[str, Image.Image], int]:
    """({idle, kneel_in1, kneel_in2, kneel, kneel_b, cmp}, feet row) from the pipeline (cmp: hurt / down)."""
    from gen import kneel as KN
    from gen import kneel_ai_data as D
    from gen import monster_anim as MA
    if (D.RIGS / f"{sid}.yaml").exists():
        cfg = MA.load_rig(sid)
        meta, kfs = D._monster_entry(sid)
        meta, kfs = KN.add_key(sid, cfg, meta, kfs)
        gen = MA.monster_frames(sid, kfs, meta)
        out = {"idle": kfs["idle"], "kneel": kfs.get("kneel", kfs["idle"]), "cmp": kfs.get("hurt", kfs["idle"])}
        out.update({n: gen[n] for n in ("kneel_in1", "kneel_in2", "kneel_b") if n in gen})
        return out, int(meta["bottom_row"])
    from gen import puppet as PU
    from gen import puppet_kneel as PK
    fr = PU.battle_sheet_frames(sid)
    out = {"idle": fr["ready"], "cmp": fr["down"], **PK.kneel_frames(sid)}
    return out, PK.bottom_row(sid)


def display_scale(sid: str) -> int:
    import json
    j = ROOT / "assets" / "sprites" / "monsters-ai.json"
    s = json.loads(j.read_text())["sheets"].get(sid, {}) if j.exists() else {}
    return int(s.get("scale", 2))


def _stage(w: int, h: int) -> Image.Image:
    bg = Image.open(STAGE).convert("RGBA")
    return bg.crop((760, 760 - h, 760 + w, 760)) if bg.width >= 760 + w and h <= 760 else \
        Image.new("RGBA", (w, h), (70, 110, 60, 255))


def _place(stage: Image.Image, im: Image.Image, sc: int, x: int, feet: int) -> None:
    big = im.convert("RGBA").resize((im.width * sc, im.height * sc), Image.Resampling.NEAREST)
    stage.alpha_composite(big, (x, stage.height - 8 - (feet + 1) * sc))


def gif(frames: dict, feet: int, sc: int, path: Path, slow: int = 1) -> None:
    w, h = frames["idle"].width * sc + 32, frames["idle"].height * sc + 16
    base = _stage(w, h)
    ims, durs = [], []
    for name, n in TRACK:
        st = base.copy()
        _place(st, frames.get(name, frames["idle"]), sc, 16, feet)
        ImageDraw.Draw(st).text((4, 4), name, fill=(255, 255, 255, 255))
        ims.append(st.convert("RGB"))
        durs.append(max(20, int(round(n * 1000 / 60 / 10)) * 10) * slow)
    ims[0].save(path, save_all=True, append_images=ims[1:], duration=durs, loop=0, disposal=1)


def strip(frames: dict, feet: int, path: Path, sc: int = 4) -> None:
    names = ["idle", "kneel_in1", "kneel_in2", "kneel", "kneel_b", "cmp"]
    w, h = frames["idle"].size
    out = Image.new("RGBA", ((w * sc + 8) * len(names), h * sc + 20), (60, 90, 60, 255))
    d = ImageDraw.Draw(out)
    for i, n in enumerate(names):
        x = i * (w * sc + 8)
        out.alpha_composite(frames.get(n, frames["idle"]).convert("RGBA").resize((w * sc, h * sc),
                                                                                  Image.Resampling.NEAREST), (x, 16))
        d.line([(x, 16 + (feet + 1) * sc), (x + w * sc, 16 + (feet + 1) * sc)], fill=(255, 220, 0, 255))
        d.text((x + 2, 2), n if n != "cmp" else "hurt/down", fill=(255, 255, 255, 255))
    out.save(path)


def contact(all_frames: dict, out: Path, sc: int = 2) -> None:
    ws = [f["idle"].width * sc + 16 for f, _ in all_frames.values()]
    h = max(f["idle"].height for f, _ in all_frames.values()) * sc + 24
    base = _stage(sum(ws) + 16, h)
    ims, durs = [], []
    for name, n in TRACK:
        st = base.copy()
        x = 8
        for (fr, feet), w in zip(all_frames.values(), ws):
            _place(st, fr.get(name, fr["idle"]), sc, x, feet)
            x += w
        ImageDraw.Draw(st).text((4, 4), name, fill=(255, 255, 255, 255))
        ims.append(st.convert("RGB"))
        durs.append(max(20, int(round(n * 1000 / 60 / 10)) * 10))
    ims[0].save(out / "contact.gif", save_all=True, append_images=ims[1:], duration=durs, loop=0, disposal=1)
    ims[3].save(out / "contact.png")


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("ids", nargs="+")
    a = ap.parse_args(argv)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    every = {}
    for sid in a.ids:
        fr, feet = frames_of(sid)
        missing = [n for n in ("kneel_in1", "kneel_in2", "kneel", "kneel_b") if n not in fr]
        if missing:
            print(f"{sid}: no {missing} (no kneel block?)")
            continue
        every[sid] = (fr, feet)
        for sc in (2, 3):
            gif(fr, feet, sc, out / f"{sid}_x{sc}.gif")
        gif(fr, feet, display_scale(sid), out / f"{sid}_slow.gif", slow=8)
        strip(fr, feet, out / f"{sid}_strip.png")
        h = {n: int(np.ptp(np.nonzero((np.asarray(fr[n].convert("RGBA"))[..., 3] > 0).any(1))[0]) + 1)
             for n in ("idle", "kneel_in1", "kneel_in2", "kneel")}
        print(f"{sid}: heights {h} -> {out}")
    if every:
        contact(every, out)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
