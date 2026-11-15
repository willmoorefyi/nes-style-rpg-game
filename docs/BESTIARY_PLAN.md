# Bestiary plan (tranche Fh), 2026-11-14

**Status:** plan only, nothing implemented. **Base:** `feedback` at `e356cc5` (F0 and Fa merged). File:line references
are to that commit. **Runs after wave 1 of `docs/FEEDBACK_PLAN_2026-11-14.md` merges** (Fb, Fg, Fc, Fd and Ff). It can
run in parallel with Fe (wave 2) because the two share no file, and it **merges after Fe** (decision BS-7).

**User request (verbatim intent):** "There should be a bestiary from the overview where I can explore the enemies. It
should allow me to scroll through every enemy and see their stats (HP, spells, XP, gold), immunities, weaknesses, etc.
While the enemy stats are displayed the enemy should be displayed to the side in profile, idle pose, looping through
different animations (attack, hurt, casting, etc.) with reasonable short breaks in between. That will be a fun way to
explore the monsters as I build the game."

**Rules (AGENTS.md, as pass F):**
- Data and text in YAML (new `assets/data/bestiary.yaml`). Stats are read from `enemies.yaml`, never copied.
- No `as any`, no `@ts-ignore`, no silent `catch`. Every failed load (YAML, map, background, art) is logged.
- New source files under 250 lines. Scenes are registered with `registerLazy` and opened with push/pop.
- Reuse `Window`, `Menu` (scrolling and auto-repeat), `HelpWindow`, `AiEnemyView`, `EnemyPoseController`,
  `BattleArt` and `computeEnemyLayoutAi`. Nothing in the battle runtime is reimplemented or edited.
- 2x art only. Missing art shows the existing placeholder box and its one console warning.
- Browser checks use `http://127.0.0.1:5173/?mute=1&...` and never leave out `mute=1`. They must show 0 console
  errors. Close the page and stop the dev server afterwards.

---

## 0. Success criteria (defined before implementation)

```json
{
  "functional": [
    "The field menu has a Bestiary row that opens the bestiary; X closes it and returns to the field menu",
    "In dev builds the title menu has a Bestiary item, so the bestiary opens without a party or a save",
    "The list shows every enemy in enemies.yaml, in data order, numbered 001, 002, ...; up/down scroll with auto-repeat, left/right page by one screen",
    "For the highlighted enemy the stats panel shows HP, Attack (damage range and hits), Defense, Magic Defense, Strength, Agility, Intellect, Vitality, Luck, Accuracy, Evade, XP, Gold, weaknesses, resistances, immunities, absorbs, family, size, attack type, actions and spells, boss phases, a boss tag and the habitat",
    "Beside the stats the enemy stands in profile on a battle background, facing the party side, at its battle size and feet position",
    "It loops: idle break, attack (its real melee, heavy or ranged choreography, never leaving the panel), idle break, hurt, idle break, cast (bosses), idle break, daze (when the sheet has real daze frames), then again",
    "Z plays the next animation at once; Shift pauses and resumes the loop",
    "All labels, element names, family names, zone names and help text come from bestiary.yaml",
    "A mode switch in bestiary.yaml (mode: all | seen) exists; the default is all; seen enemies are recorded as game flags"
  ],
  "observable": [
    "Screenshots: goblin idle, goblin attack contact, wolf hurt, garland raised hold (heavy), garland cast, dragon attack (ranged, in place), gr_wolf (palette variant), a missing-art placeholder (synthetic in a test)",
    "The idle break between two animations is 60 frames (1 s) at the default setting",
    "Scrolling all 14 entries with a held key changes the preview without console errors and without growth in the scene's child count"
  ],
  "pass_fail": [
    "npm run build and npm test pass",
    "Every new test fails on e356cc5 (the files or rows don't exist yet)",
    "No file of another tranche is edited before that tranche merges (section 6)",
    "Every new source file is under 250 lines; FieldMenuScene.ts and TitleScene.ts grow by at most 4 lines each",
    "Browser checks of section 8 show 0 console errors"
  ]
}
```

---

## 1. What exists (verified at e356cc5)

- **Data.** `assets/data/enemies.yaml` has 14 enemies (goblin, gr_imp, wolf, gr_wolf, skeleton, pirate, ogre, troll,
  mummy, cockatrice, vampire, dragon, garland, lich). `EnemyData` (`src/types/index.ts:88-109`) has `stats` (HP, the
  five FF1 attributes, attack, defense, magicDefense, optional accuracy, evade, hits, crit), `xpReward`, `goldReward`,
  `sprite`, `weakness?`, `resist?`, `elementalProfile?` (weaknesses, resistances, immunities, absorbs; no enemy uses it
  yet), `bossPhases?`, `family?`, `size?`, and pass F's `attack`, `attackEffect`, `attackAnim`.
- **No enemy has spells or an AI pattern in data.** Production enemies only Fight (`BasicAI`). `bossPhases` change
  `hits` / `attack` and say a message; their `patternId: aggressive` names no pattern (`ActionResolution.ts:73-76`
  warns). Spell-casting enemies exist only in debug scenarios (`enemyAi`). So "spells" shows "None" today, and the
  model is written so a future `spells` / `ai` field in `enemies.yaml` shows up without a UI change (section 3.3).
- **No status immunities in data.** Status spells roll `(148 + accuracy - magicDefense) / 200` for every target
  (`SpellStatus.ts:32-36`, `DamageFormula.ts:8, 89-93`). The bestiary shows that chance for the default spell
  accuracy (24) instead of an immunity list, and lists `immune` statuses once data has them (BS-5).
- **Habitats.** Encounter tables are in the map YAML: `encounters`, `encounterZones[].encounters` and
  `scriptedEncounters[].enemyIds` (with `isBoss`), plus `name` and `battleBackgrounds`. Only `overworld` (zones
  `east_pocket`, `temple_approach`) and `temple-of-fiends` (Garland scripted) have any. Only goblin, gr_imp, wolf,
  gr_wolf, skeleton and garland are placed; pirate, ogre, troll, mummy, cockatrice, vampire, dragon and lich are in no
  map yet; the bestiary says so ("Not placed yet"), which is useful while building.
- **Art.** `assets/sprites/monsters-ai.json`: scale 2, one sheet per sprite (palette variants `gr_imp`, `gr_wolf` have
  their own recoloured sheets; `monsterSpriteKey` picks them). Cells: 80 (small), 110x80 (wolves), 128 (large), 200
  (garland, lich). Bosses have `cast`. After Ff: `daze` / `daze_b` on every sheet, `attack_raise` and its in-betweens
  on garland and lich.
- **Runtime to reuse.**
  - `AiEnemyView` (`src/scenes/battle/AiEnemyView.ts`) builds the sprite, lays it out with `computeEnemyLayoutAi`,
    takes an injectable `MonsterArtSource`, and owns an `EnemyPoseController` (`playAttack`, `playHurt`, `playCast`,
    `reset`, `isAttacking`, `debug(i).mode`, `attackTiming(i)`).
  - After Fc, `AiEnemyView.playAttack(i, target)` measures the melee travel to `target` (new `enemyReach.ts`), plays
    `MELEE_ATTACK` or `HEAVY_ATTACK` (garland, lich) by the enemy's data, and keeps ranged enemies in place.
  - After Fe, the third argument of `AiEnemyView.update` carries a posture (`'daze'` and so on) instead of `Freeze`.
  - `enemyAnimPreview.ts` already loops attack / pause / hurt / pause / cast for `?enemyAnim=loop`, but on fixed
    travel-0 lengths (`ATTACK_FRAMES`), with a multi-enemy stagger and no daze. It is Fc's file in wave 1. The
    bestiary uses its own small event-driven driver (section 4) and does not edit it.
- **UI.** `Menu` scrolls (`maxVisible`, up/down indicators) and auto-repeats held up/down (`REPEAT_DELAY_FRAMES` 20,
  `REPEAT_EVERY_FRAMES` 5). `InputManager` maps arrows, Z/Enter/Space (confirm), X/Escape (cancel), Shift (select); no
  page keys. `HelpWindow` sits at `HELP_RECT` (y 900). The field menu opens with X (`ExplorationScene.ts:353-355`).
- **Backgrounds.** Staged 1920x1080 images are drawn in battle at scale `max(1920/w, 1080/h)` from (0, 0)
  (`BattleScene.ts:94-100`); they cover the screen only from y 120 (`BattleBackground.ts:9-14`).

---

## 2. Decisions (recommended defaults; the orchestrator proceeds on them unless told otherwise)

1. **BS-1, where it opens ("from the overview").** **Default:** a **Bestiary** row in the field menu
   (`FieldMenuScene.ts` `COMMANDS`), placed after **Order** so **Load stays the last row** (the existing wrap test,
   `FieldMenuScene.test.ts` "wraps to the last item", keeps passing). It is in every build. **Plus**, in dev builds
   only, a **Bestiary** item on the title menu under Debug, so the user can browse while building without a party.
   `?bestiary=<id>` (dev only) opens on that entry, for browser checks.
   - Why: "the overview" is the field menu (party, gold, time, commands); it is the in-game place to look things up.
     The title item serves "as I build the game" (no save needed).
   - Alternatives: (b) inside Fg's debug sandbox (dev only; hides it from play); (c) field menu only.
2. **BS-2, which enemies.** **Default:** every enemy in `enemies.yaml` (`bestiary.yaml` `mode: all`), in data order.
   - The model already supports `mode: seen`: unseen entries list as "???", hide their stats and show no sprite.
   - "Seen" is recorded **now** as a game flag `SEEN:<enemyId>` in `BattleTrigger.triggerBattle` after the enemy data
     loads (2 lines). Flags are already saved and loaded (`SaveManager.ts:34-46, 85`), so there is no save-format
     change, and saves played from now on already carry the history when the mode is flipped.
   - Alternative: defer the recording until the mode is wanted (then earlier play leaves nothing seen).
3. **BS-3, layout.** **Default:** the preview on the **left**, the list and stats on the right (section 3.1). The
   monsters face right, as in battle, so the party side is to their right, and the attack travels toward the stats.
   - Alternative: preview on the right (the monster would face the screen edge and travel out of the panel).
4. **BS-4, animation loop.** **Default:** attack, hurt, cast (sheet has `cast`, or the enemy has spells), daze (sheet
   has real daze frames), each after a **60-frame idle break**; the first one 30 frames after the entry is shown;
   daze is held 144 frames (three 48-frame sways). The order and frames are in `bestiary.yaml`.
   - The attack plays the enemy's **real** choreography: melee travels toward a **phantom target** placed inside the
     panel (so it hops, strikes and returns without leaving it), heavy plays the raised hold, ranged stays in place.
   - Hit and spell **effects are not drawn** in v1 (no `ActionFx` outside battle; the glint, shake, impact dust and
     the dragon's breath are skipped; the red heavy-attack tint comes with Fc's runtime). Follow-up BS-F1.
5. **BS-5, stats shown.** **Default:** everything in section 3.3, including derived numbers (damage range per hit,
   status hit chance, boss tag) and the habitat from the map YAML. Element and status immunities list "None" until
   data has them; nothing is invented.
6. **BS-6, input.** **Default:** up/down move (auto-repeat), left/right page by one list screen, Z plays the next
   animation now, Shift pauses or resumes the loop, X closes. The left/right page jump is the only way to page because
   `InputManager` has no page keys; adding keys is out of scope.
   - Alternative: left/right switch the animation and paging is dropped (fine at 14 enemies, poor at FF1's 128).
7. **BS-7, order.** **Default:** start after wave 1 merges, in parallel with Fe; merge **after Fe**, with a short
   integration task that switches the daze step to Fe's posture API (section 6).
   - Alternative: start after Fe merges (wave 3). Simpler, about a day later.

---

## 3. Design

### 3.1 Layout (1920x1080)

| Region | Rect (x, y, w, h) | Contents |
|---|---|---|
| Title bar | 24, 24, 1008, 84 | "BESTIARY", the entry number and name ("013 Garland"), "Boss" tag |
| Preview | 24, 120, 1008, 756 | the battle background and the enemy, masked to the window's inner rect; a caption row at the bottom ("Attack (heavy)", "Paused") |
| List | 1056, 24, 840, 264 | `Menu` with `maxVisible` 6: "001 Goblin", ...; the window title shows "14/14" (seen / total in `seen` mode) |
| Stats | 1056, 300, 840, 576 | up to 17 lines in two columns (section 3.3) |
| Help | `HELP_RECT` (24, 900, 1872, 156) | the controls line from `bestiary.yaml` |

- **Preview geometry is the battle's.** The background sprite is placed exactly as `BattleScene` places it (from
  (0, 0), scale `max(1920/w, 1080/h)`), and the enemy is laid out by `AiEnemyView.build()` with
  `computeEnemyLayoutAi` for one enemy, so it stands where a lone enemy stands in battle: centre x 710, feet at y 553
  (small) to 673 (garland, lich), at its battle scale (160 to 400 px). The panel shows the left part of the battle
  stage, which is where enemies stand. It starts at y 120 because the staged backgrounds only cover the screen from
  there (`STAGE_COVERED_TOP`).
- A boss's top (garland: about y 273) and the raised hold stay inside the panel; the heavy attack's small hop (3 px)
  too.
- The stage container is masked to the preview's inner rect, so nothing draws over the windows even if a sheet's cell
  is wider than its opaque pixels.

### 3.2 Background per entry

Precedence: `bestiary.yaml` `backgrounds.enemies.<id>`, else the first habitat's background (the zone's
`battleBackgrounds.zones.<zone>.default` or the map's `battleBackgrounds.default`), else `backgrounds.default`
(`grassland`). The path comes from `battleBackgroundPath(id)`. A failed load logs `console.warn` and keeps the solid
fill. Initial overrides: `garland: temple`, `lich: shoreline`, `vampire: abandoned_castle`, `dragon: desert`,
`pirate: shoreline`, `cockatrice: forest` (only ids under `assets/backgrounds/`, checked by a test).

### 3.3 Stats panel (model output, ASCII only; the NES font has no other glyphs)

```
GARLAND                         Boss  Large  Melee (heavy)
HP          400                 Attack      9 (9-18 x2)
Defense     10                  Mag.Def     15
Strength    15                  Agility     8
Intellect   1                   Vitality    10
Luck        5                   Accuracy    15
Evade       12                  Family      -
XP          130                 Gold        250
Weak        None                Resist      None
Immune      None                Absorb      None
Status hit  79%  (spell accuracy 24)
Actions     Fight x2
Spells      None
At 50% HP   Fight x3: "Garland's attacks grow fiercer!"
Habitat     Temple of Fiends (boss)
```

- **Attack:** `A (A-2A xH)`: FF1 rolls each hit in [A, 2A] (`DamageFormula.ts`), H = `hits` (default 1).
- **Elements:** the union of the legacy `weakness` / `resist` and `elementalProfile` lists, deduplicated, in the order
  of `bestiary.yaml` `elements`. An element with no label shows its id and warns once.
- **Status hit:** `clamp((148 + 24 - magicDefense) / 200, 0, 1)` as a whole percent. `DamageFormula.ts` gains one
  exported helper `statusChance(accuracy, magicDefense)` used by both `statusHits` and the bestiary (no constant is
  duplicated). Goblin 78 %, garland 79 %, lich 76 %.
- **Actions:** "Fight xH". Spells: the names from `spells.yaml` of a future `spells` / `ai` list, else "None".
- **Boss phases:** one line each, `At P% HP`, the new hits / attack, and the message.
- **Boss tag:** `bossPhases` present, or `size: boss`, or a scripted encounter with `isBoss: true` names it.
- **Habitat:** per scanned map: the map `name`, plus zone labels in brackets and "(boss)" for scripted boss fights;
  "Not placed yet" when no map has it. Wrapped to the column width with `wrapText`.
- In `seen` mode an unseen entry shows "???" for the name and "-" for every value.

### 3.4 Data: `assets/data/bestiary.yaml` (new)

```yaml
mode: all                    # all | seen
order: data                  # data (enemies.yaml order); hook for name | level later
listRows: 6
habitats:
  maps: [overworld, temple-of-fiends]     # maps scanned for encounters (test: every map with encounters is listed)
  zones: {east_pocket: East pocket, temple_approach: Temple approach}
  boss: boss
  none: Not placed yet
backgrounds:
  default: grassland
  enemies: {garland: temple, lich: shoreline, vampire: abandoned_castle, dragon: desert, pirate: shoreline, cockatrice: forest}
anim:
  order: [attack, hurt, cast, daze]
  firstBreak: 30
  idleBreak: 60
  dazeHold: 144
labels:
  title: BESTIARY
  boss: Boss
  hp: HP
  # ... every label of section 3.3, the size and attack-type words, "None", "Paused", "???"
  anim: {attack: Attack, heavy: Attack (heavy), ranged: Attack (ranged), hurt: Hurt, cast: Cast, daze: Dazed}
elements: {fire: Fire, ice: Ice, lightning: Bolt, earth: Earth, holy: Holy, dark: Dark, water: Water, wind: Wind}
families: {were: Were, undead: Undead, giant: Giant, magical: Magical, dragon: Dragon}
help: "Up/Down: scroll   Left/Right: page   Z: next move   Shift: pause   X: close"
```

- Typed in `src/types/bestiaryData.ts`; loaded by `DataLoader.loadBestiary(path)` (+4 lines) with a validator in a new
  `src/core/bestiaryValidation.ts` (unknown keys and bad values log `console.error` and fall back to defaults; a
  missing file logs and the scene shows "No bestiary data" and closes on X).
- The quoting rules of the YAML Gotchas table apply (e.g. any label that is `no` / `yes`).

### 3.5 Modules (new, all in `src/scenes/bestiary/` unless noted; line budgets)

| File | Lines | Role |
|---|---|---|
| `bestiaryModel.ts` | < 200 | pure: `buildEntries(enemies, data, habitats, isSeen)`, `statLines(entry, data)`, `elementSummary(enemy)`, `bossTag`, `seenFlag(id)` = `SEEN:<id>` |
| `bestiaryHabitats.ts` | < 100 | pure: `habitatsOf(maps: MapData[], labels)` → `Map<enemyId, { map, zone?, boss }[]>`, and `backgroundFor(enemyId, ...)` |
| `bestiaryAnim.ts` | < 150 | pure loop driver (section 4) over a minimal pose interface |
| `BestiaryPreview.ts` | < 200 | PixiJS: background, mask, one `AiEnemyView`, the phantom target, the caption; a per-scene frames cache |
| `BestiaryStatsPanel.ts` | < 120 | PixiJS: the stats `Window` and its two text columns |
| `BestiaryScene.ts` | < 220 | the scene: windows, `Menu`, input, selection debounce, data loading |
| `src/types/bestiaryData.ts` | < 60 | types |
| `src/core/bestiaryValidation.ts` | < 120 | validator |

**Edits elsewhere (small, each after its owner merges; section 6):** `src/main.ts` (+4: `registerLazy('bestiary')`),
`src/core/DataLoader.ts` (+4), `src/battle/DamageFormula.ts` (`statusChance`, +4), `src/systems/MapLoader.ts`
(export `resolveMapPath(dataLoader, mapId, preferCompiled)` and delegate `mapPath` to it, about +6 / -3, so the
bestiary picks the same compiled or legacy map file as the field), `src/scenes/FieldMenuScene.ts` (+2: the row and
its case; the help string sits with the other rows' help strings in `COMMANDS`, as today), `src/scenes/TitleScene.ts`
(+3, dev only), `src/systems/BattleTrigger.ts` (+2, seen flags).

**Read only (never edited):** `AiEnemyView.ts`, `EnemyPoseController.ts`, `enemyChoreography.ts`, `enemyReach.ts`,
`BattleArt.ts`, `EnemyLayoutAi.ts`, `enemyAnimPreview.ts`, `battleDevClock.ts`, `BattleBackground.ts`, every other
battle file.

### 3.6 Preview details

- **Build per entry:** `new AiEnemyView([enemy], cachedArt)`, then `build()`; the returned sprite goes into the
  masked stage. `cachedArt` wraps `battleArt` and caches `MonsterFrames` per sprite key for the scene's life (so
  scrolling does not create textures again); the cache is dropped on `exit()`. `battleArt.load()` is awaited in
  `enter()` (it is idempotent and already preloaded from the field; the title path loads it here).
- **Selection debounce:** the preview and background rebuild when the highlighted entry has been stable for 8 frames,
  so a held key scrolls without building every entry on the way. The stats panel updates at once (text only). The
  old view's sprite is removed and destroyed (not its shared textures).
- **Phantom target:** an invisible zero-alpha `Graphics` rect, 48 x 160, feet on the enemy's feet line, its left edge
  at `innerRight - ENEMY_REACH_OVERLAP - lungePx - 16`. `playAttack(0, phantom)` lets Fc's `enemyReach` measure a
  travel that ends inside the panel; rise is 0 because the feet match. If Fc's merged API cannot take a non-party
  target, the bestiary passes `null` (travel 0, the in-place strike) and records it (risk R1).
- **Postures:** the `update(dt, sprites, postures)` third argument is `['none']`, or `['daze']` during the daze step
  (Fe's API; before Fe it is the `Freeze` value `'still'`, which holds the idle; see BS-7).
- **Real daze frames:** the driver includes daze only when `frames.textures.daze !== frames.textures.hurt_in1`.
  `BattleArt` caches textures by rect, so a sheet without `daze`, or with a `daze` hold aliased to `hurt_in1`, gives
  the same object and is skipped. No `BattleArt` edit.
- **Placeholder:** an enemy without art gets `AiEnemyView`'s coloured box and the caption "No art yet"; the loop
  still runs (the box lunges and recoils).
- **Dev clock:** `createBattleDevClock()` is reused read-only, so `&slow=N` and `&battleStep=1` also slow or step the
  bestiary (screenshots of exact frames).

---

## 4. Animation loop (`bestiaryAnim.ts`, pure)

The driver never assumes animation lengths. It starts a step, waits until the pose controller reports idle again,
then counts the idle break. So Fc's travel-dependent lengths (47 + N, N + 69 for heavy) and Fb's pacing need no
numbers here.

| Step | Starts with | Ends when | Then |
|---|---|---|---|
| first break | entry shown | 30 frames (`firstBreak`) | attack |
| attack | `view.playAttack(0, phantom)` | `!poses.isAttacking(0)` | 60-frame break |
| hurt | `poses.playHurt(0)` | `poses.debug(0).mode === 'idle'` | 60-frame break |
| cast (if `hasCast` or spells) | `poses.playCast(0)` | `!poses.isAttacking(0)` | 60-frame break |
| daze (if real daze frames) | posture `daze` | 144 frames (`dazeHold`) | posture `none`, 60-frame break |
| loop | back to attack | | |

- `steps(caps)` builds the list from `anim.order` and the capabilities `{ hasCast, hasDaze, hasSpells }`; unknown step
  names log once and are skipped.
- **Z (`next()`):** ends the current break or daze at once and starts the next step; during an attack, hurt or cast it
  is queued and starts on the first idle frame (an attack is never cut, as in battle).
- **Shift (`togglePause()`):** no new step starts while paused; the idle breathing continues; the caption shows
  "Paused".
- `currentLabel()` gives the caption: `attack` maps to `heavy` / `ranged` / `attack` by `attackAnim` and `attack`.
- The poses interface is the subset `{ playHurt, playCast, isAttacking, debug }` plus an `attack()` callback, so the
  tests can drive it with the real `EnemyPoseController` (no PixiJS) or a fake.

---

## 5. Input

| Key | Action |
|---|---|
| Up / Down | move one entry; held, auto-repeats (`Menu`); a fresh press wraps at the ends, a held repeat stops there (as `Menu`) |
| Left / Right | page up / down by `listRows` (clamped, no wrap); handled by the scene with `Menu.setIndex` before `Menu.update` |
| Z (confirm) | next animation now |
| Shift (select) | pause / resume the loop |
| X (cancel) | close (`scenes.pop()`): back to the field menu or the title |

---

## 6. Ownership and order

| When | What | Files |
|---|---|---|
| after wave 1 merges (Fa, Fb, Fg, Fc, Fd, Ff) | Fh core, in a worktree, parallel with Fe | every new file of 3.5; `bestiary.yaml`; `main.ts`; `DataLoader.ts`; `DamageFormula.ts`; `MapLoader.ts`; `FieldMenuScene.ts` (free after Fb); `TitleScene.ts`, `BattleTrigger.ts` (free after Fg); tests of section 7 |
| after Fe merges | Fh integration (about 1 h) | `BestiaryPreview.ts` only: pass Fe's posture for the daze step; re-run the tests and browser checks |
| after pass F's integration and docs (its section 9) | Fh docs | `AGENTS.md` (the bestiary in the directory map, `bestiary.yaml` in the data table, the `?bestiary=` link in "Debug Menu"), `docs/PROGRESS.md` |

- **Collision check with Fe (wave 2):** Fe owns `fx/statusFx.ts`, `fx/statusIcons.ts`, `fx/stoneTextures.ts`, the
  `createStatusFx` body, `actorTint.ts`, `status-visuals.yaml`, `AiEnemyView.ts`, `enemyChoreography.ts`,
  `EnemyPoseController.ts`, `BattleDisplayManager.ts`, `BattleFieldTargeting.ts`, `assets-src/fx/glyphs.py` and
  `battle-fx.*`. Fh edits none of them.
- `debug-scenarios.yaml` is frozen after F0, so the bestiary adds **no scenario**; browser checks reach it through the
  title item and the existing field scenario `act1_overworld`.
- `tests/data/fileCeilings.test.ts` is not edited (Fe may add to it); Fh keeps its own ceiling check in
  `tests/scenes/bestiary/bestiaryCeilings.test.ts`.
- `FieldMenuScene.test.ts` and `TitleScene.test.ts` get one new case each, appended at the end, after their wave-1
  owners (Fb, Fg) merge.

---

## 7. Tests (Vitest; each fails on e356cc5)

1. **`tests/scenes/bestiary/bestiaryModel.test.ts`** (real `enemies.yaml`, `spells.yaml`, `bestiary.yaml`):
   - list order and numbering: the ids equal `enemies.yaml` order; labels "001 Goblin" ... "014 Lich";
   - goblin lines: "HP 8", "Attack 4 (4-8 x1)", "Weak Fire", "Resist None", "Status hit 78%", "Spells None",
     "Habitat World Map";
   - garland: "Boss", "Attack 9 (9-18 x2)", the phase line with "x3" and the YAML message, "Temple of Fiends (boss)";
   - elements: wolf weak Fire / resist Ice; dragon weak Ice / resist Fire; a synthetic enemy with `weakness: fire` and
     `elementalProfile.weaknesses: [fire, holy]`, `immunities: [dark]`, `absorbs: [ice]` gives Fire, Holy / Dark /
     Ice without duplicates; an unlabelled element shows its id and warns once;
   - status chance clamps: magic defence 0 gives 86 %, 200 gives 0 %;
   - defaults: a missing `accuracy`, `evade`, `hits` show 0, 0, x1;
   - `mode: seen`: an unseen entry shows "???" and "-" values; `mode: all` ignores the predicate;
   - every string the model returns is printable ASCII.
2. **`tests/scenes/bestiary/bestiaryHabitats.test.ts`** (real compiled maps via `resolveMapPath`): goblin on the World
   Map; skeleton on the World Map (Temple approach) and in the Temple of Fiends; garland "Temple of Fiends (boss)";
   vampire, dragon, lich "Not placed yet"; the background precedence of 3.2 (garland override temple; skeleton from
   its first habitat; vampire override; an unplaced enemy with no override gets the default).
3. **`tests/scenes/bestiary/bestiaryAnim.test.ts`:**
   - with the real `EnemyPoseController` (goblin config, travel 0): two cycles record attack, then exactly 60 idle
     frames, hurt, 60 idle frames, attack; the attack lasts `attackTiming(0).totalFrames`;
   - garland caps (`hasCast`, `hasDaze`): attack, hurt, cast, daze (144 frames with posture `daze`), then attack;
   - goblin without real daze frames: no daze step;
   - Z during a break starts the next step on the same frame; Z during an attack starts it on the first idle frame,
     and the attack is not cut;
   - Shift pauses: no step starts in 300 frames; Shift again resumes;
   - a new entry restarts with the 30-frame first break.
4. **`tests/scenes/bestiary/BestiaryScene.test.ts`** (mock game with `tapInput` / `visibleLabels` from
   `tests/helpers/realData.ts`, an injected fake `MonsterArtSource` and background loader, so no fetch):
   - `enter()` shows "001 Goblin" and the goblin's stats; Down shows "002 Gr.Imp" at once and rebuilds the preview
     after 8 stable frames;
   - Right moves 6 entries, Right at the end stays on the last; Left back;
   - a held Down auto-repeats (the cursor moves again after 20 frames, then every 5);
   - X calls `scenes.pop()` once;
   - Z starts the attack (`poses.debug(0).mode === 'attack'`);
   - **never off-panel:** for a fake 80-cell goblin and a fake 200-cell garland, on every frame of their attack the
     sprite's opaque span stays inside the preview's inner rect;
   - scrolling all 14 entries twice leaves the stage with one enemy sprite and the scene's child count unchanged;
   - a missing sheet shows the placeholder box and the caption "No art yet", with no error.
5. **`tests/data/bestiaryData.test.ts`:** every `backgrounds` id has `assets/backgrounds/<id>.webp`; every
   `backgrounds.enemies` key is an enemy id; every element and family used in `enemies.yaml` has a label; every zone
   label key is an `encounterZones` id of a scanned map; every compiled map in `assets/maps/ai/index.yaml` whose YAML has a non-empty `encounters`,
   `encounterZones` or `scriptedEncounters` is in `habitats.maps` (so a new dungeon cannot be forgotten); `anim.order`
   names only known steps; every label is ASCII.
6. **`tests/scenes/FieldMenuScene.test.ts`** (one case): the Bestiary row pushes `'bestiary'`; Load is still the last
   row.
7. **`tests/scenes/TitleScene.test.ts`** (one case, dev): the Bestiary item pushes `'bestiary'`.
8. **`tests/systems/bestiarySeen.test.ts`:** `triggerBattle(['goblin', 'wolf'])` sets `SEEN:goblin` and `SEEN:wolf`;
   the flags survive `SaveManager` save and load.
9. **`tests/core/bestiaryValidation.test.ts`:** a bad `mode`, a negative `idleBreak` and an unknown step log
   `console.error` and fall back to the defaults.
10. **`tests/scenes/bestiary/bestiaryCeilings.test.ts`:** every new file under 250 lines (and the budgets of 3.5 as
    soft notes in the header).
- **Asset coverage:** `tests/data/assetCoverage.test.ts` already fails for an enemy without a sheet, so the bestiary
  adds no art check; test 4 covers the placeholder path.

---

## 8. Browser checks (dev server; `?mute=1` always; 0 console errors; close the page and stop the server after)

1. `http://127.0.0.1:5173/?mute=1`, title, **Bestiary**: the list opens on 001 Goblin; screenshot idle; wait for the
   attack and screenshot near contact (or `&slow=4`); hold Down: the list scrolls with auto-repeat; Right / Left page.
2. `?mute=1&bestiary=garland`, title, Bestiary: the raise and hold read (with Ff's art, or the coil fallback), the slam
   and return stay inside the panel; then cast; then daze (after Fe). Screenshots at each.
3. `?mute=1&bestiary=dragon`: the attack stays in place (ranged); the background is the desert.
4. `?mute=1&bestiary=gr_wolf`: the recoloured sheet, not the wolf's colours.
5. `?mute=1&scenario=act1_overworld`, Debug, then X for the field menu, then **Bestiary**: it opens over the field;
   X returns to the field menu, X again to the field, and no encounter started meanwhile.
6. `?mute=1&bestiary=garland&battleStep=1`: `.` steps the preview one frame at a time.
7. Leak check (`browser_evaluate` on `__game`): scroll all entries 5 times; the bestiary container's descendant count
   is the same before and after.

---

## 9. Validation commands

```bash
npx tsc --noEmit
npm run build
npm test
npx vitest run tests/scenes/bestiary tests/data/bestiaryData.test.ts tests/scenes/FieldMenuScene.test.ts \
  tests/scenes/TitleScene.test.ts tests/systems/bestiarySeen.test.ts tests/core/bestiaryValidation.test.ts
wc -l src/scenes/bestiary/*.ts src/types/bestiaryData.ts src/core/bestiaryValidation.ts      # each < 250
git diff --stat e356cc5 -- src/scenes/battle src/rendering/BattleArt.ts                       # empty (read only)
git diff --numstat -- src/scenes/FieldMenuScene.ts src/scenes/TitleScene.ts                   # <= 4 added lines each
```

---

## 10. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Fc's `playAttack(i, target)` / `enemyReach` only accepts real party sprites (e.g. reads `PARTY_X`), so the phantom target is not honoured | read the merged `enemyReach.ts` first; feed it the phantom's bounds as it expects; else pass `null` (in-place strike) and note it in the commit. Never edit Fc's files |
| R2 | Fe's posture API differs from the plan's (`update(dt, sprites, postures)`) | the daze step is isolated in `BestiaryPreview.ts`; the integration task after Fe adapts it; until then daze holds the still idle |
| R3 | Texture or sprite churn while scrolling | the per-scene frames cache, the 8-frame debounce, the destroy on replace; test 4 and browser check 7 |
| R4 | The heavy attack or a travelling sprite crosses the panel border | the phantom formula keeps the contact inside; the mask clips anything else; test 4 checks every frame |
| R5 | The staged background's band above y 120 is a flat fill | the preview starts at y 120 |
| R6 | Stats text overflows the 840 px window as data grows (long phase messages, many habitats) | `wrapText` per column; the panel has 17 lines for 15 used; a test with the longest real entry (garland) checks the line count |
| R7 | Labels drift from data (a new family, element or dungeon) | test 5 fails on any unlabelled family, element or zone and on any map with encounters that is not scanned |
| R8 | The field menu row moves the wrap target | the row goes before Save / Load; test 6 checks Load is last |
| R9 | `Assets.load` of a background fails | `console.warn` and the solid fill stay; the loop runs |
| R10 | Concurrent tranches touch `main.ts` / `DataLoader.ts` | both are free after wave 1 (F0 owned them); Fe does not list them; the edits are additive lines |

---

## 11. Follow-ups (not in this tranche)

- **BS-F1:** effects in the preview (the dragon's breath, the heavy glint, shake and impact dust) through Fd's
  `createActionFx`, once it can run on a bare layer stack.
- **BS-F2:** status overlays in the preview (an optional "status" step that applies sleep, poison, ... through Fe's
  `createStatusFx`).
- **BS-F3:** enemy spells and AI patterns in `enemies.yaml` (the model already lists them when present).
- **BS-F4:** `order: name | level` and a filter by habitat.

---

## 12. TODOs

- [ ] Fh-1: `bestiary.yaml`, `bestiaryData.ts` types, `bestiaryValidation.ts`, `DataLoader.loadBestiary`; tests 5 and 9 (priority: high, effort: 1.5h)
- [ ] Fh-2: `bestiaryModel.ts` (stat lines, elements, status chance via the new `DamageFormula.statusChance`, boss tag, seen mode); test 1 (priority: high, effort: 2h)
- [ ] Fh-3: `MapLoader.resolveMapPath`, `bestiaryHabitats.ts` (habitats, background precedence); test 2 (priority: medium, effort: 1.5h)
- [ ] Fh-4: `bestiaryAnim.ts` loop driver; test 3 (priority: high, effort: 1.5h)
- [ ] Fh-5: `BestiaryPreview.ts` (background, mask, cached `AiEnemyView`, phantom target, caption, debounce) and `BestiaryStatsPanel.ts` (priority: high, effort: 3h)
- [ ] Fh-6: `BestiaryScene.ts` (layout, `Menu`, paging, Z, Shift, X, `?bestiary=`); `main.ts` registration; test 4 and the ceilings test (priority: high, effort: 2.5h)
- [ ] Fh-7: field menu row and title dev item; seen flags in `BattleTrigger`; tests 6, 7, 8 (priority: medium, effort: 1h)
- [ ] Fh-8: build, full suite, browser checks 1-7 with screenshots, 0 console errors (priority: high, effort: 1.5h)
- [ ] Fh-9 (after Fe merges): daze step on Fe's posture API; re-run tests and browser check 2 (priority: medium, effort: 1h)
- [ ] Fh-10 (after pass F docs): `AGENTS.md` and `docs/PROGRESS.md` entries (priority: low, effort: 0.5h)
