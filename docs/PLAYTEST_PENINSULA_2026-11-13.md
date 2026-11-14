# Peninsula phase (act 1) — adversarial playtest defect list

**Date:** 2026-11-13, at commit `ff04e38`.

**Scope:** everything reachable before the north bridge:
- title and new game;
- Cornelia town, its six interiors and the four castle floors;
- the overworld peninsula;
- the Temple of Fiends, Garland, the princess rescue and the return to the King.

**Method:** four parallel passes:
- the Cornelia town and castle map data, with reachability and chokepoint checks;
- the overworld map data and art, with a seeded encounter distribution;
- systems, story flags and balance, with scratch simulations using the real `BattleStateMachine` and `DamageFormula`;
- a live browser play-through.

**Bar:** what an average player of a modern RPG (SNES-era remaster quality) expects.

**Status:** list only. Fixing is a later phase.

## Severity

| Level | Meaning |
|---|---|
| **B** (blocker) | The act can't be completed, or the game breaks. |
| **M** (major) | Clearly broken or misleading, and most players will hit it. |
| **m** (minor) | Wrong, but has a workaround or is rarely seen. |
| **p** (polish) | Looks cheap or inconsistent. |

**Totals:** 4 B, 31 M, 36 m, 25 p (96 defects, plus one context row, EB-11).

**Notation:**
- Coordinates are tile `x,y` on the compiled map in `assets/maps/ai/<id>.yaml`.
- U1–U5 tag the five issues the user reported.
- Evidence (screenshots, crops and scratch scripts) is in `/tmp/playtest/{browser,town,overworld}/`. It is local and not committed.

---

## 1. New game and opening

| ID | Sev | Defect | Where / evidence |
|---|---|---|---|
| NG-1 | B | **A new game spawns in a sealed 22-cell pocket outside the city wall** (x 0–2, y 0–17) with no exit. Only a reload escapes. | `cornelia` (1,1); `ExplorationScene.ts:155-159, 196-200`. `safeSpawn` only moves the player when (1,1) is blocked. Comment says "start at the town's first entrance". Screenshots `08-start.png`, `09-outside-wall.png` |
| NG-2 | B | **New Game after a Game Over keeps the old dead party.** `party.add` fails silently because the party is full. Gold stacks (old + 100). Flags, inventory and play time carry over, and the player spawns where they died. | `PartyCreationScene.ts:256-262`; `PartyManager.ts:9` |
| NG-3 | M | **Characters can't be named, and duplicate classes share a name** (two "FGHTR"). Battle animation finds sprites by name, so the second Warrior's attacks animate the first. | `PartyCreationScene.ts:15-22`; `BattleAnimationController.ts:56-58` |
| NG-4 | M | **Mages start with 0 spell charges, and a spell bought in a shop has 0 charges until you rest at the inn.** | `Character.ts:34`; `MagicShopScene.confirmPurchase` |
| NG-5 | M | **Starting resources are very thin:** 100 G for the whole party, no gear, no spells. One Lv1 spell costs 100 G and a basic kit about 620 G. FF1-style starts give 400 G. | `PartyCreationScene.ts:24` |
| NG-6 | m | The confirm screen header reads "Choose class for slot 5/4". | `06-after-party.png` |
| NG-7 | m | The opening is two lines of text. Nothing tells the player to see the King, and there are no portraits. | `02-party.png` |
| NG-8 | M | **Not original content:** the title reads "FINAL FANTASY" (trademark), and Garland's line "I, Garland, will knock you all down!" is quoted from the original game. | `TitleScene.ts:30`; Temple NPC dialog |
| NG-9 | m | **Very short key taps are dropped:** keydown and keyup within one frame never register on the title or menus. | `InputManager.ts`; `03-tap.png` |

## 2. Story, flags and progression

| ID | Sev | Defect | Where / evidence |
|---|---|---|---|
| ST-1 | B | **The north bridge can never be crossed, even with BRIDGE_BUILT.** Rows 10–11 at x 28–29 are open ocean between two bridge stubs, and nothing changes tiles, art or collision when a flag is set. A flood fill confirms `north_shore` can't be reached. | overworld (28–29, 9–12); `assets-src/maps/overworld.yaml:16-19, 94-95`; `85-bridge-built.png` |
| ST-2 | B | **Battles never end after the exploration scene is re-entered** (Game Over → Continue, or field Load). `battleEnd` listeners are added only in the constructor and removed in `exit()`. The victory screen waits forever, and post-battle cutscenes never run, so beating Garland after a reload never rescues the princess. | `ExplorationScene.ts:133-134, 551-552`. A scratch test counted handler calls: 1 → 0 |
| ST-3 | M | **Loading a save can put you on the wrong map or tile.** `savedPosition`, recorded when a battle starts, is never cleared after the battle and overrides the save. `KeyItemGateSystem` and `VehicleManager` keep the inventory and flags from before the load. | `ExplorationScene.ts:121-128, 141-146` |
| ST-4 | M | **BRIDGE_BUILT is set in the Temple the moment Garland dies,** so reporting to the King is optional and gives no reward. The King and chancellor then say the bridge is "being raised" or "soon finished", while the old man says it is "complete". | `cutscenes.yaml` `garland_defeated`; NPCs in `cornelia`, `cornelia-castle-2f` |
| ST-5 | M | **Defeated Garland and the captive princess stay in the room until you re-enter it.** Both repeat their pre-fight lines, and the princess briefly exists in two places at once. | `MapLoader.ts:46-47` (`hideIf` is checked only at map load); `82-after-garland.png` |
| ST-6 | m | **Garland's phase change never fires.** No boss pattern or AI is passed, so he is a plain random attacker. | `BattleTrigger.triggerBattle`; `BattleStateMachine.checkBossPhaseTransition` |
| ST-7 | m | **Level-up messages are lost.** With a post-victory cutscene (Garland) none are shown. When several members level up together, each one replaces the last, so only the final "reached Level N" shows. | `BattleTrigger.ts:96-106`; `DialogManager.start` |
| ST-8 | m | **No guidance after the rescue:** only "Seek the four crystals", with no destination and no end-of-act beat. | NPC dialog |
| ST-9 | m | **Some castle lines assume you have already met the King** ("The King ordered the storeroom below opened for you", "by royal order"). They are unconditional. | 1F `treasury_guard` (36,23); cellar `cellar_steward` (13,6) |
| ST-10 | m | **Some dialog is keyed to the wrong flag:** <ul><li>`tower_sage` says "So the princess gave you the lute" on PRINCESS_RESCUED, not GOT_LUTE;</li><li>the princess keeps offering the lute after giving it;</li><li>`castle_cook` has no line for after the rescue;</li><li>after the rescue `garden_maid` says the princess "walks in the gardens", but she never appears there.</li></ul> | `cornelia-castle-tower`, `-2f`, `-castle`, `cornelia` |
| ST-11 | m | (suspected) A random encounter can fire on the same step as a transition, gate or scripted trigger, because encounters are rolled in `player.update()` before those checks. The fade may keep running underneath the battle. Expected on about 1 in 22 warp-tile entries. | `PlayerController.ts:103`; `ExplorationScene.ts:327-352` |
| ST-12 | m | **Opened chests still look closed** (the castle cellar chests are NPCs). They also turn to face the player. | `ExplorationScene.ts:301-311`; `46-chest2.png` |

## 3. Cornelia town

| ID | Sev | Defect | Where / evidence |
|---|---|---|---|
| CT-1 (U1) | M | **10 houses have doors that lead nowhere.** You can walk into the door art and nothing happens. The door cells are at (46,36), (52,37), (50,49), (44,56), (50,56), (15,36), (14,63), (6,41), (46,60) and (35,62). | 10 `type: house` objects with no `enter:` in `assets-src/maps/cornelia.yaml`; `build_map.py:435-436` always makes the door walkable; `28-deaddoor.png` |
| CT-2 (U2) | M | **Wandering NPCs can walk on water, and their wandering has no radius limit.** The NPC walkability check uses no movement mode, so they get into the moat, river and pond, out through the gates, and onto doors and chokepoints. `mage_student` spawns beside the pond at (9,55); once in the water, nobody can stand next to them to talk. The hint `guard` (33,50) can drift out of town. | `ExplorationScene.ts:362-363`; `NPC.ts:150-163` |
| CT-3 (U2) | M | **Single-tile chokepoints that wandering NPCs plug:** <ul><li>the castle door approach, (30,19) and (30,20);</li><li>the tile in front of every shop door: (22,38), (38,38), (44,44), (6,54), (13,54), (24,60);</li><li>the north-postern route, (8,19)–(8,23), (9,17)–(9,18) and the bridge at (8–11,25). `gardener` spawns at (5,23), on this route.</li></ul> | `/tmp/playtest/town/choke.py` |
| CT-4 (U2) | m | **The two castle door guards narrow the 3-wide bridge to a single tile, (30,19).** `castle_door_guard_e` (31,19) also seals off the 19-cell ledge at (32–50,19). | `cornelia` |
| CT-5 | m | **NPCs can step into the tile the player is moving into,** so the two sprites overlap. | `ExplorationScene.ts:364` checks the tile the player is leaving |
| CT-6 | M | **A walkable ring of grass surrounds the city outside the walls (545 cells), with invisible map-edge walls.** Only 9 of the 186 walkable edge cells actually leave the map. | `/tmp/playtest/town/reach.py` |
| CT-7 | m | **The castle precinct's east gate (61,24–25) is one-way.** It leads out to the overworld, but nothing leads back. The `castle_gate` entrance (55,24) is never used. | `cornelia` and overworld transitions |
| CT-8 | p | **Dead-end roads and paths:** <ul><li>the north postern path (6–7,0–9);</li><li>row 25 at (4,25);</li><li>row 51 at (53,51);</li><li>row 60 at (53,60);</li><li>a stray sand patch at (33–35,56).</li></ul> | `cornelia_small.png` |
| CT-9 | p | **Things that look interactive aren't:** <ul><li>the signpost at (32,66) has no text;</li><li>the two market vendors at (24,41) and (37,41) use the shopkeeper sprite but sell nothing.</li></ul> | `48-southroad.png` |
| CT-10 | m | **Dialog problems:** <ul><li>a villager breaks the fourth wall ("...in the first dungeon!");</li><li>duplicate lines: `castle_door_guard_e` = `hall_guard_e`, and `garden_maid` = `castle_maid`.</li></ul> | `cornelia` NPCs |
| CT-11 | m | **Wandering NPCs move off just as you reach them,** so talking takes several tries. | `11-oldman.png` |

## 4. Shop and inn interiors

| ID | Sev | Defect | Where / evidence |
|---|---|---|---|
| IN-1 | M | **The overworld theme plays in every shop and the inn,** although a `shop` track exists. | No `music:` key in the 6 maps; fallback at `ExplorationScene.ts:184` |
| IN-2 | M | **Small rooms are pinned to the top-left, with a black or navy void over the rest of the screen.** 10x8 rooms fill 960x768 of 1920x1080. The 16x13 tower has a black strip. | `Camera.ts:63-70` (clamps to 0 and never centres); `13-weaponshop.png` |
| IN-3 | m | **The HUD shows raw map ids:** CORNELIA-WEAPON-SHOP, CORNELIA-INN, TEMPLE-OF-FIENDS, OVERWORLD. | No `name:`; `ExplorationScene.ts:222` |
| IN-4 | p | **Awkward greetings:** "Welcome to the White Magic!" and "Welcome to the Black Magic!" | keeper dialog |
| IN-5 | p | **All six interiors use the same 10x8 template** (counter on row 4, exit at (4–5,7)). | `shops.png` |
| IN-6 | m | **The inn gives no feedback:** <ul><li>no rest message or fade;</li><li>the Yes/No box hides the map and shows no gold;</li><li>it closes silently when you can't pay;</li><li>it doesn't clear status effects, which persist through saves (latent until something inflicts status).</li></ul> | `InnScene.ts:52-60`; `30-innmenu.png` |

## 5. Cornelia Castle (1F, 2F, 3F tower, B1 cellar)

| ID | Sev | Defect | Where / evidence |
|---|---|---|---|
| CA-1 | m | **The top cells of every stairwell are walkable,** so you walk onto the drawn pit before going down. There is an unkeyed black corner at 2F (22,24), 1F (40,28) and tower (8,9), and the stair art is in oblique 3/4 view, unlike the top-down style of everything else. | `stairs_down` `walkable_rows: [0,1]` |
| CA-2 | p | **Every castle stair and the castle entrance use the shop-door zoom effect.** | `ExplorationScene.ts:413` (`startsWith('cornelia-')`) |
| CA-3 | p | **The 1F and 2F stairs don't line up:** you leave 1F at the north end of the hall, (21–22,8), and arrive on 2F at its south end, (21,23). | |
| CA-4 | p | **A barrel half-blocks the treasury doorway** at 1F (32,25). | `assets-src/maps/cornelia-castle.yaml:490` |
| CA-5 | p | **The King stands beside the throne** (20,8), not on it. | `41-throne.png` |
| CA-6 | p | **Floor names are inconsistent:** "Cornelia Castle", "Cornelia Castle 2F", "Castle Cellar", "East Tower". | |
| CA-7 | p | **Empty rooms:** <ul><li>the cellar;</li><li>the 1F north gallery (12–31,3–5);</li><li>the 2F tower-stair room (34–41,6–14);</li><li>a "treasury" with no treasure.</li></ul> 1F and 2F also share the same carpet layout. | `37-castle1f.png`, `40-castle2f.png` |

## 6. Overworld

| ID | Sev | Defect | Where / evidence |
|---|---|---|---|
| OW-1 (U3) | M | **The road network doesn't make sense:** <ul><li>two parallel west roads, 3 tiles apart, form a pointless loop (x 17–28, y 27–30);</li><li>an orphan stub at (30,30);</li><li>the east road crosses the river and stops after one cell at (40,31);</li><li>the temple road stops 3 tiles short of the temple door;</li><li>road cells hidden under the city icon (x 26–28, y 27–30) make the outside segments misalign.</li></ul> | `assets-src/maps/overworld.yaml`; `overview.png`, `c_city_roads.png`, `50-overworld.png` |
| OW-2 (U3) | M | **The north road junction (28,27) is a warp tile into Cornelia,** and the west road on row 27 runs into a blocked road cell at (26,27). Reaching the bridge without entering town means crossing grass. | `o_city.png` |
| OW-3 | m | **The city icon's warp cells don't match its art:** <ul><li>the north warps sit on the flag tips;</li><li>the drawn gate (28,28) is blocked;</li><li>the W and E gates are notches in the wall curve;</li><li>the whole bottom row is warp tiles;</li><li>there is no upper-east gate, though the town has one (CT-7).</li></ul> | `z_city.png` |
| OW-4 (U4) | M | **Mountains are hard-edged blocks with one repeated peak sprite,** on straight grid outlines with no foothills. | `build_map.py:533-538`; `r_nemtn.png`, `r_wmtn.png` |
| OW-5 (U4) | M | **Coast, sand and river edges follow the grid:** <ul><li>square notches on the south coast at (13–14,38–39), (17–19,39–41), (24–27,40–41) and (44–46,33–36);</li><li>a straight sand–grass edge with no blend;</li><li>stair-stepped river bends at (40–41,25–28) and (39–40,28–29);</li><li>a dead-straight strait across the full width (rows 9–12);</li><li>blocky forest outlines with a tan fringe.</li></ul> | `r_sw.png`, `o_river.png`, `58-eastbridge.png` |
| OW-6 | m | **The river is broken at the east bridge.** The channel is offset one column on either side of the bridge at (38–39,31), and the river starts abruptly in grass at (39–40,23) with no source. | `z_eastbridge.png` |
| OW-7 | m | **Invisible walls on open ground:** <ul><li>(10–11,18) above the temple;</li><li>(26,27) on the road;</li><li>(29,27), (26,28) and (26,29), the grass corners of the round city icon's square footprint.</li></ul> | `o_west.png` |
| OW-8 | m | **The temple, the act's main dungeon, is a tiny icon:** about 57x56 px in a 96x96 footprint, smaller than the hero. | `landmarks.json` `temple_icon`; `65-temple-ext.png` |
| OW-9 | m | **The broken bridge looks like two intact piers,** with no snapped planks, pilings or debris. The gate message is fine; the art contradicts it. | `z_bridge_raw.png` |
| OW-10 | m | **[DEFERRED — open] Vehicles sit on the wrong terrain:** the ship at (30,38) is on grass, and the canoe at (37,36) is on river the player can't walk onto, so it can never be boarded. This is latent until later acts. | overworld `vehicles` |
| OW-11 | m | **The east bridge leads to an empty 85-cell pocket** (x 38–47, y 21–37) with nothing in it. | |
| OW-12 | p | **Stray single cells:** a lone mountain at (9,35); unreachable sand at (8,35); a 1-tile sea inlet at (6,29–30). | `r_sw.png` |
| OW-13 | p | **The city icon shows a river that connects to nothing.** | `z_city.png` |
| OW-14 | p | **The north continent touches the world edge** at y=0. | |
| OW-15 | p | **The geography reads as an island, not a peninsula,** and the only "where next" cue is the north road. The temple sits off-road. | `overview.png` |

## 7. Temple of Fiends

| ID | Sev | Defect | Where / evidence |
|---|---|---|---|
| TF-1 | p | **Black void corners** at the top left and right of the map. | `69-temple.png` |
| TF-2 | m | **The walls and the floor share one cracked texture,** so it's hard to tell where you can walk. | `75-garland-talk.png` |
| TF-3 | p | **The battle background is a polished blue-and-gold palace hall,** not a ruin. | `73-garland.png` |

(See ST-5 and ST-6 for Garland himself.)

## 8. Encounters and balance

| ID | Sev | Defect | Where / evidence |
|---|---|---|---|
| EB-1 (U5) | M | **Battles all feel alike.** The whole overworld has one encounter table: 7 formations from 4 species, at most 2 enemies each, with no regional or terrain zones (`MapData` supports only one list). Pirates and skeletons appear right next to town. "Always two wolves" was **not reproduced**: 5,000 seeded rolls, 100,000 simulated steps and 12 live fights gave the expected mix, with wolf+wolf at about 12%. | `assets-src/maps/overworld.yaml:96-111`; `EncounterTable.ts`; `/tmp/playtest/overworld/enc.test.ts` |
| EB-2 | M | **Encounters trigger on any tile:** roads, both bridges, the gate tile and the city and temple warp tiles. Bumping into the north gate counts as a step. | `EncounterSystem` never checks terrain |
| EB-3 | M | **The XP curve is far too slow for act 1:** <ul><li>Lv2 needs 151 XP, but a battle gives about 3.2 XP per member;</li><li>reaching Lv2 takes about 47 battles, and earning the gear money about 54;</li><li>Garland gives only 125 XP each;</li><li>live: 12 fights left everyone at 45 XP.</li></ul> | `Character.ts:17-24` (`25·lvl^2.6`); `enemies.yaml` |
| EB-4 | M | **Black magic does absurd damage:** <ul><li>L1 FIRE deals 300–600, against goblins with 20 HP;</li><li>LIT deals 105–135 to Garland (200 HP), so two casts always kill him;</li><li>CURE heals about 112 at Lv1;</li><li>`magicDefense` is never used.</li></ul> | `DamageFormula.calculateMagicDamage` (`power × INT / targetINT`, with enemy INT 1–5) |
| EB-5 | M | **SLEP disables any enemy permanently, Garland included:** 100% hit chance, no duration, and damage never wakes the target. Simulated: Garland acted 0 times in 15 rounds. | `SpellExecutor.ts:195`; `StatusEffects.onHit` never called |
| EB-6 | M | **RUSE and LOCK do nothing,** because evade and hit modifiers are never passed to the damage roll (a flat 80% hit chance). | `SpellExecutor` `BUFF_VALUES` / `DEBUFF_VALUES`; `executePartyAttack` / `executeEnemyAttack` |
| EB-7 | M | **No body armour for mages exists in any shop,** so Garland hits them for exactly their 25 max HP. | `shops.yaml` `cornelia_armor` |
| EB-8 | M | **The Monk has no usable gear or role:** leather armour excludes the Monk, nunchaku are in no shop, and there's no unarmed bonus. | `items.yaml`; `classes.yaml` `usableEquipment` unused |
| EB-9 | m | **The Thief has no niche:** luck is unused, crits are a flat 1/32, and Run is broken (BA-1). | |
| EB-10 | p | **Enemy damage never varies** (always `atk − def + 1`), and there are never more than 2 enemies. The design doc says 1–9. | `executeEnemyAttack` (`level: 1`) |
| EB-11 | — | **Garland win rates, simulated (2,000 runs each):** <ul><li>L1 with 100 G gear: 0.1%;</li><li>L1 with full gear, Fight only: 15%;</li><li>L1 with full gear, LIT and CURE: 94.5%;</li><li>L2 with full gear: 96%;</li><li>L3: 100%.</li></ul> Live: a fresh party is wiped in 6 turns. *Context for EB-3/4/5 — the curve swings from impossible to trivial.* | systems scratch sim; `78-gameover.png` |

## 9. Battle

| ID | Sev | Defect | Where / evidence |
|---|---|---|---|
| BA-1 | M | **Run never works.** "Escaped!" is shown and then the battle continues, because the state is overwritten to `resolution`. Even once fixed, `onBattleEnd` would treat any `victory: false` as Game Over. | `BattleStateMachine.ts:273, 404-406`; `BattleTrigger.ts:110` |
| BA-2 | M | **After every round the battle silently waits for a key press,** with an empty message box, no prompt and no menu. "Victory!" also appears only after you press a key. | `74-resolution-stall.png`, `55-victory.png` |
| BA-3 | m | **A single-target spell on an enemy that already died spends the charge.** There's no retarget, and the "defeated" text repeats. | `SpellExecutor.ts:170, 259, 278, 307` |
| BA-4 | m | **Tent and Cabin are listed in battle Items but fail** ("Cannot use this item"), wasting the turn. | `ItemSelectionUI.ts:36-38` |
| BA-5 | m | **Phoenix Down can't target fallen allies in battle.** | `BattleScene.showItemUI` (`revive = false`) |
| BA-6 | p | **A stale message replays after "No spells available."** | `BattleScene.showSpellUI` / `advanceMessage` |
| BA-7 | m | **An empty target box stays where a dead enemy was.** | `55-victory.png` |
| BA-8 | m | **Hard to read:** <ul><li>the action log text is about 8 px;</li><li>damage numbers are tiny;</li><li>the party boxes are tall and mostly empty;</li><li>the active hero's alpha pulses to 0, so they vanish.</li></ul> | `54-exec.png`, `52-crop.png` |
| BA-9 | p | **The melee lunge stops about 400 px short of the target,** and "missed!" shows before the swing ends. | `81-attackanim.png` |
| BA-10 | p | **The victory line shows total XP, not XP per member.** Party Order is cosmetic (no front or back rows). | |
| BA-11 | p | **Game Over says "Press START",** but no key is labelled START (Enter works). | `78-gameover.png` |
| BA-12 | p | **Beach battles use the desert background** (sand compiles to Desert), and `shoreline.webp` is unused. The forest-edge battle used plain grass. | `battleBackgrounds.terrain` |
| BA-13 | m | (suspected) **The battle-start flash may leave frames on the field after a battle** (`startBattleFlash` runs before an uncached `loadYaml`). | |

## 10. Menus, shops and save

| ID | Sev | Defect | Where / evidence |
|---|---|---|---|
| MS-1 | M | **Equip lets any armour go in any armour slot.** For example, 3 Chain Mail gives a Lv1 Warrior DEF 45, and a Cap can go in the body slot. | `EquipScene.ts:12, 86-87`; `Character.equip` has no slot check |
| MS-2 | M | **The shop comparison ignores who can equip the item** (it shows "+9 Rapier" for mages), and there is no "can't equip" marker. | `ShopScene.updateDetailPanel`; `16-buy.png` |
| MS-3 | M | **Field CURE revives the dead,** and it heals a different amount from battle CURE (a flat 30 against about 112). Tent also revives at 50%. Field magic gives no feedback, and does nothing silently when the character has no spells. | `FieldMagicScene.ts:120-121`; `ItemEffects.ts:24-25` |
| MS-4 | M | **The Load and Save slot lists are stale.** They are built once, so a newly saved slot shows as Empty in Load. Saving gives no "Saved" message, and a failed save is silent. Save is greyed out in the streets. | `LoadScene.ts:18-29`; `SaveScene.ts:22-26`; `34-save.png` |
| MS-5 | m | **Shop layout problems:** <ul><li>the comparison panel overlaps the list border, and the last value is clipped;</li><li>the quantity picker has no label or total;</li><li>there's no purchase confirmation;</li><li>the sell cursor resets after each sale.</li></ul> | `16-buy.png`, `17-qty.png`, `20-sold.png` |
| MS-6 | p | **The magic shop's "learned X!" message is wiped immediately.** | `MagicShopScene.ts:182-183` |
| MS-7 | m | **Field menus are bare:** <ul><li>no party, HP, gold or time panel;</li><li>the item target list has no HP;</li><li>item descriptions just repeat the name;</li><li>Status shows no XP to next level, no spells and no charges;</li><li>Equip has no preview while browsing, and its slot labels are raw keys ("weapon:");</li><li>"Config" does nothing.</li></ul> | `21-menu.png`, `70-items.png`, `23-equip2.png` |
| MS-8 | m | **Item code doesn't match the data and docs:** <ul><li>Hi-Potion heals a hard-coded 150, where the data says 120;</li><li>Ether costs 150 G in the data but 500 in the docs;</li><li>Tent works anywhere;</li><li>Antidote is used up even when nobody is poisoned;</li><li>Potion reports "30" even when the heal is capped.</li></ul> | `ItemEffects.ts:64` |

## 11. HUD and presentation

| ID | Sev | Defect | Where / evidence |
|---|---|---|---|
| UI-1 | p | **The map label and the gold HUD are bare text with no panel,** drawn over sprites and battlements. | `08-start.png`, `36-castle-ext.png` |
| UI-2 | p | **The market vendors reuse the weapon-shop keeper's sprite.** | `48-southroad.png` |

---

## Triage decisions (user review)

| ID | Decision |
|---|---|
| NG-1 | Play a short opening cutscene, then start the party at the south (bottom) gate entry into Cornelia. |
| NG-2 | One full game-state reset for every New Game. For the Game Over flow, see the next row. |
| ST-1 | Planned: a cutscene after the rescue where workers build the bridge (the animation doesn't exist yet; build it later). For now, end act 1 with a "congratulations, the introduction is complete" beat. The bridge stays closed. |
| ST-2 | Find the root cause and fix it; ST-3 and MS-4 share it. |
| NG-2 (Game Over) | Add a "Retry battle" option that restores the party, inventory, map and position as they were when the battle started. Keep Load and Title as the other choices. |
| CT-1 | Build real interiors for all 10 houses. |
| EB-2 | No encounters on warp (transition) or gate tiles. Roads and bridges keep them. |
| EB-3 to EB-10, NG-4, NG-5 | Use the original FF1 numbers as the tuning baseline for XP, gold, spell power, status hit rates and starting gold. |
| CT-6 | Make every walkable edge cell of the town map an exit to the overworld. |
| Minors (default) | Plain bugs: fix as proposed in the review. NG-7, ST-8, ST-11, CT-7 and EB-9 are covered by the NG-1, ST-1, EB-2, CT-6 and FF1-baseline decisions. |
| OW-8, OW-9 | Generate new art with Gemini: a temple icon that fills its 2x2 footprint, and broken-bridge stubs with snapped planks and debris. |
| OW-10 | **Deferred, still open.** The ship and canoe are on the wrong terrain. Fix it when vehicles are used in a later act. |
| OW-11 | Put a small landmark in the east pocket: a tomb that, when interacted with, says "Here lies Erdrick". |
| MS-7 | A modern-style field menu redesign: a party panel with HP/MP, level and XP to next level, plus gold and play time, and real descriptions. No portraits for now; show the data. |
| BA-8 | Bigger battle text, plus a compact party HP panel. |
| Polish (default) | Fix as proposed in the review. EB-10 and BA-10 are covered by the FF1 baseline, which includes enemies preferring the front slots. |
| CT-8 | Connect the dead-end paths to a garden or a gate. Not every path needs a real destination. |
| CT-9, UI-2 | Market vendors become townsfolk with market chatter. Generate a few new townsfolk sprites for variety. |
| IN-5, CA-7 | Give each shop its own layout, and give empty rooms a purpose: real chests in the cellar, treasure in the treasury, a library in the 1F gallery. |
| TF-3 | Bring in the 21 unused hand-made backgrounds from `~/temp/ffgame-assets/tiles/backgrounds/hd/` through `tools/stage_backgrounds.py`. For the Temple of Fiends, use `evil-temple-hd.png` or `abandoned-castle-hd.png`, compared on the stage. Use `dark-forest`, `town` and others where they fit. The source images stay outside git, as now. |
| OW-15 | Make the start area part of a larger landmass. An impassable mountain range seals the land route, so the bridge stays the only way out, as on the classic world map. Use an original coastline and range layout built on that idea, not a copy of the original map. |
| NG-8 | Won't fix. This is a personal game that won't be redistributed, so classic names and lines are welcome. |

## Notes for planning the fix phase

- **Make the act completable first:** NG-1, NG-2, ST-1, ST-2. Then fix ST-3, ST-4 and ST-5, because they corrupt the save and the story.
- **Several defects share a root cause:**
  - map compiler (`build_map.py`): CT-1, OW-2, OW-3, OW-4, OW-5, OW-7, CA-1;
  - NPC movement rules: CT-2, CT-3, CT-5, CT-11;
  - scene re-entry and cached-scene state: ST-2, ST-3, MS-4;
  - status and magic maths: EB-4, EB-5, EB-6.
- **Fix balance as one tuning pass after the systems bugs:** EB-3 to EB-10 and NG-4/NG-5. Fixing EB-4 and EB-5 alone moves Garland from trivial to very hard.
- **Checked and clean:** collision matches the art on every castle floor and interior; all transitions have walkable, correctly facing arrival tiles; the console showed 0 errors and 0 warnings; walking ran at 120 fps (p99 10.3 ms); the four temple chests work; and the King and princess return scene plays.
