"""EF-H (docs/ENEMY_FEEDBACK_PLAN.md EF-H): palette reserves of a user-rendered sheet (recipe key `reserve`).

The house palette (PX.sheet_palette with the detail mask) can merge a small region into a big neighbour: on the
pirate the face's skin drifted toward the gold trim / the bandana red and the cutlass lost its bright steel. A recipe
names such regions; each one's tones go through the house rule of PX.reserve_detail (merge the two closest palette
colours, give the freed slot to the region's pixels that sit far from every colour), so the sheet stays at
<= 16 colours, 15-bit, with PX.OUTLINE the darkest entry. Each region is the render's opaque px inside its `boxes`
(sheet px [x0, y0, x1, y1), the whole sheet when absent) that pass its colour class `select`:

  reserve:
    - {name: skin, select: skin, slots: 3, max_err: 14, boxes: [[51, 20, 63, 30], ...]}
    - {name: steel, select: steel, slots: 3, max_err: 14, boxes: [[40, 18, 86, 56], ...]}
"""
from __future__ import annotations

import numpy as np
from PIL import Image

from gen import pixelize as PX


def _skin(o: np.ndarray) -> np.ndarray:
    """Warm mid-saturation tones: r > g > b, red well above blue, green between 0.35 and 0.8 of red (a coat or
    bandana red has almost no green)."""
    r, g, b = o[:, 0], o[:, 1], o[:, 2]
    return (r > g) & (g > b) & (r >= 100) & (r - b >= 45) & (g >= 0.35 * r) & (g <= 0.8 * r)


def _bright(o: np.ndarray) -> np.ndarray:
    """Bright, nearly grey px (polished steel, its sparkle, teeth): every channel >= 150, spread <= 70."""
    return (o.min(1) >= 150) & (o.max(1) - o.min(1) <= 70)


def _steel(o: np.ndarray) -> np.ndarray:
    """Light cool greys (a blade from its blue-grey shading to its sparkle): blue >= red - 5, spread <= 80,
    brightest channel >= 120 (the navy cloth stays below)."""
    return (o[:, 2] >= o[:, 0] - 5) & (o.max(1) - o.min(1) <= 80) & (o.max(1) >= 120)


def _gold(o: np.ndarray) -> np.ndarray:
    """Pale gold (a trim's lit edge): warm and bright, red >= 190, green >= 0.75 of red, blue <= 0.75 of green."""
    r, g, b = o[:, 0], o[:, 1], o[:, 2]
    return (r >= 190) & (r >= g) & (g >= 0.75 * r) & (b <= 0.75 * g)


def _grey(o: np.ndarray) -> np.ndarray:
    """Neutral mid greys (a beard, stubble): spread <= 24, brightest channel 45-150."""
    return (o.max(1) - o.min(1) <= 24) & (o.max(1) >= 45) & (o.max(1) <= 150)


def _magenta(o: np.ndarray) -> np.ndarray:
    """Purple-magenta (drawn magic): red >= 120 and blue >= 110, green under half of both."""
    r, g, b = o[:, 0], o[:, 1], o[:, 2]
    return (r >= 120) & (b >= 110) & (g < 0.5 * np.minimum(r, b))


def _red(o: np.ndarray) -> np.ndarray:
    """Crimson (fire_lizard's frill, EF-H A): red >= 120, green under 0.3 of red, blue near the green (>= 0.6 of it, so
    a glowing orange-red with almost no blue stays out) and under 0.35 of red."""
    r, g, b = o[:, 0], o[:, 1], o[:, 2]
    return (r >= 120) & (g <= 0.3 * r) & (b <= 0.35 * r) & (b >= 0.6 * g)


def _ember(o: np.ndarray) -> np.ndarray:
    """Glowing ember orange (black_knight's visor, EF-H A): red >= 150, green <= 0.75 of red, blue <= 0.45 of green."""
    r, g, b = o[:, 0], o[:, 1], o[:, 2]
    return (r >= 150) & (g <= 0.75 * r) & (b <= 0.45 * g)


def _green(o: np.ndarray) -> np.ndarray:
    """Olive / green scales (chimera's dragon head, EF-H batch 3): green >= red, green >= 1.4 x blue, green >= 50."""
    r, g, b = o[:, 0], o[:, 1], o[:, 2]
    return (g >= r) & (g >= 1.4 * b) & (g >= 50)


def _taupe(o: np.ndarray) -> np.ndarray:
    """Warm greys (chimera's goat head, EF-H batch 3): r >= g >= b, red 5-40 over blue (a neutral grey stays out) and
    at most 25 over green, red 60-170 (the lion's oranges and the wings' red-browns stay out)."""
    r, g, b = o[:, 0], o[:, 1], o[:, 2]
    return (r >= g) & (g >= b) & (r - b >= 5) & (r - b <= 40) & (r - g <= 25) & (r >= 60) & (r <= 170)


def _cyan(o: np.ndarray) -> np.ndarray:
    """A glowing cyan glyph (dark_fighter's shield crescent, EF-H batch 3): green >= 150, blue >= 0.7 of green, red
    at most 0.8 of green (the eyes' pale white-cyan stays out)."""
    r, g, b = o[:, 0], o[:, 1], o[:, 2]
    return (g >= 150) & (b >= 0.7 * g) & (r <= 0.8 * g)


def _crimson(o: np.ndarray) -> np.ndarray:
    """A crimson cloak from its darkest fold to its lit edge (death_knight, EF-H batch 3): red >= 30, blue 0.3-0.77 of
    red, blue >= 1.3 x green (the steel greys, the bone, the oranges and the sword's hot rune reds stay out)."""
    r, g, b = o[:, 0], o[:, 1], o[:, 2]
    return (r >= 30) & (r >= 1.3 * b) & (b >= 0.3 * r) & (b >= 1.3 * g)


def _glow(o: np.ndarray) -> np.ndarray:
    """A pale glowing green (dragon_zombie's eyes, EF-H batch 3): green >= 180 and at least 30 over red and blue (the
    bone whites and the olive greens stay out)."""
    r, g, b = o[:, 0], o[:, 1], o[:, 2]
    return (g >= 180) & (g >= r + 30) & (g >= b + 30)


SELECT = {"skin": _skin, "bright": _bright, "steel": _steel, "gold": _gold, "grey": _grey, "magenta": _magenta,
          "red": _red, "ember": _ember, "green": _green, "taupe": _taupe, "cyan": _cyan, "crimson": _crimson,
          "glow": _glow, "pale": lambda o: (o.min(1) >= 120) & (o.max(1) - o.min(1) <= 50),
          "navy": lambda o: (o[:, 2] >= o[:, 0] + 30) & (o[:, 2] >= o[:, 1] + 15) & (o[:, 2] <= 140)}
# `navy` (EF-H amendment C; white_dragon's dark scale shading, king_mummy's headdress): blue >= red + 30, >= green +
# 15, <= 140 (the pale blue scales, the gold, the greys and the outline ink out)
# `pale` (medusa's pale skin, EF-H batch 3): every channel >= 120, spread <= 50 (the gold scales, the green coils out)


def masks(img: Image.Image, rec: dict) -> dict[str, np.ndarray]:
    """Per region of the recipe's `reserve`, its sheet-sized bool mask (empty dict without a reserve)."""
    a = np.asarray(img)
    out = {}
    for r in rec.get("reserve") or []:
        if r.get("select") not in SELECT:
            raise SystemExit(f"reserve {r.get('name')}: select must be one of {sorted(SELECT)}")
        inside = np.zeros(a.shape[:2], bool)
        for x0, y0, x1, y1 in r.get("boxes") or [[0, 0, a.shape[1], a.shape[0]]]:
            inside[y0:y1, x0:x1] = True
        m = inside & (a[..., 3] > 0)
        sel = np.zeros_like(m)
        sel[m] = SELECT[r["select"]](a[m][:, :3].astype(np.float32))
        out[r["name"]] = sel
    return out


def reserve(pal: np.ndarray, img: Image.Image, rec: dict, regions: dict[str, np.ndarray], seed: int = 0) -> np.ndarray:
    """The sheet palette with each region's reserve applied in recipe order: the region's px split into `slots`
    tones (k-means), and per tone PX.reserve_detail's rule (when >= 8 of its px sit over `max_err` from every
    colour, the two closest colours merge and the freed slot takes those px's median), a reserved slot never merged
    again; the outline entry stays out of the merges, the result is 15-bit with PX.OUTLINE the darkest entry."""
    a = np.asarray(img)
    allpx = a[(a[..., 3] > 0) & (a[..., :3].max(2) >= 40)][:, :3].astype(np.float32)   # the figure px (ink apart)
    dark = int(pal.sum(1).argmin())
    cent = np.delete(pal.astype(np.float32), dark, 0)
    kept: set[int] = set()
    for r in rec.get("reserve") or []:
        px = a[regions[r["name"]]][:, :3].astype(np.float32)
        k = min(int(r.get("slots", 1)), len(px))
        if k == 0:
            continue
        tones = PX.kmeans(px, k, seed=seed)             # the region's own tones (light / shaded skin, sparkle / steel)
        lab = ((px[:, None, :] - tones[None]) ** 2).sum(-1).argmin(1)
        for i in range(k):
            t = px[lab == i]
            far = t[np.sqrt(((t[:, None, :] - cent[None]) ** 2).sum(-1).min(1)) > float(r.get("max_err", 24))]
            if len(far) < 8:
                continue
            n = np.bincount(((allpx[:, None, :] - cent[None]) ** 2).sum(-1).argmin(1), minlength=len(cent)) + 1.0
            cd = ((cent[:, None] - cent[None]) ** 2).sum(-1) * (n[:, None] * n[None]) / (n[:, None] + n[None])
            np.fill_diagonal(cd, np.inf)                # Ward: merge the pair that costs the sheet the least error
            cd[list(kept), :] = cd[:, list(kept)] = np.inf
            p, q = np.unravel_index(int(cd.argmin()), cd.shape)
            cent[p] = (cent[p] * n[p] + cent[q] * n[q]) / (n[p] + n[q])
            cent[q] = np.median(far, axis=0)
            kept.add(int(q))
    cent = np.vstack([PX.snap15(cent).astype(np.float32), np.array([PX.OUTLINE], np.float32)])
    cent[int(cent.sum(1).argmin())] = PX.OUTLINE
    return cent


def origins(img: Image.Image, speck: int) -> list[tuple[int, int]]:
    """The sheet (y, x) of each split cell's top-left (monster_user.split: the pieces left to right, padded by 2)."""
    from gen.anim_efix import pieces8
    ps = [p for p in pieces8(np.asarray(img)[..., 3] > 0) if len(p) >= speck]
    return [(min(y for y, _ in p) - 2, min(x for _, x in p) - 2) for p in sorted(ps, key=lambda p: min(x for _, x in p))]


def region_error(img: Image.Image, cells, frames: list[Image.Image], offsets: list[tuple[int, int]],
                 regions: dict[str, np.ndarray], speck: int) -> dict:
    """Per region: px, mean / p90 / max colour error (each source px vs its cut px; s = 1.0) and the cut colours."""
    a = np.asarray(img)
    orgs = origins(img, speck)
    out = {}
    for name, rm in regions.items():
        errs, cols = [], []
        for (oy, ox), (tx, ty), (_, m), fr in zip(orgs, offsets, cells, frames):
            sub = rm[oy:oy + m.shape[0], ox:ox + m.shape[1]] & m
            vy, vx = np.where(sub)
            q = np.asarray(fr)[vy + ty, vx + tx, :3].astype(np.float32)
            errs.append(np.sqrt(((q - a[vy + oy, vx + ox, :3].astype(np.float32)) ** 2).sum(1)))
            cols.append(q)
        e = np.concatenate(errs)
        out[name] = {"px": int(len(e)), "mean": round(float(e.mean()), 1), "p90": round(float(np.percentile(e, 90)), 1),
                     "max": round(float(e.max()), 1), "colours": len(np.unique(np.concatenate(cols), axis=0))}
    return out
