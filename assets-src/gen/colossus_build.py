"""The `colossus` build stage (docs/CHAOS_FORMS_PLAN.md 18.5, 18.6; rev 4, painted art): each approved form's layer files
approved/chaos_forms/<form>/*.png + its layer yaml gen/colossus/<form>.yaml -> textures assets/sprites/colossus/<form>/,
the index assets/sprites/colossus.json, a bestiary still colossus/<form>/preview.png and a sha256 manifest. Full colour
and soft alpha are kept as approved (no quantization, palette lock or binary alpha, 18.1). Forms with an approved
master but no layer yaml yet are skipped with a note; with no approved master it writes and prints nothing (R25).
Deterministic: sorted forms, the yaml's layer order, sorted json keys (R26: `--out DIR` under PYTHONHASHSEED 0 / 1).

  python3 -I assets-src/build_assets.py colossus [--out DIR]
  python3 -I assets-src/gen/colossus_build.py [--approved DIR] [--specs DIR] [--out DIR]     # fixtures / scratch
  python3 -I assets-src/gen/colossus_build.py --contract     # the fixture form vs tests/fixtures/colossus/contract.json

The json is the shape the TS reader (src/scenes/battle/colossus/colossusIndex.ts) accepts, which is the contract:
  {version: 1, bytes, forms: {<form>: {canvas: [w, h], scale, place: [x, y], anchors, targetRect: [x, y, w, h],
   visibleBox?, coverBox?, skyDim?, layers: [{name, kind, over?, blend?: add, alpha?, frames: {base: F, crack?: F}}]}}}
  (blend / alpha only when not the reader's defaults normal / 1, so an additive layer carries both; skyDim from the
  yaml's sky_dim or colossus.FORMS, written when < 1)
  F = {at: [x, y] (canvas art px), size: [w, h] (canvas art px), texScale? (default 1), tiles: [{file, x, y, w, h}]};
  the tiles are in texture px relative to the frame and cover exactly ceil(size / texScale); each side <= 2048.
Layer yaml (written by the rigger): form, canvas, scale (1), place, anchors {target, core, head, hands: [l, r], melee,
feet}, target_rect [x, y, w, h], cover_box?, visible_box?, sky_dim? (the preview's bg multiply; F3 / F4 0.6), layers:
[{name, kind, over?, blend?, alpha?, tex_scale?, box? [x0, y0, x1, y1], frames: {base: <png> | null, <variant>: <png>}}];
each png is canvas-sized RGBA in the form's approved dir; a frame is its alpha box (+1 px) inside `box`.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import sys
import tempfile
from pathlib import Path

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np  # noqa: E402
import yaml  # noqa: E402
from PIL import Image  # noqa: E402

from gen.colossus_spec import preview, spec_problems  # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
APPROVED = HERE / "approved" / "chaos_forms"
SPECS = HERE / "colossus"
OUT = ROOT / "assets" / "sprites"
RIM = ROOT / "assets" / "backgrounds" / "rim.webp"
CONTRACT = ROOT / "tests" / "fixtures" / "colossus" / "contract.json"   # written by the TS side (makeFixture.mjs)
MAX_SIDE = 2048
MAX_BYTES = 24_000_000              # 18.6: the colossus textures of all forms, RGBA
FIELD = (0, 0, 1920, 780)           # the rest view above the bottom strip


def masters(approved: Path = APPROVED) -> list[str]:
    """Form ids with an approved master (one level deep, sorted)."""
    return sorted(p.parent.name for p in approved.glob("*/master.png")) if approved.is_dir() else []


def tiles(img: Image.Image, max_side: int = MAX_SIDE) -> list[tuple[int, int, Image.Image]]:
    """(x, y, tile) pieces of <= max_side px that abut with no gap or overlap, column-major."""
    return [(x, y, img.crop((x, y, min(x + max_side, img.width), min(y + max_side, img.height))))
            for x in range(0, img.width, max_side) for y in range(0, img.height, max_side)]


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


def _frame_box(img: Image.Image, box, ts: int) -> tuple[int, int, int, int] | None:
    w, h = img.size
    x0, y0, x1, y1 = box or (0, 0, w, h)
    a = np.asarray(img.getchannel("A"))[y0:y1, x0:x1] > 0
    if not a.any():
        return None
    ys, xs = np.where(a)
    b = [max(x0, x0 + int(xs.min()) - 1), max(y0, y0 + int(ys.min()) - 1),
         min(x1, x0 + int(xs.max()) + 2), min(y1, y0 + int(ys.max()) + 2)]
    if ts > 1:                                     # align to the texture grid
        b = [b[0] - b[0] % ts, b[1] - b[1] % ts, min(w, -(-b[2] // ts) * ts), min(h, -(-b[3] // ts) * ts)]
    return tuple(b)


def export_form(form: str, approved: Path = APPROVED, specs: Path = SPECS, max_side: int = MAX_SIDE,
                prefix: str = "colossus/") -> tuple[dict, dict[str, Image.Image], dict]:
    """(the form's colossus.json entry, {file relative to the json: texture}, the spec); raises ValueError on any
    problem. Tile files are <prefix><form>/<layer>_<frame>[_<n>].png (n from 0 when a frame has several tiles)."""
    spec = yaml.safe_load((specs / f"{form}.yaml").read_text())
    probs = spec_problems(spec)
    if probs:
        raise ValueError("; ".join(probs))
    canvas = tuple(spec["canvas"])
    files: dict[str, Image.Image] = {}
    layers = []
    for L in spec["layers"]:
        name, ts = L["name"], int(L.get("tex_scale", 1))
        frames, boxes = {}, {}
        for fname, src in L["frames"].items():
            if src is None:
                continue
            path = approved / form / src
            if not path.is_file():
                raise ValueError(f"colossus {form}: layer {name}/{fname}: {path.name} is missing")
            img = Image.open(path).convert("RGBA")
            if img.size != canvas:
                raise ValueError(f"colossus {form}: {path.name} is {img.size}, not the canvas {canvas}")
            b = _frame_box(img, L.get("box"), ts)
            if b is None:
                if name == "body" or fname != "base":
                    raise ValueError(f"colossus {form}: layer {name}/{fname}: {path.name} has no opaque pixel")
                continue
            boxes[fname] = (b, img)
        union = [min(b[0][i] for b in boxes.values()) if i < 2 else max(b[0][i] for b in boxes.values())
                 for i in range(4)] if boxes else [0, 0, 0, 0]
        for fname in L["frames"]:
            if fname not in boxes:
                frames[fname] = {"at": union[:2], "size": [union[2] - union[0], union[3] - union[1]], "tiles": []}
                continue
            (x0, y0, x1, y1), img = boxes[fname]
            crop = img.crop((x0, y0, x1, y1))
            tex = crop if ts == 1 else crop.resize((math.ceil(crop.width / ts), math.ceil(crop.height / ts)),
                                                   Image.Resampling.LANCZOS)
            fr = {"at": [x0, y0], "size": [x1 - x0, y1 - y0], "tiles": []}
            if ts != 1:
                fr["texScale"] = ts
            cut = tiles(tex, max_side)
            for i, (tx, ty, t) in enumerate(cut):
                rel = f"{prefix}{form}/{name}_{fname}{f'_{i}' if len(cut) > 1 else ''}.png"
                files[rel] = t
                fr["tiles"].append({"file": rel, "x": tx, "y": ty, "w": t.width, "h": t.height})
            frames[fname] = fr
        blend = L.get("blend", "add" if L["kind"] in ("glow", "corona") else "normal")
        e = {"name": name, "kind": L["kind"], "frames": frames}
        if blend == "add" or float(L.get("alpha", 1.0)) != 1.0:      # normal / 1 are the reader's defaults
            e.update(blend=blend, alpha=float(L.get("alpha", 1.0)))
        if L.get("over"):
            e["over"] = True
        layers.append(e)
    scale, place = int(spec.get("scale", 1)), list(spec["place"])
    entry = {"canvas": list(canvas), "scale": scale, "place": place, "anchors": spec["anchors"],
             "targetRect": list(spec["target_rect"]), "layers": layers}
    for key, yk in (("coverBox", "cover_box"), ("visibleBox", "visible_box")):    # missing: the reader's defaults
        if spec.get(yk):
            entry[key] = list(spec[yk])
    dim = float(spec.get("sky_dim", form_table(form).get("sky_dim", 1.0)))
    if dim != 1.0:
        entry["skyDim"] = dim
    return entry, files, spec


def form_table(form: str) -> dict:
    """colossus.FORMS[form] (place, sky_dim, ...) or {} for a fixture form."""
    from gen import colossus as C
    return C.FORMS.get(form, {})


def build(out: Path | None = None, approved: Path = APPROVED, specs: Path = SPECS, max_side: int = MAX_SIDE,
          bg: Path | None = RIM, max_bytes: int = MAX_BYTES) -> dict | None:
    """Write every approved form with a layer yaml; None (and nothing written) when there is none."""
    forms = [f for f in masters(approved) if (specs / f"{f}.yaml").exists()]
    for f in masters(approved):
        if f not in forms:
            print(f"colossus: {f} skipped (approved master, no layer yaml {f}.yaml yet)")
    if not forms:
        return None
    out = out or OUT
    meta: dict = {"version": 1, "bytes": 0, "forms": {}}
    files: dict[str, bytes] = {}
    for form in forms:
        entry, imgs, spec = export_form(form, approved, specs, max_side)
        meta["forms"][form] = entry
        for rel, img in imgs.items():
            files[rel] = _png(img)
            meta["bytes"] += img.width * img.height * 4
        still = preview(entry, spec, approved, form, bg)
        if still is not None:
            files[f"colossus/{form}/preview.png"] = _png(still)
    if meta["bytes"] > max_bytes:
        raise ValueError(f"colossus: {meta['bytes']:,} RGBA bytes > the {max_bytes:,} budget (18.6); size is never cut "
                         "to fit: ask the orchestrator")
    files["colossus.json"] = (json.dumps(meta, indent=2, sort_keys=True) + "\n").encode()
    for rel in sorted(files):
        (out / rel).parent.mkdir(parents=True, exist_ok=True)
        (out / rel).write_bytes(files[rel])
    manifest = "".join(f"{hashlib.sha256(files[r]).hexdigest()}  {r}\n" for r in sorted(files))
    (out / "manifest.sha256" if out != OUT else out / "colossus" / "manifest.sha256").write_text(manifest)  # --out: root
    print(f"colossus: {len(forms)} form(s) {forms}, {len(files) - 1} files, {meta['bytes'] / 1e6:.1f} MB RGBA")
    return meta


def contract_forms() -> dict:
    """The `forms` table colossus_build.py writes for colossus_fixture's form with the TS fixture's file layout (tiles
    relative to tests/fixtures/colossus/), to compare with the committed contract.json (parsed, 18.5)."""
    from gen import colossus_fixture as FX
    with tempfile.TemporaryDirectory() as t:
        app, specs = FX.write(Path(t) / "fx")
        entry, _, _ = export_form(FX.FORM, app, specs, prefix="")
    return {FX.FORM: entry}


# ───────────────────────────── locks ─────────────────────────────

def _hashes(form: str, approved: Path, specs: Path) -> dict[str, str]:
    _, imgs, _ = export_form(form, approved, specs)
    return {rel: hashlib.sha256(np.ascontiguousarray(np.asarray(img)).tobytes()).hexdigest() for rel, img in imgs.items()}


def lock(approved: Path, specs: Path, form: str) -> Path:
    """gen/colossus/<form>.lock.json: the pixel hash of every exported texture (commit right after it)."""
    path = specs / f"{form}.lock.json"
    path.write_text(json.dumps({"form": form, "frames": _hashes(form, approved, specs)}, indent=2, sort_keys=True) + "\n")
    return path


def lock_problems(approved: Path, specs: Path, form: str) -> list[str]:
    path = specs / f"{form}.lock.json"
    if not path.exists():
        return [f"{form}: no lock file ({path.name})"]
    want, have = json.loads(path.read_text())["frames"], _hashes(form, approved, specs)
    return [f"{form}: {rel}: hash differs from the lock file" for rel in sorted(set(want) | set(have))
            if want.get(rel) != have.get(rel)]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Build the colossus forms' layer textures (see the module docstring).")
    ap.add_argument("--approved", type=Path, default=APPROVED)
    ap.add_argument("--specs", type=Path, default=SPECS)
    ap.add_argument("--out", type=Path, help="a scratch output dir (default: assets/sprites)")
    ap.add_argument("--contract", action="store_true", help=f"diff the fixture form against {CONTRACT.relative_to(ROOT)}")
    a = ap.parse_args(argv)
    try:
        if a.contract:
            want = json.loads(CONTRACT.read_text())["forms"]
            have = contract_forms()
            print("contract: OK" if want == have else f"contract: DIFFERS\n{json.dumps(have, indent=1)}")
            return 0 if want == have else 1
        else:
            build(a.out, a.approved, a.specs)
    except ValueError as e:
        raise SystemExit(str(e))
    return 0


if __name__ == "__main__":
    sys.exit(main())
