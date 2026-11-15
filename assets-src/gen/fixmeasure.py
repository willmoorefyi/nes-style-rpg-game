"""Fix-pass measurements (docs/ROSTER_FIX_PLAN.md 3, FW-M): every gate of the fix plan runs through this tool.

  python3 -I assets-src/gen/fixmeasure.py travel <sheet>                          # FW-A anchors (+ opaqueRight, tip)
  python3 -I assets-src/gen/fixmeasure.py partc <sprite> <part> <frame>...        # part-label centroids and steps
  python3 -I assets-src/gen/fixmeasure.py pieces <sprite> <frame>... [--box X0 Y0 X1 Y1] [--small N] [--holes N]
  python3 -I assets-src/gen/fixmeasure.py fills <sprite> <frame>... [--box ...] [--min N] [--exclude X0 Y0 X1 Y1 ...]
                                          [--rgb R,G,B ...] [--join R,G,B ... --to-part P]
  python3 -I assets-src/gen/fixmeasure.py colours <sprite> <frame>... --rgb R,G,B ... [--box ...]
  python3 -I assets-src/gen/fixmeasure.py diff <sprite> <frame>... [--part P]      # per-part pixel changes per step
  python3 -I assets-src/gen/fixmeasure.py select <sprite> <frame> [--rgb ...] [--box ...] [--component X,Y]
                                          [--holes N] [--to R,G,B | --to null]   # -> rig `paint` entries (YAML)
  every subcommand: --raw (the approved keys without keyframe paint, FW-P)

Conventions (the plan's measurement conventions): native px in the sprite's padded cell. A box is X0 Y0 X1 Y1 with X1
and Y1 exclusive (numpy slices: `--box 0 40 40 90` is x 0-39, y 40-89); reported boxes are inclusive [x0, y0, x1, y1].
A fill component is a 4-connected component of opaque pixels with the outline ink (6, 4, 10) left out; a piece is a
4-connected component of all opaque pixels; a hole is an enclosed transparent 4-connected component (whole frame,
kept when any of its pixels is in the box). Generated frames come from MA.generate, keys from MA.load_entries, and
frame names resolve through MA.resolve (keyframe-only sheets measure too; part commands need a rig).
"""
from __future__ import annotations

import contextlib
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
if str(HERE.parent) not in sys.path:                      # run as a script: make the `gen` package importable
    sys.path.insert(0, str(HERE.parent))
from gen import monster_anim as MA  # noqa: E402
from gen import fixmeasure_px as PX  # noqa: E402
from gen.fixmeasure_px import (INK, Box, _in_box, _public, _rgb_mask, colour_count, fill_components,  # noqa: E402,F401
                               fill_mask, holes, pieces_of, select)

# ───────── sprites ─────────
@contextlib.contextmanager
def _rig_override(sprite: str, rig: dict | None):
    real = MA.load_rig
    if rig is not None:
        MA.load_rig = lambda s: rig if s == sprite else real(s)
    try:
        yield
    finally:
        MA.load_rig = real


class Sprite:
    """One sprite's keys (load_entries), generated frames (generate) and part labels; `rig` overrides the rig file."""

    def __init__(self, sprite: str, rig: dict | None = None, paint: bool = True):
        with _rig_override(sprite, rig):
            found = [e for e in MA.load_entries(paint=paint) if e[0] == sprite]
            if not found:
                raise SystemExit(f"fixmeasure: no approved sprite {sprite!r} (variants: measure the base sprite)")
            self.sid, self.meta, self.kfs = found[0]
            self.cfg = MA.load_rig(sprite)
        self.gen = MA.generate(sprite, self.cfg, self.kfs, self.meta) if self.cfg else {}
        self.frames = {**{k: np.asarray(v.convert("RGBA")) for k, v in self.kfs.items()},
                       **{n: f["img"] for n, f in self.gen.items()}}
        self._rig = None

    def name(self, f: str) -> str:
        n = MA.resolve(f, self.frames)
        if n not in self.frames:
            raise SystemExit(f"fixmeasure: {self.sid} has no frame {f!r}")
        return n

    def img(self, f: str) -> np.ndarray:
        return self.frames[self.name(f)]

    def part_mask(self, f: str, part: str) -> np.ndarray:
        from gen import rig as R
        if not self.cfg:
            raise SystemExit(f"fixmeasure: {self.sid} has no rig (part commands need one)")
        self._rig = self._rig or R.Rig(self.cfg, self.kfs["idle"].size)
        n = self.name(f)
        if n in self.gen and self.gen[n]["labels"] is not None:
            names = list(self._rig.parts)
            return self.gen[n]["labels"] == names.index(part) if part in names else np.zeros(self.img(n).shape[:2], bool)
        src = self.gen[n]["src"] if n in self.gen else n      # a label-less bob frame: its source key's masks
        lab, names = R.segment(self._rig, src, self.frames[n].copy()) if src in self._rig.keyframes else (None, [])
        if part not in names:
            return np.zeros(self.img(n).shape[:2], bool)
        return lab == names.index(part)

    def labels(self, f: str) -> np.ndarray | None:
        n = self.name(f)
        return self.gen[n]["labels"] if n in self.gen else None


def _sprite(sprite: "str | Sprite", rig: dict | None, paint: bool) -> Sprite:
    """A Sprite instance passes through (callers measuring one sprite many times build it once)."""
    return sprite if isinstance(sprite, Sprite) else Sprite(sprite, rig, paint)


def partc(sprite: "str | Sprite", part: str, frames: list[str], rig: dict | None = None, paint: bool = True) -> list[dict]:
    """[{frame, px, c: (x, y), step}] for one part over the frames (step: centroid distance from the previous)."""
    s, out, prev = _sprite(sprite, rig, paint), [], None
    for f in frames:
        ys, xs = np.nonzero(s.part_mask(f, part))
        c = (float(xs.mean()), float(ys.mean())) if len(xs) else (float("nan"),) * 2
        out.append({"frame": f, "px": int(len(xs)), "c": c,
                    "step": None if prev is None else float(np.hypot(c[0] - prev[0], c[1] - prev[1]))})
        prev = c
    return out


def colours(sprite: "str | Sprite", frames: list[str], rgbs, box: Box | None = None, rig: dict | None = None,
            paint: bool = True) -> dict[str, int]:
    s = _sprite(sprite, rig, paint)
    return {f: colour_count(s.img(f), rgbs, box) for f in frames}


def pieces(sprite: "str | Sprite", frames: list[str], box: Box | None = None, holes: int | None = None, small: int | None = None,
           rig: dict | None = None, paint: bool = True) -> dict[str, dict]:
    s, out = _sprite(sprite, rig, paint), {}
    for f in frames:
        a = s.img(f)
        ps = pieces_of(a, box)
        out[f] = {"pieces": len(ps), "small": [p for p in ps if small is not None and p["size"] < small],
                  "holes": PX.holes(a, box, holes) if holes is not None else []}
    return out


def fills(sprite: "str | Sprite", frames: list[str], box: Box | None = None, min_px: int = 0, exclude: list[Box] = (),
          rgb=None, rig: dict | None = None, paint: bool = True) -> dict[str, list[dict]]:
    """Fill components per frame (>= min_px; a component wholly inside one `exclude` box is left out; with `rgb` only
    the components holding one of those colours)."""
    s, out = _sprite(sprite, rig, paint), {}
    for f in frames:
        a = s.img(f)
        keep = []
        for c in fill_components(a, box, keep_px=True):
            ys, xs = c["_px"]
            if c["size"] < min_px or any(_in_box(a.shape, e)[ys, xs].all() for e in exclude):
                continue
            if rgb and not _rgb_mask(a, rgb)[ys, xs].any():
                continue
            keep.append(c)
        out[f] = _public(keep)
    return out


def join(sprite: "str | Sprite", frame: str, rgbs, part: str, rig: dict | None = None, paint: bool = True) -> dict:
    """Are the `rgbs` pixels owned by `part` (or by no part: rig paint) in the part's own fill component? {main: the
    fill component with most `part` pixels, apart: the other fill components holding such pixels, joined}."""
    s = _sprite(sprite, rig, paint)
    a = s.img(frame)
    pm = s.part_mask(frame, part)
    lab = s.labels(frame)
    own = pm | (lab == -1) if lab is not None else pm
    want = _rgb_mask(a, rgbs) & own
    cs = fill_components(a, keep_px=True)
    hit = lambda m, c: int(m[c["_px"]].sum())
    main = max(cs, key=lambda c: (hit(pm, c), c["size"]))
    apart = [c for c in cs if c is not main and hit(want, c)]
    return {"main": _public([main])[0], "apart": _public(apart), "joined": not apart}


def diff(sprite: "str | Sprite", frames: list[str], part: str | None = None, rig: dict | None = None, paint: bool = True) -> list[dict]:
    """Per step: pixels that differ (RGBA) inside the part's pixels of either frame (or the whole cell), the part's
    pixel counts and its centroid step."""
    s, out = _sprite(sprite, rig, paint), []
    for f0, f1 in zip(frames, frames[1:]):
        a, b = s.img(f0), s.img(f1)
        m0 = s.part_mask(f0, part) if part else np.ones(a.shape[:2], bool)
        m1 = s.part_mask(f1, part) if part else np.ones(b.shape[:2], bool)
        changed = int(((a != b).any(2) & (m0 | m1)).sum())
        c = [(float(np.nonzero(m)[1].mean()), float(np.nonzero(m)[0].mean())) if m.any() else None for m in (m0, m1)]
        step = float(np.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1])) if all(c) else None
        out.append({"from": f0, "to": f1, "changed": changed, "px": (int(m0.sum()), int(m1.sum())), "step": step})
    return out


def travel(sheet: str) -> dict:
    """The FW-A anchors (and opaqueRight, head, tip) the atlas writes for `sheet` (a variant measures its base)."""
    import yaml
    from PIL import Image
    from gen import monster_atlas as MAT
    base = next((m["id"] for m in yaml.safe_load((HERE / "monsters.yaml").read_text())
                 if sheet in [v["id"] for v in m.get("variants") or []]), sheet)
    s = Sprite(base)
    frames = {n: Image.fromarray(a) for n, a in s.frames.items()}
    names = MA.frames_for("cast" in frames, "attack_raise" in frames)
    m = MAT.sheet_meta(s.meta, frames, names, {}, [], bool(s.gen), MA.lunge_px(frames["idle"]), 0,
                       sheet in MAT.ranged_sheets())
    return {k: m[k] for k in ("travelTop", "lungeRight", "homeX", "opaqueRight", "head", "tip", "hasRaise") if k in m}


# ───────── CLI ─────────
def _rgb(v: str):
    return None if v == "null" else tuple(int(c) for c in v.split(","))


def _opts(argv: list[str]) -> tuple[list[str], dict]:
    pos, opt, i = [], {}, 0
    while i < len(argv):
        a = argv[i]
        if a.startswith("--"):
            vals = []
            i += 1
            while i < len(argv) and not argv[i].startswith("--"):
                vals.append(argv[i])
                i += 1
            opt[a[2:]] = vals
        else:
            pos.append(a)
            i += 1
    return pos, opt


def _box(vals) -> Box | None:
    return tuple(int(v) for v in vals[:4]) if vals else None


def main(argv: list[str]) -> int:
    cmds = ("travel", "partc", "pieces", "fills", "colours", "diff", "select")
    if not argv or argv[0] not in cmds:
        print(__doc__)
        return 2
    pos, o = _opts(argv[1:])
    paint, box = "raw" not in o, _box(o.get("box"))
    num = lambda k: int(o[k][0]) if o.get(k) else None
    cmd = argv[0]
    if cmd == "travel":
        print(json.dumps({pos[0]: travel(pos[0])}))
    elif cmd == "partc":
        rows = partc(pos[0], pos[1], pos[2:], paint=paint)
        for r in rows:
            step = "" if r["step"] is None else f" step {r['step']:.1f}"
            print(f"{r['frame']}: {r['px']} px centroid ({r['c'][0]:.1f}, {r['c'][1]:.1f}){step}")
        steps = [r["step"] for r in rows if r["step"] is not None]
        print(f"max step {max(steps):.1f}" if steps else "no steps")
    elif cmd == "pieces":
        for f, r in pieces(pos[0], pos[1:], box, num("holes"), num("small"), paint=paint).items():
            print(f"{f}: {r['pieces']} piece(s)" + (f"; small < {num('small')}: {r['small']}" if num("small") else "") +
                  (f"; holes >= {num('holes')}: {[(h['size'], h['at']) for h in r['holes']]}" if num("holes") else ""))
    elif cmd == "fills":
        if "join" in o:
            for f in pos[1:]:
                r = join(pos[0], f, [_rgb(v) for v in o["join"]], o["to-part"][0], paint=paint)
                print(f"{f}: main {r['main']['size']} px {r['main']['box']}; apart "
                      f"{[(c['size'], c['box']) for c in r['apart']]} -> {'JOINED' if r['joined'] else 'NOT JOINED'}")
        else:
            ex = [tuple(int(v) for v in o["exclude"][i:i + 4]) for i in range(0, len(o.get("exclude", [])), 4)]
            rgb = [_rgb(v) for v in o["rgb"]] if o.get("rgb") else None
            for f, cs in fills(pos[0], pos[1:], box, num("min") or 0, ex, rgb, paint=paint).items():
                print(f"{f}: {len(cs)} fill component(s) " + ", ".join(f"{c['size']} px {c['box']}" for c in cs))
    elif cmd == "colours":
        rgbs = [_rgb(v) for v in o["rgb"]]
        s = Sprite(pos[0], paint=paint)
        for f in pos[1:]:
            each = {c: colour_count(s.img(f), [c], box) for c in rgbs}
            print(f"{f}: {sum(each.values())} " + " ".join(f"{list(c)}={n}" for c, n in each.items()))
    elif cmd == "diff":
        for r in diff(pos[0], pos[1:], (o.get("part") or [None])[0], paint=paint):
            print(f"{r['from']}->{r['to']}: {r['changed']} px changed; part px {r['px'][0]} -> {r['px'][1]}"
                  + (f"; centroid step {r['step']:.1f}" if r["step"] is not None else ""))
    elif cmd == "select":
        s = Sprite(pos[0], paint=False if "raw" in o else True)
        comp = tuple(int(v) for v in o["component"][0].split(",")) if o.get("component") else None
        to = o.get("to")
        entries = select(s.img(pos[1]), [_rgb(v) for v in o["rgb"]] if o.get("rgb") else None, box, comp,
                         num("holes"), mode=to is None, to=_rgb(to[0]) if to and to[0] != "null" else None)
        n = sum(len(e["xy"]) for e in entries)
        print(f"# {pos[0]} {pos[1]}: {n} px in {len(entries)} entr{'y' if len(entries) == 1 else 'ies'}")
        for e in entries:
            line = f"  - {{frame: {pos[1]}, rgb: {json.dumps(e['rgb'])}, xy: {json.dumps(e['xy'])}}}"
            print(f"# no candidate colour within 3 px (pick one by hand): {line.strip()}" if e.get("unassigned") else line)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
