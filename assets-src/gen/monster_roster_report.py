"""Roster contact sheet and distinctness report (docs/ROSTER_PLAN.md 11.1, FW-8). Report only: it decides nothing.

  python3 -I assets-src/gen/monster_roster_report.py [--atlas DIR] [--out DIR] [--calibrate]

Reads a monster atlas (`DIR/monsters-ai.json` and its pages; the R0 single-page shape too; default assets/sprites)
and writes to --out (default gen/out/roster/):
- `contact.png`: every idle at 1x and 2x, one row per sibling group of ROSTER_PLAN 3.3 (then the ungrouped sprites);
- `report.txt` (also printed): per pair in a sibling group, and every pair of the same body type and size, the
  **silhouette IoU** (alpha masks bottom-aligned, scaled nearest to a common 64 px height, centred, best over
  horizontal shifts of +-4 px and a mirror) and the **interior edge IoU** at that alignment (pixels where the colour
  changes inside the figure: seams, face, props; a palette swap keeps them, a redesign does not). A pair is flagged
  "reads as a recolour" at silhouette >= RECOLOUR_SIL and edge >= RECOLOUR_EDGE, and watched at silhouette >= WATCH_SIL;
  then per-sprite metrics (colours, figure height against its band, lowest row against the feet row, outline).
- `--calibrate` (on the R0 atlas: `git show roster-r0:...` into a directory): the R1 calibration pairs; the recolour
  pairs must be flagged and the distinct pairs must not. A distinct pair above a threshold raises it to that pair's
  value + 0.02 (printed in the header; record it in this file's constants).
"""
from __future__ import annotations

import itertools
import json
import sys
from pathlib import Path

import numpy as np
import yaml
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = HERE / "out" / "roster"
H = 64                    # common height of the aligned masks
SHIFT = 4                 # +- horizontal shifts tried
RECOLOUR_SIL, RECOLOUR_EDGE, WATCH_SIL = 0.85, 0.60, 0.75
# docs/ROSTER_PLAN.md 3.3, by sprite id (roster table 3.2); ids without art yet are skipped
SIBLINGS: list[list[str]] = [
    ["goblin", "gr_imp"], ["wolf", "gr_wolf", "winter_wolf", "werewolf", "hellhound"],
    ["ogre", "ogre_chief", "ogre_mage"], ["hill_gigas", "fire_gigas", "ice_gigas"],
    ["skeleton", "bloodbones", "death_knight", "wight"], ["zombie", "ghoul", "ghast"],
    ["shadow", "wraith", "specter", "ghost"], ["mummy", "king_mummy"], ["vampire", "vampire_lord"],
    ["sahagin", "sahagin_chief", "sahagin_prince"], ["pirate", "buccaneer"], ["shark", "white_shark"],
    ["piranha", "red_piranha"], ["crocodile", "white_crocodile"], ["green_slime", "gray_ooze", "ochre_jelly", "black_flan"],
    ["clay_golem", "stone_golem", "iron_golem"], ["medusa", "earth_medusa", "water_naga", "spirit_naga"],
    ["gigas_worm", "lava_worm", "sand_worm", "purple_worm"], ["bigeyes", "deepeyes", "evil_eye", "death_eye"],
    ["hydra", "fire_hydra", "chimera", "rhyos"], ["dragon", "white_dragon", "blue_dragon", "green_dragon", "dragon_zombie"],
    ["cockatrice", "pyrolisk", "basilisk"], ["black_widow", "tarantula"], ["scorpion", "sea_scorpion"],
    ["crawler", "ankheg", "remorazz"], ["baretta", "desert_baretta"],
    ["fire_elemental", "water_elemental", "air_elemental", "earth_elemental"],
]
CAL_RECOLOUR = [("goblin", "gr_imp"), ("wolf", "gr_wolf")]
CAL_DISTINCT = [("ogre", "troll"), ("goblin", "pirate"), ("skeleton", "mummy"), ("wolf", "dragon")]
BANDS = {"small": ((56, 72), 76), "large": ((96, 120), 122), "boss": ((140, 192), 192)}   # spec.py; boss per-pose 200


def load_idles(atlas: Path) -> tuple[dict[str, np.ndarray], dict]:
    """{sprite: idle RGBA} from an atlas directory (paged index or the R0 single page)."""
    m = json.loads((atlas / "monsters-ai.json").read_text())
    files = [p["file"] for p in m["pages"]] if "pages" in m else ["monsters-ai.png"]
    pages = [np.asarray(Image.open(atlas / Path(f).name).convert("RGBA")) for f in files]
    out = {}
    for s, v in sorted(m["sheets"].items()):
        (x, y), (w, h) = v["frames"]["idle"], v["cell"]
        out[s] = pages[v.get("page", 0)][y:y + h, x:x + w].copy()
    return out, m


def _norm(img: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """(silhouette, interior edges) cropped to the opaque box and scaled nearest to height H."""
    a = img[..., 3] > 0
    ys, xs = np.nonzero(a)
    if not len(ys):
        return np.zeros((H, 1), bool), np.zeros((H, 1), bool)
    crop, mask = img[ys.min():ys.max() + 1, xs.min():xs.max() + 1], a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    rgb = crop[..., :3].astype(np.int32)
    key = (rgb[..., 0] << 16) | (rgb[..., 1] << 8) | rgb[..., 2]
    edge = np.zeros_like(mask)
    edge[:, :-1] |= mask[:, :-1] & mask[:, 1:] & (key[:, :-1] != key[:, 1:])
    edge[:-1, :] |= mask[:-1, :] & mask[1:, :] & (key[:-1, :] != key[1:, :])
    w = max(1, round(mask.shape[1] * H / mask.shape[0]))
    rows = (np.arange(H) * mask.shape[0] // H)
    cols = (np.arange(w) * mask.shape[1] // w)
    return mask[rows][:, cols], edge[rows][:, cols]


def _place(m: np.ndarray, width: int, dx: int) -> np.ndarray:
    out = np.zeros((H, width), bool)
    x0 = (width - m.shape[1]) // 2 + dx
    lo, hi = max(0, x0), min(width, x0 + m.shape[1])
    if hi > lo:
        out[:, lo:hi] = m[:, lo - x0:hi - x0]
    return out


def _iou(a: np.ndarray, b: np.ndarray) -> float:
    u = np.logical_or(a, b).sum()
    return float(np.logical_and(a, b).sum() / u) if u else 1.0


def pair_scores(a: np.ndarray, b: np.ndarray) -> tuple[float, float]:
    """(silhouette IoU, interior edge IoU at the best silhouette alignment) of two idle frames."""
    (sa, ea), (sb, eb) = _norm(a), _norm(b)
    width = max(sa.shape[1], sb.shape[1]) + 2 * SHIFT + 2
    A, EA = _place(sa, width, 0), _place(ea, width, 0)
    best = (-1.0, 0.0)
    for flip in (False, True):
        mb, me = (sb[:, ::-1], eb[:, ::-1]) if flip else (sb, eb)
        for dx in range(-SHIFT, SHIFT + 1):
            s = _iou(A, _place(mb, width, dx))
            if s > best[0]:
                best = (s, _iou(EA, _place(me, width, dx)))
    return best


def sprite_info() -> dict[str, dict]:
    """{sprite: {size, body}} from monsters.yaml and the rigs; a palette variant takes its base's."""
    info = {}
    for m in yaml.safe_load((HERE / "monsters.yaml").read_text()) or []:
        rig = HERE / "anim" / "monsters" / f"{m['id']}.yaml"
        body = (yaml.safe_load(rig.read_text()) or {}).get("body", "?") if rig.exists() else "?"
        info[m["id"]] = {"size": m.get("size", "?"), "body": body}
        for v in m.get("variants") or []:
            info[v["id"]] = dict(info[m["id"]])
    return info


def pairs(sprites: list[str], info: dict[str, dict]) -> list[tuple[str, str, str]]:
    """(a, b, why) for every sibling pair and every same body-and-size pair, each pair once."""
    have, seen, out = set(sprites), set(), []
    for g in SIBLINGS:
        for a, b in itertools.combinations([s for s in g if s in have], 2):
            seen.add((a, b))
            out.append((a, b, "sibling"))
    for a, b in itertools.combinations(sorted(have), 2):
        ia, ib = info.get(a, {}), info.get(b, {})
        if (a, b) not in seen and (b, a) not in seen and ia.get("body", "?") != "?" and \
                (ia.get("body"), ia.get("size")) == (ib.get("body"), ib.get("size")):
            out.append((a, b, f"same {ia['body']} {ia['size']}"))
    return out


def metrics(img: np.ndarray, size: str, foot_row: int) -> str:
    a = img[..., 3] > 0
    ys = np.nonzero(a.any(1))[0]
    colours = len({tuple(p) for p in img[a][:, :3]})
    height, low = (int(ys.max() - ys.min() + 1), int(ys.max())) if len(ys) else (0, -1)
    (lo, hi), _ = BANDS.get(size, ((0, 10 ** 6), 0))
    edge = a & ~(np.pad(a, 1)[2:, 1:-1] & np.pad(a, 1)[:-2, 1:-1] & np.pad(a, 1)[1:-1, 2:] & np.pad(a, 1)[1:-1, :-2])
    luma = img[..., :3].astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)
    dark = float((luma[edge] <= 80).mean()) if edge.any() else 0.0
    flags = [f for f, bad in (("colours>16", colours > 16), ("height out of band", not lo <= height <= hi),
                              ("feet off the feet row", low != foot_row), ("weak outline", dark < 0.8)) if bad]
    return f"colours {colours:3d}  height {height:3d} ({lo}-{hi})  lowest row {low:3d} / feet {foot_row:3d}  " \
           f"outline {dark:4.0%}  {', '.join(flags) or 'ok'}"


def contact(idles: dict[str, np.ndarray], out: Path) -> Path:
    rows = [[s for s in g if s in idles] for g in SIBLINGS]
    grouped = {s for r in rows for s in r}
    rows = [r for r in rows if r] + [[s for s in sorted(idles) if s not in grouped]]
    tiles = []
    for r in rows:
        ims = [Image.fromarray(idles[s]) for s in r]
        w = sum(i.width * 3 + 16 for i in ims) + 8
        h = max(i.height * 2 for i in ims) + 24
        row = Image.new("RGBA", (max(w, 64), h), (60, 60, 70, 255))
        d, x = ImageDraw.Draw(row), 8
        for s, i in zip(r, ims):
            row.alpha_composite(i, (x, h - 16 - i.height))
            row.alpha_composite(i.resize((i.width * 2, i.height * 2), Image.Resampling.NEAREST), (x + i.width + 4, h - 16 - i.height * 2))
            d.text((x, h - 13), s, fill=(255, 255, 255, 255))
            x += i.width * 3 + 16
        tiles.append(row)
    sheet = Image.new("RGBA", (max(t.width for t in tiles), sum(t.height for t in tiles)), (40, 40, 48, 255))
    y = 0
    for t in tiles:
        sheet.alpha_composite(t, (0, y))
        y += t.height
    out.mkdir(parents=True, exist_ok=True)
    sheet.save(out / "contact.png")
    return out / "contact.png"


def main(argv: list[str]) -> int:
    arg = lambda k, d: Path(argv[argv.index(k) + 1]) if k in argv else d     # noqa: E731
    atlas, out = arg("--atlas", ROOT / "assets" / "sprites"), arg("--out", OUT)
    idles, meta = load_idles(atlas)
    info = sprite_info()
    sil_t, edge_t, watch_t, notes = RECOLOUR_SIL, RECOLOUR_EDGE, WATCH_SIL, []
    if "--calibrate" in argv:
        for a, b in CAL_DISTINCT:
            if a in idles and b in idles:
                s, e = pair_scores(idles[a], idles[b])
                if s >= sil_t and e >= edge_t:
                    sil_t, edge_t = max(sil_t, round(s + 0.02, 2)), max(edge_t, round(e + 0.02, 2))
                    notes.append(f"distinct pair {a}/{b} ({s:.2f}/{e:.2f}) raised the recolour thresholds")
                if s >= watch_t:
                    watch_t = round(s + 0.02, 2)
                    notes.append(f"distinct pair {a}/{b} (silhouette {s:.2f}) raised the watch threshold")
    lines = [f"roster report: {len(idles)} sprites from {atlas}",
             f"thresholds: recolour silhouette >= {sil_t:.2f} and edge >= {edge_t:.2f}; watch silhouette >= {watch_t:.2f}",
             *[f"calibration: {n}" for n in notes], "", f"{'pair':<34} {'why':<22} {'sil':>5} {'edge':>5}  verdict"]
    bad = 0
    for a, b, why in pairs(sorted(idles), info):
        s, e = pair_scores(idles[a], idles[b])
        verdict = "RECOLOUR" if s >= sil_t and e >= edge_t else "watch" if s >= watch_t else ""
        lines.append(f"{a + ' / ' + b:<34} {why:<22} {s:5.2f} {e:5.2f}  {verdict}")
    if "--calibrate" in argv:
        lines.append("")
        for (a, b), want in [(p, True) for p in CAL_RECOLOUR] + [(p, False) for p in CAL_DISTINCT]:
            if a not in idles or b not in idles:
                lines.append(f"calibration {a}/{b}: missing art, skipped")
                continue
            s, e = pair_scores(idles[a], idles[b])
            got = s >= sil_t and e >= edge_t
            bad += got != want
            lines.append(f"calibration {a}/{b}: {s:.2f}/{e:.2f} {'flagged' if got else 'not flagged'} "
                         f"({'OK' if got == want else 'WRONG'}: must {'' if want else 'not '}be flagged)")
    lines += ["", "per-sprite metrics (idle keyframe)"]
    for s in sorted(idles):
        lines.append(f"{s:<18} {metrics(idles[s], info.get(s, {}).get('size', '?'), meta['sheets'][s]['footRow'])}")
    lines.append(f"\ncontact sheet: {contact(idles, out)}")
    (out / "report.txt").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
