# Animated monster art (Phase 6a) — rev 2.1

**Goal:** every monster gets three battle poses (**idle**, **attack**, **hurt**) from **one Gemini image per monster
type**, at the same 2x art scale as the AI party.

- **In battle:** a monster shows its attack pose (with a short lunge) when it acts, and its hurt pose (with a shake)
  when it takes damage.
- **No death pose:** defeated monsters fade out from the hurt pose.
- **Palette swaps:** variants are recolours of a base type, so they need no extra images.
- **Preview only** (`?art=ai`) until the user switches it on.

Rev 2 addresses the review findings: aspect handling, sprite lookup, lunge timing, enemy layout, counts, the loader and
prompt, approval, feet placement, lethal hits, pose plumbing, and measurable acceptance. Rev 2 was approved by the
reviewer; rev 2.1 folds in the follow-ups: preview gating, legacy frames, guide grid and the spell flash.

**Preview gating:** everything here runs only with `?art=ai`: art, new layout, `enemy_lunge`, poses and shake.
Normal play is unchanged until the user switches it on. In preview, monsters without AI art yet use their legacy image
for all poses, so the motion can be checked before any image is paid for.

## Current state (verified)

**Enemies:**
- `assets/data/enemies.yaml` has 12 enemies: 7 small, 4 large (ogre, troll, dragon, garland) and 1 boss (lich).
- Each has `id`, `sprite` (`types/index.ts:55`) and an optional `size`.

**Art and layout:**
- Legacy art is one still per monster at `assets/sprites/monsters/<sprite>.png` (32/64/96 native at x3), loaded by
  `BattleArt.ts`.
- The lookup uses `enemy.data.id`, not `sprite` (`BattleDisplayManager.ts:65`).
- Each image is stretched to fill its layout box, and the box is centred on (x, y) (`:68-69`).
- `computeEnemyLayout` (`BattleLayoutEngine.ts:19`) uses hand-placed grids sized for 96/192/288 px boxes.

**Battle screen:**
- The battle field spans y 120–780 (`BattleDisplayManager.ts:128`).
- The AI party column starts at x 1420 (`:19`).

**Animation (`BattleAnimationController`):**
- `execute` lasts one tick: it runs the action and moves on to `result` (`:116-133`).
- Enemies skip the step forward (`:102`).
- `setActorPose` and `flashHurt` handle party sprites only (`:174-198`).
- The dying fade lasts 30 frames (`:290`).

## Art spec

| Size | Output cell (art px) | Figure height | On screen (2x) | Monsters |
|---|---|---|---|---|
| small | 80x80 | 56–72 | 160 | goblin, wolf, skeleton, pirate, mummy, cockatrice, vampire |
| large | 128x128 | 96–120 | 256 | ogre, troll, dragon, garland |
| boss | 176x176 | 140–168 | 352 | lich |

**Poses and facing:**
- **Poses:** idle (ready stance), attack (signature move), hurt (recoil away from the party).
- **Facing:** right, toward the party.

**Sheet layout:**
- One row of 3 cells, with a guide image of 1680x720 (exactly 21:9).
- `SheetGeom` gets an `aspect_override="21:9"`, because the computed ratio would be `7:3`, which Gemini rejects
  (`spec.py:70-74`).
- Each guide cell is 560x720 (portrait). Cuts are trimmed to a square output cell, bottom-aligned for grounded
  monsters, as `FIELD3_GEOM` does with `trim_width` (`spec.py:89`).
- The `SheetGeom` grid is the native size of the whole guide cell, not the output cell: 105x135 at the expected 5.33
  guide px per art px, which keeps the guide a whole multiple. Pilot A's measured pitch replaces the 5.33.
- The figure is then fitted (`fit_height` = the band's top height) and trimmed to the band's output cell (80/128/176).
- The guide's size box is drawn at the band's figure height divided by the measured pitch, so Gemini is shown the
  intended size.

**Feet and floating:**
- Grounded monsters share one feet row per size: small 76, large 122, boss 168.
- Floating monsters (`floating: true` in `monsters.yaml` and the atlas JSON only; cockatrice, vampire, lich) get one
  shared vertical offset per sheet, so a lunge or lift is kept.

**Colours:** at most 16 per monster, 15-bit, with the outline colour shared.

**Density gate:**
- The ~5.3 render px per sprite px figure was measured on 1264x848 outputs. **Pilot A records the actual 21:9 output
  size and pitch** before any other monster runs.
- Expected capacity is about 105x136 sprite px per cell: enough for small, short for large and boss.
- Art smaller than its cell is enlarged by the native-scaled path (nearest-neighbour, crisp, but with larger pixels).
- **User decision after pilots B and C:** accept that, or spend 2–3 images on the boss only (one pose per image).

## Generation pipeline (`assets-src/gen/`)

**`monsters.yaml` (new):** per monster:
- `id` (= the `sprite` name), `size`, `prompt`, `attack`, `hurt`
- optional `floating`, `face`, `seeds`, `variants`

**Loader and prompt:**
- `load_character` falls back to `monsters.yaml`, so `generate.py` and `approve.py` share it.
- A `kind: monster` field selects a new `monster_prompt()` template. `gemini_prompt` stays untouched, so approved
  character keys don't change.

**Sheets:** `monster_small`, `monster_large` and `monster_boss` in `SHEETS`, chosen from `size`. A request for the
wrong size is refused.

**Inputs, in order (the prompt numbers them):**
1. **Layout guide:** 3 cells, each with a light-grey box at the target figure size, a ground line (omitted for
   floating monsters) and a facing arrow. No mannequin.
2. **House style:** the approved knight battle sheet: "match pixel size, outline, shading; do NOT copy its costume".
3. **Design reference:** the legacy sprite (our own art), 8x nearest: "same creature, design, colours and silhouette;
   redraw as detailed modern pixel art".

The git-ignored third-party bead image is **not** sent.

**Prompt rules:**
- No grey guide shapes.
- One creature per cell, the same creature in all three cells, nothing else (no props or effects outside the cell).
- Faces readable where the creature has one; the `face` override covers skull sockets, wraps and similar.
- The `attack` and `hurt` text is per monster.

**Cut:** the existing 1:1, native-scaled and resample paths, with facial-detail protection and a shared palette.

**Approval:**
- `approve.py` gets a monster branch that writes `poses: [idle, attack, hurt]`, `size`, `floating` and optional
  `flip_frames`.
- Per-frame fixes (`flip_frames`; `head_from` is not used for monsters) are applied in the new `monsters_ai` build
  stage, as `field_ai` does today (`build_assets.py:163`).

**Self-test additions:**
- the 21:9 aspect string
- the guide box size per size band
- trim and feet row per band
- floating offset is shared across frames
- variant recolour keeps ramp order and the outline
- approved monster keys reproduce, and character keys stay unchanged

## Palette swaps (no extra images)

**Definition:** `variants` on a base monster, e.g.

```yaml
variants:
  - {id: hobgoblin, map: {"#5a8a32": "#8a5232", ...}}
  - {id: ..., hue: 40, sat: 1.1}
```

**Build:** `monsters_ai` writes each variant as its own atlas entry.

**Runtime:**
- The art lookup changes from `data.id` to `data.sprite` (fixes `BattleDisplayManager.ts:65`). After that, a new enemy
  only needs `sprite: hobgoblin`.
- Legacy sprite files are named by sprite, and today sprite = id for all 12, so nothing breaks.

**Now:** no variants are added; the mechanism ships with a self-test and a test fixture.

## Build: new stage `monsters_ai`

Approved monster sheets (+ variants) → `assets/sprites/monsters-ai.png` and `.json`. Per sprite id, the JSON holds:
- `cell`
- `frames: {idle, attack, hurt}` (rects)
- `footRow`, `floating`, and `scale: 2`

## Runtime

### 1. `BattleArt`

- In preview mode, also load the monster atlas. This load is isolated: a failure warns and falls back to legacy art.
- `getMonsterFrames(sprite)` returns `{ idle, attack, hurt, scale, footRow, floating, cell }`.
- Legacy art returns the same texture for all three poses, with `scale: 1`, `cell` = the texture's own size (already
  x3: 96/192/288 px), and `footRow` = its last opaque row.

### 2. `computeEnemyLayoutAi(data, sizes)` in `BattleLayoutEngine` (the legacy function is unchanged)

**Enemy area:** x 80–1340, y 130–770. The right edge leaves 80 px before the party (x 1420).

**Packing:**
- Enemies are sorted boss, large, small.
- They fill columns left to right. A column holds 1 boss, 2 large or 3 small, stacked with equal gaps, feet-anchored.
- Columns are separated by 24 px, and alternate columns are offset by half a row for the classic staggered look.

**Return value:** per enemy `{ x, feetY, w, h }`, in screen px.

**Guarantee (tested):**
- every box lies inside the area
- no two boxes overlap
- this holds for every size mix up to 9 enemies with at most 1 boss (all compositions enumerated in the test)

**Fallback:** if a mix ever exceeds the width, the art is shown at 1x screen scale for that battle (still whole
pixels, never fractional). It is tested, but no current encounter triggers it.

### 3. Sprite placement

- Sprites are not stretched: scale = `art.scale`.
- `sprite.x = x - cell.w*scale/2` and `sprite.y = feetY - (footRow+1)*scale`.
- Floating monsters use `feetY` as the bottom of their hover band, with the same formula.

### 4. `EnemyPoseController` (new module; keeps `BattleDisplayManager`, 309 lines, from growing)

- It owns per-enemy frames, the current pose, timers and position offsets.
- `setPose(i, pose)`, `playAttack(i)`, `playHurt(i)` and `update(dt)`, called from the scene's update.

**Attack:** about 20 frames:
- 6 frames lunging 24 px toward the party
- 8 frames held
- 6 frames back

Then idle.

**Hurt:** 18 frames of a ±4 px shake, then idle. A new hit restarts it. Hurt never overrides an attack in progress.

**Dying:** set to hurt and frozen. No timers run while the enemy is in `dyingEnemies`, and the existing 30-frame fade
runs on that frame.

The spell flash uses the current frame's texture: it reads `sprite.texture` at flash time
(`BattleAnimationController.ts:199`). The flash overlay is re-positioned from
  its sprite every tick, so it follows a lunge or shake (today it is placed once, `:208`).

### 5. `BattleAnimationController`

- New phase `enemy_lunge`, between `announce` and `execute` for enemy actors on fight and magic. It calls
  `playAttack` and waits for the lunge-out to finish, then `execute` runs as today.
- `completeAction` waits for the return to idle.
- Items and run: no lunge.
- In `spawnFloatingTextsFromEvents`: if the target is an enemy, damage > 0 and not a heal, call `playHurt` (or the
  dying freeze when the target's HP is 0).

### 6. Debug scenarios (`?art=ai&mute=1`)

- `ai_monsters_small`: goblin, wolf, skeleton.
- `ai_monsters_large`: ogre, troll.
- `ai_boss`: lich plus 2 goblins.
- `ai_monsters_nine`: 9 small, for the layout.

## Tests (Vitest)

**Art and lookup:**
- `BattleArt.getMonsterFrames`: AI frames; legacy fallback (the same texture 3 times, correct `footRow`); a missing
  atlas does not block battle.
- The art lookup uses `data.sprite`; a fixture enemy with `id ≠ sprite` gets the sprite's art.

**Layout:**
- `computeEnemyLayoutAi`: inside the area, with no overlaps, for every composition up to 9 enemies with at most 1 boss.
- The 1x fallback triggers only when the width is exceeded.

**`EnemyPoseController`:**
- attack timing: pose sequence and offsets per frame
- hurt shake and restart
- hurt does not override an attack
- the dying freeze

**`BattleAnimationController`:**
- an enemy fight runs `enemy_lunge`, then `execute`
- an enemy hit calls `playHurt`
- a heal or a 0-damage miss does not
- a lethal hit fades in the hurt pose

**Asset coverage:**
- each `monsters-ai` entry has all 3 frames inside the image
- every enemy `sprite` resolves to AI or legacy art
- variants resolve

## Checkpoints and budget

| # | Checkpoint | Images | Exit criteria |
|---|---|---|---|
| 0 | Offline: geometry, prompt, loader, dry runs; runtime poses, layout and lunge/shake wired on legacy art | 0 | Build and tests pass; a muted browser check shows the lunge and shake with the current art |
| A | goblin (small) | 1 | Records output size and pitch; acceptance passes |
| B | ogre (large) | 1 | Density measured, then user gate |
| C | lich (boss, floating) | 1 | Density measured and floating alignment checked, then user gate |
| D | 9 remaining | 9 | Needs the user to lift the limit; runs with `--max-paid 9`, or one at a time |

Total: 12 images plus retries.

**Retry rules (as before):**
- try an offline fix first
- `--retry` needs approval
- two failed attempts on one monster stop the rollout for discussion

**Acceptance per sheet (measured by `frame_stats` plus review):**
- figure height (opaque rows) within its band: small 56–72, large 96–120, boss 140–168
- the same feet row in all 3 frames (grounded), or one offset (floating)
- at most 16 colours, with the outline present in every frame
- attack and hurt each differ from idle by at least 15% of the idle figure's pixels (silhouette XOR)
- facing right in all 3 frames (checked side by side; `flip_frames` fixes single frames)
- no grey guide parts, no stray props outside the figure
- a readable face per the `face` rule
- recognisably the legacy creature (user review)

## Out of scope

- Death and status poses, and per-spell casting animations.
- Tiles and backdrops (6b/6c).
- Making AI art the default.

## Results of the pilots (2026-11-12)

- **Measured output:** a 21:9 request returns 1584x672. Goblin pitch 6.6 px (80x101 sprite px per cell); ogre and lich
  pitch 5.34 px. Large monsters fit at 1:1 (ogre 89–102 px), so the large-band density gate is passed.
- **Bosses are drawn one pose per request** (`per_pose: true`):
  - a square 1024 guide, a 200 px output cell, and about 185 px figures at 1:1 (pitch 5.12, grid confidence ~0.85)
  - attack, cast and hurt each send the approved idle as identity
  - the action poses use `action_prompt` (no static staging such as mist) plus explicit movement direction
  - the user approved this for bosses: 4 images per boss
- **Boss `cast` stance:** bosses get a fourth pose, carried in the atlas as `cast`; not wired into battle yet.
- **The lich is redesigned** as an original frost-undead knight-king ("the Rime Sovereign"; id `lich` unchanged), with no
  legacy design reference.
- **Cut fixes:**
  - white-page backgrounds are treated as background
  - weak-but-plausible grids are point-sampled at Gemini's pitch
  - art within 10% of the band is kept 1:1
  - opt-in `haze` removes magenta-blended mist
  - sizeable floating parts next to the figure (a spell crystal) are kept
- **Approved:** goblin, ogre, lich (4 poses). Remaining: 9 monsters (checkpoint D).
