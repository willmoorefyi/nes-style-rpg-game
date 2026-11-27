# New hero class pair with an oversize sprite: Landsknecht -> Dragoon (pass CL)

User request (2026-11-26, verbatim): "I have a new character class that will be challenging to both the game and the
importer. The new class is the 'landsneckt' and 'dragoon'. The complexity is they both hold a long lance that extends
much further than the regular character class sprites do. ... Plan for an update to the importer and to the game engine
to support this character class. Validate the plan is good and import and verify the character renders correctly with
the unique overall sprite size."

The spec the user gave ChatGPT: "each cell is now 160 x 144 instead of 80 x 80, so the whole sheet is 1120 x 288. The
body still sits in an 80 x 80 box, drawn at the same size as every other class, in the cell's lower-right corner
(x 72-151, y 64-143, feet on row 140). Only the lance may leave that box, into the empty space above and to the left.
... The lance is about 140 px long ... at full length in every pose: Ready: angled up and to the left at about 45 deg.
Attack: a level lunge reaching near the cell's left edge. Victory: held straight up, near the top edge. Down: lying flat
on the ground, stretching left. Kneel: braced against the ground like a pike set against a charge."

Base: branch `class-lance`, cut from `class-barbarian` (pass CB, `docs/CLASS_BARBARIAN_PLAN.md`), whose importer
`gen/hero_user.py`, `kneel: {source: user}`, the per-class field alias and the 14-row battle atlas this pass extends
(never forks). No AI image call of any kind. The user's pixels are used as rendered: the import maps colours only
(4.3); no pixel of the render is moved, added, removed or hand-edited. Generated frames (in-betweens, bridge) are new
frames built from those pixels, as for every other class.

## 0. The render, measured (`/tmp/class-lance`, Python, read only)

`~/temp/heroes/landsknecht_dragoon_sprite_sheet.png`: 1120 x 288 RGBA, alpha only 0 / 255, 2 rows (row 1 landsknecht,
row 2 dragoon) x 7 cells of 160 x 144, columns READY, ATTACK, CAST, HURT, DOWN, VICTORY, KNEEL (the class pack order).

| Measure | Landsknecht | Dragoon |
|---|---|---|
| Colours (opaque) | 16 | 16 (a different 16: **32 for the sheet**) |
| Opaque px outside the body box (per cell) | 234-295 | 189-403 |
| Lowest opaque row | 140, but DOWN 142, KNEEL 141 | 140, but DOWN 143, KNEEL 141 |
| What sits below row 140 | DOWN: the spear head at x 8-19 (rows 141-142); KNEEL: 1 px, the lance butt at x 121 | DOWN: the spear head at x 8-26 (141-143); KNEEL: 1 px, the butt at x 105 |
| Widest | ATTACK x 4-148 | HURT x 63-154 (the lance tip past the body box's right edge 151) |

Per-cell opaque bboxes (the orchestrator's, re-measured equal): row 1 [(36,23,138,140), (4,75,148,140),
(81,1,148,140), (63,19,146,140), (2,102,149,142), (91,1,140,140), (18,46,141,141)]; row 2 [(21,28,143,140),
(12,72,151,140), (76,1,150,140), (63,26,154,140), (2,96,151,143), (92,1,141,140), (4,44,144,141)].

So: every body (lance excluded) stands on row 140, including KNEEL; the only out-of-spec pixels are **lance** pixels (the
lying spear head under the feet line, the braced butt 1 px into the ground, the hurt lance tip past x 151). The rule
"only the lance leaves the body box" holds by a first count and is made a fail-closed import check (4.2). The per-row
palette (16 + 16) is the one real format difference from pass CB, whose importer refuses a sheet over 16 colours.

## 1. Decisions

| # | Decision |
|---|----------|
| D-CL1 | Ids `landsknecht` (base) and `dragoon` (`upgradeFrom: landsknecht`); names "Landsknecht", "Dragoon" (the user typed "landsneckt"; the id is the orchestrator's spelling, the standard German one); `abbr` **LKN** / **DRG**; default name `LANZ` (`DEFAULT_NAMES`); classes.yaml order after barbarian / berserker, so party creation lists it 8th (8 x 36 = 288 px of the 800 px window). |
| D-CL2 | Gameplay: **a shallow copy of warrior / knight**, like pass CB's barbarian (the closest pair: front-line fighters; the game has no spear or lance item, so a "lancer" kit has nothing to copy). Landsknecht's `baseStats`, `statGrowth`, `usableEquipment`, `spellLevels`, `hitPercent`, `magicDefense` equal the warrior's; dragoon's equal the knight's, including the knight's white magic L1-3 (flagged, 12). `CLASS_UPGRADES.landsknecht = 'dragoon'` (the same NPC trigger as warrior -> knight); `- landsknecht` after `- barbarian` in every `usableBy` that has `- warrior`; kits / sandbox / scenarios as pass CB's D-CB6 (rows equal to warrior / knight). |
| D-CL3 | **Atlas: the oversize classes go on their own page**, `assets/sprites/battle-characters-ai-1.png`, with a 160 x 144 cell; the shared page `battle-characters-ai.png` (80 x 80, the 14 classes of class-barbarian) stays **byte-identical**, and its json keeps every key and every existing sheet entry byte-for-value equal; new keys are additive (section 3). One row of 18 poses at 160 px x 2 is 5760 px wide, over the 4096 px a WebGL1 GPU may cap, so the page packs each class as a 6 x 3 block of cells: 1920 x 864 per class, 1920 x 1728 for the two (under 2048). |
| D-CL4 | **Anchor = the body box.** Each oversize sheet records `body: [72, 64, 80, 80]` (x, y, w, h in native cell px) and `footRow: 140`. The engine places the sprite so the body box lands exactly where an 80 x 80 hero's cell lands in that slot, and every body-relative measure (target outline, active arrow, floating numbers, status icons and fx box, enemy melee point, kneel / down head) is taken on the body box or on recorded body heads, never on the whole cell (section 7). For an 80 x 80 class the body box is the whole cell, so every existing class computes exactly what it does today. |
| D-CL5 | **The lance is a rigid prop** (`prop: lance`) known per pose by a hand-marked line (tip, butt) in the recipe and recorded in the approved json. Lance pixels = opaque pixels near that line in the lance colours (4.2). Keyframes always show the user's pixels. In-betweens never resample the lance: they either translate the source keyframe's lance by whole px (same angle: the user's pixels, byte-equal) or **redraw** it at a clean pixel-art angle as straight pixel-perfect strands with the colours sampled along the source shaft, and the spear head rotated by RotSprite (section 5). The lance never bends, never shortens (length within +-1 px of its source) and stays one unbroken 8-connected line. |
| D-CL6 | Out-of-spec pixels are **kept as rendered**: the DOWN spear head under the feet row, the KNEEL butt 1 px into the ground, the HURT tip past x 151 are all lance pixels inside the cell; the import accepts any lance pixel anywhere in the cell, the body's lowest row must be 140, and a non-lance pixel outside the body box is refused (unless a recipe `allow_outside` entry names its cell, box and pixel count, reported to the user; none is expected). Nothing is clamped or shifted, so no `kneel.offset` is needed. On screen these pixels draw 2-6 px below the feet line (slot 4's lowest: y 746, the HUD strip starts at 780). |
| D-CL7 | Palette: **one 16-colour house palette per class row** (`palette: per_row` in the recipe; pass CB's sheet-wide rule stays the default). Each row: <= 16 colours, `PX.snap15`, the row's darkest -> `PX.OUTLINE`, one-to-one, the map listed in the json. The atlas is RGBA, so the runtime does not care. |
| D-CL8 | In-betweens: hand-marked joints in `gen/anim/landsknecht.yaml` / `dragoon.yaml` in 160 x 144 cell px; `puppet.py` takes its canvas size from the sheet's `grid` (80 x 80 when absent: the 14 other classes build byte-identical frames); the lance in-betweens come from a new `gen/puppet_lance.py` (both hands on the shaft by 2-bone IK, the lance's angle per frame from a table, section 5). |
| D-CL9 | Kneel: `kneel: {source: user}` (pass CB), the KNEEL column is the key; the bridge (`kneel_bridge.frames`) runs on the **body only** (lance cut out, its footprint filled), then the lance is put back (translated or redrawn) from the grip points (section 6). |
| D-CL10 | Field art, temporary: the pass CB field alias, `landsknecht -> warrior`, `dragoon -> knight`, until the user renders a field walk sheet (a lance in a 48 x 96 field cell is a separate question, 12). 1x legacy: two `characters.py` Looks (striped doublet + beret; dragoon armoured, both with the 1x spear-less fighter gear). The field menu, status, equip, party panel and save slots draw field sprites or text only, so nothing there shows the oversize art (checked: `getBattleFrames` has two callers, `partySprites.ts` and `PartyCreationScene.ts`). |
| D-CL11 | Draw order stays the actors layer's: enemies, then the party in slot order, so a lower (nearer) slot's lance passes **in front of** the slot above it and every lance passes in front of the enemies; the `ui` windows are below the actors and the `hud` (message window, y 0-120) above them. Nothing clips: the lance's worst reach is inside the screen in every slot (7.6, a test). |
| D-CL12 | Lunge: the attack frame's lance tip, not the cell's left edge, is the attacker's lead. `measureReach` uses `lead(sprite) = sprite.x + reach x scale` with the sheet's `reach` = the attack keyframe's leftmost opaque column (landsknecht 4, dragoon 12; 0 for every 80 x 80 class, so today's numbers). The lance hero stops with its spear point `REACH_OVERLAP` inside the target's box, so its body stays about 140 px further back than a sword hero's (a spear's reach; the user may prefer the body to close in, 12). Enemies attacking a lance hero run to its **body** box (7.3). |

## 2. Data and code (game)

- `assets/data/classes.yaml`, `items.yaml` (`- landsknecht` after `- barbarian`, 44 items, the same rows CB edited),
  `src/systems/ClassUpgradeSystem.ts`, `src/scenes/partyCreation/PartyCreationViews.ts` (`DEFAULT_NAMES`),
  `assets/data/kits.yaml`, `debug-sandbox.yaml`, `debug-scenarios.yaml` (D-CL1, D-CL2).
- Scenarios (battle, `grassland`, items `{potion: 3}`, enemies `[goblin, goblin, wolf]`), so each class stands in each
  of the four slots and beside the 80 x 80 heroes:
  - `cl_lances`: `landsknecht LANZ L10 [rapier, leather_armor, wooden_shield] hp 20` (weak: kneels),
    `dragoon DRAG L30 [sun_blade, opal_armor, aegis_shield, opal_helm] spells [cure]`, `landsknecht LAN2 L10 hp 0`
    (KO: down), `dragoon DRG2 L30`.
  - `cl_lances_b`: the same four in the order dragoon, landsknecht, dragoon, landsknecht (each class in the other two
    slots; the hp 20 / hp 0 members move with them so a kneel and a down show in slots 2 and 3 too).
  - `cl_lances_mix`: `knight KNT L30`, `landsknecht LANZ L10`, `barbarian BARB L10`, `dragoon DRAG L30` (the
    alignment check against 80 x 80 heroes on both sides).
  Previews `?mute=1&scenario=cl_lances` (+ `&kneel=loop`, `&enemyAnim=loop`).
- Save / load: class ids only (as CB); a dragoon save round trip is a test (10).
- The verifier reads classes / items: `npm run quest -- --strict` runs as a gate (11).

## 3. The atlas data model (additive, backward compatible)

`battle-characters-ai.json` keeps `cell [80, 80]`, `scale 2`, `footRow 76`, `poses` (18) and every existing `sheets`
entry exactly; it gains:

```json
"pages": [{"file": "battle-characters-ai.png", "w": 2880, "h": 2240},
          {"file": "battle-characters-ai-1.png", "w": 1920, "h": 1728}],
"sheets": {
  "landsknecht": {"row": 0, "page": 1, "inbetweens": true, "cell": [160, 144], "footRow": 140,
                  "body": [72, 64, 80, 80], "grid": [6, 3], "reach": 4,
                  "heads": [[x, y], ...]},              // 18 entries, BATTLE_POSES order, native cell px, body only
  "dragoon":     {"row": 1, "page": 1, ..., "reach": 12, "heads": [...]}
}
```

- The format follows `monsters-ai.json` (a 0-based `page` into `pages` of `{file, w, h}`, per-sheet `cell` /
  `footRow`), so the two atlases read alike. `page` absent = 0 = the main file, whose top-level `cell`, `footRow` and
  one-row-per-class layout are today's; a sheet with `page` > 0 carries its own `cell`, `footRow`, `body` and `grid`
  `[cols, rows]`: its `row` is its block index and pose p (index in `poses`) is at cell
  `(p % cols, row * rows + p // cols)` of that page. A reader that ignores `pages` sees the main file as today.
- One body format everywhere: `body` = `[x, y, w, h]` in native cell px. The recipe's `body_box` is inclusive
  `[x0, y0, x1, y1]` (the user's spec text); the importer converts it once (`[x0, y0, x1 - x0 + 1, y1 - y0 + 1]`) and
  writes `body` into every json, so nothing downstream sees the inclusive form.
- `heads`: per pose, the topmost opaque pixel of the frame **with the lance mask removed** (x the middle of that row's
  run), as `headOf` finds it for a normal hero, in **native** cell px; the runtime multiplies by the atlas `scale`
  (texture px, the unit `headOf` returns) when it records them (7.2). Written by the build (it knows every frame's lance mask); used by the
  runtime instead of a pixel scan of the oversize texture (7.2). Optional for 80 x 80 sheets (absent: the scan).
- `reach`: the attack keyframe's leftmost opaque column (D-CL12); absent = 0.
- `build_battle_ai` groups approved sheets by `grid`: `[80, 80]` builds the main page by today's code path (same
  sort, same rows, same bytes); every other grid builds an extra page in sorted class order. A grid group's sheets
  must agree on `bottom_row` and `body_box` (refused otherwise). Refused too: an oversize grid without `body_box`, a
  body box that is not 80 x 80 with its feet at `bottom_row`'s offset 76 (so a body box always matches a normal cell:
  `body.y + 76 == footRow`).
- `CharacterAtlas`: `BattleAtlasMeta` gains optional `pages`, and per sheet `page`, `heads`, `reach`;
  `fetchAiAtlas` loads each page (nearest filtering), a page that fails logs one `console.error` and its classes fall
  back to the placeholder box (the other classes keep their art). `BattleFrames` gains `body: {x, y, w, h}` (the whole
  cell for a main-page class), `heads?` and `reach` (0). `sliceRow` slices a page by its own cell and grid.

### 3.1 Every single-page reader of the battle atlas becomes page-aware

These read `sheets[c].row` against the main png at the top-level cell and would misread (or fail on) a page-1 sheet.
Each goes through one helper per language (`src/rendering/battleAtlasPages.ts` `cellRect(meta, cid, pose)`; Python
`gen/battle_atlas.py` `cell_box(meta, cid, pose, scaled=True)` and `main_sheets(meta)`), and each gets an assertion in
10. Both helpers return the cell's rect in **atlas png px** (native x `scale`) by default; `scaled=False` gives native
px, for callers that downsample the png first (`old_columns` reads `[::sc]`: native; `party_diff` reads the png: scaled).

| Reader | Today | Change |
|---|---|---|
| `tests/data/assetCoverage.test.ts:136-137` | png height = cell x scale x len(sheets) | count main-page sheets only; every `pages[i]` file exists at its `w` / `h` |
| `tests/rendering/heroFacing.test.ts:17-20, 54-58` | slices every sheet from the main png at 80 | slices through `cellRect` (page 1 at 160 x 144); the user classes assert no facing fix |
| `tests/scenes/battle/meleeContact.test.ts:223-233` (`heroAttackLeftInset`) | measures the main png's row | through `cellRect`; a lance class's inset is its `reach` (D-CL12) |
| `assets-src/gen/puppet_kneel.py:140-154` (`old_columns`) | compares old atlas columns on the main png | through `cell_box` on the sheet's page |
| `assets-src/gen/kneel_tools.py:123-124` (`party_diff`) | row height = png.h // len(sheets) | `main_sheets` for the main png, `cell_box` for page sheets |
| `assets-src/gen/selftest_anim.py:101-103` | locks the main party png across a `monsters_ai` build | locks every file of `pages` |
| `barbarianArt.test.ts` (class-barbarian) | main png, top-level cell | unchanged (both classes stay on page 0); it gains a check that they have no `page` |

A grep for `battle-characters-ai` over `src/`, `tests/`, `assets-src/` at the branch point re-confirms the list; any new
reader joins the table before code is written.

## 4. Importer: `gen/hero_user.py` extended (no fork)

### 4.1 Recipe (hero_user.yaml) - new optional keys, absent on pass CB's recipe

```yaml
landsknecht_dragoon:
  file: user_art/landsknecht/battle_2026-11-26.png    # copied byte for byte from ~/temp/heroes/
  sha256: <sha256>
  rows: [landsknecht, dragoon]
  columns: [ready, attack, cast, hurt, down, victory, kneel]
  faces: left
  cell: [160, 144]              # default [80, 80]
  foot_row: 140                 # default 76 (of the body, lance excluded)
  body_box: [72, 64, 151, 143]  # inclusive; default the whole cell; must be 80 x 80 and contain foot_row
  palette: per_row              # default sheet (pass CB's rule)
  prop:                         # default none; only kind lance exists
    kind: lance
    radius: {shaft: 1.5, head: 3.5}       # px from the line counted as lance
    head_len: 14                          # px from the tip that form the head (blade + fittings)
    colours: {landsknecht: [[r, g, b], ...], dragoon: [...]}   # source rgb of the lance (outline counted only <= 1.0 px from the line)
    lines: {landsknecht: {ready: [[tx, ty], [bx, by]], attack: ..., cast: ..., hurt: ..., down: ..., victory: ..., kneel: ...},
            dragoon: {...}}               # hand-marked on 10x gridded cells, cell px
    grips: {landsknecht: {ready: [[nx, ny], [fx, fy]], ...}, dragoon: {...}}   # where each hand holds the shaft (D-CL9, 5)
  allow_outside: {}             # {<class>/<pose>: {box: [x0,y0,x1,y1], px: N, why: ...}}; none expected
  tool / rendered / author / refs / source_name / approved / user_review: as pass CB
```

### 4.2 Cut (fail closed; each refusal a `SystemExit` naming the rule, cell and count)

1. sha256 equal; size exactly (7 x cell_w, rows x cell_h); columns / faces as CB; binary alpha.
2. Cells apart (CB's border rule, at the recipe's cell size).
3. Palette per row (D-CL7) or per sheet (CB).
4. Lance mask per cell (with `prop`): opaque px within `radius.shaft` of the tip-butt segment (within `radius.head`
   over the `head_len` nearest the tip) whose source colour is in the row's lance `colours` (the outline colour only
   within 1.0 px). Checks: the mask is one 8-connected component; the tip and the butt are within 1.5 px of a mask
   pixel; the mask holds >= 0.9 x the segment's major-axis length; the line's length is 140 +- 12 px (the spec's
   "about 140", the two rows' lances within 4 px of each other's ready length).
5. Body: the cell minus the lance mask. Its lowest opaque row must equal `foot_row` in every cell (measured: 140 in all
   14); a body pixel outside `body_box` is refused unless an `allow_outside` entry covers it exactly.
6. Output per class: `battle.png` 480 x 288 (3 x 2 of 160 x 144: ready, attack, cast / hurt, down, victory) and
   `battle_kneel.png` 160 x 144. `battle.json` as CB plus `grid [160, 144]`, `bottom_row 140`, `body_box`,
   `prop {kind, lines, grips, radius, head_len, colours}` (per pose of the six; the kneel json carries its own line
   and grip) and `cut.lance_px` (mask size per pose); `palette: per_row` with the row's map.
7. Review page (`hero_user.py cut`): the 14 cells at x4 with the body box outlined, the lance mask in magenta, the
   tip / butt / grips marked, and the colour maps; to `~/temp/ff-game/class_pack/lance/import/`.

`check` re-imports byte for byte and also compares `prop` and `body_box` with the recipe. A recipe without the new keys
takes exactly pass CB's code path (gate: `hero_user.py check --all` OK for barbarian / berserker with their approved
files unchanged, and `selftest_hero_user.py`'s CB cases unchanged). `hero_user.py` is already 278 lines on the base
branch, so it must not grow: the cell-size, body-box and per-row palette code moves to a new `gen/hero_user_grid.py`
(`_cells_apart`, `palette`, the cut loop, parametrised by the recipe with the CB defaults), the lance mask to
`gen/hero_user_lance.py` (shared by the importer, the puppet and the build); `hero_user.py` keeps the CLI, `recipe`,
`metas`, `approve`, `check`, `review`. Its line count after the pass is at most its count before (recorded).

### 4.3 Selftests (`gen/selftest_hero_user.py`, new cases on synthetic 160 x 144 renders)

Round trip (approve then check OK) of a synthetic lance sheet; and each refusal: wrong size for the recipe cell, a
non-lance pixel outside the body box, a body foot off 140, 17 colours in one row while the sheet has 32 accepted per
row, a broken lance (two components), a line whose tip is off the art, a body box not 80 x 80. Plus: the CB recipe still
cuts byte-equal with the new code.

## 5. In-betweens with a rigid lance (`gen/puppet_lance.py`, `puppet.py`)

### 5.1 puppet.py generalised (no behaviour change for 80 x 80)

- `render(size=...)` and `battle_inbetweens` take the canvas from the sheet's `grid`; `review()` draws at the cell
  size x4. A class whose battle.json has `prop.kind: lance` is built by `puppet_lance.inbetweens` instead of the
  generic weapon path (its yaml has no `tip`; `load_cfg` refuses `tip` together with a lance).
- Gate: the 14 other classes' in-betweens byte-equal before / after (their atlas rows compared by class, as CB's
  rowdiff), and `puppet.py review` unchanged for them.

### 5.2 The lance class pipeline (per in-between)

1. **Split** the source keyframe into body and lance with the approved json's mask (4.2). The body's lance footprint
   is filled: a footprint pixel whose nearest non-lance body pixels on both sides along the shaft's perpendicular are
   within 2 px takes the nearer one's colour; the rest becomes transparent (outside the silhouette). The fill count per
   frame is reported on the review page.
2. **Body**: the generic `battle_targets` joints (knight offsets, as every class), then the two hands are placed on
   the new lance line at their source grips' distances along the shaft and the arms solved by 2-bone IK from the
   shoulders (bone lengths kept; the elbow on the source keyframe's side; a grip out of reach pulls the lance toward
   the shoulder along its own axis until both hands reach, reported). The body is rendered by `puppet.render` on the
   body-only keyframe (so the lance is never segmented into an arm) and passed through `outline()`.
3. **Lance**, drawn after the body's `outline()` (so no ink ring is ever added round the steel), between the far arm
   and the near arm in z (near hand over the shaft, as the user's ready / attack show), by one of two modes:
   - *carry* (the frame's lance angle equals its source keyframe's): the source lance pixels translated by the whole
     px grip delta, byte-equal to the user's (`idle_b`, `cast_release`, `atk_mid`, the bridge's in1 / in2, 6).
   - *redraw* (a new angle): the angle snaps to the clean set S = {0, +-14.04, +-18.43, +-26.57, +-33.69, +-45,
     +-56.31, +-63.43, +-71.57, +-75.96, 90} deg (slopes 0, 1/4, 1/3, 1/2, 2/3, 1 and reciprocals). The shaft is the
     source shaft's cross-section strands (measured at mid-shaft perpendicular to the source line: e.g. outline /
     wood / outline) each drawn as a pixel-perfect line (one step per major-axis px, never an L corner of 3 px), offset
     by whole px on the minor axis; each strand's colour at arc position t is the source strand's colour at t (bands,
     grip wraps and the dragoon's gold rings keep their places). The shaft's major-axis length is chosen so the
     Euclidean length is the source's +-1 px. The head (the `head_len` px nearest the tip) is rotated by RotSprite
     (`rig_rotsprite.rotsprite`, k 8) about the head-shaft junction, its colours mapped to the nearest of the row's
     palette, binary alpha, then pasted at the new shaft's end.
4. **Angle table** (angles on the hand-marked line, up-left positive; `tweaks: {<frame>: {lance: {angle, dx, dy}}}`
   may adjust after review, and the result must still pass L4 / L8): `idle_b` carry (ready, 1 px down with the body);
   `atk_wind1` redraw at the S angle nearest (ready + attack) / 2 (measured about 45 and 0: 26.57), grip pulled back
   3 px; `atk_wind2` redraw at the S angle nearest attack's (0, level), drawn back 8 px (butt <= x 159 checked);
   `atk_mid` carry of attack's lance at the lerped grip; `atk_follow` redraw at the largest S angle at least 10 deg
   below attack's (attack 0: -14.04, the tip dipped), 2 px back; `cast_gather` carry of ready's lance with the gathered
   hands; `cast_rise` carry of cast's lance (the dragoon's cast lance runs the cell's height, point down: carried,
   never rotated through 180); `cast_release` carry of cast's.
   **Turn rule (L8):** between consecutive frames of the played sequences (`ATTACK_SEQ` ready, atk_wind1, atk_wind2,
   atk_mid, attack, atk_follow; `CAST_SEQ`; the kneel track ready, kneel_in1, kneel_in2, kneel, kneel_b) the lance
   turns at most 27 deg (expected: 45 -> 26.57 -> 0 -> 0 -> 0 -> -14.04), except the keyframe swaps the puppet already
   makes for every class, listed by name: cast_gather -> cast_rise (ready's lance to cast's) and kneel_in1 ->
   kneel_in2 (the bridge's drawing swap). Not covered either, by design: at runtime the hero returns from
   `atk_follow` straight to the ready / idle pose (about 59 deg for the lance), the same pose snap every class makes
   at the end of its attack; the image reviewer is told so.
5. **Lance checks** (`puppet_lance.check`, printed by `puppet.py review`, all must hold): L1 one 8-connected
   component; L2 length within +-1 px of the source keyframe's; L3 every redrawn strand pixel-perfect and straight
   (its pixels within 0.5 px of the strand's ideal line); L4 the angle in S or equal to the source's (carry: lance
   pixels byte-equal to the source lance moved by the delta); L5 every lance px inside the cell, and none below row
   140 except pixels carried byte-equal from the user's DOWN or KNEEL key (the DOWN cell itself; `kneel`; `kneel_in2`
   and `kneel_b`, which carry the key's lance: their below-140 pixels must be exactly the key's moved by the carry
   delta, 0 for `kneel_b`); a redrawn lance never reaches below 140; L6 colours within the row's 16, binary alpha;
   L7 each grip hand's pixels touch the shaft (within 1 px); L8 the turn rule of 5.2.4. The body keeps puppet's own check (ring, px ratio
   0.88-1.12, height +-4, <= 2 pieces) **on the body only** (the lance excluded from both frame and source).

Facing: the render faces left in every pose, no `face_fix` / `facing_fix` (hero_user refuses them, as CB).
Fallback (as CB 5): an in-between the image reviewer still rejects after round 3 ships aliased to its keyframe
(`alias_frames`) and is reported.

## 6. Kneel (`source: user`, bridged on the body; `gen/kneel_lance.py`)

- The key is the user's KNEEL cell, shown as rendered (the butt 1 px in the ground, D-CL6).
- `kneel_in1` / `kneel_in2` / `kneel_b`: `kneel_bridge.frames(ready_body, key_body, 140, options)` on the body-only
  images (lance cut, footprint filled as 5.2.1), unchanged code at 160 x 144 (it has no 80-px constant). Then the lance: `kneel_in1` carries ready's lance by
  round(u1 x (grip_key - grip_ready)) when the ready and kneel lance angles differ by <= 10 deg (measured: about 45
  and 43 for the landsknecht), else redraws it at the S angle between; `kneel_in2` the same from the key's lance with
  u2; `kneel` the user's cell; `kneel_b` the key's body breath (1 px down) with the lance **unmoved** (it is braced on
  the ground; the hands slide 1 px along the shaft). L1-L8 apply, with L5's carried-from-KNEEL exemption; the K
  checks (`puppet_kneel.py check`) run on the body images with the body box height (80) passed as the cell height, so
  `kneel_checks`' height tolerance is the 80-cell 4, not the 144-cell 10; the lock (`puppet_kneel.py lock landsknecht dragoon`) hashes the full frames.
- `kneel_tools.py coverage`: heroes 16/16 (ai 12, user 4).

## 7. Engine

### 7.1 Placement (`partySprites.ts`)

`partySpritePosition(i, art)` = `{x: PARTY_X[i] - art.body.x x scale, y: PARTY_FEET_Y[i] - (art.footRow + 1) x scale}`:
for a lance hero x = PARTY_X - 144, y = feet - 282, so its body box's top-left is (PARTY_X, feet - 154), exactly an
80 x 80 hero's cell; for an 80 x 80 hero `body.x` is 0 (today's numbers). `buildPartySprite` registers the sprite's
body with `heroBody.setBody(sprite, art)`.

### 7.2 One body helper (`src/scenes/battle/heroBody.ts`, pure but for Pixi's transforms)

Names chosen not to clash with `fx/emitterCore.bodyBox` (the 70 % / 62 % fx box inside a rect): `heroRect`,
`heroBounds`, `heroAnchor`. `ActionFx` and `statusFx` keep applying `emitterCore.bodyBox()` on top, now to
`heroBounds` instead of `getBounds()`, so the fx box is the same share of the body as of an 80 x 80 hero's cell.

- `heroRect(sprite)`: the body box in the sprite's parent space (x, y, w, h, following the sprite's position, scale
  and pivot, so the active step, the lunge, the shake and a tremble move it); an unregistered sprite (an enemy, a
  placeholder, an 80 x 80 hero registered with the whole cell) returns exactly `{sprite.x, sprite.y, sprite.width,
  sprite.height}` as today. `heroBounds(sprite)`: the same box in global space, the `getBounds()` replacement.
  `heroAnchor(sprite)` = `{x: heroRect.x, y: heroRect.y}`, the replacement of a raw `sprite.x` / `sprite.y` read used
  as the figure's top-left (the target arrow, the number's start row).
- Heads: `CharacterAtlas` records each oversize frame's head, `heads[pose] x meta.scale` (texture px, `headOf`'s
  unit), in a `WeakMap<Texture, {x, y}>` (`texturePixels.knownHead`); `headOf(tex)` returns a known head before it scans (the stone copy maps back through
  `stoneTextures.coloured`, as today). One change point covers the four `headOf` callers (the active arrow's kneel
  sink, the numbers' head row, the status icons' head, the target label).

### 7.3 Call sites moved to the body (each verified by a parity test, 10)

| Site | Today | With a lance hero |
|---|---|---|
| `BattleFieldTargeting.updateTargetVisuals` (party target outline) | `sprite.width / height`, at `sprite.x / y` | `heroRect` |
| `ActiveHeroMarker.show` (arrow over the hero) | `sprite.x + (sprite.width - 16) / 2`, `sprite.y - 20` | `heroRect`; the D-K20 sink from the known heads |
| `BattleFieldTargeting.updateTargetArrow:142-143` (the yellow arrow on a party target: a heal, an item) | `sprite.x + 24`, `sprite.y - 20` | `heroAnchor` + 24, `heroAnchor.y - 20` |
| `BattleEffects.addFloating:41` (a hero's number: its start row) | `floatPlacement(sprite.y, null)` | `floatPlacement(heroAnchor(sprite).y, null)` |
| `floatingNumbers.createFloatingNumber` (x centre) | `sprite.x + sprite.width / 2` | body centre (`heroRect`) |
| `actionNumbers.iconRowBottom` (head row) | `headOf`, else `sprite.height x 0.33` | **enemy only** (heroes pass `null` to `addFloating`): unchanged, in the scan's allowlist as enemy-only |
| `statusFx.anchorOf` (icons, fx box) | `getBounds()` | `heroBounds` + known head |
| `ActionFx` (spell box and points), `emitterCore.bodyBox` callers | `getBounds()` / `getLocalBounds()` | `heroBounds` / body local |
| `slashEffect` (a hit on a hero) | `target.width / height` | body |
| `BattleEffects` hit flash | the frame texture (Sprite) | unchanged: the whole frame flashes, lance included |
| `AiEnemyView.attackPlan` (an enemy runs to a hero) | `target.getBounds()` corner | `heroBounds` (the enemy meets the body, not the lance's cell edge) |
| `actionHelpers.measureReach` (a hero's lunge) | `actor.x`, `a.y + a.height` | `lead(actor)` (D-CL12); feet = `heroBounds` bottom (the same 3 native rows under the feet as an 80 cell) |

Two guards against a forgotten site:

- A source-scan test (`tests/scenes/battle/heroBodySites.test.ts`) lists every `getBounds()`, `getLocalBounds()`,
  `.width`, `.height`, `headOf(` and every `<ident>.x` / `<ident>.y` / `.position` read where `<ident>` is a
  `Container` / `Sprite` parameter or local in `src/scenes/battle/**` and `src/scenes/BattleScene.ts`, and fails on any
  not in its allowlist. Each entry: file, expression, and "hero body" (through the helper), "enemy / colossus only",
  or "moves the sprite" (the lunge, the active step and the shake write `x` / `pivot`, which must move the whole
  frame), with the reason.
- The parity test (10) drives every consumer of `display.partySprites[` (`actionNumbers.spawn` via
  `BattleEffects.addFloating`, `BattleScene`'s active hero at :295, `BattleAnimationController.findActorSprite` and the
  effects and lunge it feeds, `BattleFieldTargeting`'s arrow and outline, `statusFx`, `ActionFx`), so a missed read
  shows as a 144 / 128 px difference.

### 7.4 Motion

- Lunge / attack: the existing choreography moves `sprite.x / y`; only the reach (D-CL12) changes. Return to home
  unchanged. Rise to the target's row uses the body's feet (unchanged numbers: footRow + 3 = cell bottom in both).
- Hurt shake, fear tremble, the kneeler's shake: through `pivot.x`, the whole sprite; unchanged.
- Active step (`ACTIVE_STEP` 24 px forward): moves the sprite; the arrow follows the body.
- Down (KO) and kneel: poses of the same sprite; the arrow's sink and the icons follow the known heads.

### 7.5 Outside battle

- `PartyCreationScene` class preview: the ready frame is drawn whole (the lance is the class's look) at
  `(contentX, contentY + 8 x LINE_HEIGHT)`; it is 320 x 288 on screen and must fit the 600 x 800 window (a test);
  the body sits 144 px right of where an 80 x 80 preview's would.
- Field menu, status, equip, party panel, save slots, sandbox: field sprites (the alias) or text: no change (a test
  asserts they resolve the alias).

### 7.6 Screen fit (D-CL11)

At home, with the active step and at the lunge's contact frame, the largest extents of every pose in every slot: x
from PARTY_X - 144 + 2 x 2 (down's spear head) = 1240 (slot 1) to PARTY_X - 144 + 154 x 2 + 1 = 1680 (slot 4, dragoon
hurt); y from feet - 282 + 2 (cast / victory tips, row 1) = 145 (slot 1; the message window ends at 120) to feet + 6
(down, slot 4: 746; the strip at 780). During a lunge the hero also rises to the target's feet row (`attackRise`, up to
400 px): ready's lance tip (row 23) of a hero rising to an enemy at feet 360 reaches y 360 - 282 + 46 = 124, 4 px
under the message window. So the test steps **every frame** of the hero attack choreography (wind-up, advance with
its rise, contact, return) toward the highest (feet 360) and lowest enemy feet rows, from every slot, with each
frame's own pose texture, and asserts the drawn art stays at y >= 120 and inside x [0, 1920). If a frame fails, the fix
is a choreography clamp of the rise for oversize heroes (the drawn frame's top >= 120), stated in the test, never a
change to the art.

### 7.7 Memory

Page 1: 1920 x 1728 RGBA = 13.3 MB of GPU memory (nearest, no mips), loaded with the main page (25.8 MB with CB's 14
rows) when the field preloads the battle atlas. Monster pages are a separate budget (unchanged, the monster atlas is
not rebuilt). `lanceAtlas.test.ts` pins the page size, so a layout change that grows it fails.

## 8. Files

New: `assets-src/gen/hero_user_lance.py` (mask, split, fill), `gen/puppet_lance.py` (targets, IK, redraw, checks),
`gen/kneel_lance.py`, `gen/user_art/landsknecht/battle_2026-11-26.png`, `gen/anim/landsknecht.yaml`, `dragoon.yaml`
(+ locks), `approved/landsknecht|dragoon/battle*.{png,json}`, `assets/sprites/battle-characters-ai-1.png`,
`src/scenes/battle/heroBody.ts`, tests (10). Changed: `hero_user.py`, `hero_user.yaml`, `puppet.py`,
`puppet_kneel.py` / `kneel_source_ai.py` (the lance dispatch), `kneel_tools.py` (coverage list), `build_assets.py`
(pages), `gen/battle_atlas.py` and `src/rendering/battleAtlasPages.ts` (new page helpers), the readers of 3.1,
`gen/hero_user_grid.py` (new), `field_alias.yaml`, `characters.py`, the game data and code of 2, `CharacterAtlas.ts`, `partySprites.ts`,
`texturePixels.ts`, the call sites of 7.3, `PartyCreationViews.ts`, AGENTS.md (the oversize hero row, the page, the
body box rule, the class pair). Every new file under 250 lines; `CharacterAtlas.ts` (240) moves its slicing into
`src/rendering/battleAtlasPages.ts` to stay under.

## 9. Order of work (phase 2)

1. Branch `class-lance` from `class-barbarian`; copy the render; recipe with the measured lines, grips and colours
   (10x gridded cells in `/tmp/class-lance/`); importer + selftests; `cut` review page; approve.
2. Data and code of 2; field alias; Looks.
3. `puppet_lance.py` + yaml joints; `puppet.py review landsknecht dragoon`; image review round(s).
4. Kneel lance bridge; `puppet_kneel.py check / lock`; coverage; image review.
5. `build_battle_ai` pages; atlas tests.
6. Engine (3, 7); unit and parity tests.
7. Gates (11); browser; screenshot review round(s); AGENTS.md; commit on `class-lance`.

## 10. Tests (written first; each fails before its step)

- `tests/rendering/lanceAtlas.test.ts`: the main page's json keys and every one of the 14 old sheet entries unchanged
  (no `page`, `cell [80, 80]`, `footRow 76`; 14 rows; png 2880 x 2240); `pages` = [main 2880 x 2240, page 1 1920 x 1728]; each lance sheet: page 1, cell [160, 144], footRow 140, body
  [72, 64, 80, 80], grid [6, 3] (per sheet); both classes on page 1 with all 18 poses, `heads` (18) and
  `reach` 4 / 12; each key cell equals the approved cell (no mirror); in every pose the body (atlas pixels minus the
  approved lance mask, read from the approved json) has its lowest row 140 and lies in the body box; every
  in-between and bridge frame's body lowest row 140; the L5 rule on every generated frame (a lance px below 140 only
  where it equals the KNEEL key's, moved by the carry delta: `kneel_in2`, `kneel_b`; none in a redrawn lance, none in
  any puppet in-between).
- `tests/rendering/CharacterAtlas.test.ts` (extended): a page sheet slices at its own cell and grid; `body` / `reach`
  defaults for a main-page class; a failed page leaves its classes as placeholders, the others with art.
- `tests/scenes/battle/partySpritePosition.test.ts` (extended): in every slot a lance hero's body box top-left equals
  an 80 x 80 hero's cell top-left, and its feet line equals PARTY_FEET_Y.
- `tests/scenes/battle/heroBodyParity.test.ts`: for each slot, an 80 x 80 hero and a lance hero whose body boxes
  coincide give equal results for the target outline rect, the party target arrow, the active arrow (x, y, and its
  kneel sink), the floating number's x and start row, the status anchor (head, box), the ActionFx box, the slash box
  and an enemy's attack plan. vitest has no canvas (`readPixels` returns null), so both heroes get their heads through
  `knownHead` (the 80 x 80 hero's injected with the same body-relative head); otherwise the 80 x 80 hero would take the
  0.33-height fallback and the comparison would mean nothing;
  the lance hero's `measureReach` dx equals the 80 x 80 hero's minus (144 - reach x 2) clamped at MIN_ATTACK_REACH.
- `tests/scenes/battle/heroBodySites.test.ts`: the source scan of 7.3.
- `tests/scenes/battle/lanceScreenFit.test.ts`: 7.6 from the committed atlas: every pose of both classes in every slot,
  at home and at the active step, and every frame of the hero attack choreography (wind-up, advance with its rise,
  contact, return) toward the highest (feet 360) and the lowest enemy feet rows, each frame with its own pose texture:
  the drawn art inside x [0, 1920) and y [120, 780); a failing frame is fixed by the rise clamp of 7.6, never the art.
- The page-aware readers of 3.1: `assetCoverage` (main-page count, every page file at its `w` / `h`), `heroFacing`
  (page-1 slices), `meleeContact` (the lance inset = `reach`); Python: `puppet_kneel.py check` (all 16, `old_columns`
  per page), `kneel_tools.py party_diff` on a synthetic two-page atlas, `selftest_anim.py` locking both pages.
- `tests/data/lanceClass.test.ts`: the copy rule (warrior / knight field by field), abbr 3 letters, the upgrade,
  usableBy parity with warrior, kits rows, party creation 8 base classes with landsknecht 8th, the preview fits its
  window, a dragoon save round trip, the field alias.
- Count updates as CB's (party creation 8, sandbox 8 / 16, heroSpriteNpcs 16, heroFacing: user classes have no fix).
- Python: `selftest_hero_user.py` (4.3), `puppet_lance` cases in it (L1-L8 each failing on a mutated frame: a gap, a
  2 px short lance, an L corner, an off-set angle, a redrawn px below 140 and a carried below-140 px that differs from
  the key's, a 17th colour, a hand off the shaft, a 45 -> 0 turn in one frame).
- **When each goes red:** the Python selftests and `lanceClass.test.ts` before steps 1-2 (no recipe, no class);
  `lanceAtlas.test.ts`, the `CharacterAtlas` page slicing and the 3.1 readers' new assertions at the start of step 5,
  failing on the step-4 atlas (no page 1); `partySpritePosition`, `heroBodyParity`, `heroBodySites` and
  `lanceScreenFit` at the start of step 6, failing on the step-5 runtime (it slices page 1 but places by the cell).
  Each red run (test, failure line) is recorded in the commit message.

## 11. Gates

`python3 -I assets-src/gen/selftest.py`; `hero_user.py check --all` (barbarian, berserker, landsknecht, dragoon);
`puppet.py review landsknecht dragoon` (`battle OK`, lance L1-L8 OK) and the 14 others unchanged; `puppet_kneel.py
check` (all 16); `kneel_tools.py coverage` (heroes 16/16, ai 12, user 4; monsters 123/123 unchanged);
`build_assets.py battle_ai field_ai characters` twice under PYTHONHASHSEED 0 / 1, identical outputs; the main battle
page byte-equal to class-barbarian's; `characters-ai.png` byte-equal (aliases are json only); `monsters-ai*` byte-equal
(not rebuilt; `git diff --exit-code assets/sprites/monsters-ai*`); `npm run build`; `npm run test:fast`; the touched
tests; `npm run quest -- --strict`. Not run: test:full, --mutate (the integrator's).
Review: a fresh image-only reviewer on the in-between strips / GIFs and the kneel bridge, then on browser screenshots,
up to 3 rounds each (`~/temp/ff-game/class_pack/lance/`). Browser (`npm run dev`, `?mute=1`): `cl_lances`,
`cl_lances_b`, `cl_lances_mix`, each with `&kneel=loop` and with `&enemyAnim=loop`; screenshots at home, the active
hero in each slot, a lance attack (contact frame, stepped with `&slow=4`), an enemy hitting a lance hero (hurt, numbers),
a status (poison icons over the body head), the KO (down) and the kneel; the party-creation preview of both classes.
Scratch only under `/tmp/class-lance/`; `git status` clean of scratch before the commit.

## 12. For the user (reported, not done)

1. Stats are an exact warrior / knight copy; the dragoon inherits the knight's white magic L1-3 (a classic dragoon has
   none, and usually a Jump command): a data edit, or a new command, once ruled.
2. There is no spear or lance item: both classes equip the warrior's list (swords, shields) while the art holds a
   lance.
3. The lunge stops with the spear point at the enemy (D-CL12), so the body travels about 140 px less than a sword
   hero's. Say if the body should close in instead.
4. Field sprites are aliased to warrior / knight; a field sheet with a lance needs its own oversize field cell (not in
   this pass).
5. A lower slot's lance draws over the hero above it (D-CL11); the alternative (all lances behind all bodies) needs the
   lance as its own sprite layer.
6. The hurt lance points up and to the right (behind the hero), past the body box in the dragoon's; kept as rendered.

## 13. Risks

- R1: the lance mask catches a hand or plume pixel (the plume and the steel share a light colour in row 1). Mitigation:
  colour plus radius rule, the magenta review page, `allow_outside` never needed by design; the reviewer checks the mask.
- R2: the redrawn lance reads differently from the user's (strand profile). Mitigation: carry wherever the angle does
  not change (5 of 8 in-betweens and both bridge frames), S angles only, the review rounds, the alias fallback.
- R3: IK pulls an arm off the body for a far grip. Mitigation: the reachability pull (5.2.2), body check, review.
- R4: a barbarian-branch change after this plan (it is not finished): phase 2 starts from its final tip; this plan
  names its interfaces (`hero_user.cut`, `metas`, `check`, `kneel_source_ai.hero_frames`, `field_alias.yaml`) and is
  re-checked against them at the branch point.

## 14. Result (phase 2, branch `class-lance` from class-barbarian bfc71d03)

Built as planned, with these changes (each found in the work or in the image reviews; no decision of section 1
changed):

- **R-CL1, in-betweens (5.2).** Round 1 of the image review failed the part-rig in-betweens (the generic knight
  offsets with IK hands broke these detailed bodies: shredded far arms, leftover shaft stubs, smears). Since round 2
  every in-between is **one user keyframe, never cut into parts** (`puppet_lance.RIGID`): `whole` = the key with its
  own lance bobbed by whole px above a cut row below the hips and the lance's lowest px (idle_b, atk_wind1 from
  ready; atk_wind2, atk_mid, atk_follow from attack; cast_gather from ready), `carry` = a lance planted on the ground
  (cast) cut out and carried x-only while the body bobs. The ready -> attack swap moves to atk_wind1 -> atk_wind2 (a
  named L8 swap, like cast_gather -> cast_rise). The `redraw` path (pixel-perfect strands, RotSprite head, clean
  angles) is kept and selftested but no frame uses it now. The generic `battle_targets` / IK are not used for lance
  classes; the joints place the hip cut and the grip.
- **Lance mask (4.2).** `shaft_colours` per class (ink, wood and the shaft's darker shades where it crosses the
  doublet / cuirass; the steel only on the head); the shaft reach is 1.5 px for a level / upright lance, 2.1 at 45 deg;
  `head_len` per class (18 / 28). The ready lines run through the near fist across the body to the far fist (the user
  drew the shaft across the torso). Length rule: every visible line in [80, 152] px, the fully visible poses (attack,
  cast, down, victory) >= 128. The KNEEL "feet at 141" is the lance butt (1 px), not the feet: every body stands on
  140, so no offset. Grips live in the anim yaml (`hand_n`, `kneel.grip`), not the recipe.
- **Fill.** The body's lance footprint fills from the body on both sides, then grows into holes the body encloses (a
  fist the shaft ran through), so a bridge frame shows no background through the body.
- **7.6 clamp.** The atlas records each oversize sheet's `top` (its highest opaque row over all poses);
  `heroBody.clampHeroY` keeps a lunge / cast placement's lance under the message window (the leap's hop lifted it to
  y 109). A no-op for every other sprite.
- **Kneel fallback (5, 6).** After round 3 the dragoon's kneel_in1 (a spur at the gauntlet) and kneel_in2 (the front
  foot detached by the bridge's row remap) still failed, so `kneel: {alias_frames: [kneel_in1, kneel_in2]}` shows
  ready and the kneel key there (the dragoon's kneel pops from ready to the key). The landsknecht keeps its bridge.
- **Reviews.** In-betweens: round 1 ITERATE / ITERATE, round 2 ITERATE / ITERATE, round 3 landsknecht one FAIL
  (idle_b: a dark mark in the rear fist; idle_b is pixel-identical to cast_gather, which the same review passed, so
  it is reported, not changed), dragoon two FAILs (the kneel frames, aliased). Browser screenshots (every slot, both
  orders, beside 80 x 80 heroes, kneel loop, enemy loop, a lunge round, a hurt round, KO, victory, party creation):
  APPROVE; notes reported to the user (12).
- **Gates (2026-11-27).** `selftest.py` ALL PASSED (2160 ok, 0 FAIL); `hero_user.py check --all` 8 / 8 OK;
  `puppet.py review` battle OK for all 16 classes (the lance pair's L1-L8 and feet checks included); `puppet_kneel.py
  check` 16 / 16 OK (the lance pair locked); `kneel_tools.py coverage` heroes 16/16 (ai 12, user 4), monsters 123/123
  (ai 123); `kneel_tools.py party-diff --base bfc71d03`: 14 rows x 18 columns identical; `battle_ai field_ai characters`
  under PYTHONHASHSEED 0 / 1 identical; the main battle png byte-equal to class-barbarian's; `characters-ai.png` and
  every `monsters-ai*` file unchanged; `npm run build` OK; `npm run test:fast` 441 files, 10,769 tests passed;
  `npm run quest -- --strict` OK.
