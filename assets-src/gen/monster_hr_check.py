"""EF-G G2 helpers for gen/monster_hr_puppet.py: the agent's checks on a posed image (margin, feet row, joint tears,
IoU with the idle under its pass's bar), amendment A's measures (the prop's and the chest's world angles from
vertical, + = forward / toward the right, composed through the puppet's world transforms; the body height = the alpha
bbox height without the props) with the EF5 targets, and the review overlay (part outlines, pivots, cloth pins, mesh)."""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw

from gen import monster_hr_prep as P
from gen import monster_hr_warp as W

COLOURS = [(255, 80, 80), (80, 220, 80), (90, 140, 255), (255, 210, 60), (230, 90, 230), (60, 220, 220),
           (255, 150, 60), (170, 120, 255), (200, 255, 120), (255, 255, 255)]

IOU_BARS = {"EF4": {}, "EF5": {"attack": 0.70, "hurt": 0.70, "kneel": 0.65}}   # EF4: 0.80 for every pose


def base_pose(name: str) -> str:
    """`attack_ef4` / `hurt_r2` -> `attack` / `hurt` (a superseded recipe keeps its pose's name before the suffix)."""
    return name.split("_")[0]


def iou_bar(pass_: str, name: str) -> float:
    return IOU_BARS.get(pass_, {}).get(base_pose(name), 0.80)


def rot_deg(m: np.ndarray) -> float:
    return math.degrees(math.atan2(m[1, 0], m[0, 0]))


def axis_deg(mask: np.ndarray) -> float:
    """A prop's principal axis from vertical in degrees, + = its top toward the right."""
    ys, xs = np.where(mask)
    if len(xs) < 2:
        return 0.0
    c = np.cov(np.c_[xs - xs.mean(), ys - ys.mean()].T)
    vx, vy = np.linalg.eigh(c)[1][:, -1]
    if vy > 0:
        vx, vy = -vx, -vy
    return round(math.degrees(math.atan2(vx, -vy)), 1) + 0.0


def measures(wl: dict, parts: list[dict], alpha: np.ndarray, prop: np.ndarray, prop_master: np.ndarray,
             names: dict | None = None) -> dict:
    """`alpha` / `prop`: the posed figure's and its prop's masks; `prop_master`: the prop on the master."""
    names = {"prop": "staff", "chest": "chest", **(names or {})}
    have = {p["name"] for p in parts}
    out = {}
    if names["chest"] in have:
        out["chest_deg"] = round(rot_deg(wl[names["chest"]]), 1) + 0.0
    if names["prop"] in have:
        idle = axis_deg(prop_master)
        out[f"{names['prop']}_idle_deg"] = idle
        out[f"{names['prop']}_deg"] = round(idle + rot_deg(wl[names["prop"]]), 1) + 0.0
    ys = np.where((alpha & ~prop).any(1))[0]
    out["body_h"] = int(ys.max() - ys.min() + 1) if len(ys) else 0
    return out


def targets(pass_: str, name: str, m: dict, idle_body_h: int, prop: str = "staff") -> dict:
    """Amendment A1's EF5 targets (none for EF4 recipes)."""
    if pass_ != "EF5":
        return {}
    d = m.get(f"{prop}_deg", 0) - m.get(f"{prop}_idle_deg", 0)
    pose = base_pose(name)
    if pose == "attack":
        return {"staff_swing": d >= 50, "chest_fwd": m.get("chest_deg", 0) >= 15}
    if pose == "hurt":
        return {"chest_back": m.get("chest_deg", 0) <= -20, "staff_away": d <= -15}
    if pose == "kneel":
        return {"body_low": m["body_h"] <= 0.70 * idle_body_h}
    return {}


def checks(img: Image.Image, master: Image.Image, joints: list | None = None, open_: list | None = None,
           bar: float = 0.80) -> dict:
    a = np.asarray(img)[..., 3] > 0
    m = np.asarray(master)[..., 3] > 0
    ys, xs = np.where(a)
    margin = int(min(xs.min(), ys.min(), P.SIDE - 1 - xs.max(), P.SIDE - 1 - ys.max()))
    enclosed = ~a & ~P.flood(~a, P.border_seeds(P.SIDE, P.SIDE))
    from gen import pixelize as PX
    lab, n = PX.components(enclosed[::2, ::2])
    yy, xx = np.mgrid[:P.SIDE // 2, :P.SIDE // 2]
    near = np.zeros(lab.shape, bool)                  # a tear: an enclosed gap within 60 px of a moved joint
    for px, py in joints or []:
        near |= (xx * 2 - px) ** 2 + (yy * 2 - py) ** 2 <= 60 ** 2
    for x0, y0, x1, y1 in open_ or []:                # declared natural windows (between a limb, a prop and the body)
        near[y0 // 2:y1 // 2, x0 // 2:x1 // 2] = False
    sizes = np.bincount(lab.ravel(), minlength=n + 1)
    tears = sorted((int(sizes[i]) * 4 for i in np.unique(lab[near & (lab > 0)]) if sizes[i] * 4 > 50), reverse=True)
    iou = float((a & m).sum() / max(1, (a | m).sum()))
    info = {"margin": margin, "feet": int(ys.max()), "joint_tears": tears[:6], "hole_px": int(enclosed.sum()),
            "iou_idle": round(iou, 3)}
    info["ok"] = {"margin": margin >= 16, "feet": abs(int(ys.max()) - P.FEET) <= 4, "iou": iou <= bar,
                  "tears": not tears}
    return info


def overlay(img: Image.Image, layers: dict, order: list, meshes: list, pivots: list) -> Image.Image:
    base = Image.new("RGBA", img.size, (30, 30, 34, 255))
    dim = img.copy()
    dim.putalpha(Image.fromarray((np.asarray(img)[..., 3] * 0.55).astype(np.uint8)))
    base.alpha_composite(dim)
    d = ImageDraw.Draw(base)
    for k, n in enumerate(order):
        m = np.asarray(layers[n])[..., 3] > 0
        edge = m & ~(W.shift(m, 1, 0) & W.shift(m, -1, 0) & W.shift(m, 0, 1) & W.shift(m, 0, -1))
        ys, xs = np.where(edge)
        c = COLOURS[k % len(COLOURS)]
        for x, y in zip(xs[::2], ys[::2]):
            d.point((int(x), int(y)), fill=c)
        if len(xs):
            d.text((int(xs.min()), int(ys.min())), n, fill=c)
    for n, src, dst in meshes:
        x0, y0 = dst.min(0) - 20
        x1, y1 = dst.max(0) + 20
        for line in W.mesh_lines(None, (int(x0), int(y0), int(x1), int(y1))):
            d.line(line, fill=(90, 90, 110), width=1)
        for s, t in zip(src, dst):
            d.line([tuple(s), tuple(t)], fill=(255, 255, 0), width=1)
            d.ellipse([t[0] - 3, t[1] - 3, t[0] + 3, t[1] + 3], outline=(255, 255, 0))
    for x, y in pivots:
        d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(255, 40, 40), outline=(255, 255, 255))
    return base


