# PLAY-2 fix list (pass W, stages S11-S22)

Tester PLAY-2, branch `w-play2` from mainline 64be8290, dev server 127.0.0.1:5245, `mute=1` on every URL, own headless
Chromium driven by keyboard only (`window.__game` is only read). No game code changed. Screenshots and logs were in
`/tmp/w-play2/` and were lost in the reboot; where a row cites one, re-take it on the re-walk (status column).

Harness limits (so a reader can weigh the rows): the bot fights by pressing confirm (Fight, default target) and, in
the first runs, never healed; its Esc > Items heal routine did not open the field menu (still being debugged), so
"party wiped" rows are NOT findings. Wandering NPCs and a few counter NPCs could not be reached by the path finder.

Status key: DONE = played and passed; PART = played in part; TODO = to be played after the reboot.

## Stage status

| Stage | Scenario | Status |
|---|---|---|
| S11 | w_s11_start | DONE (Melmond, B1-B3, vampire + 3 mummies won at L13, ruby given) |
| S12 | w_s12_start, _neg_noruby | DONE (giant fed, tunnel, Sarda, rod; neg: giant blocks, west exit unreachable) |
| S13 | w_s13_start | DONE (seal, B4, B5, lich, altar; flags in order SEAL > CAVE_COMPLETE > CRYSTAL_LIT) |
| S14 | w_s14_start, w_s14_early | DONE (elder gives canoe; stepping onto the lake gives mode canoe; early visit: elder refuses, no canoe) |
| S15 | w_s15_start | DONE with a healing player (Hi-Potions between fights): queen won at full party HP, 0 game overs, FIRE_CRYSTAL_LIT set; the earlier wipes were the bot not healing |
| S16 | w_s16_start | DONE (pit to B1 pocket, Hesk breaks the shelf, eye won, levistone) |
| S17 | w_s17_start, _neg_nostone | DONE (hatch, airship, forest/desert refuse landing, grass lands; neg: hatch asks for the stone) |
| S18 | w_s18_start | PART (1F throne, 2F entered; lattice and 3F boss TODO) |
| S19 | w_s19_start | DONE (class change applies) |
| S20 | w_s20_start | DONE (map is onrac at (23,2); inn 500 G, shops, healer, shipwright; the gangway (38,27) is barred without oxyale with the right message) |
| S21 | w_s21_start, _neg_nocanoe | DONE (east step at (30,28) gives canoe, 17 cells up the gorge, automaton gives the cube; neg: no route onto the river, cave unreachable) |
| S22 | w_s22_start | DONE (bottle bought, gold 41000 -> 1000, WAT_O_BOTTLE_BOUGHT; see P2-09) |

## Findings

| id | sev | stage | map + cell | repro | expected | actual | evidence |
|---|---|---|---|---|---|---|---|
| P2-01 | P2 | S14-S17, S21 | overworld, first step onto or off a river/lake cell with the canoe (seen near (150,148) and (131,150)); canoe-reachable lake cells with no `modes` zone: (29-33,4-6), (155-157,10), (20-22,20-21) | `w_s15_start`, walk from Crescent (148,124) toward the volcano door (120,150) and keep going; or `w_s17_start` (after the hull) walk from the landed airship (150,152) north across the river | every fight on the Hull Desert / Ashlands / river tiles uses that zone's roster (level 21-24: ankheg, ochu, hellhound, crocodile ...) | two fights rolled the act-1 table: `goblin x3` (8 HP each) at (131,150) in s15b, and `goblin x3 + wolf` at (150,148) in s17. Cause (read in `EncounterSystem.handleMove`): `playerMove` fires before `FieldVehicles.afterStep` changes the mode, so the step is looked up in the old mode's zones; the river cell is a hole in the walking zone, so the map's own act-1 table (goblin, wolf) applies. The canoe-gap lake cells always use that table (script over `encounterZones`: walking gaps outside the act-1 block 0, canoe gaps 25 cells) | log lines `BATTLE overworld (131,150) goblin:8 goblin:8 goblin:8` and `BATTLE overworld (150,148) goblin:8 ... wolf:20`; re-take on re-walk |
| P2-02 | P2 | S11-S16 economy | all dungeons | play any dungeon floor to floor with normal fights | gold stays a constraint for the next town (WORLD 3.5, price walls) | gold balloons: S11 starts with 3000 G and holds 12,921 G after B1-B3 (15 fights); S13 17.7k -> 25.9k; S15 36.9k at B4; S16 reached 71,963 G after one pass (37 fights; hill_gigas / ice_gigas pay 879+ G each). Crescent's dearest item is 10,000 G and the caravan bottle is 40,000 G (S22), so both are trivial once Gurgu and the Ice Cavern have been walked. Early-visit gating (w_s14_early, 1500 G vs 4,000-10,000 G prices) works, but only because the scenario starts poor | s11 / s13 / s15 / s16 logs (`gold a->b` on every chest line and the final `gold`) |
| P3-03 | P3 | S19 | bahamut-lair, throne (19,6) | `w_s19_start`, give the seal to Bahamut, stay in the room | the dragon stays on the throne, or the changed line is available at once | after the upgrade `bahamut` is hidden (`hideIf CLASS_UPGRADED`) but `bahamut_after` (`showIf`) is not drawn until the map is re-entered: the throne is empty (NPC list: six dragons only). Same pattern at the giant (S12): the sleeping giant NPC is absent from the live map after TITAN_FED (only 2 NPCs listed) | s19 and s12 logs, "lair npcs ..." and "SWEEP giant-tunnel npcs=2" lines |
| P3-04 | P3 | S16 | ice-cavern-b3 (38,8), the niche chest | `w_s16_start`, reach B3, open the chest on the east wall below the vault | chest on frost floor | the cell is drawn as a flat pure-white (255,255,255) square around the chest (packed-snow `_` material); the neighbouring floor is pale blue | screenshot `s16_06_after_eye.png` (lost) |
| P3-05 | P3 | S17, S11, S13 | overworld: hull (143,159) and the earth shrine, a mountain icon | any overworld view near the hull | final art | code-drawn placeholder labels in view: `BH` on the buried hull, `SH` on a shrine icon (the S11-S13 overworld), both on AGENTS.md's known list | s17 screenshots (lost) |
| P3-06 | P3 | S17 | overworld (143,160) | stand under the hull, tap Up briefly (30 ms) then Enter | one tap turns the hero and the talk starts | a 30 ms tap does not turn the hero (facing stays down); only a hold of about 100 ms or more turns it, so a quick tap + confirm does nothing. May be intended input timing; flagging because it looked like a dead hatch to the bot | `hatch.mjs` run: facingTile (143,161) after 30 ms, (143,159) after 120 ms |
| P3-07 | P3 | all | whole segment | n/a | n/a | on two runs the page fell back to a black screen / the Title scene mid-walk (after a battle in gurgu-b3, and in the citadel), with no console error; runs were unaffected by the reboot at that time. Cause unknown (renderer crash or a dev-server reload); re-check on the re-walk | s15b_fail.png (black) |
| P3-08 | P3 | S11-S19 originality | Melmond / Cavern of Earth / giant / Sarda; Crescent Circle; Gurgu; Ice Cavern; hull; Citadel; Bahamut; Onrac; waterfall; caravan | read the chain | QUEST 4.6: nothing copied too literally | the chain of items and the order is the classic's: vampire's ruby fed to a giant (Titan), the sage's rod breaks the seal, twelve sages give a canoe, the floatstone raises the airship, a dragon king upgrades classes for a seal, an automaton holds a cube, a caravan sells the bottle, a submarine needs oxyale. Names also match: Dr. Unne, Nerrick, Smyth, Lukahn, Sarda, Bahamut, Lufenia, Gurgu. Prose and maps are original. Per the standing ruling (classic names and lines are not defects) this is reported only | dialog dump of the S11-S22 maps |
| P2-09 | P2 | S22 | caravan-camp, trader (19,11) | `w_s22_start`, walk in, talk to the trader once with 41,000 G | a price prompt (Yes / No) or at least a line that 40,000 G was paid | talking is the purchase: the lines "I won't haggle: 40000 gil ... Come back when your purse is heavier if it isn't." play (they read as a refusal prompt), then "You received the Bottle!" and the gold drops 41000 -> 1000 with no "paid" line and no way to decline. A player who talks to read the trader with a full purse loses it unrecoverably (the bottle is only needed once, but 40,000 G is most of the gold the later shops want) | s22 log: `BOTTLE ["fairy_bottle:1"] gold 41000 -> 1000` |
| P3-10 | P3 | S21 | waterfall-cave, automaton (14,4) | `w_s21_start`, talk to the automaton | the cube is handed over after the line that gives it | the order is: three lines about holding the cube, "You received the Warp Cube!", then "The cube leaves the brass hands, and the automaton's lamp-eyes flicker." (the cutscene text describes the hand-over after the pickup line) | s21 log |
| P3-11 | P3 | S21 | overworld gorge mouth (30,28) | `w_s21_neg_nocanoe`, press right at (30,28) | a hint line, or the hint NPCs are enough | the step into the river is silently refused (position unchanged, no dialog). The Onrac hint NPC and the caravan scout cover it, so only a polish note | s21neg log |

## Checked and fine (so far)

- S11: Melmond reachable by ship over the canal; the town renders; hints point to the Cavern, the giant and a vampire; B1 to B3 walk
  (west stair on B1, east stair is the ore annex, B2 slide to B1 lands on a walkable cell with the exit reachable); vampire fight
  at L13 is winnable (party ended at WAR 191/191, WHM 7/97 once, THF 98/121); ruby arrives with the cutscene text.
- S12: tunnel blocks the west exit until the ruby is given (`neg` row passes); the feast cutscene and the Sarda cutscene run;
  `rod` held; Sarda's cave NPCs fine.
- S13: seal message loops harmlessly without the rod (30+ bumps, no softlock); with the rod the seal opens, B4 stairwells, B5 boss at L16
  (won with WAR 5/230, BLM down: close), the shade appears after the warp and the altar sets EARTH_CRYSTAL_LIT; B5 `canSave` false as designed.
- S14: with EARTH_CRYSTAL_LIT the elder gives the canoe, CANOE_GIVEN set, stepping from the shore onto the lake gives mode `canoe`;
  early visit: shops open at B5 prices, elder says to heal the earth first, no canoe.
- S15-S16: floors link as the topology briefs say (forge dead end, B4 route, B5 arrival due north of the queen); Ice B1 pits drop to the
  B1 pockets and the pocket stairs return to B2; the B3 stair is unreachable before Hesk (check passes) and open after.
- S17: negative row passes (hatch asks for the stone, no airship); positive: cutscene, airship parked at (149,162), take-off,
  "The airship can't land here." over forest and desert, landing on grass works.
- S19: class change prints "WAR's Warrior became Knight!" etc., HP rises, seal consumed, `CLASS_UPGRADED` set.
- Console: 0 errors and 0 warnings (besides Chromium GL stall notes) in every run so far.
- Shop lists (Melmond 8 items, Crescent, Onrac) match WORLD 3.5 tier names; price tables read from `shops.yaml` / `items.yaml`.

## Not yet verified (carry-over to the re-walk)

S15 boss with a healing player; S18 2F lattice and 3F boss; S20 inn and shops; S21 canoe up the gorge + negative; S22 bottle
purchase; Melmond pond elder (28,32) and Crescent wanderers could not be reached by the bot; the B2 annex chests (2,26), (6,28)
(entered from B1's east stair, not walked); whether encounter pace in the dungeons (14-30 steps) feels heavy (37 fights in one pass
of the Ice Cavern, 32 in Gurgu).
