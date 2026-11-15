# Bestiary plan (tranche Fh), 2026-11-14

**Status:** plan only, nothing implemented. Momus review (REVISE, 21 items) folded into the body. **Base:** the
references below were checked at `75ed000` on `feedback` (F0, Fa, Fb, Fc and Fg merged; `SceneManager.switchTo` re-shows
hidden scenes). When the Fh worktree is cut, record **`FH_BASE=$(git rev-parse HEAD)`** and re-check every file:line
reference at that commit before coding; all diff commands below are relative to `$FH_BASE`.

**Order:** Fh starts after wave 1 of `docs/FEEDBACK_PLAN_2026-11-14.md` has merged (Fa, Fb, Fg, Fc, Fd, Ff). It can run
in parallel with Fe (wave 2), because the two share no file, and it **merges after Fe** (decision BS-7).

**User request (verbatim intent):** "There should be a bestiary from the overview where I can explore the enemies. It
should allow me to scroll through every enemy and see their stats (HP, spells, XP, gold), immunities, weaknesses, etc.
While the enemy stats are displayed the enemy should be displayed to the side in profile, idle pose, looping through
different animations (attack, hurt, casting, etc.) with reasonable short breaks in between. That will be a fun way to
explore the monsters as I build the game."

**Rules (AGENTS.md, as pass F):**
- Data and text in YAML (new `assets/data/bestiary.yaml`). Stats are read from `enemies.yaml`, never copied.
- No `as any`, no `@ts-ignore`, no silent `catch`. Every failed load (YAML, map, background, art) is logged.
- New source files under 250 lines. The scene is registered with `registerLazy` and opened with push / pop.
- Reuse `Window`, `Menu` (scrolling, auto-repeat, its existing up/down indicators), `HelpWindow`, `AiEnemyView`,
  `EnemyPoseController`, `BattleArt`, `computeEnemyLayoutAi`, `createBattleDevClock` and `battleBackgroundPath`.
  **Nothing under `src/scenes/battle/` or `src/rendering/` is edited.**
- 2x art only. Missing art shows the existing placeholder box and its one console warning.
- Browser checks: start the server with `npx vite --host 127.0.0.1`, use `http://127.0.0.1:5173/?mute=1&...` and never
  leave out `mute=1`. 0 console errors. Close the page and stop the server afterwards.

---

## 0. Success criteria (defined before implementation)

```json
{
  "functional": [
    "The field menu has a Bestiary row (Items, Magic, Equip, Status, Order, Bestiary, Save, Load, Config) in every build; X in the bestiary returns to the field menu",
    "In dev builds only, the title menu has a Bestiary item, and ?bestiary=<id> opens the bestiary directly on that entry; production has neither",
    "The list shows every enemy in enemies.yaml, in data order, numbered 001, 002, ...; up/down scroll with auto-repeat, left/right page by one list screen",
    "For the highlighted enemy the stats panel shows HP, Attack, hits, damage per hit before armour, Defense, Magic Defense, Strength, Agility, Intellect, Vitality, Luck, Accuracy, Evade, XP, Gold, elemental weaknesses, resistances, immunities and absorbs, family, size, attack type, actions and spells, boss phases, a boss tag and the habitat",
    "Beside the stats the enemy stands in profile on a battle background, facing the party side, at its battle size and feet position",
    "It loops: first break, attack (its real melee, heavy or ranged choreography, never leaving the panel), idle break, hurt, idle break, cast (bosses), idle break, daze (sheets with real daze frames), then again",
    "Z plays the next animation at once; Shift pauses and resumes the loop",
    "Every label, element name, family name, zone name, template and help text comes from bestiary.yaml",
    "bestiary.yaml has mode: all | seen (default all); every battle, including debug and sandbox battles, records its enemies as seen game flags"
  ],
  "observable": [
    "Screenshots: goblin idle, goblin attack contact, wolf hurt, garland raised hold (heavy), garland cast, dragon attack (ranged, in place), gr_wolf (palette variant)",
    "The idle break is 60 frames (1 s) of the bestiary's own clock, whatever the battle message speed",
    "Scrolling all 14 entries with a held key changes the preview with no console error and no growth in the bestiary container's descendant count"
  ],
  "pass_fail": [
    "npm run build and npm test pass; after the build, grep -l bestiary dist/assets/*.js is non-empty (the scene ships in production)",
    "Every new test fails on $FH_BASE (its file, row or helper does not exist there)",
    "git diff $FH_BASE -- src/scenes/battle src/rendering is empty",
    "Every new source file is under 250 lines; FieldMenuScene.ts grows by 4 lines and TitleScene.ts by at most 10",
    "Browser checks of section 8 show 0 console errors"
  ]
}
```

---

## 1. What exists (checked at 75ed000)

- **Data.** `assets/data/enemies.yaml` has 14 enemies: goblin, gr_imp, wolf, gr_wolf, skeleton, pirate, ogre, troll,
  mummy, cockatrice, vampire, dragon, garland, lich. `EnemyData` (`src/types/index.ts:88-109`) has `stats` (HP, the
  five FF1 attributes, attack, defense, magicDefense, optional accuracy, evade, hits, crit), `xpReward`, `goldReward`,
  `sprite`, `weakness?`, `resist?`, `elementalProfile?` (weaknesses, resistances, immunities, absorbs; no enemy uses it
  yet), `bossPhases?`, `family?`, `size?`, and pass F's `attack`, `attackEffect`, `attackAnim`.
- **No enemy has spells or an AI pattern in data.** Production enemies only Fight (`BasicAI`). `bossPhases` change
  `hits` / `attack` and say a message; their `patternId: aggressive` names no pattern (`ActionResolution.ts:73-76`
  warns). Spell-casting enemies exist only in debug data (`enemyAi`). So "Spells" shows "None" today; a future
  `spells` / `ai` field shows up without a UI change (3.3).
- **No status immunities in data.** Status spells roll `(148 + accuracy - magicDefense) / 200` for every target
  (`SpellStatus.ts:32-36`, `DamageFormula.ts:8, 89-93`). The bestiary shows that chance for the default spell
  accuracy (`DEFAULT_SPELL_ACCURACY` = 24). A status-immunity row appears only once data has such a field (BS-5).
- **Habitats.** Encounter tables are in the map YAML: `encounters[].groups[].id`, `encounterZones[].encounters`,
  `scriptedEncounters[].enemyIds` (with `isBoss`), and in old-style tables `enemies[]`; plus `name` and
  `battleBackgrounds`. In the compiled maps only `overworld` (zones `east_pocket`, `temple_approach`) and
  `temple-of-fiends` (Garland scripted three times, by flag) have any. Placed: goblin, gr_imp, wolf, gr_wolf, skeleton,
  garland. Not placed: pirate, ogre, troll, mummy, cockatrice, vampire, dragon, lich ("Not placed yet").
- **Art.** `assets/sprites/monsters-ai.json`: scale 2, one sheet per sprite; the palette variants `gr_imp` and `gr_wolf`
  have their own recoloured sheets (`monsterSpriteKey` picks them). Cells 80 (small), 110x80 (wolves), 128 (large), 200
  (garland, lich); `lungePx` 24-40. The atlas has no `opaqueRight` yet; `BattleArt` measures it from the idle frame
  (`BattleArt.ts:111`). After Ff: `daze` / `daze_b` on every sheet, `attack_raise` and its in-betweens on garland and
  lich.
- **Runtime to reuse (Fc merged).**
  - `AiEnemyView.playAttack(i, target)` (`AiEnemyView.ts:60-76`) measures the travel with `enemyReach`: it takes
    `target.getBounds()` minus `target.parent.worldTransform` (tx, ty) as the target's box, and the enemy's home
    `opaqueRight` (`b.x + opaqueRight * scale`), feet and lunge `L = lungePx * scaleFactor`. Ranged enemies,
    placeholders and a null target get travel 0. It plays the melee or heavy table by the enemy's data.
  - `enemyReach` (`enemyReach.ts`): `travel = clamp(targetLeft + 24 - opaqueRight - 0.75 L, 0, 1500)`; rise is the
    feet difference when travel > 0.
  - `EnemyPoseController`: `playHurt`, `playCast`, `isAttacking`, `debug(i).mode`, `attackTiming(i)`; `AiEnemyView`
    exposes it as `readonly poses`.
  - After Fe, the third argument of `AiEnemyView.update` carries a posture (`'daze'` and so on) instead of `Freeze`.
  - `enemyAnimPreview.ts` loops attack / pause / hurt / pause / cast for `?enemyAnim=loop` with a multi-enemy stagger
    and no daze. The bestiary uses its own small event-driven driver (section 4) and does not edit it.
- **UI.** `Menu` scrolls (`maxVisible`, ▲ / ▼ indicators at its own fixed spots, accepted as they are) and auto-repeats
  held up/down (`REPEAT_DELAY_FRAMES` 20, `REPEAT_EVERY_FRAMES` 5; it reads `isPressed`). `InputManager` maps arrows,
  Z/Enter/Space (confirm), X/Escape (cancel), Shift (select); no page keys. `HelpWindow` sits at `HELP_RECT` (y 900).
  The field menu opens with X (`ExplorationScene.ts:353-354`) and lists Items ... Order, Save, Load, Config
  (`FieldMenuScene.ts:20-29`). The title menu window is a fixed 400 x 200 (`TitleScene.ts:55`) with 48 px rows.
- **Backgrounds.** Staged 1920x1080 images are drawn in battle from (0, 0) at scale `max(1920/w, 1080/h)`
  (`BattleScene.ts:97-99`) through Pixi's `Assets` cache; they cover the screen only from y 120
  (`BattleBackground.ts:14`).
- **Seen flags.** `GameFlags` are saved and loaded (`SaveManager.ts:34, 46, 85`). Every battle, including the debug
  loader's and the sandbox's (`DebugScenarioLoader.ts:89`, `sandboxBattle.ts:60`), goes through
  `BattleTrigger.triggerBattle(enemyIds, bossConfig, background, enemyAi, enemyStatus, options = { onEnd })`
  (`BattleTrigger.ts:65-76`), which loads the enemy data, checks the party, then takes the retry snapshot.

---

## 2. Decisions

1. **BS-1, where it opens ("from the overview").**
   - **Field menu, every build:** a **Bestiary** row after **Order**: Items, Magic, Equip, Status, Order, **Bestiary**,
     Save, Load, Config. Config stays last and Load second to last, so the existing wrap test (Up from the first row
     lands on Config) still holds. +4 lines (the row and its 3-line case).
   - **Title menu, dev only:** a **Bestiary** item after Debug. Only the item is dev-gated
     (`...(import.meta.env.DEV ? [Debug, Bestiary] : [])`); its `onSelect` branch sits outside the DEV gate, because
     the scene is registered in every build. It uses the title's pattern:
     `Promise.resolve(this.game.scenes.push('bestiary')).catch(failed('Failed to open the bestiary:'))`. The menu
     window height becomes `items.length * 48 + 2 * WINDOW_PADDING` (144 in production, 240 in dev), instead of 200.
   - **`?bestiary=<id>`, dev only:** the title's `enter()` pushes `bestiary` once per page load (a module-level
     "already ran" flag, like `sandboxSession.ts:22`), and the bestiary opens directly on that entry. An unknown id
     logs `console.warn` and opens on 001. X returns to the title, which does not push again. The URL parsing is a pure
     `bestiaryDeepLink(search)` in `src/scenes/bestiary/bestiaryLink.ts`, so `TitleScene.ts` grows by at most 10 lines.
   - Why: "the overview" is the field menu (party, gold, time, commands), the in-game place to look things up. The
     title item serves "as I build the game" without a save.
2. **BS-2, which enemies.** Every enemy in `enemies.yaml` (`mode: all`), in data order. `mode: seen` is supported by
   the model: an unseen entry lists as "???", its row is disabled (intended: it greys out like a locked entry), its
   stats show "-" and the preview shows no sprite. "Seen" is recorded **now** as the game flag `SEEN:<enemyId>` in
   `triggerBattle`: after `loadEnemyData` and the party check, **before** `captureBattleSnapshot`, so a Retry restores
   it and every battle (field, scripted boss, debug scenario, sandbox) marks its enemies. No save-format change.
3. **BS-3, layout.** The preview is on the **left**; list and stats are on the right (3.1). Monsters face right, as in
   battle, so the party side is to their right and the attack travels toward the stats.
4. **BS-4, animation loop.** Attack, hurt, cast (the sheet has `cast`, or the enemy has spells), daze (the sheet has real
   daze frames). After each one comes a 60-frame idle break (`anim.idleBreak` in `bestiary.yaml`, **not** scaled by the
   battle message speed). The first step starts 30 frames after the entry is shown. Daze is held 144 frames.
   - The attack plays the enemy's **real** choreography toward a **phantom target** inside the panel (3.6): melee and
     heavy hop or raise, strike and return without leaving it; ranged stays in place.
   - Hit and spell **effects are not drawn** in v1. The glint, shake, impact dust and dragon breath are skipped; the
     red heavy-attack tint comes with Fc's runtime. Follow-up BS-F1.
5. **BS-5, stats shown.** Everything in 3.3, including derived numbers (damage per hit before armour, the status hit
   chance, the boss tag) and the habitat. The Immune and Absorb rows are **elemental**. Nothing is invented: there is
   no status-immunity row until data has one.
6. **BS-6, input.** Up/down move (auto-repeat), left/right page by one list screen, Z plays the next animation now,
   Shift pauses or resumes, X closes. Left/right is the page jump because `InputManager` has no page keys.
7. **BS-7, order.** Start after wave 1 merges, in parallel with Fe; merge **after Fe**, followed by a 1-hour task that
   moves the daze step onto Fe's posture API (section 6). (Alternative: start after Fe merges.)

---

## 3. Design

### 3.1 Layout (1920x1080)

| Region | Rect (x, y, w, h) | Contents |
|---|---|---|
| Title bar | 24, 24, 1008, 84 | `BESTIARY`, the entry and the count: "013 Garland  13/14" (`templates.titleCount`); the "Boss" tag |
| Preview | 24, 120, 1008, 756 | the battle background and the enemy in the masked stage; the caption ("Attack (heavy)", "Paused", "No art yet") is a separate text **outside** the stage container, drawn above it at the bottom of the window |
| List | 1056, 24, 840, 264 | `Menu`, `maxVisible` = `listRows` (6): "001 Goblin", ... |
| Stats | 1056, 300, 840, 576 | 17 lines of two 28-character columns (3.3) |
| Help | `HELP_RECT` (24, 900, 1872, 156) | `help` from `bestiary.yaml` |

- **The preview's geometry is the battle's.** The **stage container** is a direct child of the scene container at
  screen (0, 0), unscaled. The background sprite in it is placed exactly as in `BattleScene` (from (0, 0), scale
  `max(1920/w, 1080/h)`). The enemy is laid out by `AiEnemyView.build()`, i.e. `computeEnemyLayoutAi` for one enemy,
  so it stands where a lone enemy stands in battle: centre x 710, feet at y 553 (small) to 673 (garland, lich), at its
  battle scale (160-400 px).
- The stage is masked to the preview window's inner rect (inside the borders, `WINDOW_BORDER_OUTER` +
  `WINDOW_BORDER_INNER`), so nothing draws over the other windows. It starts at y 120, where the staged backgrounds
  start covering the screen.

### 3.2 Background per entry

- **Precedence:** `backgrounds.enemies.<id>` in `bestiary.yaml`; else the first habitat's background (the zone's
  `battleBackgrounds.zones.<zone>.default` when that exists, else the map's `battleBackgrounds.default`); else
  `backgrounds.default` (`grassland`). The path is `battleBackgroundPath(id)`.
- **Initial overrides** (all exist under `assets/backgrounds/`): `garland: temple`, `lich: shoreline`,
  `vampire: abandoned_castle`, `dragon: desert`, `pirate: shoreline`, `cockatrice: forest`.
- **Loading:**
  - Each request takes a new token. On resolve the texture is applied only if the token is still the current one and
    the scene has not exited, so a slow, older load never replaces a newer one or touches a destroyed sprite.
  - A failure logs `console.warn` and keeps the window's solid fill.
- **Cache policy:** textures come from `Assets.load` (the loader is injectable, 3.6) and stay in Pixi's `Assets`
  cache. The battle loads the same paths, so the bestiary never unloads them. Only the background `Sprite` is
  destroyed, without its texture.

### 3.3 Stats panel (model output, ASCII only; the NES font has no other glyphs)

17 lines. The panel has two columns of 28 characters (label 11, value 17); a full-width row wraps at 56. The name, the
boss tag and the count are in the title bar, not here:

| Line | Left column | Right column |
|---|---|---|
| 1 | `HP` | `Attack` (A) |
| 2 | `Hits` (`xH`, default x1) | `Damage` (`A-2A`; FF1 rolls each hit in [A, 2A] before the target's armour; the label is "Dmg/hit") |
| 3 | `Defense` | `Mag.Def` |
| 4 | `Strength` | `Agility` |
| 5 | `Intellect` | `Vitality` |
| 6 | `Luck` | `Accuracy` (default 0) |
| 7 | `Evade` (default 0) | `Family` |
| 8 | `Size` | `Attacks` (Melee / Melee (heavy) / Ranged) |
| 9 | `XP` | `Gold` |
| 10-11 | `Weak` (full width, wraps) | |
| 12 | `Resist` (full width, wraps) | |
| 13 | `Immune` / `Absorb` (elemental; two columns) | |
| 14 | `Status hit` (full width: "78% (spell accuracy 24)") | |
| 15 | `Actions` / `Spells` (two columns: "Fight x2", "None") | |
| 16 | `At 50% HP` (one line per boss phase: new hits / attack and the message, wrapped) | |
| 17 | `Habitat` (wrapped; overflow ends in "...") | |

- **Line budget:** lines 10-12 take 1 line each normally and up to 2 with many elements; boss phases and the habitat
  take what is left. The model never returns more than 17 lines: overflow is cut with "..." and `console.warn`. A
  synthetic enemy with 4 weaknesses, 4 resistances, 2 phases and 3 habitats fits in 17 lines (test 1).
- **Elements:** the union of the legacy `weakness` / `resist` and the `elementalProfile` lists, deduplicated, in the
  order of `bestiary.yaml` `elements`. An element with no label shows its id and warns once.
- **Status hit:** `DamageFormula.ts` gains `statusChance(accuracy, magicDefense, relation = 'normal')`, which returns
  `clamp((base + accuracy - magicDefense) / 200, 0, 1)` with the same `base` rule as today. `statusHits` uses it, so
  the constants stay in one place. The bestiary calls it with `DEFAULT_SPELL_ACCURACY` and shows
  `Math.round(100 * chance)`%: goblin 78 %, garland 79 % (78.5), lich 76 %, magic defence 0 gives 86 %, 200 gives 0 %.
- **Actions:** "Fight xH". **Spells:** the `spells.yaml` names of a future `spells` / `ai` list, else "None".
- **Boss phases:** `At P% HP`, then "Fight xH" (and "Attack A" when the phase sets `attack`) and the quoted message.
- **Boss tag** (title bar): `bossPhases` present, or `size: boss`, or a scripted encounter with `isBoss: true` names it.
- **`mode: seen`, unseen entry:** "???" in the title bar and the list, "-" for every value.

### 3.4 Data: `assets/data/bestiary.yaml` (new)

```yaml
mode: all                    # all | seen
order: data                  # data (enemies.yaml order); hook for name | level later
listRows: 6
habitats:
  maps: [overworld, temple-of-fiends]     # compiled map ids scanned (test 5: every map with encounters is listed)
  zones: {east_pocket: East pocket, temple_approach: Temple approach}
backgrounds:
  default: grassland
  enemies: {garland: temple, lich: shoreline, vampire: abandoned_castle, dragon: desert, pirate: shoreline, cockatrice: forest}
anim:
  order: [attack, hurt, cast, daze]
  firstBreak: 30
  idleBreak: 60              # frames of the bestiary clock; not scaled by the battle message speed
  dazeHold: 144
labels:
  title: BESTIARY
  boss: Boss
  hp: HP
  attack: Attack
  hits: Hits
  damage: Dmg/hit
  defense: Defense
  magicDefense: Mag.Def
  strength: Strength
  agility: Agility
  intelligence: Intellect
  vitality: Vitality
  luck: Luck
  accuracy: Accuracy
  evade: Evade
  family: Family
  size: Size
  attacks: Attacks
  xp: XP
  gold: Gold
  weak: Weak
  resist: Resist
  immune: Immune
  absorb: Absorb
  statusHit: Status hit
  actions: Actions
  spells: Spells
  habitat: Habitat
  none: None
  unknown: "???"
  blank: "-"
  paused: Paused
  noArt: No art yet
  noData: No bestiary data
  sizes: {small: Small, large: Large, boss: Boss}
  attackKinds: {melee: Melee, heavy: Melee (heavy), ranged: Ranged}
  anim: {attack: Attack, heavy: Attack (heavy), ranged: Attack (ranged), hurt: Hurt, cast: Cast, daze: Dazed}
templates:                   # {name} placeholders, filled by the model
  entry: "{num} {name}"                      # "013 Garland"; num is 3 digits
  titleCount: "{entry}  {index}/{total}"     # "013 Garland  13/14"
  damage: "{min}-{max}"
  hits: "x{hits}"
  fight: "Fight x{hits}"
  statusHit: "{pct}% (spell accuracy {acc})"
  phase: "At {pct}% HP"
  phaseHits: "Fight x{hits}"
  phaseAttack: "Attack {attack}"
  phaseMessage: '"{message}"'
  habitatMain: "{map}"                       # in the map's main table
  habitatZone: "{map} ({zones})"             # only in zones: "World Map (East pocket, Temple approach)"
  habitatBoss: "{map} (boss)"                # a scripted isBoss encounter
  notPlaced: Not placed yet
  list: ", "
elements: {fire: Fire, ice: Ice, lightning: Bolt, earth: Earth, holy: Holy, dark: Dark, water: Water, wind: Wind}
families: {were: Were, undead: Undead, giant: Giant, magical: Magical, dragon: Dragon}
help: "Up/Down: scroll   Left/Right: page   Z: next move   Shift: pause   X: close"
```

- Types in `src/types/bestiaryData.ts`. Loaded by `DataLoader.loadBestiary(path)` (+4 lines), with a validator in the
  new `src/core/bestiaryValidation.ts`. Unknown keys, bad values and a missing label or template log `console.error`
  and fall back to the built-in default for that key. A missing file logs; the scene then shows `noData` and closes
  on X.
- The YAML Gotchas table applies: `"???"`, `"-"` and every template are quoted.

### 3.5 Modules and edits

**New** (all in `src/scenes/bestiary/` unless noted; line budgets):

| File | Lines | Role |
|---|---|---|
| `bestiaryModel.ts` | < 200 | pure: `buildEntries(enemies, data, habitats, isSeen)`, `statLines(entry, data)` (≤ 17), `elementSummary(enemy)`, `bossTag`, `seenFlag(id)` = `SEEN:<id>` |
| `bestiaryHabitats.ts` | < 120 | pure: `habitatsOf(maps, data)` and `backgroundFor(enemyId, habitats, data)` (3.2, 3.7) |
| `bestiaryAnim.ts` | < 150 | pure loop driver (section 4) |
| `bestiaryLink.ts` | < 40 | `bestiaryDeepLink(search)`: the `?bestiary=` id in dev, null in production or without it |
| `BestiaryPreview.ts` | < 220 | PixiJS: stage container, mask, background (token), one `AiEnemyView`, the phantom target, the frames cache; read-only `get poses()` |
| `BestiaryStatsPanel.ts` | < 120 | PixiJS: the stats `Window` and its two text columns |
| `BestiaryScene.ts` | < 230 | the scene: windows, `Menu`, input, debounce, dev clock, data loading; `constructor(game, deps: { art?: MonsterArtSource; loadTexture?: (path: string) => Promise<Texture> } = {})` |
| `src/types/bestiaryData.ts` | < 80 | types |
| `src/core/bestiaryValidation.ts` | < 150 | validator |

**Edits** (each after its owner merges; section 6):
- `src/main.ts` (+4): `registerLazy('bestiary')`, outside the DEV block.
- `src/core/DataLoader.ts` (+4).
- `src/battle/DamageFormula.ts`: `statusChance`, with `statusHits` built on it (about +6 / -2).
- `src/systems/MapLoader.ts`: export `resolveMapPath(dataLoader, mapId, preferCompiled)` and delegate `mapPath` to it
  (about +6 / -3). The bestiary calls it with `preferCompiled = true`, the compiled maps production plays.
- `src/scenes/FieldMenuScene.ts` (+4, BS-1).
- `src/scenes/TitleScene.ts` (≤ +10: the dev item, the push branch, the window height, the deep link).
- `src/systems/BattleTrigger.ts` (+2, BS-2).

**Read only:** everything under `src/scenes/battle/` and `src/rendering/`, plus `enemyAnimPreview.ts` and the
`debugSandbox/` files.

### 3.6 Preview details

- **Build per entry:** `new AiEnemyView([enemy], cachedArt)`, then `build()`; the sprite goes into the stage
  container. `cachedArt` wraps the injected `MonsterArtSource` (default `battleArt`) and caches `MonsterFrames` per
  sprite key for the scene's life, so scrolling never slices textures twice. `enter()` awaits `battleArt.load()`
  (idempotent; already preloaded from the field, loaded here on the title path).
- **Debounce:** the preview and background rebuild once the highlighted entry has been stable for **8 frames of raw
  `dt`**; the stats panel updates at once (text only). The old sprite is destroyed with
  `destroy({ children: true, texture: false })`, keeping the cached textures.
- **Exit:** `exit()` destroys the enemy sprite, the background sprite (not its `Assets` texture) and the stage. It
  calls `t.destroy(false)` on **each unique texture** in the frames cache: these are `Texture` views made by
  `getMonsterFrames`, so `false` keeps the shared atlas source. Then it clears the cache, disposes the dev clock and
  invalidates the background token. Test 4 checks it.
- **Phantom target (R1 resolved):**
  - It is an invisible `Graphics` rect, 48 x 160, added as a **child of the stage container**. Because that container
    is a direct child of the scene container at screen (0, 0) and unscaled, `target.parent.worldTransform` is (0, 0),
    and `AiEnemyView.attackPlan` reads the phantom's bounds in the same space as the enemy's home position.
  - It is hidden with `alpha = 0` or `renderable = false`, **never `visible = false`** (invisible objects have empty
    bounds).
  - Its feet are on the enemy's feet line (`box.feetY`), so the rise is 0.
  - **Furthest reach:** at contact the enemy's opaque right edge is at `targetLeft + 24`. Two frames later the lunge
    goes from 0.75 L to L, so the furthest edge is `targetLeft + 24 + 0.25 L`, with `L = frames.lungePx` (the lone
    enemy's `scaleFactor` is 1). The phantom's left edge is therefore
    `targetLeft = innerRight - 16 - ENEMY_REACH_OVERLAP - 0.25 * frames.lungePx` (16 px margin), and the furthest
    edge is `innerRight - 16`.
  - With `innerRight` = 1032 - 18 = 1014 and garland (`lungePx` 38, home edge about 910 when its idle is measured
    full width), the travel is 976 + 24 - 910 - 28.5, about 61 px; a goblin travels about 228 px.
  - There is no null fallback: every melee attack in the bestiary is aimed at the phantom (ranged enemies stay in
    place in `attackPlan` itself).
- **Postures:** the third argument of `update(dt, sprites, postures)` is the no-posture value, or `'daze'` during the
  daze step. That is Fe's API; before Fe it is the `Freeze` value `'still'`, which holds the idle (BS-7).
- **Real daze frames:** daze is in the loop only when `frames.textures.daze !== frames.textures.hurt_in1`.
  `BattleArt` caches textures by rect, so a sheet with no `daze`, or with a `daze` hold aliased to `hurt_in1`, gives
  the same object and is skipped.
- **Placeholder:** an enemy with no art gets `AiEnemyView`'s coloured box and the caption `noArt`; the loop still runs.
- **Dev clock:** `createBattleDevClock()` is created in `enter()` and disposed in `exit()`. The pose updates, the loop
  driver, its breaks and daze holds run on its `frameDt(dt)`. Input and the debounce run on raw `dt`. So `&slow=N`
  and `&battleStep=1` (`.` steps) also work in the bestiary, and scrolling still works while stepping.

### 3.7 Habitat scanner (`bestiaryHabitats.ts`)

- **Input:** the `MapData` of each id in `habitats.maps`, loaded with `game.data.loadMap(await resolveMapPath(game.data,
  id, true))`. A failed map logs `console.error` and is skipped.
- **Ids per table:** every `groups[].id` of every entry, plus `enemies[]` of old-style entries. Groups with `min: 0`
  count (`gr_wolf`'s escort wolves). Ids are deduplicated per table.
- **Tables:**
  - the map's main `encounters`: kind `main`;
  - each `encounterZones[]` entry: kind `zone` with the zone id;
  - `scriptedEncounters[]`: kind `boss` when `isBoss`, else `main`. The same id is deduplicated across entries
    (Garland is scripted 3 times by flag).
- **Strings, per map, in map order:**
  - in the main table, or scripted without `isBoss`: `habitatMain` ("World Map");
  - only in zones: `habitatZone` with the zone labels joined by `list` ("World Map (Temple approach)");
  - scripted boss: `habitatBoss` ("Temple of Fiends (boss)").
  - A map counts once per enemy. `main` wins over `zone`; `boss` is added as its own entry. Entries are joined with
    `list`.
- **Pinned results** (test 2), from the compiled maps:
  - goblin: "World Map";
  - wolf: "World Map" (main table and zones);
  - gr_imp: "World Map, Temple of Fiends";
  - skeleton: "World Map (Temple approach), Temple of Fiends";
  - gr_wolf: "World Map (East pocket)";
  - garland: "Temple of Fiends (boss)";
  - vampire, dragon, lich: "Not placed yet".

---

## 4. Animation loop (`bestiaryAnim.ts`, pure)

The driver never assumes animation lengths. It starts a step, waits until the pose controller reports idle again, then
counts the break. Fc's travel-dependent lengths and Fb's pacing need no numbers here. All counting is on the dev
clock's `dt` (3.6).

| Step | Starts with | Ends when | Then |
|---|---|---|---|
| first break | entry shown | `firstBreak` (30) frames | attack |
| attack | `attack()` callback = `view.playAttack(0, phantom)` | `!poses.isAttacking(0)` | `idleBreak` (60) |
| hurt | `poses.playHurt(0)` | `poses.debug(0).mode === 'idle'` | `idleBreak` |
| cast (if `hasCast` or spells) | `poses.playCast(0)` | `!poses.isAttacking(0)` | `idleBreak` |
| daze (if real daze frames) | posture `daze` | `dazeHold` (144) frames | posture none, `idleBreak` |
| loop | back to attack | | |

- `steps(caps)` builds the list from `anim.order` and `{ hasCast, hasDaze, hasSpells }`. Unknown names log once and are
  skipped (the validator also rejects them).
- **Z (`next()`):** ends the current break or daze at once and starts the next step. During an attack, hurt or cast it
  is queued and starts on the first idle frame; an attack is never cut, as in battle.
- **Shift (`togglePause()`):** while paused no step starts; idle breathing continues; the caption shows `paused`.
- `currentLabel()` is the caption key: `heavy` (`attackAnim: heavy`), `ranged` (`attack: ranged`) or `attack`, then
  `hurt`, `cast`, `daze`.
- The poses interface is `{ playHurt, playCast, isAttacking, debug }` plus the `attack()` and `setPosture()`
  callbacks. Tests drive it with the real `EnemyPoseController` (no PixiJS) or a fake.

---

## 5. Input

| Key | Action |
|---|---|
| Up / Down | move one entry; held, auto-repeats (`Menu`: after 20 frames, then every 5); a fresh press wraps at the ends, a held repeat stops there |
| Left / Right | page up / down by `listRows`, clamped, no wrap; handled by the scene with `Menu.setIndex` before `Menu.update` |
| Z (confirm) | next animation now |
| Shift (select) | pause / resume the loop |
| X (cancel) | close (`scenes.pop()`): back to the field menu or the title |

---

## 6. Ownership and order

| When | What | Files |
|---|---|---|
| after wave 1 merges; cut the worktree and record `FH_BASE` | Fh core, parallel with Fe | every new file of 3.5, `bestiary.yaml`, `main.ts`, `DataLoader.ts`, `DamageFormula.ts`, `MapLoader.ts`, `FieldMenuScene.ts` (free after Fb), `TitleScene.ts` and `BattleTrigger.ts` (free after Fg; re-check the `triggerBattle` shape with `{ onEnd }`), the tests of section 7 |
| after Fe merges | Fh integration (about 1 h) | `BestiaryPreview.ts` only: Fe's posture for the daze step; re-run tests 3-4 and browser check 2 |
| after pass F's integration and docs (its §9) | Fh docs | `AGENTS.md` (directory map, the data table, `?bestiary=` under "Debug Menu"), `docs/PROGRESS.md` |

- **No collision with Fe (wave 2):** Fe owns `fx/statusFx.ts`, `fx/statusIcons.ts`, `fx/stoneTextures.ts`, the
  `createStatusFx` body, `actorTint.ts`, `status-visuals.yaml`, `AiEnemyView.ts`, `enemyChoreography.ts`,
  `EnemyPoseController.ts`, `BattleDisplayManager.ts`, `BattleFieldTargeting.ts`, `assets-src/fx/glyphs.py` and
  `battle-fx.*`. Fh edits none of them.
- `debug-scenarios.yaml` is frozen after F0, so Fh adds **no scenario**. The browser checks use the title item,
  `?bestiary=` and the existing `act1_overworld`.
- `tests/data/fileCeilings.test.ts` is not edited (Fe may add to it). Fh has its own
  `tests/scenes/bestiary/bestiaryCeilings.test.ts`.
- `FieldMenuScene.test.ts` and `TitleScene.test.ts` each get cases appended at the end.

---

## 7. Tests (Vitest; each fails on `$FH_BASE`)

1. **`tests/scenes/bestiary/bestiaryModel.test.ts`** (real `enemies.yaml`, `spells.yaml`, `bestiary.yaml`):
   - order and numbering: the ids equal `enemies.yaml` order; "001 Goblin" ... "014 Lich"; the title count
     "013 Garland  13/14";
   - goblin: HP 8, Attack 4, Hits x1, Dmg/hit 4-8, Weak Fire, Resist None, Status hit "78% (spell accuracy 24)",
     Spells None;
   - garland: Boss tag, Attack 9, Hits x2, Dmg/hit 9-18, the phase line "At 50% HP" with "Fight x3" and the YAML
     message;
   - elements: wolf weak Fire / resist Ice; dragon weak Ice / resist Fire. A synthetic enemy with `weakness: fire`,
     `elementalProfile.weaknesses: [fire, holy]`, `immunities: [dark]` and `absorbs: [ice]` gives Fire, Holy / Dark /
     Ice with no duplicates. An unlabelled element shows its id and warns once;
   - `statusChance`: magic defence 0 gives 0.86, 200 gives 0; `statusHits` still rolls the same as on `$FH_BASE` for
     a fixed rng (a table of 5 cases);
   - defaults: missing `accuracy`, `evade` and `hits` show 0, 0 and x1;
   - **line budget:** every real enemy gives ≤ 17 lines; a synthetic enemy with 4 weaknesses, 4 resistances, 2 phases
     and 3 habitats gives ≤ 17 lines, and every line fits its column (28 or 56 characters);
   - `mode: seen`: an unseen entry shows "???" and "-" and is disabled; `mode: all` ignores the predicate;
   - every returned string is printable ASCII.
2. **`tests/scenes/bestiary/bestiaryHabitats.test.ts`** (real compiled maps, loaded through
   `resolveMapPath(loader, id, true)`):
   - the pinned strings of 3.7 for goblin, wolf, gr_imp, skeleton, gr_wolf, garland, vampire, dragon and lich;
   - synthetic maps: an old-style `enemies[]` entry counts; a `min: 0` group counts; three scripted entries give one
     boss habitat;
   - backgrounds: garland → `temple` (override); lich → `shoreline` (override); skeleton → `grassland` (its first
     habitat is the overworld's `temple_approach` zone, which has no `default`, so the map's `grassland` applies);
     gr_imp → `grassland`; wolf → `grassland`; troll (unplaced, no override) → `grassland` (the default).
3. **`tests/scenes/bestiary/bestiaryAnim.test.ts`:**
   - with the real `EnemyPoseController` (goblin config, travel 0) for two cycles: attack, then exactly 60 idle frames,
     hurt, 60 idle frames, attack; the attack lasts `attackTiming(0).totalFrames`;
   - garland caps (`hasCast`, `hasDaze`): attack, hurt, cast, daze (144 frames with posture `daze`), attack;
   - a goblin with no real daze frames has no daze step;
   - Z in a break starts the next step on the same frame; Z during an attack starts it on the first idle frame, and the
     attack is not cut;
   - Shift: no step starts in 300 frames; Shift again resumes;
   - a new entry restarts with the 30-frame first break;
   - a `dt` of 0 (step mode) never advances a break.
4. **`tests/scenes/bestiary/BestiaryScene.test.ts`.** The harness is a mock game, `visibleLabels` from
   `tests/helpers/realData.ts`, and a local **held-key input** (`isPressed` true while a key is held and
   `isJustPressed` only on its first frame), so `Menu`'s auto-repeat runs. The scene is built as
   `new BestiaryScene(game, { art, loadTexture })`, with a fake `MonsterArtSource` (80-cell goblin, 200-cell garland,
   textures over one fake source) and a deferred `loadTexture`, so there is no fetch.
   - `enter()` shows "001 Goblin" and the goblin's stats. Down shows Gr.Imp's stats at once, and the preview rebuilds
     after 8 stable frames, not before;
   - Right moves 6 entries; Right on the last page stays on the last entry; Left goes back;
   - a held Down moves again after 20 frames, then every 5;
   - X calls `scenes.pop()` once;
   - Z starts the attack: the scene's read-only `previewPoses.debug(0).mode` is `'attack'`;
   - **never off-panel:** for the goblin and for garland, on every frame of the attack,
     `sprite.x + opaqueRight * scale` is ≤ the preview's inner right and `sprite.x` is ≥ its inner left;
   - **scroll and leak:** walk all 14 entries twice, holding each for ≥ 8 frames so it rebuilds. Afterwards the
     stage has exactly one enemy sprite, and the scene container's descendant count equals the count after the first
     entry;
   - **background race:** request A then B, resolve B then A: B stays. Resolve a request after `exit()`: nothing is
     added and nothing throws;
   - **exit:** every unique cached texture has `destroyed === true`, the fake atlas source does not, and the cache is
     empty;
   - a missing sheet shows the placeholder box and "No art yet", with no `console.error`.
5. **`tests/data/bestiaryData.test.ts`:** every `backgrounds` id has `assets/backgrounds/<id>.webp`; every
   `backgrounds.enemies` key is an enemy id; every element and family used in `enemies.yaml` has a label; every zone
   label key is an `encounterZones` id of a scanned map; every compiled map in `assets/maps/ai/index.yaml` whose YAML
   has a non-empty `encounters`, any `encounterZones` or any `scriptedEncounters` is in `habitats.maps`;
   `anim.order` names only known steps; every label and template is ASCII, and every template uses only its
   documented placeholders.
6. **`tests/scenes/FieldMenuScene.test.ts`** (appended): the rows read Items, Magic, Equip, Status, Order, Bestiary,
   Save, Load, Config; selecting Bestiary pushes `'bestiary'`; Config is last and Load second to last.
7. **`tests/scenes/TitleScene.test.ts`** (appended):
   - dev: the Bestiary item pushes `'bestiary'`; the window height is `items.length * 48 + 48`;
   - `?bestiary=garland` pushes `bestiary` once on the first `enter()` and not on a later `onResume` or `enter()`;
   - an unknown id warns and the bestiary opens on 001 (through `bestiaryDeepLink`).
8. **`tests/scenes/bestiary/bestiaryProduction.test.ts`** (`vi.stubEnv('DEV', false)`, then `vi.unstubAllEnvs()`):
   the title has no Bestiary item; `bestiaryDeepLink('?bestiary=garland')` is null; the field menu still has the
   Bestiary row. After `npm run build`, `grep -l bestiary dist/assets/*.js` is non-empty (section 9).
9. **`tests/systems/bestiarySeen.test.ts`:** `triggerBattle(['goblin', 'wolf'])` sets `SEEN:goblin` and `SEEN:wolf`
   before the retry snapshot is taken; a battle with `{ onEnd }` (the sandbox) marks them too; the flags survive a
   `SaveManager` save and load.
10. **`tests/core/bestiaryValidation.test.ts`:** a bad `mode`, a negative `idleBreak`, an unknown step and a missing
    template each log `console.error` and fall back to the default.
11. **`tests/scenes/bestiary/bestiaryCeilings.test.ts`:** every new file is under 250 lines.
- **Asset coverage:** `tests/data/assetCoverage.test.ts` already fails for an enemy with no sheet; test 4 covers the
  placeholder path.

---

## 8. Browser checks

Run `npx vite --host 127.0.0.1` with `?mute=1` on every URL. Expect 0 console errors. Close the page and stop the
server after.

1. `http://127.0.0.1:5173/?mute=1`, title, **Bestiary**:
   - it opens on 001 Goblin; screenshot idle, then near contact (or add `&slow=4`);
   - hold Down: the list scrolls with auto-repeat; Right / Left page.
2. `?mute=1&bestiary=garland` opens directly on Garland (no title choice). The raise and hold read (Ff's art, or the
   coil fallback). The slam and return stay inside the panel. Then cast, then daze (after Fe). Screenshot each.
3. `?mute=1&bestiary=dragon`: the attack stays in place (ranged); the background is the desert.
4. `?mute=1&bestiary=gr_wolf`: the recoloured sheet, not the wolf's colours.
5. `?mute=1&scenario=act1_overworld`, Debug, X for the field menu, **Bestiary**: it opens over the field. X goes back to
   the field menu, X again to the field. No encounter started meanwhile.
6. `?mute=1&bestiary=garland&battleStep=1`: `.` steps the preview one frame at a time; Up / Down still scroll.
7. Leak check (`browser_evaluate` on `__game`): scroll all entries 5 times, pausing on each; the bestiary container's
   descendant count is the same before and after.

---

## 9. Validation commands

```bash
FH_BASE=<recorded when the worktree was cut>
npx tsc --noEmit
npm run build && grep -l bestiary dist/assets/*.js        # non-empty: the scene ships in production
npm test
npx vitest run tests/scenes/bestiary tests/data/bestiaryData.test.ts tests/scenes/FieldMenuScene.test.ts \
  tests/scenes/TitleScene.test.ts tests/systems/bestiarySeen.test.ts tests/core/bestiaryValidation.test.ts
wc -l src/scenes/bestiary/*.ts src/types/bestiaryData.ts src/core/bestiaryValidation.ts       # each < 250
git diff --stat "$FH_BASE" -- src/scenes/battle src/rendering                                  # empty
git diff --numstat "$FH_BASE" -- src/scenes/FieldMenuScene.ts src/scenes/TitleScene.ts         # +4 and <= +10
git diff --name-only "$FH_BASE"                                                                # only the files of 3.5 and 7
```

---

## 10. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | The phantom target is measured in a different space than the enemy | it is a child of the stage container at screen (0, 0), unscaled, as `attackPlan` expects (`target.parent.worldTransform`); hidden by alpha 0 or `renderable = false`, never `visible = false`; test 4 checks every attack frame stays in the panel |
| R2 | Fe's posture API differs from the plan | the daze step is isolated in `BestiaryPreview.ts`; the after-Fe task adapts it; until then daze holds the still idle |
| R3 | Texture or sprite churn while scrolling | the frames cache, the 8-frame debounce, destroy on replace and on exit; test 4 and browser check 7 |
| R4 | A slow background load lands after a newer one, or after exit | the request token and the live check; test 4 |
| R5 | The staged background's band above y 120 is a flat fill | the preview starts at y 120 |
| R6 | Stats text overflows as data grows | 28 / 56-character columns with wrapping; a hard 17-line cap with "..." and a warning; the synthetic case of test 1 |
| R7 | Labels or the map list drift from the data | test 5 fails on an unlabelled element, family or zone, and on any compiled map with encounters that is not scanned |
| R8 | The field menu row moves the wrap target | the row is placed before Save; Config stays last (test 6) |
| R9 | The title item or deep link leaks into production | the item and `bestiaryDeepLink` are DEV-gated, the scene and the field row are not; test 8 and the dist grep |
| R10 | `main.ts`, `DataLoader.ts`, `TitleScene.ts` or `BattleTrigger.ts` changed under Fh | free after wave 1; re-check at `$FH_BASE`; the edits only add lines |

---

## 11. Follow-ups (not in this tranche)

- **BS-F1:** effects in the preview (dragon breath, the heavy glint, shake and impact dust) through Fd's
  `createActionFx`, once it can run on a bare layer stack.
- **BS-F2:** status overlays in the preview (an optional "status" step through Fe's `createStatusFx`).
- **BS-F3:** enemy spells, AI patterns and status immunities in `enemies.yaml` (the model shows them when present).
- **BS-F4:** `order: name | level` and a filter by habitat.

---

## 12. TODOs

- [ ] Fh-0: cut the worktree after wave 1, record `FH_BASE`, re-check the file:line references of section 1 (priority: high, effort: 0.25h)
- [ ] Fh-1: `bestiary.yaml`, `bestiaryData.ts`, `bestiaryValidation.ts`, `DataLoader.loadBestiary`; tests 5 and 10 (priority: high, effort: 1.5h)
- [ ] Fh-2: `DamageFormula.statusChance` (with `statusHits` on it), `bestiaryModel.ts`; test 1 (priority: high, effort: 2h)
- [ ] Fh-3: `MapLoader.resolveMapPath`, `bestiaryHabitats.ts`; test 2 (priority: medium, effort: 1.5h)
- [ ] Fh-4: `bestiaryAnim.ts`; test 3 (priority: high, effort: 1.5h)
- [ ] Fh-5: `BestiaryPreview.ts` (stage, mask, background token, cached `AiEnemyView`, phantom target, caption outside the stage, exit cleanup, dev clock) and `BestiaryStatsPanel.ts` (priority: high, effort: 3h)
- [ ] Fh-6: `BestiaryScene.ts` (layout, `Menu`, paging, Z, Shift, X, injected deps), `bestiaryLink.ts`, `main.ts` registration; tests 4, 8 and 11 (priority: high, effort: 3h)
- [ ] Fh-7: the field menu row, the title dev item, window height and deep link; seen flags in `BattleTrigger`; tests 6, 7 and 9 (priority: medium, effort: 1.25h)
- [ ] Fh-8: build plus the dist grep, the full suite, browser checks 1-7 with screenshots and 0 console errors (priority: high, effort: 1.5h)
- [ ] Fh-9 (after Fe merges): the daze step on Fe's posture API; re-run tests 3-4 and browser check 2 (priority: medium, effort: 1h)
- [ ] Fh-10 (after pass F docs): `AGENTS.md` and `docs/PROGRESS.md` entries (priority: low, effort: 0.5h)
