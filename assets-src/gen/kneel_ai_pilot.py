"""KA-G1 pilot review (docs/KNEEL_AI_PLAN.md rev 7 section 3; untracked, gen/out/kneel_ai/review/):

  python3 -I assets-src/gen/kneel_ai.py review --pilot [ids] --old-root DIR [--old-root-for id=DIR ...]

- `pilot_g_sheet.png`: one row per sprite at native x4, columns idle / ready, the old derived kneel (rendered from
  the checkout at --old-root; cobra and green_slime from the archive/kneel-k3-0 checkout given by --old-root-for),
  the Stability probe's best key (the 5 probe sprites: J0 PASS first, then the fewest J0 fails, then A-agree), the
  Gemini raw (the cut window of the latest try), the Gemini key, kneel_in1, kneel_in2, kneel_b (only once the key is
  approved with `source: ai`; before that the column says so), hurt / down; under them the J0 / J1 values, the pixel
  grid note and the tries used.
- `<id>_side.gif`: the old kneel sequence beside the Gemini one (kneel_review.kneel_seq timing), once approved.
- `pilot_numbers.txt`: the J0 pitch of every raw (p, confidence, |p - k| / k) and its distribution.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from gen import kneel_ai_data as D
from gen import kneel_ai_pitch as PT
from gen import kneel_ai_review as RV

COLS = ("idle", "old kneel", "Stability best", "Gemini raw", "Gemini key", "kneel_in1", "kneel_in2", "kneel_b", "last")
FRAMES = ("idle", "kneel_in1", "kneel_in2", "kneel", "kneel_b", "hurt", "down")
OLD_PY = r"""
import sys
from pathlib import Path
root, sid, out = sys.argv[1], sys.argv[2], sys.argv[3]
sys.path.insert(0, root)
from gen import kneel_review as KR
if (Path(root) / "gen" / "anim" / "monsters" / f"{sid}.yaml").exists():
    fr = KR.monster(sid)[0]
else:
    r = KR.heroes(sid)
    fr = r[0][1] if isinstance(r, list) and r else {}
for n in ("idle", "kneel_in1", "kneel_in2", "kneel", "kneel_b", "hurt", "down"):
    if n in fr:
        fr[n].save(f"{out}/{n}.png")
"""


def tries(sid: str) -> list[int]:
    return sorted(int(p.stem.split("_")[2]) for p in (D.OUT / sid).glob("raw_g_*.png"))


def gate(sid: str, tag: str) -> dict | None:
    p = D.OUT / sid / f"gate_{tag}.json"
    return json.loads(p.read_text()) if p.exists() else None


def best_try(sid: str) -> int | None:
    ts = [t for t in tries(sid) if (D.OUT / sid / f"key_g_{t}.png").exists()]
    ok = [t for t in ts if (gate(sid, f"g_{t}") or {}).get("verdict") == "PASS"]
    return (ok or ts or [None])[-1]


def probe_best(sid: str) -> tuple[str, int] | None:
    best = None
    for p in (D.OUT / sid).glob("gate_*_*.json"):
        arm, seed = p.stem.split("_")[1], p.stem.split("_")[2]
        if arm == "g" or not (D.OUT / sid / f"key_{arm}_{seed}.png").exists():
            continue
        g = json.loads(p.read_text())
        vals = {r[0]: r[2] for r in g["rows"]}
        agree = float(str(vals.get("A-agree", "0")).split()[0] or 0)
        score = (g["verdict"] == "PASS", -sum(r[1] is False for r in g["rows"]), agree)
        if best is None or score > best[0]:
            best = (score, (arm, int(seed)))
    return best[1] if best else None


def render(sid: str, root: Path | None) -> dict[str, np.ndarray]:
    """The kneel frames of `sid` rendered read-only from the checkout at `root` (default: this one)."""
    root = (root or D.HERE.parent.parent) / "assets-src"
    with tempfile.TemporaryDirectory() as t:
        r = subprocess.run([sys.executable, "-I", "-c", OLD_PY, str(root), sid, t], capture_output=True, text=True)
        if r.returncode != 0:
            print(f"render {sid} from {root}: {(r.stderr.strip().splitlines() or ['failed'])[-1]}")
        return {p.stem: np.asarray(Image.open(p).convert("RGBA")).copy() for p in Path(t).glob("*.png")}


def converted(sid: str) -> bool:
    from gen import kneel_ai as KA
    return sid in KA.converted()


def raw_tile(sid: str, t: int | None, sp: D.Sprite) -> np.ndarray | None:
    """The cut window of raw_g_<t> (the whole raw when the cut failed), at the sheet's x4 cell size."""
    p = D.OUT / sid / f"raw_g_{t}.png"
    if t is None or not p.exists():
        return None
    im = Image.open(p).convert("RGBA")
    cut = D.OUT / sid / f"cut_g_{t}.json"
    w = json.loads(cut.read_text()).get("window") if cut.exists() else None
    if w:
        im = im.crop((w["x0"], w["y0"], w["x0"] + w["w"], w["y0"] + w["h"]))
    (cw, ch) = sp.cell
    return np.asarray(im.resize((cw * RV.SCALE, ch * RV.SCALE), Image.Resampling.LANCZOS))


def _tile(img: np.ndarray | None, sp: D.Sprite, lines: list[str], big: bool = False) -> Image.Image:
    if not big:
        return RV._cell(img, *sp.cell, sp.foot_row, lines)
    tile = RV._cell(None, *sp.cell, sp.foot_row, lines)
    if img is not None:
        up = Image.fromarray(img, "RGBA")
        tile.paste(up, (4, 0), up)
    return tile


def _gate_lines(sid: str, t: int | None) -> list[str]:
    g = gate(sid, f"g_{t}") if t else None
    if not g:
        return [f"try {t}: no J0" if t else "no Gemini try"]
    vals = {r[0]: r[2] for r in g["rows"]}
    j1 = [r[0] for r in g["rows"] if r[0].startswith(("J1", "A-scale", "A-prop", "A-headdup")) and r[1] is False]
    return [f"try {t}: {g['verdict'][:60]}", f"area {vals.get('A-area', '-').split(';')[0]}",
            f"width {vals.get('A-width', '-')}", f"grid {PT.note(PT.load(D.OUT / sid, t))}",
            f"J1 fails: {', '.join(j1) or '-'}"]


def row(sid: str, old: dict, new: dict, ts: list[int]) -> list[Image.Image]:
    sp, d = D.load(sid), D.OUT / sid
    t, pb = best_try(sid), probe_best(sid)
    key = np.asarray(Image.open(d / f"key_g_{t}.png").convert("RGBA")) if t else None
    last = "hurt" if "hurt" in sp.keys else "down"
    note = [] if new else ["not approved yet"]
    return [_tile(sp.idle, sp, [f"{sid} idle", f"tries {len(ts)} ({' '.join(map(str, ts)) or '-'})"]),
            _tile(old.get("kneel"), sp, ["old derived kneel" if old.get("kneel") is not None else "old: none"]),
            _tile(RV._native(d / f"key_{pb[0]}_{pb[1]}.png") if pb else None, sp,
                  [f"Stability best ({pb[0]} {pb[1]})" if pb else "Stability: not probed"]),
            _tile(raw_tile(sid, t, sp), sp, [f"Gemini raw (try {t})" if t else "Gemini raw: -"], big=True),
            _tile(key, sp, ["Gemini key", *_gate_lines(sid, t)]),
            *[_tile(new.get(n), sp, [n, *note]) for n in ("kneel_in1", "kneel_in2", "kneel_b")],
            _tile(sp.keys.get(last), sp, [last])]


def _seq(fr: dict) -> list[Image.Image]:
    from gen import kneel_review as KR
    ims = {k: Image.fromarray(v, "RGBA") for k, v in fr.items()}
    return [im for im, _, n in KR.kneel_seq(ims) for _ in range(n)]


def side_gif(sid: str, old: dict, new: dict, path: Path, k: int = 4) -> bool:
    if not all(n in f for f in (old, new) for n in ("idle", "kneel_in1", "kneel_in2", "kneel", "kneel_b")):
        return False
    a, b = _seq(old), _seq(new)
    n = max(len(a), len(b))
    a, b = a + a[-1:] * (n - len(a)), b + b[-1:] * (n - len(b))
    frames, durs = [], []
    for x, y in zip(a, b):
        if frames and frames[-1][0] is x and frames[-1][1] is y:
            durs[-1] += 1
            continue
        frames.append((x, y))
        durs.append(1)
    out = []
    for x, y in frames:
        c = Image.new("RGBA", (x.width + y.width + 4, max(x.height, y.height)), (60, 60, 70, 255))
        c.alpha_composite(x.convert("RGBA"), (0, 0))
        c.alpha_composite(y.convert("RGBA"), (x.width + 4, 0))
        out.append(c.resize((c.width * k, c.height * k), Image.Resampling.NEAREST).convert("RGB"))
    out[0].save(path, save_all=True, append_images=out[1:], duration=[round(n * 1000 / 60) for n in durs], loop=0)
    return True


def numbers(ids: list[str]) -> str:
    rows, rels = [], []
    for sid in ids:
        for t in tries(sid):
            m = PT.load(D.OUT / sid, t)
            rows.append(f"{sid} try {t}: {PT.note(m)}")
            if m and m["grid"] and m["rel"] is not None:
                rels.append(m["rel"])
    grid = f"grid in {len(rels)} of {len(rows)} raws"
    if rels:
        grid += (f"; |p-k|/k median {float(np.median(rels)):.3f}, max {max(rels):.3f}, "
                 f"> 0.15: {sum(r > 0.15 for r in rels)}")
    return "\n".join(rows + [grid]) + "\n"


def pilot(ids: list[str], old_root: Path | None, old_for: dict[str, Path]) -> str:
    RV.REVIEW.mkdir(parents=True, exist_ok=True)
    rows, gifs = [], []
    for sid in ids:
        old, new = render(sid, old_for.get(sid, old_root)), render(sid, None) if converted(sid) else {}
        rows.append(row(sid, old, new, tries(sid)))
        if new and side_gif(sid, old, new, RV.REVIEW / f"{sid}_side.gif"):
            gifs.append(sid)
    cw = max(t.width for r in rows for t in r)
    rh = [max(t.height for t in r) for r in rows]
    im = Image.new("RGB", (cw * len(COLS), sum(rh) + 16), (30, 30, 36))
    ImageDraw.Draw(im).text((4, 2), "  |  ".join(COLS), fill=(255, 255, 255))
    y = 16
    for r, h in zip(rows, rh):
        for i, t in enumerate(r):
            im.paste(t, (i * cw, y))
        y += h
    im.save(RV.REVIEW / "pilot_g_sheet.png")
    (RV.REVIEW / "pilot_numbers.txt").write_text(numbers(ids))
    return (f"{RV.REVIEW / 'pilot_g_sheet.png'} ({len(ids)} rows); {RV.REVIEW / 'pilot_numbers.txt'}; side GIFs: "
            f"{' '.join(gifs) or 'none (no approved Gemini kneel yet)'}")
