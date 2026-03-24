```
 _____ _____ _        ____  ____   ____
|  ___|  ___/ |      |  _ \|  _ \ / ___|
| |_  | |_ | |______| |_) | |_) | |  _
|  _| |  _|| |______|  _ <|  __/| |_| |
|_|   |_|  |_|      |_| \_\_|    \____|
```

# ⚔️ FF1-Style NES RPG

A faithful homage to *Final Fantasy I* (1987), built from scratch with PixiJS and TypeScript. Four Warriors of Light, darkened crystals, elemental fiends, and a world to save — all rendered at authentic NES resolution (256×240) with turn-based combat, a spell charge system, and data-driven content you can mod with YAML files.

**PixiJS 8** · **TypeScript 5.3** · **Vite 5** · **Vitest** · **Web Audio API**

---

## 🚀 Quick Start

**Prerequisites:** Node.js 20+ and npm

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173, hot reload)
npm run dev

# Production build (outputs to dist/)
npm run build

# Run all tests (739+ tests across 70+ files)
npm test
```

You should be playing in under 30 seconds.

---

## 🎮 About the Game

A turn-based RPG inspired by the original *Final Fantasy* for the NES. The world's four elemental crystals have gone dark, and monsters roam the land. You assemble a party of four Warriors of Light and set out to defeat the elemental Fiends, restore the crystals, and uncover the time loop at the heart of the corruption.

### Key Features

- **6 base classes (upgradeable to 12)** — Warrior, Thief, Monk, White Mage, Black Mage, Red Mage — each with unique stats, equipment, and upgrade paths (Warrior→Knight, Thief→Ninja, etc.)
- **Turn-based combat** with FF1-faithful damage formulas, turn order, and auto-retargeting
- **Boss battles** — scripted encounters with multi-phase bosses and BossAI
- **Spell charge system** — not MP! Each spell level has its own pool of charges, just like the original
- **Vehicles** — ship, canoe, and airship with terrain-based movement modes
- **Data-driven everything** — items, spells, enemies, shops, and maps are all YAML files you can edit
- **NES-authentic visuals** — 256×240 resolution, 16×16 tiles, pixel art style
- **Chiptune audio** — Web Audio API with EventBus-driven music and SFX
- **Save/load system** — multiple save slots with story flag tracking
- **Random encounters** — step-counter system with per-zone encounter tables

---

## 🕹️ How to Play

### Controls

| Action | Key |
|--------|-----|
| Move | Arrow Keys |
| Confirm / Talk | Z or Enter |
| Cancel / Back | X or Escape |
| Open Menu | X or Escape (on field) |

### Getting Started

1. **Create your party** — Choose 4 characters from 6 classes. Duplicates are allowed. A balanced party might be Warrior, White Mage, Black Mage, and Thief.
2. **Explore** — Walk around towns, talk to NPCs for hints, visit shops to gear up.
3. **Fight** — Random encounters happen as you walk. Choose Fight, Magic, Item, or Run for each party member.
4. **Progress** — Rescue the princess, gain access to the wider world, and light the four crystals.

### Combat Basics

- **Fight** — Physical attack against a selected enemy
- **Magic** — Cast a spell using charges (not MP). Charges are per spell level.
- **Item** — Use a consumable (Potion, Antidote, etc.)
- **Run** — Attempt to flee (not available in boss fights)

Turn order is determined by Agility. If your target dies before your turn, the attack auto-retargets another enemy.

### Magic System

Mages don't use MP. Instead, each spell level (1–8) has a separate pool of charges that grow as you level up. Charges restore at Inns or with items like Tents and Cabins. Spells are purchased at magic shops and permanently learned — choose wisely, as each level has only 3 spell slots per character.

### Equipment & Items

Open the field menu to equip weapons and armor, use consumables, check status, or rearrange party order. Sell unwanted gear at shops for half price.

### Saving

Save your game from the field menu. The game uses localStorage with multiple save slots. Save often — there are no save points inside dungeons.

### Tips for New Players

- Buy spells early — they make a huge difference in the first dungeon
- Keep Potions and Antidotes stocked
- Inns are cheap and fully restore HP and spell charges
- Talk to every NPC — they give hints about where to go next
- The Warrior's high HP makes them a reliable front-line tank

---

## ⚙️ Game Systems

A brief technical overview for developers interested in how things work under the hood.

### Scene Management

A scene stack with `push`, `pop`, `pause`, and `resume`. Opening the menu pushes a new scene; closing it pops back to exploration. Battle scenes push on top of the exploration scene, which resumes when combat ends.

### Battle System

A state machine that flows through phases: **Intro → Command → Execution → Resolution**. The `BattleSceneDeps` interface decouples the battle logic from rendering, making the entire combat system testable without PixiJS.

### Magic & Elements

Elemental damage (fire, ice, lightning, holy) with per-enemy weaknesses and resistances. Status effects (sleep, poison, stone, etc.) with duration tracking. All spell data is loaded from `assets/data/spells.yaml`.

### Inventory & Shops

A centralized `Inventory` system with buy/sell at weapon, armor, item, and magic shops. Inn scenes restore HP and spell charges. Shop inventories are defined per-town in `assets/data/shops.yaml`.

### Save/Load

`SaveManager` serializes the full game state (party, inventory, position, story flags) to localStorage. Story progression is tracked via `GameFlags` — a key/value store of boolean flags that gate content and dialog.

### Audio

Web Audio API with an `AudioManager` driven by the `EventBus`. Scene transitions, battle events, and UI actions trigger music and SFX changes through events rather than direct coupling.

### Random Encounters

A step-counter system with configurable min/max steps per zone. Encounter tables define weighted enemy groups per map. An injectable RNG makes encounter behavior fully deterministic in tests.

---

## 🗺️ Modding & Customization

All game content lives in YAML data files. You can add items, spells, enemies, shops, and maps without touching any TypeScript.

### Data File Locations

```
assets/
├── data/
│   ├── classes.yaml    # Character class definitions
│   ├── enemies.yaml    # Enemy stats and rewards
│   ├── items.yaml      # Weapons, armor, consumables
│   ├── shops.yaml      # Per-town shop inventories
│   └── spells.yaml     # Spell definitions and effects
└── maps/
    └── *.yaml          # Tile maps, NPCs, encounters
```

### Adding a New Item

Add an entry to `assets/data/items.yaml`:

```yaml
- id: mythril_sword
  name: Mythril Sword
  type: weapon
  stats: { attack: 23 }
  price: 4000
  usableBy: [warrior, red_mage]
```

### Adding a New Spell

Add an entry to `assets/data/spells.yaml`:

```yaml
- id: cure
  name: CURE
  level: 1
  type: white
  effect: heal
  targeting: single
  description: Restore HP to one ally
  power: 30
  element: none
```

### Adding a New Enemy

Add an entry to `assets/data/enemies.yaml`:

```yaml
- id: goblin
  name: Goblin
  stats:
    hp: 20
    strength: 5
    agility: 4
    intelligence: 2
    vitality: 3
    luck: 2
    attack: 8
    defense: 2
    magicDefense: 1
  xpReward: 10
  goldReward: 5
  sprite: goblin
  weakness: fire
```

### Modifying Shops

Edit `assets/data/shops.yaml` to change what each town sells. Reference item/spell IDs from the other data files:

```yaml
- id: cornelia_weapon
  type: weapon
  name: Cornelia Weapons
  inventory: [rapier, short_sword, hammer, staff]

- id: cornelia_white
  type: magic
  name: White Magic
  inventory: [cure, harm, fog, ruse]

- id: cornelia_inn
  type: inn
  name: Cornelia Inn
  inventory: []
  innPrice: 30
```

### Creating Maps

Maps are YAML files in `assets/maps/` with tile layers, NPC definitions, transitions, and encounter tables:

```yaml
id: test-town
width: 10
height: 10
layers:
  - [0]
tilesets: [town]
collision: []
npcs: []
transitions: []
encounterRate:
  min: 5
  max: 10
encounters:
  - enemies: [goblin]
    weight: 3
  - enemies: [goblin, goblin]
    weight: 2
  - enemies: [wolf]
    weight: 1
```

### Adding a Character Class

Add an entry to `assets/data/classes.yaml`:

```yaml
- id: warrior
  name: Warrior
  baseStats:
    hp: 35
    strength: 20
    agility: 5
    intelligence: 1
    vitality: 10
    luck: 5
  statGrowth:
    hp: 6
    strength: 3
    agility: 1
    intelligence: 0
    vitality: 2
    luck: 1
  usableEquipment: [sword, axe, hammer, heavy_armor, shield]
  spellLevels: { white: 0, black: 0 }
```

### Cross-File Validation

A dedicated test suite (`tests/data/crossFileValidation.test.ts`) validates that all references between data files are consistent — shop inventories reference real item IDs, encounter tables reference real enemy IDs, etc. Run `npm test` after editing any data file to catch broken references.

### YAML Tips

- **Quote strings that look like booleans:** `"yes"`, `"no"`, `"true"`, `"false"` — unquoted, YAML interprets these as booleans
- **The Norway problem:** Country code `NO` becomes `false` in YAML. Always quote short codes.
- **Use comments freely:** Lines starting with `#` are ignored — great for organizing sections

---

## 📁 Project Structure

```
ff-game/
├── assets/
│   ├── data/           # YAML game data (classes, enemies, items, shops, spells)
│   └── maps/           # YAML map definitions
├── docs/
│   ├── DESIGN_DOCUMENT.md   # Full game design document
│   └── PROGRESS.md          # Implementation progress tracker
├── src/
│   ├── main.ts              # Entry point — initializes Game, registers scenes
│   ├── battle/              # Combat: damage formulas, turn order, AI, status effects, elements
│   ├── core/                # Engine: Game loop, SceneManager, InputManager, EventBus, AudioManager, DataLoader
│   ├── data/                # Data registries (ShopRegistry)
│   ├── entities/            # Game objects: Character, Inventory, PartyManager, PlayerController, NPC
│   ├── rendering/           # PixiJS rendering: TilemapRenderer, Camera, SpriteAnimation, CollisionMap
│   ├── scenes/              # All game scenes: Exploration, Battle, Menus, Shops, Save/Load, Inn
│   ├── systems/             # Game systems: Encounters, MapLoader, SaveManager, DialogManager, BattleTrigger
│   ├── types/               # Shared TypeScript type definitions
│   └── ui/                  # UI components: Window, Menu, DialogBox, TextRenderer, SpellSelectionUI
├── tests/                   # Mirrors src/ structure — 70+ test files, 739+ tests
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🛠️ Development

### Architecture

PixiJS handles all WebGL/Canvas rendering (sprites, tilemaps, text). Every other system — battle, exploration, menus, input, audio, save/load — is custom TypeScript. The codebase is designed around:

- **Decoupled systems** — `BattleSceneDeps` interface lets the battle engine run without a renderer
- **Injectable RNG** — deterministic random numbers for fully reproducible tests
- **EventBus** — loose coupling between systems (audio reacts to game events, not direct calls)
- **Data-driven content** — all game content loaded from YAML at runtime via `DataLoader`
- **Scene stack** — push/pop architecture for layered UI (menus on top of exploration, etc.)

### Testing

```bash
npm test
```

Runs 739+ tests across 70+ files with Vitest. The test suite covers:

- Battle mechanics (damage formulas, turn order, AI, elements, status effects)
- Core systems (scene management, input, events, data loading, audio, save/load)
- Rendering (camera, collision, tilemaps, sprites)
- Entities (characters, inventory, party management)
- UI components (menus, dialogs, text rendering)
- Cross-file data validation (broken references between YAML files)

### Adding New Features

| What you're building | Where to work |
|---------------------|---------------|
| New battle mechanic | `src/battle/` |
| New scene or menu | `src/scenes/` + register in `src/main.ts` |
| New game system | `src/systems/` |
| New UI component | `src/ui/` |
| New game content | `assets/data/*.yaml` or `assets/maps/*.yaml` |
| New entity type | `src/entities/` |

### Documentation

See [docs/DESIGN_DOCUMENT.md](docs/DESIGN_DOCUMENT.md) for the complete game design document covering world design, combat formulas, class stats, spell lists, item tables, and more.

---

## 📋 Implementation Status

### ✅ Complete (Phases 1–17)

| Phase | What's Done |
|-------|-------------|
| 1. Project Scaffolding | Vite + TypeScript + PixiJS setup, game loop, scene manager, asset loader |
| 2. Core Systems | Input manager, data loader, event bus, entity types |
| 3. Tilemap & Rendering | Tilemap renderer, camera, sprite animation, collision map |
| 4. UI Framework | NES-style windows, text renderer, menu system, dialog box |
| 5. First Playable | Player movement, map transitions, NPC interaction |
| 6. Party & Characters | Party manager, 6 base classes (upgradeable to 12), equipment slots, status screen |
| 7. Combat Core | Battle state machine, command menu, damage formulas, enemy AI |
| 8. Random Encounters | Step counter, encounter tables, battle transitions, victory/defeat |
| 9. Magic System | Spell charges, spell data, targeting, effects |
| 10. Items & Equipment | Inventory, equipment stat bonuses, consumables in battle |
| 11. Shops & Economy | Shop UI, buy/sell, Inn rest mechanic |
| 12. Save/Load | Game state serialization, localStorage, save slots |
| 13. Audio | Web Audio API music, SFX manager, EventBus integration |
| 14. Boss Battles & AI | AIBehavior, BossAI, multi-phase bosses, scripted encounters, cutscenes |
| 15. Vehicles & World | Terrain types, 4 movement modes, VehicleManager, key item gates |
| 16. Class Upgrades | 6 upgraded classes, ClassUpgradeSystem, NPC-triggered upgrades |
| 17. Content Population | Overworld + towns + dungeons, 42 items, 34 spells, 12 enemies, 18 shops, conditional dialog |

### 🔜 Remaining (Phase 18)

| Phase | What's Coming |
|-------|---------------|
| 18. Polish & Balancing | Playtesting, stat tuning, encounter rates, final art/audio |

See [docs/PROGRESS.md](docs/PROGRESS.md) for detailed progress notes and challenges encountered.

---

## ♿ Accessibility

- The game is fully keyboard-controlled — no mouse required
- The canvas element has `role="application"` and an `aria-label` for screen readers
- The canvas auto-focuses on load so keyboard input works immediately
- A visible focus outline appears when the canvas is focused via keyboard
- All menus, dialogs, and combat are navigable with Arrow Keys, Z/Enter (confirm), and X/Escape (cancel)

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
