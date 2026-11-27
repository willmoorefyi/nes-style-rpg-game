"""Pass CFP (docs/CLASS_FIELD_PACKS_PLAN.md): build the ChatGPT walk-sheet packs of new hero classes' field sprites.

A hero class with a battle sheet but no overworld (field) sheet gets a pack: a ready-to-paste prompt and the reference
images. The user renders the 3 x 3 field sheet (144 x 288, cells 48 x 96, rows front / back / side facing left, columns
stand / step A / step B, soles on row 93) in ChatGPT and gen/field_user.py imports it. Offline only: numpy / Pillow
compositing of tracked approved art and the class's battle sheet; no AI or image call of any kind; nothing in the repo
is written.

  python3 -I assets-src/gen/class_field_pack.py --all [--out DIR]          # every class of the data file
  python3 -I assets-src/gen/class_field_pack.py barbarian berserker        # some classes (the index lists them all)
  python3 -I assets-src/gen/class_field_pack.py --check                    # validate the data file only

Adding a class: add its entry, and its partner's, to gen/class_field_packs.yaml (keys in the file's header: name,
tier, partner, battle_sheet, row, cell, body_box, poses, weapon_view, stand_in, look, carry) and run the tool with its
id. The prompt is gen/class_field_pack_prompt.txt (one template for every class). Default --out:
~/temp/ff-game/class_field_packs. Per pack: prompt.txt, README.md, design_reference.png, design_native.png,
poses_reference.png, poses_native_144x288.png, walk_reference.png, grid_guide.png; at the root README.md (the index)
and _template/.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import numpy as np
import yaml
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
DATA = HERE / "class_field_packs.yaml"
TEMPLATE = HERE / "class_field_pack_prompt.txt"
APPROVED = HERE / "approved"
OUT = Path.home() / "temp/ff-game/class_field_packs"
GW, GH, FOOT = 48, 96, 93
COLUMNS = ("ready", "attack", "cast", "hurt", "down", "victory", "kneel")
KEYS = ("name", "tier", "partner", "battle_sheet", "row", "cell", "body_box", "poses", "weapon_view", "stand_in",
        "look", "carry")
DEFAULTS = {"walk_reference": "boy", "height": 88, "max_height": 92, "max_width": 46}
BG = (200, 204, 196, 255)
INK, SOFT = (20, 20, 20, 255), (70, 70, 70, 255)
ROW_LABELS = ("DOWN\n(front)", "UP\n(back)", "LEFT\n(side,\nfacing\nleft)")
COL_LABELS = ("stand", "step A", "step B")


def _font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    name = "Arial Bold.ttf" if bold else "Arial.ttf"
    try:
        return ImageFont.truetype(f"/System/Library/Fonts/Supplemental/{name}", size)
    except OSError:
        return ImageFont.load_default()


class PackError(SystemExit):
    pass


# ---------------------------------------------------------------- data
def load(path: Path = DATA, approved: Path | None = None) -> tuple[dict, dict]:
    """(defaults, entries) of the data file, validated (PackError naming the entry and field)."""
    raw = yaml.safe_load(path.read_text()) or {}
    defaults = {**DEFAULTS, **(raw.pop("defaults", None) or {})}
    for cid, e in raw.items():
        validate(cid, e, raw, defaults, approved)
    return defaults, raw


def validate(cid: str, e: dict, entries: dict, defaults: dict, approved: Path | None = None) -> None:
    approved = approved or APPROVED

    def bad(field: str, why: str) -> None:
        raise PackError(f"{cid}: {field}: {why}")

    for k in KEYS:
        if k not in e:
            bad(k, "missing")
    if e["tier"] not in ("base", "enhanced"):
        bad("tier", "must be base or enhanced")
    p = entries.get(e["partner"])
    if not p or p.get("partner") != cid or p.get("tier") == e["tier"]:
        bad("partner", f"{e['partner']!r} must be an entry of the other tier naming {cid!r} back")
    cw, ch = e["cell"]
    if e["body_box"] is not None:
        x0, y0, x1, y1 = e["body_box"]
        if not (0 <= x0 < x1 <= cw and 0 <= y0 < y1 <= ch):
            bad("body_box", f"{e['body_box']} not inside the {cw} x {ch} cell")
    for pose in list(e["poses"]) + ([e["weapon_view"]] if e["weapon_view"] else []):
        if pose not in COLUMNS:
            bad("poses", f"unknown pose {pose!r} (one of {', '.join(COLUMNS)})")
    if not e["poses"]:
        bad("poses", "empty")
    stand_meta(e["stand_in"], approved, lambda why: bad("stand_in", why))
    stand_meta(defaults["walk_reference"], approved, lambda why: bad("walk_reference", why))


def _raise(why: str) -> None:
    raise PackError(why)


def stand_meta(sid: str, approved: Path, fail=_raise) -> dict:
    j = approved / sid / "field.json"
    if not j.exists() or not j.with_suffix(".png").exists():
        fail(f"{sid!r} has no approved field sheet ({j.parent.name}/field.png + .json)")
    meta = json.loads(j.read_text())
    if (meta.get("grid") != [GW, GH] or meta.get("rows") != ["down", "up", "left"]
            or meta.get("frames") != ["stand", "step_left", "step_right"]):
        fail(f"{sid!r}: field sheet is not a 3 x 3 grid of {GW} x {GH} (rows down, up, left; stand and two steps)")
    if meta.get("head_from") or meta.get("row_from"):
        fail(f"{sid!r}: field sheet has head_from / row_from fixes this reader does not apply")
    return meta


def sheet_path(e: dict) -> Path:
    p = Path(e["battle_sheet"]).expanduser()
    return p if p.is_absolute() else HERE / p


# ---------------------------------------------------------------- images
def field_sheet(sid: str, approved: Path | None = None) -> Image.Image:
    """The 144 x 288 field sheet as the game draws it (flip_frames, flip_rows applied: the side row faces LEFT)."""
    approved = approved or APPROVED
    meta = stand_meta(sid, approved)
    img = Image.open(approved / sid / "field.png").convert("RGBA")
    out = img.copy()
    for r, d in enumerate(meta["rows"]):
        flips = set(meta.get("flip_frames", {}).get(d, []))
        for c in range(3):
            fr = img.crop((c * GW, r * GH, (c + 1) * GW, (r + 1) * GH))
            if (c in flips) != (d in meta.get("flip_rows", [])):
                fr = fr.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            out.paste(fr, (c * GW, r * GH))
    return out


def battle_crop(e: dict, pose: str, whole: bool = False) -> Image.Image:
    """The class's pose cell (or its body box) from its battle sheet row, cropped to the opaque box + 2 px."""
    sheet = Image.open(sheet_path(e)).convert("RGBA")
    cw, ch = e["cell"]
    if sheet.width < cw * len(COLUMNS) or sheet.height < ch * (e["row"] + 1):
        raise PackError(f"{sheet_path(e).name}: {sheet.size} too small for row {e['row']} of {cw} x {ch} cells")
    x, y = COLUMNS.index(pose) * cw, e["row"] * ch
    box = (x, y, x + cw, y + ch)
    if e["body_box"] and not whole:
        x0, y0, x1, y1 = e["body_box"]
        box = (x + x0, y + y0, x + x1, y + y1)
    return sheet.crop(box)


def trim(img: Image.Image, pad: int = 2) -> Image.Image:
    a = np.asarray(img)[..., 3] > 0
    if not a.any():
        return img
    ys, xs = np.where(a)
    return img.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(img.width, xs.max() + pad + 1),
                     min(img.height, ys.max() + pad + 1)))


def big(img: Image.Image, k: int) -> Image.Image:
    return img.resize((img.width * k, img.height * k), Image.Resampling.NEAREST)


def design_reference(cid: str, e: dict, entries: dict) -> tuple[Image.Image, Image.Image]:
    """(labelled design_reference.png, design_native.png)."""
    panels = [(f"{e['name'].upper()}: {p.upper()} (battle pose)", trim(battle_crop(e, p)), 4) for p in e["poses"]]
    if e["weapon_view"]:
        panels.append((f"weapon design ({e['weapon_view'].upper()}, whole cell):\ndraw it SHORTER in the field",
                       trim(battle_crop(e, e["weapon_view"], whole=True)), 2))
    if e["tier"] == "enhanced":
        p = entries[e["partner"]]
        panels.append((f"the same person before promotion:\n{p['name'].upper()} ({p['poses'][0].upper()})",
                       trim(battle_crop(p, p["poses"][0])), 2))
    font = _font(20, True)
    tm, gap, lm = 64, 48, 24
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    widths = [max(im.width * k, int(probe.multiline_textbbox((0, 0), label, font=font)[2])) for label, im, k in panels]
    w = lm + sum(widths) + gap * (len(panels) - 1) + lm
    h = tm + max(im.height * k for _, im, k in panels) + 24
    out = Image.new("RGBA", (w, h), BG)
    d = ImageDraw.Draw(out)
    x = lm
    for (label, im, k), pw in zip(panels, widths):
        out.alpha_composite(big(im, k), (x + (pw - im.width * k) // 2, h - 24 - im.height * k))
        d.multiline_text((x, 8), label, font=font, fill=INK)
        x += pw + gap
    natives = [im for _, im, _ in panels]
    nat = Image.new("RGBA", (sum(i.width for i in natives) + 8 * (len(natives) + 1), max(i.height for i in natives) + 16),
                    BG)
    x = 8
    for im in natives:
        nat.alpha_composite(im, (x, nat.height - 8 - im.height))
        x += im.width + 8
    return out, nat


def poses_reference(sheet: Image.Image) -> Image.Image:
    """The stand-in sheet x4, labelled in the margins only (no guide lines: ChatGPT copies them)."""
    k, lm, tm = 4, 150, 76
    title = "reference hero: layout, size and poses only (do not copy the design)"
    tw = int(ImageDraw.Draw(Image.new("RGBA", (1, 1))).textbbox((0, 0), title, font=_font(20, True))[2])
    out = Image.new("RGBA", (max(lm + 3 * GW * k + 30, 12 + tw + 20), tm + 3 * GH * k + 24), BG)
    out.alpha_composite(big(sheet, k), (lm, tm))
    d = ImageDraw.Draw(out)
    d.text((12, 8), title, font=_font(20, True), fill=INK)
    for c, name in enumerate(COL_LABELS):
        d.text((lm + c * GW * k + 60, 46), name, font=_font(18), fill=SOFT)
    for r, name in enumerate(ROW_LABELS):
        d.multiline_text((12, tm + r * GH * k + 120), name, font=_font(20, True), fill=INK)
    return out


def grid_guide(sheet: Image.Image, defaults: dict) -> Image.Image:
    """For the user (checking a render), NOT for ChatGPT: cell borders, feet line, head line, side margins."""
    g, m = 4, 20
    head = FOOT + 1 - defaults["height"]
    out = Image.new("RGBA", (3 * GW * g + 2 * m + 440, 3 * GH * g + 2 * m), (255, 255, 255, 255))
    out.alpha_composite(big(sheet, g), (m, m))
    d = ImageDraw.Draw(out)
    for r in range(3):
        y0 = m + r * GH * g
        d.line([(m, y0 + (FOOT + 1) * g), (m + 3 * GW * g, y0 + (FOOT + 1) * g)], fill=(230, 0, 0), width=1)
        d.line([(m, y0 + head * g), (m + 3 * GW * g, y0 + head * g)], fill=(0, 160, 0), width=1)
        top = FOOT + 1 - defaults["max_height"]
        d.line([(m, y0 + top * g), (m + 3 * GW * g, y0 + top * g)], fill=(200, 120, 0), width=1)
    for c in range(3):
        for dx in (1, GW - 1):
            x = m + (c * GW + dx) * g
            d.line([(x, m), (x, m + 3 * GH * g)], fill=(255, 150, 220), width=1)
    for i in range(4):
        d.line([(m + i * GW * g, m), (m + i * GW * g, m + 3 * GH * g)], fill=(0, 120, 255), width=2)
        d.line([(m, m + i * GH * g), (m + 3 * GW * g, m + i * GH * g)], fill=(0, 120, 255), width=2)
    notes = [f"Field sheet: 144 x 288 px, 3 x 3 cells of {GW} x {GH}.",
             "Rows: DOWN (front), UP (back), LEFT (side,", "  facing left). Columns: stand, step A, step B",
             "  (step A and B: opposite feet forward).",
             f"Red: feet line (row {FOOT} is the last drawn row).",
             f"Green: head top near row {head} (~{defaults['height']} px).",
             f"Orange: the cap (row {FOOT + 1 - defaults['max_height']}: at most {defaults['max_height']} px tall,",
             "  horns, crest and weapon included).",
             f"Pink: 1 px side margins (at most {defaults['max_width']} px wide).",
             "One connected figure per cell, nothing floating.",
             "Transparent background, <= 16 colours,", "  dark outline, light from the top left.",
             "Not for ChatGPT: it copies guide lines."]
    for i, t in enumerate(notes):
        d.text((3 * GW * g + 2 * m + 10, m + 10 + i * 26), t, font=_font(16), fill=(0, 0, 0))
    return out


# ---------------------------------------------------------------- text
def prompt(cid: str, e: dict, entries: dict, defaults: dict, template: Path = TEMPLATE) -> str:
    p = entries[e["partner"]]
    enhanced = e["tier"] == "enhanced"
    promotion = (f" This is the same person as the {p['name']} (the base class) after a class promotion: recognisably "
                 f"the {p['name']}'s face and build, a few years older, now with the richer outfit and gear described "
                 f"here." if enhanced else "")
    partner_attach = (f" Its right-hand panel shows the same person before promotion, the {p['name'].upper()}, for the "
                      f"face and build only." if enhanced else "")
    return template.read_text().format(
        attach_count="three", NAME=e["name"].upper(), look=e["look"].strip().rstrip("."),
        carry=e["carry"].strip().rstrip("."), promotion=promotion, partner_attach=partner_attach,
        height=defaults["height"], head_row=FOOT + 1 - defaults["height"], max_height=defaults["max_height"],
        max_width=defaults["max_width"])


def readme(cid: str, e: dict, entries: dict, defaults: dict) -> str:
    p = entries[e["partner"]]
    extra = ""
    if e["tier"] == "enhanced":
        extra = (f"\nOptional, once the {p['name']}'s own field sheet is approved "
                 f"(`assets-src/gen/approved/{e['partner']}/field.png`): attach it as a 4th image and add to the "
                 f"prompt: \"(4) the {p['name'].upper()}'s approved walking sheet: the same person before promotion; "
                 f"keep the face, build and proportions.\"\n")
    return f"""# {cid} ({e['name']}, {e['tier']} class; pair {e['partner']}) - field walk-sheet pack (pass CFP)

1. Open a new ChatGPT image chat and attach, in this order:
   1. `design_reference.png` - who to draw (the {e['name']}'s battle poses{', the weapon cell' if e['weapon_view'] else ''}{', and the ' + p['name'] + ' before promotion' if e['tier'] == 'enhanced' else ''})
   2. `poses_reference.png` - the layout, size and poses (an existing hero, `{e['stand_in']}`; not its design)
   3. `walk_reference.png` - the foot alternation (copy the timing only)
2. Paste the whole of `prompt.txt`.
3. Save the result as `~/temp/{cid}_field_sheet.png`.
{extra}
Check before handing it back (`grid_guide.png` shows the lines; do not attach it, ChatGPT copies guide lines):
- 3 rows (front, back, side facing LEFT) x 3 columns (stand, step A, step B); step A and step B with opposite feet;
- the same character in all nine; about {defaults['height']} px tall, at most {defaults['max_height']} px with horns,
  crest and weapon, at most {defaults['max_width']} px wide; soles on row {FOOT};
- one connected figure per cell, the gear touching the body, nothing floating; the weapon inside its cell;
- no grid lines, transparent or flat magenta background.

Import (`assets-src/gen/field_user.py`, docs/PLAYTEST_ART_PLAN.md 4.1):
1. copy the render to `assets-src/gen/user_art/{cid}/field_<date>.png`;
2. add a `{cid}:` recipe to `assets-src/gen/field_user.yaml`: `file`, `sha256`, `band: adult`, `side_faces: right`
   only if the side row was drawn facing right, the provenance (`tool`, `rendered`, `author`,
   `refs.pack: ~/temp/ff-game/class_field_packs/{cid}`);
3. `python3 -I assets-src/gen/field_user.py cut {cid}`, review, then `field_user.py approve {cid}`;
4. delete the `{cid}:` line of `assets-src/gen/field_alias.yaml` (the TEMPORARY stand-in alias, branch
   class-barbarian and the class branches) and rebuild the `field_ai` stage (`python3 -I assets-src/build_assets.py field_ai`).

Other files: `design_native.png` (the design crops at 1x), `poses_native_144x288.png` (the reference hero at 1x, the
exact target format).
"""


def index(entries: dict, ids: list[str]) -> str:
    rows = "\n".join(f"| `{c}` | {entries[c]['name']} | {entries[c]['tier']} | `{entries[c]['partner']}` | "
                     f"`{entries[c]['stand_in']}` | `~/temp/{c}_field_sheet.png` |" for c in ids)
    return f"""# Class field walk-sheet packs (pass CFP)

ChatGPT packs for the overworld (field) walking sheets of the hero classes that have a battle sheet but no field sheet.
Built offline by `assets-src/gen/class_field_pack.py` from `assets-src/gen/class_field_packs.yaml` (no AI call). Plan:
`docs/CLASS_FIELD_PACKS_PLAN.md`.

For each pack: attach `design_reference.png`, `poses_reference.png`, `walk_reference.png` in that order, paste
`prompt.txt`, save the result under the name below and hand it back for `assets-src/gen/field_user.py` (each pack's
README lists the import steps).

| pack | class | tier | pair | pose reference (stand-in) | save as |
|---|---|---|---|---|---|
{rows}

## Adding a class

1. Add an entry for the class and its partner to `assets-src/gen/class_field_packs.yaml` (copy an existing pair; the
   keys are described in the file's header; `_template/README.md` repeats them).
2. `python3 -I assets-src/gen/class_field_pack.py <id> <partner>` (or `--all`); `--check` validates the data only.
3. Look at the pack's images (crops, labels, the side row facing left) before sending it.

`_template/prompt_template.txt` is the one prompt template every pack uses (`assets-src/gen/class_field_pack_prompt.txt`).
"""


TEMPLATE_README = """# Adding a class to the field walk-sheet packs

One entry per class in `assets-src/gen/class_field_packs.yaml` (and one for its partner):

```yaml
myclass:
  name: Myclass                 # display name in the prompt
  tier: base                    # base | enhanced
  partner: myclass_plus         # the other class of the pair; it must name this one back, with the other tier
  battle_sheet: ~/temp/heroes/myclass_sprite_sheet.png   # ~ expanded; relative = from assets-src/gen
  row: 0                        # 0 = base, 1 = enhanced
  cell: [80, 80]                # battle cell size (an oversize sheet: e.g. [160, 144])
  body_box: null                # [x0, y0, x1, y1] inside the cell (exclusive end) for an oversize sheet, else null
  poses: [ready, victory]       # ready attack cast hurt down victory kneel
  weapon_view: null             # a pose whose whole cell is also shown (a long weapon), else null
  stand_in: warrior             # a hero with an approved 3 x 3 field sheet: the pose / grid reference
  look: >-
    who the character is, as it reads at field size (build, hair, face, outfit, colours, gear)
  carry: >-
    how the weapon / shield is carried while walking; inside the 48 x 96 cell and touching the body
```

Then `python3 -I assets-src/gen/class_field_pack.py myclass myclass_plus`. `prompt_template.txt` here is the template
the prompts are filled from (placeholders in braces).
"""


# ---------------------------------------------------------------- build
def save(img: Image.Image, path: Path) -> None:
    img.save(path, "PNG")


def build(ids: list[str], out: Path, data: Path = DATA, template: Path = TEMPLATE,
          approved: Path | None = None) -> list[Path]:
    """Write the packs of `ids` (and the root index of every entry, and _template/) under `out`."""
    defaults, entries = load(data, approved)
    unknown = [c for c in ids if c not in entries]
    if unknown:
        raise PackError(f"unknown class id(s): {', '.join(unknown)} (entries: {', '.join(entries)})")
    for c in ids:
        if not sheet_path(entries[c]).exists():
            raise PackError(f"{c}: battle_sheet {sheet_path(entries[c])} not found")
    out.mkdir(parents=True, exist_ok=True)
    walk = field_sheet(defaults["walk_reference"], approved)
    written = []
    for c in ids:
        e = entries[c]
        d = out / c
        if d.exists():
            shutil.rmtree(d)
        d.mkdir(parents=True)
        des, nat = design_reference(c, e, entries)
        stand = field_sheet(e["stand_in"], approved)
        save(des, d / "design_reference.png")
        save(nat, d / "design_native.png")
        save(poses_reference(stand), d / "poses_reference.png")
        save(stand, d / "poses_native_144x288.png")
        save(walk, d / "walk_reference.png")
        save(grid_guide(stand, defaults), d / "grid_guide.png")
        (d / "prompt.txt").write_text(prompt(c, e, entries, defaults, template))
        (d / "README.md").write_text(readme(c, e, entries, defaults))
        written.append(d)
    (out / "README.md").write_text(index(entries, list(entries)))
    t = out / "_template"
    t.mkdir(exist_ok=True)
    (t / "prompt_template.txt").write_text(template.read_text())
    (t / "README.md").write_text(TEMPLATE_README)
    return written


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--check", action="store_true", help="validate the data file only")
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--data", type=Path, default=DATA)
    a = ap.parse_args(argv)
    defaults, entries = load(a.data)
    if a.check:
        print(f"class_field_packs: {len(entries)} entries OK ({', '.join(entries)})")
        return 0
    ids = list(entries) if a.all else a.ids
    if not ids:
        ap.error("name class ids or --all")
    for d in build(ids, a.out.expanduser(), a.data):
        print(f"pack {d}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
