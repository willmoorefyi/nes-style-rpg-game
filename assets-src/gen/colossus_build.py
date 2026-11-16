"""The `colossus` build stage (docs/CHAOS_FORMS_PLAN.md 4.6): approved masters approved/chaos_forms/<form>/master.png +
their layer yaml gen/colossus/<form>.yaml -> layer PNGs assets/sprites/colossus/<form>/<layer>[_<frame>].png (each
cropped to its opaque box + 1 px, split into tiles <= 2048 px), the index assets/sprites/colossus.json and a sha256
manifest. With no approved master it writes nothing and prints nothing (R25). Deterministic: sorted forms, the yaml's
layer order, no hash order (R26: `--out DIR` twice under PYTHONHASHSEED 0 / 1, compare the manifests).

  python3 -I assets-src/build_assets.py colossus [--out DIR]
  python3 -I assets-src/gen/colossus_build.py [--approved DIR] [--specs DIR] [--out DIR]     # fixtures / scratch

colossus.json: {version: 1, bytes: <RGBA bytes of every texture>, forms: {<form>: {canvas, scale, place, anchors,
targetRect, visibleBox, layers: [{name, kind, z, over, blend, pivot?, image: [tile], frames?: {f: [tile]},
variants?: {v: [tile]}}]}}}; tile = {file (relative to the json), x, y, w, h} in art px within the canvas.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np  # noqa: E402
import yaml  # noqa: E402
from PIL import Image  # noqa: E402

from gen import colossus_layers as CL  # noqa: E402

HERE = Path(__file__).resolve().parent
APPROVED = HERE / "approved" / "chaos_forms"
SPECS = HERE / "colossus"
OUT = HERE.parent.parent / "assets" / "sprites"
MAX_SIDE = 2048
FIELD = (0, 0, 1920, 780)            # the rest view: the screen above the bottom strip (visible fraction, 0 R12)


def masters(approved: Path = APPROVED) -> list[str]:
    """Form ids with an approved master (one level deep, sorted)."""
    return sorted(p.parent.name for p in approved.glob("*/master.png")) if approved.is_dir() else []


def tiles(img: Image.Image, max_side: int = MAX_SIDE) -> list[tuple[int, int, Image.Image]]:
    """(x, y, tile) pieces of <= max_side px that abut with no gap or overlap, column-major."""
    return [(x, y, img.crop((x, y, min(x + max_side, img.width), min(y + max_side, img.height))))
            for x in range(0, img.width, max_side) for y in range(0, img.height, max_side)]


def _crop_box(img: Image.Image) -> tuple[int, int, int, int] | None:
    a = np.asarray(img)[..., 3] > 0
    if not a.any():
        return None
    ys, xs = np.where(a)
    return (max(0, int(xs.min()) - 1), max(0, int(ys.min()) - 1), min(img.width, int(xs.max()) + 2),
            min(img.height, int(ys.max()) + 2))


def _png(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=False, compress_level=9)
    return buf.getvalue()


def visible_box(canvas, scale: int, place) -> list[int]:
    """The canvas part (art px) inside the rest view FIELD when placed at `place` with `scale`."""
    x0 = max(0, -(-(FIELD[0] - place[0]) // scale)) if place[0] < FIELD[0] else 0
    y0 = max(0, -(-(FIELD[1] - place[1]) // scale)) if place[1] < FIELD[1] else 0
    x1 = min(canvas[0], (FIELD[2] - place[0]) // scale)
    y1 = min(canvas[1], (FIELD[3] - place[1]) // scale)
    return [int(x0), int(y0), int(x1), int(y1)]


def export_form(form: str, approved: Path = APPROVED, specs: Path = SPECS) -> tuple[dict, dict[str, Image.Image]]:
    """(the form's colossus.json entry, {relative file: image}); raises ValueError on any check failure."""
    spec = yaml.safe_load((specs / f"{form}.yaml").read_text())
    master = Image.open(approved / form / "master.png").convert("RGBA")
    probs = CL.alpha_problems(f"{form}/master", "body", master)
    if probs:
        raise ValueError(f"colossus {form}: {'; '.join(probs)}")
    layers = CL.split(master, spec)
    files: dict[str, Image.Image] = {}
    entry_layers = []

    def put(name: str, img: Image.Image, kind: str) -> list[dict]:
        p = CL.alpha_problems(name, kind, img)
        if p:
            raise ValueError(f"colossus {form}: {'; '.join(p)}")
        box = _crop_box(img)
        if box is None:
            return []
        out = []
        for i, (x, y, t) in enumerate(tiles(img.crop(box))):
            rel = f"colossus/{form}/{name}{'' if i == 0 else f'_t{i}'}.png"
            files[rel] = t
            out.append({"file": rel, "x": box[0] + x, "y": box[1] + y, "w": t.width, "h": t.height})
        return out
    for z, L in enumerate(spec["layers"]):
        name, kind = L["name"], L["kind"]
        e = {"name": name, "kind": kind, "z": L.get("z", z), "over": bool(L.get("over", False)),
             "blend": "add" if kind == "glow" else "normal", "image": put(name, layers[name], kind)}
        if kind == "limb":
            e["pivot"] = list(L["pivot"])
            e["frames"] = {f: put(f"{name}_{f}", CL.bake(layers[name], L["pivot"], deg), kind)
                           for f, deg in (L.get("frames") or {}).items()}
        for v, png in ((spec.get("variants") or {}).get(name) or {}).items():
            var = Image.open(approved / form / png).convert("RGBA")
            if var.size != master.size:
                raise ValueError(f"colossus {form}: variant {name}/{v} is {var.size}, not the canvas {master.size}")
            e.setdefault("variants", {})[v] = put(f"{name}_v_{v}", var, kind)
        entry_layers.append(e)
    scale, place = int(spec["scale"]), list(spec["place"])
    entry = {"canvas": list(spec["canvas"]), "scale": scale, "place": place, "anchors": spec.get("anchors") or {},
             "targetRect": list(spec.get("target_rect") or []),
             "visibleBox": list(spec.get("visible_box") or visible_box(spec["canvas"], scale, place)),
             "layers": entry_layers}
    return entry, files


def build(out: Path | None = None, approved: Path = APPROVED, specs: Path = SPECS) -> dict | None:
    """Write every approved form; None (and nothing written) when there is no approved master."""
    forms = masters(approved)
    if not forms:
        return None
    out = out or OUT
    meta: dict = {"version": 1, "bytes": 0, "forms": {}}
    files: dict[str, bytes] = {}
    for form in forms:
        entry, imgs = export_form(form, approved, specs)
        meta["forms"][form] = entry
        for rel, img in imgs.items():
            files[rel] = _png(img)
            meta["bytes"] += img.width * img.height * 4
    files["colossus.json"] = (json.dumps(meta, indent=2, sort_keys=True) + "\n").encode()
    for rel in sorted(files):
        (out / rel).parent.mkdir(parents=True, exist_ok=True)
        (out / rel).write_bytes(files[rel])
    manifest = "".join(f"{hashlib.sha256(files[r]).hexdigest()}  {r}\n" for r in sorted(files))
    (out / "manifest.sha256" if out != OUT else out / "colossus" / "manifest.sha256").write_text(manifest)  # --out: root
    print(f"colossus: {len(forms)} form(s) {forms}, {len(files) - 1} textures, {meta['bytes'] / 2 ** 20:.1f} MB RGBA")
    return meta


# ───────────────────────────── locks (5.4) ─────────────────────────────

def _hashes(form: str, approved: Path, specs: Path) -> dict[str, str]:
    _, imgs = export_form(form, approved, specs)
    return {rel: hashlib.sha256(np.ascontiguousarray(np.asarray(img)).tobytes()).hexdigest() for rel, img in imgs.items()}


def lock(approved: Path, specs: Path, form: str) -> Path:
    """gen/colossus/<form>.lock.json: the pixel hash of every exported layer frame (commit right after it)."""
    path = specs / f"{form}.lock.json"
    path.write_text(json.dumps({"form": form, "frames": _hashes(form, approved, specs)}, indent=2, sort_keys=True) + "\n")
    return path


def lock_problems(approved: Path, specs: Path, form: str) -> list[str]:
    path = specs / f"{form}.lock.json"
    if not path.exists():
        return [f"{form}: no lock file ({path.name})"]
    want, have = json.loads(path.read_text())["frames"], _hashes(form, approved, specs)
    probs = [f"{form}: {rel}: hash differs from the lock file" for rel in sorted(set(want) | set(have))
             if want.get(rel) != have.get(rel)]
    return probs


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Build the colossus forms' layer textures (see the module docstring).")
    ap.add_argument("--approved", type=Path, default=APPROVED)
    ap.add_argument("--specs", type=Path, default=SPECS)
    ap.add_argument("--out", type=Path, help="a scratch output dir (default: assets/sprites)")
    a = ap.parse_args(argv)
    try:
        build(a.out, a.approved, a.specs)
    except ValueError as e:
        raise SystemExit(str(e))
    return 0


if __name__ == "__main__":
    sys.exit(main())
