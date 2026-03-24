# Content Guide — FF1-Style NES RPG

How to add and modify game content. All content lives in YAML data files — no TypeScript changes needed.

---

## Quick Reference

| Content Type | File | Template |
|-------------|------|----------|
| Enemies | `assets/data/enemies.yaml` | `assets/data/templates/enemy-template.yaml` |
| Items | `assets/data/items.yaml` | `assets/data/templates/item-template.yaml` |
| Spells | `assets/data/spells.yaml` | `assets/data/templates/spell-template.yaml` |
| Shops | `assets/data/shops.yaml` | `assets/data/templates/shop-template.yaml` |
| Maps | `assets/maps/<name>.yaml` | `assets/data/templates/map-template.yaml` |
| Classes | `assets/data/classes.yaml` | (see classes.yaml for examples) |

**After every edit, run validation:**

```bash
npm run validate   # Fast standalone check
npm test           # Full test suite including cross-file validation
```

---

## Adding a New Enemy

1. Open `assets/data/enemies.yaml`
2. Add a new entry (copy from `assets/data/templates/enemy-template.yaml`):

```yaml
- id: skeleton
  name: Skeleton
  stats:
    hp: 40
    strength: 10
    agility: 6
    intelligence: 1
    vitality: 5
    luck: 3
    attack: 12
    defense: 4
    magicDefense: 2
  xpReward: 30
  goldReward: 15
  sprite: skeleton
  weakness: fire
```

3. Add the enemy ID to encounter tables in the relevant map file (`assets/maps/*.yaml`):

```yaml
encounters:
  - enemies: [skeleton]
    weight: 2
  - enemies: [skeleton, skeleton]
    weight: 1
```

4. Run `npm run validate`

### Boss Enemies

Add `bossPhases` for multi-phase boss behavior:

```yaml
- id: lich
  name: Lich
  stats:
    hp: 400
    strength: 20
    agility: 12
    intelligence: 30
    vitality: 15
    luck: 10
    attack: 25
    defense: 15
    magicDefense: 20
  xpReward: 2000
  goldReward: 1500
  sprite: lich
  weakness: fire
  bossPhases:
    - hpThreshold: 0.5
      patternId: aggressive
      message: "The Lich's form shifts!"
```

Then add a scripted encounter in the map file:

```yaml
scriptedEncounters:
  - x: 8
    y: 14
    enemyIds: [lich]
    flag: LICH_DEFEATED
    isBoss: true
    message: "The Lich blocks your path!"
```

---

## Adding a New Item

1. Open `assets/data/items.yaml`
2. Add the item entry. Types: `weapon`, `armor`, `consumable`, `key`

### Weapon

```yaml
- id: mythril_sword
  name: Mythril Sword
  type: weapon
  stats: { attack: 23 }
  price: 4000
  usableBy: [warrior, red_mage]
```

### Armor

```yaml
- id: iron_shield
  name: Iron Shield
  type: armor
  slot: shield          # armor (body, default) | shield | helmet
  stats: { defense: 4 }
  price: 100
  usableBy: [warrior, red_mage]
```

### Consumable

```yaml
- id: ether
  name: Ether
  type: consumable
  stats: {}             # hp: N for healing items, {} for special-effect items
  price: 150
  usableBy: []          # Empty = usable by all
```

### Key Item

```yaml
- id: mystic_key
  name: Mystic Key
  type: key
  stats: {}
  price: 0
  usableBy: []
```

3. If sold in a shop, add the item ID to the shop's `inventory` in `assets/data/shops.yaml`
4. Run `npm run validate`

---

## Adding a New Spell

1. Open `assets/data/spells.yaml`
2. Add the spell entry:

```yaml
- id: fir3
  name: FIR3
  level: 5
  type: black
  effect: damage
  targeting: all
  description: Deal fire damage to all enemies
  power: 60
  element: fire
```

### Spell Fields

| Field | Values | Notes |
|-------|--------|-------|
| `type` | `white`, `black` | Determines which magic shop sells it |
| `level` | 1–8 | Determines charge pool used |
| `effect` | See list below | What the spell does |
| `targeting` | `single`, `all`, `self` | Who it targets |
| `power` | number | Damage/heal amount (0 for buffs/status) |
| `element` | fire, ice, lightning, earth, holy, dark, water, wind, none | For damage calculation |

### Effect Types

| Effect | Description |
|--------|-------------|
| `damage` | Elemental damage (uses power + element) |
| `damage_holy` | Holy damage (for HARM-type spells) |
| `heal` | Restore HP |
| `revive` | Revive fallen ally |
| `status_sleep` | Inflict sleep |
| `status_blind` | Inflict blindness |
| `status_silence` | Inflict silence |
| `status_death` | Instant death |
| `status_poison` | Inflict poison |
| `status_stun` | Inflict stun |
| `buff_defense` | Raise defense |
| `buff_evade` | Raise evasion |
| `buff_attack` | Raise attack |
| `buff_speed` | Raise speed |
| `debuff_evade` | Lower evasion |
| `debuff_speed` | Lower speed |
| `cure_blind` | Cure blindness |
| `resist_lightning` | Grant lightning resistance |

3. Add the spell ID to a magic shop in `assets/data/shops.yaml`
4. Run `npm run validate`

---

## Adding a New Shop

1. Open `assets/data/shops.yaml`
2. Add the shop entry:

```yaml
- id: elfheim_weapon
  type: weapon
  name: Elfheim Weapons
  inventory: [rapier, iron_sword, short_sword]
```

### Shop Types

| Type | Inventory References | Notes |
|------|---------------------|-------|
| `weapon` | Item IDs from items.yaml | Weapons only |
| `armor` | Item IDs from items.yaml | Armor, shields, helmets |
| `item` | Item IDs from items.yaml | Consumables |
| `magic` | Spell IDs from spells.yaml | Spells (learned permanently) |
| `inn` | `[]` (empty) | Requires `innPrice` field |

### Inn

```yaml
- id: elfheim_inn
  type: inn
  name: Elfheim Inn
  inventory: []
  innPrice: 50
```

3. Wire the shop to an NPC in a map file by setting `shopId`:

```yaml
npcs:
  - id: weapon_merchant
    x: 3
    y: 5
    sprite: merchant
    dialog: ["Welcome to my shop!"]
    shopId: elfheim_weapon
```

4. Run `npm run validate`

### Naming Convention

Shop IDs follow the pattern `<town>_<type>`:
- `cornelia_weapon`, `cornelia_armor`, `cornelia_item`
- `cornelia_white`, `cornelia_black`, `cornelia_inn`

---

## Creating a New Map

Maps are hand-authored YAML files in `assets/maps/`. See `assets/data/templates/map-template.yaml` for a complete annotated example.

### Minimal Map

```yaml
id: my-town
width: 10
height: 10
layers:
  - [0]
tilesets: [town]
collision: []
npcs: []
transitions: []
```

### Map Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique kebab-case ID |
| `width` | Yes | Width in tiles |
| `height` | Yes | Height in tiles |
| `layers` | Yes | Tile index arrays |
| `tilesets` | Yes | Tileset asset IDs |
| `collision` | Yes | Terrain type array (can be empty) |
| `npcs` | Yes | NPC list (can be empty) |
| `transitions` | Yes | Map transition list (can be empty) |
| `encounterRate` | No | `{ min, max }` steps between encounters |
| `encounters` | No | Weighted enemy group list |
| `scriptedEncounters` | No | One-time boss/event battles |
| `vehicles` | No | Vehicle spawn points |
| `keyItemGates` | No | Tiles requiring key items |
| `music` | No | Music track ID |
| `canSave` | No | `false` for dungeons (default: true) |

### Terrain Types (collision array)

| Value | Terrain | Walkable (on foot) |
|-------|---------|-------------------|
| 0 | Grass | Yes |
| 1 | Wall | No |
| 2 | Water | No (ship/canoe) |
| 3 | Mountain | No |
| 4 | Forest | Yes (slower) |
| 5 | Desert | Yes |
| 6 | Swamp | Yes |
| 7 | River | No (canoe) |
| 8 | Road | Yes (faster) |
| 9 | Bridge | Yes |

### Connecting Maps

Use `transitions` to link maps. Both maps need matching transitions:

```yaml
# In town.yaml
transitions:
  - x: 0
    y: 5
    targetMap: overworld
    targetX: 20
    targetY: 15

# In overworld.yaml
transitions:
  - x: 20
    y: 15
    targetMap: my-town
    targetX: 9
    targetY: 5
```

### Dungeon Maps

For dungeons, set `canSave: false` and use transitions for stairs between floors:

```yaml
id: earth-cave-b1
canSave: false
music: dungeon
encounterRate:
  min: 10
  max: 20
encounters:
  - enemies: [skeleton, skeleton]
    weight: 3
transitions:
  - x: 8
    y: 0
    targetMap: earth-cave-b2
    targetX: 8
    targetY: 14
```

---

## Naming Conventions

| Content | Convention | Examples |
|---------|-----------|----------|
| Enemy IDs | `snake_case` | `goblin`, `fire_giant`, `dark_elf` |
| Item IDs | `snake_case` | `iron_sword`, `hi_potion`, `mystic_key` |
| Spell IDs | `lowercase` | `cure`, `fir2`, `lit3`, `slep` |
| Shop IDs | `snake_case` | `cornelia_weapon`, `elfheim_inn` |
| Map IDs | `kebab-case` | `test-town`, `earth-cave-b1` |
| Class IDs | `snake_case` | `warrior`, `white_mage`, `red_wizard` |
| Story flags | `UPPER_SNAKE` | `RESCUED_PRINCESS`, `LICH_DEFEATED` |

---

## Running Validation

### Quick validation (standalone script)

```bash
npm run validate
```

Checks all cross-file references and reports errors. Exits 0 on success, 1 on failure.

### Full test suite

```bash
npm test
```

Runs all tests including the cross-file validation suite (`tests/data/crossFileValidation.test.ts`). This catches:

- Shop items/spells that don't exist in data files
- Encounter enemies that don't exist in enemies.yaml
- Item `usableBy` referencing nonexistent classes
- Invalid element or status effect values
- Duplicate IDs within any data file
- `upgradeFrom` referencing nonexistent or non-base classes
- Map transitions targeting nonexistent maps

---

## YAML Gotchas

| Gotcha | Problem | Fix |
|--------|---------|-----|
| Norway problem | `no` parses as `false` | Quote it: `"no"` |
| Boolean coercion | `yes`, `true`, `on` → boolean | Quote strings: `"yes"` |
| Colons in strings | `name: Sword: Fire` breaks | Quote: `name: "Sword: Fire"` |
| Hash in strings | `name: Item #5` breaks | Quote: `name: "Item #5"` |
| Numeric strings | `id: 123` becomes number | Quote: `id: "123"` |
| Empty arrays | `inventory:` becomes `null` | Use `inventory: []` |

### General Tips

- Use comments (`#`) freely to organize sections
- Keep entries sorted by progression tier or level for readability
- Test after every edit: `npm run validate`
- Check the templates in `assets/data/templates/` for annotated examples
