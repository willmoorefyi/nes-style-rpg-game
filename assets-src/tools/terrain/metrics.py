"""The T3b terrain numbers (build_map.py --metrics): boundary straightness, peaks, foothills and fidelity."""
from __future__ import annotations

import numpy as np

import kit as K
from .base import CORE, MARGIN, T, TEX, WILD, _blur, _tile, _up
from .outline import _cached_partition
from .peaks import plan_peaks


GROUPS = {"coast": (("ocean", "water"), ("grass", "sand", "forest", "mountain", "dirt")),
          "sand_grass": (("sand",), ("grass",)), "forest_grass": (("forest",), ("grass",)),
          "mountain_grass": (("mountain",), ("grass",))}


PART_OF = {"forest": ("tree_clump",), "mountain": ("peak", "boulder")}


def classify(below: np.ndarray, kit: K.Kit, mats: tuple[str, ...]) -> np.ndarray:
    """Per pixel, the index into mats of the texture (tiled at that pixel) it is closest to. Shadows and rims are
    not materials: the texture is also tried at the shading factors both painters use."""
    H, W = below.shape[:2]
    best = np.full((H, W), np.inf, np.float32)
    out = np.zeros((H, W), np.uint8)
    b = below.astype(np.float32)
    for i, m in enumerate(mats):
        t = _tile(kit.material(m), H, W).astype(np.float32)
        d = np.min([np.abs(b - t * f).sum(axis=2) for f in (1.0, 0.85, 0.8, 0.72, 0.6, 0.55)], axis=0)
        parts = [kit.parts[p] for p in PART_OF.get(m, ()) if p in kit.parts and p in kit.approved]
        if parts:                                  # stamped art (clumps, peaks, rocks) counts as its material
            pal = np.unique(np.concatenate([np.asarray(p.convert("RGBA"))[..., :3][np.asarray(p)[..., 3] > 127]
                                            for p in parts]), axis=0).astype(np.int32)
            packed = (below[..., 0].astype(np.int32) << 16) | (below[..., 1].astype(np.int32) << 8) | below[..., 2]
            cols, inv = np.unique(packed, return_inverse=True)
            rgb = np.stack([cols >> 16, (cols >> 8) & 255, cols & 255], axis=1)
            dp = np.abs(rgb[:, None, :] - pal[None, :, :]).sum(axis=2).min(axis=1)
            d = np.minimum(d, dp[inv.reshape(H, W)].astype(np.float32))
        upd = d < best
        best[upd] = d[upd]
        out[upd] = i
    return out


STRAIGHT_DEV = 3.0                       # px: a boundary stretch this close to one line counts as straight
RUN_MAX = 96                             # px: a straight stretch this long reads as a grid edge (selftest limit)


def boundary_stats(a: np.ndarray, b: np.ndarray, window: tuple[slice, slice] | None = None) -> dict:
    """Boundary between pixel sets a and b (smoothed r 4, so dither does not count as boundary): the longest
    straight run (px, end to end) of the traced outline, i.e. the longest stretch whose points all lie within
    STRAIGHT_DEV px of their fitted (total least squares) line, in any direction, with the cell it is centred on;
    and the share of boundary edges that run along a cell line within 2 px."""
    fa, fb = _blur(_blur(a.astype(np.float32), 4), 4), _blur(_blur(b.astype(np.float32), 4), 4)
    region = (fa + fb) > 0.6
    side = fa > 1.5 * fb                     # a: its clear majority (60 %); a dithered fringe below that is not its edge
    eh = region[:-1, :] & region[1:, :] & (side[:-1, :] != side[1:, :])      # between rows y and y+1
    ev = region[:, :-1] & region[:, 1:] & (side[:, :-1] != side[:, 1:])      # between columns x and x+1
    if window is not None:
        ys, xs = window
        eh, ev = eh[ys, xs], ev[ys, xs]
        oy, ox = ys.start or 0, xs.start or 0
    else:
        oy = ox = 0
    n = int(eh.sum() + ev.sum())
    if not n:
        return {"edges": 0, "longest_run": 0, "longest_at": None, "on_cell_line": 0.0}
    ly = (np.arange(eh.shape[0]) + oy + 1) % T
    lx = (np.arange(ev.shape[1]) + ox + 1) % T
    near_h = eh & np.isin(ly, [T - 2, T - 1, 0, 1, 2])[:, None]
    near_v = ev & np.isin(lx, [T - 2, T - 1, 0, 1, 2])[None, :]
    best, at = 0.0, None
    for chain in _chains(eh, ev):
        run, mid = _straight_run(chain, STRAIGHT_DEV)
        if run > best:
            best, at = run, [int((mid[0] + ox) // T), int((mid[1] + oy) // T)]
    return {"edges": n, "longest_run": int(round(best)), "longest_at": at,
            "on_cell_line": round(float(near_h.sum() + near_v.sum()) / n, 3)}


def _chains(eh: np.ndarray, ev: np.ndarray) -> list[np.ndarray]:
    """The boundary's crack edges traced into chains of lattice vertices (x, y): eh[y, x] joins (x, y+1) and
    (x+1, y+1), ev[y, x] joins (x+1, y) and (x+1, y+1). Open chains start at their ends; at a vertex where four edges
    meet the first unused edge is taken. Closed loops repeat their first vertices, so a run may wrap round."""
    ys, xs = np.nonzero(eh)
    segs = [((x, y + 1), (x + 1, y + 1)) for y, x in zip(ys.tolist(), xs.tolist())]
    ys, xs = np.nonzero(ev)
    segs += [((x + 1, y), (x + 1, y + 1)) for y, x in zip(ys.tolist(), xs.tolist())]
    adj: dict[tuple[int, int], list[int]] = {}
    for i, (p, q) in enumerate(segs):
        adj.setdefault(p, []).append(i)
        adj.setdefault(q, []).append(i)
    used = [False] * len(segs)
    starts = sorted(v for v, es in adj.items() if len(es) % 2) + sorted(adj)
    chains = []
    for s in starts:
        while any(not used[i] for i in adj[s]):
            pts, v = [s], s
            while True:
                nxt = next((i for i in adj[v] if not used[i]), None)
                if nxt is None:
                    break
                used[nxt] = True
                p, q = segs[nxt]
                v = q if p == v else p
                pts.append(v)
            if pts[-1] == pts[0]:
                pts += pts[1:min(len(pts), 400)]
            chains.append(np.array(pts, np.float64))
    return chains


def _straight_run(pts: np.ndarray, dev: float) -> tuple[float, np.ndarray]:
    """The longest end-to-end distance over windows of consecutive chain points that all lie within `dev` px of
    their total-least-squares line (two pointers), and the midpoint of that window."""
    best, mid = 0.0, pts[0]
    n, j = len(pts), 1
    for i in range(n - 1):
        j = max(j, i + 1)
        while j + 1 < n and _deviation(pts[i:j + 2]) <= dev:
            j += 1
        run = float(np.hypot(*(pts[j] - pts[i])))
        if run > best:
            best, mid = run, (pts[i] + pts[j]) / 2
        if j == n - 1:
            break
    return best, mid


def _deviation(p: np.ndarray) -> float:
    c = p - p.mean(axis=0)
    cov = c.T @ c
    _, vecs = np.linalg.eigh(cov)
    return float(np.abs(c @ vecs[:, 0]).max())          # distance along the normal (smallest eigenvector)


def peak_stats(placements: list[tuple[str, int, int]]) -> dict[str, float]:
    peaks = [(n, x, y) for n, x, y in placements if n.startswith("peak")]   # not the foothill rocks
    if not peaks:
        return {"peaks": 0, "variants": 0, "anchor_std_mod48": 0.0}
    xs, ys = np.array([p[1] for p in peaks]) % T, np.array([p[2] for p in peaks]) % T
    return {"peaks": len(peaks), "variants": len({p[0] for p in peaks}),
            "anchor_std_mod48": round(float(min(xs.std(), ys.std())), 1)}


def foothill_share(below: np.ndarray, mat: np.ndarray, kit: K.Kit) -> float:
    """Share of grass cells 4-next to a mountain cell whose centre holds foothill pixels (mountain texture or rock)."""
    H, W = below.shape[:2]
    mtex = _tile(kit.material("mountain"), H, W)
    gtex = _tile(kit.material("grass"), H, W)
    hgt, wid = mat.shape
    hits = total = 0
    for y in range(hgt):
        for x in range(wid):
            if mat[y, x] != "grass" or not any(0 <= y + b < hgt and 0 <= x + a < wid and mat[y + b, x + a] == "mountain"
                                               for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                continue
            sl = (slice(y * T + MARGIN, y * T + MARGIN + CORE), slice(x * T + MARGIN, x * T + MARGIN + CORE))
            px = below[sl].astype(np.int32)
            rock = np.all(px == mtex[sl], axis=2) | (np.abs(px - gtex[sl]).sum(axis=2) > 120)
            total += 1
            hits += int(rock.sum() >= 10)
    return round(hits / total, 3) if total else 1.0


FID_MATS = ("grass", "sand", "forest", "mountain", "ocean", "water", "dirt", "cobble", "tundra", "snow")


def fidelity(below: np.ndarray, mat: np.ndarray, kit: K.Kit, skip: set | None = None) -> dict[str, float]:
    """Per wild cell: the share of its centre CORE px that read as its own material (classify: its texture, shaded,
    or its stamped art); the minimum and the number of cells under 50 %. Roads are left out: they are drawn as a
    track along their centre line (a diagonal cuts across its cells), and road and grass are both walkable."""
    mats = tuple(m for m in FID_MATS if m in kit.materials)    # NW: tundra / snow only in a kit that has them
    cls = classify(below, kit, mats)
    worst, bad = 1.0, 0
    hgt, wid = mat.shape
    for y in range(hgt):
        for x in range(wid):
            m = mat[y, x]
            if m not in WILD or (skip and (x, y) in skip):
                continue
            sl = (slice(y * T + MARGIN, y * T + MARGIN + CORE), slice(x * T + MARGIN, x * T + MARGIN + CORE))
            share = float((cls[sl] == mats.index(TEX.get(m, m))).mean())
            worst = min(worst, share)
            bad += share < 0.5
    return {"min_core_share": round(worst, 3), "cells_below_half": bad}


class _Recorder:
    """Stands in for the canvas: records which part goes where (for peak metrics)."""

    def __init__(self, names: dict[int, str]):
        self.names, self.pastes = names, []

    def alpha_composite(self, im, dest):
        self.pastes.append((self.names.get(id(im), "peak"), dest))


def metrics(src: dict, compiled) -> dict:
    """The T3b numbers for a compiled map (build_map.py --metrics)."""
    import build_map as B  # noqa: PLC0415
    kit = B.K.load_kits(src.get("kits") or [src.get("kit", "town")])
    mat, below = compiled.mat, compiled.below
    mats = ("grass", "sand", "forest", "mountain", "ocean", "water", "dirt")
    cls = classify(below, kit, mats)
    # roads, bridges, walls and objects are square by design: only the wild ground is measured
    wild = np.isin(mat, WILD)
    for (x, y) in compiled.owner:
        wild[y, x] = False
    keep = _up(wild)
    out: dict = {}
    for name, (ga, gb) in GROUPS.items():
        a = np.isin(cls, [mats.index(m) for m in ga]) & keep
        b = np.isin(cls, [mats.index(m) for m in gb]) & keep
        out[name] = boundary_stats(a, b)
    organic = src.get("terrain") == "organic"
    if organic and "peak" in kit.parts:
        seed = sum(map(ord, src["id"]))
        _cached_partition(mat, seed)
        out["peaks"] = peak_stats(plan_peaks(mat, compiled.owner, kit))
    elif "peak" in kit.parts:
        part = kit.part("peak")
        rec = _Recorder({id(part): "peak"})
        B.place_peaks(rec, mat, compiled.owner, kit, np.random.default_rng(sum(map(ord, src["id"]))))
        ax, ay = 24, 47
        out["peaks"] = peak_stats([(n, x + ax, y + ay) for n, (x, y) in rec.pastes])
    out["foothills"] = foothill_share(below, mat, kit)
    out["fidelity"] = fidelity(below, mat, kit, set(compiled.owner))
    return out
