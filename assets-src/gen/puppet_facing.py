"""Hero battle facing fix (docs/HERO_FACING_PLAN.md, pass HF): recorded build-time mirrors of approved battle cells.

`battle.json` `facing_fix` is a list of entries, applied after `face_fix` (the approved PNG stays byte-identical):

  {"pose": "hurt", "mirror": "figure"}        the whole figure, x' = S - x, S = figure_sum (2 x the mean x)
  {"pose": "ready", "mirror": "head", "box": [x0, y0, x1, y1], "exclude": [[x0, y0, x1, y1]], "sum": 82}
                                              the opaque pixels of box minus exclude (half-open), x' = sum - x

A figure mirror keeps the visual centre (so the hero does not move in its cell; clamped to stay in columns
1..w-2) and every row; a head mirror keeps every row
outside the box. Both copy whole pixels (palette and binary alpha kept); a head mirror then closes the silhouette
outline in its rows (puppet.outline's rule) and is checked: palette, binary alpha, no new piece, no new speck.
Any failure raises ValueError, so a bad entry never reaches the atlas. Joints: `mirror_joints` maps a mirrored
keyframe's joints and swaps the n / f labels (n stays the screen-left limb, as on every other keyframe, so a lerp
between keyframes never crosses the limbs); `swap_z` then exchanges n and f in the draw order of the in-betweens cut
from that keyframe, so the limb in front of the torso in the approved pixels stays in front.
"""
from __future__ import annotations

import numpy as np

OUTLINE = (6, 4, 10)
KEYS = {"pose", "mirror", "box", "exclude", "sum", "note"}
SIDED = ("sh", "el", "hand", "hip", "knee", "foot")
SPECK = 12


def entries(meta: dict) -> list[dict]:
    """The validated `facing_fix` entries of a battle.json (empty without one)."""
    fixes = meta.get("facing_fix") or []
    seen = set()
    for f in fixes:
        bad = set(f) - KEYS
        if bad:
            raise ValueError(f"facing_fix: unknown keys {sorted(bad)}")
        if f.get("pose") not in meta["poses"]:
            raise ValueError(f"facing_fix: pose {f.get('pose')!r} not in poses")
        if f["pose"] in seen:
            raise ValueError(f"facing_fix: two entries for {f['pose']}")
        seen.add(f["pose"])
        if f.get("mirror") == "figure":
            if set(f) - {"pose", "mirror", "note"}:
                raise ValueError(f"facing_fix {f['pose']}: a figure mirror takes no box / sum")
        elif f.get("mirror") == "head":
            if len(f.get("box") or []) != 4 or not isinstance(f.get("sum"), int):
                raise ValueError(f"facing_fix {f['pose']}: a head mirror needs box [x0, y0, x1, y1] and an int sum")
        else:
            raise ValueError(f"facing_fix {f['pose']}: mirror must be figure or head")
    return list(fixes)


def figure_sum(cell: np.ndarray) -> int:
    """The reflection x' = S - x of a figure mirror: S = 2 x the opaque pixels' mean x, rounded half up (so the
    figure's visual centre stays within half a pixel), clamped so the reflected bbox stays in columns 1..w-2."""
    ys, xs = np.nonzero(cell[..., 3] > 0)
    n, w = len(xs), cell.shape[1]
    s = (4 * int(xs.sum()) + n) // (2 * n)                       # round half up of 2 * mean, integers only
    return int(min(max(s, int(xs.max()) + 1), int(xs.min()) + w - 2))


def mirror_figure(cell: np.ndarray, s: int | None = None) -> np.ndarray:
    """Reflect the whole figure about x = S / 2 (`figure_sum`): every row and the feet row stay, the visual centre
    stays (the hero does not move in its cell); whole pixels only."""
    s = figure_sum(cell) if s is None else s
    ys, xs = np.nonzero(cell[..., 3] > 0)
    nx = s - xs
    if nx.min() < 1 or nx.max() > cell.shape[1] - 2:
        raise ValueError("facing_fix: the reflected figure leaves the cell")
    out = np.zeros_like(cell)
    out[ys, nx] = cell[ys, xs]
    return out


def head_mask(cell: np.ndarray, f: dict) -> np.ndarray:
    x0, y0, x1, y1 = f["box"]
    m = np.zeros(cell.shape[:2], bool)
    m[y0:y1, x0:x1] = cell[y0:y1, x0:x1, 3] > 0
    for ex in f.get("exclude") or []:
        m[ex[1]:ex[3], ex[0]:ex[2]] = False
    return m


def _grow(m: np.ndarray) -> np.ndarray:
    g = m.copy()
    g[1:] |= m[:-1]
    g[:-1] |= m[1:]
    g[:, 1:] |= m[:, :-1]
    g[:, :-1] |= m[:, 1:]
    return g


def _components(m: np.ndarray) -> list[int]:
    from gen.pixelize import components
    lab, n = components(m)
    return [int((lab == i).sum()) for i in range(1, n + 1)]


def mirror_head(cell: np.ndarray, f: dict, pose: str = "?") -> tuple[np.ndarray, np.ndarray]:
    """(cell with the head reflected, the reflected head mask). Raises on a check failure."""
    m = head_mask(cell, f)
    ys, xs = np.nonzero(m)
    nx = f["sum"] - xs
    w = cell.shape[1]
    if len(nx) and (nx.min() < 1 or nx.max() > w - 2):
        raise ValueError(f"facing_fix {pose}: the reflected head leaves columns 1..{w - 2}")
    out = cell.copy()
    out[m] = 0
    out[ys, nx] = cell[ys, xs]
    moved = np.zeros_like(m)
    moved[ys, nx] = True
    # outline closure in the box rows +- 1 (puppet.outline's rule: ink outside a light silhouette pixel)
    y0, y1 = f["box"][1], f["box"][3]
    rows = np.zeros_like(m)
    rows[max(0, y0 - 1):min(m.shape[0], y1 + 1)] = True
    solid = out[..., 3] > 0
    light = solid & (out[..., :3].astype(int).max(axis=2) >= 60)
    near = _grow(_grow(m | moved))                     # only where the old or the new head was
    ring = _grow(light) & ~solid & rows & near
    out[ring, :3] = OUTLINE
    out[ring, 3] = 255
    _checks(cell, out, pose)
    return out, moved


def _checks(src: np.ndarray, out: np.ndarray, pose: str) -> None:
    if not np.isin(out[..., 3], (0, 255)).all():
        raise ValueError(f"facing_fix {pose}: alpha not binary")
    pal = {tuple(int(v) for v in c) for c in src[src[..., 3] > 0][:, :3]} | {OUTLINE}
    cols = {tuple(int(v) for v in c) for c in out[out[..., 3] > 0][:, :3]}
    if cols - pal:
        raise ValueError(f"facing_fix {pose}: {len(cols - pal)} colours outside the cell's palette")
    a, b = _components(src[..., 3] > 0), _components(out[..., 3] > 0)
    if len(b) > len(a):
        raise ValueError(f"facing_fix {pose}: {len(b)} pieces > {len(a)} before")
    if sum(1 for s in b if s < SPECK) > sum(1 for s in a if s < SPECK):
        raise ValueError(f"facing_fix {pose}: a new speck under {SPECK} px")


def apply(cells: dict[str, np.ndarray], meta: dict) -> tuple[dict[str, np.ndarray], dict[str, np.ndarray]]:
    """(cells with every facing_fix applied, {pose: reflected head mask})."""
    out, masks = dict(cells), {}
    for f in entries(meta):
        p = f["pose"]
        if f["mirror"] == "figure":
            out[p] = mirror_figure(out[p])
        else:
            out[p], masks[p] = mirror_head(out[p], f, p)
    return out, masks


def swap_side(name: str) -> str:
    """`uarm_n` <-> `uarm_f`, `hand_n` <-> `hand_f`, ...; other names unchanged."""
    if name.endswith("_n"):
        return name[:-2] + "_f"
    if name.endswith("_f"):
        return name[:-2] + "_n"
    return name


def swap_z(z: list[str]) -> list[str]:
    """A draw order with n and f exchanged: on a mirrored keyframe the labels follow the screen side, so the limb that
    is in front of the torso in the approved pixels (now labelled f) keeps its place in front."""
    # pass CB: `weapon_f` (the far hand's own weapon) has no `_n` twin, and puppet.load_cfg refuses it on a mirrored key
    return [p if p == "weapon_f" else swap_side(p) for p in z]


def mirror_joints(joints: dict, s: int) -> dict:
    """A figure-mirrored keyframe's joints: x' = s - x, then n <-> f (n stays the screen-left limb)."""
    out = {}
    for k, v in joints.items():
        if isinstance(v, (tuple, list)) and len(v) == 2 and all(isinstance(c, (int, float)) for c in v):
            v = (float(s - v[0]), float(v[1]))
        out[k] = v
    for part in SIDED:
        n, f = f"{part}_n", f"{part}_f"
        if n in out or f in out:
            out[n], out[f] = out.get(f), out.get(n)
            for k in (n, f):
                if out[k] is None:
                    del out[k]
    if out.get("weapon_hand") in ("n", "f"):
        out["weapon_hand"] = {"n": "f", "f": "n"}[out["weapon_hand"]]
    return out
