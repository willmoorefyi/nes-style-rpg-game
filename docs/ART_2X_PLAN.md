# Plan: 2x art scale and AI-generated sprites (rev 4)

Status: **approved by Momus (review #4)**. Two implementation notes from that review are folded in below. Owner: Will Moore. Branch: `snes-asset-pipeline`.
Baseline: `npm run build` exits 0; `npm test` gives 77 files and 956 tests passing.

## Goal

Move every game graphic to one pixel scale, **1 art pixel = 2 screen pixels** at 1920x1080, for a modern, clean
pixel-art look:
- **Battle characters:** about 72 px tall native in an 80x80 cell (decision at checkpoint A, see below).
- **Field characters:** FF3/FF6-style, two tiles tall at 24x48 native.

Character art comes from Google Gemini (`gemini-3.1-flash-lite-image`) through `assets-src/gen/`, then pixelized.

## Hard rules

1. **One paid image per checkpoint, enforced in code and by a ledger.**
   - `generate.py` requires an explicit `--backend {gemini,bedrock}`; there is no default.
   - Before any call it computes every request's cache key with the backend's own `cache_key()` (Gemini and
     Bedrock both expose one), and refuses if more than `--max-paid` (default 1) would miss the cache.
   - It makes no uncached call unless `--paid` is passed.
   - Every paid attempt is appended to `assets-src/gen/cache/ledger.jsonl` **before** the call: timestamp, backend,
     model, character, sheet, seed, cache key. The outcome is added after the call. Failures and no-image replies
     count as spent.
   - **Any** earlier paid ledger entry for the same character+sheet (success or failure, any prompt or seed) blocks
     a new paid call for that checkpoint. A new paid call needs `--retry`, which I pass only after the user explicitly approves a retry in chat. Raising
     `--max-paid` above 1 is likewise only on the user's explicit instruction. The code enforces this per checkpoint;
     the "wait for the user" step is a stated process rule.
   - `--dry-run` writes the inputs and reports how many requests would be paid.
   - Every paid step in this plan uses an exact single-sheet, single-seed command (below).
2. **One scale on screen in normal play.** New art is authored at native size and shown at exactly 2x with
   nearest-neighbour filtering.
   - Until every asset on a screen is at 2x (Phase 6 for monsters, tiles and backdrops), new AI art is shown only
     in **preview mode**: dev build with the `?art=ai` URL parameter.
   - In preview mode, mixed scales are expected and accepted for review only.
   - Normal play is visually unchanged until the user approves switching a screen over.
3. **Nothing breaks.** `npm run build` and `npm test` pass at the end of every phase. Legacy atlases are never
   overwritten by AI atlases; they live in separate files.
4. **No secrets.** `GEMINI_API_KEY` is read only from the git-ignored `.env`. It is never printed, logged, cached,
   or committed.

## Target sizes (native px)

| Asset | Cell | Figure / feet | Display | On screen |
|---|---|---|---|---|
| Battle party | 80x80 | about 68-76 tall, feet on row 76 | 2x | 160x160 |
| Field character | 24x48 | about 42 tall, feet on row 46 | 2x | 48x96 (same as the current 16x32 at 3x) |
| Map tile | 24x24 | | 2x | 48x48 (`TILE_SIZE` unchanged) |
| Monsters S / L / Boss | 64 / 128 / 192 | | 2x | 128 / 256 / 384 (Phase 6) |
| Backdrop | 960x540 | | 2x | 1920x1080 (Phase 6) |

## Checkpoint A decision (user, 2026-11-12): keep the pixels Gemini draws

- **What happened:** the first battle sheet showed that Gemini draws real pixel art on its own grid, about
  5.3 px per art pixel in a 1264x848 image, which is about 80x80 art pixels per cell.
- **Why not 64x64:** shrinking that to 64x64 (0.8x) destroyed faces and single-pixel detail at every
  tie-break setting.
- **Decision:** the battle grid is **80x80**, point-sampled 1:1 with no resampling, feet on row 76, shown at 2x
  (160x160 on screen).
- **Guides are unchanged:** guide px per unit stays 12.96 and the guide foot line is pinned at 496 guide px, so
  the approved request's cache key is unchanged.
- **Field cells** keep 24x48 for now. Gemini's field pixel grid is measured at checkpoint B, and the field cell is
  adjusted to match it the same way, with the user's approval.

## Sheet geometry (replaces the single `GUIDE_CELL` / `GUIDE_SCALE`)

`spec.py` gets a `SheetGeom` per sheet kind. The **drawn** figure bottom (boot caps, pose y ≈ 39.4) is anchored,
not the joint y. Measurements are made with `guides.draw_pose` offline.

- **Battle:** guide cell 512x512 px (8 guide px per native px), layout 3x2, image 1536x1024 (aspect 3:2).
  - 12.96 guide px per pose unit. The guide's drawn bottom is pinned at 496 guide px.
  - Since checkpoint A, the native grid is 80x80: about 2.03 art px per unit, last opaque row 76.
  - The standing poses (ready, attack, cast, hurt) measure about 56-58 px tall without the weapon. Down is a
    kneel, about 39 px, and is excluded from the height check.
  - Victory is adjusted in `spec.py` so it fits the cell: hand_n moves to (5.5, 9.0) and the weapon to (0.5, -6.5).
    The tip lands on native row about 1.
- **Field:** guide cell 256x512 px (10.67 guide px per native px), layout **3x1 strip**, image 768x512 (aspect 3:2).
  - The cells are stand, step-left and step-right.
  - Scale 1.18 native px per unit (12.59 guide px per unit), so the figure is about 42.2 px tall. The drawn bottom
    sits on native row 46.
  - The side-walk stride in `spec._walk` is narrowed: foot offset 4·lift becomes 3.2·lift, and knee 2.5 becomes 2.0,
    so the widest frame is about 22.3 px (23 px or less).
- **Horizontal placement:** guides are centred on the span of all poses in the sheet, not the old 0-32 box.
  - Battle span: pose x from -6.6 to 31.3, which is 61.4 px of the 64 px cell.
  - Field span: about 22.3 of 24 px.
  - The offset is computed from the pose data in `SheetGeom`, so any pose edit re-centres automatically.
- **Everywhere:** `guides.draw_pose`, `guides.sheet`, `guides.cell_masks`, the crop in `generate.generate_sheet` and
  `generate.review` take `(cell_w, cell_h)` from the geometry. The aspect ratio is computed from pixel size.

## Phases

### Phase 1: 2x spec and pipeline (no paid images)

1. **Geometry:** `SheetGeom` as above. `pixelize.pixelize` takes a `(w, h)` grid and the native foot row.
2. **Gemini prompt:**
   - Ask for pixel art "about 56-60 pixels tall (battle) / 42 pixels tall (field), every pixel a hard-edged square,
     no anti-aliasing".
   - Solid magenta #FF00FF background.
   - "Side view, nose pointing left, one eye visible" for battle and field-left.
3. **Background key:** if the border is magenta (within tolerance), key by colour. Otherwise use the existing
   border flood fill, so old white-background raws still work.
4. **Ink:** in `pixelize.pixelize`, a pixel counts as outline only if every channel is below 40 (today
   `ink_luma=58` on the max channel).
5. **Crop bleed fix:** `generate_sheet` clips each crop to its own cell and passes only that cell's guide mask.
   Blobs touching the cell edge that don't overlap the guide are dropped. Test: a unit test with a synthetic
   two-cell image, where a bar in the neighbouring cell must not appear in cell 0's output.
6. **Identity reference:** an optional `identity_ref:` in `characters.yaml` (a path to an approved pixelized sheet)
   is upscaled 8x nearest-neighbour, passed as the third Gemini image, and shown in `--dry-run`. It is part of the cache key.
7. **Offline re-pixelize:** `generate.py --repixelize <out-dir>` re-runs pixelize and review on existing
   `*_raw.png` files and never imports a backend.
8. **Budget guard** (hard rule 1): `--backend` required, `--paid`, `--max-paid` (default 1), and a dry-run report
   of the paid count.
9. **Size reference:** `assets-src/gen/refs/pr_warrior_1080p.png` (git-ignored). It is cropped from the official
   Steam screenshot
   `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1173770/ss_d2d0f16f03c1d5808c7666768c0f4b3f822683c3.1920x1080.jpg`,
   box (1350,240,1480,375), and shown at 1:1 next to frames rendered at 2x in `review.png`.
10. **`characters.yaml`:** the knight gets `seeds: [1234]` only.
11. **Docs:** `assets-src/gen/README.md`, the `CharacterAtlas.ts` header comment (it says battle is 4x), the
    `build_assets.py` docstring (x4), and `AGENTS.md`.
12. **Tests:** pytest-free Python self-checks are run by
    `python3 -I assets-src/gen/selftest.py`, with no network:
    - **Battle geometry:** every pose's last opaque row is 61 ±1. Every pose, weapon included, fits inside rows
      0-63 and columns 0-63. Ready, attack, cast, hurt and victory are 54-60 px tall without the weapon; down is
      36-42 px. Heights are counted in whole opaque rows.
    - **Field geometry:** last opaque row 46 ±1, height 41-46 in whole opaque rows, width 23 px or less in
      every frame.
    - the crop-bleed test
    - the magenta key test
    - the budget guard: counts misses, writes the ledger before the call, records a fake-backend failure as spent,
      and refuses a second paid call at the same checkpoint without `--retry`, including after a successful call
      with an edited prompt (a new cache key)
    - the Steam size-reference crop contains the warrior (dark-outline bounding box inside the crop)

Acceptance:
- `selftest.py` passes.
- `generate.py knight --backend gemini --sheets battle --seeds 1234 --dry-run` reports "1 paid request" and writes
  the 1536x1024 guide, the prompt, and the style and size references.
- `generate.py --repixelize assets-src/gen/out/gemini/knight/1234` runs offline on the existing raw.
- `npm test` and `npm run build` pass.

### Phase 2: knight battle sheet, checkpoint A (exactly 1 paid image)

Command:
`python3 -I assets-src/gen/generate.py knight --backend gemini --sheets battle --seeds 1234 --paid`

Then stop and show the user `review.png`.

Acceptance checklist (reported numerically, then the user's approval):
- the figure is 68-76 px tall in ready, attack, cast, hurt and victory, and 45-53 px in down (80x80 grid after
  the checkpoint A decision)
- feet on row 76 ±1
- 14 colours or fewer, including the outline
- a 1px outline is present
- facing left

Any retry is one more paid image and another stop.

### Phase 3: knight battle preview in game (no paid images)

1. **Approved art:** copy the approved sheets to `assets-src/gen/approved/knight/battle.png`, along with the
   pixelized output and the raw. These are committed.
2. **Build stage:** a new `battle_ai` stage in `build_assets.py` writes **separate** files:
   `assets/sprites/battle-characters-ai.png` and `.json`.
   - The JSON holds `scale: 2`, `cell: [80,80]`, `footRow: 76`, the poses, and `sheets` (one row per approved id).
   - The legacy `battle` stage and its files are untouched. `npm run assets` runs both.
3. **`CharacterAtlas`:**
   - Loads `battle-characters-ai.json` in a **separate** try/catch, after the legacy load.
   - A 404, a non-JSON body (for example Vite's HTML fallback) or a missing PNG leaves the AI atlas null and logs a
     warning. It never touches the legacy fields, and `isLoaded` keeps meaning "legacy loaded".
   - `getBattleFrames(id)` returns `{frames, scale, footRow, cell, ai}`, using AI art only when preview mode is on
     and the id has AI art.
   - The only caller is `BattleDisplayManager.buildPartySprite` (line 70).
   - `characterAtlas.load()` resolves only after both the legacy and the AI attempts finish, because
     `BattleDisplayManager` only swaps art in while `isLoaded` is false (lines 70, 158).
   - `isPreviewAi()` reads `?art=ai` in dev builds only.
4. **`BattleDisplayManager`:**
   - **Legacy art (`ai: false`):** the existing constants `PARTY_FEET_Y`, `PARTY_X` and `PARTY_BOTTOM_PAD`
     (lines 12-15) and the placeholder positions (lines 71, 78) are kept unchanged. Normal play is pixel-identical.
   - **AI art (`ai: true`, preview only; 80x80 cell at 2x = 160 px):** feet Y = 290, 440, 590, 740, i.e. the
     bottom of the last opaque row. Sprite y = feetY − (footRow + 1)·scale = feetY − 154, and x = 1420 + 25·i.
   - Fit: sprite tops 136/286/436/586, cell bottoms 296/446/596/746, all inside battle field y 120-780.
   - Figures are at most about 150 px tall over a 150 px slot spacing, so they don't visibly overlap. The
     transparent rows below the feet overlap by 6 px.
   - Right edge 1655, clear of the status boxes at x 1700.
5. **Debug:** a debug scenario `knight_party` (4 knights vs 2 goblins) in `assets/data/debug-scenarios.yaml`, so
   the whole party has AI art.
6. **Tests:**
   - `assetCoverage` adds an AI-atlas block. If the file exists: the image size equals
     `cell × scale × poses` by rows, the scale is 2, the on-screen height is 160, and every listed id is a known
     class.
   - The legacy assertions (lines 45-59, 73-80) stay as they are, because the legacy atlas is unchanged.
   - A `BattleDisplayManager` unit test: legacy positions are unchanged, and AI positions match the numbers above.
   - A `CharacterAtlas` unit test: a mocked 404, and a mocked HTML body for the AI JSON, both leave legacy art
     loaded and the AI atlas null.
7. **Screenshot:** Playwright on `npm run dev`. Open `http://localhost:5173/?art=ai`, choose Debug, then
   `knight_party` (using held-key taps through `page.evaluate`, as before), and screenshot.

Acceptance: the screenshot shows 4 knights in 160 px cells, feet aligned, with no visible overlap. Tests and build pass.

### Phase 4: knight field sheets, checkpoints B, C, D (exactly 1 paid image each)

Commands, one per checkpoint, each followed by a stop:

```
generate.py knight --backend gemini --sheets field_down --seeds 1234 --paid
generate.py knight --backend gemini --sheets field_left --seeds 1234 --paid
generate.py knight --backend gemini --sheets field_up   --seeds 1234 --paid
```

`characters.yaml` sets `identity_ref: assets-src/gen/approved/knight/battle.png` before checkpoint B.

**Back-view check (field_up):**
- **Skin colours** are taken from the approved `field_down` stand frame:
  - the palette colours in its face box (middle 50% of the width, 35-60% down the figure's head region, so the eyes
    and mouth are excluded by frequency)
  - plus the colours of its hand pixels
  - taking the two most frequent colours **per region** (up to 4 in total)
- In each `field_up` cell, a pixel counts as skin if it is within RGB distance 24 of one of those colours.
- A cell passes if skin is under 3% of its head region (top 35% of the figure's bounding box). Blond hair and gold
  trim are far from the measured skin colours, so they don't trigger it.
- The roles are fixed: cell 1 = stand, 2 = step-left, 3 = step-right. No cells are swapped between roles.
- Any failing role is reported to the user with the number. A retry is one more paid image, only with approval
  (`--retry`).

**Field atlas:**
- A new `field_ai` stage writes `assets/sprites/characters-ai.png` and `.json`: per-sheet `cell [24,48]`,
  `scale 2`, rows down, up, left, right.
- The builder bakes the **right row as a mirror of left**, so runtime code reading 4 rows is unchanged.
- `CharacterAtlas.getFieldArt` and `getNpcFrames` prefer AI art in preview mode.
- `characters-ai.json` uses the same isolated loading and 404/HTML unit test as the battle AI atlas (Phase 3.3).
- `PlayerController` and `NPC` need **no change**: the frame height is 96 either way, and they already offset by
  frame height.

**Field debug and tests:**
- `DebugScenarioLoader` gets `mode: field` with `map:` and `spawn: [x, y]` keys.
- The scenario `knight_field` loads `cornelia` with a knight leader at a walkable spawn tile. The loader sets
  `game.currentMapId` and `game.playerPosition`, which `ExplorationScene.enter` already reads (lines 141-142).
  The tile is chosen from `cornelia.yaml` collision data and checked by the unit test.
- Unit test for the new mode.
- `assetCoverage` block for the AI field atlas (cell, scale, 4 rows, right == mirrored left).

**Screenshot:** Playwright at `/?art=ai`, choose Debug, then `knight_field`, then walk a few tiles; screenshots of
all 4 facings.

Acceptance: each direction is approved by the user, and the walk screenshots look correct. Tests and build pass.

### Phase 5: style lock and rollout plan (no paid images)

- Lock the knight prompt, seed and reference images in `characters.yaml` and `spec.py`.
- Commit the approved sheets and the cache entries those approved images came from.
- Write `docs/ART_ROLLOUT.md`: the 11 classes and 9 NPC types, 4 sheets each, still one paid image per checkpoint
  unless the user raises `--max-paid`.

### Phase 6 (separate plan and approval): monsters, tiles, backdrops at 2x

Then switch preview to default, screen by screen, with the user's approval.

## Risks

| Risk | Mitigation |
|---|---|
| Gemini ignores the size or facing instructions | Pixelize enforces the grid and foot row; numeric checklist; one approved retry |
| Back views fail | Fixed-role skin check; report before any retry; fallback of repainting the head from the front frame (later, with approval) |
| Identity drift between sheets | `identity_ref` image plus identical costume text |
| Scale mixing | AI art only in `?art=ai` preview until Phase 6 |
| Cost creep | Code-level guard (`--paid`, `--max-paid 1`, required `--backend`), ledger blocks repeat checkpoints without `--retry`, dry-run first |

## Out of scope

Monsters, tiles, backdrops (Phase 6). NPC and other class art (rollout). Audio. Gameplay.
