# Roster adversarial visual play test (pass R, plan section 11), 2026-11-15

Scope: all 88 `enemies.yaml` entries (84 sheets) on `roster-int` at 5e2dd77, bestiary and 26 sandbox formations.
Evidence (local, not committed): `/tmp/vpt/` (`best/<id>_screen.jpg`, `best/<id>_fNNN.png`, `z_*.png`, `bt/`, `strips/`, `atlas_check.txt`, `groups_*.png`, iou output).
No console errors, no missing art, no text overflow in 88 bestiary entries and 26 battles. FPS median 120 (p2 ~106) incl. 9-crowds.

## OK (65)
goblin, gr_imp, wolf, skeleton, pirate, mummy, werewolf, zombie, ghoul, lizard, sahagin, sahagin_chief, buccaneer, bigeyes, tarantula, ghast, shadow, green_slime, gray_ooze, gargoyle, bloodbones, piscodemon, wraith, anaconda, hyenadon, hill_gigas, earth_elemental, wight, ochre_jelly, ogre_mage, sphinx, white_crocodile, neochu, pyrolisk, fire_hydra, hellhound, fire_gigas, white_dragon, winter_wolf, mindflayer, specter, remorazz, dark_wizard, desert_baretta, wyvern, wyrm, manticore, dragon_zombie, ashen_queen_2, drowned_sovereign_2, hollow_seraph_2, shark, ogre_chief, crazy_horse, cockatrice, plus the keyframe-only sheets.

Keyframe-only (no in-betweens, known): astos, black_widow, crawler, horned_devil, hydra, scorpion, warmech (astos and warmech also lack daze).
Intentional: cockatrice/slime hurt feathers and droplets; ogre_chief helm flying off in hurt.

## Defects

| # | Sev | Kind | Enemy | Defect | Repro (`http://127.0.0.1:<port>/?mute=1&...`) | Evidence |
|---|---|---|---|---|---|---|
| 1 | P1 | runtime | chaos, hollow_seraph, warmech, drowned_sovereign, garland, lich | A boss (200 px cell) lunging at the top hero rises to y≈100-118 and its fists/wings clip under the top message window | `sandbox=l30_lich&enemies=chaos&enemyAnim=loop` | z_b15.png, z_b9.png, bt/B5_*, B6_*, B7_* |
| 2 | P1 | layout | ogre, troll (large crowds) | 8-9 large enemies fall to scale 1: ogres/trolls smaller than scale-2 goblins | `sandbox=l30_lich&enemies=ogre,troll,dragon,crazy_horse,gigas_worm,ogre_chief,shark,anaconda,minotaur` | bt/L1_full.png |
| 3 | P1 | art | lich, lich_2 | Hurt keyframe changes identity: skull to right shoulder (two heads), spiked helm top centre, crown gone; also clips top window in battle | `bestiary=lich&battleStep=1` | z_lich.png |
| 4 | P1 | art | crocodile | Hurt / hurt_in2 tail torn, forked, holes | `bestiary=crocodile&battleStep=1` | z_croc_hurtseq.png |
| 5 | P1 | rig/art | hollow_seraph | attack_raise, atk_raise_b, atk_swing: right-side wings vanish (~3 of 6 show); flat pale-cyan block behind the helm | `bestiary=hollow_seraph&battleStep=1` | z_sera.png |
| 6 | P1 | rig | ice_gigas | Axe pops 23 px from right shoulder to left between hurt_in1 and hurt_in2 | `bestiary=ice_gigas&battleStep=1` | strips/ice_gigas.png |
| 7 | P1 | art/rig | garland | cast_rise, cast_release, cast: white/lavender crescent hole on left hip; atk_swing2: detached white blade sliver near right cell edge | `bestiary=garland&battleStep=1` | z_gar.png |
| 8 | P2 | scale | minotaur, dragon | minotaur 88 px, dragon 54 px tall vs other large enemies; dragon attack 1-3 px from cell edge | - | groups |
| 9 | P2 | distinctness | gigas_worm vs lava_worm; gr_wolf | Worm silhouettes IoU 0.81 (roster max); gr_wolf very dark on shore background | - | iou output, bt/st1_29_crop.jpg |
| 10 | P2 | art | vampire, cobra | Vampire idle face unreadable (dark band, flat pale face); cobra idle head reads as a hood blob | - | z_vamp.png, strips/cobra.png |
| 11 | P2 | art | drowned_sovereign | Robe hems curl like tentacles; cast tentacle tips saturated royal blue (off-style) | - | bt/B5_* |
| 12 | P2 | small | various | ochu stray light/pink tendril-tip pixels + light outline segment; fire_elemental rose patch at elbow (atk_mid); death_eye pupil fragments in daze and art touches bestiary panel border in lunge; evil_eye cone tail only in attack; ogre/troll club/arm pop in atk_recover; ashen_queen tail curls separately in hurt; ankheg, crawler, dragon, gigas_worm, lesser_tiger attack within 1-3 px of cell edge; 18 sheets' cell bounds cross the bestiary panel right edge in lunge (only death_eye's art touches) | - | z_ochu.png, strips, atlas_check.txt |
| 13 | P2 | style | sabertooth, fire_lizard | Flatter / less detailed than the roster | - | groups |

## Cross-roster
- Atlas checks clean (no partial alpha, magenta, off-palette, specks, spill, overlapping rects, stray page pixels; outline coverage ~100 %, ogre 0.97).
- Only silhouette pair above the 0.75 watch line: gigas_worm/lava_worm 0.81; none at 0.85.
- Multi-limb reads correct: ashen_queen 6 arms, both hydras 3 heads, chaos 4 arms.
- Status: sleep Z + daze verified on ogre, cockatrice, gr_wolf, hydra; immune green slime shows "unaffected". Stone and poison on enemies not testable from the party (no infliction source).
- Draw order: the lunging enemy draws on top; melee contact vs the warrior correct.

## Re-test (F6), 2026-11-15

Scope: `roster-int` at 3e50493 (121 sheets, 9 pages). Fresh tester, own dev server and headless Chromium (Playwright script), every URL with `mute=1`.
Evidence (local, not committed): `/tmp/vpt2/` (`strips/<id>.png` every atlas frame at 2-3x, `z_*.png` zooms, `sib_*.png` sibling sheets, `bt/A_<boss>/` and `bt/M_<boss>/` boss lunges (step loop and real fights), `bt/B1..B5/` mixed formations, `bt/L1_0000.jpg` 9-large crowd, `best/<id>_*.jpg` bestiary, `p_*.json` / `m_*.json` / `best_*.json` per-frame sprite bounds, `keycmp.txt`, `check_all.txt`, `roster_report.txt`, scripts `keycmp.py`, `regress.py`, `ana.py`, `anab.py`, `js/*.js`).

Automated pre-pass:
- `monster_anim.py check --all`: 112 `OK`, 9 `no rig` (astos, black_knight, black_widow, crawler, horned_devil, hydra, scorpion, warmech, water_elemental). Nothing else.
- `monster_roster_report.py`: no "reads as a recolour" flag (silhouette >= 0.85 and edge >= 0.60). Watch list: green_slime/black_flan 0.88/0.26, medusa/earth_medusa 0.83/0.37, gigas_worm/purple_worm 0.83/0.49, gigas_worm/lava_worm 0.82/0.53, clay_golem/stone_golem 0.80/0.40, stone_golem/iron_golem 0.78/0.42, lava_worm/purple_worm 0.76/0.43, plus same-body pairs at 0.75-0.80 (golems vs ogres/trolls). Judged at 2x side by side (`sib_*.png`): all distinct except medusa/earth_medusa (B table).
- Atlas vs old atlas (`regress.py`, 5e2dd77 vs 3e50493): 70 of the 84 old sheets are byte-identical in every frame. Only the 14 targeted sheets changed (ashen_queen, cobra, crocodile, death_eye, drowned_sovereign, fire_elemental, garland, hollow_seraph, ice_gigas, lich, ochu, ogre, troll, vampire), and in each only the frames the fix plan names. 37 new sheets.
- Keyframes vs approved PNGs (`keycmp.py`, every sheet, idle/attack/hurt/cast/raise): pixel-identical except the intended FW-P paints: cobra 1-3 px, vampire idle 8, ochu attack 23, crocodile hurt +144 px (tail fill), garland cast 120, drowned_sovereign cast 297. hollow_seraph and warmech sit in wider cells (218 / 232) and are identical at their offset.
- No console errors or warnings (other than the GPU ReadPixels notice) in 46 bestiary entries, 9 step-loop boss runs, 7 real boss fights and 7 formations.

### A. Fixed items

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Boss lunge vs the top message window (bottom y 120) | **FIXED** | Highest opaque pixel over a full loop (`sandbox=l30_lich&enemies=<boss>&enemyAnim=step`, 300 frames): chaos 124, hollow_seraph 121, warmech 124, drowned_sovereign 148, garland 128, lich/lich_2 124, death_eye 137, ashen_queen 124. Real fights at `sandbox=l2_temple&enemies=<boss>` with heroes dying under the lunge (WAR fell, WHM fell): chaos 137, hollow_seraph 121, garland 168, lich 126, others lower. `p_*.json`, `m_*.json`, `mm_chaos.jpg` |
| 2 | 8-9 large enemies drop to scale 1 | **FIXED** | the play-test formation (ogre, troll, dragon, crazy_horse, gigas_worm, ogre_chief, shark, anaconda, minotaur): every sprite at scale 2 and no overlap at rest. `bt/L1_0000.jpg`, `p_L1.json` |
| 3 | lich / lich_2 hurt identity (lich_2 uses the lich sprite) | **FIXED** | hurt_in1, hurt_in2, hurt: one skull, centred, crown kept. In battle the hurt stays below the window. `z_lich_idle.png`, `strips/lich.png` |
| 4 | crocodile hurt tail | **FIXED** | no holes, forks or tears in hurt_in2 or hurt. Nit: the filled curl is a dark lump with a 1-2 px tip strand and a few (33,0,33) inner pixels; at 1x it reads as a tail. `z_crocodile_idle.png`, `z_crocodile_hurt_in2.png` |
| 5 | hollow_seraph raise frames, wings, cyan block | **FIXED** | the raise frames are gone (`hasRaise: false`). The heavy attack is telegraphed: a red tint over atk_wind2 (t 24-30) and a glint at the wing tip (t 30-36), then the lunge reaches the warrior. 6 wings in every frame, no flat cyan block. `m_seraph.jpg`, `strips/hollow_seraph.png` |
| 6 | ice_gigas (new sheet + rig) axe continuity | **FIXED** | the axe stays on the right shoulder from idle through hurt_in1, hurt_in2 and hurt. Nit: a 1 px loincloth strand hangs at the knee in atk_wind1/2 and atk_recover. `strips/ice_gigas.png`, `z_ice_gigas_atk_wind2.png` |
| 7 | garland cast hip hole, atk_swing2 sliver | **FIXED** | no hole in cast_rise, cast_release or cast. The atk_swing2 smear is now attached to the blade tip, ends 2 px inside the cell, and no part of it is detached. Nit: it reads as a V hook on the blade. `z_garland_cast_rise.png`, `z_garland_atk_swing.png` |
| 8 | minotaur / dragon scale | accepted nit (unchanged) | - |
| 9 | gigas_worm vs lava_worm (and the new purple_worm, sand_worm) | distinct (accepted) | different colour, lava seams, maw and coil at 2x. `sib_0.png` |
| 10 | vampire face, cobra head | **FIXED** | vampire: a magenta eye on a pale profile reads at 2x. Cobra: mouth and fangs read, and the head no longer reads as a hood blob. `z_vampire_idle.png`, `z_cobra_idle.png` |
| 11a | drowned_sovereign cast tentacle colour | **FIXED** | 0 px of (33,33,165), (41,41,115) and (41,49,107) in cast, cast_gather, cast_rise and cast_release. The tips read as sea-teal flesh. `strips/drowned_sovereign.png` |
| 11b | drowned robe hems | accepted (R8) | the idle hem curls are robe flourishes: no tentacles in idle frames, and tentacles only in action frames |
| 12a | ochu tendril-tip specks | **FIXED** | 0 px of the two colours in attack, atk_mid and atk_follow. `z_ochu_attack.png` |
| 12b | fire_elemental elbow rose patch | **FIXED** | no rose patch at the elbow; 3 rose px left in the box are flame-tip accents also in the attack key. `z_fire_elemental_atk_wind2.png` |
| 12c | death_eye pupil in daze | **FIXED** | one pupil in daze and daze_b. `z_death_eye_idle.png` |
| 12d | art crossing the bestiary panel edge in a lunge | **FIXED** | 46 entries over a full bestiary attack: the art's right edge is at most 970 against the panel's inner right edge of 982 (12 px margin). `best_all.json` |
| 12f | ogre / troll recover pop | **FIXED** | the club in atk_recover is within a few px of idle. `z_ogre_attack.png`, `z_troll_attack.png` |
| 12g | ashen_queen tail in hurt | accepted nit | the tail still lashes on its own in hurt_in1/2, but it stays attached and no hole is open |

Performance and anim_crowd were not re-measured (out of time); none of the 70 unchanged sheets changed.

### B. Batch C/D (37 enemies), first test

Method: every frame in `strips/<id>.png` and zooms, the bestiary page (full attack loop, edge check), 5 mixed 9-enemy step loops (B1 shoreline sea, B2 temple undead/knights, B3 grassland beasts, B4 and B5 plain-backdrop dragons, worms and golems; 440 frames each, highest opaque y and lunge reach recorded). Every enemy stays below the window (highest pixel 188 or lower), every lunge reaches the front hero, no text overflow, and every caption is right.

| Enemy | Verdict | Finding | Evidence |
|---|---|---|---|
| baretta | OK | distinct from desert_baretta (spined anteater vs ankylosaur) | strips/baretta.png, sib_1.png |
| basilisk | P2 | a dark notch at the foreleg/chest join in atk_wind1/2 (1x: barely visible) | z_basilisk_idle.png |
| allosaurus | OK | distinct from tyrannosaur | strips/allosaurus.png |
| weretiger | OK | - | strips/weretiger.png |
| sand_worm | P2 | hurt_in2: two body arcs overlap in a fold or crease at mid-body | z_sand_worm_hurt_in1.png |
| minotaur_zombie | OK | cleaver changes hands in the hurt key (base art), reads fine | strips/minotaur_zombie.png |
| king_mummy | P2 | the gold crook staff turns black in hurt_in2/hurt (approved hurt key): prop identity | strips/king_mummy.png |
| medusa | OK | - | strips/medusa.png |
| rakshasa | OK | - | strips/rakshasa.png |
| clay_golem | P2 | the forehead rune changes glyph between idle ("R") and atk_mid/attack/atk_follow | strips/clay_golem.png |
| nightmare | OK | - | strips/nightmare.png |
| sahagin_prince | OK | distinct from sahagin / sahagin_chief | sib_0.png |
| deepeyes | OK | - | strips/deepeyes.png |
| sea_snake | OK | a red patch at the tail coil in hurt (base art) | strips/sea_snake.png |
| sea_scorpion | OK | distinct from scorpion | sib_3.png |
| sea_troll | P2 | jagged outline spurs at the knee join and broken finger outlines in atk_wind1, atk_wind2 and hurt_in1 | z_sea_troll_atk_wind2.png |
| ghost | OK | the small wisp beside the hurt key is part of the approved art | strips/ghost.png |
| water_elemental | P2 | keyframe-only (by design). The attack and hurt keys are ~25 % larger than the idle (size pop at the key switch). Idle 79 px, under the large band (96-120). Low contrast on its waterfall bestiary background | strips/water_elemental.png, best/water_elemental_f40.jpg |
| water_naga | OK | - | strips/water_naga.png |
| tyrannosaur | OK | - | strips/tyrannosaur.png |
| black_knight | P2 | keyframe-only (by design). 8 colours, near-black, low contrast against the temple's back wall | m_B2.jpg |
| chimera | **P1** | anatomy changes between keys: idle has 3 heads (lion, goat, one dragon); attack, atk_mid, atk_follow, hurt_in2 and hurt have 4 (a second open-jawed dragon head out front). Approved base art | z_chimera_idle.png, `?mute=1&bestiary=chimera&battleStep=1` |
| guardian | OK | a few dark pixels under the spear tips at the ground in hurt_in2 (1x invisible) | strips/guardian.png |
| blue_dragon | OK | - | z_blue_dragon_attack.png |
| green_dragon | OK | - | z_green_dragon_atk_wind2.png |
| stone_golem | P2 | the same knee/leg seam spurs as sea_troll in atk_wind1/2 and hurt_in1; a chest rune differs in hurt_in1 | z_stone_golem_atk_wind1.png |
| air_elemental | P2 | hurt_in2: a 1 px dark crease line runs diagonally across the body (an arm part's outline) | z_air_elemental_hurt_in2.png |
| spirit_naga | OK | - | strips/spirit_naga.png |
| death_knight | OK | - | strips/death_knight.png |
| earth_medusa | P2 | in idle and every idle-derived frame, an outlined pale rectangle sits on the chest (approved art); ragged fragments at the left arm in hurt_in1; at 2x it reads as a grey recolour of medusa (same pose, silhouette IoU 0.83) | z_earth_medusa_idle.png, sib_0.png |
| black_flan | OK | silhouette 0.88 vs green_slime (blobs) but black with 3 yellow eyes, distinct | sib_0.png |
| soldier | OK | - | strips/soldier.png |
| vampire_lord | OK | very dark (8 colours) but face and red eyes read on the temple background | z_vampire_lord_idle.png, m_B2.jpg |
| dark_fighter | OK | - | strips/dark_fighter.png |
| rhyos | OK | 4 heads in every frame (consistent) | strips/rhyos.png |
| purple_worm | OK | - | strips/purple_worm.png |
| iron_golem | OK | - | strips/iron_golem.png |

Counts: 26 OK, 1 P1 (chimera), 10 P2, 0 P0.

### C. Regression sample and quadruped `body: {width: 16}`

- **Sample (15 previously-OK sheets):** goblin, wolf, cockatrice, green_slime, shark, ashen_queen, manticore, hellhound, white_dragon, dragon_zombie, mindflayer, sphinx, wyvern, pirate, specter.
  - All are byte-identical to the first test's atlas in every frame (ashen_queen only in the planned hurt_in1/2).
  - In battle (B formations, L1 crowd) and in the bestiary: no new clipping or layout change; the bestiary right edge is within its margin.
  - The bosses (A1) lunge to the target hero and stay below the window.
- **`body: {width: 16}` pixel drop:** the rigs that use it are white_crocodile, dragon, white_dragon, fire_lizard, blue_dragon, sphinx, green_dragon, desert_baretta, chimera, manticore, crocodile, rhyos and dragon_zombie. wolf and hellhound use the template width.
  - Atlas idle, attack and hurt cells are pixel-identical to the approved PNG cells for all of them, so the keyframes drop nothing.
  - In-betweens: no key pixel is more than 4 px from any pixel of idle_b, for every one of these sheets.
  - The idle_b area loss is 1.4-2.4 %, the same range as rigs without the override (goblin 1.1 %, hellhound 2.1 %, wolf 3.2 %). This is breathing compression, not dropped body pixels.
  - Pixels that land far away only appear in hurt and attack in-betweens, where the parts really move.
  - **No silent pixel drop found** (`lost.py`, `inb.py`).

### Status

- No P0. One new P1 (chimera head count, base art). Every P1 from the first test is FIXED.
- P2s: 10 new in batch C/D; the first test's P2s are fixed or on the nit list. The new nits are the crocodile tail lump, the ice_gigas knee strand and the garland smear hook.

## Re-test (G7), 2026-11-16

Scope: `roster-int` at dd521b6 (123 sheets, 9 pages, 127 bestiary entries). Fresh tester, own dev server (127.0.0.1:5393) and headless Chromium (Playwright scripts), every URL with `mute=1`; server stopped afterwards.
Evidence (local, not committed): `/tmp/vpt3/` (`strips/<id>.png` every atlas frame, `z/z_*.png` zooms, `z/reg1.png` / `z/reg2.png` regression contact sheets, `z/sib_pir.png` swimmer siblings, `best/<id>_*.jpg` bestiary, `bt/T1..T4/` step loops (astos, warmech, swimmers on shoreline, T-K mix), `p_*.json` per-frame sprite bounds, `best_all.json` / `best_daze.json`, `df1..3.txt` Dark Fighter battle text and `df3_cur3_*.jpg`, `regress.txt`, `check_all.txt`, `roster_report.txt`, `fixmeasure.txt`, `sweep.txt`, `fps_*.jpg`, scripts `regress.py`, `top.py`, `ana3.py`, `meas.py`, `mont3.py`, `js/*.js`).

Automated pre-pass:
- Frame-rect diff vs b6b1346 (by sheet and frame name, `regress.py`): 100 sheets byte-identical in every frame; 21 changed = exactly the plan 9 list (G3: air_elemental, ashen_queen, basilisk, chimera, clay_golem, crocodile, earth_medusa, ice_gigas, king_mummy, sand_worm, sea_troll, stone_golem; T-K: astos, black_knight, black_widow, crawler, horned_devil, hydra, scorpion, warmech, water_elemental); 2 new (red_piranha, white_shark). Keyframes changed only where planned (chimera attack 787 / hurt 719 px, clay_golem attack 39, crocodile hurt 24, king_mummy hurt 21, earth_medusa idle 19, ashen_queen attack/hurt/cast by the FW-O offset).
- `monster_anim.py check --all`: 123 `OK`, exit 0, no `no rig`; aliased exactly chimera/hurt, black_widow/hurt, crawler/attack, astos/attack.
- `monster_roster_report.py`: no recolour flag. New watch pair bigeyes / red_piranha 0.80 / 0.39: distinct at 2x (white eyeball vs brown piranha, `z/sib_pir.png`). shark / white_shark 0.24 / 0.12.
- Fix gates re-run independently (`fixmeasure.txt`): edge gaps 0 in every flagged frame of sea_troll, stone_golem, earth_medusa, sand_worm, air_elemental, ice_gigas, basilisk; sand_worm hurt_in2 inner ink +1, air_elemental +1; crocodile box bare ink 0, (33,0,33) 0; king_mummy gold 28 / 26; ashen_queen rows 170-198 x 28-165 in idle, attack, hurt and cast; earth_medusa chest ink 0.
- No console errors or warnings in 23 bestiary entries, 13 step-loop battles and 3 real fights.
- Performance (GPU-backed headless Chromium, 10 s `enemyAnim=loop`): 9 ogres/trolls (the `anim_crowd` formation) median 120.5, p2 99; the 9-large mixed crowd 120.5 / 99, every sprite at scale 2; 9 new sheets 120.5 / 97. (Without GPU flags headless Chromium caps at 30 even for one goblin; not a game defect.)

### A. Round-2 items

| # | Item | Verdict | Evidence |
|---|---|---|---|
| P1 | chimera head count | **FIXED** | lion, goat and one dragon head in all 13 frames at 1x and 5-7x (idle .. atk_follow, hurt_in1/2, hurt, daze). No erase scar: the lion face and mane in attack / hurt read as continuous ramp, no flat patch or hole. hurt is aliased (FW-Q) so hurt_in1 = idle, hurt_in2 = hurt. `strips/chimera.png`, `z/z_chimera_*.png` |
| P2-1 | basilisk notch, atk_wind1/2 | **FIXED** | no dark notch at the foreleg/chest join; edge gaps 0. `z/z_basilisk_idle.png` |
| P2-2 | sand_worm fold, hurt_in2 | **FIXED** | one continuous body; hurt_in2 is now the hurt pose (inner ink +1 vs hurt). The switch from the idle curl to the hurt pose happens at hurt_in1 -> hurt_in2 (it is the key change). `z/z_sand_worm_hurt_in1.png` |
| P2-3 | king_mummy gold staff | **FIXED** | the crook is gold in hurt_in2 and hurt (28 / 26 gate px). `z/z_king_mummy_idle.png` |
| P2-4 | clay_golem rune | **FIXED** | the same "R" in idle, atk_mid, attack, atk_follow, hurt. `z/z_clay_golem_idle.png` |
| P2-5 | sea_troll knee spurs, finger outlines | **FIXED** | knees clean, fingers outlined in atk_wind1/2; edge gaps 0, spurs below idle's. Nit: in hurt_in1 the near hand opens into a mitten (fingers merge), 1x invisible. `z/z_sea_troll_hands.png` |
| P2-6 | stone_golem seams + far-shoulder spike | **FIXED** (nit) | edge gaps 0; no spike at the far shoulder. Residual: a 3 px diagonal ink hook under the near fist in hurt_in1 (rows 95-98, x 91-93), about 2 px at 1x. Chest runes: accepted (D-R6). `z/z_stone_golem_*.png` |
| P2-7 | air_elemental crease, hurt_in2 | **FIXED** | no line across the body. `z/z_air_elemental_hurt_in1.png` |
| P2-8 | earth_medusa chest box | **FIXED** | no box in idle, idle_b, atk_wind1, hurt_in1 (ink in the box 0) |
| P2-8c | earth_medusa arm fragments, hurt_in1 | **FIXED** (nit) | the arm reads whole, spurs 0, edge gaps 0; a 2 px ragged step on the shoulder top at 8x only |
| P2-9 | water_elemental bestiary background | **FIXED** | `shoreline`; the blue figure reads clearly against the brown rocks. Size pop / small idle: accepted (D-R6). `best/water_elemental_screen.jpg` |
| N-1a | crocodile curl lump | **FIXED** | no (33,0,33) inside the curl; it reads as tail |
| N-1b | crocodile tip strand | **NOT FIXED visually -> accepted nit by name (D-R6)** | the gate passes (bare ink 0, spurs 0), but at 6x the tip is still a thin 2 px stalk ending in a round knob, like an antenna; at 1x a thin hook. `z/z_crocodile_idle.png` |
| N-2 | ice_gigas knee strand | **FIXED** | no hanging strand in atk_wind1/2, atk_recover; the fur cuff bulges slightly (reads as fur). `z/z_ice_gigas_idle.png` |
| N-4 | ashen_queen coil planted | **FIXED** | coil base and altar stay put across all 17 frames, idle / attack / hurt / cast rows 170-198 at x 28-165. Tail lash in hurt: accepted nit. `strips/ashen_queen.png` |
| 7 | Dark Fighter casts CUR3 | **FIXED** | real fights at `sandbox=l30_lich`: (1) `enemies=iron_golem,dark_fighter`, party hits the golem: she casts CUR3 on the golem while she is at full HP ("Dark Fighter casts CUR3!", +69, +85); (2) `party=white_mage,white_mage,black_mage,black_mage&enemies=dark_fighter,iron_golem`: she heals herself when she is the most hurt ("Dark Fighter recovers 35 HP!", +13, +4). Log lines name CUR3. `df1.txt`, `df3.txt`, `df3_cur3_1.jpg` |

### B. Newly rigged sheets, first test

Method: every frame in `strips/<id>.png` and zooms; the bestiary page (attack, hurt, cast, daze steps; art right edge at most 970 vs the panel's 982); step loops on the shoreline (`bt/T1..T4`, highest opaque y, lunge reach). Every T-K in-between is translation-only, so each sequence still has one key switch (by design); listed below only where it reads as a pop.

| Enemy | Verdict | Finding | Evidence |
|---|---|---|---|
| astos | P2 | attack aliased (by design); cast and daze animate (daze: head bows); lunge top y 124 (window 120). Hurt: at hurt_in1 -> hurt_in2 the staff jumps from his right hand (screen left, vertical) to a diagonal across the other side and the cape balloons out, about 70 px at 2x; the crown lifts off the head in the hurt key (base art, reads as knocked up) | `z/z_astos_hurt_in1.png`, `p_T1.json` |
| warmech | P2 | daze slumps and reads; boss lunge top y 124, below the window; contact with the warrior. Hurt key is a smaller, thinner mech: height 183 -> 166, area -26 %, the near pauldron and back exhaust are gone; at hurt_in1 -> hurt_in2 it reads as a different model (base art) | `z/z_warmech_hurt_in1.png`, `bt/T2/s_0030.jpg` |
| water_elemental | OK (nit) | in-betweens smooth; the daze base sinks 3 px below the foot line (lowest row 125 vs 122) | `strips/water_elemental.png` |
| black_knight | OK | dark (accepted, D-R6); readable on shoreline | `bt/T4/` |
| horned_devil | OK | - | `strips/horned_devil.png` |
| scorpion | OK | hurt rears up (big but readable key change) | `strips/scorpion.png` |
| hydra | OK | 3 heads in every frame | `strips/hydra.png` |
| black_widow | OK | hurt aliased (by design); idle 45 px tall, small but readable | `strips/black_widow.png` |
| crawler | P2 | attack aliased (by design). The attack key's tail end is cut flat at x 2 with no outline on the cut (approved key; shows in atk_mid / attack / atk_follow) | `z/z_crawler_attack.png` |
| red_piranha | OK (nit) | in-betweens clean. Bestiary (`ocean`, ship deck): orange-brown fish on orange wood; it reads only by its outline | `z/pir_bg.png` |
| white_shark | OK (nit) | scale fits the swimmers (106 x 57 idle vs shark 77 x 97; similar area); lunge reaches the top hero from the back row. Same grey palette as shark: reads as the same species with scars (sibling, by design?) | `bt/T3/s_0000.jpg`, `z/sib_pir.png` |

Runtime nit seen in the swimmer and warmech lunges (existing behaviour, not new art): the impact dust spawns on the lunge's foot line, so under a leaping shark / white_shark it floats in mid-air, and under warmech it lands between the legs instead of at the front claw. `z/T3_mont.jpg`, `z/blob_seq.png`

Counts: 8 OK (3 with nits), 3 P2, 0 P1, 0 P0.

### C. Regression sample and sweep

- **Sample (15 + bosses):** goblin, wolf, cockatrice, green_slime, cobra, ochu, shark, lich, garland, hollow_seraph, chaos, death_eye, drowned_sovereign, vampire, ogre, troll. All byte-identical to b6b1346; at 2x (`z/reg1.png`, `z/reg2.png`) the round-1 fixes hold (lich one skull, garland no hip hole, seraph 6 wings, cobra head, vampire face, ochu no specks). Boss lunges, highest opaque y: chaos 124, hollow_seraph 121, garland 128, lich 124, death_eye 137, drowned_sovereign 148, ashen_queen 124, astos 124, warmech 124 (same as F6 where measured).
- **9-large crowd:** all 9 at scale 2 (`p_L1.json`).
- **FW-M2 sweep top 10** (`sweep.txt`: chaos daze 66, daze_b 64, atk_raise_in 63, hurt_in1 57, cast_gather 52, ogre_mage hurt_in2 47, dragon_zombie atk_follow 40, chaos atk_recover 34, ogre_chief hurt_in1 34, dragon_zombie atk_mid 33) at 4-5x: mostly broken outline runs on very dark art, not visible at 1x. One visible: chaos hurt_in1, a straight background slit opens between the near horn and the right wing's leading edge, which is cut straight (`z/z_chaos_idle.png`). ogre_mage, dragon_zombie, ogre_chief: ragged edge px only. For D-R6 or a later round.

### Status

- No P0, no P1. The chimera P1 is FIXED (second round).
- Every round-2 P2 and nit is FIXED except the crocodile tip strand, which is on the D-R6 list by name.
- New P2s: astos hurt staff/cape switch, warmech hurt key smaller and missing parts, crawler attack tail sliced flat. New nits: stone_golem 3 px hook (hurt_in1), water_elemental daze 3 px below the feet, red_piranha bestiary contrast, white_shark same palette as shark, impact dust in mid-air under swimmers, chaos hurt_in1 wing slit (sweep).

## Pass V play test (V7), 2026-11-16

Scope: `roster-int` at 711c5c0 (123 sheets, 9 pages). Fresh tester, own dev server (127.0.0.1:5417) and headless Chromium (Playwright scripts), every URL with `mute=1`; server stopped afterwards. Changed enemies: the 7 redesigns (crazy_horse, piscodemon, black_knight, guardian, vampire, hollow_seraph, chaos), the redesigned red `dragon`, and the 23 rescaled sheets (display scale 3), plus chaos at scale 3 (D-V6 = C2).
Evidence (local, not committed): `/tmp/vpt4/` (`strips/<id>.png` every atlas frame, `z/on_*.png` old (V-base) vs new keys at screen scale, `z/z_*.png` zooms, `z/sib_*.jpg` and `z/g_sib.jpg` sibling battles, `z/dark_bg.jpg` backgrounds, `best/<id>_*.jpg` bestiary, `best_centre.txt`, `best_step.txt`, `bt/<scenario>/` step loops of the five `anim_pass_v_*` scenarios, `bt/H6`, `bt/H9`, `bt/R1`, `bt/B_<boss>/`, `fx/c1_*` (chaos fight) and `fx/h1_*` (3-huge fight), `p_*.json` per-frame sprite records, `regress.txt`, `check_all.txt`, `roster_report.txt`, `blk.txt` (block test), `fps.txt`; scripts `regress.py`, `ana4.py`, `blockchk.py`, `oldnew.py`, `zk.py`, `darkbg.py`, `js/*.js`).

Automated pre-pass:
- Frame-rect diff vs V-base (0309552, by sheet and frame, content): 115 sheets byte-identical in every frame; changed exactly crazy_horse, piscodemon, black_knight, guardian (cell 148 -> 128), vampire, hollow_seraph, chaos, dragon. No new or missing sheet. Atlas JSON `scale: 3` on exactly the 23 rescaled sheets plus chaos.
- `monster_anim.py check --all`: 123 `OK`, exit 0.
- `monster_roster_report.py` (not run in V6): no recolour flag. Three new watch pairs, all with a redesign: vampire / vampire_lord 0.80 / 0.21, black_knight / death_knight 0.75 / 0.37, rakshasa / vampire 0.75 / 0.29. Judged side by side at screen scale (`z/on_vamp.png`, `z/on_bk.png`, `z/sib_kn_000.jpg`): all distinct (red-lined cape and pale face vs the all-black, white-haired lord; tiger head in red robes; black plate with greatsword vs skull face, horned helm and red cape). Named pairs: crazy_horse / nightmare 0.70 / 0.34, mindflayer / piscodemon 0.53 / 0.23, death_eye / hollow_seraph 0.45 / 0.26, astos / chaos 0.53 / 0.24, dragon vs its four siblings <= 0.46.
- Block test (plan 2.7, PNG at DPR 1, every art pixel whose 3x3 footprint is opaque against the atlas colour, `blk.txt`): all 24 scale-3 sheets at integer positions, `scaleMode nearest`, 0 mismatches (2,417 to 14,031 blocks per sheet); fire_gigas 13 at y 224-227, which is the dev step label drawn over it, not the art.
- Bestiary centring (`best_centre.txt`, 46 entries: the 8 redesigns, the 23 rescaled, 15 unchanged): the idle box centre is on the panel centre (512, 498) to the pixel in all 46; chaos is 8 px high (its 561 px box is clamped inside the panel). Every idle box inside the panel inner rect. Bestiary step loops (`best_step.txt`, 260 steps, 10 sheets incl. chaos, seraph, dragon, ice_gigas, green_dragon): the art of every shown frame stays inside the panel.
- Performance (GPU-backed headless Chromium, 10 s `enemyAnim=loop`): 9 ogres/trolls 120.5 median (p2 97); 3 tier-H (dragon, hill_gigas, green_dragon) 120.5 (p2 98); chaos alone 120.5; the mixed six 120.5 (p2 99).
- No console errors or warnings (besides the GPU ReadPixels notice) in 46 bestiary entries, 5 scenarios, 13 sandbox battles and 2 real fights.

### A. The user's pass-V goals

| # | Goal | Verdict | Evidence |
|---|---|---|---|
| 1 | Bestiary enemies centred in the panel, not the screen | **MET** | idle box centre = panel centre (512, 498) +-0 px in 46 entries (chaos dy -8); the art of every step-loop frame inside the panel. `best_centre.txt`, `best_step.txt`, `best/chaos_screen.jpg` |
| 2 | crazy_horse much more evil and otherworldly, a weaker nightmare-steed, clearly not "just a horse", distinct from nightmare | **PARTLY** | Distinct from nightmare: yes (ash grey vs black with blue flame mane; smaller, 178 vs 222 px tall). Otherworldly: only in the hurt keys, where the yellow-green cracks blaze. In idle / attack at 1x it reads as a gaunt, sick grey horse: a plain horse silhouette, the cracks are faint olive lines, the eye a 2 px dot, the neck spines small. See P1-1. `z/on_horse.png`, `z/z_ch_hurt.png`, `bt/regulars/s_0000.jpg` |
| 3 | shark, bigeyes, minotaur, ochu, neochu, hydra, the elementals, all gigas, all dragons noticeably larger (ogre-size or above) and filling the field sensibly | **MET** (one P2) | Idle height on screen: every rescaled sheet >= 225 px vs ogre 202 (dragon_zombie 225 x 333 wide, water_elemental 234, ochu 246, up to ice_gigas 366, fire_gigas 363, dragon 351); bigeyes (large) 162 x 240. Siblings in step (lesser <= greater: bigeyes < deepeyes < evil_eye; shark / white_shark; minotaur < minotaur_zombie; hydra / fire_hydra), no blur (block test). 3-huge and mixed formations: no overlap at rest, integer scales, lunges below the window (hill_gigas travel top 130). Crowds of 4+ tier-H fall back (P2-7). `z/on_resc1.png`, `z/on_drag.png`, `z/g_sib.jpg`, `bt/huge/`, `bt/mixed/`, `p_huge.json`, `p_mixed.json` |
| 4a | piscodemon a terrifying junior mind-flayer, distinct from mindflayer | **PARTLY** | Junior mind-flayer: yes (octopus head, face tentacles, hunched body, bone pauldrons). Distinct: yes (teal, no robe vs pink head in a black robe; silhouette 0.53). Terrifying: no; the big round pale eye with a small pupil and the soft teal ramp read as sad or goofy, not menacing; no glow or teeth. P2-1. `z/z_pisc.png`, `z/z_pisc_face.png` |
| 4b | black_knight terrifying even at small size | **PARTLY** | Bulky black plate, gold trim, greatsword, magenta visor slit: reads as a heavy dark knight. At 1x (146 px) the curled ram horns are two round grey blobs that read as mouse / bear ears, and the visor glow is 2-3 px; more "chunky toy knight" than terrifying. Distinct from death_knight / dark_fighter: yes. P2-2. `z/on_bk.png`, `z/bk_best.png` |
| 4c | guardian an evil robot killing machine | **MET** | Gunmetal four-legged insectoid mech, two scythe blades, three red eye lights; reads as a killing machine at 1x; distinct from warmech (bronze biped), iron_golem, soldier. `z/z_guard.png`, `z/sib_guard_000.jpg` |
| 5 | vampire clean, not pixelated or messy | **MET** | crisp outlines, flat clean ramps, readable red eyes and pale face in all 13 frames; no specks. `z/z_vamp.png` |
| 6 | hollow_seraph: hollow, disconnected, modern-robotic steampunk angel of doom with metallic blade-of-light wings | **PARTLY** | Disconnected: yes (helm, torso, gauntlets and skirt float apart with gaps). Steampunk: yes (brass trim, cog halo, chest clockwork). 4 blade wings in every frame. But the "wings" are four cream swords with hilts and crossguards (main colours (247,247,222) and (231,214,165)): they read as orbiting swords, not as wings, and neither metallic nor light (no glow, no steel ramp). "Hollow" does not read: the parts are solid, nothing seen through them. Angel: weak (no wing shape). P2-3. `z/on_sera.png`, `z/z_sera.png`, `best/hollow_seraph_screen.jpg` |
| 7 | chaos by far the biggest, a huge cosmic overlord final boss | **MET** (P2 nits) | 558 x 549 px on screen vs the next largest 376 (garland); dominates the enemy side; top 179, bottom 745, never under the window; attacks in place (art reaches x 1054, party at 1410); flame head, gold-trimmed armour, starry black robe, 2 arms, 4 orbs. Robe readable on every committed background (all mid-to-light; evil_temple is teal), but its folds and stars do not read at 1x (a flat black mass). P2-4, P2-5, P2-6. `bt/chaos/`, `z/g_chaos.jpg`, `z/dark_bg.jpg` |
| + | red dragon: an imposing red dragon larger than ogre and its siblings | **MET** | rearing, winged, horned; 351 px tall vs ogre 202 and white / blue / green 285-291 (narrower: 258 vs 330-372 wide); consistent across all 13 frames. `z/on_drag.png`, `strips/dragon.png`, `bt/huge/s_0000.jpg` |

### B. Changed enemies

Method: every frame in `strips/<id>.png` and zooms; bestiary (centring, step loop); battle step loops in the five `anim_pass_v_*` scenarios and sandbox formations (`p_*.json`: highest opaque y, reach, overlap at rest).

| Enemy | Verdict | Finding | Evidence |
|---|---|---|---|
| crazy_horse | **P1** | see P1-1; frames otherwise clean, hurt_in1 -> hurt_in2 key switch (rears, mane shrinks; by design) | `strips/crazy_horse.png` |
| piscodemon | P2 | P2-1; 13 frames clean; tentacle count: 4-5 strands visible at 8x, not the 6 the plan names | `z/z_pisc_face.png` |
| black_knight | P2 | P2-2; frames clean; attack key switches the sword from upright to a low thrust (key change) | `z/z_bk.png` |
| guardian | OK (nit) | 4 legs + 2 blades in every frame; in atk_mid / attack the eye row becomes a red splash at 4x (reads as an eye flare at 1x) | `z/z_guard.png` |
| vampire | OK | clean; new watch pairs distinct (above) | `z/z_vamp.png` |
| hollow_seraph | P2 | P2-3; lunge top 124 (window 120, same as G7 121); heavy-attack red tint telegraph reads; 15 of 17 frames seen in battle | `bt/seraph/`, `z/g_sera.jpg` |
| chaos | P2 | P2-4 / 5 / 6; 2 arms + 4 orbs in all 22 frames; heavy raise and cast read in the loop | `strips/chaos.png`, `bt/chaos/` |
| dragon | OK | above | `strips/dragon.png` |
| bigeyes, shark, minotaur, ochu, neochu, hydra, earth_elemental, fire_elemental, water_elemental, air_elemental, hill_gigas, fire_gigas, ice_gigas, white_dragon, blue_dragon, green_dragon, dragon_zombie, white_shark, minotaur_zombie, fire_hydra, deepeyes, evil_eye (22 rescaled, plus dragon above) | OK | art and rigs byte-identical to V-base; scale 3, block test 0 mismatches; bestiary centred; larger than the ogre in battle; siblings in order (`z/g_sib.jpg`); the 3x pixel blocks next to 2x neighbours are visible (accepted, D-V1) | `blk.txt`, `best_centre.txt` |

Effects on the big boxes (real fights, `fx/`): KNGT Fight, NINJ Fight, WWIZ HEAL (all), BWIZ FIR2 (all).
- chaos (`anim_pass_v_chaos`, poisoned): slash effect across the body, damage numbers (64, poison 15) at the head, below the window (y about 155); poison bubbles drift over the robe; HEAL on the party fine. Two P2s: P2-5, P2-6.
- 3 tier-H (`anim_pass_v_huge`): FIR2 tints each enemy red, numbers 50 / 52 / 43 at each head, on screen and below the window; KNGT's 419 on the red dragon at its head; HEAL fine; hill_gigas' lunge to WWIZ makes contact and draws over green_dragon. `fx/h1_019_run.jpg`, `fx/h1_046_run.jpg`

### C. Defects

| # | Sev | Kind | Enemy | Defect | Repro (`http://127.0.0.1:<port>/?mute=1&...`) | Evidence |
|---|---|---|---|---|---|---|
| P1-1 | P1 | art (user goal 2) | crazy_horse | Idle / attack / daze (11 of 13 frames) read as an ordinary gaunt grey horse at 1x: plain horse silhouette, faint olive cracks, 2 px eye; the otherworldly glow is only in hurt_in2 / hurt. Needs the glow cracks and eyes (and something non-equine: smoke legs, a split skull, spines) visible in idle | `bestiary=crazy_horse&battleStep=1`; `scenario=anim_pass_v_regulars` (Debug) | `z/on_horse.png`, `z/z_ch_hurt.png`, `bt/regulars/s_0000.jpg` |
| P2-1 | P2 | art (goal 4) | piscodemon | Not terrifying: big round pale eye, soft teal; tentacles 4-5 visible, not 6 | `bestiary=piscodemon` | `z/z_pisc_face.png` |
| P2-2 | P2 | art (goal 4) | black_knight | Round curled horns read as mouse / bear ears at 1x; visor glow tiny | `bestiary=black_knight` | `z/bk_best.png` |
| P2-3 | P2 | art (goal 6) | hollow_seraph | The four blade wings read as cream swords with hilts, not metallic light-blade wings; the body does not read hollow | `bestiary=hollow_seraph` | `z/z_sera.png` |
| P2-4 | P2 | art | chaos | attack_raise / atk_raise_b / atk_swing: the arms double in thickness and the flame head drops about 40 art px into the chest (identity and proportion pop from atk_raise_in = idle) | `bestiary=chaos&battleStep=1` | `strips/chaos.png` row 4 |
| P2-5 | P2 | runtime | chaos | The poison status icon (green drop) and the top orb sit inside the damage number ("6" drop "4") | `scenario=anim_pass_v_chaos`, Fight | `z/fx_num64.png` |
| P2-6 | P2 | runtime | chaos (scale 3) | FIR2's flames spawn as two small flames at the robe hem; on a 558 px boss they are barely visible on the black robe (the tier-H boxes show the red tint instead) | `scenario=anim_pass_v_chaos`, BWIZ Magic FIR2 | `z/fx_fir2.png` |
| P2-7 | P2 | layout | tier-H crowds | 6 tier-H (shark, minotaur, ochu, hydra, earth_elemental, ice_gigas) drop to scale 2 (ogre size); 9 tier-H mix drops to scale 1 (dragons 113 x 120 px, smaller than a scale-2 goblin), shown without a warning. Plan 2.5 calls 5+ tier-H unsupported (`formationFits` false) and no authored formation has them, but the sandbox still runs it | `sandbox=l30_lich&enemies=dragon,white_dragon,blue_dragon,green_dragon,dragon_zombie,fire_gigas,neochu,evil_eye,air_elemental&enemyAnim=step` | `bt/H6/`, `bt/H9/`, `p_H9.json` |
| P2-8 | P2 | UI (pre-existing, not pass V) | dragon (and any long Weak row) | Bestiary stats: "Weak Ice, Poison/Stone" runs into the "Resist" label ("Poison/StoneResist") | `bestiary=dragon` | `best/dragon_screen.jpg` |

Nits (not filed): chaos robe folds / stars invisible at 1x; guardian attack eye splash at 4x; mixed pixel density of 3x sheets beside 2x ones (D-V1 accepted).

### D. Regression sample

- **15 unchanged sheets** (goblin, wolf, cockatrice, green_slime, cobra, ogre, troll, ashen_queen, lich, garland, astos, warmech, death_eye, drowned_sovereign, nightmare) plus mindflayer: byte-identical to V-base; bestiary centred (+-0 px); in battle (`bt/R1`, `bt/B_<boss>`) no overlap at rest, integer scale 2. Boss lunges, highest opaque y: ashen_queen 124, lich 124, garland 128, astos 124, warmech 124, death_eye 137, drowned_sovereign 148: identical to G7. chaos + 2 goblins: no overlap, goblins at scale 2.
- The three open G7 P2s (astos hurt, warmech hurt, crawler tail) not re-tested (D-V16).

### Status

- No P0. One P1 (P1-1, crazy_horse idle does not meet user goal 2). Eight P2s (P2-1 .. P2-8; P2-8 pre-existing).
- Goals: 1 MET, 2 PARTLY, 3 MET, 4 PARTLY (guardian MET; piscodemon and black_knight PARTLY), 5 MET, 6 PARTLY, 7 MET; red dragon MET.

---

## V8 re-test (W5), 2026-11-16

Scope: `roster-int` at f49aaa9 (123 sheets, 9 pages), against the V7 tested commit 711c5c0. Fresh tester, own dev server (127.0.0.1:5491) and headless Chromium (Playwright scripts), every URL with `mute=1`; server stopped afterwards.
Evidence (local, not committed): `/tmp/vpt5/` (`strips/<id>.png` every atlas frame now, `ostrips/<id>.png` the same at 711c5c0, `best/<id>_*.jpg` bestiary, `best_changed.json`, `best_reg.json`, `bt/{regulars,seraph,chaos}/` step loops (`battleStep=1&enemyAnim=loop`), `p_*.json` per-frame sprite records, `fx/c1_*` (real-time chaos fight), `fx2/f_*` (the same fight stepped, 4 frames per shot), `fx3/g_*` (goblin / ogre / dragon fight), `sb_*.jpg` sandbox, `fps.txt`, `regress.txt`, `z/*` crops and montages; scripts in `js/` and `*.py`).

Automated pre-pass:
- Frame diff vs 711c5c0 (`regress.txt`): 118 sheets byte-identical in every frame; changed exactly black_knight (paint, 75-93 px per frame), chaos (the five raise frames gone, atk_wind1/2 redrawn), crazy_horse (cell 128 -> 132 wide), hollow_seraph (cell 218 -> 200 wide), piscodemon (cell 80 -> 82 wide). No new or missing sheet.
- Bestiary (23 entries: the 9 changed / compared plus 14 unchanged): the idle box centre is on the panel centre (512, 498) to the pixel in all, chaos at dy -8 as in V7; the art of every frame of a 160-step loop stays inside the panel. The 14 unchanged entries have the same sprite boxes as V7.
- FPS (GPU-backed headless, 10 s `enemyAnim=loop`): 9 ogres / trolls (= `anim_crowd`) 120.5 median (p2 107.5); chaos alone 120.5 (p2 107.5); crazy_horse + piscodemon + black_knight + hollow_seraph 120.5 (p2 107.5).
- No console error or warning in any bestiary entry, scenario or fight, except the intended sandbox refusal warning.

### A. V7 findings

| # | V7 finding | Verdict | Evidence |
|---|---|---|---|
| P1-1 | crazy_horse: an ordinary gaunt grey horse in idle / attack / daze | **FIXED** | New art in all 13 frames: a bare skull head with a glowing yellow-green eye, a black smoke mane and tail, smoke-tendril hooves, a row of bone spines and ribs along the back, and bright yellow-green cracks over the body in idle, attack and daze (not only in hurt). At 1x in battle and in the bestiary it reads as an undead demon steed; the horse outline is still there, and the skull, smoke and cracks read without zooming. The head-down charge in the attack shows the skull. Distinct from nightmare (pale bone vs a black horse with a blue flame mane). Nits: on grass the yellow-green cracks have less contrast than on stone; crazy_horse now looks more monstrous than the stronger nightmare (not a defect, it is still clearly a different creature). `strips/crazy_horse.png` vs `ostrips/crazy_horse.png`, `z/ch_best_1x_zoom2.png`, `z/reg_ch_3.png` (attack), `z/reg_ch_16.png` (hurt), `z/nm.png`, `bt/regulars/s_0000.jpg` |
| P2-1 | piscodemon not terrifying | **FIXED** (nit) | Dark slate-teal hunched brute with a domed head, narrow slanted orange eyes and 5-6 face tentacles that fan out in the attack and hurt frames. Reads as menacing (the sad round eye is gone). Distinct from mindflayer (hunched and armoured vs a slim purple figure in a black robe). Nit: a small sheet (106 x 146 px on screen), so the eyes are a few pixels wide at 1x, and the dark palette has low contrast on dark backgrounds. `strips/piscodemon.png`, `z/reg_pisc_x3.png`, `z/pisc_vs_mf.png`, `best/piscodemon_screen.jpg` |
| P2-2 | black_knight: round horns read as ears; tiny visor glow | **FIXED** (nit) | The painted horns are pointed, pale, curve up and out: they read as horns at 1x in all 13 frames. A magenta T visor (slit and bar) reads in the 3x zoom; at 1x it is a magenta spot in the black helm. Heavy, horned, faceless: menacing at 96 x 150 px. Nit: the T shape itself needs a zoom. `strips/black_knight.png`, `z/reg_bk_x3.png`, `best/black_knight_screen.jpg` |
| P2-3 | hollow_seraph: blades read as cream swords; body not hollow | **FIXED** | Four hilt-less blades of pale cold blue light on brass struts, two up and two down, in all 17 frames: they read as wings of light, not swords. The helm, breastplate, gauntlets and skirt float apart with dark gaps between them, and in the cast keys the chest opens on a white light: reads as hollow, floating armour. Heavy-attack red telegraph reads; lunge top 128 (>= 124). Hurt (taken from the idle, shifted (-3, 2) art px, with 116 px of visor and heart dimming): it reads as a hit because the visor slit and chest light go dark and the runtime shake shows, but there is no flinch pose (nit). The cast_gather -> cast_rise key change is a visible pose switch (wings raised, chest opens), by design. A new P2 on size is below (N-1). `strips/hollow_seraph.png`, `best/hollow_seraph_screen.jpg`, `z/m_seraph.jpg`, `z/sera_hurt.jpg`, `z/sera_v7_v8.jpg` |
| P2-4 | chaos heavy-attack raise: doubled arms, head sinks into the chest | **FIXED** | The raise frames are gone from the atlas (`regress.txt`). The heavy sequence plays `idle atk_wind1 atk_wind2 atk_mid attack atk_follow atk_recover` with a red pulse as the telegraph, which reads. The flame head's top is at art y 19-22 in every attack frame (idle 20): it never sinks. Two arms in every frame; the attack key's banded arm is a little bulkier than the idle's, with no doubling. `strips/chaos.png`, `z/m_chaos.jpg`, `p_chaos.json` |
| P2-5 | chaos damage number on the poison icon and top orb | **FIXED** | On poisoned chaos the numbers (2, 108, 25) spawn below the green drop with a clear gap of about 25 screen px; no overlap with the icon row in any frame. The number still lies over the top orb, which is art (accepted, as noted in the brief). `z/c1_num_15.png`, `z/c1_num_21.png`, `fx/c1_*` |
| P2-6 | FIR2 flames tiny at chaos's robe hem | **FIXED** | Stepped capture: about 10 large flames rise over the robe, waist and shoulders, followed by the red tint. They are plainly visible on the black robe. The real-time capture (120 ms sampling) caught only 1-3 flames, a sampling artefact. `z/fir2_stepped.jpg`, `fx2/f_052.jpg`, `fx2/f_054.jpg` |
| P2-7 | sandbox: 6-9 tier-H silently shrink | **FIXED** | `sandbox=l30_lich&enemies=<9 tier-H>`: the sandbox stays on its menu, warns `sandbox: formation does not fit at an integer scale >= 2: dragon, white_dragon, ...` and pushes no battle; pressing Fight! again refuses again, with the same warning. The 6 tier-H start at screen scale 2 (the D-O10 nit, by design). The 3-huge formation (scale 3) and the mixed six (2, 2, 3, 2, 2, 2) start. Note: the refusal shows only in the console, with no message on screen (D-O7 as ruled; dev only). `sb_H9.jpg`, `sb_H9_press.jpg`, `sb_H6.jpg`, `sb_H3.jpg`, `sb_MIX.jpg` |
| P2-8 | bestiary Weak runs into Resist | **FIXED** | dragon: "Weak  Ice, Poison/Stone" takes the full row and Resist moves to the next line; no overlap. hollow_seraph (Weak Poison/Stone, Resist Fire, Ice, Bolt), vampire, sahagin_chief, blue_dragon, shark: no overlap. `best/dragon_screen.jpg`, `z/weak_rows.jpg` |

No-status fight (`sandbox=l30_lich&enemies=goblin,ogre,dragon`, Fight x4): numbers 143 (ogre), 70 and 294 (red dragon), 46 (goblin) appear at and over each head and rise as in V7 (the F6 change applies only with an icon; the commit's no-icon path is unchanged). `z/g_nums.jpg`, `fx3/g_*`.

### B. Regression sample

- 10+ unchanged sheets (goblin, wolf, ogre, troll, lich, garland, astos, warmech, death_eye, green_dragon, plus vampire, shark, blue_dragon, nightmare, mindflayer, death_knight, dragon): byte-identical to 711c5c0; bestiary centred, sprite boxes as in V7 (astos only moved page in the atlas). guardian and vampire in `anim_pass_v_regulars`: unchanged and clean.
- Lunge tops in `anim_pass_v_regulars`: 235-285 (no enemy near the window).

### C. New findings

| # | Sev | Kind | Enemy | Finding | Repro (`http://127.0.0.1:<port>/?mute=1&...`) | Evidence |
|---|---|---|---|---|---|---|
| N-1 | P2 | art / size | hollow_seraph | The regenerated boss is about 25 % smaller than in V7: idle art 336 x 276 px on screen vs 426 x 366 (the cell went from 218 to 200 wide and the body is shorter). It is now clearly smaller than the other late bosses (lich 370 x 368, garland 336 x 378, warmech 360 x 366) and only a little taller than the ogre (204), which weakens the "angel of doom" presence. | `bestiary=hollow_seraph`; `scenario=anim_pass_v_seraph` | `z/sera_v7_v8.jpg`, `best_changed.json` vs `/tmp/vpt4/best_centre.txt` |
| N-2 | P3 | layout (observation) | crazy_horse | The wider V8 sheet (home art 126 art px) no longer fits a crowd with tier-H sheets, so the sandbox refuses it (the reason f49aaa9 moved nightmare into the layout test's crowd). Nine crazy_horse still lay out at screen scale 1 (pass 4, allowed for scale-2 sheets, as before). No authored encounter uses crazy_horse yet. | `sandbox=l30_lich&enemies=crazy_horse x9` | `sb_CH9.jpg` |

Nits (not filed): seraph hurt has no flinch pose (lights dim plus shake only); black_knight T visor and piscodemon eyes need a zoom at 1x; crazy_horse cracks have less contrast on grass; the sandbox refusal has no on-screen message; chaos number over the top orb (art).

### D. The user's pass-V goals

| # | Goal | Verdict | Evidence |
|---|---|---|---|
| 2 | crazy_horse much more evil and otherworldly, a weaker nightmare-steed, clearly not "just a horse", distinct from nightmare | **MET** | skull head, glowing eye, smoke mane and hooves, spines and glowing cracks in every frame at 1x; distinct from nightmare (P1-1) |
| 4 | piscodemon a terrifying junior mind-flayer; black_knight terrifying even at small size (guardian MET in V7) | **MET** (nits) | piscodemon: slanted glowing eyes, dark palette, fanned tentacles, distinct from mindflayer; black_knight: pointed horns and a glowing visor at 150 px. Both are menacing rather than truly terrifying at their small size (P2-1, P2-2 nits) |
| 6 | hollow_seraph hollow, disconnected, modern-robotic steampunk angel of doom with metallic blade-of-light wings | **MET** (one P2) | four blade-of-light wings on brass struts, floating disconnected armour, open light-filled chest in the cast; the presence is weakened by the smaller size (N-1) |

### Status

- 9 V7 items re-tested (P1-1, P2-1 .. P2-8): **9 FIXED**, 0 NOT FIXED, 0 REGRESSED. No-status numbers unchanged. Regression sample clean.
- No P0, no P1. New: one P2 (N-1, hollow_seraph about 25 % smaller than in V7) and one P3 observation (N-2).
- Goals 2, 4 and 6: MET (4 with nits, 6 with N-1). Plan 4.3 done criterion (P1-1 FIXED, every P2 FIXED or a decided nit, no new P0 / P1): **met**.
