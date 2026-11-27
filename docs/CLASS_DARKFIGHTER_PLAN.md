# Hero class pair: Dark Fighter -> Death Knight, with a wider thrust key (pass CD-K; amendment to pass CL)

User request (verbatim, via the coordinator): "The 'dark fighter' / 'death knight' combination. These are standard
frames with 1 exception - the 'death knight's attack pose was originally rendered with the sword down, mirroring the
idle pose. I'm not happy with that choice - I instead want to use the picture from the file 'Death Knight's Leftward
Sword Thrust.png' in the 'attack' pose for the death knight. This is wider than standard but captures the correct
attack pose. Use that sprite for the death knight's 'attack'."

Builds on pass CL (`docs/CLASS_LANCE_PLAN.md`: the oversize cell, the body-box anchor, the extra atlas page, the rigid
in-betweens, `heroBody.ts`). Branch `class-darkfighter` from class-lance fc97a91f. No AI image call. The user's pixels
are used as rendered, but for the one conversion the user asked for (the thrust render to native pixels, 3).

## 0. Inputs, measured (scratch scripts in `/tmp/class-lance`, outside the repo; read only)

- `~/temp/heroes/dark_fighter_death_knight_sprite_sheet.png`: 560 x 160, binary alpha, 2 rows x 7 cells of 80 x 80
  (READY .. KNEEL), feet on row 76, every pose faces left; 16 colours per row, 32 on the sheet (the per-row palette of
  pass CL). Both CASTs have a detached purple flame above the hand (an fx piece, kept).
- `~/temp/heroes/Death Knight's Leftward Sword Thrust.png`: 1254 x 1254 RGBA, soft alpha (256 levels), 37,073 colours:
  an upscaled pixel-art render. Its opaque box (alpha > 127) is x 12-1240, y 314-928 (615 rows). `PX.detect_pitch`
  finds 7.72 px but with confidence 0.245 (no clean grid), so the pitch is set by the user's rule instead: the figure's
  helm-to-feet height equals the death knight's READY (77 rows, 0-76): pitch 615 / 77 = 7.987 render px per art px.
  Mode-downsampled at that pitch (section 2 step 3) it is 154 x 77 native: the sword tip at x 0, the helm centre (the top 8 rows'
  mean x) at 101.3, the cape's tip at x 153; the READY's helm centre is 52.8.

## 1. Decisions

| # | Decision |
|---|----------|
| D-DK1 | Ids **`dark_fighter_hero`** / **`death_knight_hero`** (names "Dark Fighter", "Death Knight"; abbr **DKF** / **DKN**, unused). The plain ids collide: `assets-src/gen/approved/dark_fighter/` and `approved/death_knight/` already hold the monster sheets (`monster_large.*`, `kneel.*`), and `build_battle_ai`, the selftests and the retire tools all read `approved/<id>/`; enemies.yaml has both ids too. Hero class ids live in their own namespace at runtime, but the approved folder does not, so the hero classes take distinct ids. |
| D-DK2 | Gameplay: an exact copy of warrior / knight (the user's standing rule for new classes; the death knight keeps the knight's white magic), placed like pass CL's data: `- dark_fighter_hero` on the line before `- warrior` in every `usableBy`, kit rows before the warrior / knight rows, its own classes.yaml blocks; `DEFAULT_NAMES` `DARK`. |
| D-DK3 | Atlas: the **dark fighter is a standard 80 x 80 class on the main file** (its row slots in by sort order; the other classes' cells are compared by class, as pass CB did). The **death knight is an oversize class** on its own page (cell **160 x 80**, body box **[52, 0, 80, 80]** (x, y, w, h; the recipe's inclusive `body_box` [52, 0, 131, 79]), feet row 76): its six other poses are the user's 80 x 80 cells placed in the body box; the ATTACK is the converted thrust (section 2), placed so its helm centre lines up with READY's (x offset 52 + 52.8 - 101.3 = 3.5, rounded to 3: the thrust spans x 3-156, y 0-76). The sword and the arms reach left of the box, the cape's tip right of it: recorded `allow_outside` boxes with their pixel counts (no prop mask is needed for the import). |
| D-DK4 | Importer (hero_user.py, no fork): per-row geometry (`row_geometry: {<class>: {cell, body_box, place}}`: the render's 80 x 80 cells of that row are placed at `place` in the bigger cell) and a pose replacement (`replace: {<class>/<pose>: {file, sha256, height_of: ready, at: [x, y]}}`: the tracked render, converted by section 2, pasted at `at`). Everything else is pass CB / CL's cut: per-row palette (16 + 16), binary alpha, cells apart, feet row 76, the body outside the box refused unless `allow_outside` says so. |
| D-DK5 | In-betweens: both classes use pass CL's rigid in-betweens (`puppet_lance.RIGID`: one user key, upper body bobbed by whole px; the ready -> attack swap at atk_wind1 -> atk_wind2), so the new thrust key's blade is the key's own pixels, moved rigidly, never re-posed (the coordinator's rigid-prop rule). A class opts in with `inbetweens: rigid` in its anim yaml (the lance classes keep opting in by their prop). A frame whose key has no prop line is bobbed whole (the blade above the cut moves with the hands; a blade that crosses the hip cut is cut out by its line and carried by dy with the hands, or x only when it stands on the ground: 4c). Prop lines (`prop.lines`, kind `blade`) are marked only where a blade crosses the hip cut (4c), and are optional per pose. |
| D-DK6 | Kneel: `kneel: {source: user}`, pass CB's bridge on the full cells (no lance to carry; the death knight's 80 x 80 kneel cell sits in the body box). |
| D-DK7 | Field art: temporary aliases `dark_fighter_hero: warrior`, `death_knight_hero: knight`; 1x Looks. |

## 2. The thrust conversion (`gen/hero_user_replace.py`)

1. Read the tracked copy `gen/user_art/death_knight_hero/attack_thrust_2026-11-26.png` (sha256 checked).
2. Opaque = alpha > 127; the opaque box; pitch p = box height / H with H the target row's READY height (77; the
   recipe's `height_of: ready`); a grid of W x H art cells from the box's top-left corner (W = ceil(box width / p)).
3. Each art cell: opaque when >= 50 % of its render px are opaque (binary alpha); its colour is the **majority** over
   its opaque px, each px first mapped to the nearest of the target row's 16 source colours (RGB squared distance), so
   the result uses only that row's palette (then the house map of CLASS_LANCE_PLAN 4.2, like every other cell). No Lanczos, no
   median cut, no k-means.
4. The native figure is pasted at `at`; the recipe also pins its expected size (154 x 77) and a sha256 of the native
   result, so a change in the render or the converter fails loudly.
5. Review page: the native thrust beside READY at 6x, and both on the green battle ground at 2x.

## 3. Engine

Nothing new: the death knight's page sheet has `body`, `reach` (the attack frame's leftmost opaque column: the
sword tip at x 3), `top`, `heads`; placement, the body helper, the lunge lead and the rise clamp of pass CL apply.
The dark fighter is an ordinary main-page class.

## 4. Tests and gates

- `tests/data/darkFighterClass.test.ts`: the copy rule, ids / abbrs / names, the upgrade, usableBy parity, kits,
  the field aliases, a save round trip, the scenarios put each class in every slot.
- `tests/rendering/darkFighterArt.test.ts`: dark fighter on the main page (no `page`), its six keys equal its approved
  cells; death knight on its own page (cell [160, 80], body [52, 0, 80, 80], feet row 76), every key cell equals the
  approved cell, every pose's lowest opaque row 76, its READY / HURT / ... bodies inside the body box, its ATTACK the
  converted thrust (154 x 77 at x 3, the sword tip at x 3), `reach` 3; no generated frame has a px below row 76.
- `lanceAtlas.test.ts` / `lanceScreenFit.test.ts` updated for the extra main row and generalised to every page sheet
  (the death knight's frames on screen in every slot, every attack style).
- Python: `selftest_hero_lance.py` gains the replacement (a synthetic soft-alpha upscaled render: the native figure
  back, the pitch from the height rule, the majority colour, a changed render refused by its sha) and `row_geometry`.
- Gates as pass CL 11: selftest, `hero_user.py check --all`, `puppet.py review` (all classes), `puppet_kneel.py check`
  (all 18), coverage (heroes 18/18: ai 12, user 6), battle_ai / field_ai / characters under PYTHONHASHSEED 0 / 1,
  `party-diff --base fc97a91f` (every old class's cells equal), `monsters-ai*` unchanged, build, test:fast, touched
  tests, quest --strict. Fresh image-only reviewer on the in-betweens (up to 3 rounds) and on browser screenshots
  (`?mute=1`, every slot, the attack loop), to `~/temp/ff-game/class_pack/darkfighter/`.

## 4b. Code touchpoints (rev 2, after Momus round 1; every change listed)

Pass CL's code is lance-only in places; these are the changes (none alters a lance-class or 80 x 80-class output: the
gates `party-diff` and the lance pair's page compare them).

- **Importer (`hero_user_grid.py`, `hero_user.py`).** The recipe's top-level geometry stays the render's (80 x 80,
  feet 76, `palette: per_row`). New `row_geometry: {<class>: {cell: [160, 80], body_box: [52, 0, 131, 79], place:
  [52, 0]}}` (body_box inclusive x0, y0, x1, y1 as in pass CL's recipe). Order in `cut()`: (1) the source checks of the
  render (sha, size, binary alpha, cells apart); (2) the per-row palette from the **whole** render row (the death
  knight's own ATTACK cell is dropped from the output but still counts toward its row's 16 colours; measured: the row
  has 16 with or without it); (3) the replacement (section 2) mapped onto that row's 16 source colours; (4) the house
  map on every cell; (5) each cell of a `row_geometry` row placed at `place` in a cell of `cell` size, the replacement
  pasted at its `at` instead of the dropped cell; (6) the per-cell checks on the final cell (feet row, body box with
  `allow_outside`, now a list of boxes per pose, each with its own pixel count). `info["geometry"]` becomes
  `info["geometries"][<class>]`; `metas`, `check` and `review` read the class's own geometry. A recipe without
  `row_geometry` / `replace` runs today's code path (gates: `hero_user.py check --all` for the four existing classes,
  the selftests).
- **Prop (`hero_user_lance.py`, `hero_user_grid.py`).** `prop.kind` may be `lance` or `blade`; `prop.lines` is optional
  per pose (a pose without a line has no prop mask, and its outside-the-box pixels need `allow_outside`). For these
  classes `prop` is `{kind: blade, radius: {shaft: 2.1, head: 3.0}, head_len: 0, colours, shaft_colours}` with lines
  only for the keys whose blade crosses the hip cut (4c), measured on 6x grids; the
  length rule of pass CL (80-152 px) applies only to `lance`.
- **Rigid in-betweens (`puppet_lance.py`, `puppet.py`).** `PU.is_rigid(cid)` = a lance prop, or `inbetweens: rigid` in
  the anim yaml; it replaces `is_lance` at puppet.py's two dispatch points (`battle_inbetweens`, `review`).
  `puppet_kneel` keeps `is_lance` (these two classes take pass CB's bridge, D-DK6). `split()` takes a missing line (an
  empty mask, no completion), `head_len` defaults to 0 without a prop. The frame mode becomes automatic (the table
  `RIGID` keeps the body key and dy): `whole` when the key has no blade line or its blade's lowest px is above the cut
  row; else `carry` (the blade cut out by its line, the body bobbed, the blade carried by dy, or x only when it stands
  on the ground). The checks run L1-L8 only on frames whose key has a line; every frame keeps the body check and the
  feet row.
- **Atlas (`battle_atlas.py`).** `class_frames` takes keys without lines (no mask) and a class whose kneel is pass
  CB's (`PK.kneel_frames`, no `_lances`). Pages are ordered by grid **height descending, then width** (stable for the
  lance pair: (160, 144) stays page 1, the death knight's (160, 80) is page 2, `battle-characters-ai-2.png`, 1920 x 480).
- **Anim yamls.** `anim/dark_fighter_hero.yaml`, `anim/death_knight_hero.yaml`: `inbetweens: rigid`, `hip_n`, `hip_f`,
  `hand_n` for READY, ATTACK, CAST (the cut and the grip; the other joints optional), `kneel: {source: user}`; locks by
  `puppet_kneel.py lock`.
- **Data placement.** `- dark_fighter_hero` on the line before `- landsknecht` in every `usableBy`; kit rows before the
  landsknecht / dragoon rows; classes.yaml blocks after the landsknecht / dragoon blocks.
- **Tracked files.** `gen/user_art/dark_fighter_hero/battle_2026-11-26.png` (the sheet) and
  `gen/user_art/dark_fighter_hero/attack_thrust_2026-11-26.png` (the render), recipe `dark_fighter_death_knight` in
  `hero_user.yaml`.
- **Expected outputs.** The main png grows one band: 2880 x 2400 (no longer byte-equal to class-lance's; every old
  class's cells equal by `party-diff --base fc97a91f`); page 1 unchanged byte for byte; page 2 1920 x 480.
  `lanceAtlas.test.ts` updated: 15 main-page sheets, the `pages` list of three. `lanceScreenFit.test.ts` reads each
  sheet's own page and runs for the death knight too.

## 4c. Measured blade crossings (6x gridded cells)

| Key | Blade | Hip cut crossed? | Mode of its frames |
|---|---|---|---|
| dark fighter READY | level, pointing left at y 39-41, x 1-30 | no (hips about y 50) | `whole` (idle_b, atk_wind1, cast_gather); no line |
| dark fighter ATTACK | level at y 31-33 | no | `whole` (atk_wind2, atk_mid, atk_follow); no line |
| dark fighter CAST | from the right fist (about (60, 44)) down-left to (42, 73) | yes, lowest row 73 | `carry` by dy (cast_rise, cast_release); line |
| death knight READY | from the fists (about (38, 52)) down-left to the tip (1, 74) | yes, lowest row 74 | `carry` by dy; line |
| death knight ATTACK (thrust) | level at helm height (y about 14-20) | no | `whole`; no line |
| death knight CAST | from the fist (about (60, 52)) down-left to the tip on the ground (26, 75) | yes, row 75 | `carry` planted (x only); line |

So prop lines exist for three keys: dark fighter CAST, death knight READY and CAST (`prop.lines` per class, optional
per pose).

## 5. For the user

- The thrust render has no clean pixel grid (`PX.detect_pitch` 7.72-7.94 at confidence 0.14-0.25), so its pitch is set by the height rule (READY's 77 rows), the grid from the opaque box's top-left corner (no phase); the majority colour ignores the transparent px of a cell that is >= 50 % opaque.
- Hero ids are `dark_fighter_hero` / `death_knight_hero` (D-DK1); the names on screen are "Dark Fighter" / "Death
  Knight".
- The thrust is drawn at READY's height (the user's rule): its crouch makes the body read lower than the other poses.
- Exact warrior / knight copy (the death knight keeps the knight's white magic); field sprites aliased.

## 6. Notes from Momus rev 2 (OKAY), applied in the implementation

- `metas()` writes `body` for an oversize cell **or** any class with a prop, and `check()` expects it under the same
  condition; `with_prop` writes `lines` / `lance_px` only for the poses that have a line.
- Selftests (`selftest_hero_lance.py`): `is_rigid` true for a lance prop and for `inbetweens: rigid`, false for a
  plain class; the automatic mode: a key without a line -> `whole`, a line above the cut -> `whole`, a line crossing
  the cut -> `carry` by dy, a line on the feet row -> `carry` x only; `row_geometry` placement and the replacement
  (pitch by the height rule, majority colour, binary alpha, a changed render refused).

## 7. Result (branch `class-darkfighter` from class-lance fc97a91f)

Built as planned, with one simplification of 4b / 4c found while marking the blades: their colours are the armour's
own dark ramp, so a blade mask by colour would carve the armour (the round-1 remnants of pass CL). Instead of prop
lines and `carry` frames, both classes take `rigid_cut: feet` (`puppet_lance.plain_frames`): every in-between is its
RIGID key whole with everything above the feet row bobbed 1 px (2 px bobs are set to 1 by `tweaks`, so the ankles do not
squash), so every blade (the thrust's included) moves rigidly with the figure and nothing is ever cut out. No prop is
recorded for these classes; the dark fighter's json carries no `body`. The `blade` kind and the optional per-pose
lines stay supported by the importer (selftested through the lance recipe and the synthetic cases).

- Import: the death knight's thrust converts to 154 x 77 native at READY's 77 rows (pitch 7.987, the grid from the
  opaque box's corner), pasted at x 3 in the 160 x 80 cell; outside the body box 362 px left (the sword, its guard,
  the fists) and 579 px right (the cape's tip), recorded in `allow_outside`. Pinned native sha256 d89da3a5e426.
- Atlas: main png 2880 x 2400 (the dark fighter's row 4; party-diff against fc97a91f: 16 rows x 18 columns
  identical), page 1 byte-identical, page 2 1920 x 480 (`reach` 3, `top` 0).
- Image review of the in-betweens and the conversion: round 1 APPROVE / APPROVE.
- Party-creation preview (coordinator request): an oversize class is centred in the panel by its body box, its feet
  on the 80 x 80 feet line unless its weapon would rise over the stat lines (then just below them, by the sheet's `top`);
  the 80 x 80 classes stay exactly where they were (`tests/scenes/classPreviewAnchor.test.ts`).
- Browser screenshots (every slot in both orders, kneel loop, enemy loop, three fight rounds with the thrust and a hurt
  round, party creation): APPROVE.
- Gates: selftest ALL PASSED (2171 ok); `hero_user.py check --all` 12 / 12; `puppet.py review` battle OK 18 / 18;
  `puppet_kneel.py check` 18 / 18 (the pair locked); coverage heroes 18/18 (ai 12, user 6), monsters 123/123;
  battle_ai / field_ai / characters and page 2 identical under PYTHONHASHSEED 0 / 1; party-diff vs fc97a91f 16 rows
  x 18 identical; page 1 byte-identical; monsters-ai* unchanged; build OK; test:fast 444 files, 10,851 tests passed;
  quest --strict OK.
