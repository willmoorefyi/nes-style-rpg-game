"""Kneel review artefacts (docs/KNEEL_PLAN.md 8), written to gen/out/anim/review/kneel/ (untracked):

  python3 -I assets-src/gen/kneel_review.py goblin wolf warrior white_mage

- prints `<id>: OK` or `<id>: FAIL <check> ...` (monsters: monster_check + K-checks with the lock; heroes per variant,
  `warrior[A]`, through puppet_kneel.py when it is importable, else a `skipped` note);
- <tag>_sheet.png (tag `pilot` unless `--tag NAME` comes first): a row per sprite / hero variant (idle or ready,
  kneel_in1, kneel_in2, kneel, kneel_b, then hurt or
  down) at 4x, the ground line, and the kneel / idle height with the band;
- <id>[_A|_B]_kneel.gif: in 8f, 2 sway cycles, out 6f, stand 24f (60 fps);
- goblin_rise.gif: kneel, the 6-frame rise into the in-place attack table (D-K3: motion held for t < 6, then remapped
  into [6, 14)), kneel_in 8f, hold;
- <tag>_stage.png: every sprite kneeling at game scale on grassland.webp (enemy slots left, heroes right).
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
if str(HERE.parent) not in sys.path:
    sys.path.insert(0, str(HERE.parent))
from gen import kneel_checks as KC  # noqa: E402

OUT = HERE / "out" / "anim" / "review" / "kneel"
BG = HERE.parent.parent / "assets" / "backgrounds" / "grassland.webp"
COLS = ("idle", "kneel_in1", "kneel_in2", "kneel", "kneel_b")
# section 3 (kneelChoreography.ts): in 4 + 4, hold period 48, out 3 + 3
KNEEL_IN = (("kneel_in1", 4), ("kneel_in2", 4))
KNEEL_OUT = (("kneel_in2", 3), ("kneel_in1", 3))
KNEEL_PERIOD, KNEEL_OUT_FRAMES, KNEEL_IN_FRAMES = 48, 6, 8
# enemyChoreography.ts ATTACK (in place): (frame, len, from, to, ease), dx in fractions of the lunge
ATTACK = (("atk_wind1", 5, 0, -1 / 6, "out"), ("atk_wind2", 6, -1 / 6, -1 / 4, ""), ("atk_mid", 3, -1 / 4, 0.75, "in"),
          ("attack", 2, 0.75, 1, ""), ("attack", 6, 1, 1, ""), ("atk_follow", 4, 1, 0.58, ""),
          ("atk_recover", 5, 0.58, 0, ""))
ATTACK_E = 14                    # D-K3: the in-place table's motion window [0, E), contact at 14


def monster(sid: str) -> tuple[dict[str, Image.Image], dict, list[str]]:
    """(frames, meta, failures) of a monster pilot."""
    from gen import monster_anim as MA
    from gen import monster_check as MC
    _, meta, kfs = next(e for e in MA.load_entries() if e[0] == sid)
    cfg = MA.load_rig(sid)
    gen = MA.generate(sid, cfg, kfs, meta)
    rep = MC.check_sprite(sid, cfg, kfs, meta, gen)
    frames = {**kfs, **{n: Image.fromarray(f["img"]) for n, f in gen.items()}}
    return {n: frames[MA.resolve(n, frames)] for n in (*COLS, "hurt", "attack", *[s for s, *_ in ATTACK])}, meta, \
        [f"{k}: {e}" for k, v in rep.items() for e in v]


def heroes(cid: str) -> list[tuple[str, dict[str, Image.Image], list[str]]] | str:
    """[(label, frames, failures)] per variant from puppet_kneel.py, or a note why there are none."""
    try:
        from gen import puppet_kneel as PK
    except ImportError as e:
        return f"skipped (puppet_kneel.py not importable: {e})"
    out = []
    for v in getattr(PK, "VARIANTS", ("A", "B")):
        try:
            fr = PK.kneel_frames(cid, variant=v)
        except TypeError:
            fr = PK.kneel_frames(cid)
        fails = list(PK.check_class(cid, variant=v)) if hasattr(PK, "check_class") else []
        out.append((f"{cid}[{v}]", {("idle" if k == "ready" else k): im for k, im in fr.items()}, fails))
    return out


def _on(im: Image.Image, k: int, bg=(60, 60, 70, 255)) -> Image.Image:
    c = Image.new("RGBA", im.size, bg)
    c.alpha_composite(im.convert("RGBA"))
    return c.resize((im.width * k, im.height * k), Image.Resampling.NEAREST)


def _height(im: Image.Image) -> int:
    rows = np.nonzero((np.asarray(im.convert("RGBA"))[..., 3] > 0).any(1))[0]
    return int(rows.max() - rows.min() + 1) if len(rows) else 0


def sheet(rows: list[tuple[str, dict, int, tuple]], path: Path, k: int = 4) -> None:
    w = max(fr["idle"].width for _, fr, _, _ in rows)
    h = max(fr["idle"].height for _, fr, _, _ in rows)
    cw, ch = w * k + 8, h * k + 22
    out = Image.new("RGBA", (cw * (len(COLS) + 1) + 220, ch * len(rows)), (34, 34, 40, 255))
    d = ImageDraw.Draw(out)
    for r, (label, fr, feet, band) in enumerate(rows):
        y = r * ch
        last = "hurt" if "hurt" in fr else "down"
        for c, n in enumerate((*COLS, last)):
            if n in fr:
                out.alpha_composite(_on(fr[n], k), (c * cw, y + 18))
                d.text((c * cw + 2, y + 4), n, fill=(220, 220, 220))
        gy = y + 18 + (feet + 1) * k
        d.line([(0, gy), (cw * (len(COLS) + 1), gy)], fill=(255, 220, 0), width=1)
        hi, hk = _height(fr["idle"]), _height(fr["kneel"])
        d.text((cw * (len(COLS) + 1) + 6, y + 30), f"{label}\nidle {hi} px\nkneel {hk} px\nratio {hk / max(hi, 1):.3f}\n"
               f"band {band[0]:.2f}-{band[1]:.2f}", fill=(255, 255, 255))
    out.save(path)


def gif(seq: list[tuple[Image.Image, int, int]], path: Path, pad: int, k: int = 4) -> None:
    """seq of (frame, dx, frames at 60 fps); consecutive equal (frame, dx) are merged."""
    merged: list[list] = []
    for im, dx, n in seq:
        if merged and merged[-1][0] is im and merged[-1][1] == dx:
            merged[-1][2] += n
        else:
            merged.append([im, dx, n])
    imgs = []
    for im, dx, _ in merged:
        c = Image.new("RGBA", (im.width + 2 * pad, im.height), (60, 60, 70, 255))
        c.alpha_composite(im.convert("RGBA"), (pad + dx, 0))
        imgs.append(c.resize((c.width * k, c.height * k), Image.Resampling.NEAREST).convert("RGB"))
    imgs[0].save(path, save_all=True, append_images=imgs[1:], duration=[round(n * 1000 / 60) for *_, n in merged], loop=0)


def kneel_seq(fr: dict) -> list:
    sway = [(fr["kneel"], 0, KNEEL_PERIOD), (fr["kneel_b"], 0, KNEEL_PERIOD)] * 2
    return [(fr[n], 0, t) for n, t in KNEEL_IN] + sway + [(fr[n], 0, t) for n, t in KNEEL_OUT] + [(fr["idle"], 0, 24)]


def attack_at(t: float, L: int) -> tuple[str, int]:
    for name, n, a, b, ease in ATTACK:
        if t < n:
            p = t / n
            p = 1 - (1 - p) ** 2 if ease == "out" else p * p if ease == "in" else p
            return name, int(round((a + (b - a) * p) * L))
        t -= n
    return "idle", 0


def rise_seq(fr: dict, L: int) -> list:
    """D-K3 on the in-place table: kneel_in2 / kneel_in1 for t < 6 with dx held at frame 0's, then the table, its dx
    sampled at t' = (t - 6) x E / (E - 6) inside [6, E); then kneel_in (8f) and the hold."""
    seq = [(fr["kneel"], 0, 24)]
    total = sum(n for _, n, *_ in ATTACK)
    for t in range(total):
        name, _ = attack_at(t, L)
        dx = attack_at(0, L)[1] if t < KNEEL_OUT_FRAMES else \
            attack_at((t - 6) * ATTACK_E / (ATTACK_E - 6), L)[1] if t < ATTACK_E else attack_at(t, L)[1]
        if t < KNEEL_OUT_FRAMES:
            name = "kneel_in2" if t < 3 else "kneel_in1"
        seq.append((fr[name], dx, 1))
    return seq + [(fr[n], 0, t) for n, t in KNEEL_IN] + [(fr["kneel"], 0, KNEEL_PERIOD), (fr["kneel_b"], 0, 24)]


def stage(mons: list[tuple[str, dict, int]], heros: list[tuple[str, dict]], path: Path) -> None:
    bg = Image.open(BG).convert("RGBA") if BG.exists() else Image.new("RGBA", (1920, 1080), (80, 120, 60, 255))
    feet_y = 620
    x = 260
    for _, fr, feet in mons:
        im = fr["kneel"].resize((fr["kneel"].width * 2, fr["kneel"].height * 2), Image.Resampling.NEAREST)
        bg.alpha_composite(im, (x, feet_y - (feet + 1) * 2))
        x += im.width + 40
    x = 1300
    for _, fr in heros:
        im = fr["kneel"].resize((fr["kneel"].width * 2, fr["kneel"].height * 2), Image.Resampling.NEAREST)
        bg.alpha_composite(im, (x, feet_y - 154))
        x += 150
    bg.convert("RGB").save(path)


def main(ids: list[str], tag: str = "pilot") -> int:
    from gen import monster_anim as MA
    from gen import kneel as KN
    from gen import rig as R
    OUT.mkdir(parents=True, exist_ok=True)
    rigs = {p.stem for p in MA.RIGS.glob("*.yaml")}
    rows, mons, heros, bad = [], [], [], 0
    for sid in ids:
        if sid in rigs:
            fr, meta, fails = monster(sid)
            cfg = MA.load_rig(sid)
            band = KN.template_of(R.Rig(cfg, fr["idle"].size), cfg)["band"] if KN.opted(cfg) else (0, 0)
            rows.append((sid, fr, int(meta["bottom_row"]), band))
            mons.append((sid, fr, int(meta["bottom_row"])))
            gif(kneel_seq(fr), OUT / f"{sid}_kneel.gif", 4)
            if sid == "goblin":
                L = MA.lunge_px(fr["idle"])
                gif(rise_seq(fr, L), OUT / "goblin_rise.gif", L + 4)
            print(f"{sid}: OK" if not fails else f"{sid}: FAIL " + "; ".join(fails[:6]))
            print(f"  kneel / idle height {KC.ratio(np.asarray(fr['kneel']), np.asarray(fr['idle'])):.3f}, "
                  f"band {band[0]:.2f}-{band[1]:.2f}")
            bad += bool(fails)
            continue
        hs = heroes(sid)
        if isinstance(hs, str):
            print(f"{sid}: {hs}")
            continue
        for label, fr, fails in hs:
            v = label[label.index("[") + 1:-1]
            rows.append((label, fr, 76, (0, 0)))
            heros.append((label, fr))
            gif(kneel_seq(fr), OUT / f"{sid}_{v}_kneel.gif", 4)
            print(f"{label}: OK" if not fails else f"{label}: FAIL " + "; ".join(fails[:6]))
            bad += bool(fails)
    if rows:
        sheet(rows, OUT / f"{tag}_sheet.png")
        stage(mons, heros, OUT / f"{tag}_stage.png")
    print(f"-> {OUT}")
    return 1 if bad else 0


if __name__ == "__main__":
    a = sys.argv[1:]
    tag = a[1] if a[:1] == ["--tag"] and len(a) > 1 else "pilot"
    a = a[2:] if a[:1] == ["--tag"] else a
    sys.exit(main(a, tag) if a else (print(__doc__) or 2))
