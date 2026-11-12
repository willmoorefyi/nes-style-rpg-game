"""Generate sprite candidates for a character from characters.yaml.

  # check inputs and how many paid requests a run would make (no network)
  python3 -I assets-src/gen/generate.py knight --backend gemini --sheets battle --seeds 1234 --dry-run
  # make the single paid request for one checkpoint
  python3 -I assets-src/gen/generate.py knight --backend gemini --sheets battle --seeds 1234 --paid
  # re-pixelize existing raws offline (never imports a backend)
  python3 -I assets-src/gen/generate.py --repixelize assets-src/gen/out/gemini/knight/1234

Budget guard (docs/ART_2X_PLAN.md, hard rule 1):
  - --backend is required; uncached requests need --paid; more than --max-paid (default 1) uncached requests
    are refused before anything is sent.
  - every paid attempt is written to cache/ledger.jsonl before the call; failures count as spent.
  - any earlier paid ledger entry for the same character+sheet blocks another paid call unless --retry is passed
    (only after the user approves a retry).

Outputs: assets-src/gen/out/<backend>/<id>/<seed>/<sheet>_{guide,raw,prompt}.* , <sheet>.png (native sheet) and
review.png.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import numpy as np  # noqa: E402
import yaml  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

from gen import guides as G  # noqa: E402
from gen import pixelize as PX  # noqa: E402
from gen import spec as S  # noqa: E402

OUT = HERE / "out"
CACHE = HERE / "cache"
LEDGER = CACHE / "ledger.jsonl"
REFS = HERE / "refs"
STYLE_REF = REFS / "style_reference.jpg"
STYLE_REF_CROP = (300, 270, 2800, 1100)
SIZE_REF = REFS / "pr_warrior_1080p.png"
IDENTITY_UPSCALE = 8

CELL_NAMES = {(3, 2): ["top-left", "top-middle", "top-right", "bottom-left", "bottom-middle", "bottom-right"],
              (3, 1): ["left", "middle", "right"]}
FIELD_STEPS = ["standing still", "mid-step with the left foot forward", "mid-step with the right foot forward"]


@dataclass(frozen=True)
class Sheet:
    name: str
    poses: dict
    order: list
    geom: S.SheetGeom
    kind: str
    layout_text: str
    target_px: str


SHEETS: dict[str, Sheet] = {
    "battle": Sheet("battle", S.BATTLE_POSES, S.BATTLE_ORDER, S.BATTLE_GEOM, "battle", S.BATTLE_LAYOUT[1], S.BATTLE_TARGET_PX),
    **{f"field_{d}": Sheet(f"field_{d}", S.FIELD_POSES, S.field_order(d), S.FIELD_GEOM, "overworld walking", text, S.FIELD_TARGET_PX)
       for d, (_, text, _) in S.FIELD_DIRECTIONS.items()},
}


# ───────────────────────────── inputs ─────────────────────────────

def load_character(cid: str) -> dict:
    for entry in yaml.safe_load((HERE / "characters.yaml").read_text()):
        if entry["id"] == cid:
            return entry
    raise SystemExit(f"no character '{cid}' in characters.yaml")


def sheet_negative(char: dict, sheet: Sheet) -> str:
    parts = [S.NEGATIVE]
    if sheet.name.startswith("field_"):
        parts += [S.FIELD_NEGATIVE, S.FIELD_DIRECTIONS[sheet.name.removeprefix("field_")][2]]
    if char.get("extra_negative"):
        parts.append(char["extra_negative"])
    return ", ".join(parts)


def gemini_prompt(char: dict, sheet: Sheet, has_identity: bool) -> str:
    gear = char.get("battle_gear" if sheet.name == "battle" else "field_gear", "")
    names = CELL_NAMES[sheet.geom.layout]
    cells = []
    for i, name in enumerate(sheet.order):
        cap = sheet.poses[name].caption if sheet.name == "battle" else f"{FIELD_STEPS[i]}, {sheet.layout_text}"
        cells.append(f"- {names[i]} cell: {cap}.")
    facing = ("Side view: the nose points LEFT and only one eye is visible."
              if sheet.name in ("battle", "field_left") else "")
    identity = ("Image 3 is the APPROVED LOOK of this exact character in battle poses (pixel art). Keep the same "
                "face, hair, colours, armour shapes and proportions.\n\n" if has_identity else "")
    w, h = sheet.geom.layout
    return (
        f"Create a {w}x{h} sprite sheet for a modern 16-bit-style pixel-art RPG, {sheet.kind} sprites.\n\n"
        "Image 1 is a POSE GUIDE: grey mannequins on white, one per cell. Draw the SAME character once in every cell, "
        "matching that cell's mannequin pose, position and size exactly. Light grey limbs are the far side, dark grey "
        "limbs the near side; the light patch and nose bump on the head show which way the face points.\n\n"
        "Image 2 is a STYLE REFERENCE only (bead versions of classic battle sprites): match its chunky proportions "
        "(about 2.5 heads tall, oversized head, big fists and boots), black outlines around and between parts, and "
        "flat shading with 2-3 tones per colour. Do NOT copy those characters and do NOT draw bead texture.\n\n"
        + identity +
        f"Render as true pixel art: each character {sheet.target_px} in sprite pixels, every sprite pixel a hard-edged "
        "square, no anti-aliasing, no gradients, no soft shading. " + facing + "\n\n"
        f"Character: {char['prompt'].strip()}; {gear}. Keep every costume detail identical in every cell.\n\n"
        "Cells:\n" + "\n".join(cells) + "\n\n"
        "Background: solid flat magenta (#FF00FF) everywhere, no floor, no shadows, no grid lines, no borders, "
        "no text or labels.\n"
        f"Avoid: {sheet_negative(char, sheet)}."
    )


def identity_image(char: dict) -> Image.Image | None:
    ref = char.get("identity_ref")
    if not ref:
        return None
    im = Image.open(HERE.parent.parent / ref).convert("RGBA")
    big = im.resize((im.width * IDENTITY_UPSCALE, im.height * IDENTITY_UPSCALE), Image.Resampling.NEAREST)
    flat = Image.new("RGB", big.size, (255, 0, 255))
    flat.paste(big, (0, 0), big)
    return flat


def style_image() -> Image.Image:
    return Image.open(STYLE_REF).convert("RGB").crop(STYLE_REF_CROP)


# ───────────────────────────── requests & budget guard ─────────────────────────────

@dataclass
class Request:
    character: str
    sheet: Sheet
    seed: int
    backend: str
    model: str
    guide: Image.Image
    key: str
    prompt: str
    inputs: list[Image.Image]
    run: Callable[[], Image.Image]

    @property
    def cached(self) -> bool:
        return (CACHE / f"{self.key}.png").exists()


def plan_request(char: dict, sheet: Sheet, seed: int, backend: str, model: str | None) -> Request:
    guide = G.sheet(sheet.poses, sheet.order, sheet.geom, robed=char.get("robed", False))
    if backend == "gemini":
        from gen import gemini as GM
        ident = identity_image(char) if sheet.name != "battle" else None   # identity ref is for field sheets
        images = [guide, style_image()] + ([ident] if ident is not None else [])
        prompt = gemini_prompt(char, sheet, ident is not None)
        mid = model or GM.DEFAULT_MODEL
        key = GM.cache_key(prompt, images, aspect_ratio=sheet.geom.aspect, seed=seed, model=mid)
        run = lambda: GM.generate(prompt, images, aspect_ratio=sheet.geom.aspect, seed=seed, model=mid)  # noqa: E731
        return Request(char["id"], sheet, seed, backend, mid, guide, key, prompt, images, run)
    from gen import bedrock as B
    gear = char.get("battle_gear" if sheet.name == "battle" else "field_gear", "")
    prompt = f"{char['prompt'].strip()}, {gear}, " + S.STYLE.format(kind=sheet.kind, n=len(sheet.order), layout=sheet.layout_text)
    body = {"image": B.png_b64(guide), "prompt": prompt, "negative_prompt": sheet_negative(char, sheet),
            "control_strength": S.CONTROL_STRENGTH, "seed": seed, "output_format": "png"}
    key = B.cache_key("structure", body)
    return Request(char["id"], sheet, seed, backend, "stable-image-control-structure", guide, key, prompt, [guide],
                   lambda: B.invoke("structure", body))


def read_ledger(path: Path = LEDGER) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def ledger_append(entry: dict, path: Path = LEDGER) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as f:
        f.write(json.dumps(entry) + "\n")


def check_budget(requests: list[Request], *, paid: bool, max_paid: int, retry: bool,
                 ledger: list[dict]) -> list[Request]:
    """Return the requests that would be paid; raise SystemExit if the run is not allowed."""
    misses = [r for r in requests if not r.cached]
    if not misses:
        return []
    if len(misses) > max_paid:
        raise SystemExit(f"refused: {len(misses)} uncached requests would be paid, limit is {max_paid} "
                         "(only the user may raise --max-paid)")
    if not paid:
        raise SystemExit(f"refused: {len(misses)} uncached request(s) need --paid (run --dry-run to inspect first)")
    for r in misses:
        prior = [e for e in ledger if e.get("character") == r.character and e.get("sheet") == r.sheet.name
                 and e.get("event") == "attempt"]
        if prior and not retry:
            raise SystemExit(f"refused: checkpoint {r.character}/{r.sheet.name} already has {len(prior)} paid attempt(s) "
                             "in the ledger; a new paid call needs --retry, used only after the user approves it")
    return misses


def execute(req: Request, ledger_path: Path = LEDGER) -> Image.Image:
    if req.cached:
        return req.run()
    ledger_append({"event": "attempt", "ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "backend": req.backend,
                   "model": req.model, "character": req.character, "sheet": req.sheet.name, "seed": req.seed,
                   "key": req.key}, ledger_path)
    try:
        img = req.run()
    except BaseException as err:
        ledger_append({"event": "result", "key": req.key, "ok": False, "error": str(err)[:300]}, ledger_path)
        raise
    ledger_append({"event": "result", "key": req.key, "ok": True}, ledger_path)
    return img


# ───────────────────────────── pixelize & review ─────────────────────────────

LAST_RESAMPLE: dict = {}


def cut_frames(raw: Image.Image, guide: Image.Image, sheet: Sheet, char: dict, seed: int) -> list[Image.Image]:
    """Pixel-perfect path when the render has a detectable pixel grid whose cell size matches the sheet grid;
    otherwise fall back to block resampling (with a warning in the review stats)."""
    geom = sheet.geom
    cleaned, info = PX.clean_resample(raw, guide.size)
    LAST_RESAMPLE[sheet.name] = {k: v for k, v in info.items() if k != "native"}
    masks = G.cell_masks(guide, geom)
    cols, rows = geom.layout
    colors = char.get("palette_size", S.PALETTE_SIZE)
    native = info.get("native")
    if native is not None:
        aw, ah = native.size
        cell_w, cell_h = aw / cols, ah / rows
        mismatch = max(abs(cell_w / geom.grid[0] - 1), abs(cell_h / geom.grid[1] - 1))
        LAST_RESAMPLE[sheet.name]["art_cell"] = (round(cell_w, 1), round(cell_h, 1))
        if mismatch <= 0.08:
            LAST_RESAMPLE[sheet.name]["mode"] = "1:1"
            frames = []
            for i in range(len(sheet.order)):
                cx, cy = i % cols, i // cols
                box = (int(round(cx * cell_w)), int(round(cy * cell_h)), int(round((cx + 1) * cell_w)), int(round((cy + 1) * cell_h)))
                art = native.crop(box)
                gm = np.asarray(Image.fromarray((masks[i] * 255).astype(np.uint8)).resize(art.size, Image.Resampling.NEAREST)) > 0
                frame, rep = PX.pixelize_native(art, gm, geom.grid, colors=colors, seed=seed, bottom_row=geom.bottom_row)
                if rep.get("cropped"):
                    LAST_RESAMPLE[sheet.name]["cropped"] = LAST_RESAMPLE[sheet.name].get("cropped", []) + [sheet.order[i]]
                frames.append(frame)
            return frames
        LAST_RESAMPLE[sheet.name]["mode"] = f"resampled (art cell {cell_w:.0f}x{cell_h:.0f} vs grid {geom.grid})"
    else:
        LAST_RESAMPLE[sheet.name]["mode"] = "resampled (no pixel grid)"
    cw, ch = geom.cell_px
    frames = []
    for i in range(len(sheet.order)):
        x, y = (i % cols) * cw, (i // cols) * ch
        frames.append(PX.pixelize(cleaned.crop((x, y, x + cw, y + ch)), masks[i], geom.grid, colors=colors, seed=seed,
                                  bottom_row=geom.bottom_row))
    return frames


def native_sheet(frames: list[Image.Image], geom: S.SheetGeom) -> Image.Image:
    cols, rows = geom.layout
    gw, gh = geom.grid
    out = Image.new("RGBA", (gw * cols, gh * rows))
    for i, f in enumerate(frames):
        out.paste(f, ((i % cols) * gw, (i // cols) * gh))
    return out


def frame_stats(frame: Image.Image) -> dict:
    a = np.asarray(frame)
    alpha = a[..., 3] > 0
    rows = np.where(alpha.any(1))[0]
    colours = {tuple(c) for c in a[alpha][:, :3].tolist()}
    return {"height": int(rows.max() - rows.min() + 1) if len(rows) else 0,
            "bottom_row": int(rows.max()) if len(rows) else -1,
            "colours": len(colours), "outline": tuple(PX.OUTLINE) in colours}


def review(char_id: str, seed: int, results: dict, outdir: Path, label: str) -> Path:
    """Per sheet: raw render | frames at in-game 2x | frames at 4x zoom | Pixel Remaster size reference at 1:1."""
    size_ref = Image.open(SIZE_REF).convert("RGBA") if SIZE_REF.exists() else None
    panels = []
    for name, (raw, frames) in results.items():
        geom = SHEETS[name].geom
        nat = native_sheet(frames, geom)
        in_game = nat.resize((nat.width * S.ART_SCALE, nat.height * S.ART_SCALE), Image.Resampling.NEAREST)
        zoom = nat.resize((nat.width * 4, nat.height * 4), Image.Resampling.NEAREST)
        raw_small = raw.convert("RGB").resize((zoom.width, zoom.height), Image.Resampling.LANCZOS)
        parts = [("raw", raw_small), ("in-game 2x", in_game), ("4x zoom", zoom)]
        if size_ref is not None:
            parts.append(("Pixel Remaster @1080p (size ref)", size_ref))
        w = sum(p.width for _, p in parts) + 16 * len(parts)
        h = max(p.height for _, p in parts) + 48
        panel = Image.new("RGBA", (w, h), (72, 110, 80, 255))
        d = ImageDraw.Draw(panel)
        x = 0
        for title, p in parts:
            panel.alpha_composite(p.convert("RGBA"), (x, 26))
            d.text((x + 2, 8), title, fill=(255, 255, 255))
            x += p.width + 16
        stats = [frame_stats(f) for f in frames]
        grid = LAST_RESAMPLE.get(name, {})
        d.text((4, h - 16), f"{char_id} seed {seed} {name} [{label}]  source grid {grid.get('pitch')}px "
                            f"(conf {grid.get('confidence')}) {grid.get('mode')}{' CROPPED ' + str(grid['cropped']) if grid.get('cropped') else ''}  heights {[s['height'] for s in stats]}  "
                            f"bottom rows {sorted({s['bottom_row'] for s in stats})}  max colours {max(s['colours'] for s in stats)}  "
                            f"outline {all(s['outline'] for s in stats)}", fill=(255, 255, 255))
        panels.append(panel)
    W = max(p.width for p in panels)
    out = Image.new("RGBA", (W, sum(p.height for p in panels) + 10 * len(panels)), (40, 40, 44, 255))
    y = 0
    for p in panels:
        out.alpha_composite(p, (0, y)); y += p.height + 10
    path = outdir / "review.png"
    out.save(path)
    return path


def write_outputs(outdir: Path, sheet: Sheet, guide: Image.Image, raw: Image.Image, frames: list[Image.Image]) -> None:
    guide.save(outdir / f"{sheet.name}_guide.png")
    raw.save(outdir / f"{sheet.name}_raw.png")
    native_sheet(frames, sheet.geom).save(outdir / f"{sheet.name}.png")


def repixelize(outdir: Path) -> None:
    """Offline: rebuild guides from the current spec and re-pixelize every compatible *_raw.png in outdir."""
    seed = int(outdir.name) if outdir.name.isdigit() else 0
    char_id = outdir.parent.name
    char = {"id": char_id, "palette_size": S.PALETTE_SIZE}
    results = {}
    for name, sheet in SHEETS.items():
        raw_path = outdir / f"{name}_raw.png"
        if not raw_path.exists():
            continue
        guide = G.sheet(sheet.poses, sheet.order, sheet.geom)
        raw = Image.open(raw_path).convert("RGBA")
        rw, rh = raw.size
        gw, gh = guide.size
        if abs(rw / rh - gw / gh) > 0.02:
            print(f"skip {name}: raw aspect {rw}x{rh} does not match current layout {gw}x{gh}")
            continue
        frames = cut_frames(raw, guide, sheet, char, seed)
        native_sheet(frames, sheet.geom).save(outdir / f"{name}.png")
        results[name] = (raw, frames)
    if not results:
        raise SystemExit(f"no compatible *_raw.png in {outdir}")
    print(f"repixelized {list(results)}: {review(char_id, seed, results, outdir, 'offline repixelize')}")


# ───────────────────────────── main ─────────────────────────────

def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("character", nargs="?")
    ap.add_argument("--backend", choices=["gemini", "bedrock"])
    ap.add_argument("--model", default=None)
    ap.add_argument("--sheets", default="battle")
    ap.add_argument("--seeds", default="")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--paid", action="store_true", help="allow uncached (billed) requests")
    ap.add_argument("--max-paid", type=int, default=1)
    ap.add_argument("--retry", action="store_true", help="allow another paid call at a checkpoint already in the ledger")
    ap.add_argument("--repixelize", type=Path, default=None, metavar="OUT_DIR")
    args = ap.parse_args(argv)

    if args.repixelize:
        repixelize(args.repixelize)
        return
    if not args.character or not args.backend:
        ap.error("character and --backend are required (or use --repixelize OUT_DIR)")
    char = load_character(args.character)
    seeds = [int(s) for s in args.seeds.split(",")] if args.seeds else char.get("seeds", [1234])
    names = args.sheets.split(",")
    unknown = [n for n in names if n not in SHEETS]
    if unknown:
        ap.error(f"unknown sheets {unknown}; choose from {list(SHEETS)}")

    plan = [(seed, plan_request(char, SHEETS[n], seed, args.backend, args.model)) for seed in seeds for n in names]
    paid_count = sum(not r.cached for _, r in plan)
    if args.dry_run:
        for seed, r in plan:
            outdir = OUT / args.backend / char["id"] / str(seed)
            outdir.mkdir(parents=True, exist_ok=True)
            r.guide.save(outdir / f"{r.sheet.name}_guide.png")
            (outdir / f"{r.sheet.name}_prompt.txt").write_text(r.prompt + "\n")
            for i, im in enumerate(r.inputs):
                im.save(outdir / f"{r.sheet.name}_input{i + 1}.png")
            print(f"{r.sheet.name} seed {seed}: {'cached' if r.cached else 'PAID'}  key {r.key}  -> {outdir}")
        print(f"dry run: {paid_count} paid request(s) would be made")
        return

    check_budget([r for _, r in plan], paid=args.paid, max_paid=args.max_paid, retry=args.retry, ledger=read_ledger())
    by_seed: dict[int, dict] = {}
    for seed, r in plan:
        outdir = OUT / args.backend / char["id"] / str(seed)
        outdir.mkdir(parents=True, exist_ok=True)
        raw = execute(r)
        frames = cut_frames(raw, r.guide, r.sheet, char, seed)
        write_outputs(outdir, r.sheet, r.guide, raw, frames)
        by_seed.setdefault(seed, {})[r.sheet.name] = (raw, frames)
    for seed, results in by_seed.items():
        outdir = OUT / args.backend / char["id"] / str(seed)
        print(f"{char['id']} seed {seed}: {review(char['id'], seed, results, outdir, args.model or args.backend)}")


if __name__ == "__main__":
    main()
