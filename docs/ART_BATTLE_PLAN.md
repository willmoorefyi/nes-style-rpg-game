# Battle screen at 2x: boss cast stance, staged backgrounds, AI art by default (Phase 6b), rev 2

Rev 2.1 folds in both reviews: casting is reachable, the feet and clearing numbers agree, cast completion, path
mapping, nearest scaling, the enemy-path flag, a 400 px boss box, the budget, and the background CLI and metrics.

Three steps, in order:
1. Wire the boss `cast` stance.
2. Battle backgrounds built to a **stage spec**, so characters appear to stand in the scene.
3. Make the 2x battle art the default in normal play. The field and map art stay preview-only.

## 1. Boss cast stance

- **Data:** `monsters-ai.json` already carries `frames.cast` for the lich and Garland.
- **`BattleArt.getMonsterFrames`:** returns `cast` (and falls back to `attack` when a monster has none).
- **`EnemyPoseController.playCast(i)`:**
  - 24 frames in the `cast` pose, no lunge
  - a rise of −6 px (upward) over 6 frames, held, then back down over the last 6 frames, then idle
  - `attackOutDone` is true after 8 frames (the action resolves while the spell is held)
  - `isAttacking` is true for the whole cast, so the controller's `enemyStillAttacking` waits for it to finish
  - a hit never interrupts it; once the 24 frames are over, the enemy is idle and can be hit normally
- **Types:** `MonsterPose` becomes `'idle' | 'attack' | 'cast' | 'hurt'`; `MonsterFrames.cast` is a required texture,
  set to `attack` when the atlas has no cast frame (legacy art: the still).
- **Casting is reachable:** today no enemy ever issues `magic`. `BasicAI` always returns `fight`
  (`BasicAI.ts:21`) and `BossAI` is attached only in tests.
  - Debug scenarios get an optional `enemyAi` field: `{ <enemy id>: [{ type: magic, spellId: <id>, weight: n },
    { type: fight, weight: n }] }`. It travels `DebugScenarioLoader` → `BattleTrigger.triggerBattle(..., { enemyAi })` →
    `BattleSceneConfig.enemyAi`. `BattleScene` then calls `setEnemyAI(i, new BossAI(pattern))` for each matching enemy,
    right after it creates the state machine (`BattleScene.ts:52`).
  - `crossFileValidation.test.ts` checks that every `spellId` in a scenario's `enemyAi` exists in `spells.yaml`.
  - A new scenario, `ai_boss_cast`, makes the lich always cast.
  - Giving real bosses spells in `enemies.yaml` is a gameplay decision and out of scope.
- **`BattleAnimationController.startEnemyLunge`:** `magic` actions call `playCast`, `fight` actions call `playAttack`;
  items and run do nothing.
- **Tests:**
  - cast timing and offsets
  - magic → cast, fight → attack
  - a monster without `cast` shows `attack` frames for magic

## 2. Battle background stage spec

### Layout convention

The battle screen is a **stage**, not a landscape view:
- the scenery (tree line, cave wall, reeds, dunes, temple columns) sits **in the distance at the top**
- a fairly flat **battle plain** fills the rest, seen from above at roughly 35°
- enemies stand on the left half of the plain and the party in a staggered column on the right
- every actor's feet are on the plain; tall sprites overlap the backdrop behind them, which is what sells depth

Today's backgrounds are side-on landscapes with the horizon mid-screen, so the top party member stands in the sky.

### Zones

Screen px on the 1920x1080 canvas. The art is authored at 960x540 (2x), drawn full-screen as today, and the
windows overlay it.

| Zone | Screen y | Art y (2x) | Content |
|---|---|---|---|
| Hidden top | 0–120 | 0–60 | Behind the message window: continue the backdrop (sky, canopy, ceiling) |
| **Backdrop** | 120–300 | 60–150 | The location's scenery, detailed but slightly darker and less saturated than the actors |
| **Transition** | 300–340 | 150–170 | The base of the scenery (undergrowth, rocks, roots, a fog line, a far shoreline) meeting the ground; a soft edge, no hard horizontal line |
| **Stage** | 340–780 (visible) | 170–390 | The battle plain: flat ground with low-contrast texture, nothing taller than 8 screen px, no strong lines, light from the upper left |
| **Clearing** | x 80–1800, y 350–780 | x 40–900, y 175–390 | A lighter, worn, even-textured area inside the stage where all actors stand (a trodden path, packed sand, a cave floor) |
| Hidden bottom | 780–1080 | 390–540 | Behind the command windows: continue the ground |

**Feet rules (enforced in code, tested):**
- every actor's feet are at y 360–770, which lies inside both the stage (340+) and the clearing (350+); enemy box centres
  lie in x 80–1340, inside the clearing's x range
- sprite tops may rise into the backdrop but must stay below y 120
- **party feet (2x art):** `[360, 497, 633, 770]`, x `[1420, 1445, 1470, 1495]` (up from today's `[290, 440, 590, 740]`)
- **enemy area:** `ENEMY_AREA.y0 = 200` (was 130), so the smallest box's feet land at 360 or below. The column fit test
  is unchanged:
  - 3 small = 512 px and 2 large = 528 px, both within the 570 px area
  - a boss is 400 px
  - all 99 compositions are still checked for staying inside the area with no overlaps
  - the boss box is 400 (200 px cells at 2x): update `EnemyLayoutAi.test.ts` `BOX.boss` and
    `AiEnemyView.ts` `PLACEHOLDER.boss` from 352
- **Party "no overlap"** means no opaque pixels overlap (sprite bounding boxes may), checked in the browser screenshot.
- **The stage tests** go in a new file, `tests/scenes/battle/battleStage.test.ts`: party feet and tops are inside the
  rules, and enemy feet are in 360–770 for every composition.

### Acceptance metrics (measured by the build stage)

- **Horizon:** the row where edge density drops from backdrop to stage lies in screen y 290–350.
- **Flat stage:** mean edge density in the stage is at most 0.45x the backdrop's. There are no blobs of high local
  contrast taller than 8 px inside the clearing.
- **Readable actors:**
  - mean luminance contrast between the clearing and the mid-tones of the approved sprites is at least 15%, so
    characters stand out from the ground
  - stage saturation is at most 0.8x the sprites' mean saturation
- **No stray elements:** no text, UI, characters or creatures. This one is a reviewer check.

### Generation (`assets-src/gen/`; same budget guard, ledger, cache and `approve.py`)

- **The 7 ids** (grassland, forest, swamp, desert, ocean, cave, temple) and their scenery text live in a new
  `backgrounds.yaml`. `load_character` falls back to it with `kind: background`. There is one sheet type,
  `background`, at 16:9.
- **CLI:** `generate.py <id> --backend gemini --sheets background [--dry-run|--paid]`.
  `approve.py <id> background` writes `approved/<id>/background.png` and `.json` with the cache key.
- **Metrics CLI:** `python3 -I assets-src/gen/background.py --check <png>` prints the measured metrics and PASS/FAIL. The
  build stage refuses an approved background that fails.

- **Request:** one Gemini image per background at 16:9. Inputs:
  1. a **zone guide**: grey bands for backdrop, transition and stage, with a lighter clearing oval and labelled arrows
     for depth
  2. the knight battle sheet for **house style** (colour treatment and outline weight)
- **Prompt:**
  - a top-down three-quarter battle stage
  - the scenery only in the top band
  - an empty, even plain where fighters will stand
  - no characters, text or UI
  - a 15-bit-friendly palette
- **Density:** Gemini draws pixel art at about 5–6 render px per sprite px. That would give about 250x140 "pixels",
  four times chunkier than the sprites. So backgrounds are requested as a **detailed painted illustration** and
  **pixelized to 960x540** by the cut: area resample, then a 15-bit palette of about 48 colours with no outline.
  This gives 2 screen px detail, matching the sprites. **The pilot measures this:** if the result looks smeared, the
  fallback is to request pixel art and accept 4x background pixels. That needs a user decision.
- **Output:** `assets/backgrounds-ai/<id>.png` at 960x540, written by a new build stage, `backgrounds_ai`. The runtime
  scales it 2x and must set `texture.source.scaleMode = 'nearest'` (`BattleScene.ts:72` does not today).
- **Self-test additions:**
  - the guide's zone geometry
  - the cut produces 960x540 with at most 48 colours
  - the acceptance metrics run on a synthetic stage image (pass) and a synthetic side-on landscape (fail)
  - approved background keys reproduce

### Checkpoints

| # | Checkpoint | Images |
|---|---|---|
| A | grassland pilot. Measured against the metrics, and checked in-game silently with the party, a boss and 9 small monsters | 1 |
| B | forest, swamp, desert, ocean, cave, temple, after A passes its metrics | 6 |

**Budget:** the user's message on 2026-11-12 asked to proceed through steps 1–3 and check back when done. That is
the explicit go-ahead for checkpoint B. Each background is still a
separate `--paid` run with the default `--max-paid 1`, so each is logged in the ledger as its own checkpoint. B runs
only if A passes its metrics; otherwise stop and ask.

Retry rules are as before: offline fixes first, and at most one retry per background without further approval.

## 3. 2x battle art by default

- **New flag:** `useAiBattleArt()` in `src/core/artPreview.ts` is true in all builds (dev and production) unless the
  URL has `?art=legacy`. `isPreviewAi()` (dev, `?art=ai`) keeps gating the **field** art and 96 px tiles; those are
  unchanged.
- **Where the switch happens:** background paths come from `ExplorationScene.battleBackground` (`:480`) and the
  `background:` lines in `debug-scenarios.yaml`, not from `BattleTrigger`. `BattleScene` maps any
  `assets/backgrounds/<id>.png` to `assets/backgrounds-ai/<base id>.png` (`grassland-hd` maps to `grassland`). If the AI
  image fails to load, it chains a second load of the legacy path; only after both fail does it warn and keep the
  two-tone fill.
- **The enemy path takes the flag as a parameter:** `BattleDisplayManager` gets `useAi` from its config (default
  `useAiBattleArt()`). Scene tests that rely on the legacy enemy path pass `useAi: false`. `BattleArt.fetchAll` loads the
  monster atlas when `useAiBattleArt()` is true.
- **These switch to the flag:**
  - the party battle frames (`CharacterAtlas.getBattleFrames` default)
  - monster frames (`BattleArt.getMonsterFrames` default, and loading the atlas)
  - the enemy view, layout and poses (`BattleDisplayManager.createEnemySprites`)
  - backgrounds (`BattleScene` resolves `assets/backgrounds/<id>.png` → `assets/backgrounds-ai/<base id>.png`, falling back
    to legacy on load failure)
- **Fallbacks stay:** a missing AI atlas, sprite or background falls back to legacy art with a console warning.
- **Tests:**
  - `useAiBattleArt` URL handling (default on; `?art=legacy` off)
  - background path mapping and fallback
  - existing legacy-path tests pass `preferAi=false` (atlas getters) or `useAi: false` (enemy path) explicitly
- **Docs:** update `AGENTS.md` (art table, preview flags).

## Validation before the hand-back

Muted browser checks (`?mute=1`) of the debug scenarios `ai_party_base`, `ai_party_promoted`, `ai_boss` and
`ai_monsters_nine`, now without `?art=ai`:
- each actor's feet on the clearing
- no overlaps
- a boss cast observed at least once (forced via a test scenario if the AI does not cast)
- screenshots saved for the user

Then `selftest.py`, `npm run build` and `npm test`.

## Outcome (2026-11-12)

- **Step 1 is done.** Bosses play the `cast` stance for magic. The `ai_boss_cast` scenario (lich with
  `enemyAi: magic/ice`) was verified in the browser.
- **Step 2 used the user's hand-made backgrounds instead of generation.** No images were generated.
  - They are remapped once by `assets-src/tools/stage_backgrounds.py`: scaled to 1920 wide, with a per-image horizon
    placed at screen y 310 (240 for the shoreline, which is also zoomed 1.12 and right-aligned so the party stands on
    the rocks).
  - Outputs: 11 WebP files in `assets/backgrounds-ai/` (grassland, forest, desert, swamp, marsh, ocean = ship deck,
    cave, temple, river, shoreline, waterfall).
  - The party moved to feet `[440, 550, 660, 770]` at x `[1380, 1425, 1470, 1515]`, lower on the plain and wider
    apart.
- **Step 3 is done.** `useAiBattleArt()` is the default; `?art=legacy` returns to the old battle art and backgrounds.
