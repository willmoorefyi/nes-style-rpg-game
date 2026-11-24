"""EF-D (docs/ENEMY_FEEDBACK_PLAN.md): orbiting idle orbs. A rig option `orbit` cuts small round parts (chaos's four
element orbs) out of the idle key and idle_b, and writes `idle_o<k>` / `idle_b_o<k>` for k in 0..steps-1, each orb at
angle a0 + 360 * k / steps on an ellipse, drawn behind the `behind` parts on the far half (sin(angle) < 0) and in front
on the near half. No AI and no resampling: an orb keeps its own pixels and moves by whole px.

  orbit:
    steps: 16                       # N, 8..16 (the runtime advances k every ORBIT_STEP_FRAMES)
    centre: [100, 27]               # ellipse centre (cell px, idle; idle_b adds its breath dy above the breath row)
    rx: 30                          # semi-axes (px)
    ry: 9
    behind: [head]                  # rig parts an orb on the far half passes behind
    parts:                          # one entry per orb, in the idle key: a circle and, where an orb touches the
      white: {at: [72.5, 40.5], r: 8.5, a0: 180}               # figure, its own colours (outline included)
      pale: {at: [100, 13], r: 8, a0: 270, colors: [[6, 4, 10], [66, 132, 148], [231, 239, 222]]}

The cut leaves a clean base (the idle without orbs): every cut pixel 4-next to a remaining non-outline pixel of the
figure becomes outline ink (`seal`), so a flame tip the orb covered is closed. Frames whose orbs would leave the cell,
touch its 1 px border or reach above the idle key's opaque top raise a ValueError naming the rig. Checks (frame_checks
for `orbit` frames, sequence_checks): alpha, palette, magenta, clipping; at most 1 + orbs pieces and none under 12 px;
every pixel outside the drawn orbs equals the clean base (the continuity exemption covers the orb pixels only); each
orb shows at least MIN_VISIBLE of itself; an orb moves at most the ellipse chord of one step (+1 px) per step.
"""
from __future__ import annotations

import math

import numpy as np

from gen import anim_checks as C
from gen.monster_recipes import ORBIT_MAX, orbit_names as names  # noqa: F401  (re-exported)

STEPS = (8, ORBIT_MAX)          # allowed N
MIN_VISIBLE = 0.25              # share of an orb's pixels shown at the far point (behind the head)
SEAL_CAP = 60                   # outline px the cut may add


def _cfg(sprite: str, cfg: dict) -> dict | None:
    o = (cfg or {}).get("orbit")
    if not o:
        return None
    n = int(o.get("steps", 0))
    if not STEPS[0] <= n <= STEPS[1]:
        raise ValueError(f"rig {sprite}: orbit steps {n} outside {STEPS[0]}..{STEPS[1]}")
    if not o.get("parts"):
        raise ValueError(f"rig {sprite}: orbit without parts")
    return o


def _orb_masks(a: np.ndarray, o: dict, dy: int, cut: int) -> dict[str, np.ndarray]:
    h, w = a.shape[:2]
    yy, xx = np.mgrid[:h, :w]
    solid = a[..., 3] > 0
    out = {}
    for name, p in o["parts"].items():
        cx, cy = float(p["at"][0]), float(p["at"][1])
        cy += dy if cy < cut else 0
        m = solid & ((xx - cx) ** 2 + (yy - cy) ** 2 <= float(p["r"]) ** 2)
        if p.get("colors"):
            cols = {tuple(int(v) for v in c) for c in p["colors"]}
            m &= np.array([tuple(int(v) for v in px) in cols for px in a[..., :3].reshape(-1, 3)]).reshape(h, w)
        out[name] = m
    return out


def clean(a: np.ndarray, masks: dict[str, np.ndarray]) -> tuple[np.ndarray, int]:
    """(the frame without the orbs, sealed px): cut pixels 4-next to a kept non-outline pixel become outline."""
    cut = np.zeros(a.shape[:2], bool)
    for m in masks.values():
        cut |= m
    base = a.copy()
    base[cut] = 0
    kept = (base[..., 3] > 0) & ~np.all(base[..., :3] == C.OUTLINE, axis=2)
    near = np.zeros_like(kept)
    near[1:] |= kept[:-1]; near[:-1] |= kept[1:]; near[:, 1:] |= kept[:, :-1]; near[:, :-1] |= kept[:, 1:]
    seal = cut & near
    base[seal] = (*C.OUTLINE, 255)
    return base, int(seal.sum())


def _place(o: dict, name: str, k: int, n: int, dy: int) -> tuple[float, float, float]:
    """(x, y, sin) of orb `name` at step k on the ellipse (dy: idle_b's breath)."""
    ang = math.radians(float(o["parts"][name].get("a0", 0))) + 2 * math.pi * k / n
    cx, cy = o["centre"]
    return float(cx) + float(o["rx"]) * math.cos(ang), float(cy) + dy + float(o["ry"]) * math.sin(ang), math.sin(ang)


def _round(v: float) -> int:
    return int(math.floor(v + 0.5))


def frames(sprite: str, cfg: dict, rig, idle: np.ndarray, idle_b: np.ndarray | None, b_dy: int, behind_of) \
        -> dict[str, dict]:
    """The orbit frames {name: {img, orbit info}} of a rig with `orbit`, else {}. `behind_of(base)`: the pixels of the
    parts an orb passes behind in the clean idle (bool mask; monster_anim segments it with the rig); idle_b takes it
    moved by its breath."""
    o = _cfg(sprite, cfg)
    if not o:
        return {}
    n = int(o["steps"])
    cut = int(round(rig.keyframes["idle"][rig.breath][1]))
    top = int(np.nonzero((idle[..., 3] > 0).any(1))[0][0])
    out: dict[str, dict] = {}
    behind = None
    for prefix, src, dy in (("idle_o", idle, 0), ("idle_b_o", idle_b, b_dy)):
        if src is None:
            continue
        masks = _orb_masks(src, o, dy, cut)
        base, sealed = clean(src, masks)
        if behind is None:
            behind = behind_of(base)
        back = behind if not dy else _shift_rows(behind, dy, cut)
        for k in range(n):
            img, drawn, info = base.copy(), {}, {}
            order = sorted(masks, key=lambda nm: _place(o, nm, k, n, dy)[2])        # far (sin < 0) first
            for nm in order:
                x, y, s = _place(o, nm, k, n, dy)
                p = o["parts"][nm]
                ax, ay = float(p["at"][0]), float(p["at"][1]) + (dy if float(p["at"][1]) < cut else 0)
                d = (_round(x - ax), _round(y - ay))
                ys, xs = np.nonzero(masks[nm])
                tx, ty = xs + d[0], ys + d[1]
                h, w = img.shape[:2]
                if tx.min() < 1 or ty.min() < 1 or tx.max() > w - 2 or ty.max() > h - 2:
                    raise ValueError(f"rig {sprite}: orbit orb {nm} leaves the cell at step {k}")
                if ty.min() < top:
                    raise ValueError(f"rig {sprite}: orbit orb {nm} reaches row {int(ty.min())} above the idle key's "
                                     f"opaque top {top} at step {k}")
                show = np.ones(len(xs), bool) if s >= 0 else ~back[ty, tx]
                img[ty[show], tx[show]] = src[ys[show], xs[show]]
                drawn[nm] = np.zeros(img.shape[:2], bool)
                drawn[nm][ty[show], tx[show]] = True
                info[nm] = {"d": d, "shown": int(show.sum()), "size": int(len(xs)), "far": s < 0}
            out[f"{prefix}{k}"] = {"img": img, "labels": None, "src": "idle", "toward": "idle", "u": 0.0, "joints": {},
                                   "rots": {}, "pinned": True, "prop_px": {}, "dy": dy, "orbit": True, "base": base,
                                   "sealed": sealed, "drawn": drawn, "orbs": info, "step": k, "steps": n,
                                   "source": src, "cut": np.any(np.stack(list(masks.values())), axis=0)}
    return out


def _shift_rows(m: np.ndarray, dy: int, cut: int) -> np.ndarray:
    """The mask's rows above `cut` moved dy down (as the breath bob moves the figure)."""
    out = m.copy()
    out[:cut] = False
    out[dy:cut + dy] |= m[:cut]
    return out


def frame_checks(name: str, f: dict, src: np.ndarray, allowed: set) -> list[str]:
    """The checks of one orbit frame (see the module docstring)."""
    a = f["img"]
    out = C.binary_alpha(a) + C.palette_lock(a, allowed) + C.magenta(a) + C.clipping(a)
    lab, n = C._components(a[..., 3] > 0)
    sizes = C._sizes(lab, n)
    if n > 1 + len(f["orbs"]):
        out.append(f"pieces {n} > 1 + {len(f['orbs'])} orbs")
    if any(s < C.MIN_PIECE for s in sizes):
        out.append(f"a piece under {C.MIN_PIECE} px ({min(sizes)} px)")
    orb = f["cut"].copy()                                 # the continuity exemption: the orb masks, cut and drawn
    for m in f["drawn"].values():
        orb |= m
    diff = np.any(a != f["source"], axis=2) & ~orb
    if diff.any():
        out.append(f"body changed outside the orb masks: {int(diff.sum())} px at {C._first(diff)}")
    if f["sealed"] > SEAL_CAP:
        out.append(f"cut sealed {f['sealed']} px > {SEAL_CAP}")
    for nm, i in f["orbs"].items():
        if i["shown"] < MIN_VISIBLE * i["size"]:
            out.append(f"orb {nm} shows {i['shown']} of {i['size']} px < {MIN_VISIBLE:.0%}")
    return out


def sequence_checks(gen: dict[str, dict], cfg: dict) -> dict[str, list[str]]:
    """{sequence:orbit: failures}: per step (k -> k + 1, wrapping) every orb moves at most the ellipse chord of one
    step + 1 px, and the bodies (orb pixels exempt) are identical within idle and within idle_b."""
    o = (cfg or {}).get("orbit")
    if not o:
        return {}
    n, fails = int(o["steps"]), []
    chord = 2 * max(float(o["rx"]), float(o["ry"])) * math.sin(math.pi / n) + 1.5
    for prefix in ("idle_o", "idle_b_o"):
        if f"{prefix}0" not in gen:
            continue
        for k in range(n):
            a, b = gen[f"{prefix}{k}"], gen[f"{prefix}{(k + 1) % n}"]
            for nm in a["orbs"]:
                (x0, y0), (x1, y1) = a["orbs"][nm]["d"], b["orbs"][nm]["d"]
                if math.hypot(x1 - x0, y1 - y0) > chord:
                    fails.append(f"{prefix}{k}->{(k + 1) % n}: orb {nm} moves {math.hypot(x1 - x0, y1 - y0):.1f} > "
                                 f"{chord:.1f}")
            if not np.array_equal(a["base"], b["base"]):
                fails.append(f"{prefix}{k}->{(k + 1) % n}: the body differs")
    return {"sequence:orbit": fails}


STEP_FRAMES = 6                 # runtime: k advances every 6 frames (enemyChoreography.ORBIT_STEP_FRAMES)
BREATH_FRAMES = 36              # idle / idle_b alternate every 36 frames (IDLE_PERIOD / 2)


def review(sprite: str, gen: dict[str, dict], out) -> list:
    """Review outputs of an orbit sheet (monster_anim.py review): `<id>_orbit.png` (the head region of every
    idle_o<k> at 4x, 4 per row), `<id>_orbit.gif` (the whole figure at 2x on the runtime timing, two turns with the
    breath) and `<id>_orbit_head.gif` (the head region at 6x, one turn of idle_o<k>). [] without orbit frames."""
    from PIL import Image
    n = sum(1 for f in gen if f.startswith("idle_o"))
    if not n:
        return []
    img = lambda nm: Image.fromarray(gen[nm]["img"], "RGBA")
    a = gen["idle_o0"]["img"]
    ys, xs = np.nonzero(np.any(np.stack([gen[f"idle_o{k}"]["img"][..., 3] > 0 for k in range(n)]), 0)[:72])
    box = (max(0, int(xs.min()) - 4), 0, min(a.shape[1], int(xs.max()) + 5), min(a.shape[0], 72))

    def on(im, k):
        bg = Image.new("RGBA", im.size, (60, 60, 70, 255))
        bg.alpha_composite(im)
        return bg.resize((im.width * k, im.height * k), Image.Resampling.NEAREST)
    tiles = [on(img(f"idle_o{k}").crop(box), 4) for k in range(n)]
    w, h = tiles[0].size
    sheet = Image.new("RGBA", (4 * (w + 4), ((n + 3) // 4) * (h + 4)), (20, 20, 24, 255))
    for k, t in enumerate(tiles):
        sheet.alpha_composite(t, ((k % 4) * (w + 4), (k // 4) * (h + 4)))
    paths = [out / f"{sprite}_orbit.png", out / f"{sprite}_orbit.gif", out / f"{sprite}_orbit_head.gif"]
    sheet.save(paths[0])
    full = []
    for t in range(0, 2 * n * STEP_FRAMES, STEP_FRAMES):
        b = (t // BREATH_FRAMES) % 2
        full.append(on(img(f"{'idle_b_o' if b else 'idle_o'}{(t // STEP_FRAMES) % n}"), 2).convert("RGB"))
    dur = round(STEP_FRAMES * 1000 / 60)
    full[0].save(paths[1], save_all=True, append_images=full[1:], duration=dur, loop=0)
    head = [on(img(f"idle_o{k}").crop(box), 6).convert("RGB") for k in range(n)]
    head[0].save(paths[2], save_all=True, append_images=head[1:], duration=dur, loop=0)
    return paths
