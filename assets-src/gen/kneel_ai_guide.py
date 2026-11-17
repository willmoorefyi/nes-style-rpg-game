"""D-KA1 / D-KA2 pose-only guides and the reference canvas (docs/KNEEL_AI_PLAN.md 3, 4; 0 calls).

- Targets: `kneel_templates.targets` on the idle joints (biped, quadruped; mechanical = the preset's turns plus its
  slump), and for the other bodies the idle joints mapped by the KNEEL_PLAN 4 band op about the base (BAND_OPS).
- G-sil: every present rig part as a filled capsule along its target bone, radius = the part's radius x the idle's
  measured thickness (per part, from its idle area); the head a disc, a prop a 2-native-px bar; flat #808080 on the key.
- G-skel: the same capsules stroked black on the key (Sketch / Structure).
- Canvas: k = floor(1024 / max(w, h)); the cell's window {x0, y0, w: k*w, h: k*h, k} centred on a 1024 key canvas,
  written to guide.json (the cut reads it, D-KA6.2). The reference is the idle upscaled by k (nearest) in that window.
Only the idle's alpha and joints shape a guide, never its colours (selftest: recoloured idle, identical guide).
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

from gen import kneel_ai_data as D

SIL, INK = (128, 128, 128), (0, 0, 0)
# (sx, sy) about the base centre / foot row (KNEEL_PLAN 4): the joints of the bodies without a kneel template
BAND_OPS = {"blob": (1.12, 0.80), "serpent": (1.0, 0.60), "naga": (1.0, 0.75), "arthropod": (1.05, 0.70),
            "bird": (1.0, 0.70), "rooted": (1.0, 0.88), "floating": (1.0, 0.90), "swimmer": (1.0, 0.90)}
WEAPON_RE = re.compile(r"weapon|sword|axe|club|spear|staff|dagger|blade|mace|hammer|scythe|trident|whip|bow|rod")


def k_of(cell: tuple[int, int]) -> int:
    return D.CANVAS // max(cell)


def window(cell: tuple[int, int]) -> dict:
    k = k_of(cell)
    return {"x0": (D.CANVAS - k * cell[0]) // 2, "y0": (D.CANVAS - k * cell[1]) // 2, "w": k * cell[0],
            "h": k * cell[1], "k": k}


def targets(sp: D.Sprite) -> dict[str, tuple[float, float]]:
    """Native target joints of the kneel pose (every idle joint; untouched ones stay put)."""
    from gen import kneel_templates as KT
    rig, S = sp.rig, sp.rig.keyframes["idle"]
    body = rig.body
    if sp.category == "mechanical":
        tpl = KT.template(body, "mechanical")
        T = KT.fk(rig, S, 0.0, tpl)
        legs = {j for h, k, f in rig.limbs for j in (h, k, f)}
        dy = tpl.get("slump", 0.0) * D.height(sp.idle)
        return {**S, **{j: (x, y + (0 if j in legs else dy)) for j, (x, y) in T.items()}}
    if body in KT.TEMPLATES:
        return {**S, **KT.targets(rig, KT.template(body), S)}
    sx, sy = BAND_OPS[sp.category if sp.category in BAND_OPS else body]
    cx = D.base_cx(sp.idle[..., 3] > 0, D.base_rows(D.height(sp.idle)), sp.floating)
    fy = sp.foot_row
    return {j: (cx + (x + 0.5 - cx) * sx - 0.5, fy - (fy - y) * sy) for j, (x, y) in S.items()}


def head_parts(rig) -> list[str]:
    return [n for n in rig.parts if n.startswith("head") or n in ("skull", "face")]


def prop_parts(rig) -> list[str]:
    return [n for n, p in rig.parts.items() if p.get("kind") == "prop" or WEAPON_RE.search(n)]


def radii(sp: D.Sprite) -> dict[str, float]:
    """Per part: the capsule radius (native px) solved from the part's idle pixel area and bone length, clipped to
    [0.5, 3] x the rig radius; parts with < 4 px get the rig radius x the median ratio."""
    from gen import rig as R
    rig = sp.rig
    lab, names = R.segment(rig, "idle", sp.idle)
    S, out = rig.keyframes["idle"], {}
    for i, n in enumerate(names):
        area, js = int((lab == i).sum()), rig.joints_of(n, "idle")
        if area < 4 or not rig.present(n, "idle"):
            continue
        L = sum(float(np.hypot(S[b][0] - S[a][0], S[b][1] - S[a][1])) for a, b in zip(js, js[1:]))
        r = (-2 * L + np.sqrt(4 * L * L + 4 * np.pi * area)) / (2 * np.pi)
        out[n] = float(np.clip(r / max(rig.parts[n]["radius"], 0.5), 0.5, 3.0))
    f = float(np.median(list(out.values()))) if out else 1.0
    return {n: max(1.0, p["radius"] * out.get(n, f)) for n, p in rig.parts.items()}


def thickness(sp: D.Sprite) -> float:
    """The median ratio of the solved capsule radius to the rig radius (reported in guide.json)."""
    rs = radii(sp)
    return float(np.median([rs[n] / max(p["radius"], 0.5) for n, p in sp.rig.parts.items()]))


def capsules(sp: D.Sprite, T: dict) -> list[tuple[list[tuple[float, float]], float]]:
    """(polyline in native px, radius in native px) per drawn part; heads are a one-point disc."""
    rig, rs = sp.rig, radii(sp)
    heads, props, out = set(head_parts(rig)), set(prop_parts(rig)), []
    for n in rig.z_for("idle"):
        p = rig.parts[n]
        if not rig.present(n, "idle") or p.get("kind") == "fx" or (sp.category == "blob" and n == "body"):
            continue
        pts = [tuple(T.get(j, rig.keyframes["idle"][j])) for j in rig.joints_of(n, "idle")]
        r = rs[n]
        if n in props:
            out.append((pts, 1.0))
        elif n in heads:
            L = float(np.hypot(pts[-1][0] - pts[0][0], pts[-1][1] - pts[0][1]))
            mid = (sum(q[0] for q in pts) / len(pts), sum(q[1] for q in pts) / len(pts))
            out.append(([mid], max(r, 0.45 * L)))
        else:
            out.append((pts, r))
    if sp.category == "blob":                    # the blob body: a low dome, sx / sy of the idle's extent (KNEEL_PLAN 4)
        ys, xs = np.nonzero(sp.idle[..., 3] > 0)
        sx, sy = BAND_OPS["blob"]
        cx = D.base_cx(sp.idle[..., 3] > 0, D.base_rows(D.height(sp.idle)), False)
        out.append(([(cx - 0.5, sp.foot_row + 0.5)], (0.5 * (xs.max() - xs.min() + 1) * sx, D.height(sp.idle) * sy)))
    return out


def _dist(xs: np.ndarray, ys: np.ndarray, pts: list, r) -> np.ndarray:
    """Distance in units where the part's edge is at r (r is a radius, or (rx, ry) for the blob dome)."""
    if isinstance(r, tuple):
        return np.hypot((xs - pts[0][0]) / r[0], (ys - pts[0][1]) / r[1]) * min(r)
    if len(pts) == 1:
        return np.hypot(xs - pts[0][0], ys - pts[0][1])
    d = np.full(xs.shape, np.inf)
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        vx, vy = bx - ax, by - ay
        t = np.clip(((xs - ax) * vx + (ys - ay) * vy) / max(vx * vx + vy * vy, 1e-9), 0, 1)
        d = np.minimum(d, np.hypot(xs - ax - t * vx, ys - ay - t * vy))
    return d


def draw(sp: D.Sprite, T: dict, win: dict, form: str) -> Image.Image:
    """The G-sil (form 'sil') or G-skel ('skel') canvas."""
    k, x0, y0 = win["k"], win["x0"], win["y0"]
    can = np.zeros((D.CANVAS, D.CANVAS, 3), np.uint8)
    can[:] = sp.key_rgb
    stroke, ground = max(2, k // 3), y0 + k * (sp.foot_row + 1)          # nothing is drawn below the foot row
    for pts, r in capsules(sp, T):
        P = [(x0 + k * (x + 0.5), y0 + k * (y + 0.5)) for x, y in pts]
        R = k * (min(r) if isinstance(r, tuple) else r)
        ext = k * max(r) if isinstance(r, tuple) else R
        lo_x, hi_x = int(max(0, min(q[0] for q in P) - ext - 1)), int(min(D.CANVAS, max(q[0] for q in P) + ext + 2))
        lo_y, hi_y = int(max(0, min(q[1] for q in P) - ext - 1)), int(min(ground, max(q[1] for q in P) + ext + 2))
        if lo_x >= hi_x or lo_y >= hi_y:
            continue
        ys, xs = np.mgrid[lo_y:hi_y, lo_x:hi_x] + 0.5
        d = _dist(xs, ys, P, tuple(k * v for v in r) if isinstance(r, tuple) else R)
        sub = can[lo_y:hi_y, lo_x:hi_x]
        if form == "sil":
            sub[d <= R] = SIL
        else:
            sub[(d <= R) & (d > R - stroke)] = INK
    return Image.fromarray(can, "RGB")


def place(sp: D.Sprite, cell_img: np.ndarray, win: dict, dx: int = 0, dy: int = 0) -> Image.Image:
    """`cell_img` (native RGBA) upscaled by k (nearest) onto the key canvas at the window (+ dx, dy canvas px)."""
    can = Image.new("RGB", (D.CANVAS, D.CANVAS), sp.key_rgb)
    up = Image.fromarray(cell_img, "RGBA").resize((win["w"], win["h"]), Image.Resampling.NEAREST)
    can.paste(up, (win["x0"] + dx, win["y0"] + dy), up)
    return can


def sha(img: Image.Image) -> str:
    return hashlib.sha256(np.asarray(img).tobytes()).hexdigest()[:16]


DERIVED_PY = r"""
import sys, tempfile
from pathlib import Path
root, sid, out = sys.argv[1], sys.argv[2], sys.argv[3]
sys.path.insert(0, root)
from gen import monster_anim as MA
if (MA.RIGS / f"{sid}.yaml").exists():
    with tempfile.TemporaryDirectory() as t:
        (Path(t) / sid).symlink_to(MA.APPROVED / sid)
        MA.APPROVED = Path(t)
        e = [x for x in MA.load_entries() if x[0] == sid]
    if not e or "kneel" not in e[0][2]:
        sys.exit(f"{sid}: no derived kneel key in {root}")
    e[0][2]["kneel"].save(out)
else:
    from gen import puppet_kneel as PK
    fr = PK.kneel_frames(sid)
    if not fr:
        sys.exit(f"{sid}: no hero kneel block in {root}")
    fr["kneel"].save(out)
"""


def derived(sid: str, root: Path | None = None) -> np.ndarray | None:
    """The derived kneel key of `sid` rendered (read-only) from the checkout at `root` (default: this one)."""
    root = (root or D.HERE.parent.parent) / "assets-src"
    with tempfile.TemporaryDirectory() as t:
        out = Path(t) / "k.png"
        r = subprocess.run([sys.executable, "-I", "-c", DERIVED_PY, str(root), sid, str(out)], capture_output=True,
                           text=True)
        if r.returncode != 0:
            print(f"derived {sid}: {r.stderr.strip().splitlines()[-1] if r.stderr.strip() else 'none'}")
            return None
        return np.asarray(Image.open(out).convert("RGBA")).copy()


def build(sp: D.Sprite, out: Path | None = None, derived_img: np.ndarray | None = None) -> dict:
    """Write guide_sil.png, guide_skel.png, reference.png (+ derived.png) and guide.json; return the json."""
    out = out or D.OUT / sp.sid
    out.mkdir(parents=True, exist_ok=True)
    win, T = window(sp.cell), targets(sp)
    imgs = {"sil": draw(sp, T, win, "sil"), "skel": draw(sp, T, win, "skel"), "ref": place(sp, sp.idle, win)}
    if derived_img is not None:
        imgs["derived"] = place(sp, derived_img, win)
        Image.fromarray(derived_img, "RGBA").save(out / "derived_native.png")
    names = {"sil": "guide_sil.png", "skel": "guide_skel.png", "ref": "reference.png", "derived": "derived.png"}
    for key, im in imgs.items():
        im.save(out / names[key])
    g = {"sid": sp.sid, "hero": sp.hero, "category": sp.category, "key": sp.key_name, "key_rgb": list(sp.key_rgb),
         "cell": list(sp.cell), "window": win, "foot_row": sp.foot_row, "bottom_row": sp.bottom,
         "floating": sp.floating, "band_px": list(sp.band_px), "thickness": round(thickness(sp), 4),
         "targets": {j: [round(x, 2), round(y, 2)] for j, (x, y) in sorted(T.items())},
         "files": {k: names[k] for k in imgs}, "sha": {k: sha(v) for k, v in imgs.items()}}
    (out / "guide.json").write_text(json.dumps(g, indent=1) + "\n")
    return g
