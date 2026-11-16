"""CLI and review output for monster in-betweens (docs/ENEMY_ANIM_PLAN.md 4.2, 5.2). Entry point: monster_anim.py."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from gen import monster_anim as MA
from gen import monster_check as MC

OUT = MA.HERE / "out" / "anim" / "review" / "monsters"
BG = MA.HERE.parent.parent / "assets" / "backgrounds" / "grassland.webp"
# runtime order and frame counts (src/scenes/battle/enemyChoreography.ts)
TIMELINES = {"attack": [("atk_wind1", 5), ("atk_wind2", 6), ("atk_mid", 3), ("attack", 8), ("atk_follow", 4),
                        ("atk_recover", 5), ("idle", 12)],
             "hurt": [("hurt_in1", 2), ("hurt_in2", 2), ("hurt", 10), ("hurt_in2", 3), ("hurt_in1", 3), ("idle", 12)],
             "cast": [("cast_gather", 6), ("cast_rise", 4), ("cast", 10), ("cast_release", 4), ("cast_rise", 3),
                      ("cast_gather", 3), ("idle", 12)],
             "idle": [("idle", 36), ("idle_b", 36)],
             "daze": [("idle", 24), ("daze", 48), ("daze_b", 48), ("daze", 48), ("daze_b", 48)],
             "heavy": [("atk_raise_in", 6), ("attack_raise", 4), ("atk_raise_b", 4), ("attack_raise", 4), ("atk_raise_b", 4),
                       ("attack_raise", 2), ("atk_swing", 3), ("atk_swing2", 2), ("attack", 12), ("atk_follow", 6),
                       ("atk_recover", 6), ("idle", 16)]}
SKIP = {"cast": "cast", "heavy": "attack_raise"}         # sequences that need an optional keyframe
PART_COLOURS = [(230, 25, 75), (60, 180, 75), (255, 225, 25), (0, 130, 200), (245, 130, 48), (145, 30, 180),
                (70, 240, 240), (240, 50, 230), (210, 245, 60), (250, 190, 212), (0, 128, 128), (170, 110, 40),
                (128, 0, 0), (170, 255, 195), (128, 128, 0), (0, 0, 128)]


def _zoom(im: Image.Image, k: int) -> Image.Image:
    return im.resize((im.width * k, im.height * k), Image.Resampling.NEAREST)


def _on(im: Image.Image, bg=(60, 60, 70, 255)) -> Image.Image:
    out = Image.new("RGBA", im.size, bg)
    out.alpha_composite(im)
    return out


def _strip(frames: list[tuple[str, Image.Image]], k: int = 4) -> Image.Image:
    w, h = frames[0][1].size
    out = Image.new("RGBA", (len(frames) * (w + 4) * k, (h + 4) * k), (40, 40, 48, 255))
    d = ImageDraw.Draw(out)
    for i, (n, f) in enumerate(frames):
        x = i * (w + 4) * k
        d.rectangle([x, 0, x + w * k + 3, h * k + 3], outline=(0, 200, 0) if n in MA.KEYFRAMES else (140, 140, 140), width=2)
        out.alpha_composite(_zoom(_on(f), k), (x + 2, 2))
    return out


def mark(sprite: str, k: int | None = None, out: Path = OUT) -> Path:
    """Zoomed keyframes with a 5 px grid, the rig's joints and bones, and the segmentation coloured per part."""
    from gen import rig as R
    sid, meta, kfs = next(e for e in MA.load_entries() if e[0] == sprite)
    cfg = MA.load_rig(sprite)
    k = k or (8 if kfs["idle"].width <= 84 else 4)
    rig = R.Rig(cfg, kfs["idle"].size) if cfg else None
    tiles = []
    for name, im in kfs.items():
        z = _zoom(_on(im), k)
        d = ImageDraw.Draw(z)
        if rig and name in rig.keyframes:
            lab, names = R.segment(rig, name, np.asarray(im))
            over = np.zeros((*lab.shape, 4), np.uint8)
            for i in range(len(names)):
                over[lab == i] = (*PART_COLOURS[i % len(PART_COLOURS)], 110)
            z.alpha_composite(_zoom(Image.fromarray(over, "RGBA"), k))
            j = rig.keyframes[name]
            for p in rig.parts:
                js = rig.joints_of(p, name)
                for a, b in zip(js, js[1:]):
                    if a in j and b in j:
                        d.line([(j[a][0] * k + k / 2, j[a][1] * k + k / 2), (j[b][0] * k + k / 2, j[b][1] * k + k / 2)], fill=(255, 0, 0), width=2)
            for n, (x, y) in j.items():
                d.ellipse([x * k + k / 2 - 3, y * k + k / 2 - 3, x * k + k / 2 + 3, y * k + k / 2 + 3], fill=(0, 255, 0))
                d.text((x * k + k / 2 + 4, y * k), n, fill=(255, 255, 255))
        for g in range(0, im.width + 1, 5):
            d.line([(g * k, 0), (g * k, z.height)], fill=(255, 255, 255, 60) if g % 10 else (255, 255, 0, 110), width=1)
        for g in range(0, im.height + 1, 5):
            d.line([(0, g * k), (z.width, g * k)], fill=(255, 255, 255, 60) if g % 10 else (255, 255, 0, 110), width=1)
        tiles.append(z)
    sheet = Image.new("RGBA", (sum(t.width + 8 for t in tiles), tiles[0].height), (30, 30, 36, 255))
    x = 0
    for t in tiles:
        sheet.alpha_composite(t, (x, 0))
        x += t.width + 8
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"{sprite}_mark.png"
    sheet.save(path)
    return path


def review(sprite: str, out: Path = OUT) -> dict:
    sid, meta, kfs = next(e for e in MA.load_entries() if e[0] == sprite)
    out.mkdir(parents=True, exist_ok=True)
    cfg = MA.load_rig(sprite)
    gen = MA.generate(sprite, cfg, kfs, meta) if cfg else {}
    frames = {**kfs, **{n: Image.fromarray(f["img"], "RGBA") for n, f in gen.items()}}
    get = lambda n: frames[MA.resolve(n, frames)]
    rep = MC.check_sprite(sprite, cfg, kfs, meta, gen) if cfg else {"rig": [f"no rig file anim/monsters/{sprite}.yaml (anim: false)"]}
    mark(sprite, out=out)
    L = MA.lunge_px(kfs["idle"]) // 2
    for seq, tl in TIMELINES.items():
        if SKIP.get(seq, "idle") not in kfs:
            continue
        names = list(dict.fromkeys(n for n, _ in tl)) if seq != "hurt" else [n for n, _ in tl]
        _strip([(n, get(n)) for n in names]).save(out / f"{sprite}_{seq}.png")
        if seq == "idle":
            continue
        w, h = kfs["idle"].size
        imgs, durs = [], []
        for n, frames_n in tl:
            canvas = Image.new("RGBA", (w + 2 * L, h), (60, 60, 70, 255))
            dx = {"atk_wind1": -L // 6, "atk_wind2": -L // 4, "atk_mid": int(0.75 * L), "attack": L,
                  "atk_follow": int(0.58 * L), "atk_raise_in": -L // 6, "attack_raise": -L // 4, "atk_raise_b": -L // 4,
                  "atk_swing": int(0.5 * L), "atk_swing2": int(0.75 * L)}.get(n, 0) if seq in ("attack", "heavy") \
                else (-3 if n == "hurt" else 0)
            canvas.alpha_composite(get(n), (L + dx, 0))
            imgs.append(_zoom(canvas, 4).convert("RGB"))
            durs.append(round(frames_n * 1000 / 60))
        imgs[0].save(out / f"{sprite}_{seq}.gif", save_all=True, append_images=imgs[1:], duration=durs, loop=0)
    order = [n for n in MA.SEQUENCES["attack"][:-1] + MA.SEQUENCES["hurt"][1:] + (MA.SEQUENCES["cast"][1:] if "cast" in kfs else [])
             + MA.SEQUENCES["daze"] + (MA.SEQUENCES["heavy"][1:] if "attack_raise" in kfs else [])]
    onion = []
    for a, b in zip(order, order[1:]):
        pa, pb = np.asarray(get(a)).astype(float), np.asarray(get(b))
        base = np.zeros((*pa.shape[:2], 4), np.uint8); base[...] = (40, 40, 48, 255)
        base[pa[..., 3] > 0] = (0.6 * base[pa[..., 3] > 0] + 0.4 * np.array([0, 255, 255, 255])).astype(np.uint8)
        im = Image.fromarray(base, "RGBA"); im.alpha_composite(Image.fromarray(pb, "RGBA"))
        onion.append((b, im))
    _strip(onion).save(out / f"{sprite}_onion.png")
    stage(sprite, [get(n) for n in order], meta["bottom_row"], out)
    report = {"sprite": sprite, "anim": bool(gen), "checks": rep, "ok": not any(rep.values()) if cfg else True,
              "mask_overlap": MC.mask_report(cfg, kfs)[1] if cfg else {}, "roughness": roughness(gen, kfs)}
    (out / f"{sprite}_report.json").write_text(json.dumps(report, indent=2) + "\n")
    return report


def roughness(gen: dict[str, dict], kfs: dict[str, Image.Image]) -> dict[str, float]:
    """F6 (report only): edge roughness of each generated frame minus its source keyframe's (per 100 edge px)."""
    from gen import anim_efix as E
    return {n: round(E.roughness(f["img"]) - E.roughness(np.asarray(kfs[f["src"]])), 2) for n, f in gen.items()}


def stage(sprite: str, frames: list[Image.Image], bottom: int, out: Path) -> None:
    """Each frame at game scale (2x) on a crop of the grassland stage, feet on a battle-plain line."""
    w, h = frames[0].size
    W, H, feet_y = len(frames) * (w * 2 + 8), h * 2 + 40, h * 2 + 20
    bg = Image.open(BG).convert("RGBA").crop((0, 620 - feet_y, W, 620 - feet_y + H)) if BG.exists() else \
        Image.new("RGBA", (W, H), (80, 120, 60, 255))
    d = ImageDraw.Draw(bg)
    d.line([(0, feet_y), (W, feet_y)], fill=(255, 255, 0, 255), width=1)
    for i, f in enumerate(frames):
        bg.alpha_composite(_zoom(f, 2), (i * (w * 2 + 8), feet_y - (bottom + 1) * 2))
    bg.save(out / f"{sprite}_stage.png")


def _ids(args: list[str]) -> list[str]:
    every = [e[0] for e in MA.load_entries()]
    return every if not args or "--all" in args else [a for a in args if not a.startswith("--")]


def main(argv: list[str]) -> int:
    if not argv or argv[0] not in ("check", "review", "mark", "lock"):
        print(MA.__doc__)
        return 2
    cmd, args = argv[0], argv[1:]
    entries = {e[0]: e for e in MA.load_entries()}
    bad, rough = 0, []
    if cmd == "check" and "--calibrate" in args:
        print(f"{'sprite':<12} {'pair':<12} {'IoU':>5} {'centroid':>8}")
        for sid, pair, iou, shift in MC.calibrate(entries.values()):
            print(f"{sid:<12} {pair:<12} {iou:5.2f} {shift:8.1f}")
    for sid in _ids(args):
        _, meta, kfs = entries[sid]
        cfg = MA.load_rig(sid)
        if cmd == "mark":
            print(sid, "->", mark(sid))
        elif cmd == "review":
            r = review(sid)
            bad += not r["ok"]
            print(f"{sid}: {'OK' if r['ok'] else 'CHECK'} (anim {r['anim']}) -> {OUT}")
            for k, v in r["checks"].items():
                for e in v:
                    print(f"  {sid} {k}: {e}")
            for kf, parts in r["mask_overlap"].items():
                for p, d in parts.items():
                    print(f"  mask {sid} {kf} {p}: {d['px']} px labelled as other parts {d['by']} (report only)")
            rough += [(v, sid, n) for n, v in r["roughness"].items()]
        elif not cfg:      # roster pass R: approved but not rigged yet; `check` prints the stable line `<id>: no rig`
            print(f"{sid}: no rig" if cmd == "check" else f"{sid}: no rig (anim: false), nothing to {cmd}")
        elif cmd == "lock":
            print(sid, "locked", len(MC.write_lock(sid, MA.generate(sid, cfg, kfs, meta), kfs, meta)), "frames")
        else:
            rep = MC.check_sprite(sid, cfg, kfs, meta)
            fails = [f"{sid} {k}: {e}" for k, v in rep.items() for e in v]
            bad += bool(fails)
            al = MA.aliased(sid, cfg)[0]                  # FW-Q: a partial rig names its aliased sequence
            print("\n".join(fails) if fails else f"{sid}: OK (aliased: {al[0]}; {len(rep)} checks groups)" if al
                  else f"{sid}: OK ({len(rep)} checks groups)")
    if rough:
        print("edge roughness, frame minus source per 100 edge px (F6, report only), top 10:")
        for v, sid, n in sorted(rough, key=lambda t: (-t[0], t[1], t[2]))[:10]:
            print(f"  {sid} {n}: {v:+.2f}")
    return 1 if bad else 0
