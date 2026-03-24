# FF1-Style NES RPG — Playtest Results & Balance Guide

This document provides a playtesting framework, initial balance analysis, and tuning reference for the game. It is designed to be a living document — update it as you playtest and adjust values.

---

## Table of Contents

- [Playtesting Methodology](#playtesting-methodology)
- [Expected Progression Curve](#expected-progression-curve)
- [Class Viability Analysis](#class-viability-analysis)
- [Known Balance Concerns](#known-balance-concerns)
- [Tuning Levers](#tuning-levers)
- [Playtest Log Template](#playtest-log-template)

---

## Playtesting Methodology

### Recommended Party Compositions

Test at least these four party setups to cover the balance spectrum:

| Party | Members | Tests |
|-------|---------|-------|
| **Balanced** | Warrior, Thief, White Mage, Black Mage | Standard experience — baseline for all tuning |
| **All-Physical** | Warrior, Warrior, Monk, Thief | No healing magic — tests potion economy and inn dependency |
| **All-Magic** | White Mage, Black Mage, Red Mage, Red Mage | Fragile party — tests spell charge sufficiency and defense |
| **Challenge** | Thief, Thief, Thief, Thief | Worst-case — reveals if any class is unviable solo |

### Key Checkpoints

Evaluate the party at each of these milestones:

1. **After Cornelia shops** (Lv 1) — Can you afford starting gear + Lv1 spells?
2. **After Temple of Fiends / Garland** (Lv 3-5) — Was the boss beatable without excessive grinding?
3. **After Elfheim shops** (Lv 8-10) — Is gold sufficient for Lv2-3 spell upgrades?
4. **After Earth Cave / Lich** (Lv 12-15) — Class upgrade milestone. Was Lich fair?
5. **After class upgrade** — Do upgraded classes feel meaningfully stronger?
6. **After each subsequent Fiend** (Lv 18-25) — Difficulty scaling appropriate?
7. **Final boss** (Lv 25-35) — Challenging but beatable with preparation?

### Metrics to Track Per Checkpoint

Record these at each checkpoint:

| Metric | Why It Matters |
|--------|---------------|
| Party level | Are players over/under-leveled for the area? |
| Gold on hand | Can they afford the next tier of gear? |
| HP per character | Can they survive 2-3 hits from area enemies? |
| Spell charges remaining | Are mages running dry before the boss? |
| Potions remaining | Is the party burning through consumables? |
| Deaths in dungeon | 0 = too easy, 3+ = too hard for average play |
| Time played (minutes) | Pacing — is any section dragging? |

---

## Expected Progression Curve

### Level Expectations by Area

Based on encounter rates, enemy XP rewards, and expected fight counts:

| Area | Expected Level | Encounter Rate | Enemies | XP/Fight (avg) |
|------|---------------|----------------|---------|-----------------|
| Cornelia (town) | 1 | None | — | — |
| Overworld (starting) | 1-3 | 20-30 steps | Goblin (10xp), Wolf (12xp) | ~10-22 |
| Temple of Fiends | 3-5 | 8-15 steps | Skeleton (20xp), Pirate (30xp) | ~20-30 |
| Elfheim area | 5-8 | 20-30 steps | Tier 1-2 mix | ~30-60 |
| Marsh Cave / Earth Cave | 8-12 | 8-15 steps (est.) | Ogre (150xp), Troll (120xp) | ~100-150 |
| Gurgu Volcano | 12-18 | 8-15 steps (est.) | Mummy (100xp), Cockatrice (130xp) | ~100-130 |
| Sea Shrine | 18-22 | 8-15 steps (est.) | Vampire (600xp), Tier 3 | ~300-600 |
| Sky Fortress | 22-28 | 8-15 steps (est.) | Dragon (800xp), Tier 3-4 | ~400-800 |
| Temple of Fiends Revisited | 28-35 | 8-15 steps (est.) | Tier 3-4 mix | ~500-800 |

### Gold Economy by Stage

#### Income Sources

| Enemy | Gold/Kill | Typical Fights to Area Boss | Est. Gold Earned |
|-------|-----------|----------------------------|-----------------|
| Goblin | 5 | 15-25 (overworld) | 75-125 |
| Wolf | 3 | 15-25 (overworld) | 45-75 |
| Skeleton | 10 | 20-30 (Temple of Fiends) | 200-300 |
| Pirate | 20 | 20-30 (Temple of Fiends) | 400-600 |
| Garland (boss) | 200 | 1 | 200 |
| Ogre | 80 | 20-30 (mid dungeons) | 1,600-2,400 |
| Troll | 60 | 20-30 (mid dungeons) | 1,200-1,800 |
| Lich (boss) | 1,500 | 1 | 1,500 |

#### Shop Costs by Stage

**Cornelia (available at Lv 1):**

| Category | Items | Cost Range | Total to Fully Equip Party |
|----------|-------|------------|---------------------------|
| Weapons | Rapier (10G), Short Sword (15G), Hammer (10G), Staff (5G) | 5-15G | ~40G for 4 weapons |
| Armor | Leather Armor (50G), Chain Mail (80G), Wooden Shield (15G), Cap (10G) | 10-80G | ~300-400G for 4 sets |
| Spells (Lv1) | CURE, HARM, FOG, RUSE, FIRE, LIT, SLEP, LOCK | Not listed in items | Per magic shop pricing |
| Consumables | Potion (60G), Antidote (75G), Tent (250G) | 60-250G | 5 Potions = 300G |
| Inn | 30G per rest | — | — |

**Estimated gold needed at Cornelia:** ~600-800G for basic gear + potions.
**Estimated gold available before Temple of Fiends:** ~300-600G from overworld fights.
**⚠️ Gap:** Players may need to grind 10-20 extra fights to afford full Cornelia gear. This is intentional for FF1 pacing but should not exceed 15 minutes.

**Elfheim (available at Lv 5-8):**

| Category | Items | Cost Range |
|----------|-------|------------|
| Weapons | Mythril Sword (4,000G), Great Axe (4,500G), Mythril Knife (800G) | 200-4,500G |
| Armor | Iron Armor (800G), Mythril Mail (3,500G), Iron Shield (100G), Iron Helm (100G) | 100-3,500G |
| Consumables | Hi-Potion (150G), Phoenix Down (500G), Cabin (500G) | 150-500G |
| Inn | 100G per rest | — |

**Estimated gold needed at Elfheim:** ~10,000-15,000G for meaningful upgrades.
**Estimated gold from Temple of Fiends + travel:** ~1,000-2,000G.
**⚠️ Gap:** Significant. Players will need mid-game dungeon gold (Ogre 80G, Troll 60G) to afford Elfheim gear. Mythril weapons are aspirational purchases, not immediate buys.

### Spell Charge Availability

Per design doc, charges grow with character level:

| Char Level | Lv1 Charges | Lv2 Charges | Lv3 Charges | Lv4 Charges | Lv5 Charges |
|-----------|-------------|-------------|-------------|-------------|-------------|
| 1 | 2 | 0 | 0 | 0 | 0 |
| 5 | 4 | 2 | 1 | 0 | 0 |
| 10 | 5 | 4 | 3 | 2 | 1 |
| 20 | 7 | 6 | 5 | 5 | 4 |

**Practical impact:**
- At Lv 1, a White Mage has 2 CURE casts (60 HP total healing) for the entire dungeon.
- At Lv 5, a Black Mage has 4 FIRE + 2 ICE casts — enough for ~6 encounters before needing an inn.
- Temple of Fiends has 8-15 step encounter rate. With ~100 tiles to traverse, expect 7-12 fights. A Lv 3 mage with 3 Lv1 charges will run dry before the boss.
- **Key insight:** Spell charges are the primary resource constraint in early dungeons. Potions are the backup.

---

## Class Viability Analysis

Analysis based on actual `classes.yaml` stat values and growth rates.

### Warrior

| Stat | Base | Growth/Lv | Lv 10 | Lv 20 | Role |
|------|------|-----------|-------|-------|------|
| HP | 35 | +6 | 89 | 149 | Tank |
| Strength | 20 | +3 | 47 | 77 | Primary DPS |
| Agility | 5 | +1 | 14 | 24 | Slow |
| Defense | via equipment | — | — | — | Best armor access |

**Strengths:** Highest HP, best equipment selection (swords, axes, hammers, heavy armor, shields). Reliable physical damage dealer. Upgrades to Knight with White Magic Lv1-3 (CURE, FOG, etc.) — adds self-sufficiency.

**Weaknesses:** No magic until upgrade. Slowest class (Agi 5 base, +1/lv). Completely dependent on equipment for damage scaling.

**Verdict:** Always viable. The safest pick for any party.

### Thief

| Stat | Base | Growth/Lv | Lv 10 | Lv 20 | Role |
|------|------|-----------|-------|-------|------|
| HP | 25 | +4 | 61 | 101 | Fragile |
| Strength | 10 | +2 | 28 | 48 | Low |
| Agility | 15 | +3 | 42 | 72 | Fastest |
| Luck | 15 | +2 | 33 | 53 | High crit/flee |

**Strengths:** Fastest class — acts first in combat. High Luck improves flee chance and critical hits. Upgrades to Ninja with Black Magic Lv1-4 (FIRE, ICE, FIR2, FAST, etc.).

**Weaknesses:** Low HP and Strength early. Limited to knives and light swords (max: Mythril Knife at 15 ATK vs. Warrior's Mythril Sword at 23 ATK). Weak until Ninja upgrade.

**Verdict:** Weak early, strong late. The Ninja upgrade is transformative — Black Magic Lv1-4 plus decent physical stats. Consider whether early-game weakness is too punishing.

### Monk

| Stat | Base | Growth/Lv | Lv 10 | Lv 20 | Role |
|------|------|-----------|-------|-------|------|
| HP | 33 | +5 | 78 | 128 | Durable |
| Strength | 15 | +3 | 42 | 72 | High |
| Agility | 8 | +2 | 26 | 46 | Medium |
| Vitality | 10 | +2 | 28 | 48 | Tanky |

**Strengths:** High HP, high Strength growth. Designed to fight bare-fisted at higher levels (Strength-based damage without weapons). Equipment: only nunchaku and light armor — cheap to maintain. Upgrades to Master with even higher Strength growth (+4/lv).

**Weaknesses:** No magic ever. Limited equipment means low Defense. Bare-fist damage formula needs careful tuning — if it scales with Strength alone, Monk becomes the strongest DPS at high levels.

**Verdict:** Potentially the strongest physical class at high levels. See [Known Balance Concerns](#monk-bare-fist-scaling) for tuning notes.

### White Mage

| Stat | Base | Growth/Lv | Lv 10 | Lv 20 | Role |
|------|------|-----------|-------|-------|------|
| HP | 25 | +3 | 52 | 82 | Very fragile |
| Intelligence | 15 | +3 | 42 | 72 | High |
| Strength | 5 | +1 | 14 | 24 | Negligible |

**Strengths:** Only reliable healer. CURE (30 HP) at Lv1, CUR2 (60 HP) at Lv3, CUR3 (120 HP) at Lv5. LIFE (revive) at Lv5. HARM line damages undead. Upgrades to White Wizard with Lv8 access (FADE, WALL, NUKE).

**Weaknesses:** Lowest HP, lowest physical damage. Limited to staves and hammers. Completely useless for physical attacks. If the White Mage dies, the party is in serious trouble.

**Verdict:** Essential in any serious party. The question is not "is White Mage viable?" but "can you survive without one?"

### Black Mage

| Stat | Base | Growth/Lv | Lv 10 | Lv 20 | Role |
|------|------|-----------|-------|-------|------|
| HP | 25 | +3 | 52 | 82 | Very fragile |
| Intelligence | 15 | +3 | 42 | 72 | High |
| Strength | 5 | +1 | 14 | 24 | Negligible |

**Strengths:** Highest damage output per action via spells. FIRE/LIT (20 power) at Lv1, FIR2/LIT2 (30 power, all enemies) at Lv3, ICE2 (40 power, all enemies) at Lv4. Elemental targeting exploits weaknesses for 2x damage. Upgrades to Black Wizard with Lv8 access (STOP, ZAP!, XXXX, NUKE).

**Weaknesses:** Same fragility as White Mage. Spell charges are finite — once out, the Black Mage is dead weight. Identical stat line to White Mage (HP 25, Str 5, Int 15).

**Verdict:** Extremely powerful in short fights. Charge management is the skill ceiling. AoE spells (FIR2, LIT2, ICE2) are the best way to clear random encounters quickly.

### Red Mage

| Stat | Base | Growth/Lv | Lv 10 | Lv 20 | Role |
|------|------|-----------|-------|-------|------|
| HP | 30 | +4 | 66 | 106 | Medium |
| Strength | 10 | +2 | 28 | 48 | Medium |
| Intelligence | 10 | +2 | 28 | 48 | Medium |
| Agility | 10 | +2 | 28 | 48 | Medium |

**Strengths:** Most versatile class. Can equip swords and medium armor. Has both White and Black magic (Lv1-5 base, Lv1-7 as Red Wizard). Can heal, deal magic damage, and fight physically. Jack of all trades.

**Weaknesses:** Master of none. Spell access caps at Lv5 (base) / Lv7 (upgraded) — never gets Lv8 spells. Lower Intelligence than dedicated mages (10 vs. 15 base, +2 vs. +3 growth). Physical stats lag behind Warrior/Monk. Medium armor means less defense than Warrior.

**Verdict:** Strong early-to-mid game when versatility matters most. Falls off late game when dedicated classes outperform in their roles. See [Known Balance Concerns](#red-mage-late-game-falloff).

---

## Known Balance Concerns

### Monk Bare-Fist Scaling

**Issue:** Monk's Strength growth (+3/lv base, +4/lv as Master) combined with bare-fist damage could make Monk the highest DPS class at high levels, surpassing even equipped Warriors.

**Current numbers:**
- Monk Lv 20 Strength: 72 (base 15 + 3×19 = 72)
- Master Lv 20 Strength: 76+ (higher growth after upgrade)
- Warrior Lv 20 Strength: 77 (base 20 + 3×19 = 77) + weapon ATK (Mythril Sword 23 = effective 100)

**Risk:** If bare-fist damage = Strength × 2 (common FF1 formula), Monk at Lv 20 deals 144 damage vs. Warrior's ~100. Monk becomes strictly better.

**Tuning options:**
- Cap bare-fist multiplier (e.g., Strength × 1.5)
- Give Warriors access to stronger late-game weapons to maintain parity
- Reduce Monk/Master Strength growth by 1

### Red Mage Late-Game Falloff

**Issue:** Red Mage's spell access caps at Lv5 (base) / Lv7 (upgraded). By the time the party reaches Lv 20+, dedicated mages have Lv6-8 spells while Red Mage is stuck with Lv5 max power.

**Current numbers:**
- Red Mage Intelligence at Lv 20: 48 (base 10 + 2×19)
- Black Mage Intelligence at Lv 20: 72 (base 15 + 3×19)
- Red Mage best damage spell: ICE2 (Lv4, power 40)
- Black Mage best damage spell: Lv7-8 spells (power 60-80+, when implemented)

**Risk:** Red Mage becomes a worse Warrior who can cast weak heals. Not useless, but feels bad compared to dedicated classes.

**Tuning options:**
- Increase Red Wizard spell access to Lv7/Lv7 (already done in `classes.yaml`)
- Give Red Mage unique equipment (e.g., Coral Sword at 26 ATK with lightning element)
- Accept the tradeoff — Red Mage's value is early-game flexibility

### Early-Game Economy

**Issue:** Starting gold is 0. Cornelia gear costs ~600-800G for a full party. Overworld enemies drop 3-20G per fight.

**Current numbers:**
- Potion: 60G (heals 30 HP — roughly 1 hit from a Goblin)
- Inn: 30G (full heal — much better value than Potions)
- Goblin: 5G, Wolf: 3G per kill
- To earn 600G from Goblins alone: 120 fights

**Risk:** 120 fights is excessive grinding. Players may feel stuck before the first dungeon.

**Tuning options:**
- Increase Tier 1 enemy gold drops (Goblin 5→15, Wolf 3→10)
- Give party starting gold (100-200G)
- Reduce Cornelia weapon prices (they're already cheap at 5-15G)
- Reduce Potion price (60→40G)

### Spell Charge Scarcity in Dungeons

**Issue:** Temple of Fiends has 8-15 step encounter rate. With ~100+ traversable tiles, expect 7-12 random encounters plus the Garland boss. A Lv 3 mage has only 3 Lv1 charges.

**Risk:** Mages become useless for the boss fight because they spent all charges on random encounters.

**Tuning options:**
- Increase early spell charges (Lv 3: 3→4 Lv1 charges)
- Reduce Temple of Fiends encounter rate (min 8→12)
- Add Ether to Cornelia item shop (currently not sold there)
- Place a free healing point or Tent in the dungeon

### Boss HP Relative to Party DPS

**Issue:** Garland has 200 HP. A Lv 3-5 party deals roughly:
- Warrior: ~15-20 damage/turn (weapon ATK 9-10 + Strength ~26)
- Black Mage FIRE: ~20 base + elemental bonus (Garland weak to lightning, not fire)
- Black Mage LIT: ~20 × 2 = 40 (weakness hit!)

**Estimate:** 200 HP / ~60 party DPS per round = ~3-4 rounds. This feels about right for a first boss — tense but not a slog.

**Lich has 800 HP** with fire weakness. At Lv 12-15:
- Warrior: ~40-50 damage/turn
- Black Mage FIR2: 30 power × 2 (weakness) × Int modifier = ~80-100 damage
- Party DPS: ~150-200/round → 4-5 rounds. Reasonable for a major boss.

---

## Tuning Levers

Quick reference for what to change and where.

### Per-Class Tuning — `assets/data/classes.yaml`

| Field | Effect | Example |
|-------|--------|---------|
| `baseStats.hp` | Starting HP | Increase for tankier class |
| `statGrowth.hp` | HP per level | +1 growth = +49 HP by Lv 50 |
| `statGrowth.strength` | Physical damage scaling | +1 growth = +49 Str by Lv 50 |
| `statGrowth.intelligence` | Magic damage scaling | Affects spell damage formula |
| `statGrowth.agility` | Turn order priority | Higher = acts first |
| `spellLevels` | Max spell tier accessible | `{ white: 5, black: 5 }` for Red Mage |
| `usableEquipment` | Gear access | Add/remove weapon/armor types |

### Per-Enemy Tuning — `assets/data/enemies.yaml`

| Field | Effect | Example |
|-------|--------|---------|
| `stats.hp` | Fight duration | Lower = faster fights |
| `stats.attack` | Damage to party | Higher = more dangerous |
| `stats.defense` | Damage reduction | Higher = longer fights |
| `xpReward` | Leveling speed | Higher = faster progression |
| `goldReward` | Economy pacing | Higher = richer players |
| `weakness` | Elemental vulnerability | 2x damage from that element |
| `bossPhases[].hpThreshold` | Phase transition point | 0.5 = at 50% HP |

### Item & Equipment Tuning — `assets/data/items.yaml`

| Field | Effect | Example |
|-------|--------|---------|
| `stats.attack` | Weapon power | Higher = more physical damage |
| `stats.defense` | Armor protection | Higher = less damage taken |
| `price` | Economy gate | Higher = later acquisition |
| `stats.hp` (consumable) | Healing amount | Potion: 30 HP |

### Spell Tuning — `assets/data/spells.yaml`

| Field | Effect | Example |
|-------|--------|---------|
| `power` | Spell damage/healing | CURE: 30, FIR2: 30 |
| `element` | Elemental type | Interacts with enemy weakness/resist |
| `targeting` | Single vs. all | `all` = AoE, `single` = focused |

### Encounter Rate Tuning — Map YAML files

| Field | Effect | Current Values |
|-------|--------|---------------|
| `encounterRate.min` | Minimum steps between fights | Overworld: 20, Temple: 8 |
| `encounterRate.max` | Maximum steps between fights | Overworld: 30, Temple: 15 |
| `encounters[].weight` | Relative frequency of enemy group | Higher weight = more common |

### Shop Inventory Tuning — `assets/data/shops.yaml`

| Field | Effect | Example |
|-------|--------|---------|
| `inventory` | What's available to buy | Add/remove item/spell IDs |
| `innPrice` | Cost to rest | Cornelia: 30G, Elfheim: 100G |

---

## Playtest Log Template

Copy this template for each playtest session:

```markdown
## Playtest: [Date] — [Party Composition]

**Party:** [Class 1], [Class 2], [Class 3], [Class 4]

### Checkpoint: [Area Name]
- **Level:** [avg party level]
- **Gold:** [current gold]
- **HP:** [char1 current/max], [char2], [char3], [char4]
- **Spell charges remaining:** [Lv1: X/Y, Lv2: X/Y, ...]
- **Potions remaining:** [count]
- **Deaths this section:** [count]
- **Time played:** [minutes]
- **Notes:** [observations, frustrations, highlights]

### Boss: [Boss Name]
- **Party level at fight:** [level]
- **Rounds to win:** [count]
- **Deaths during fight:** [count]
- **Spell charges used:** [count]
- **Potions used:** [count]
- **Difficulty rating:** [1=trivial, 5=fair, 10=impossible]
- **Notes:** [strategy used, what felt off]

### Balance Observations
- [ ] Gold felt: too scarce / about right / too abundant
- [ ] Leveling felt: too slow / about right / too fast
- [ ] Random encounters felt: too frequent / about right / too rare
- [ ] Boss difficulty felt: too easy / about right / too hard
- [ ] Spell charges felt: too scarce / about right / too abundant

### Suggested Changes
- [specific change with reasoning]
```

---

## Appendix: Data Quick Reference

### Current Enemy Stats Summary

| Enemy | Tier | HP | ATK | DEF | XP | Gold | Weakness |
|-------|------|-----|-----|-----|-----|------|----------|
| Goblin | 1 | 20 | 8 | 2 | 10 | 5 | Fire |
| Wolf | 1 | 15 | 10 | 1 | 12 | 3 | Fire |
| Skeleton | 1 | 30 | 12 | 6 | 20 | 10 | Fire |
| Pirate | 1 | 40 | 14 | 4 | 30 | 20 | Lightning |
| Ogre | 2 | 120 | 28 | 10 | 150 | 80 | Lightning |
| Troll | 2 | 100 | 24 | 8 | 120 | 60 | Fire |
| Mummy | 2 | 80 | 20 | 12 | 100 | 50 | Fire |
| Cockatrice | 2 | 90 | 18 | 6 | 130 | 70 | Ice |
| Vampire | 3 | 280 | 36 | 18 | 600 | 300 | Fire |
| Dragon | 3 | 400 | 45 | 22 | 800 | 500 | Ice |
| Garland | Boss | 200 | 20 | 10 | 250 | 200 | Lightning |
| Lich | Boss | 800 | 25 | 15 | 2,000 | 1,500 | Fire |

### Current Weapon Progression

| Weapon | ATK | Price | Stage |
|--------|-----|-------|-------|
| Small Knife | 5 | 5G | Starter |
| Staff | 6 | 5G | Starter |
| Rapier | 9 | 10G | Cornelia |
| Short Sword | 10 | 15G | Cornelia |
| Wooden Nunchaku | 12 | 10G | Cornelia (Monk) |
| Iron Sword | 14 | 175G | Melmond |
| Hand Axe | 16 | 550G | Melmond |
| Iron Nunchaku | 16 | 200G | Elfheim (Monk) |
| Mythril Knife | 15 | 800G | Elfheim |
| Mythril Hammer | 18 | 2,500G | Elfheim |
| Great Axe | 22 | 4,500G | Elfheim |
| Mythril Sword | 23 | 4,000G | Elfheim |
| Flame/Ice/Coral Sword | 26 | 10,000G | Late shops |
| Masamune | 56 | Found | Endgame |

### Current Armor Progression

| Armor | DEF | Price | Stage |
|-------|-----|-------|-------|
| Cloth | 1 | 10G | Starter |
| Cap | 1 | 10G | Cornelia |
| Robe | 2 | 20G | Starter (mages) |
| Wooden Shield | 2 | 15G | Cornelia |
| Leather Armor | 4 | 50G | Cornelia |
| Iron Helm | 3 | 100G | Elfheim |
| Iron Shield | 4 | 100G | Elfheim |
| Chain Mail | 15 | 80G | Cornelia |
| Mythril Mail | 18 | 3,500G | Elfheim |
| Iron Armor | 24 | 800G | Elfheim |
| Mythril Shield | 8 | 2,500G | Elfheim |
| Mythril Helm | 6 | 2,500G | Elfheim |
| Mythril Armor | 34 | 7,500G | Elfheim |
| Dragon Armor | 42 | Found | Endgame |
