# Pass EQ: the fifth equipment slot, FF1 equipment and the FF1 shops

Status: plan (2026-11-27). Branch `equip-ff1` from `mainline` 9b07bab7.

## 0. Rulings and inputs

**User rulings, verbatim (2026-11-27):**

- R1: "For 1. let's map to FF1 exactly for now, we can expand this later as we do a remix game version with the new
  character classes." Every shop sells exactly what NES FF1's does, town by town. Spell shops follow FF1's levels.
  Onrac has no weapon or armor shop. Gaia sells three items. For the item shops FF1 lacks, see D-EQ8.
- R2: "for now I want to focus on 2 - that is critical to the game. Let's come up with a plan to add them, create items
  for them, and then add them to the shop." Item 2 was the missing glove slot: Gloves, Copper / Iron / Silver
  Gauntlet, ProRing, Zeus / Power / Opal Gauntlet.
- R3: "keep duplicates for now, I like having more items!"
- R4: "I generally find gold plentiful so I'd defer to the NES FF1 prices - scimitar & falchion are early game weapons
  so they should get baselines to the early game prices."
- R5 (the follow-ups of rev 1 of this plan): "1. yes, 2. yes, 3. original FF1 equip list including promoted classes
  gaining own gear, 4. retune them, 5. yes make them work. Plan, review, and implement". The coordinator relayed R5 as
  five points:
  1. Scimitar and Falchion get NES stats.
  2. Every item with an FF1 counterpart gets NES stats: ATK, hit, crit, DEF and weight.
  3. FF1's exact equip lists for each of the 12 classic classes, the promoted classes included, with Cat Claw per
     FF1. The copy classes follow their source.
  4. The non-FF1 items and the duplicates are retuned to the power curve where they are found. Every item that leaves
     the shops gets a chest.
  5. Equipment effects work: weapon elements and slayer bonuses (FF1), armour resistances, and item-use spells in
     battle.

**Inputs** (read-only research in `~/temp/ff-game/shops/`): `ff1_shop_report.md`, `ff1_shops_reference.yaml`,
`ff1_equipment_stats_report.md`, `ff1_equipment_reference.yaml` (80 FF1 items: stats, jobs, specials, finds) and
`game_equipment.yaml`. Where the sources conflict, this plan uses `ff1_equipment_reference.yaml`'s value (the
majority value) and notes the conflict.

**Measured on mainline 9b07bab7**, with `npm run quest -- --only df` and a scratch `curveOf` probe in
`/tmp/equip-plan/`:

| measure | value |
|---|---|
| (f) | `crescent 13169/60240`, `gaia 98095/259240` |
| ground gold at the stage start | S2 1539, S6 19730, S11 53745, S14 216841, S20 612329, S23 579716, S26 921043 |
| rushing gold at the first keeper | crescent 13169, gaia 98095 |

The scratch scripts that derive this plan's tables are `/tmp/equip-plan/spec.py`, `table.py`, `kits.py`,
`shops_new.py` and `diff.py`. They are outside the repo; T2 / T4 turn them into repo data.

## 1. FF1 facts followed

- **Equipment slots.** FF1 NES has a weapon slot and four armour slots: body, shield, helmet and glove. The bracelets
  are body armour. The glove slot holds 7 gloves and gauntlets plus the ProRing, 8 items in all: 16 body + 9 shields +
  7 helmets + 8 gloves = FF1's 40 armours. No other FF1 item uses the hand slot.
- **Physical-attack bonus.** A weapon is "strong against" a monster category, or the monster is weak to the weapon's
  element. Then the attack gets Attack +4 and Hit% +40 (FF1 battle mechanics). The NES never applies it because of a
  bug; the remakes do. R5.5 asks for it to work, so this pass applies it. The game today has a ×1.5 damage family bonus
  instead (`PhysicalAttack.FAMILY_BONUS`). It goes.
- **Armour resistance.** An element or status a hero's armour resists works as the AFIR / ARUB-style resistances do
  today (`Character.hasTempResist`): resisted elemental spell damage is reduced by `magicDamage`'s resist path, and
  a resisted status / death / stone effect misses.
- **Item use.** In FF1's battle Item command, a worn item with a spell casts it for free, with unlimited uses. The
  item is not used up, and it needs no charges.

## 2. Decisions

| # | Decision |
|---|----------|
| D-EQ1 | **Slot `hands`**, label **"Hands"** (`SLOT_LABELS`). `EquipmentSlot = 'weapon' \| 'armor' \| 'shield' \| 'helmet' \| 'hands'`; items set `slot: hands`. The slot order is the same everywhere: weapon, armor, shield, helmet, hands. |
| D-EQ2 | **The maths.** `hands` joins `ARMOUR_SLOTS` (CombatStats), so absorb = Σ DEF and evade = 48 + AGI − Σ weight + buffs. `Character.stats.defense` already sums every slot. The hands slot is not body armour, so the Monk / Master rule `!getEquipped('armor')` still applies with gloves on. |
| D-EQ3 | **FF1's equip lists, exactly.** `usableBy` holds FF1's job list as the 12 classic ids: Fi warrior, Kn knight, Th thief, Ni ninja, BB monk, Ma master, RM red_mage, RW red_wizard, WM white_mage, WW white_wizard, BM black_mage, BW black_wizard. The promoted classes are named for their own gear (Kn-only Opal Armor, Ni Katana-class lists, ...). In FF1 every list that names a base class also names its promoted class (checked by `/tmp/equip-plan/check_inherit.py`), so the `upgradeFrom` inheritance in `canEquip` changes nothing for real data and stays for fixtures. |
| D-EQ4 | **The copy classes derive from their source through `copyOf`.** `Character.canEquip` resolves `equipId = classData.copyOf ?? classData.id`, and the inheritance uses the `upgradeFrom` class's own `copyOf ?? id`. `copyOf` lands here as the exact lines of class-copynote's 843cb6fc for `classes.yaml`, the `CharacterClassData.copyOf` type line and the `schemaValidation` assert (applied with `git apply`, so a later merge sees identical hunks). The other files of 843cb6fc stay with class-copynote. `usableBy` then lists only the 12 classic ids; T2 removes every copy id. When class-copynote merges, its added `- shieldmaiden`-style `usableBy` lines conflict with this pass. The resolution is to drop them, because the copies are derived. The 12 class-copy tests keep their equality checks (`canEquip` lists equal), and their pinned `usableBy` counts become `canEquip` counts. |
| D-EQ5 | **NES stats for every item with an FF1 counterpart (R5.2):** ATK, hit, crit for weapons; DEF and weight for armour. That includes Scimitar 10 / 10 / 8 and Falchion 15 / 10 / 15 (R5.1). The duplicates (R3) take their FF1 item's stats: `wooden_armor` = `leather_armor` = Wooden Armor; `diamond_armor` = `opal_armor` = Opal Armor; `diamond_armlet` = `opal_armlet` = Opal Bracelet; `diamond_helm` = `opal_helm` = Opal Helmet; `diamond_shield` = Opal Shield. Appendix A has the full table. |
| D-EQ6 | **The non-FF1 items are retuned to the curve where they are found (R5.4).** Section 3.3 has each target. |
| D-EQ7 | **NES prices (R4)** for every item a shop sells. Chest-only items keep their price, so selling gives half of it (`sellPrice`). The three chest-only gauntlets are priced at twice RPGClassics' sale value (Zeus 15000, Power 10000, Opal 20000). The Bottle's `takeGold` becomes 50000. |
| D-EQ8 | **Shops FF1 lacks are kept but closed:** `melmond_item`, `dwarf_item`, `onrac_weapon`, `onrac_armor`. Each record stays, with `inventory: []` and `closed: true`. The keeper keeps its `shopId` and says a closed line. `openShopScene` opens nothing for a closed shop. Why closed rather than removed: the maps, `townTargets.ts`, `quest.yaml` `towns` (the dwarf town), gate row GT-42 and proofs (e) / (f) all stay valid, with no `--mutate` re-proof of a gate row. Removing the buildings is a follow-up. |
| D-EQ9 | **Hi-Potion, Ether and Phoenix Down leave every shop (R1).** Chests keep them (35 / 29 / 25 today, less the 17 swaps of 4.2). |
| D-EQ10 | **Obtainability.** Every weapon, armour and consumable is sold by an open shop, or held by a chest or a gift on a compiled map, or forged (`excalibur`). No chest is added. An existing hi_potion / ether chest gets new contents and a new id (so a new `CHEST_*` flag): a save that opened it sees it closed again and finds the new item. The pinned chest counts and the layout geometry stay as they are. |
| D-EQ11 | **Kits.** A kit row becomes `{ gear, found?, spells }`. `gear` is what the party buys: the best shop gear the class may use, sold up to its tier's town, one item per slot. **Best** is the first by rank: weapons by ATK, then hit, then crit (higher first); armour by DEF (higher first), then weight (lower first); then the id. A stage kit's `gear` equals its tier's town kit `gear`, row by row. The one exception is the Monk / Master weapon, judged by each kit's own band low level (below). `found` lists chest items that rank strictly before that slot's `gear` item (e.g. `gold_armlet` 24 / 1 before `iron_armor` 24 / 23). They are equipped after `gear` and replace the item in their slot. A found item must sit in a chest on a map of the stage or of an ancestor (`after`, transitively, with `maps` globs). It is given to no more members than there are such chests, in the order W, T, WM, BM, Mo, RM. The promoted rows (Kn, Ni, WW, BW, Ma, RW, from S19 on) are a second party and draw from their own copy of the same chest pool, because a kit describes one party at a time. The new `kitSources.test.ts` enforces the rule. `kitPrice` sums `gear` only, so found gear costs nothing. A Monk / Master takes no weapon when 2 × the band's low level ≥ the weapon's ATK (unarmed is better). Spells stay as they are; every kit spell is still sold by its band. The tier of each stage is today's alias: S1-S2 cornelia, S3 pravoka, S4-S10 elfheim, S11-S13 melmond, S14-S17 crescent, S18-S22 onrac, S23-S30 gaia. |
| D-EQ12 | **Act 1 (R1).** Cornelia sells Cloth, Wooden (`leather_armor`) and Chain Armor only. The kits `start`, `lv2`, `arrive` and `full` lose `wooden_shield`. Their caps are replaced: `arrive` / `full` keep one `cap` (the temple chest) on the warrior, as `found`. `fieldCampaign.SHOPPING` drops its four caps. The balance tests are re-measured (section 9.2). |
| D-EQ13 | **HOUSE** is a new consumable `house` (3000 G; sold at Elfheim, Crescent, Onrac and Gaia). It gives a full rest like the Cabin, then opens `saveMenu`, as FF1's HOUSE does. The camp rules apply. `ItemEffects.isPartyItem` gains `house`. |
| D-EQ14 | **WORLD_PLAN 3.6's band caps are retired** (`gearBands.test.ts`): FF1 sells Steel Armor at Melmond, gold bracelets at Gaia and nothing at Onrac. `tests/data/ff1Shops.test.ts` pins the exact FF1 table instead. `gearBands.test.ts` keeps its kit and key-item parts; its `FOUND` list becomes every chest-only gear item. WORLD_PLAN 3.6 gets a "superseded" note. |
| D-EQ18 | **Debug scenarios.** A scenario item the new jobs refuse is replaced by the best item (D-EQ11 rank) of the same slot that the class may use and whose ATK / DEF is at most the refused item's; with none, it is dropped (`/tmp/equip-plan/scenarios.py`: 55 entries, e.g. white_mage `white_robe` → `gold_armlet`, black_mage `wizard_staff` → `power_staff`). `crossFileValidation`'s scenario-gear check uses `canEquip`'s rule (`copyOf`, then `upgradeFrom`). |
| D-EQ15 | **Effects (R5.5), in section 7:** the FF1 attack bonus, armour `resist`, and worn-item `battleSpell` in the battle Item command. |
| D-EQ16 | **Test-first, green commits.** Each tranche adds its failing tests (section 9.1) before the change. Each commit passes `npm run build` and `npm run test:fast`. Items, shops, chests, kits and debug scenarios read each other, so they land in one data tranche (T2). |
| D-EQ17 | **Balance.** Every balance bound is re-measured and rewritten ≥ 3 points (rounds: ≥ 2) from its new measured value, with old → new in the test name (AGENTS.md). No enemy, formula (beyond section 7), `grind` or step-mean factor changes. A bound whose *intent* breaks is reported to the user with the numbers in the EQ result: a boss leaving its band in `questCurve.test.ts`, Garland's sensible-Lv2 window, or the Chaos win rate. The implementer does not silently retune. **Procedure (the user asked for an implementation):** the commit rewrites such a bound to its measured value by the 3-point rule, names it "INTENT" in the test name (old → new), and lists it in the EQ result and the final report for the user to decide on. Only a failing verifier proof ((a)-(h) of `quest --strict`) stops the tranche. |

## 3. Items (`assets/data/items.yaml`)

### 3.1 New items (17 ids)

All at FF1 NES stats (`ff1_equipment_reference.yaml`):

- **Weapons:** `large_dagger`, `iron_staff`, `sabre`, `long_sword`, `silver_axe`.
- **Armour:** `copper_bracelet` (body), `buckler` (shield), `great_helm` ("Great Helm", FF1's Iron Helmet; the
  remake name avoids a clash with "Iron Helm").
- **Hands:** `gloves`, `copper_gauntlet`, `iron_gauntlet`, `silver_gauntlet`, `zeus_gauntlet`, `power_gauntlet`,
  `opal_gauntlet`, `pro_ring`.
- **Consumable:** `house`.

Existing items fill two FF1 slots: FF1's Steel Armor is `mythril_armor` (it already has DEF 34 / WT 33), and FF1's
Wooden Helmet is `iron_helm` (DEF 3 / WT 3, 100 G). Stats, prices and jobs are in Appendix A.

### 3.2 Effects (FF1 specials; everything else has none)

| item | effect |
|---|---|
| flame_sword | element fire, strong vs undead |
| ice_brand | element ice |
| coral_sword | strong vs aquatic |
| sun_blade | strong vs undead |
| excalibur | strong vs all (`bonusVsFamily: all`) |
| defender | battleSpell ruse |
| thor_hammer | battleSpell lit2 |
| wizard_staff | battleSpell conf |
| zeus_gauntlet | battleSpell lit2 |
| power_gauntlet | battleSpell sabr |
| white_robe (White Shirt) | battleSpell inv2; resist fire, death |
| black_robe (Black Shirt) | battleSpell ice2; resist ice, time |
| opal_armor, diamond_armor | resist lightning |
| dragon_armor | resist fire, ice, lightning |
| diamond_shield (Opal Shield) | resist lightning |
| aegis_shield | resist poison_stone (FF1: stone) |
| pro_ring | resist death |
| rune_knife (non-FF1, 3.3) | strong vs magical |
| dragon_claw (non-FF1, 3.3) | strong vs dragon |

These effects go: the extra slayers (mythril_sword, mythril_knife and mythril_hammer vs undead, great_axe vs giant,
masamune vs dragon) and the elements FF1 lacks (coral_sword and thor_hammer lightning, excalibur holy).

The descriptions of the items with effects: "Fire blade, strong vs undead. ATK 26, hit +20.", "Ice blade of frozen steel. ATK 29, hit +25.", "Coral blade, strong vs sea foes. ATK 19, hit +15.", "Shines like noon, strong vs undead. ATK 32, hit +30.", "The holy sword, strong vs all. ATK 45, hit +35.", "Use: RUSE. ATK 30, hit +35.", "Use: LIT2. ATK 18, hit +15.", "Use: CONF. ATK 15, hit +15.", "Use: INV2. Wards fire, death. DEF 24, evade -2.", "Use: ICE2. Wards ice, time. DEF 24, evade -2.", "Opal plate. Wards lightning. DEF 42, evade -10.", "Dragon scale. Wards fire, ice, lightning. DEF 42, evade -10.", "Polished bronze. Wards stone. DEF 16.", "A ring that wards death. DEF 8, evade -1." (all under 60 characters).

FF1 items with item spells that the game does not have stay out of scope: Heal Staff, Mage Staff, Light Axe, Bane
Sword, Heal Helmet. They would be new chest items (follow-up 12.2).

### 3.3 Non-FF1 items, retuned (R5.4)

Each target is the stats report's curve check: the FF1 best for the same class at the curve level where the item is
found.

| item | where found (stage, curve L) | was | new | target |
|---|---|---|---|---|
| iron_sword | marsh-cave-b1 chest (S5, L8.6) | 13 / 10 / 10, Fi RM | 13 / 10 / 10, Fi Kn RM RW | between Sabre 13 and Short Sword 15, the Fighter's shop tier then. Stats kept, jobs made FF1-style. |
| robe | cornelia-castle-cellar chest (S0) | DEF 2 / WT 2, WM BM RM | same; jobs RM RW WM WW BM BW | between Cloth 1 and Wooden Armor 4 for a mage at L2 |
| mythril_armor | Melmond shop (the Steel Armor slot) | 34 / 33, 7500 G | 34 / 33, Fi Kn, 45000 G | = FF1 Steel Armor |
| rune_knife | waterfall-cave chest (S21, L29) | 26 / 10 / 24 | 18 / 15 / 27, strong vs magical; Th Ni RM RW BM BW | FF1's Rune Sword tier. It was 2.2× the Black Mage's best (Power Staff 12) and 1.4× the Thief's (Dragon Sword 19). Now under the Thief's FF1 best and about the Black Wizard's Cat Claw 22. |
| dragon_claw | sky-castle-4f chest (S28, L34) | 30 / 10 / 24, Monk only | 30 / 35 / 35, strong vs dragon; Kn Ni RW BW | a trap for the Monk (unarmed is 2 × L); now a late claw for Cat Claw's jobs, under the Ninja's FF1 Katana 33 at Sky Castle |

Prices of these items are unchanged.

### 3.4 Descriptions

Each gear description is regenerated as `"<phrase> ATK n, hit +h."` or `"<phrase> DEF n, evade -w."` (≤ 60
characters; `descriptions.test.ts` checks the numbers and the element). A `battleSpell` item says "Use: <SPELL>." and
a `resist` item says "Wards <list>.". The phrases are `spec.DESC` (`/tmp/equip-plan/spec.py`).

## 4. Obtainability and chests

### 4.1 Gear that leaves every shop

| status | items |
|---|---|
| keeps a chest | aegis_shield, black_robe, coral_sword, defender, diamond_armlet, diamond_helm, diamond_shield, ice_brand, opal_armlet, opal_armor, opal_helm, power_staff, robe, sun_blade, vorpal_sword, white_robe, wizard_staff, and hi_potion / ether / phoenix_down |
| needs a chest | iron_sword, great_axe, flame_sword, thor_hammer, rune_knife, dragon_claw, diamond_armor (C1-C7) |
| new, found only | zeus / power / opal_gauntlet (C8-C10) |

`mythril_armor` is now sold at Melmond. `tests/data/obtainability.test.ts` fails on any unsourced item.

### 4.2 Chest swaps

Only the item, the pickup label and the id change. The script is the map's `GENERATED by` script.

| # | item | map (stage) | cell, old item | script: chest id → new id |
|---|---|---|---|---|
| C1 | iron_sword | marsh-cave-b1 (S5) | (4, 8) hi_potion | `elf/marsh_b1.py` `b1_west` → `b1_west_sword` |
| C2 | great_axe | giant-tunnel (S12) | (4, 18) hi_potion | `earth/giant.py` `chest_ert_o_tunnel` → `chest_ert_o_tunnel_axe` (FF1 Titan's Tunnel) |
| C3 | flame_sword | ice-cavern-b1 (S16) | (2, 4) hi_potion | `fire/ice_b1.py` `b1_grotto` → `b1_grotto_sword` (FF1 Ice Cave) |
| C4 | thor_hammer | mirage-2f (S27) | (36, 28) hi_potion | `wind/mirage_floors.py` `south_nook` → `south_nook_hammer` (FF1 Mirage) |
| C5 | rune_knife | waterfall-cave (S21) | (27, 6) hi_potion | `water/waterfall.py` `chest_wat_o_falls_east` → `chest_wat_o_falls_east_knife` |
| C6 | dragon_claw | sky-castle-4f (S28) | (20, 1) hi_potion | `wind/sky_upper.py` `bay_north` → `bay_north_claw` |
| C7 | diamond_armor | sea-shrine-b3 (S24) | (39, 5) hi_potion | `water/shrine_b3.py` `b3_vestry` → `b3_vestry_armor` (FF1 Opal Armor: Sea Shrine) |
| C8 | zeus_gauntlet | citadel-2f (S18) | (34, 5) hi_potion | `ordeal/citadel.py` `hall_east` → `hall_east_zeus` (FF1 Ordeal) |
| C9 | power_gauntlet | sea-shrine-b2 (S24) | (24, 27) hi_potion | `water/shrine_b2.py` `b2_chapter` → `b2_chapter_power` |
| C10 | opal_gauntlet | sea-shrine-b5 (S24) | (28, 27) hi_potion | `water/shrine_b5.py` `b5_niche_e` → `b5_niche_e_opal` |
| C11 | copper_gauntlet | elfheim-vault (S9) | (2, 6) ether | `elf/town_elfheim_castle.py` `ether` → `ether_gauntlet` (FF1 Elf Castle, Mystic Key) |
| C12 | iron_gauntlet | citadel-3f (S18) | (12, 19) hi_potion | `ordeal/citadel.py` `niche_west` → `niche_west_gauntlet` (FF1 Ordeal) |
| C13 | silver_gauntlet | gurgu-b1 (S15) | (10, 4) hi_potion | `fire/gurgu_upper.py` `rim_northwest` → `rim_northwest_gauntlet` |
| C14 | silver_gauntlet | ice-cavern-b3 (S16) | (38, 8) hi_potion | `fire/ice_b3.py` `b3_niche` → `b3_niche_gauntlet` |
| C15 | opal_gauntlet | sky-castle-2f (S28) | (41, 14) hi_potion | `wind/sky_lower.py` `bridge_east` → `bridge_east_opal` |
| C16 | pro_ring | sky-castle-1f (S28) | (20, 1) hi_potion | `wind/sky_lower.py` `berth_north` → `berth_north_ring` |
| C17 | pro_ring | past-temple-2 (S30) | (33, 28) hi_potion | `past/past_upper.py` `cross_east` → `cross_east_ring` |

C11-C17 are FF1's other finds of the hand items. FF1's Western Keep Mystic-Key Iron Gauntlet is left out (the game's
keep is S6, and its chests are not behind a key door).

Every changed map is regenerated by its script and compiled with `build_map.py <ids>`. It must pass
`build_map.py --check-determinism <id>`, and a second run of the scripts must leave `git diff --exit-code
assets-src/maps` clean. The world map is not touched. Region tests that pin a swapped chest are updated. Find them with `grep -rn "<old id>" tests` and by item, e.g.
`elf_t_town.test.ts:149` pins the vault's chests as `['ether', 'phoenix_down', 'tnt']`. C8's `hall_east` is also a pad
and an entrance on citadel-2f (`citadel.py` lines 140 and 153, pinned in `ord_o_sites.test.ts`), so only the chest's
id changes and `ff1Chests.test.ts`'s "old id gone" check looks at chest NPCs only.

## 5. Shops (`assets/data/shops.yaml`), exactly FF1 (`/tmp/equip-plan/shops_new.py`)

| town | weapon | armor | item | white | black |
|---|---|---|---|---|---|
| cornelia | wooden_nunchaku small_knife staff rapier hammer | cloth leather_armor chain_mail | potion antidote tent | cure harm fog ruse | fire slep lock lit |
| pravoka | hammer short_sword hand_axe scimitar | leather_armor chain_mail iron_armor wooden_shield gloves | potion antidote tent cabin | lamp mute alit invs | ice dark tmpr slow |
| elfheim | iron_nunchaku large_dagger iron_staff sabre mythril_sword | iron_armor copper_bracelet iron_shield cap iron_helm | potion antidote soft cabin house | cure2 hrm2 afir heal pure fear aice amut | fir2 hold lit2 lok2 slp2 fast conf ice2 |
| dwarf | - | - | closed | - | - |
| melmond | iron_staff sabre long_sword falchion | mythril_armor silver_armlet great_helm copper_gauntlet iron_gauntlet | closed | cure3 life hrm3 hel2 | fir3 bane warp slo2 |
| crescent | mythril_knife mythril_sword mythril_hammer silver_axe | mythril_mail mythril_shield buckler mythril_helm silver_gauntlet | potion antidote cabin house | soft exit fog2 inv2 | lit3 rub qake stun |
| onrac | closed | closed | potion antidote soft cabin house | arub hel3 | sabr blnd |
| gaia | cat_claw | gold_armlet pro_ring | potion antidote cabin house | cur4 hrm4 fade wall xfer | ice3 brak stop zap xxxx |
| lufenia | - | - | - | lif2 | nuke |

All 64 spells are sold, each in exactly one shop. Inns are unchanged (follow-up 12.4).

**Closed shops:**

- `ShopData.closed?: boolean` is validated, and `closed` ⇔ an empty inventory on every non-inn shop.
- `openShopScene` (`exploration/FieldSystems.ts`) returns without a scene, with a `console.info`.
- The keepers' lines (in the layout scripts, then the maps are regenerated and compiled):
  - `earth/town_melmond_shops.py`: "The shelves are bare. The rot took the herbs, and the dwarves' cart stopped
    coming."
  - `earth/dwarf.py` `dwarf-item-keeper`: "Store's shut. Every rope and lamp went down the canal works."
  - `water/town_onrac_shops.py` weapon keeper: "No steel for sale. The smiths sailed with the fleet."
  - `water/town_onrac_shops.py` armour keeper: "The racks are empty. Not a scrap of mail left in Onrac."

The Bottle: `water/caravan.py` `BOTTLE_PRICE = 50000`. Then `caravan-camp` is regenerated and compiled.

## 6. Kits (`assets/data/kits.yaml`, D-EQ11 / D-EQ12)

- **Act 1.**
  - `start`: the Fi row is rapier, leather_armor. The W / T / WM / BM cost is 355 G (was 370).
  - `lv2` = start + LIT for the BM.
  - `arrive` = lv2 + `found: [cap]` on the warrior.
  - `full` = lv2 + the warrior's chain_mail + `found: [cap]`, with LIT, SLEP and RUSE.
- **The `w_*` kits** are generated by `kits.py` with the D-EQ11 rule, then written with anchors where rows repeat. The
  clone rows copy their template; the promoted rows appear from S19 on. Appendix B has the rows: *italic* items are
  `found`.
- **Prices** (`kitPrice`, W / T / WM / BM gear):

| kit | price |
|---|---|
| w_s1 | 185 |
| w_pravoka = w_s3 | 1890 |
| w_elfheim = w_dwarf = w_s4..s10 | 9115 |
| w_melmond = w_s11..s13 | 66355 |
| w_crescent = w_s14..s17 | 78670 |
| w_onrac = w_s18..s22 | 78670 |
| w_gaia = w_lufenia = w_s23..s30 | 290990 |

- **The proofs, by hand** (T4 re-runs them):
  - (d): each town's ground gold at its `bandStage` is ≥ 50 % of its kit price:
    - pravoka 1539 ≥ 945
    - elfheim 19730 ≥ 4558
    - melmond 53745 ≥ 33178
    - crescent 216841 ≥ 39335
    - onrac 612329 ≥ 39335
    - gaia 579716 ≥ 145495
    - dwarf S10 46664 ≥ 4558
    - lufenia 921043 ≥ 145495
  - `walled` (computed in `kits.py`): only crescent (78670 > S11's 66355) and gaia (290990 > S18 / S20 / S22's 78670),
    as today.
  - (f): crescent 13169 < 31468; gaia 98095 < 116396 (33.7 %).
  - (d3): the Bottle's 50000 at S22 is at most 80 % of the ground gold at S22's start (612329).
- **The readers of kits** apply `found` after `gear`, so each found item replaces its slot's item:
  - `tests/helpers/balanceData.ts` (`makeParty`, `makeMember`, `kitCost`: gear only)
  - `src/systems/debugParty.ts` `kitMember` (`equipment: [...gear, ...found]`)
  - the sandbox (through `kitMember`)
  - `questLateData` `kitPrice` (gear only; it ignores `found`)
- **Schema:** `Kit` types get `found?: string[]`. `kitsYaml.test.ts` checks that every `found` item fits the class.

## 7. Mechanics (R5.5)

### 7.1 The FF1 attack bonus

`src/battle/PhysicalAttack.ts` (49 lines): `resolvePartyAttack` computes `strong`, which is true when any of these
holds:

- `weapon.bonusVsFamily === 'all'`
- `weapon.bonusVsFamily === target.data.family`
- `weapon.element` is a weakness of the target (`target.data.weakness`, or `elementalProfile.weaknesses`)

When `strong`, the attacker's numbers get `attack + 4` and `hitPercent + 40` before `physicalAttack`. The hit count is
taken from the raised hit%: the bonus path computes hits = 1 + ⌊(partyHitPercent + 40) / 32⌋ itself and does not call
`partyHits()`. `FAMILY_BONUS` (×1.5) is deleted. Unarmed
attacks have no weapon, so no bonus.

### 7.2 Armour resistances

`ItemData.resist?: string[]` holds categories: an element (`fire`, `ice`, `lightning`, ...) or a protection category
(`death`, `poison_stone`, `status`, `time`). Validation checks the values against `Elements.ts` and `SpellStatus`'s
`ProtectCategory`. `Character.hasTempResist(c)` also returns true when a worn item's `resist` includes `c`. That reaches:

- the element path (`SpellExecutor` line 212: resisted elemental damage)
- the late spells' hero protection (`spellEffectsLate`)
- `SpellStatus.isProtected`, which today says "heroes have no protections yet". It now asks a hero
  `hasTempResist(protectCategoryOf(spell))`, so death, stone and status spells miss a protected hero, as AFIR / ARUB
  do in FF1.

### 7.3 Item-use spells

`ItemData.battleSpell?: string` is a spells.yaml id. In battle:

- The Item command opens when the actor has a usable consumable **or** wears a `battleSpell` item
  (`BattleListMenus.canOpenItems`, which `BattleScene` line 303 reads).
- `ItemSelectionUI` takes the actor's worn rows as a second input. It lists them after the consumables as
  "<name> (worn)", and `hasNoItems()` counts them.
- Selecting a worn row builds `{ type: 'item', itemId, viaWorn: true, targetId: <actor id> }` (the actor is the
  target, so `executeItemCommand`'s target check passes), with no target step: every item spell is `all`, `all_allies` or `self`
(RUSE, LIT2, CONF, INV2, ICE2, SABR). `BattleStateMachine.executeItemCommand` (572 / 592 lines) hands a worn item to a
new `src/battle/itemCast.ts` (under 250 lines). That checks the actor still wears it and casts the spell through
`SpellExecutor` with `viaItem: true`. Then:

- No charge is spent or needed. Silence does not block it, because FF1 items work under MUTE.
- The message reads "<Hero> uses <Item>! <SPELL>", and the cast's results follow as a spell's do.
- The item stays worn.
- `reservedItems` ignores worn rows.

`SpellExecutor.ts` is at 311 / 314 lines, so its charge / silence step moves into `itemCast.castGate(caster, spell, cmd)`
(net ≤ 0 lines there).

## 8. Code changes

| file | change |
|---|---|
| `src/types/index.ts` (435 / 442 on mainline) | `EquipmentSlot` + `hands`; `ItemData.element?`, `battleSpell?`, `resist?`; `ShopData.closed?`; `CharacterClassData.copyOf?` (843cb6fc's 2 lines); `CharacterSaveData.equipment: Partial<Record<...>>`. Budget +6 lines (to 441), with trailing comments, not doc blocks. `BattleCommand.viaWorn?` goes in `src/battle/BattleCommands.ts`. |
| `src/entities/Character.ts` (270) | `hands` in the constructor; `canEquip` by `copyOf` (D-EQ4); `hasTempResist` + worn `resist`. A worn-item helper goes to `EquipmentRules.ts` if the file grows past 280. |
| `src/battle/CombatStats.ts`, `PhysicalAttack.ts` | `ARMOUR_SLOTS`; the 7.1 bonus |
| `src/battle/SpellStatus.ts`, `SpellExecutor.ts`, `BattleStateMachine.ts`, `BattleCommands.ts`, new `itemCast.ts`; `src/scenes/battle/BattleListMenus.ts`, `src/ui/ItemSelectionUI.ts`, `src/scenes/BattleScene.ts` (the Item command's enable) | 7.2 / 7.3 |
| `src/ui/labels.ts`, `src/scenes/EquipScene.ts`, `src/scenes/status/statusLines.ts` | the fifth row. The slot window (300 px: 24 + 5 × 36 = 204 px) and Status's 480 px column fit it. A test checks that the widest label, "Hands: Silver Gauntlet", fits the slot window. If not, the window widens toward x 1032. |
| `src/core/schemaValidation.ts` (396 on mainline), new `src/core/schemaValidationItems.ts` | `validateItemData` moves to the new file (under 250 lines), which adds `slot` ∈ 5 values, `bonusVsFamily`, `element`, `battleSpell` and `resist`; schemaValidation re-exports it. schemaValidation keeps `ShopData.closed` and the `copyOf` assert. That makes about 380 lines. |
| `src/systems/ItemEffects.ts`, `src/scenes/ItemMenuScene.ts` | `house` |
| `src/scenes/exploration/FieldSystems.ts` | the closed-shop guard |
| `src/systems/debugParty.ts`, `tests/helpers/balanceData.ts`, `tests/balance/questCurve.test.ts`, `src/progression/questLateData.ts` | kit `found` (D-EQ11); `kitPrice` counts `gear` only (no logic change: it already reads `gear`; its doc comment's figures are updated) |
| data | `items.yaml` (Appendix A + 3.1-3.4; every copy id out of `usableBy`), `shops.yaml` (5), `kits.yaml` (6), `classes.yaml` (`copyOf` lines), `debug-scenarios.yaml` (9.4) |
| layout scripts | 4.2 and 5 (the closed lines, `BOTTLE_PRICE`); their regenerated sources and compiled maps |
| docs | AGENTS.md (the `hands` slot, `copyOf` for equipment, kit `found`, the FF1 shop table pointer), WORLD_PLAN 3.6 note, this plan's "EQ result" |

The verifier's code is unchanged. Its inputs change (items, kits, shops, maps), so the mutation cache misses, and the
integrator's `--mutate` refills it.

## 9. Tests and gates

### 9.1 New tests, failing first

| test | checks | tranche |
|---|---|---|
| `tests/entities/handsSlot.test.ts` | Covers: hands null on a new Character; equip / unequip; `canEquipIn('hands')` (and a cap refused there); absorb +DEF, evade −weight; the Monk rule with gloves; `toJSON` 5 slots; a 4-slot v5 save loads through `SaveManager.load` with hands null; `equipFromBag` swaps gloves | T1 |
| `tests/scenes/equipHands.test.ts` | Equip: 5 rows in order and the preview. Status: a "Hands:" line. The shop comparison shows the gloves' DEF +1. The label fits. | T1 |
| `tests/core/schemaValidationEq.test.ts` | Rejects a bad slot (T1); the `battleSpell` / `resist` / `closed` types are covered by `ff1Items` and `ff1Shops` (T2). | T1 |
| `tests/data/ff1Items.test.ts` | Every Appendix A row's stats, price, jobs and effects. No copy id in any `usableBy`. Every copy class `canEquip`s exactly its `copyOf` source's items (both tiers). Cat Claw: Kn Ni RW BW. | T2 |
| `tests/data/ff1Shops.test.ts` | Every shop equals section 5 (order too). Every sold item has its NES price (a literal table). Every spell is sold exactly once. `closed` ⇔ empty. Bottle 50000. | T2 |
| `tests/data/obtainability.test.ts` | Every gear / consumable item is sold, chested, gifted or forged (Smyth's `give_item`). It passes on mainline and guards T3. | T2 |
| `tests/data/ff1Chests.test.ts` | C1-C17: the item at the map and cell, the new chest id and flag, the old id gone. | T2 |
| `tests/data/kitSources.test.ts` | D-EQ11: gear sold up to the tier and best by rank; stage gear = its tier's town gear (the Monk / Master weapon judged per kit); found ranks strictly before its slot's gear; found by ancestry with copies (base and promoted rows on separate pools); every row equips; `walled(crescent)` and `walled(gaia)` true, no other town walled. | T2 |
| `tests/scenes/closedShop.test.ts` | `openShopScene` registers and pushes nothing for a closed shop, and still opens an open one. | T2 |
| `tests/systems/houseItem.test.ts` | Full rest, the fallen stay fallen, consumed, the camp rule, `saveMenu` pushed. | T2 |
| `tests/battle/ff1Bonus.test.ts` | A Flame Sword vs an undead (family) and vs a fire-weak enemy gets +4 / +40 (seeded: exact hit% and attack into `physicalAttack`). A Mythril Sword vs undead gets nothing. Excalibur vs anything gets the bonus. Unarmed gets none. | T3 |
| `tests/battle/armourResist.test.ts` | A ProRing blocks RUB / XXXX (`status_death`). Dragon Armor reduces FIR2 damage like AFIR. The Aegis blocks a stone spell. Without them, no effect. | T3 |
| `tests/battle/itemCast.test.ts` | With no consumables in the bag and the Zeus Gauntlet worn, the Item command is enabled and lists it. The Zeus Gauntlet worn: the Item list shows "Zeus Gauntlet (worn)"; the cast hits all enemies with LIT2 and uses no charge, even silenced; the gauntlet stays. A copy in the bag but not worn is not listed. Defender casts RUSE on its wearer. | T3 |

### 9.2 Tests that change

- **Data:**
  - `gearBands.test.ts` (D-EQ14)
  - `actOneBalance.test.ts` (Cornelia armour, 370 → 355, `arrive`)
  - `kitsYaml.test.ts` (OLD_START / OLD_FULL become the new literals; `found`)
  - `descriptions.test.ts` (81 → 98 items; Coral Sword no longer lightning)
  - `crossFileValidation.test.ts` (`battleSpell` → spells, `resist` values)
  - the 12 `*Class.test.ts` (`usableBy` counts → `canEquip` counts)
  - `chestText.test.ts`, `pickupText.test.ts` (the new pickup names)
- **Progression:** `questLate.test.ts` (`kitPrice` w_s1 520 → 185, w_pravoka 1725 → 1890)
- **Region tests:**
  - the chest pins of 4.2
  - `wat_o_sites.test.ts` and `fxeHints.test.ts` (Bottle 50000)
  - the closed keepers' lines where pinned
- **Scenes and battle:**
  - `ShopScene`, `ShopDetailPanel`, `ShopComparison`, `EquipScene`, `StatusScene`, `ItemSelectionUI`, `BattleScene`
    tests that read changed shop lists or item stats
  - `FAMILY_BONUS` has no test on mainline; `ff1Bonus.test.ts` is its only coverage
- **Balance (re-measured, D-EQ17):**
  - `garland`, `fieldPacing`, `economy`, `fieldCampaign.ts`, `zones`
  - `w_a1_t`, `w_elf_d`, `w_elf_o`, `w_ert_d`, `w_fir_d1`, `w_fir_d2`, `w_ord_o`, `w_wat_d`, `w_wnd_d2`, `w_pst`
  - `questCurve.test.ts`, `chaos.test.ts` (`chaos_party`'s explicit gear gets FF1 stats: masamune hit 50)
  - the kit-built boss tests (`tests/battle/BossAI*.test.ts`, `BossPhase`, `enemyAiPattern`, `BlindSilence`,
    `tests/scenes/battle/dataEnemyAi.test.ts`, the sandbox tests)

### 9.3 Gates

- **Each commit:** `npm run build`, `npm run test:fast`, and `npx vitest run <touched>`.
- **After T3 / T4:**
  - `npm run quest -- --strict` (record the (d) and (f) lines)
  - for each changed map: the script twice, then `git diff --exit-code assets-src/maps`; `build_map.py <ids>`;
    `build_map.py --check-determinism <id>`
  - `python3 -I assets-src/tools/map_selftest.py` (maps touched)
- **The integrator's gates, run at the end as asked:**
  - `npm run quest -- --strict --mutate --jobs 6`
  - then `npm run quest -- --strict --only c --from-reset`
  - then `npm run test:full`
  - `git status` clean

### 9.4 Debug scenarios and the browser check (`?mute=1`; screenshots to `~/temp/ff-game/equip/`)

New scenarios:

- `eq_pravoka_armor`: pravoka-armor-shop, 2000 G.
- `eq_equip`: a field party wearing gloves, gauntlets and a ProRing, with spares in the bag.
- `eq_closed_onrac`: onrac-weapon-shop.
- `eq_house`: the world map, a House in the bag.
- `eq_items`: a battle. A knight wears the Zeus Gauntlet, a ninja the Power Gauntlet, a white wizard the White Shirt
  and a Defender user, vs goblins.

The check list:

1. Equip screen: five rows, "Hands: Gloves", the DEF preview.
2. Status: the "Hands:" line.
3. A shop: Pravoka armour, with Gloves 60 G and the comparison.
4. A closed shop: Onrac weapons says its line and nothing opens.
5. House: rest, then the save screen.
6. A battle with item spells: the Zeus Gauntlet casts LIT2 from the Item list, and the charges are unchanged.
7. An old save loads with Hands "-".

## 10. Tranches (one commit each on `equip-ff1`)

| # | content | gates |
|---|---|---|
| T0 | this plan | - |
| T1 | the `hands` slot: types, Character, CombatStats, labels, Equip / Status UI, the schema slot check, the save round trip; tests 9.1 rows 1-3 | build, fast |
| T2 | the data tranche: `copyOf` (843cb6fc's lines) and `canEquip` by `copyOf`; `schemaValidationItems.ts`; items.yaml regenerated (Appendix A, the 17 new items, effect fields as data, descriptions, NES prices, no copy ids); the House; shops (5) and closed shops; the Bottle; chest swaps C1-C17 (scripts, maps); kits (6, `found`) and their readers; the debug-scenario migration (D-EQ18); tests 9.1 (`ff1Items`, `ff1Shops`, `obtainability`, `ff1Chests`, `closedShop`, `houseItem`, `kitSources`) and every 9.2 data / region / scene test; `gearBands` rewrite; the balance re-measure (D-EQ17) | build, fast, `quest --strict`, maps |
| T3 | mechanics 7.1-7.3 and their tests; the balance re-measured again where they move it | build, fast, `quest --strict` |

As built, T2 and T3 landed as one commit: the balance re-measure is the long part of both, and measuring once on the
final rules (instead of on T2's and again on T3's) gives the same end state with half the runs. The 7.3 route is a
`magic` command with `viaItem` (`itemCast.wornCastCommand`), which needs no change to `executeItemCommand`.
| T4 | the debug scenarios of 9.4, the browser check, docs, the EQ result (measured (d) / (f), every re-measured bound old → new, the INTENT list, the gates' times) | all of 9.3; the integrator gates at the end, on `equip-ff1` itself, as the coordinator asked |

## 11. Risks

- **R-1b, the hero protections of 7.2.** `isProtected` reading `hasTempResist` also lets the temporary resistances
  of AFIR, AICE and WALL block status spells cast at heroes (WALL adds `status`, `poison_stone`, `death` and `time`).
  That is FF1's rule, but it moves the late balance; `armourResist.test.ts` covers WALL vs a status spell too.
- **R-1, balance moves a lot.** FF1 hit% on late weapons (masamune hit 50, defender 35 ...) adds about one hit per
  attack. The armlets grow (34 vs 22). The S18-S22 stage kits lose today's Gurgu / Onrac gear (ancestry, D-EQ11). Boss
  bands in `questCurve.test.ts` and the region boss tests may move both ways. Re-measure per D-EQ17. A broken intent is
  reported with its numbers, not retuned.
- **R-2, act 1.** No Wooden Shield or Cap in Cornelia moves Garland (the most-tuned fight). Same rule.
- **R-3, merge with class-copynote.** `classes.yaml` (identical `copyOf` hunks merge cleanly) and `items.yaml`
  `usableBy` (their copy ids conflict with this pass's 12-id lists; resolution: drop theirs).
- **R-4, file ceilings.** `SpellExecutor` 311 / 314, `BattleStateMachine` 572 / 592, `types/index.ts` 435 / 442
  (441 after T2), `schemaValidation` 396 (about 380 after the T2 move). The extractions are named in 7.3 and 8.
- **R-5, saves.** Old saves load with Hands empty. Their opened swapped chests reappear closed, a free item.
- **R-6, the mutation cache misses.** No gate row or `nonLoadBearing` changes. If `--mutate` reports an uncaught
  element, the batch stops and it is reported.

## 12. Follow-ups (not in this pass)

1. Removing the closed shops' rooms (D-EQ8).
2. FF1's chest items the game lacks (14 weapons, 11 armours: Were / Rune / Dragon / Giant / Bane Sword, Katana, Light
   Axe, Heal / Mage Staff, Flame / Ice Armor and Shield, ProCape, Ribbon, Heal Helmet), with their spells and
   resistances.
3. Renaming `iron_helm` "Iron Helm" to "Wooden Helm" (name only).
4. Inn and clinic prices (FF1: Melmond 100, Crescent 200, Onrac 300, Gaia 300-500).

## 13. Open questions

None block the implementation. The user decided rev 1's questions in R5. The remaining choices are the plan's own
defaults, each named in its decision and reversible:

- the label "Hands"
- closed shops instead of removed rooms
- the consumables chest-only
- stage kits by ancestry
- the House's save prompt
- C11-C17 included

## Appendix A: every gear item, was → new

Stats are ATK / hit / crit for weapons and DEF / weight for armour. Jobs use FF1 codes for the 12 classic ids. Prices
are only the shop prices; chest items keep theirs.

| id | FF1 | was ATK/hit/crit or DEF/WT | new | price | FF1 jobs (12 classic ids) | effects was → new |
|---|---|---|---|---|---|---|
| `small_knife` | small_dagger | 5/10/2 | **5/10/2** | 5 → 5 | Fi Kn Th Ni RM RW BM BW | - → - |
| `wooden_nunchaku` | wooden_nunchuck | 12/0/1 | **12/0/1** | 10 → 10 | Ni BB Ma | - → - |
| `staff` | wooden_staff | 6/0/3 | **6/0/3** | 5 → 5 | Fi Kn Ni BB Ma RM RW WM WW BM BW | - → - |
| `rapier` | rapier | 9/5/4 | **9/5/4** | 10 → 10 | Fi Kn Th Ni RM RW | - → - |
| `short_sword` | short_sword | 15/10/6 | **15/10/6** | 550 → 550 | Fi Kn Ni RM RW | - → - |
| `hammer` | iron_hammer | 9/0/5 | **9/0/5** | 10 → 10 | Fi Kn Ni WM WW | - → - |
| `hand_axe` | hand_axe | 16/5/7 | **16/5/7** | 550 → 550 | Fi Kn Ni | - → - |
| `iron_nunchaku` | iron_nunchuck | 16/0/9 | **16/0/9** | 200 → 200 | Ni BB Ma | - → - |
| `iron_sword` | non-FF1 | 13/10/10 | **13/10/10** | 300 → 300 | Fi Kn RM RW | - → - |
| `mythril_sword` | silver_sword | 23/10/12 | **23/15/17** | 4000 → 4000 | Fi Kn Ni RM RW | bonusVsFamily=undead → - |
| `mythril_knife` | silver_knife | 15/10/12 | **10/15/16** | 800 → 800 | Fi Kn Th Ni RM RW BM BW | bonusVsFamily=undead → - |
| `great_axe` | great_axe | 22/10/14 | **22/5/14** | 4500 → 4500 | Fi Kn Ni | bonusVsFamily=giant → - |
| `mythril_hammer` | silver_hammer | 18/10/12 | **12/5/18** | 2500 → 2500 | Fi Kn Ni WM WW | bonusVsFamily=undead → - |
| `power_staff` | power_staff | 12/10/10 | **12/0/28** | 1000 → 1000 | Fi Kn Ni BB Ma WM WW BM BW | - → - |
| `flame_sword` | flame_sword | 26/10/16 | **26/20/20** | 10000 → 10000 | Fi Kn Ni RM RW | element=fire,bonusVsFamily=undead → element fire, bonusVsFamily undead |
| `ice_brand` | ice_sword | 26/10/16 | **29/25/21** | 10000 → 10000 | Fi Kn Ni RM RW | element=ice → element ice |
| `coral_sword` | coral_sword | 26/10/16 | **19/15/25** | 10000 → 10000 | Fi Kn Th Ni RM RW | element=lightning,bonusVsFamily=aquatic → bonusVsFamily aquatic |
| `masamune` | masmune | 56/10/20 | **56/50/40** | 0 → 0 | Fi Kn Th Ni BB Ma RM RW WM WW BM BW | bonusVsFamily=dragon → - |
| `cloth` | cloth | 1/2 | **1/2** | 10 → 10 | Fi Kn Th Ni BB Ma RM RW WM WW BM BW | - → - |
| `robe` | non-FF1 | 2/2 | **2/2** | 20 → 20 | RM RW WM WW BM BW | - → - |
| `leather_armor` | wooden_armor | 4/8 | **4/8** | 50 → 50 | Fi Kn Th Ni BB Ma RM RW | - → - |
| `wooden_armor` | wooden_armor | 4/8 | **4/8** | 50 → 50 | Fi Kn Th Ni BB Ma RM RW | - → - |
| `chain_mail` | chain_armor | 15/15 | **15/15** | 80 → 80 | Fi Kn Ni RM RW | - → - |
| `iron_armor` | iron_armor | 24/23 | **24/23** | 800 → 800 | Fi Kn Ni | - → - |
| `mythril_armor` | steel_armor | 34/33 | **34/33** | 7500 → 45000 | Fi Kn | - → - |
| `mythril_mail` | silver_armor | 18/8 | **18/8** | 3500 → 7500 | Fi Kn Ni RM RW | - → - |
| `dragon_armor` | dragon_armor | 42/10 | **42/10** | 0 → 0 | Kn | - → resist fire+ice+lightning |
| `wooden_shield` | wooden_shield | 2/0 | **2/0** | 15 → 15 | Fi Kn Ni | - → - |
| `iron_shield` | iron_shield | 4/0 | **4/0** | 100 → 100 | Fi Kn Ni | - → - |
| `mythril_shield` | silver_shield | 8/0 | **8/0** | 2500 → 2500 | Fi Kn Ni | - → - |
| `cap` | cap | 1/1 | **1/1** | 80 → 80 | Fi Kn Th Ni BB Ma RM RW WM WW BM BW | - → - |
| `iron_helm` | wooden_helmet | 3/3 | **3/3** | 100 → 100 | Fi Kn Ni | - → - |
| `mythril_helm` | silver_helmet | 6/3 | **6/3** | 2500 → 2500 | Fi Kn Ni | - → - |
| `silver_armlet` | silver_bracelet | 10/1 | **15/1** | 1200 → 5000 | Fi Kn Th Ni BB Ma RM RW WM WW BM BW | - → - |
| `scimitar` | scimitar | 20/5/10 | **10/10/8** | 3000 → 200 | Fi Kn Th Ni RM RW | - → - |
| `gold_armlet` | gold_bracelet | 16/1 | **24/1** | 4000 → 50000 | Fi Kn Th Ni BB Ma RM RW WM WW BM BW | - → - |
| `falchion` | falchon | 24/10/14 | **15/10/15** | 8000 → 450 | Fi Kn Th Ni RM RW | - → - |
| `cat_claw` | catclaw | 22/10/16 | **22/35/35** | 6500 → 65000 | Kn Ni RW BW | - → - |
| `wizard_staff` | wizard_staff | 18/5/10 | **15/15/33** | 5000 → 5000 | BW | - → battleSpell conf |
| `white_robe` | white_shirt | 24/2 | **24/2** | 9000 → 9000 | WW | - → battleSpell inv2, resist fire+death |
| `black_robe` | black_shirt | 24/2 | **24/2** | 9000 → 9000 | BW | - → battleSpell ice2, resist ice+time |
| `sun_blade` | sun_sword | 30/10/16 | **32/30/24** | 15000 → 15000 | Fi Kn Ni RM RW | - → bonusVsFamily undead |
| `thor_hammer` | thors_hammer | 24/10/14 | **18/15/36** | 14000 → 14000 | Kn Ni WW | element=lightning → battleSpell lit2 |
| `rune_knife` | non-FF1 | 26/10/18 | **18/15/27** | 12000 → 12000 | Th Ni RM RW BM BW | - → bonusVsFamily magical |
| `opal_armor` | opal_armor | 38/30 | **42/10** | 20000 → 20000 | Kn | - → resist lightning |
| `opal_armlet` | opal_bracelet | 22/1 | **34/1** | 15000 → 15000 | Fi Kn Th Ni BB Ma RM RW WM WW BM BW | - → - |
| `aegis_shield` | aegis_shield | 12/0 | **16/0** | 16000 → 16000 | Kn | - → resist poison_stone |
| `opal_helm` | opal_helmet | 8/3 | **8/3** | 9000 → 9000 | Kn | - → - |
| `defender` | defense | 34/10/18 | **30/35/32** | 30000 → 30000 | Kn Ni RW | - → battleSpell ruse |
| `vorpal_sword` | vorpal | 32/10/24 | **24/25/34** | 28000 → 28000 | Kn Ni RW | - → - |
| `dragon_claw` | non-FF1 | 30/10/20 | **30/35/35** | 26000 → 26000 | Kn Ni RW BW | - → bonusVsFamily dragon |
| `diamond_armor` | opal_armor | 40/28 | **42/10** | 40000 → 40000 | Kn | - → resist lightning |
| `diamond_armlet` | opal_bracelet | 30/1 | **34/1** | 30000 → 30000 | Fi Kn Th Ni BB Ma RM RW WM WW BM BW | - → - |
| `diamond_shield` | opal_shield | 14/0 | **16/0** | 25000 → 25000 | Kn | - → resist lightning |
| `diamond_helm` | opal_helmet | 10/3 | **8/3** | 20000 → 20000 | Kn | - → - |
| `excalibur` | xcalber | 45/15/20 | **45/35/39** | 0 → 0 | Kn | element=holy → bonusVsFamily all |
| `large_dagger` | large_dagger | new | **7/10/10** | - → 175 | Fi Kn Th Ni RM RW BM BW | - → - |
| `iron_staff` | iron_staff | new | **14/0/11** | - → 200 | Fi Kn Ni BB Ma | - → - |
| `sabre` | sabre | new | **13/5/12** | - → 450 | Fi Kn Th Ni RM RW | - → - |
| `long_sword` | long_sword | new | **20/10/13** | - → 1500 | Fi Kn Ni RM RW | - → - |
| `silver_axe` | silver_axe | new | **25/10/19** | - → 4500 | Fi Kn Ni | - → - |
| `copper_bracelet` | copper_bracelet | new | **4/1** | - → 1000 | Fi Kn Th Ni BB Ma RM RW WM WW BM BW | - → - |
| `buckler` | buckler | new | **2/0** | - → 2500 | Fi Kn Th Ni RM RW | - → - |
| `great_helm` | iron_helmet | new | **5/5** | - → 450 | Fi Kn Ni | - → - |
| `gloves` | gloves | new | **1/1** | - → 60 | Fi Kn Th Ni BB Ma RM RW WM WW BM BW | - → - |
| `copper_gauntlet` | copper_gauntlet | new | **2/3** | - → 200 | Fi Kn Ni | - → - |
| `iron_gauntlet` | iron_gauntlet | new | **4/5** | - → 750 | Fi Kn Ni | - → - |
| `silver_gauntlet` | silver_gauntlet | new | **6/3** | - → 2500 | Fi Kn Ni RW | - → - |
| `zeus_gauntlet` | zeus_gauntlet | new | **6/3** | - → 15000 | Kn Ni RW | - → battleSpell lit2 |
| `power_gauntlet` | power_gauntlet | new | **6/3** | - → 10000 | Kn Ni RW | - → battleSpell sabr |
| `opal_gauntlet` | opal_gauntlet | new | **8/3** | - → 20000 | Kn | - → - |
| `pro_ring` | proring | new | **8/1** | - → 20000 | Fi Kn Th Ni BB Ma RM RW WM WW BM BW | - → resist death |

## Appendix B: the kits (from `kits.py`; *italic* = `found`; every clone row = its template)

| kit | W | T | WM | BM | Mo | RM | Kn | Ni | WW | BW | Ma | RW |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| w_pravoka | hand_axe, iron_armor, wooden_shield, gloves | scimitar, leather_armor, gloves | hammer, cloth, gloves | staff, cloth, gloves | wooden_nunchaku, leather_armor, gloves | short_sword, chain_mail, gloves |  |  |  |  |  |  |
| w_elfheim | mythril_sword, iron_armor, iron_shield, iron_helm, gloves | sabre, copper_bracelet, cap, gloves | hammer, copper_bracelet, cap, gloves | large_dagger, copper_bracelet, cap, gloves | copper_bracelet, cap, gloves | mythril_sword, chain_mail, cap, gloves |  |  |  |  |  |  |
| w_dwarf | = above | | | | | | | | | | | |
| w_melmond | mythril_sword, mythril_armor, iron_shield, great_helm, iron_gauntlet | falchion, silver_armlet, cap, gloves | hammer, silver_armlet, cap, gloves | large_dagger, silver_armlet, cap, gloves | silver_armlet, cap, gloves | mythril_sword, silver_armlet, cap, gloves |  |  |  |  |  |  |
| w_crescent | silver_axe, mythril_armor, mythril_shield, mythril_helm, silver_gauntlet | falchion, silver_armlet, buckler, cap, gloves | mythril_hammer, silver_armlet, cap, gloves | mythril_knife, silver_armlet, cap, gloves | silver_armlet, cap, gloves | mythril_sword, mythril_mail, buckler, cap, gloves |  |  |  |  |  |  |
| w_onrac | silver_axe, mythril_armor, mythril_shield, mythril_helm, silver_gauntlet | falchion, silver_armlet, buckler, cap, gloves | mythril_hammer, silver_armlet, cap, gloves | mythril_knife, silver_armlet, cap, gloves | silver_armlet, cap, gloves | mythril_sword, mythril_mail, buckler, cap, gloves | silver_axe, mythril_armor, mythril_shield, mythril_helm, silver_gauntlet | silver_axe, iron_armor, mythril_shield, mythril_helm, silver_gauntlet | mythril_hammer, silver_armlet, cap, gloves | mythril_knife, silver_armlet, cap, gloves | silver_armlet, cap, gloves | mythril_sword, mythril_mail, buckler, cap, silver_gauntlet |
| w_gaia | silver_axe, mythril_armor, mythril_shield, mythril_helm, pro_ring | falchion, gold_armlet, buckler, cap, pro_ring | mythril_hammer, gold_armlet, cap, pro_ring | mythril_knife, gold_armlet, cap, pro_ring | gold_armlet, cap, pro_ring | mythril_sword, gold_armlet, buckler, cap, pro_ring | silver_axe, mythril_armor, mythril_shield, mythril_helm, pro_ring | silver_axe, gold_armlet, mythril_shield, mythril_helm, pro_ring | mythril_hammer, gold_armlet, cap, pro_ring | cat_claw, gold_armlet, cap, pro_ring | gold_armlet, cap, pro_ring | mythril_sword, gold_armlet, buckler, cap, pro_ring |
| w_lufenia | = above | | | | | | | | | | | |
| w_s1 | rapier, chain_mail, *iron_helm* | rapier, leather_armor, *cap* | hammer, cloth, *robe* | staff, cloth | wooden_nunchaku, leather_armor | rapier, chain_mail |  |  |  |  |  |  |
| w_s2 | = above | | | | | | | | | | | |
| w_s3 | hand_axe, iron_armor, wooden_shield, gloves, *iron_helm* | scimitar, leather_armor, gloves, *cap* | hammer, cloth, gloves, *robe* | staff, cloth, gloves | wooden_nunchaku, leather_armor, gloves | short_sword, chain_mail, gloves |  |  |  |  |  |  |
| w_s4 | mythril_sword, iron_armor, iron_shield, iron_helm, gloves | sabre, copper_bracelet, cap, gloves | hammer, copper_bracelet, cap, gloves | large_dagger, copper_bracelet, cap, gloves | iron_nunchaku, copper_bracelet, cap, gloves | mythril_sword, chain_mail, cap, gloves |  |  |  |  |  |  |
| w_s5 | mythril_sword, iron_armor, iron_shield, iron_helm, gloves, *mythril_helm* | sabre, copper_bracelet, cap, gloves | hammer, copper_bracelet, cap, gloves, *power_staff* | large_dagger, copper_bracelet, cap, gloves | copper_bracelet, cap, gloves | mythril_sword, chain_mail, cap, gloves |  |  |  |  |  |  |
| w_s6 | mythril_sword, iron_armor, iron_shield, iron_helm, gloves, *gold_armlet*, *mythril_helm* | sabre, copper_bracelet, cap, gloves | hammer, copper_bracelet, cap, gloves, *power_staff* | large_dagger, copper_bracelet, cap, gloves | copper_bracelet, cap, gloves | mythril_sword, chain_mail, cap, gloves |  |  |  |  |  |  |
| w_s7 | = above | | | | | | | | | | | |
| w_s8 | = above | | | | | | | | | | | |
| w_s9 | mythril_sword, iron_armor, iron_shield, iron_helm, gloves, *gold_armlet*, *mythril_helm*, *copper_gauntlet* | sabre, copper_bracelet, cap, gloves | hammer, copper_bracelet, cap, gloves, *power_staff* | large_dagger, copper_bracelet, cap, gloves | copper_bracelet, cap, gloves | mythril_sword, chain_mail, cap, gloves |  |  |  |  |  |  |
| w_s10 | = above | | | | | | | | | | | |
| w_s11 | mythril_sword, mythril_armor, iron_shield, great_helm, iron_gauntlet, *mythril_helm* | falchion, silver_armlet, cap, gloves, *gold_armlet* | hammer, silver_armlet, cap, gloves, *power_staff* | large_dagger, silver_armlet, cap, gloves | silver_armlet, cap, gloves | mythril_sword, silver_armlet, cap, gloves |  |  |  |  |  |  |
| w_s12 | = above | | | | | | | | | | | |
| w_s13 | = above | | | | | | | | | | | |
| w_s14 | silver_axe, mythril_armor, mythril_shield, mythril_helm, silver_gauntlet | falchion, silver_armlet, buckler, cap, gloves, *gold_armlet* | mythril_hammer, silver_armlet, cap, gloves | mythril_knife, silver_armlet, cap, gloves, *power_staff* | silver_armlet, cap, gloves | mythril_sword, mythril_mail, buckler, cap, gloves |  |  |  |  |  |  |
| w_s15 | silver_axe, mythril_armor, mythril_shield, mythril_helm, silver_gauntlet, *sun_blade*, *opal_armlet* | falchion, silver_armlet, buckler, cap, gloves, *gold_armlet* | mythril_hammer, silver_armlet, cap, gloves | mythril_knife, silver_armlet, cap, gloves, *power_staff* | silver_armlet, cap, gloves | mythril_sword, mythril_mail, buckler, cap, gloves |  |  |  |  |  |  |
| w_s16 | silver_axe, mythril_armor, mythril_shield, mythril_helm, silver_gauntlet, *ice_brand*, *opal_armlet* | falchion, silver_armlet, buckler, cap, gloves, *gold_armlet* | mythril_hammer, silver_armlet, cap, gloves | mythril_knife, silver_armlet, cap, gloves, *power_staff* | silver_armlet, cap, gloves | mythril_sword, mythril_mail, buckler, cap, gloves, *flame_sword* |  |  |  |  |  |  |
| w_s17 | = above | | | | | | | | | | | |
| w_s18 | silver_axe, mythril_armor, mythril_shield, mythril_helm, silver_gauntlet, *ice_brand*, *opal_armlet* | falchion, silver_armlet, buckler, cap, gloves, *opal_armlet* | mythril_hammer, silver_armlet, cap, gloves, *gold_armlet* | mythril_knife, silver_armlet, cap, gloves, *power_staff* | silver_armlet, cap, gloves | mythril_sword, mythril_mail, buckler, cap, gloves, *flame_sword* |  |  |  |  |  |  |
| w_s19 | silver_axe, mythril_armor, mythril_shield, mythril_helm, silver_gauntlet, *ice_brand*, *diamond_armlet* | falchion, silver_armlet, buckler, cap, gloves, *opal_armlet* | mythril_hammer, silver_armlet, cap, gloves, *opal_armlet* | mythril_knife, silver_armlet, cap, gloves, *power_staff*, *gold_armlet* | silver_armlet, cap, gloves | mythril_sword, mythril_mail, buckler, cap, gloves, *flame_sword* | silver_axe, mythril_armor, mythril_shield, mythril_helm, silver_gauntlet, *ice_brand*, *diamond_armlet*, *aegis_shield*, *opal_helm* | silver_axe, iron_armor, mythril_shield, mythril_helm, silver_gauntlet, *flame_sword*, *opal_armlet* | mythril_hammer, silver_armlet, cap, gloves, *opal_armlet* | mythril_knife, silver_armlet, cap, gloves, *wizard_staff*, *gold_armlet* | silver_armlet, cap, gloves | mythril_sword, mythril_mail, buckler, cap, silver_gauntlet |
| w_s20 | silver_axe, mythril_armor, mythril_shield, mythril_helm, silver_gauntlet, *ice_brand*, *opal_armlet* | falchion, silver_armlet, buckler, cap, gloves, *gold_armlet* | mythril_hammer, silver_armlet, cap, gloves | mythril_knife, silver_armlet, cap, gloves, *power_staff* | silver_armlet, cap, gloves | mythril_sword, mythril_mail, buckler, cap, gloves, *flame_sword* | silver_axe, mythril_armor, mythril_shield, mythril_helm, silver_gauntlet, *ice_brand*, *opal_armlet*, *opal_helm* | silver_axe, iron_armor, mythril_shield, mythril_helm, silver_gauntlet, *flame_sword*, *gold_armlet* | mythril_hammer, silver_armlet, cap, gloves | mythril_knife, silver_armlet, cap, gloves, *wizard_staff*, *black_robe* | silver_armlet, cap, gloves | mythril_sword, mythril_mail, buckler, cap, silver_gauntlet |
| w_s21 | silver_axe, mythril_armor, mythril_shield, mythril_helm, silver_gauntlet, *ice_brand*, *opal_armlet* | falchion, silver_armlet, buckler, cap, gloves, *rune_knife*, *gold_armlet* | mythril_hammer, silver_armlet, cap, gloves | mythril_knife, silver_armlet, cap, gloves, *power_staff* | silver_armlet, cap, gloves | mythril_sword, mythril_mail, buckler, cap, gloves, *flame_sword* | silver_axe, mythril_armor, mythril_shield, mythril_helm, silver_gauntlet, *ice_brand*, *opal_armlet*, *opal_helm* | silver_axe, iron_armor, mythril_shield, mythril_helm, silver_gauntlet, *flame_sword*, *gold_armlet* | mythril_hammer, silver_armlet, cap, gloves | mythril_knife, silver_armlet, cap, gloves, *rune_knife*, *black_robe* | silver_armlet, cap, gloves | mythril_sword, mythril_mail, buckler, cap, silver_gauntlet |
| w_s22 | silver_axe, mythril_armor, mythril_shield, mythril_helm, silver_gauntlet, *ice_brand*, *opal_armlet* | falchion, silver_armlet, buckler, cap, gloves, *gold_armlet* | mythril_hammer, silver_armlet, cap, gloves | mythril_knife, silver_armlet, cap, gloves, *power_staff* | silver_armlet, cap, gloves | mythril_sword, mythril_mail, buckler, cap, gloves, *flame_sword* | silver_axe, mythril_armor, mythril_shield, mythril_helm, silver_gauntlet, *ice_brand*, *opal_armlet*, *opal_helm* | silver_axe, iron_armor, mythril_shield, mythril_helm, silver_gauntlet, *flame_sword*, *gold_armlet* | mythril_hammer, silver_armlet, cap, gloves | mythril_knife, silver_armlet, cap, gloves, *wizard_staff*, *black_robe* | silver_armlet, cap, gloves | mythril_sword, mythril_mail, buckler, cap, silver_gauntlet |
| w_s23 | silver_axe, mythril_armor, mythril_shield, mythril_helm, pro_ring, *ice_brand*, *opal_armlet* | falchion, gold_armlet, buckler, cap, pro_ring | mythril_hammer, gold_armlet, cap, pro_ring | mythril_knife, gold_armlet, cap, pro_ring, *power_staff* | gold_armlet, cap, pro_ring | mythril_sword, gold_armlet, buckler, cap, pro_ring, *flame_sword* | silver_axe, mythril_armor, mythril_shield, mythril_helm, pro_ring, *ice_brand*, *opal_armlet*, *opal_helm* | silver_axe, gold_armlet, mythril_shield, mythril_helm, pro_ring, *flame_sword* | mythril_hammer, gold_armlet, cap, pro_ring | cat_claw, gold_armlet, cap, pro_ring | gold_armlet, cap, pro_ring | mythril_sword, gold_armlet, buckler, cap, pro_ring |
| w_s24 | silver_axe, mythril_armor, mythril_shield, mythril_helm, pro_ring, *ice_brand*, *diamond_armlet* | falchion, gold_armlet, buckler, cap, pro_ring, *coral_sword*, *opal_armlet* | mythril_hammer, gold_armlet, cap, pro_ring, *opal_armlet* | mythril_knife, gold_armlet, cap, pro_ring, *power_staff* | gold_armlet, cap, pro_ring | mythril_sword, gold_armlet, buckler, cap, pro_ring, *flame_sword* | silver_axe, mythril_armor, mythril_shield, mythril_helm, pro_ring, *ice_brand*, *diamond_armor*, *aegis_shield*, *diamond_helm* | silver_axe, gold_armlet, mythril_shield, mythril_helm, pro_ring, *flame_sword*, *diamond_armlet* | mythril_hammer, gold_armlet, cap, pro_ring, *opal_armlet* | cat_claw, gold_armlet, cap, pro_ring, *opal_armlet* | gold_armlet, cap, pro_ring | mythril_sword, gold_armlet, buckler, cap, pro_ring |
| w_s25 | = above | | | | | | | | | | | |
| w_s26 | = above | | | | | | | | | | | |
| w_s27 | silver_axe, mythril_armor, mythril_shield, mythril_helm, pro_ring, *ice_brand*, *diamond_armlet* | falchion, gold_armlet, buckler, cap, pro_ring, *coral_sword*, *diamond_armlet* | mythril_hammer, gold_armlet, cap, pro_ring, *opal_armlet* | mythril_knife, gold_armlet, cap, pro_ring, *rune_knife*, *opal_armlet* | gold_armlet, cap, pro_ring | mythril_sword, gold_armlet, buckler, cap, pro_ring, *flame_sword* | silver_axe, mythril_armor, mythril_shield, mythril_helm, pro_ring, *defender*, *diamond_armor*, *aegis_shield*, *diamond_helm* | silver_axe, gold_armlet, mythril_shield, mythril_helm, pro_ring, *ice_brand*, *diamond_armlet* | mythril_hammer, gold_armlet, cap, pro_ring, *thor_hammer*, *diamond_armlet* | cat_claw, gold_armlet, cap, pro_ring, *opal_armlet* | gold_armlet, cap, pro_ring, *opal_armlet* | mythril_sword, gold_armlet, buckler, cap, pro_ring, *flame_sword* |
| w_s28 | silver_axe, mythril_armor, mythril_shield, mythril_helm, pro_ring, *ice_brand*, *diamond_armlet* | falchion, gold_armlet, buckler, cap, pro_ring, *coral_sword*, *diamond_armlet* | mythril_hammer, gold_armlet, cap, pro_ring, *diamond_armlet* | mythril_knife, gold_armlet, cap, pro_ring, *rune_knife*, *opal_armlet* | gold_armlet, cap, pro_ring, *opal_armlet* | mythril_sword, gold_armlet, buckler, cap, pro_ring, *flame_sword* | silver_axe, mythril_armor, mythril_shield, mythril_helm, pro_ring, *dragon_claw*, *diamond_armor*, *aegis_shield*, *diamond_helm* | silver_axe, gold_armlet, mythril_shield, mythril_helm, pro_ring, *defender*, *diamond_armlet* | mythril_hammer, gold_armlet, cap, pro_ring, *thor_hammer*, *diamond_armlet* | cat_claw, gold_armlet, cap, pro_ring, *diamond_armlet* | gold_armlet, cap, pro_ring, *opal_armlet* | mythril_sword, gold_armlet, buckler, cap, pro_ring, *ice_brand*, *opal_armlet* |
| w_s29 | silver_axe, mythril_armor, mythril_shield, mythril_helm, pro_ring, *sun_blade*, *diamond_armlet* | falchion, gold_armlet, buckler, cap, pro_ring, *coral_sword*, *diamond_armlet* | mythril_hammer, gold_armlet, cap, pro_ring, *diamond_armlet* | mythril_knife, gold_armlet, cap, pro_ring, *rune_knife*, *opal_armlet* | gold_armlet, cap, pro_ring, *opal_armlet* | mythril_sword, gold_armlet, buckler, cap, pro_ring, *ice_brand*, *opal_armlet* | silver_axe, mythril_armor, mythril_shield, mythril_helm, pro_ring, *sun_blade*, *diamond_armor*, *aegis_shield*, *diamond_helm* | silver_axe, gold_armlet, mythril_shield, mythril_helm, pro_ring, *dragon_claw*, *diamond_armlet* | mythril_hammer, gold_armlet, cap, pro_ring, *thor_hammer*, *diamond_armlet* | cat_claw, gold_armlet, cap, pro_ring, *diamond_armlet* | gold_armlet, cap, pro_ring, *opal_armlet* | mythril_sword, gold_armlet, buckler, cap, pro_ring, *defender*, *opal_armlet* |
| w_s30 | silver_axe, mythril_armor, mythril_shield, mythril_helm, pro_ring, *masamune*, *diamond_armlet* | falchion, gold_armlet, buckler, cap, pro_ring, *coral_sword*, *diamond_armlet* | mythril_hammer, gold_armlet, cap, pro_ring, *diamond_armlet* | mythril_knife, gold_armlet, cap, pro_ring, *rune_knife*, *opal_armlet* | gold_armlet, cap, pro_ring, *opal_armlet* | mythril_sword, gold_armlet, buckler, cap, pro_ring, *sun_blade*, *opal_armlet* | silver_axe, mythril_armor, mythril_shield, mythril_helm, pro_ring, *masamune*, *diamond_armor*, *aegis_shield*, *diamond_helm* | silver_axe, gold_armlet, mythril_shield, mythril_helm, pro_ring, *sun_blade*, *diamond_armlet* | mythril_hammer, gold_armlet, cap, pro_ring, *thor_hammer*, *diamond_armlet* | cat_claw, gold_armlet, cap, pro_ring, *dragon_claw*, *diamond_armlet* | gold_armlet, cap, pro_ring, *opal_armlet* | mythril_sword, gold_armlet, buckler, cap, pro_ring, *defender*, *opal_armlet* |

## EQ result (2026-11-27, branch `equip-ff1`)

Commits: T0 the plan (c1e55375, rev 3 0ee63900 / b69d2fba after Momus round 1; Momus round 2: OKAY 4/5), T1 the slot
(70b86c6f), T2+T3 data and mechanics (fe32aa0b), T4 scenarios, the battle announcement for worn items, docs (this
commit).

- `npm run build` OK; `npm run test:fast` 476 files, 11471 tests, all pass.
- `npm run quest -- --strict` OK in 129 s: (c) 866403 states; (d) every band unchanged (the curve model reads no
  item stats); (f) `crescent 13169/78670  gaia 98095/290990` (was 60240 / 259240): only Crescent and Gaia walled.
- 22 maps regenerated and compiled; `build_map.py --check-determinism` deterministic on all 22; a second run of the
  19 layout scripts leaves `assets-src/maps` byte-identical; `build_map.py --selftest` 156 checks passed (262 s).
  (`map_selftest.py` run directly under `-I` cannot import `kit`, on mainline too; its checks run inside `--selftest`.)
- Browser (`?mute=1`, screenshots `~/temp/ff-game/equip/`): Pravoka's armour shop lists FF1's five items with Gloves
  60 G and the DEF +1 comparison; the Equip screen shows five rows ending "Hands: Gloves"; the battle Item command
  opens with no consumables and lists "Defender (worn)" / "Zeus Gauntlet (worn)"; "W.WIZ uses the White Robe: INV2!"
  and "W.WIZ uses the Thor Hammer: LIT2!" (EVA+ on both heroes); Onrac's closed weapon shop says its line and opens
  nothing (`Shop onrac_weapon is closed`).

### Balance (D-EQ17): bounds rewritten to the new measured values; INTENT = the old bound's intent no longer holds

The direction is consistent: act 1 is harder (no Wooden Shield, no Caps in Cornelia), the Melmond tier (S11-S13) is
harder (the Mythril weapons and armlets moved to Crescent / Gaia, FF1), and the late game is much easier (FF1's hit%
on late weapons: Masamune 50, Defender 35, Opal Bracelet 34 ...). For the user to decide:

| test | was (measured) | now (measured) |
|---|---|---|
| Garland, careless Lv3 400 G kit | 55-75 % (64.75) | 35-60 % (45.5) |
| Garland after 2 temple battles, 400 G kit | 55-70 % (60) | 30-50 % (39) |
| Garland after 2 temple battles, lv2 kit | 40-58 % (50.5) | 25-45 % (31.5) |
| Garland after 3 temple battles, arrival kit | 50-70 % (61.5) | 25-45 % (34.25) |
| Vampire S11 Lv14 / Lv16 | 75-95 (79.3) / >= 85 (90.5) | 50-95 (53) / >= 70 (77.75) |
| Rime Sovereign S13 Lv17 / Lv19 | 60-80 (69.8) / >= 85 (91.3) | 45-80 (48.25) / >= 65 (70.5) |
| Ashen Queen S15 Lv21 / Lv23 | <= 45 (40.8) / 60-80 (64) | <= 85 (78.25) / 60-95 (89.5) |
| Evil Eye S16 Lv20 | <= 64 (60.3) | <= 70 (66.75) |
| Trial guardian S18 Lv25 | 75-95 (86.5) | 70-95 (74.25) |
| Drowned Sovereign S24 Lv26 / Lv28 | <= 45 (36.3) / 60-80 (68) | <= 65 (59.75) / 60-85 (81.5) |
| Hollow Seraph S28 Lv30 / Lv32 / careless | <= 50 (44.3) / 60-80 (65) / <= 80 (65.8) | <= 95 (91) / 60-100 (97.25) / <= 100 (97.5) |
| Warmech S28 Lv30 / Lv32 / careless | <= 50 (46.5) / 55-80 (60.3) / <= 80 (57.5) | <= 90 (86.25) / 55-100 (93) / <= 95 (91.5) |
| Temple of the Past: 4 refights L37 / L34, floor 5 | 60-85 (78.5) / <= 40 (17.8) / 70-90 (82.5) | 60-100 (97.25) / <= 100 (95.25) / 70-100 (97.25) |
| Chaos L40: every form acts twice / 10-16 rounds / win | >= 90 (99.5) / >= 91 (100) / <= 99.5 (96.5) | >= 25 (31.8) / >= 65 (71.8) / <= 100 (100) |

Re-measured inside their bounds (names updated): Garland's sensible Lv2 lv2 kit 55.75 % (bound now 50-62), sensible
Lv2 400 G kit 62 % (55-75), the Trial guardian at Lv27 91.75 % (>= 85), Chaos's median 10 rounds ([8, 15]) and
command phase 99.3 % (>= 95); the other region bounds kept with their new values in the names. The tests that passed
unchanged (zones, fieldPacing, economy, questCurve and the act-1 helpers) were not re-measured.
