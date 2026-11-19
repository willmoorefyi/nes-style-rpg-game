# PLAY-R: re-playtest of the PLAY fixes (FX-A to FX-E)

Tester PLAY-R, branch `play-r` from mainline ff48a244 (after the FX-D merge). Dev server 127.0.0.1:5261, own headless
Chromium (Playwright), keyboard input only, `mute=1&trace=1` on every URL. `window.__game` was only read (dialog text,
NPC lists, positions, flags); nothing was written to it, so there was no between-fight healing and no forced battles.
Scratch scripts and logs: `/tmp/play-r/`; screenshots: `~/Desktop/play_r/` (62 files). No game code was changed.

30 runs in total: 30 with 0 console errors, 0 page errors, 0 crashes, 0 lost WebGL contexts, and no unplanned
switch to the Title (the only `switchTo title` after the start was the planned one after the end card).

## Results

| # | item | status | evidence |
|---|---|---|---|
| 1a | King and chancellor after BRIDGE_BUILT (P1-1-02) | FIXED | `w_s1_start`: King, then the foreman `bridge_worker_w` (overworld 92,97), BRIDGE_BUILT true, back to `cornelia-castle-2f`: King (21,8) "The bridge to the north stands, shore to shore. The road beyond is yours."; chancellor (18,10) "The bridge is finished, and the King's builders have come home." (`s1_throne_post.png`) |
| 1b | Pirate count (P1-1-03) | FIXED | `pravoka` `pirate_den_b`: "Nine of us, the Captain counted."; Bikke: "eight blades, my own the ninth"; battle `pirate` x9 |
| 1c | Gift lines use the shared pickup text (P1-1-06, P3-07) | FIXED (Smyth: data only) | Matoya (`matoya-cave`): last line "You received the Herb!" on its own page; prince (`elfheim-castle-chamber`): "You received the Mystic Key!". Smyth: no scenario holds the adamant, so not played; `ert_smyth_forge` now gives `excalibur` with `announce: true` (`assets/data/cutscenes.yaml`) |
| 1d | Western Keep 1F lines before the Marsh Cave (P1-1-07) | FIXED | `w_s5_start` (MARSH_GUARD_DEFEATED false), walked 46 steps from the marsh to the keep: `courtier_vell` "...Until it is found, the throne upstairs stays empty."; `gate_warden` "You will find the chair empty. The king rode to the fens..."; 2F holds `mirror_king` and `page_ilse`, no king (`s6pre_2f.png`) |
| 1e | Elf prince herb line once (P1-1-11) | FIXED | the NPC page "You crush a leaf beneath his nose..." is followed by "The leaf of Matoya's herb crumples to green dust..." (the result, not a second crush) |
| 1f | Warp Cube line after the hand-over (P3-10) | FIXED | `waterfall-cave` automaton (14,4): "The cube leaves the brass hands, and the automaton's lamp-eyes flicker." then "You received the Warp Cube!" |
| 1g | End card after Chaos (P3-06) | FIXED | `w_s30_chaos_door`: Chaos won in 164 s by Fight only (KNGT 183/666, NINJ 11/420, MSTR 260/586, WWIZ 0/303); the two wake-up lines in `cornelia-castle-2f`, then a black card "The road is closed behind you. / The End" (`end_card.png`), then the Title |
| 2a | Iron Sword ATK 13 for 300 G (P1-1-05) | FIXED | `pravoka-weapon-shop` list: "Iron Sword 300G" between Short Sword 550G and Hand Axe 550G (`s2_weapon_shop.png`); items.yaml attack 13 |
| 2b | Pirate fight not won by Fight alone without damage (P1-1-04) | STILL OPEN (left by design) | `w_s2_start` L3, Fight only: won in 46 s, party WAR 59/61, THF 27/41, WHM 37/37, BLM 37/37 (16 HP lost in total; PLAY-1 lost 30). Pirates are 6 HP each. `docs/BALANCE_REPORT_FXB.md` 4.1 left the record unchanged on purpose (shared `pirate` record) and offers `attack` 8 -> 12 if wanted: a user decision |
| 2c | Past-temple refights tougher (P3-04) | STILL OPEN | Field fight `w_s30_start`, `past-temple-1` (19,6), Rime Sovereign II + 2 death knights at L34, Fight only: won in 25 s, KNGT 570 -> 569, nobody else hurt (PLAY-3 saw 570 -> 562). The battle scenarios `w_boss_lich_2`, `_ashen_queen_2`, `_drowned_sovereign_2`, `_hollow_seraph_2`, `w_boss_death_eye` (L37) were all won in 10-27 s; only the Ashen Queen did any damage (WWIZ 152/282). These scenarios may not apply the boss phases, so they are only a lower bound; the field fight is the real repro |
| 2d | Warmech tougher (P3-03) | NOT RECHECKED | No scenario holds Warmech, and it is a 1-in-64 formation; forcing it needs a write to `__game`. FX-B measured Fight-only L32 at 58.8 % (it was 100 %) |
| 3a | Canoe steps roll the zone's roster, not act-1 goblins/wolves (P2-01) | FIXED | `w_s15_start` Crescent (148,124) to the volcano door, 78 steps, 4 fights: ochu x2, red_piranha x3, red_piranha x4, fire_lizard. `w_s17_start` river near (150,148) / (131,150), 6 fights: crocodile, white_crocodile, winter_wolf x2 + ice_gigas, sand_worm x2, manticore, crocodile. `w_s21_start` gorge: crocodile at the first canoe step. No goblin or act-1 wolf in any overworld fight of the whole re-test (26 distinct fight lines) |
| 3b | Tarns get canoe fights | FIXED (Wind; Water river) | `w_s23_start`, Wind tarn (156,10), mode canoe: crocodile x2, red_piranha x4, crocodile, red_piranha x2. `w_s21_start`, Water river (31,20) and (31,23) in canoe: red_piranha x3, crocodile + red_piranha x2. The upper pool (29-33,4-6) has a zone but no walking or canoe path reaches it from Onrac (a path search found none), so it cannot misfire |
| 3c | Flag NPCs appear at once (P3-03, PLAY-2) | FIXED | `bahamut-lair`: after the class change `bahamut` leaves and `bahamut_after`@19,6 is in the live NPC list and talks ("Your new names fit you...") with no re-entry (`s19_throne_after.png`). `giant-tunnel`: after TITAN_FED `ert_giant` leaves and `ert_giant_asleep`@14,6 is there at once (`s12_giant_after.png`). Also `elfheim_prince_awake` replaced the sleeping prince live |
| 3d | No falls to the Title or a black screen (P1-1-01, P3-07) | FIXED (not seen) | 30 traced runs, 0 unplanned scene switches, 0 `pagehide`, 0 errors |
| 4a | Caravan Yes / No before 40,000 G (P2-09) | FIXED (see NEW P3-R2) | `caravan-camp` trader (19,11): after the two lines a box "Pay 40000 G for the Bottle? Gold: 41000 G"; No: "Another time, then.", gold stays 41000, no bottle; asked again, Yes: "You paid 40000 G." then "You received the Bottle!", gold 1000 |
| 4b | Citadel steward pad hint (P3-12) | FIXED | `citadel-1f` `stone_steward`: "A second line runs down the hem: 'Above, most runes only hand you back to the ring. The ones that carry on lie deepest toward the stair you climbed by.'" |
| 4c | Past-temple plaque (P3-05) | FIXED | `past-temple-1` inspect (23,3), from (23,4) facing up: "A plaque under the brazier... 'Two stairs, two houses.' 'What the west stair keeps shut, the east stair opens to those who go down by it.'" (`past_plaque.png`) |
| 4d | Sky castle belt sign | FIXED | `sky-castle-2f` inspect (10,25): "Each belt carries one way. The stair's island is fed from the east..."; (34,25): "A belt does not carry you back..." (`sky_sign.png`) |
| 4e | River step without a canoe (P3-11) | FIXED | `w_s21_neg_nocanoe`, (30,28), press Right: "The water runs too deep to wade. A boat light enough to carry would cross it." (`s21neg_river_line.png`) |
| 5a | Organic coasts from the air (G-1) | FIXED (see NEW P3-R3) | `w_s18_start` airship tour, 15 waypoints, none stalled (`air_*.png`): the Crescent continent, the southern deserts (no straight column at x 132, `air_12_desert_seam.png`), Pravoka's range, the western and north-western coasts are all irregular now. Compiled previews `pv_*.png` |
| 5b | Canal with quays and lock gates; the ship passes (P1-1-10, G-2) | FIXED | `w_s11_start`: boarded at (43,113), sailed (49,93) -> (55,92) -> (61,92) -> (66,95) into the Aldi sea and back west to the ocean (44,98); fights sahagin_chief x3, shark, shark x3. Cobbled quays both sides and two lock-gate towers at each end (`canal_02_mid.png`, `air_06_canal_air.png`) |
| 5c | Melmond and Onrac icons read as towns (P3-13) | FIXED | both are now a walled ring of red roofs (`air_01_melmond.png`, `air_04_onrac.png`) |
| 5d | Ice-cavern-b3 chest (38,8) on frost floor (P3-04, PLAY-2) | FIXED | compiled preview `ice_b3_chest.png`: cell (38,8) is (178,198,207), the same as its floor neighbour (37,8); no pure-white tile |
| 6 | Console in every run | FIXED | 0 errors in all 30 runs (only headless GL notices) |

## New findings

| id | sev | where | repro | expected | actual |
|---|---|---|---|---|---|
| P3-R1 | P3 (unconfirmed timing) | overworld, `w_s18_start` (75,32), airship | load the scenario, wait about 3 s, press confirm once to land | the airship lands on the meadow | the first confirm does nothing (no line, still airship) and the second lands. Seen 2 of 2 loads. Probably the same family as P3-06 / P3-01 (first press swallowed after a scene load), but it was not closed for the airship |
| P3-R2 | P3 | `caravan-camp` trader (19,11), `w_s22_start` | talk to the trader with 41,000 G and keep pressing confirm | a careless press should not spend 40,000 G | the purchase box opens with the cursor on Yes, so one confirm press too many after the last line buys the bottle. The "You paid 40000 G." line now says what happened, but the plan's worry (a player reading the trader loses the purse) still applies to a player who mashes. `ConfirmBox` has `defaultNo` (used before a save overwrite); the purchase could use it |
| P3-R3 | P3 | overworld EARTH | fly over (25, 70-140) and the isthmus (48-62, 76-110) | organic landforms | the western continent's north-south ridge is still a ruler-straight 3-4-cell column from top to bottom, the isthmus east and west coasts (x 48 and x 61) are straight vertical lines for about 30 rows, and the block of mountains north of the canal has a square outline (`pv_west.png`, `air_06_canal_air.png`). Inside the canal, beach scallops line the foot of both cobbled quays, which reads oddly for a dug cut |
| P3-R4 | P3 | Melmond and Onrac icons | view either town from the air | town dressing | each town icon sits in an exact 3x3 grid of bushes and boulders, which reads as stamped rather than placed (`air_01_melmond.png`, `air_04_onrac.png`) |

## Not covered

- Warmech (item 2d): there is no scenario for it, and forcing it needs a write to `__game`.
- Smyth's Excalibur line in play: no scenario holds the adamant. Only the data was checked.
- The four past-temple refights after floor 1 were played only as battle scenarios. The field gauntlet (PLAY-3's
  chained, no-heal floors 1-5) was not re-run.
- The Water upper pool (29-33,4-6) cannot be reached, so no fight there was possible.
