# Peninsula (act 1): second adversarial playtest, 2026-11-14

**What was tested:** `mainline` `680c95d`, after fix tranches T1–T6 (`docs/FIX_PLAN_PENINSULA.md`).

**Method:** four parallel passes.
- **Live:** an end-to-end play in the browser, starting from New Game with the party named by the tester, through the rescue and the end-of-introduction scene. That covered about 25 real battles, Garland twice, a forced Game Over, Retry, and Load.
- **Town, castle and interiors:** static, using reachability and wander checks, dialog resolved under 5 flag states, and renders.
- **Overworld and temple:** static, with a seeded encounter simulation and renders.
- **Systems, story and balance:** code and data review, plus throwaway tests.

The bar is what an average modern RPG player expects. Classic FF names and lines are fine (personal game). Evidence lives in `/tmp/playtest2/{browser,town,overworld,systems}/`, which is local and not committed.

**Severity:**
- **B:** blocker
- **M:** major
- **m:** minor
- **p:** polish

**Totals:** 0 B, 2 M, 33 m, 34 p, so 69 items after merging duplicates. Each item lists its source finding IDs (BR, SY, TN, OW). Console errors: 0.

**Fixed and verified this pass:** every first-pass blocker and major is confirmed fixed, along with most minors. The full lists are in the source reports.

**Regressions, or first-pass items still open:**
- **ST-3** comes back by a new route (S1).
- **MS-4** is partly open (S4).
- **OW-8** is open (W1).
- **OW-9** and **BA-9** are partly fixed (W8, B11).
- **BA-3's follow-up**, the announcement and animation, is open (B2).

## Save, load and scenes

| ID | Sev | Issue | Where / evidence | Src |
|---|---|---|---|---|
| S1 | M | **Load and Continue put you on a stale tile.** `SceneManager` makes the scene current before `enter()` finishes. The reused `ExplorationScene` keeps its old player, and `update()` writes `game.playerPosition` from it during the async load. Load from Game Over used the death tile (11,6) on castle 2F, then fell back to the stairs. | `SceneManager.ts:55-58`; `ExplorationScene.ts:146-165, 340`; `reentry-race.test.ts`; `148_loaded_slot3.png` | SY-1, BR-1 |
| S2 | m | **Input is live while the field loads or a transition runs.** Cancel opens the field menu over a map that is still loading. During the fade, the hero keeps walking on the old map and the menu can open. Encounters may also start (suspected). | `ExplorationScene.ts:310-314, 438-455`; `151_menu_transition.png` | SY-2, SY-3, BR-24 |
| S3 | m | (suspected) **A double confirm while a lazy scene loads opens it twice.** There is no busy guard and no cached factory promise. | `SceneManager.resolve` | SY-23 |
| S4 | m | **The Save list doesn't refresh after saving.** "Saved." shows over "Slot 1: Empty". | `52_saved.png` | BR-2 |
| S5 | p | **Save and Load screens look the same.** <ul><li>No titles.</li><li>Slots show only "Lv1 0:12": no location, party or date.</li><li>Load overwrites the game with no confirmation.</li></ul> | `SaveScene.ts:49-53`, `LoadScene.ts:42-46` | BR-3, SY-17 |
| S6 | m | **Debug battle scenarios softlock at the end of the battle (dev only).** Nothing listens for the end when the battle was started from the title. | `?scenario=ai_monsters_large`; `139_after_z.png` | BR-4 |

## Battle and balance

| ID | Sev | Issue | Where / evidence | Src |
|---|---|---|---|---|
| B1 | M | **Garland is trivial, and his encounter is easy to sidestep.** <ul><li>At FF1's stats, a level-1 Fight-only party killed him in 4 rounds while taking 10 damage. At level 2 with one member dead, 3 rounds.</li><li>His "attacks grow fiercer" phase changes nothing.</li><li>Talking to him does nothing.</li><li>The trigger is one tile at (11,6). The side tiles and the princess can be reached without the fight.</li></ul> | `enemies.yaml` garland; `temple-of-fiends`; `120_garland_fight.png` | BR-5, SY-10, OW-5, BR-11 |
| B2 | m | **A retargeted attack announces the dead target, and the animation and Miss float aim at the first living enemy instead of the real target.** | `BattleStateMachine.peekNextAction`; `BattleAnimationController.findTargetSprite`; `89_run_after.png` | SY-4, BR-7 |
| B3 | p | **Spells are announced twice, first by id ("casts fire!"), then "casts FIRE!".** Items say "uses item!". | `peekNextAction` `spellName = spellId` | SY-8, BR-8, BR-9 |
| B4 | p | **Heal and buff messages are wrong.** <ul><li>Heals report the raw roll, not what was healed ("recovers 24 HP" for a 1-HP gap).</li><li>The fallen-target line uses the target as its subject.</li><li>A buff on an ally who fell earlier in the round spends the charge silently.</li><li>Tenses are mixed ("recovered 8 HP" next to "recovers 24 HP!").</li></ul> | `SpellExecutor.ts:142-149, 213-219` | SY-5, SY-6, BR-9 |
| B5 | m | **Two members can queue the same last item.** The second gets "Item not in inventory". | `BattleScene.showItemUI`; `battle-edges.test.ts` | SY-7 |
| B6 | p | **Enemy attack animations find the target hero by name,** so duplicate typed names animate the wrong hero. | `BattleAnimationController.ts:225` | SY-9 |
| B7 | p | **Turn order is sorted by agility, not shuffled as in FF1,** so Warriors always act after goblins. The tie-break calls the RNG inside the sort comparator. | `TurnOrder.ts` | SY-11 |
| B8 | m | **Blind and silence have no effect.** It shows in later acts (MUTE, DARK). | `SpellExecutor.ts:88`; `CombatStats` | SY-12 |
| B9 | m | **Difficulty is inverted.** <ul><li>Temple packs of 3–4 skeletons nearly wipe a level-2 party.</li><li>Temple encounters come every 5–10 steps.</li><li>The Thief escaped 8 out of 8 times.</li></ul> | live log | BR-6 |
| B10 | m | **Ally targeting is unclear.** The target cursor and the active-member cursor are the same yellow ▶, and item targeting defaults to the first member, not the most hurt. | `93_item_target.png` | BR-10 |
| B11 | p | **The melee lunge still stops about 250 px short of the target.** | `85_exec_3.png` | BR-12 |
| B12 | p | **The turn list is hard to read:** tiny text, lines cut off, mixed casing. | `85_exec_18.png` | BR-13 |
| B13 | p | **The bottom enemy row's feet touch the bottom strip** (about y 770). | `155_nine.png` | BR-14 |
| B14 | m | **Beach battles put the enemies on open sea.** The `shoreline` backdrop was framed for the party only (a regression from BA-12). | `shoreline_annot.png` | OW-1 |

## Economy, items and menus

| ID | Sev | Issue | Where / evidence | Src |
|---|---|---|---|---|
| E1 | m | **Buying past the 99-item cap still takes gold** ("Bought 1 Potion." at 99). Unequipping into a full stack and chest pickups also lose items. | `ShopScene.ts:153`; `Inventory.ts:10-12`; `EquipScene.ts:139`; `153_bought_over_cap.png` | SY-13, BR-15 |
| E2 | p | **Shop list columns are misaligned,** and the sell list runs the name into the quantity ("Wooden Shieldx2"). | `21_wshop_buy.png`, `33_sold.png` | BR-16, BR-17 |
| E3 | p | **Focus is unclear.** <ul><li>The Buy/Sell menu keeps its ▶ while the item list is active.</li><li>Equip shows three cursors.</li><li>The equip help bar is empty until you highlight something.</li></ul> | `43_equip_weapons.png` | BR-18 |
| E4 | m | **The magic shop learning flow is confusing.** <ul><li>Unlabelled "---" slot rows, and the chosen slot is ignored.</li><li>Spells already known aren't marked.</li><li>The layout differs from the other shops.</li></ul> | `37_wm_bought.png` | BR-19 |
| E5 | p | **Shops give little help.** <ul><li>No owned count.</li><li>No warning for gear nobody in the party can use.</li><li>The town disappears behind a plain navy screen.</li></ul> | `31_chain.png` | BR-20 |
| E6 | m | **The Tent heals silently,** with no confirmation, no HP panel, and the description reverting to the previous item. | `149_tent_used.png` | BR-21 |
| E7 | p | **Field Item menu rough edges.** <ul><li>The target window overlaps the list.</li><li>The cursor resets to the top after each use.</li><li>Weapons and armour are listed as usable, then say "Cannot use".</li><li>The help bar promises "sort", which doesn't exist.</li></ul> | `ItemMenuScene.ts:52-58`; `102_pd_target.png` | BR-22, SY-14 |
| E8 | p | **The Status screen is bare.** <ul><li>About 70 % of it is empty.</li><li>No left/right hint for switching members.</li><li>Ailments aren't shown.</li><li>DEF sums every slot, while battles use armour only.</li></ul> | `StatusScene.ts:49-90`; `48_status.png` | BR-23, SY-21 |
| E9 | p | **Equip reopens with the previous member's stats.** | `EquipScene.ts:68-73` | SY-15 |
| E10 | p | **Order:** the cursor resets after each pick, and the field sprite keeps the old leader until the next map load. | `FieldOrderScene.ts:30-45`; `ExplorationScene.ts:249` | SY-16 |

## Input and audio

| ID | Sev | Issue | Where / evidence | Src |
|---|---|---|---|---|
| I1 | m | **Keys stick after the window loses focus.** The hero keeps walking, because there is no blur or visibilitychange handler. | `InputManager.ts` | SY-18 |
| I2 | p | **Menu and dialog input is basic.** <ul><li>No auto-repeat in menus.</li><li>Dialogs close only with confirm.</li><li>No "more" ▼ marker on dialog boxes.</li></ul> | `Menu.ts:101-117`; `DialogBox.ts` | SY-19, BR-35 |
| I3 | m | **Audio gaps.** <ul><li>The hit and miss SFX never play (the events are never emitted).</li><li>The cast SFX plays when the spell is picked, not when it is cast.</li><li>The `title` track is never played.</li><li>Field, Equip, Magic, Item and Order menus have no cursor sounds.</li></ul> | `Game.ts:124-125`; `BattleScene.ts:329, 348` | SY-20 |

## New game and story

| ID | Sev | Issue | Where / evidence | Src |
|---|---|---|---|---|
| N1 | p | **Naming and class select are rough.** <ul><li>Up from End jumps to "1".</li><li>The header doesn't show the class being named.</li><li>Back resets the class cursor.</li><li>No character preview.</li></ul> | `04_name_del.png` | BR-36 |
| N2 | p | **The opening is 4 pages of text on black.** | `14_open_2.png` | BR-35 |
| T1 | m | **The bridge gate message doesn't change after the King orders the repair.** | overworld gates | BR-31 |
| T2 | m | **The rescue is narration only.** The princess vanishes without a word, the full heal and revive is silent, and the party is left in the temple with encounters on. FF1 warps you to the castle. | `cutscenes.yaml` `garland_defeated`; `122_post_garland.png` | SY-22, BR-34 |
| T3 | m | **Directions don't match the map.** The King says "beyond the forest to the north-west"; the road crosses open grass. The east gate guard says "around the bay". | castle-2f King; `east_gate_guard` | OW-8, TN-9 |
| T4 | m | **The princess's maid says she is "resting"** while the princess stands in the throne room. | castle-2f `princess_maid` | TN-5, BR-32 |
| T5 | m | **A market vendor announces the bridge builders before the King has ordered them** (keyed on PRINCESS_RESCUED, not INTRO_COMPLETE). | `cornelia.py:286-288` | TN-6 |
| T6 | p | **Dialog staleness and duplication.** <ul><li>Lines go stale after Garland: villager, treasury guard, patron soldier, stair guard.</li><li>NPCs keep offering looted chests: fisher's wife, farmer, gardener, apprentice, knight.</li><li>Near-duplicate soldier jokes, and identical throne guards.</li><li>The weaver mentions a "blue" rug; both rugs are red.</li><li>The shrine invites you to rest, but nothing happens.</li></ul> | dialog under the 5 flag states | TN-10..14, BR-33 |

## Town and castle maps

| ID | Sev | Issue | Where / evidence | Src |
|---|---|---|---|---|
| M1 | m | **The castle door guards cut the one-row castle-front street,** so walking to the door takes 53 steps instead of 3. | `cornelia` row 19, guards at (28,19) and (32,19) | TN-1 |
| M2 | m | **The 1F reading gallery is a dead end.** Its east end is the back of the library bookcases. | castle (32–34, 4–5) | TN-2 |
| M3 | m | **The Item and Black Magic shop counters can be walked round** to stand beside the keeper. | `shops.py:59, 100` | TN-3 |
| M4 | m | **Visible floor that can't be reached:** <ul><li>the shrine's side aisles (12 cells);</li><li>the inn's boxed-in cell (10,8).</li></ul> | `cornelia-house-shrine`, `cornelia-inn` | TN-4, TN-21 |
| M5 | m | **Beds and bookshelves block a cell that looks like empty floor** (the art covers about 1.2 cells of a 2-cell footprint). | about 14 instances across interiors | TN-7 |
| M6 | m | **Stray pixel column on every chest frame,** worst on the opened frame. | `characters-ai.png` chest block; `65_fisher_chest_crop.png` | TN-8, BR-29 |
| M7 | p | **Gates and signs.** The city gates are gaps in the wall, and the tavern and shrine have no sign. | | TN-15, TN-16 |
| M8 | p | **Sprite reuse and role mismatches.** `old_man` is used 9 times; the noble uses the villager sprite; the farmer NPC uses the villager sprite. | | TN-17 |
| M9 | p | **Empty or samey spaces.** <ul><li>The cellar and the castle lawn are empty.</li><li>7 of the 16 interiors use the same palette.</li><li>The weapon counter's short arm looks like loose boxes.</li></ul> | | TN-18, 19, 20, 22 |
| M10 | p | **Chest loot repeats.** The knight's gift is a 10 G shop item. | | TN-23 |
| M11 | p | **The north keep door puts you at the far east of the castle grounds.** | `castle_gate` (55,24) | TN-24, OW-13 |
| M12 | m | **The HUD party bar covers the hero and the exit near the bottom of a room.** | inn (6,9), temple (11,20); `56_inn.png` | BR-28 |
| M13 | p | **Castle art details.** <ul><li>The gold heap sticks out around the guard.</li><li>The throne is a dais with no chair.</li><li>The tower's brick border stops short of the screen edge.</li></ul> | `69_treasury.png`, `72_throne.png` | BR-30 |

## Overworld and temple

| ID | Sev | Issue | Where / evidence | Src |
|---|---|---|---|---|
| W1 | m | **The temple icon is tiny and dark,** can't be found at overview scale, and hides behind the hero (OW-8 is still open). | (14–15, 37–38); `112_temple_ext.png` | OW-2, BR-25 |
| W2 | m | **The temple's drawn door sits half a cell left of its warp cell.** | (15,38) | OW-3 |
| W3 | m | **Two invisible walls in the temple hall:** the empty top cells of the broken pillars. | temple (9,10), (14,12) | OW-4 |
| W4 | m | **The encounter counter restarts on every map load,** and the routes to the temple are shorter than the minimum rate, so you usually reach the temple without a fight. | `loadMap` → `resetCounter`; sim | OW-6 |
| W5 | m | **Little enemy variety by region.** There are 4 overworld species, the fields and the approach share 3, and the temple also rolls wolves. | `overworld_zones.py` | OW-7 |
| W6 | m | **The south gate exit is cut off from the west by the city stream,** with no crossing. | (28,47) to (21,55) | OW-9 |
| W7 | p | **The `temple_approach` zone splits a forest 19+ steps from the temple.** | (16|17, 53–62) | OW-10 |
| W8 | p | **The bridge debris is brown wood next to pale stone stubs.** | (29–30, 29–32) | OW-11, BR-27 |
| W9 | p | **The jetty head uses the wrong piece, and the pier leads nowhere in act 1.** | (28,53) | OW-12 |
| W10 | p | **The city gates are hard to read:** notch arches, roads that stop short, and the north entry over the keep's towers. | city icon | OW-13 |
| W11 | p | **Vines hang in mid-air at the tomb.** | (53,43) | OW-14 |
| W12 | p | **The hardest area (the east pocket) has no reward.** | east pocket | OW-15 |
| W13 | p | **The temple floor shows a hard grid, and the temple is small** (14 steps from the door to Garland). | temple | OW-16, OW-17 |
| W14 | p | **Black dither speckle around mountain ranges.** | `112_temple_ext.png` | OW-18, BR-26 |
| W15 | p | **`vendor_f`'s back-frame shawl flickers.** | | note |

## Triage defaults (orchestrator)

1. **B1 Garland:** adopt the tougher variant already simulated in T4 (240 HP, attack 16, 2 hits, no weakness), plus talk-to-fight and a 3-wide trigger. This departs from the FF1 baseline because live play shows FF1's Garland fails the "real check" a modern player expects. The re-measured balance bounds go into `tests/balance/garland.test.ts`. It is reported to the user.
2. **Severity:** every M and m is fixed. The p items are fixed where cheap. Paid-art items (W1 a new temple icon, W8 stone debris, M7 gate art, W15) are attempted only within budget (25 of 100 used) and otherwise recorded.
3. **T2 rescue:** after the cutscene, warp the party to Cornelia Castle (FF1 behaviour), with the princess saying a line before she leaves.
