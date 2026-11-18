# PLAY-3 fix list (pass W, stages S23-S31)

Playtester PLAY-3, branch `w-play3` (from mainline 64be8290). Scenario-hop with a headless browser, keyboard input,
`mute=1`. This file is updated as the playtest goes; the latest section says how far it got.

Severity: P0 blocks progress or crashes; P1 serious, wrong-side or unfair; P2 noticeable; P3 polish.

## Findings

| Id | Sev | Stage | Map + cell | Repro | Expected | Actual | Evidence |
|---|---|---|---|---|---|---|---|
| P3-01 (unconfirmed) | P3 | S24 | `onrac` (37, 27) -> gate (38, 27) | `w_s24_start`, one 90 ms tap of Right at the dry-dock entrance, oxyale held | the submarine boards (map `sea-shrine-b3`, entrance `nave` (21, 28)) | Once it boarded; on a second load of the same scenario the single tap did nothing for 5 s (still `onrac` 37,27, no dialog). Walking to (38, 27) with repeated steps boarded at once. Probably the scene-entry or dialog-close hold-off swallowing the first press, so not a game bug; recheck by hand. | `/tmp` log lost in the reboot |

| P3-02 | P3 | S27-S28 | Mirage Tower and sky castle random fights | `w_s27_start`, walk 1F to 3F, fighting every encounter | gold in step with the band (the party starts S27 with 20000 G) | six fights in the Mirage took the purse from 20000 to about 54000 G (about 5,000 G a fight: `goldReward` per enemy is chimera 2500, green_dragon 5000, black_knight 1800 (groups of 2-3), blue_dragon 2000, stone_golem 1000, guardian 400). Nothing to buy until the Gaia/Lufenia shops, and S29's 30000 G start in the PST scenarios is already below that. Gold has no use from here on, so this is harmless for progress, but check the `goldReward` of the S27-S28 roster against the shop prices. | `/tmp/w-play3/prog.log` (lost on reboot; re-measure) |

| P3-03 | P3 | S28 | `sky-castle-4f`, zone `wnd_d2_engine`, formation `warmech` + `air_elemental` (weight 1 in 64) | Forced from the console on `w_s28_start` (`ex.battleTrigger.triggerBattle(['warmech','air_elemental'])`, three times, party L31 in the stage kit, plain Fight mashing) | A rare superboss: its text says "Few who meet it walk away"; expect real danger or a wipe risk | Won 3 of 3 in 24-35 s (59-84 presses) with no hero KO'd (worst: KNGT 299/522, WWIZ 57/240). Soft for a "rare, deadly" formation and a player who meets it at weight 1 in 64 will not feel it. Also it pays `goldReward` 32000. | `warmech_battle.png` (art is fine) |

| P3-04 | P2 | S30 | `past-temple-1..5`, the four refights and Death Eye | `w_s30_start` (L34 party, stage kit), walk the five floors, talk to each boss, plain Fight mashing, no item used | each refight is a boss in band 34-41 with real pressure | All five fights won. Floor 1 (Rime Sovereign II + 2 death knights) cost almost nothing: KNGT 570 -> 562, nobody else hurt (so the first boss of the endgame is a pushover). Floor 2 (Ashen Queen II + rhyos): KNGT down to 250/570. Floor 4 (Seraph II): WWIZ KO'd, KNGT 179/570. Floor 5 (Death Eye + iron golem) started with KNGT 179/570 and WWIZ KO'd, with no healing in between, and was still won, ending KNGT 161/570. Potions 10, hi-potions 11, ether 7 and phoenix down 6 were never touched. The floors are meant to be a gauntlet but the party can carry a half-dead state through all of them; floor 1 and 5 in particular do not threaten a mashing party at L34. | `/tmp/w-play3/s30.log` (re-run `j_s30.js`-style walk to confirm), `s30_past-temple-*_after.png` |
| P3-05 | P3 | S30 | `past-temple-2` chests `chest_cross_east`, `chest_cross_east_vestibule` | arrive from the arrival stair (the `arrival` cell) and try to reach the east chests | an east arm the player can find | They are in a closed 92-cell side room whose only exit is floor 1's east stair (39-40, 16 on floor 2, from floor 1 (24-25, 4)); not reachable from the main hub at all. That is by design in the brief ("one open per visit"), but nothing on floor 1 or 2 points the player to the second stair, so the two chests are easy to miss. Reachability itself is fine (checked from the `east` entrance). | reachability dump |

| P3-06 | P3 | S30 | `cornelia-castle-2f` after `ending` | `w_s30_chaos_door`, beat Chaos, press confirm through the ending | WORLD 4.8: "`end_game` shows the card, then the title" | After the fade the party wakes in the throne room and the final line "The road is closed behind you. The End" is an ordinary dialog box at the bottom of the live throne room (king, princess and guard standing there, no fade to black, no card or credits); one more confirm goes to the title. Works, but it is a flat finish for a 30-hour quest. | `chaos_end_10.png` |
| P3-07 | P3 | S31 | `dwarf-hall`, Smyth (`ert_smyth`), cutscene `ert_smyth_forge` | Hold `adamant` + WIND_CRYSTAL_LIT, talk to Smyth | an "Excalibur received" line like the Chime and the Oxyale have | The cutscene gives `excalibur` silently (the last line is Smyth's "Swing it once..."), so the player has no confirmation and no pickup text. `wnd_chime_given` and `wnd_fairy_freed` both print "Received ...". Also noted for the fix agent: at this commit Smyth refuses with the ore until WIND_CRYSTAL_LIT ("calm whatever's stirring the sky"), which is the behavior being changed. | `s31_b.png` (lost; trivial to redo) |

No P0, P1 or crash found in S23-S31. The two non-polish findings are P3-04 (the temple-of-the-past refights are
too soft at L34) and the gold note P3-02; everything else is P3.

## Checked and fine so far

- S23 `w_s23_start`: Gaia gate enter (150,13) -> `gaia` entrance `gate`; all 19 town NPCs talkable and speak sensible
  lines (the court child answered empty in one run; the NPC wanders and the talk likely missed it, not re-tested);
  spring `gaia-spring` reachable by walking; warden + bottle -> cutscene `wnd_fairy_freed`: FAIRY_FREED set, `fairy_bottle`
  taken, `oxyale` given, fairy NPC appears, water patch flows, no console errors. Hints point the player to the spring
  ("take it up to the spring at the top"), the warden says "Unstop it over the spring".
- S23 negative `w_s23_neg_nobottle`: warden tells of the caravan; no flag, no oxyale.
- S24 negative `w_s24_neg_nooxyale`: stepping at (38, 27) gives the shipwright's message; the map stays `onrac`.
- S24 `w_s24_start`: board -> `sea-shrine-b3` nave (21, 28). B3 chests (3) and the echo priest, B2 chests (3) and brother,
  B1 chests (2), elder and three mermaid hints, B4 chests (4) and librarian all reachable and give their items. Hints:
  up = counsel, down = the king with the tablet; "either stair at the bottom takes you to the throne" matches two B4->B5
  stairs. Random battles on B3/B4 (sahagin_prince x2, sea_troll x3, water_naga, deepeyes + sea_troll) were all won by
  mashing Fight at L27 with the stage kit; none was a wipe.
- S24 B5 (`sea-shrine-b5`): two chests, two random fights, then talking to the Sovereign at (15, 8) plays the line, the
  scripted fight, `wat_drowned_falls`: WATER_CRYSTAL_LIT set, `slab` given, no console errors. Fairness: a Fight-mash
  party at L27 with the stage kit won, ending with one hero KO'd (KNT 0/458) and one at 57/290: a real fight, not a
  wipe, not trivial.
- S25 `w_s25_start`: overworld -> `melmond` -> `melmond-house-unne` (door (21, 11)); Unne's talk takes the slab
  (1 -> 0), sets LUFENIAN_LEARNED; the cutscene reads well; repeat talk and the housekeeper change as intended.
  `w_s25_neg_noslab`: Unne tells the story and asks for the tablet; no flag.
- S26 `w_s26_start`: Lufenia (`lufenia`) has 8 transitions (elder, stargazer, healer, two magic shops, inn, 2 gate
  cells); 8 of 12 outdoor NPCs read in plain English, the other four are wanderers my bot missed (not a defect). The
  elder (`lufenia-house-elder`) gives the Chime (`chime` held, CHIME_GIVEN set). Hints chain correctly: Gaia and Unne
  point to Lufenia, Lufenia points to the Mirage and (cube hint) the waterfall in the west.
- S26 negative `w_s26_neg_untaught`: every outdoor line is in the old tongue, the elder says only "Sae'qat, ven
  doloth. Lun... thrim?" and gives no chime. With LUFENIAN_LEARNED the three keepers (two magic shops, inn) are present.
- S27 `w_s27_start`: overworld -> `mirage-1f`; walking onto the vestibule door (18, 31) with the chime passes with no
  message; 1F -> 2F -> 3F by the stairs; 3F chests (white robe, defender); the console with the cube plays
  `mirage_ascent`, sets SKY_FORTRESS_OPEN and lands on `sky-castle-1f` (19, 34). Five random fights on the way, all won.
  Dialog reads well, no console errors.
- S28 climb (no boss yet): 1F chests (3), 2F (3, all reachable only through the conveyor belts; checked with a
  reachability search that treats the belt transitions as edges: every chest and every exit is reachable, so the belts
  are not a trap), 3F `adamant` chest at (4, 26) and 3 more chests, the archivist, 4F chests (3) and the stairs to 5F.
  Attrition is real: BWIZ was down to 73/240 by 5F at L31 with no healing between fights (fair).
- S28 boss (`sky-castle-5f`, talk to the Seraph at (12, 8)): the line, the scripted fight (Seraph + air elemental),
  `wnd_seraph_falls`, WIND_CRYSTAL_LIT set, no console errors. The party reached 5F already hurt (WWIZ 72/240) and the
  Fight-mash win cost one KO (WWIZ 0/240): fair, not a wipe. 5F chests: vorpal sword, ether.
- S28 conveyors: from every belt landing and every entrance of `sky-castle-2f` the same 433 walkable cells, the stair
  up and both exits to 1F are reachable (no trap). Note for fix agents: a path that treats a belt cell as plain floor
  loops (my first bot looped for 10 minutes); a player has to learn which belt leads where. No in-game hint says so
  (the 2F maps has no sign or NPC). This is not a defect by itself but the archivist/steward text could hint.
- S29 `w_s29_start`: overworld -> `temple-of-fiends` (11, 20); the ring cell (3, 4) is walkable; talking up to the hour
  keeper at (3, 3) plays `pst_time_gate` (lute + four crystals), TIME_GATE_OPEN set, warp to the `time_gate` arrival
  (3, 5); stepping north goes down to `past-temple-1` (19, 37). No console errors.
- S30 floors: every floor's chests give their items, floor 2's two wards work in order (hub, then west; the west door
  and the north door stay shut until their ward is lifted, with a clear gate message), each boss is a talk-to
  scripted fight with a message and a post-victory cutscene, each stair opens only after its PAST_* flag, floors
  1-5 reach `past-chaos`. Boss text is original and consistent (Rime Sovereign, Ashen Queen, Drowned Sovereign,
  Hollow Seraph and Death Eye lines all fit the earlier encounters).
- Data check: S31 Smyth (`dwarf-hall`, `ert_smyth`): dialog and cutscene `ert_smyth_forge` are gated on WIND_CRYSTAL_LIT
  in the version I tested (the fix agent is changing this; behaviour noted only). Chest `adamant` is on `sky-castle-3f`
  (4, 26).

- S30 Chaos `w_s30_chaos_door` (level-40 `chaos_party`): two shrine chests; the talk line and the scripted message
  play; the fight goes through all four forms (F1 `chaos` 20000 -> F2 `chaos_orrery` at 13008 -> F3 `chaos_horizon` at
  8000 -> F4 `chaos_horizon_core`) and ends after 135 s and 326 confirm presses. The party finished KNGT 128/666, NINJ
  44/420, MSTR 238/586, WWIZ KO: a real fight (it matches the balance test's 90-96 % win rate). Art, numbers and
  the `rim` background render correctly; `ending` sets CHAOS_DEFEATED, fades, warps to `cornelia-castle-2f`, heals,
  plays the two wake-up lines and the end line, then the title.
- S31 (current behavior): `dwarf-hall`, Smyth with `adamant` but WIND_CRYSTAL_LIT unset says "...Calm whatever's
  stirring the sky, then bring the ore back." and keeps the ore; with the flag set he forges (adamant taken,
  `excalibur` given, ERT_O_SWORD_FORGED), and his later line and the bellows boy read well. I granted `adamant` and
  moved to the map from the console, because no scenario exists for S31 (nothing else was altered).
- Originality (QUEST 4.6): all text of this segment (Gaia, spring, Sea Shrine, Unne, Lufenia, Mirage, sky castle, past
  temple, ending) is original wording; the only classic echoes are names and the "Warriors of Light" prophecy in act 1.
  A grep for famous FF1 lines found none in the segment.
- Console and performance: zero `console.error`, page errors or missing-art warnings in the whole run (only the
  headless GL "GPU stall due to ReadPixels" warning). No visible hitch during the Chaos F3/F4 view or the interludes in
  headless SwiftShader; real-GPU performance not measured.
- Not tested: the `w_s23_start`-onward overworld flights (the airship, the submarine ring/beam beyond the dock
  transition), the waterfall and the caravan (S21/S22 belong to PLAY-2), keyboard-less menus, saving, and the
  `w_boss_*` battle scenarios for the four refights separately (the fights were played in the field instead).
- Bot caveats (not game bugs): empty NPC lines in my talk-all runs were wandering NPCs; my first planners treated gate
  cells and conveyor cells as plain floor.
