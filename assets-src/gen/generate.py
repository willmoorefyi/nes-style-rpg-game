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
from gen import kitsheet as KS  # noqa: E402
from gen import monster as M  # noqa: E402
from gen import pixelize as PX  # noqa: E402
from gen import spec as S  # noqa: E402

OUT = HERE / "out"
CACHE = HERE / "cache"
LEDGER = CACHE / "ledger.jsonl"
BUDGET = HERE / "budget.json"
REFS = HERE / "refs"
STYLE_REF = REFS / "style_reference.jpg"
STYLE_REF_CROP = (300, 270, 2800, 1100)
SIZE_REF = REFS / "pr_warrior_1080p.png"
IDENTITY_UPSCALE = 8

CELL_NAMES = {(3, 2): ["top-left", "top-middle", "top-right", "bottom-left", "bottom-middle", "bottom-right"],
              (3, 1): ["left", "middle", "right"],
              (3, 3): [f"{r} row, {c}" for r in ("top", "middle", "bottom") for c in ("left", "middle", "right")]}
DEFAULT_FACE = ("every cell must show a clearly readable face drawn at the same sprite-pixel size as the body: two "
                "dark eyes, eyebrows and a mouth, also when hurt, kneeling, knocked down, casting or seen in profile. "
                "Hoods, hair and hats frame the face but never cover it. (Back views show no face.)")
FIELD_STEPS = ["standing still", "mid-step with the left foot forward", "mid-step with the right foot forward"]
# 3x3 sheet wording (new requests only; the single-direction wording above must stay stable for cache keys)
FIELD3_STEPS = ["standing still", "mid-step with the left foot clearly forward", "mid-step with the right foot clearly forward"]


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
    "field": Sheet("field", S.FIELD3_POSES, S.FIELD_ORDER, S.FIELD3_GEOM, "overworld walking", "", S.FIELD_TARGET_PX),
    **{f"monster_{size}": Sheet(f"monster_{size}", {}, S.MONSTER_POSES, geom, "monster battle", "", "")
       for size, geom in S.MONSTER_GEOMS.items()},
    **{f"boss_{pose}": Sheet(f"boss_{pose}", {}, [pose], S.BOSS_POSE_GEOM, "boss battle", "", "")
       for pose in S.BOSS_POSES},
}
# tile kits (kits.yaml): one sheet per checkpoint, named kit_<sheet>
KITS = yaml.safe_load((HERE / "kits.yaml").read_text())
for _kit in KITS:
    for _name, _sh in _kit["sheets"].items():
        _grid = (_sh.get("cells") or _sh.get("layout")                # materials sheets: a layout of swatches
                 or [[sw["name"] for sw in _sh["swatches"]]])            # swatch sheets: a list of boxes
        SHEETS[f"kit_{_name}"] = Sheet(f"kit_{_name}", {}, [c for row in _grid for c in row],
                                       S.kit_geom(len(_grid[0]), len(_grid), _sh.get("aspect", "5:4"),
                                                  _sh.get("tile_px", 240)), "map tiles", "", "")

# the old monster sprites (our own art) that approved rev-1/2 monster requests were sent as design references; archived
# here (no longer game assets) so those requests still reproduce their cache keys
MONSTER_SPRITES = HERE / "legacy_design"


# ───────────────────────────── inputs ─────────────────────────────

def load_character(cid: str) -> dict:
    """A character (characters.yaml) or a monster (monsters.yaml, returned with kind: monster)."""
    for entry in yaml.safe_load((HERE / "characters.yaml").read_text()):
        if entry["id"] == cid:
            return entry
    for entry in yaml.safe_load((HERE / "monsters.yaml").read_text()):
        if entry["id"] == cid:
            return {**entry, "kind": "monster"}
    for entry in KITS:
        if entry["id"] == cid:
            return {**entry, "kind": "kit"}
    raise SystemExit(f"no character, monster or kit '{cid}' in characters.yaml / monsters.yaml / kits.yaml")


def seed_for(char: dict, sheet_name: str) -> int:
    if is_kit(char):
        return kit_sheet(char, sheet_name).get("seed", 1234)
    """Approved seed for a sheet: `sheet_seeds: {<sheet>: n}` overrides the character's first seed (lets one pose of a
    per-pose boss be redrawn without changing the others' cache keys)."""
    return (char.get("sheet_seeds") or {}).get(sheet_name, char.get("seeds", [1234])[0])


def is_kit(char: dict) -> bool:
    return char.get("kind") == "kit"


def kit_sheet(char: dict, sheet_name: str) -> dict:
    return char["sheets"][sheet_name.removeprefix("kit_")]


def is_monster(char: dict) -> bool:
    return char.get("kind") == "monster"


def monster_band(char: dict) -> S.MonsterBand:
    return S.MONSTER_BANDS[char.get("size", "small")]


def design_ref(char: dict) -> Image.Image | None:
    """The monster's legacy sprite (our own art, stored at x3) back at native size, then 8x nearest on magenta."""
    path = MONSTER_SPRITES / f"{char.get('design_ref', char['id'])}.png"
    if not path.exists():
        return None
    im = Image.open(path).convert("RGBA")
    im = im.resize((im.width // 3, im.height // 3), Image.Resampling.NEAREST)
    big = im.resize((im.width * IDENTITY_UPSCALE, im.height * IDENTITY_UPSCALE), Image.Resampling.NEAREST)
    flat = Image.new("RGB", big.size, (255, 0, 255))
    flat.paste(big, (0, 0), big)
    return flat


def sheet_negative(char: dict, sheet: Sheet) -> str:
    parts = [S.NEGATIVE]
    if sheet.name == "field":
        parts.append(S.FIELD_NEGATIVE)
    elif sheet.name.startswith("field_"):
        parts += [S.FIELD_NEGATIVE, S.FIELD_DIRECTIONS[sheet.name.removeprefix("field_")][2]]
    if char.get("extra_negative"):
        parts.append(char["extra_negative"])
    return ", ".join(parts)


def gemini_prompt(char: dict, sheet: Sheet, has_identity: bool, has_house: bool = False) -> str:
    gear = char.get("battle_gear" if sheet.name == "battle" else "field_gear", "")
    names = CELL_NAMES[sheet.geom.layout]
    cells = []
    for i, name in enumerate(sheet.order):
        if sheet.name == "battle":
            cap = sheet.poses[name].caption
        elif sheet.name == "field":
            cap = f"{FIELD3_STEPS[i % 3]}, {S.FIELD_ROWS[name[:-1]]}"
        else:
            cap = f"{FIELD_STEPS[i]}, {sheet.layout_text}"
        cells.append(f"- {names[i]} cell: {cap}.")
    facing = ("Side view: the nose points LEFT and only one eye is visible."
              if sheet.name in ("battle", "field_left") else
              "Each row is one walking direction; the three cells of a row are a walk cycle, so the legs must visibly "
              "change between them." if sheet.name == "field" else "")
    house = ("Image 3 is the HOUSE STYLE: an approved sprite sheet of a DIFFERENT character from this same game. "
             "Match its sprite-pixel size, figure height, proportions, outline weight, shading and level of detail "
             "exactly, but do NOT copy its costume, colours, hair or face.\n\n") if has_house else ""
    rules = ""
    if has_house and char.get("prompt_rev", {}).get(sheet.name, 2) >= 2:   # rollout prompt rev 2 (sheets approved at rev 1 keep rev 1)
        rules = ("The grey mannequins are ONLY a pose guide: never draw grey limbs or grey shapes; draw the character's "
                 "own sleeves, hands and held items in every cell.\n\n"
                 "FACE: " + char.get("face", DEFAULT_FACE) + "\n\n")
    if not has_identity:
        identity = ""
    elif has_house:   # rollout characters: identity = their own approved battle sheet
        identity = ("Image 4 is the APPROVED LOOK of THIS character in battle poses (pixel art). Keep the same face, "
                    "hair, colours, costume shapes and proportions.\n\n")
    elif sheet.name == "field":
        identity = ("The images after the style reference show the APPROVED LOOK of this exact character (pixel art): "
                    "battle poses, then the approved front walking frames. Keep the same face, hair, colours, armour "
                    "shapes and proportions.\n\n")
    else:   # wording of the approved single-direction requests; keep stable for cache keys
        identity = ("Image 3 is the APPROVED LOOK of this exact character in battle poses (pixel art). Keep the same "
                    "face, hair, colours, armour shapes and proportions.\n\n")
    w, h = sheet.geom.layout
    return (
        f"Create a {w}x{h} sprite sheet for a modern 16-bit-style pixel-art RPG, {sheet.kind} sprites.\n\n"
        "Image 1 is a POSE GUIDE: grey mannequins on white, one per cell. Draw the SAME character once in every cell, "
        "matching that cell's mannequin pose, position and size exactly. Light grey limbs are the far side, dark grey "
        "limbs the near side; the light patch and nose bump on the head show which way the face points.\n\n"
        "Image 2 is a STYLE REFERENCE only (bead versions of classic battle sprites): match its chunky proportions "
        "(about 2.5 heads tall, oversized head, big fists and boots), black outlines around and between parts, and "
        "flat shading with 2-3 tones per colour. Do NOT copy those characters and do NOT draw bead texture.\n\n"
        + house + identity + rules +
        f"Render as true pixel art: each character {sheet.target_px} in sprite pixels, every sprite pixel a hard-edged "
        "square, no anti-aliasing, no gradients, no soft shading. " + facing + "\n\n"
        f"Character: {char['prompt'].strip()}; {gear}. Keep every costume detail identical in every cell.\n\n"
        "Cells:\n" + "\n".join(cells) + "\n\n"
        "Background: solid flat magenta (#FF00FF) everywhere, no floor, no shadows, no grid lines, no borders, "
        "no text or labels.\n"
        f"Avoid: {sheet_negative(char, sheet)}."
    )


def ref_image(ref: str) -> Image.Image:
    """An approved native sheet, 8x nearest, flattened on magenta (how references are sent to Gemini)."""
    path = HERE.parent.parent / ref
    if not path.exists():
        raise SystemExit(f"refused: reference {ref} does not exist (approve that sheet first)")
    im = Image.open(path).convert("RGBA")
    big = im.resize((im.width * IDENTITY_UPSCALE, im.height * IDENTITY_UPSCALE), Image.Resampling.NEAREST)
    flat = Image.new("RGB", big.size, (255, 0, 255))
    flat.paste(big, (0, 0), big)
    return flat


def identity_images(char: dict) -> list[Image.Image]:
    refs = char.get("identity_ref") or []
    if isinstance(refs, str):
        refs = [refs]
    return [ref_image(r) for r in refs]


def house_images(char: dict, sheet: Sheet) -> list[Image.Image]:
    """The locked house-style sheet for rollout characters (never for the house character itself)."""
    if char["id"] == S.HOUSE_CHARACTER or sheet.name not in S.HOUSE_REFS:
        return []
    return [ref_image(S.HOUSE_REFS[sheet.name])]


def allowed_sheets(char: dict) -> list[str]:
    """Sheets a character may request: NPCs are field-only (`sheets: [field]`); classes get battle + field."""
    if is_kit(char):
        return [f"kit_{n}" for n in char["sheets"]]
    if is_monster(char):
        if char.get("per_pose"):
            return [f"boss_{pose}" for pose in S.BOSS_POSES]
        return [f"monster_{char.get('size', 'small')}"]
    return char.get("sheets") or [n for n in SHEETS if not n.startswith("monster_")]


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
    if sheet.name not in allowed_sheets(char):
        raise SystemExit(f"refused: {char['id']} has no '{sheet.name}' sheet (sheets: {allowed_sheets(char)})")
    if is_kit(char):
        if backend != "gemini":
            raise SystemExit("refused: kit sheets are Gemini-only")
        from gen import gemini as GM
        ks = kit_sheet(char, sheet.name)
        size, tile = KS.geo(ks)
        refs = [ref_image(f"assets-src/gen/approved/{r if '/' in r else char['id'] + '/' + r}.png")
                for r in ks.get("refs") or []]
        if ks.get("kind") == "materials":
            guide = KS.materials_guide(ks)
            prompt = KS.materials_prompt(ks, len(refs))
        elif ks.get("kind") == "swatches":
            guide = KS.swatches_guide(ks)
            prompt = KS.swatches_prompt(ks, len(refs))
        else:
            guide = KS.guide(ks["cells"], size, tile, grid_lines=ks.get("grid_lines", True))
            prompt = KS.prompt(char, sheet.name, ks, len(refs))
        images = [guide, ref_image(S.HOUSE_REFS["field"])] + refs
        mid = model or GM.DEFAULT_MODEL
        key = GM.cache_key(prompt, images, aspect_ratio=sheet.geom.aspect, seed=seed, model=mid)
        run = lambda: GM.generate(prompt, images, aspect_ratio=sheet.geom.aspect, seed=seed, model=mid)  # noqa: E731
        return Request(char["id"], sheet, seed, backend, mid, guide, key, prompt, images, run)
    if is_monster(char):
        if backend != "gemini":
            raise SystemExit("refused: monster sheets are Gemini-only")
        from gen import gemini as GM
        band = monster_band(char)
        if sheet.name.startswith("boss_"):
            pose = sheet.name.removeprefix("boss_")
            guide = M.pose_guide(band, bool(char.get("floating")))
            identity = []
            if pose != "idle":     # attack / hurt match the approved idle pose
                identity = [ref_image(f"assets-src/gen/approved/{char['id']}/boss_idle.png")]
            images = [guide, ref_image(S.HOUSE_REFS["battle"])] + identity
            prompt = M.pose_prompt(char, band, pose, bool(identity))
        else:
            guide = M.guide(band, bool(char.get("floating")))
            rev = char.get("prompt_rev", 3)
            if rev >= 3:   # text + approved art only: house style and an approved monster sheet, never old sprites
                images = [guide, ref_image(S.HOUSE_REFS["battle"]), ref_image(S.MONSTER_STYLE_REF)]
                prompt = M.prompt(char, band, False, has_monster_ref=True)
            else:          # rev 1-2 (approved before 2026-11-12 evening): legacy sprite as design reference
                ref = design_ref(char) if char.get("design_ref", True) is not False else None
                images = [guide, ref_image(S.HOUSE_REFS["battle"])] + ([ref] if ref is not None else [])
                prompt = M.prompt(char, band, ref is not None)
        mid = model or GM.DEFAULT_MODEL
        key = GM.cache_key(prompt, images, aspect_ratio=sheet.geom.aspect, seed=seed, model=mid)
        run = lambda: GM.generate(prompt, images, aspect_ratio=sheet.geom.aspect, seed=seed, model=mid)  # noqa: E731
        return Request(char["id"], sheet, seed, backend, mid, guide, key, prompt, images, run)
    guide = G.sheet(sheet.poses, sheet.order, sheet.geom, robed=char.get("robed", False))
    if backend == "gemini":
        from gen import gemini as GM
        idents = identity_images(char) if sheet.name != "battle" else []   # identity refs are for field sheets
        if sheet.name.startswith("field_"):
            idents = idents[:1]           # single-direction sheets keep their original (approved) inputs
        house = house_images(char, sheet)
        images = [guide, style_image()] + house + idents
        prompt = gemini_prompt(char, sheet, bool(idents), bool(house))
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
                 ledger: list[dict], locked: bool = False) -> list[Request]:
    """Return the requests that would be paid; raise SystemExit if the run is not allowed."""
    misses = [r for r in requests if not r.cached]
    if not misses:
        return []
    if locked:
        raise SystemExit(f"refused: {misses[0].character} is style-locked (locked: true in characters.yaml); its "
                         "approved requests must come from the cache. Only the user may unlock it.")
    if len(misses) > max_paid:
        raise SystemExit(f"refused: {len(misses)} uncached requests would be paid, limit is {max_paid} "
                         "(only the user may raise --max-paid)")
    if not paid:
        raise SystemExit(f"refused: {len(misses)} uncached request(s) need --paid (run --dry-run to inspect first)")
    attempts = [e for e in ledger if e.get("event") == "attempt" and e.get("backend") != "bedrock"]  # cap is Gemini-only
    if BUDGET.exists():                              # the user's run-wide hard cap (budget.json)
        b = json.loads(BUDGET.read_text())
        used = len(attempts) - b["attempts_before"]
        if used + len(misses) > b["cap"]:
            raise SystemExit(f"refused: the run cap of {b['cap']} paid images is reached ({used} used); only the user "
                             "may approve more")
        run = attempts[b["attempts_before"]:]
        for r in misses:
            n = sum(1 for e in run if e.get("character") == r.character and e.get("sheet") == r.sheet.name)
            if n >= b["max_attempts_per_sheet"]:
                raise SystemExit(f"refused: {r.character}/{r.sheet.name} already used {n} attempts this run "
                                 f"(max {b['max_attempts_per_sheet']})")
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
    if sheet.name.startswith(("monster_", "boss_")):
        frames, info = M.cut(raw, monster_band(char), bool(char.get("floating")),
                             colors=char.get("palette_size", 16), seed=seed,
                             n_cells=1 if sheet.name.startswith("boss_") else 3,
                             cell=sheet.geom.grid[0] if sheet.name.startswith("boss_") else None,
                             foot_row=sheet.geom.bottom_row if sheet.name.startswith("boss_") else None,
                             haze=bool(char.get("haze")))
        info["report"] = M.frame_report(frames, monster_band(char))
        LAST_RESAMPLE[sheet.name] = info
        return frames
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
            return [trim(f, geom) for f in frames]
        if geom.fit_height and mismatch <= 0.25:
            LAST_RESAMPLE[sheet.name]["mode"] = f"native-scaled (art cell {cell_w:.0f}x{cell_h:.0f} vs grid {geom.grid})"
            return native_scaled(native, masks, sheet, colors, seed, cell_w, cell_h)
        LAST_RESAMPLE[sheet.name]["mode"] = f"resampled (art cell {cell_w:.0f}x{cell_h:.0f} vs grid {geom.grid})"
    else:
        LAST_RESAMPLE[sheet.name]["mode"] = "resampled (no pixel grid)"
    cw, ch = geom.cell_px
    boxes = [((i % cols) * cw, (i // cols) * ch, (i % cols + 1) * cw, (i // cols + 1) * ch) for i in range(len(sheet.order))]
    if geom.fit_height:
        boxes = fit_boxes(cleaned, masks, boxes, geom)
        LAST_RESAMPLE[sheet.name]["fit_height"] = geom.fit_height
    cells, gms, pixel_sets, detail_sets = [], [], [], []
    for i, box in enumerate(boxes):
        cell = crop_padded(cleaned, box)
        gm = crop_padded(Image.fromarray((np.pad(masks[i], 0) * 255).astype(np.uint8)), _rel(box, i, cols, cw, ch))
        gm = np.asarray(gm.resize(cell.size, Image.Resampling.NEAREST)) > 0
        rgb = np.asarray(cell.convert("RGB"))
        fg = PX.foreground(rgb, gm)
        pixel_sets.append(rgb[fg])
        detail_sets.append(rgb[PX.detail_mask(rgb, fg, cell.size[1] / geom.grid[1])])
        cells.append(cell); gms.append(gm)
    palette = PX.sheet_palette(pixel_sets, colors, seed, detail_px=np.concatenate(detail_sets))
    frames = [PX.pixelize(c, g, geom.grid, colors=colors, seed=seed, bottom_row=geom.bottom_row, palette=palette)
              for c, g in zip(cells, gms)]
    return [trim(f, geom) for f in frames]


def native_scaled(native: Image.Image, masks, sheet: Sheet, colors: int, seed: int,
                  cell_w: float, cell_h: float) -> list[Image.Image]:
    """Pixel art drawn on a clean grid but at a slightly different figure size: scale the art pixels themselves
    (nearest neighbour, one shared factor so the tallest figure is fit_height rows), then cut 1:1 with one shared
    palette. No blending, so 1-pixel features such as eyes survive."""
    geom = sheet.geom
    cols = geom.layout[0]
    arts, gms, heights = [], [], []
    for i in range(len(sheet.order)):
        cx, cy = i % cols, i // cols
        art = native.crop((int(round(cx * cell_w)), int(round(cy * cell_h)), int(round((cx + 1) * cell_w)), int(round((cy + 1) * cell_h))))
        gm = np.asarray(Image.fromarray((masks[i] * 255).astype(np.uint8)).resize(art.size, Image.Resampling.NEAREST)) > 0
        rgb = np.asarray(art.convert("RGB"))
        fg = PX.foreground(rgb, gm, dilate=max(3, (min(art.size) // 20) | 1))
        ys = np.where(fg.any(1))[0]
        heights.append(int(ys.max() - ys.min() + 1) if len(ys) else 0)
        arts.append(art); gms.append(gm)
    f = geom.fit_height / max(heights)
    LAST_RESAMPLE[sheet.name]["scale"] = round(f, 3)
    scaled, smasks, pixel_sets = [], [], []
    for art, gm in zip(arts, gms):
        size = (max(1, round(art.width * f)), max(1, round(art.height * f)))
        a = art.resize(size, Image.Resampling.NEAREST)
        m = np.asarray(Image.fromarray((gm * 255).astype(np.uint8)).resize(size, Image.Resampling.NEAREST)) > 0
        rgb = np.asarray(a.convert("RGB"))
        pixel_sets.append(rgb[PX.foreground(rgb, m, dilate=max(3, (min(size) // 20) | 1))])
        scaled.append(a); smasks.append(m)
    palette = PX.sheet_palette(pixel_sets, colors, seed)
    frames = []
    for a, m in zip(scaled, smasks):
        frame, rep = PX.pixelize_native(a, m, geom.grid, colors=colors, seed=seed, bottom_row=geom.bottom_row, palette=palette)
        if rep.get("cropped"):
            LAST_RESAMPLE[sheet.name]["cropped"] = LAST_RESAMPLE[sheet.name].get("cropped", []) + ["?"]
        frames.append(frame)
    return [trim(fr, geom) for fr in frames]


def trim(frame: Image.Image, geom: S.SheetGeom) -> Image.Image:
    """Centre-crop a frame to geom.trim_width (drops the cell margins of the 3x3 field sheet)."""
    if not geom.trim_width or frame.width == geom.trim_width:
        return frame
    x0 = (frame.width - geom.trim_width) // 2
    return frame.crop((x0, 0, x0 + geom.trim_width, frame.height))


def frame_size(geom: S.SheetGeom) -> tuple[int, int]:
    return (geom.trim_width or geom.grid[0], geom.grid[1])


def _rel(box, i, cols, cw, ch):
    """Box relative to its own cell (for cropping that cell's guide mask)."""
    ox, oy = (i % cols) * cw, (i // cols) * ch
    return (box[0] - ox, box[1] - oy, box[2] - ox, box[3] - oy)


def crop_padded(img: Image.Image, box) -> Image.Image:
    """Crop that may extend past the image; outside pixels take the image's border colour (the background)."""
    x0, y0, x1, y1 = (int(round(v)) for v in box)
    bg = img.getpixel((0, 0))
    out = Image.new(img.mode, (x1 - x0, y1 - y0), bg)
    out.paste(img.crop((max(0, x0), max(0, y0), min(img.width, x1), min(img.height, y1))), (max(0, -x0), max(0, -y0)))
    return out


def fit_boxes(img: Image.Image, masks, boxes, geom: S.SheetGeom):
    """One shared scale for the sheet: crop boxes sized so the tallest figure maps to fit_height native rows,
    bottom-aligned to bottom_row and centred on each cell's figure (so walk frames keep their relative motion)."""
    rgb = np.asarray(img.convert("RGB"))
    figs = []
    for box in boxes:
        x0, y0, x1, y1 = box
        sub = rgb[y0:y1, x0:x1]
        gm = masks[len(figs)]
        fg = PX.foreground(sub, gm)
        ys, xs = np.where(fg)
        figs.append((x0 + xs.min(), y0 + ys.min(), x0 + xs.max(), y0 + ys.max()))
    tallest = max(b[3] - b[1] + 1 for b in figs)
    gw, gh = geom.grid
    px_per_native = tallest / geom.fit_height
    bw, bh = gw * px_per_native, gh * px_per_native
    out = []
    for fx0, fy0, fx1, fy1 in figs:
        cx = (fx0 + fx1 + 1) / 2
        bottom = fy1 + 1 + (gh - 1 - geom.bottom_row) * px_per_native
        out.append((cx - bw / 2, bottom - bh, cx + bw / 2, bottom))
    return out


def native_sheet(frames: list[Image.Image], geom: S.SheetGeom) -> Image.Image:
    cols, rows = geom.layout
    gw, gh = frame_size(geom)
    if geom.name.startswith(("monster_", "boss_")):    # monster cells may be widened to fit a pose
        gw, gh = frames[0].size
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
        if name.startswith(("monster_", "boss_")):
            mchar = load_character(char_id)
            raw = Image.open(raw_path).convert("RGBA")
            frames = cut_frames(raw, M.guide(monster_band(mchar)), sheet, mchar, seed)
            native_sheet(frames, sheet.geom).save(outdir / f"{name}.png")
            results[name] = (raw, frames)
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


def kit_preview(kit_id: str, sheet: Image.Image, report: dict, raw: Image.Image, sheet_name: str = "") -> Image.Image:
    """Raw | cut at 2x | the town map baked with the approved kit plus this candidate sheet (not approved)."""
    sys.path.insert(0, str(HERE.parent / "tools"))
    import build_map as BM
    import kit as KT
    k = KT.load_kit(kit_id)
    arr = np.asarray(sheet.convert("RGBA"))
    for name, (x, y, w, h) in report.get("materials", {}).items():
        k.materials[name] = arr[y:y + h, x:x + w, :3].copy()
        k.approved.add(name)
    for r_, row in enumerate(report.get("cells", [])):
        for c_, name in enumerate(row):
            if name:
                k.parts[name] = sheet.crop((c_ * 48, r_ * 48, (c_ + 1) * 48, (r_ + 1) * 48)).convert("RGBA")
                k.approved.add(name)
    srcs = sorted((HERE.parent / "maps").glob("*.yaml"))
    src = yaml.safe_load(srcs[0].read_text())
    c = BM.compile_map(src, k)
    town = Image.fromarray(c.below).convert("RGBA")
    town.alpha_composite(Image.fromarray(c.above))
    town.save(OUT / "gemini" / kit_id / f"preview_town_{sheet_name or 'full'}.png")
    town = town.resize((town.width // 2, town.height // 2), Image.Resampling.LANCZOS)
    s2 = sheet.resize((sheet.width * 2, sheet.height * 2), Image.Resampling.NEAREST)
    rs = raw.convert("RGBA").resize((480, 480))
    out = Image.new("RGBA", (rs.width + s2.width + town.width + 48, max(rs.height, s2.height, town.height) + 40),
                    (40, 40, 44, 255))
    out.alpha_composite(rs, (0, 20)); out.alpha_composite(s2, (rs.width + 16, 20))
    out.alpha_composite(town, (rs.width + s2.width + 32, 20))
    d = ImageDraw.Draw(out)
    d.text((4, 4), "raw", fill="white"); d.text((rs.width + 20, 4), "cut 2x", fill="white")
    d.text((rs.width + s2.width + 36, 4), f"{src['id']} with this sheet (half size)", fill="white")
    d.text((4, out.height - 16), "PASS " + str(report["pass"]) + f"  wrap {report.get('wrap_after')}", fill="white")
    return out


def write_kit(outdir: Path, char: dict, r: Request, raw: Image.Image, seed: int) -> dict:
    """Cut a kit sheet and write <sheet>_{guide,raw}.png, <sheet>.png (48 px tiles), <sheet>_report.json, review.png."""
    ks = kit_sheet(char, r.sheet.name)
    if ks.get("kind") == "materials":
        sheet, report = KS.cut_materials(raw, ks, seed)
        house = HERE / "approved" / char["id"] / "house.png"
        if not house.exists():
            house = HERE / "approved" / "town" / "house.png"
        r.guide.save(outdir / f"{r.sheet.name}_guide.png")
        raw.save(outdir / f"{r.sheet.name}_raw.png")
        sheet.save(outdir / f"{r.sheet.name}.png")
        (outdir / f"{r.sheet.name}_report.json").write_text(json.dumps(report, indent=2) + "\n")
        KS.materials_review(raw, sheet, report, Image.open(house) if house.exists() else None).save(outdir / f"{r.sheet.name}_review.png")
        print(f"{char['id']}/{r.sheet.name} seed {seed}: {json.dumps(report)}\n  -> {outdir / (r.sheet.name + "_review.png")}")
        return report
    if ks.get("kind") == "swatches":
        sheet, report = KS.cut_swatches(raw, ks, seed)
        r.guide.save(outdir / f"{r.sheet.name}_guide.png")
        raw.save(outdir / f"{r.sheet.name}_raw.png")
        sheet.save(outdir / f"{r.sheet.name}.png")
        (outdir / f"{r.sheet.name}_report.json").write_text(json.dumps(report, indent=2) + "\n")
        kit_preview(char["id"], sheet, report, raw, r.sheet.name).save(outdir / f"{r.sheet.name}_review.png")
        print(f"{char['id']}/{r.sheet.name} seed {seed}: {json.dumps(report)}\n  -> {outdir / (r.sheet.name + '_review.png')}")
        return report
    cells = ks["cells"]
    size, tile = KS.geo(ks)
    sheet, report = KS.cut(raw, cells, seed, size, tile, ks.get("derive"), hairlines=ks.get("grid_lines", True),
                           prefab=ks.get("prefab"))
    r.guide.save(outdir / f"{r.sheet.name}_guide.png")
    raw.save(outdir / f"{r.sheet.name}_raw.png")
    sheet.save(outdir / f"{r.sheet.name}.png")
    (outdir / f"{r.sheet.name}_report.json").write_text(json.dumps(report, indent=2) + "\n")
    KS.review(raw, sheet, report, cells).save(outdir / f"{r.sheet.name}_review.png")
    print(f"{char['id']}/{r.sheet.name} seed {seed}: {json.dumps(report)}\n  -> {outdir / (r.sheet.name + "_review.png")}")
    return report


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
        if (args.repixelize / "kit_house_raw.png").exists() or list(args.repixelize.glob("kit_*_raw.png")):
            kit = load_character(args.repixelize.parent.name)
            for raw_path in sorted(args.repixelize.glob("kit_*_raw.png")):
                name = raw_path.name.removesuffix("_raw.png")
                req = plan_request(kit, SHEETS[name], int(args.repixelize.name), "gemini", None)
                write_kit(args.repixelize, kit, req, Image.open(raw_path).convert("RGB"), req.seed)
            return
        repixelize(args.repixelize)
        return
    if not args.character or not args.backend:
        ap.error("character and --backend are required (or use --repixelize OUT_DIR)")
    char = load_character(args.character)
    seeds = [int(s) for s in args.seeds.split(",")] if args.seeds else char.get("seeds", [1234])
    names = [allowed_sheets(char)[0] if n == "monster" else n for n in args.sheets.split(",")]
    unknown = [n for n in names if n not in SHEETS]
    if unknown:
        ap.error(f"unknown sheets {unknown}; choose from {list(SHEETS)}")

    if args.seeds:
        plan = [(seed, plan_request(char, SHEETS[n], seed, args.backend, args.model)) for seed in seeds for n in names]
    else:
        plan = [(seed_for(char, n), plan_request(char, SHEETS[n], seed_for(char, n), args.backend, args.model))
                for n in names]
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

    check_budget([r for _, r in plan], paid=args.paid, max_paid=args.max_paid, retry=args.retry, ledger=read_ledger(),
                 locked=bool(char.get("locked")))
    by_seed: dict[int, dict] = {}
    for seed, r in plan:
        outdir = OUT / args.backend / char["id"] / str(seed)
        outdir.mkdir(parents=True, exist_ok=True)
        raw = execute(r)
        if is_kit(char):
            write_kit(outdir, char, r, raw, seed)
            continue
        frames = cut_frames(raw, r.guide, r.sheet, char, seed)
        write_outputs(outdir, r.sheet, r.guide, raw, frames)
        by_seed.setdefault(seed, {})[r.sheet.name] = (raw, frames)
    for seed, results in by_seed.items():
        outdir = OUT / args.backend / char["id"] / str(seed)
        print(f"{char['id']} seed {seed}: {review(char['id'], seed, results, outdir, args.model or args.backend)}")


if __name__ == "__main__":
    main()
