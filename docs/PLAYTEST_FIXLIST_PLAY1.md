# PLAY-1 fix list (pass W, stages S0-S10)

Branch `w-play1` from mainline 64be8290. Dev server port 5244, `mute=1` on every URL, headless Playwright with keyboard input.
Status: IN PROGRESS. S1, S2, S2 neg, S3, S4, S7 checkpoints done. S5, S6, S8, S9, S10 and the S6/S10 negatives are still to run.
Screenshots lived under /tmp/w-play1/shots/ (wiped by a reboot); steps below let anyone reproduce.

## Findings

| id | sev | stage | where | steps to reproduce | expected | happened |
|---|---|---|---|---|---|---|
| P1-1-01 | P0? | S4, S5, S8 | Elfheim (`elfheim`), Marsh Cave | Scenario `w_s4_start`, sail to Elfheim, walk the town and talk to NPCs (`elfheim_gate_warden`, then the others); also in `w_s8_start` and once in Marsh Cave B1/B2 of `w_s5_start` | the game stays on the exploration scene | Three times the game dropped to the title screen on its own (two in Elfheim: S4 and S8, one in the Marsh Cave: S5). One Elfheim case was a real page reload (`framenavigated` fired). No console error was logged. Not reproduced yet with scene-switch tracing; may be a dev-server reload or a harness artefact. If it happens again with the trace it stays P0 |
| P1-1-02 | P2 | S1 | `cornelia-castle-2f`, King (21,8) and chancellor (18,10) | `w_s1_start`, talk to the King (bridge order plays), then talk to the King and the chancellor again | after the foreman finishes the span (BRIDGE_BUILT) their lines move on | They keep saying "My builders are hard at work on the bridge" / "The King's builders are at work on the bridge to the north" after BRIDGE_BUILT. Only the bridge workers' lines change |
| P1-1-03 | P2 | S2 | `pravoka` pirates and Bikke, battle `pirate x9` | `w_s2_start`, talk to `pirate_den_b`, `bikke`, fight | the numbers agree | `pirate_den_b` says "Nine of us, and the Captain makes ten"; Bikke says "nine blades"; the battle is 9 pirates and no captain. Pick one count |
| P1-1-04 | P2 | S2 | battle vs 9 pirates | `w_s2_start` (L3, rapier/chain mail kit, 600 G), talk to Bikke, press Enter (Fight) every turn | a boss fight for a band 3-6 party that takes tactics | Won by mashing Fight, ending 60/61, 27/41, 31/37, 28/37 HP: trivial for the band. Gold went 600 to 960 |
| P1-1-05 | P2 | S2 | `pravoka_weapon` shop | open Pravoka Weapons | prices follow attack | Iron Sword 175 G (attack 14, crit 10) is nearly as good as Short Sword 550 G (attack 15) and Hand Axe 550 G (attack 16). The 550 G items are never worth buying over the Iron Sword |
| P1-1-06 | P3 | S7 | `matoya-cave`, Matoya (9,5), cutscene `a1_matoya_sight` | `w_s7_start`, talk to Matoya | the pickup uses the shared "Received ..." line as its own message | The last page reads "...no curse holds them. Received the Herb." as one run-on line in the cutscene text instead of the standard pickup line |
| P1-1-07 | P2 | S5/S6 | `western-keep-2f` `false_king` (14,7), `courtier_vell`, `gate_warden` | `w_s6_neg_nocrown`, then `w_s6_start`; read the courtiers | lines match what the player sees | `false_king` has `showIf: MARSH_GUARD_DEFEATED`, so before the cave is cleared the throne is empty, but `courtier_vell` and `gate_warden` say "The king has not left his chair" and "He will see no one who comes without it". Also the neg scenario `w_s6_neg_nocrown` has MARSH_GUARD_DEFEATED set, so it does not test the pre-cave state. Verify in the browser |
| P1-1-08 | P2 | test data | `assets/data/debug-scenarios.yaml`: `w_s5_start` (l.1597), `w_s6_start`, `w_s10_start` and `w_s10_neg_notnt` | start any of them | the party holds the lute and GOT_LUTE (S0 grant) like `w_s4_start`, `w_s8_start`, `w_s9_start` | Flags `GOT_LUTE` and the `lute` item are missing from those scenarios, so they do not hold every prerequisite of their stage (WORLD_PLAN 6.5) |

## Checked and fine

- S1: King cutscene (fade, INTRO_COMPLETE), lute held, foreman builds the span (`a1_bridge_finished`), BRIDGE_BUILT set, party walked onto gap cells (93,94) and on north to (93,90). No console errors.
- S2: Bikke fight and `a1_bikke_yields`, pirates removed, dockhands and `bikke_after` appear, BIKKE_DEFEATED set, brig drawn at (132,102), stepping onto it gives mode `ship`.
- S2 neg (`w_s2_neg_noboss`): no ship at the dock; the party could not step onto water (east/down).
- S3: from `north_shore` walked to (74,75) and entered `matoya-cave`; Matoya and brooms talk.
- S4: boarded at (132,102), sailed 98 steps with 5 sea battles to `elf_port` (84,147), landed at (84,148), entered `elfheim`.
- S7: Matoya takes `crystal_eye`, gives `herb`; her after-line and the broom lines change.

## Still to run

S5 Marsh Cave B1-B3 + piscodemon x3, S6 Western Keep + Astos + `w_s6_neg_nocrown`, S8 prince wakes, S9 vault, S10 canal + `w_s10_neg_notnt`, then the originality spot-check.
