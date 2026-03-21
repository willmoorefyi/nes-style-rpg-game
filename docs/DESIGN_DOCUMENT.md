# FF1-Style NES RPG — Game Design Document

## Quick Reference

| Parameter | Value |
|-----------|-------|
| Party Size | 4 members |
| Classes | 6 base (upgradeable) |
| Spell Levels | 8 tiers |
| Charges per Level | 1-9 (grows with level) |
| Combat | Turn-based, random encounters |
| Vehicles | Ship, Canoe, Airship |

---

## 1. Overview & Vision

### Concept
A faithful homage to Final Fantasy I (1987), capturing the essence of early NES RPGs: a 4-member party, class-based progression, turn-based combat, and a world to explore via overworld, towns, and dungeons.

### Tone
Heroic fantasy with a sense of mystery. The world is threatened by elemental chaos; four Warriors of Light must restore balance. Tone is earnest, not ironic—danger feels real, victories feel earned.

### Inspirations
- Final Fantasy I (NES, 1987) — primary reference
- Dragon Quest I-III — simplicity and charm
- 8-bit era constraints as aesthetic virtue

### Target Platform
PC (Windows/Mac/Linux). Designed for keyboard/gamepad. Resolution: 256×240 (NES native) scaled up.

### Engine
PixiJS + TypeScript. PixiJS handles WebGL/Canvas rendering (sprites, tilemaps, text). All game systems (battle, exploration, menus, audio) are custom TypeScript. Bundled with Vite for development and distribution as a web app.

---

## 2. World & Story

### Setting
A fantasy world with four continents, each tied to an elemental crystal (Earth, Fire, Water, Wind). The crystals have gone dark, and monsters roam the land.

### Narrative Structure
1. **Opening**: Party arrives in Cornelia; the princess has been kidnapped by a rogue knight.
2. **Early Game**: Rescue princess, gain access to the wider world. Learn of the darkened crystals.
3. **Mid Game**: Travel to each elemental shrine, defeat the Fiend corrupting each crystal.
4. **Late Game**: Discover the source of corruption—a time loop. Travel to the past.
5. **Finale**: Confront the final boss, restore the crystals, break the loop.

### World Map Layout
- **Starting Continent**: Cornelia Castle, Town of Cornelia, Temple of Fiends, Matoya's Cave
- **Northern Continent**: Elfheim, Dwarf Cave, Marsh Cave (Earth Crystal)
- **Western Continent**: Melmond, Earth Cave, Crescent Lake, Gurgu Volcano (Fire Crystal)
- **Eastern Islands**: Onrac, Waterfall Cave, Sea Shrine (Water Crystal)
- **Sky Fortress**: Floating castle accessed via Airship (Wind Crystal)
- **Final Dungeon**: Temple of Fiends Revisited (past)

### Towns
Each town has: Inn, Item Shop, Weapon/Armor Shop, Magic Shop (White/Black), NPCs with hints. [DEFERRED: CONTENT PHASE] Exact town count and names beyond core locations will be defined during content creation.

### Dungeons
8-12 dungeons of increasing complexity. Each has: multiple floors, treasure chests, random encounters, a boss or key item at the end.

---

## 3. Characters & Classes

### Party System
- Party of exactly 4 members, chosen at game start
- No mid-game class changes (except upgrade at story milestone)
- Each slot can be any class; duplicates allowed

### Base Classes

| Class | Role | Weapon Prof | Armor Prof | Magic |
|-------|------|-------------|------------|-------|
| Warrior | Tank/DPS | Swords, Axes, Hammers | Heavy | None |
| Thief | Speed/Utility | Knives, Light Swords | Light | None |
| Monk | DPS | Nunchaku, Bare Fists | None/Light | None |
| White Mage | Healer | Staves, Hammers | Robes | White 1-7 |
| Black Mage | Nuker | Knives, Staves | Robes | Black 1-7 |
| Red Mage | Hybrid | Swords, Staves | Medium | White/Black 1-5 |

### Stat Growth
Stats: HP, Strength, Agility, Intelligence, Vitality, Luck

| Class | HP | Str | Agi | Int | Vit | Luck |
|-------|-----|-----|-----|-----|-----|------|
| Warrior | High | High | Med | Low | High | Med |
| Thief | Med | Med | High | Low | Med | High |
| Monk | High | High | Med | Low | High | Med |
| White Mage | Low | Low | Med | High | Low | Med |
| Black Mage | Low | Low | Med | High | Low | Med |
| Red Mage | Med | Med | Med | Med | Med | Med |

Growth rates are per-level bonuses (tunable). [DEFERRED: PLAYTESTING] Exact numeric growth tables will be tuned during playtesting.

### Class Upgrades
At a story milestone (after lighting the Earth Crystal), the party can upgrade classes:

| Base | Upgraded | Gains |
|------|----------|-------|
| Warrior | Knight | White Magic 1-3 |
| Thief | Ninja | Black Magic 1-4 |
| Monk | Master | Higher base damage |
| White Mage | White Wizard | White Magic 8 |
| Black Mage | Black Wizard | Black Magic 8 |
| Red Mage | Red Wizard | White/Black 6-7 |

---

## 4. Combat System

### Battle Flow
1. **Encounter Trigger**: Random encounter on overworld/dungeon tiles, or scripted boss.
2. **Command Phase**: Player selects action for each party member (Fight, Magic, Item, Run).
3. **Execution Phase**: Actions resolve in Agility order. If a target is dead before the attacker's turn, the attack auto-retargets to another valid enemy. (A classic FF1 "Ineffective" mode may be added as a toggle in the future.)
4. **Resolution**: Check for victory (all enemies dead) or defeat (all party dead).
5. **Rewards**: XP and Gold distributed; return to exploration.

### Random Encounters
- Encounter rate varies by zone (overworld lower, dungeons higher)
- Encounter tables per zone with weighted enemy groups
- Step-counter encounter system: overworld ~20-30 steps between encounters, dungeons ~10-20 steps, with random variance. Exact tuning deferred to playtesting.

### Formations
- Party has front row (slots 1-2) and back row (slots 3-4)
- Front row: full melee damage dealt/received
- Back row: reduced melee damage dealt/received; magic unaffected
- Enemies may also have rows

### Enemy Design
- Enemies have: HP, Attack, Defense, Agility, Magic Defense, Elemental Weaknesses/Resistances, XP, Gold, possible item drop
- Enemy groups: 1-9 enemies per encounter
- Starting target: ~32 enemies across 8 tiers (4 per tier). Enemy data is data-driven and extensible—easy to add more without code changes.

### Boss Design Philosophy
- Bosses are scripted encounters (no running)
- Each boss has a gimmick: elemental weakness, status vulnerability, or attack pattern
- Fiends (4 elemental bosses) are major milestones
- Final boss has multiple phases

---

## 5. Magic System

### Spell Charge System (NOT MP)
FF1 uses a charge-based system:
- 8 spell levels (Lv1 = weakest, Lv8 = strongest)
- Each level has a separate pool of charges
- Charges restore at Inns or with specific items (Tent, Cabin, House)
- Mages learn spells by purchasing them in shops and assigning to slots

### Charges per Level (by Character Level)

| Char Lv | Lv1 | Lv2 | Lv3 | Lv4 | Lv5 | Lv6 | Lv7 | Lv8 |
|---------|-----|-----|-----|-----|-----|-----|-----|-----|
| 1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 5 | 4 | 2 | 1 | 0 | 0 | 0 | 0 | 0 |
| 10 | 5 | 4 | 3 | 2 | 1 | 0 | 0 | 0 |
| 20 | 7 | 6 | 5 | 5 | 4 | 3 | 2 | 1 |
| 50 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 |

(Values are illustrative; [DEFERRED: PLAYTESTING] exact progression curve will be tuned during playtesting.)

### Spell Slots
- Each spell level has 3 spell slots per character
- Spells are learned permanently once purchased
- Cannot unlearn spells (choose wisely)

### White Magic Spell List

| Level | Spell 1 | Spell 2 | Spell 3 | Spell 4 |
|-------|---------|---------|---------|----------|
| 1 | CURE | HARM | FOG | RUSE |
| 2 | LAMP | MUTE | ALIT | INVS |
| 3 | CUR2 | HRM2 | AFIR | HEAL |
| 4 | PURE | FEAR | AICE | AMUT |
| 5 | CUR3 | LIFE | HRM3 | HEL2 |
| 6 | SOFT | EXIT | FOG2 | INV2 |
| 7 | CUR4 | HRM4 | ARUB | HEL3 |
| 8 | FADE | WALL | XFER | NUKE |

### Black Magic Spell List

| Level | Spell 1 | Spell 2 | Spell 3 | Spell 4 |
|-------|---------|---------|---------|----------|
| 1 | FIRE | SLEP | LOCK | LIT |
| 2 | ICE | DARK | TMPR | SLOW |
| 3 | FIR2 | HOLD | LIT2 | LOK2 |
| 4 | SLP2 | FAST | CONF | ICE2 |
| 5 | FIR3 | BANE | WARP | SLO2 |
| 6 | LIT3 | RUB | QAKE | STUN |
| 7 | ICE3 | BRAK | SABR | BLND |
| 8 | STOP | ZAP! | XXXX | NUKE |

### Class Spell Access

| Class | White Levels | Black Levels |
|-------|--------------|---------------|
| White Mage | 1-7 | — |
| White Wizard | 1-8 | — |
| Black Mage | — | 1-7 |
| Black Wizard | — | 1-8 |
| Red Mage | 1-5 | 1-5 |
| Red Wizard | 1-7 | 1-7 |
| Knight | 1-3 | — |
| Ninja | — | 1-4 |

---

## 6. Items & Equipment

### Weapons
Weapons provide Attack bonus and may have elemental/status effects.

| Weapon | Attack | Price | Usable By | Notes |
|--------|--------|-------|-----------|-------|
| Wooden Nunchaku | 12 | 10 | Monk | Starter |
| Small Knife | 5 | 5 | All | Starter |
| Rapier | 9 | 10 | Warrior, Thief, Red Mage | — |
| Iron Sword | 14 | 175 | Warrior, Knight, Red Mage | — |
| Mythril Sword | 23 | 4000 | Warrior, Knight, Red Mage | — |
| Flame Sword | 26 | 10000 | Knight | Fire element |
| Masamune | 56 | — | All | Endgame, found |

[DEFERRED: CONTENT PHASE] Full weapon list (~40 weapons) will be defined during content creation. Weapon data is data-driven and extensible.

### Armor
Armor provides Defense bonus and may grant resistances.

| Armor | Defense | Price | Usable By | Notes |
|-------|---------|-------|-----------|-------|
| Cloth | 1 | 10 | All | Starter |
| Wooden Armor | 4 | 50 | Warrior, Knight | — |
| Chain Mail | 15 | 80 | Warrior, Knight, Red Mage | — |
| Iron Armor | 24 | 800 | Warrior, Knight | — |
| Dragon Armor | 42 | — | Knight | Found, resists fire/ice/lit |

[DEFERRED: CONTENT PHASE] Full armor list including shields, helmets, gloves will be defined during content creation. Armor data is data-driven and extensible.

### Consumables

| Item | Price | Effect |
|------|-------|--------|
| Potion | 60 | Restore 30 HP |
| Hi-Potion | 150 | Restore 120 HP |
| Ether | 500 | Restore 1 charge to each spell level |
| Antidote | 75 | Cure Poison |
| Soft | 800 | Cure Stone |
| Tent | 250 | Restore HP/charges (overworld, partial) |
| Cabin | 500 | Restore HP/charges (overworld, full) |
| House | 3000 | Restore HP/charges (anywhere, full) |
| Phoenix Down | 500 | Revive with 1 HP |

### Key Items
Story items that unlock progression:
- Lute — opens Temple of Fiends final door
- Crown — trade for Crystal Eye
- Crystal Eye — give to Matoya for Herb
- Herb — wake Elf Prince for Mystic Key
- Mystic Key — opens locked doors in early dungeons
- TNT — opens canal
- Ruby — give to Titan for passage
- Rod — parts the sea to Sea Shrine
- Canoe — water travel (rivers/lakes)
- Ship — ocean travel
- Airship — flight
- Chime — opens Mirage Tower
- Cube — teleport to Sky Fortress
- Adamantite — forge Excalibur

### Shop System
- Shops are per-town with fixed inventory
- Prices fixed (no haggling)
- Sell price = 50% of buy price
- [DEFERRED: CONTENT PHASE] Per-town shop inventories will be defined during content creation. Shop data is data-driven and extensible.

---

## 7. Progression & Economy

### XP & Leveling
- XP shared equally among living party members after battle
- Level cap: 50
- XP curve: exponential (each level requires ~1.5x previous)

| Level | Total XP | HP (Warrior) | HP (Black Mage) |
|-------|----------|--------------|------------------|
| 1 | 0 | 35 | 25 |
| 10 | 10,000 | 150 | 80 |
| 20 | 50,000 | 350 | 160 |
| 30 | 150,000 | 550 | 250 |
| 50 | 500,000 | 999 | 450 |

[DEFERRED: PLAYTESTING] Exact XP table and stat growth per level will be tuned during playtesting.

### Gold Economy
- Gold is the sole currency
- Sources: enemy drops, treasure chests, selling items
- Sinks: equipment, consumables, spells, Inn stays

### Economy Pacing
| Phase | Gold Available | Key Purchases |
|-------|----------------|---------------|
| Early (Lv 1-10) | 0-5,000 | Basic gear, Lv1-2 spells |
| Mid (Lv 10-25) | 5,000-50,000 | Mythril gear, Lv3-5 spells |
| Late (Lv 25-40) | 50,000-200,000 | Best shop gear, Lv6-7 spells |
| Endgame (Lv 40+) | 200,000+ | Consumables, Lv8 spells |

### Difficulty Pacing
- Early game: teach mechanics, low punishment for mistakes
- Mid game: resource management matters, some grinding expected
- Late game: strategic party composition and spell use required
- Endgame: challenging but fair; preparation rewarded

---

## 8. Exploration & Dungeons

### Overworld Design
- Tile-based world map, scrolling
- Terrain types: grass, forest, mountain, desert, water, swamp
- Movement speed varies by terrain (forest slower, roads faster)
- Random encounters on most terrain (roads safer)
- Vehicles expand accessible areas

### Vehicles

| Vehicle | Acquired | Access Granted |
|---------|----------|----------------|
| Canoe | After Earth Cave | Rivers, lakes |
| Ship | After defeating Bikke | Oceans |
| Airship | After defeating Tiamat | Anywhere (land on grass) |

### Dungeon Design Principles
- Linear-ish with optional side paths for treasure
- 2-6 floors per dungeon
- Increasing encounter difficulty deeper in
- Treasure chests: consumables, gold, equipment, key items
- Some chests are trapped (monster-in-a-box)
- Boss at the end (or key item)
- No save points inside (tension management)

### NPC Interactions
- NPCs give hints, lore, and advance quests
- Dialog is short and direct (NES style)
- Some NPCs are shops/inns
- [DEFERRED: CONTENT PHASE] NPC dialog script will be written during content creation.

### Puzzle Philosophy
- Puzzles are simple: find key, use item, push block
- No complex logic puzzles (not FF1's style)
- Exploration and observation rewarded

---

## 9. UI & Menus

### Menu Flow

```
[Field] ──▶ [Main Menu]
              ├── Items
              ├── Magic
              ├── Equip
              ├── Status
              ├── Order (rearrange party)
              └── Config (settings)

[Battle] ──▶ [Command Menu per character]
              ├── Fight (select target)
              ├── Magic (select spell, select target)
              ├── Item (select item, select target)
              └── Run
```

### Battle UI Layout
```
┌─────────────────────────────────────┐
│  [Enemy sprites in center]          │
├─────────────────────────────────────┤
│ Warrior   HP: 120/150               │
│ Thief     HP:  85/100               │
│ W.Mage    HP:  45/ 60               │
│ B.Mage    HP:  38/ 55               │
├─────────────────────────────────────┤
│ ▶ FIGHT   MAGIC   ITEM   RUN        │
└─────────────────────────────────────┘
```

### Dialog/Text System
- Fixed-width font (8x8 pixels)
- Text box at bottom of screen
- Character-by-character reveal (skippable)
- Max ~24 characters per line, 3-4 lines visible

### Window Chrome Style
- Blue gradient background
- White border with rounded corners (NES FF1 style)
- Consistent across all menus

---

## 10. Art & Audio Direction

### Pixel Art Style
- NES constraints: 256×240 resolution, 54-color palette (use subset)
- Tiles: 16×16 pixels
- Sprites: 16×16 (characters), 16×16 to 32×32 (enemies), up to 64×64 (bosses)
- 3-4 colors per sprite (plus transparency)
- Limited animation frames (2-4 per action)

### Tile Specifications
- Overworld tiles: grass, water, mountain, forest, desert, town, dungeon entrance
- Dungeon tiles: floor, wall, door, chest, stairs, hazard
- Town tiles: building, path, decoration, NPC markers

### Sprite Specifications
- Party: 4 directions × 2 walk frames + battle stance + victory pose
- Enemies: idle + attack frame (minimal animation)
- NPCs: 1-2 frames, 1-4 directions

### Chiptune Music Direction
- 4 channels (2 pulse, 1 triangle, 1 noise) — NES APU style
- Shared track set (~9 tracks):
  - Title theme
  - Overworld
  - Town
  - Dungeon
  - Battle (normal)
  - Battle (boss)
  - Victory fanfare
  - Game over
  - Ending
  Per-area variants deferred to content phase.

### SFX Philosophy
- Short, punchy sounds (NES style)
- Core SFX categories (~10): menu cursor, confirm, cancel, attack hit, magic cast, damage taken, heal, level up, item get, door open. Additional SFX may be added as needed.

---

## 11. Technical Scaffolding

### Technology Stack

| Component | Choice | Purpose |
|-----------|--------|---------|
| Rendering | PixiJS | WebGL/Canvas sprite rendering, scene graph |
| Language | TypeScript | Type-safe game logic, all custom systems |
| Bundler | Vite | Fast dev server, production builds |
| Audio | Web Audio API | Chiptune music and SFX playback |

All game systems (battle, exploration, menus, input, save/load) are custom TypeScript. Distributed as a web app.

### Project Directory Structure

```
project/
├── public/
│   └── assets/
│       ├── sprites/
│       ├── tiles/
│       ├── audio/
│       │   ├── music/
│       │   └── sfx/
│       └── fonts/
├── src/
│   ├── main.ts
│   ├── battle/
│   ├── exploration/
│   ├── ui/
│   ├── entities/
│   ├── systems/
│   └── data/
│       ├── enemies.json
│       ├── items.json
│       ├── spells.json
│       ├── classes.json
│       └── maps/
├── docs/
│   └── DESIGN_DOCUMENT.md
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### Milestone Plan

| Phase | Deliverable | Duration |
|-------|-------------|----------|
| 1. Core | Movement, map rendering, menu shell | 2-3 weeks |
| 2. Battle | Turn-based combat, basic enemies | 3-4 weeks |
| 3. Progression | XP, leveling, equipment, shops | 2 weeks |
| 4. Magic | Spell system, charge management | 2 weeks |
| 5. Content | Full maps, enemies, items, story | 4-6 weeks |
| 6. Polish | Balancing, SFX, music, bug fixes | 2-3 weeks |
| 7. Release | Testing, packaging, distribution | 1-2 weeks |

Total estimate: 16-22 weeks for a solo developer.

---

## Appendix: Open Decisions Summary

### Resolved
- Engine choice: PixiJS + TypeScript
- Retarget vs. "Ineffective" on dead targets: Auto-retarget (classic mode toggle as future option)
- Encounter rate formula: Step-counter system (~20-30 overworld, ~10-20 dungeon)
- Full bestiary: ~32 enemies across 8 tiers as starting target
- Per-area music themes vs. generic: Shared track set (~9 tracks)
- Full SFX list: ~10 core categories

### Deferred to Playtesting
Search for `[DEFERRED: PLAYTESTING]`:
- Exact stat growth tables
- Spell charge progression curve
- Exact XP table and stat growth per level

### Deferred to Content Phase
Search for `[DEFERRED: CONTENT PHASE]`:
- Exact town count and names
- Full weapon list (~40 weapons)
- Full armor list (shields, helmets, gloves)
- Per-town shop inventories
- NPC dialog script

### Design Principle
All content systems (enemies, items, spells, shops) are data-driven and extensible—easy to add new entries without code changes.
