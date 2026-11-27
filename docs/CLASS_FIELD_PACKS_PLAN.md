# Class field packs (pass CFP): ChatGPT walk-sheet packs for new hero classes

User request (2026-11-27): "let's build out a walk-sheet pack that has reference images to build out the overworld
walking poses for all 4 characters. Build it in such a way we can extend it for even more character classes in the
future."

The four new class pairs (barbarian -> berserker, hunter -> ranger, landsknecht -> dragoon, legionnaire -> centurion)
have user-rendered battle sheets but no field (overworld) walk sheet: on branch class-barbarian their field art is a
TEMPORARY alias (`gen/field_alias.yaml`: barbarian -> warrior, berserker -> knight). Each of the 8 classes needs its own
3 x 3 field sheet. Like pass PT's NPC packs (`docs/PLAYTEST_ART_PLAN.md` 3), the user renders them in ChatGPT from a
pack and `gen/field_user.py` imports them. This pass builds the packs with a data-driven tool. Offline only: no AI or
image call of any kind, no build or runtime change, no approved art touched.

## 1. Files

| file | what |
|---|---|
| `assets-src/gen/class_field_packs.yaml` | the data: `defaults` (walk reference id, height band) and one entry per class |
| `assets-src/gen/class_field_pack_prompt.txt` | the prompt template (`{placeholders}`, section 4) |
| `assets-src/gen/class_field_pack.py` | the tool: `python3 -I assets-src/gen/class_field_pack.py [ids ...] [--all] [--out DIR] [--data FILE]` |
| `assets-src/gen/selftest_class_field_pack.py` | its selftest, run from `selftest.py` |
| `assets-src/gen/README.md` | a short "Class field packs" paragraph (how to add a class) |

Default `--out`: `~/temp/ff-game/class_field_packs`. The packs are never committed.

## 2. The data entry (one per class)

```yaml
barbarian:
  name: Barbarian              # display name in the prompt
  tier: base                   # base | enhanced
  partner: berserker           # the other class of the pair (must exist, symmetric, opposite tier)
  battle_sheet: ~/temp/heroes/barbarian_berserker_sprite_sheet.png   # ~ expanded; a relative path is from assets-src/gen
  row: 0                       # the class's row in the battle sheet
  cell: [80, 80]               # battle cell size (lance sheet: [160, 144])
  body_box: null               # [x0, y0, x1, y1] inside the cell (exclusive end) or null = whole cell
  poses: [ready, victory]      # design poses (columns READY ATTACK CAST HURT DOWN VICTORY KNEEL)
  weapon_view: null            # optional pose whose WHOLE cell is also shown (the lance's full design)
  stand_in: warrior            # the hero whose approved field sheet is the pose / grid reference
  look: "..."                  # the character, as it reads at field size
  carry: "..."                 # how the weapon / shield is carried in the walk
```

Validation (refused with the entry id and field): every key above present, `tier` in base / enhanced, `partner` an
entry of the opposite tier naming this one back, `row` < sheet rows, `poses` / `weapon_view` known column names,
`body_box` inside `cell`, `stand_in` has `approved/<id>/field.{png,json}` with `layout [3, 3]`, `grid [48, 96]` and no
`head_from` / `row_from` (fixes the reader does not apply; `flip_rows` and `flip_frames` are applied, so the side row
faces LEFT as the game draws it). A missing battle sheet file is an error for a build and a skip line in the selftest.

Adding a class = adding one entry (and its partner) and running the tool with its id.

## 3. Per-class pack `<out>/<id>/`

- `prompt.txt`: ready to paste (section 4).
- `README.md`: attach, in order: (1) `design_reference.png`, (2) `poses_reference.png`, (3) `walk_reference.png`; paste
  `prompt.txt`; save the result as `~/temp/<id>_field_sheet.png`; the check list (3 x 3, side row facing left, opposite
  feet, the same character in all 9, no grid lines, weapon inside the cell); then hand it back for
  `gen/field_user.py` (recipe band `adult`) and the deletion of the class's `field_alias.yaml` line. For an enhanced
  class: optional 4th attachment, the partner's approved field sheet once it exists (same person).
- `design_reference.png`: the class's own `poses` cropped from its battle row (the `body_box` when set), x4 nearest on
  flat grey (200, 204, 196), labelled in the top margin only ("<NAME>: READY (battle pose, facing left)"); plus, when
  `weapon_view` is set, that pose's whole cell at x2 labelled "weapon design (draw it SHORTER in the field)"; for an
  enhanced class also the partner's READY at x2 labelled "the same person before promotion (<PARTNER>)".
- `design_native.png`: the same crops at 1x side by side (for comparing scale; not attached).
- `poses_reference.png`: the stand-in's field sheet as the game draws it, x4 on the same grey, row labels "DOWN (front)",
  "UP (back)", "LEFT (side, facing left)" and column labels "stand", "step A", "step B" in the margins only (no guide
  lines), title "reference hero (layout, size and poses only; do not copy the design)".
- `poses_native_144x288.png`: the stand-in sheet at 1x (the exact target file format).
- `walk_reference.png`: the walk reference (default `boy`: the user-approved PT boy, `approved/boy/field.png`) at 1x
  144 x 288, for the foot alternation only (same role as the PT packs' `walk_reference_boy.png`).
- `grid_guide.png`: the stand-in sheet x4 with the cell borders (blue), the feet line row 93 (red), the head line
  row 5 (green) and the 1 px side margins, plus notes. For the user, not for ChatGPT (it copies guide lines).

Pack root: `README.md` (index table: id, name, tier, partner, stand-in, the save name; the attach order; how to add a
class) and `_template/` (`prompt_template.txt` = the template file verbatim, `README.md` = how to add an entry).

## 4. The prompt (template placeholders: name, partner, look, carry, promotion, height)

One template, so every class gets the same layout lines:
- attachments named in order (design = who to draw; poses = layout, size, poses and style only; walk = foot timing only);
- "a canvas of exactly 144 x 288 pixels, a 3 x 3 grid of 48 x 96 cells with NO lines drawn"; rows front (DOWN, face
  visible) / back (UP, no face) / side view facing LEFT; columns stand, step A, step B;
- the soles on row 93 of every cell; the figure about 88 px tall from head (or helmet) top to soles (the heroes measure
  86-92; head top near row 5); everything, weapon, horns and crest included, at most 92 px tall and 46 px wide, at
  least 1 px from the cell's sides: this keeps the importer's adult band (84-92) at s = 1.0, no resample;
- the weapon carried field-friendly (`carry`), touching the figure (never floating), inside the cell;
- the same character in all nine cells; style lines of the PT template (16-bit SNES JRPG, chibi-ish large head, 1 px
  dark outline, <= 16 colours, top-left light, true single-pixel detail, transparent or flat #FF00FF, no ground,
  shadow, text, labels or grid lines);
- the same person as the battle sheet (face, hair, colours, outfit);
- enhanced only (`promotion`): "the same person as the <partner> after promotion, recognisably the <partner>'s face and
  build, a few years older"; base: empty;
- the WALK CYCLE EMPHASIS paragraph of the PT prompts (step A and B opposite feet, arms opposite).

Weapon carry per class (data, `carry`): barbarian / berserker the two axes hanging at the hips (heads down) or one
slung on the back; hunter / ranger the bow slung across the back with the quiver; landsknecht / dragoon the lance held
upright in the near hand or sloped on the shoulder, drawn much SHORTER than in battle (no higher than 2 px above the
head top) so it fits the 48 x 96 cell (no oversize field cell); legionnaire / centurion the scutum on the left arm (front
and side views; drawn about half his height so it fits), gladius at the hip (centurion's on the left, with the vitis).

## 5. Selftest (`selftest_class_field_pack.py`, light)

1. A fixture: a synthetic 2 x 7 battle sheet of 80 x 80 cells (coloured blocks, one distinct colour per cell) and a
   160 x 144 one with a body box, a temp yaml with a base + enhanced pair (stand-ins warrior / knight, the real
   approved sheets), built twice into two temp dirs: every expected file exists and the two trees are byte-identical.
2. The native design crop equals the source cell (or body box) pixel for pixel; the side row of `poses_native` equals
   the knight's approved side row mirrored (its `flip_rows: [left]`).
3. The prompt holds the required lines (144 x 288, 48 x 96, row 93, facing LEFT, WALK CYCLE EMPHASIS, OPPOSITE, 46 px,
   the carry text); the enhanced prompt names the base as the same person, the base prompt does not.
4. Refusals: a partner that does not name back, an unknown pose, a stand-in without a field sheet.
5. The real yaml validates; for each entry whose battle sheet exists, its crops are non-empty (else a skip line).

## 6. Gates and process

Momus OKAY on this plan before code. Then: run the tool for all 8 into `~/temp/ff-game/class_field_packs/` and look
at every reference image (crops, labels, side row facing left); `python3 -I assets-src/gen/selftest.py` (after copying
`gen/refs` and `gen/cache` from the main checkout), `npm run build`, `npm run test:fast`. One commit on
`class-field-packs`.

## 7. Rev 2 (Momus rev 1: OKAY with 8 minor notes, all taken)

1. `gen/field_alias.yaml` lives on branch `class-barbarian` (and the class branches built on it); the tool never reads
   it. The README's "delete the alias line" is a pointer to that branch's file.
2. The 8 entries: `row` 0 = base, 1 = enhanced; `poses: [ready, victory]` for all; stand-ins barbarian / landsknecht /
   legionnaire -> `warrior`, berserker / dragoon / centurion -> `knight`, hunter -> `thief`, ranger -> `ninja`; the
   lance sheet `cell: [160, 144]`, `body_box: [72, 64, 152, 144]` (the box its battle prompt asked for, measured: 88-93 %
   of every cell's opaque px inside it), `weapon_view: victory` (the lance upright) for landsknecht and dragoon only.
3. The prompt and the README check list say: one connected figure per cell, nothing floating (no effects, sparkles,
   loose arrows, separate straps or weapon); the bow, quiver, axes, lance, shield, staff, horns and crest all touch the
   body (the importer refuses a 4th piece of >= 24 px and drops a small one off the figure's x-range).
4. The 92 px cap is for every class: horns, crest, feather, lance tip, bow tips included.
5. One value: about 88 px, the head (or helmet) top near row 6, soles on row 93; the guide's head line is row 6.
6. The README's hand-back steps are the real ones: copy the render to `assets-src/gen/user_art/<id>/field_<date>.png`,
   add a `gen/field_user.yaml` recipe (`file`, `sha256`, `band: adult`, `side_faces: right` only if the side row faces
   right, provenance `refs.pack`), `field_user.py cut <id>`, review, `field_user.py approve <id>`, then drop the class's
   `field_alias.yaml` line (branch class-barbarian) and rebuild `field_ai`.
7. The selftest reads only tracked files: `approved/warrior`, `approved/knight` and `approved/boy` field sheets (no
   `gen/cache`, no `~/temp` but the optional real-sheet check of item 5). PNGs are saved with Pillow's plain
   `save(..., "PNG")` (no text chunks or timestamps), so equal inputs give equal bytes; the check compares the two trees
   byte for byte.
8. Facing is not asserted in the labels: the design labels read "READY (battle pose)" / "VICTORY (battle pose)"; the
   prompt says the design reference is for the character's look only, and the poses come from the pose reference.

## 8. Rev 3: four more classes (the "add one entry" test)

At the coordinator's request two more pairs were added as data only, with no code change: cleric -> paladin
(`~/temp/heroes/cleric_paladin_sprite_sheet.png`, stand-ins `white_mage` / `white_wizard`; the war hammer at the hip,
the round / kite shield on the left arm, the paladin's longsword sheathed at the left hip) and ronin -> samurai
(`~/temp/heroes/ronin_samurai_sprite_sheet.png`, stand-ins `thief` / `ninja`; the katana sheathed through the sash at
the left hip; the straw hat at most 40 px wide; the samurai's crescent crest counted in the 92 px cap). The data file
now has 12 entries, and the selftest's real-data check crops all 12.
