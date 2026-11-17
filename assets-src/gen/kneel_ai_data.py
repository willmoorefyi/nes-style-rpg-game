"""Pass KA sprite data (docs/KNEEL_AI_PLAN.md 3-6): one `Sprite` per monster sheet (the 123 rigs) or hero class (12),
with its approved keys (the build's keys: monster_keys.apply, FW-H, the boss padding), feet / foot row, body category,
band, key colour (D-KA1), the approved palette (D-KA6.5) and the calibration exclusion (section 6). Offline only.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass
from functools import cached_property
from pathlib import Path

import numpy as np
import yaml
from PIL import Image

HERE = Path(__file__).resolve().parent
APPROVED = HERE / "approved"
RIGS = HERE / "anim" / "monsters"
HEROES = HERE / "anim"
OUT = HERE / "out" / "kneel_ai"
CONF = HERE / "kneel_ai.yaml"
THRESH = HERE / "kneel_ai_thresholds.json"
MAGENTA, WHITE = (255, 0, 255), (255, 255, 255)
KEY_DE = 30.0                                   # D-KA1: a palette colour this close to magenta makes the key white
CANVAS = 1024
# section 4 / KNEEL_PLAN 4 bands (kneel / idle opaque height) for the bodies without a kneel template
BANDS = {"bird": (0.60, 0.85), "floating": (0.86, 0.95), "swimmer": (0.86, 0.95), "serpent": (0.55, 0.85),
         "rooted": (0.80, 0.95), "naga": (0.65, 0.85), "arthropod": (0.60, 0.85), "blob": (0.75, 0.85)}
SWIMMERS = ("shark", "red_piranha", "white_shark")       # 5b: the swimmer pose text


def monsters() -> list[str]:
    return sorted(p.stem for p in RIGS.glob("*.yaml"))


def heroes() -> list[str]:
    return sorted(p.stem for p in HEROES.glob("*.yaml"))


def conf() -> dict:
    return (yaml.safe_load(CONF.read_text()) or {}) if CONF.exists() else {}


def rgb2lab(rgb: np.ndarray) -> np.ndarray:
    """sRGB (..., 3) uint8 -> CIE Lab (D65)."""
    c = np.asarray(rgb, np.float64) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.2126, 0.0193], [0.3576, 0.7152, 0.1192], [0.1805, 0.0722, 0.9505]])
    xyz = (c[..., :, None] * m).sum(-2)              # not `@`: numpy's BLAS matmul warns spuriously here
    xyz /= np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def opaque_rows(a: np.ndarray) -> np.ndarray:
    return np.nonzero((a[..., 3] > 0).any(1))[0]


def height(a: np.ndarray) -> int:
    r = opaque_rows(a)
    return int(r.max() - r.min() + 1) if len(r) else 0


def base_rows(h: int) -> int:
    """The base band (native rows above the foot row) used for the base centroid."""
    return max(2, int(round(0.12 * h)))


def base_cx(mask: np.ndarray, rows: int, floating: bool) -> float:
    """Mean x (pixel centres) of the figure's lowest `rows` rows (floaters: the whole figure)."""
    ys, xs = np.nonzero(mask)
    if not len(ys):
        return 0.0
    sel = np.ones(len(ys), bool) if floating else ys > ys.max() - rows
    return float(xs[sel].mean() + 0.5)


def _monster_entry(sid: str) -> tuple[dict, dict[str, Image.Image]]:
    """(meta, keys) of one monster as monster_anim.load_entries builds them (without the derived kneel)."""
    from gen import monster_anim as MA
    from gen import monster_keys as MK
    metas = sorted(APPROVED.glob(f"{sid}/monster_*.json"))
    cfg = MA.load_rig(sid)
    if metas:
        meta = json.loads(metas[0].read_text())
        sheet = Image.open(metas[0].with_suffix(".png")).convert("RGBA")
        cw, ch = meta["grid"]
        frames = [sheet.crop((i * cw, 0, (i + 1) * cw, ch)) for i in range(3)]
        for i in meta.get("flip_frames", []):
            frames[i] = frames[i].transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        kfs = dict(zip(meta["poses"], frames))
    else:
        derive = MK.hurt_from(sid, cfg)
        poses = [p for p in ("idle", "attack", "hurt", "cast", "attack_raise")
                 if (APPROVED / sid / f"boss_{p}.json").exists()]
        kfs, metas_ = {}, []
        for p in poses:
            m = json.loads((APPROVED / sid / f"boss_{p}.json").read_text())
            f = Image.open(APPROVED / sid / f"boss_{p}.png").convert("RGBA")
            kfs[p] = f.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if 0 in m.get("flip_frames", []) else f
            metas_.append(m)
        kfs, meta = MA.pad_keyframes(kfs, {**metas_[0], "poses": poses})
        if derive:
            kfs["hurt"] = kfs[derive].copy()
            meta = {**meta, "kf_derived": {"hurt": derive}}
    return MK.apply(sid, cfg, meta, kfs) if cfg else (meta, kfs)


@dataclass
class Sprite:
    sid: str
    hero: bool
    meta: dict
    cfg: dict
    keys: dict

    @property
    def idle(self) -> np.ndarray:
        return self.keys["idle"]

    @property
    def cell(self) -> tuple[int, int]:
        return self.idle.shape[1], self.idle.shape[0]

    @property
    def bottom(self) -> int:
        return int(self.meta["bottom_row"])

    @cached_property
    def rig(self):
        from gen import rig as R
        if not self.hero:
            return R.Rig(self.cfg, self.cell)
        ready = {k: [float(v[0]), float(v[1])] for k, v in self.cfg["battle"]["ready"].items()
                 if isinstance(v, (list, tuple))}
        return R.Rig({"sprite": self.sid, "body": "biped", "facing": "left", "keyframes": {"idle": ready},
                      "weapon_hand": self.cfg["battle"]["ready"].get("weapon_hand", "n")}, self.cell)

    @property
    def floating(self) -> bool:
        return not self.hero and (bool(self.meta.get("floating")) or self.rig.floating)

    @property
    def foot_row(self) -> int:
        """D-KA6.7: the idle's bottom_row (grounded) or its lowest opaque row (floaters, swimmers)."""
        return int(opaque_rows(self.idle).max()) if self.floating else self.bottom

    @property
    def category(self) -> str:
        """The 5b pose row: mechanical, robed, swimmer or the rig body (heroes: biped / robed)."""
        if self.hero:
            return "robed" if self.cfg.get("robed") else "biped"
        if self.cfg.get("preset") == "mechanical" or self.sid == "guardian":
            return "mechanical"
        if self.sid in SWIMMERS:
            return "swimmer"
        sprite = (conf().get("sprites") or {}).get(self.sid) or {}
        body = self.cfg.get("body", "biped")
        return "robed" if sprite.get("robed") and body == "biped" else body

    @cached_property
    def palette(self) -> np.ndarray:
        """N x 3 uint8: the approved keys' colours plus the outline ink (monster_keys.approved_palette)."""
        from gen import monster_keys as MK
        ims = {k: Image.fromarray(v) for k, v in self.keys.items() if k != "kneel"}
        return np.array(sorted(MK.approved_palette(ims)), np.uint8)

    @property
    def key_rgb(self) -> tuple[int, int, int]:
        de = np.linalg.norm(rgb2lab(self.palette) - rgb2lab(np.array([MAGENTA]))[0], axis=1)
        return WHITE if float(de.min()) < KEY_DE else MAGENTA

    @property
    def key_name(self) -> str:
        return "white" if self.key_rgb == WHITE else "magenta"

    @property
    def band(self) -> tuple[float, float]:
        """The kneel / idle height band (heroes: the class band in px divided by the ready height)."""
        lo, hi = self.band_px
        h = height(self.idle)
        return lo / h, hi / h

    @property
    def band_px(self) -> tuple[int, int]:
        h = height(self.idle)
        if self.hero:
            from gen import puppet_kneel as PK
            frames = {k: Image.fromarray(v) for k, v in self.keys.items()}
            frames["ready"] = frames["idle"]
            return PK.band_of(self.sid, self.cfg, frames)[0]
        from gen import kneel_templates as KT
        body = self.cfg.get("body", "biped")
        if body in KT.TEMPLATES:
            var = (self.cfg.get("kneel") or {}).get("variant") if isinstance(self.cfg.get("kneel"), dict) else None
            lo, hi = KT.template(body, self.cfg.get("preset"), var, self.sid)["band"]
        else:
            lo, hi = BANDS[body]
        return math.ceil(lo * h - 1e-9), math.floor(hi * h + 1e-9)

    @property
    def excluded(self) -> str | None:
        """Why this sprite's hurt key is not approved art (section 6 calibration), or None."""
        from gen import monster_anim as MA
        if self.hero:
            return None
        if ("hurt" in MA.aliased(self.sid, self.cfg)[0]) if self.cfg else False:
            return "FW-Q alias"
        if "hurt" in (self.meta.get("kf_derived") or {}):
            return "FW-H hurt_from"
        if "hurt" in (self.meta.get("kf_painted") or []):
            return "keyframe paint"
        if "hurt" in (self.meta.get("kf_offset") or []):
            return "key_offset"
        return None

    @property
    def keep_all(self) -> bool:
        """monsters.yaml `cut: {keep_pieces: all_in_cell}`: the cut keeps every piece (A-pieces allows one more)."""
        e = {} if self.hero else next((m for m in yaml.safe_load((HERE / "monsters.yaml").read_text())
                                       if m.get("id") == self.sid), {})
        return (e.get("cut") or {}).get("keep_pieces") == "all_in_cell"

    @property
    def subject(self) -> str:
        if self.hero:
            c = next(e for e in yaml.safe_load((HERE / "characters.yaml").read_text()) if e["id"] == self.sid)
            return f"{c['prompt'].strip()}, {c.get('battle_gear', '').strip()}".strip(", ")
        mons = yaml.safe_load((HERE / "monsters.yaml").read_text())
        e = next((m for m in mons if m.get("id") == self.sid), None)
        return " ".join(str((e or {}).get("prompt", self.sid.replace("_", " "))).split())


def load(sid: str) -> Sprite:
    from gen import monster_anim as MA
    from gen import puppet as PU
    if (RIGS / f"{sid}.yaml").exists():
        meta, kfs = _monster_entry(sid)
        return Sprite(sid, False, meta, MA.load_rig(sid) or {},
                      {k: np.asarray(v.convert("RGBA")).copy() for k, v in kfs.items()})
    if (HEROES / f"{sid}.yaml").exists():
        fr = PU.battle_sheet_frames(sid)
        keys = {("idle" if k == "ready" else k): np.asarray(v.convert("RGBA")).copy() for k, v in fr.items()}
        return Sprite(sid, True, json.loads((APPROVED / sid / "battle.json").read_text()), PU.load_cfg(sid) or {},
                      keys)
    raise SystemExit(f"{sid}: no monster rig or hero class of that name")
