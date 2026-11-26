# Pass PT: playtest field art (townsfolk, elves, Matoya's brooms, the ship's end views)

Rev 3.3, 2026-11-26 (rev 3: Momus round 1 fixes; 3.1: round 2 nits; 3.2: amendment A1, 4.1 step 6; 3.3: amendments A2-A4, section 10; section 9). Branch `playtest-art` (from `fc793e05`). Rev 1 planned Stability-on-Bedrock renders (the DW route);
rev 2 follows the user's change of approach the same day: **the user renders every new sheet in ChatGPT** (as for the
monsters in EF-H, `gen/monster_user*.py`); this pass makes the reference packs and the prompts, then imports the user's
renders. **No Bedrock or Gemini call, no budget block.**

## 0. The user's requests (playtest, 2026-11-25, verbatim)

- R1 "Too many character sprites are the hero sprites. I don't want them to be that common. Let's generate more random
  townsfolk to replace them."
- R2 "There are no elves in elfheim ... we need some 'elf' NPC characters."
- R3 "'brooms' are black wizards, not brooms, in matoya's cave" (Matoya's enchanted brooms talk in FF1; they need a
  broom that hops / sweeps).
- R4 "the ship has no 'down' or 'up' poses" (the field ship has only its side view; it should get a back view,
  sailing up, and a front view, sailing down, as the airship did in pass AV).
- R5 (the change of approach) "for generating new NPCs, generate a sheet with 3-4 different overworld NPCs in all
  necessary poses, as well as a prompt I can send to chatgpt to generate new sprite sets."

## 1. Phases and stop points

| phase | what | output | stop |
|---|---|---|---|
| PT-1 | audit, sheet list, reassignment, this plan | this file | Momus OKAY on this plan |
| PT-2 | reference sheet + ChatGPT packs (offline compositing of approved art only) | `~/temp/ff-game/playtest/art/` | **STOP: the user renders the sheets** |
| PT-3 | importer `gen/field_user.py` + `gen/vehicle_user.py`, the walk / heading code, tests | code on `playtest-art` | only after the user's go-ahead (relayed by the coordinator) |
| PT-4 | import each returned render, review sheet, user picks | `approved/<id>/field.*`, `user_art/<id>/` | the user approves each sheet |
| PT-5 | reassignment (the `sprite` fields, the tint rule of 5.4) + gates | layout scripts, compiled maps | coordinator merges |

PT-2 is done (section 3). PT-3 to PT-5 wait for the user.

## 2. The audit (PT-1)

Source: every NPC of every map source `assets-src/maps/*.yaml` (159 files; each generated source names its layout
script in its header, so a change goes into the script). Hero class sheets: warrior, thief, monk, white_mage,
black_mage, red_mage, knight, ninja, master, white_wizard, black_wizard, red_wizard (the party's field sheets; `mage`,
`old_man`, `guard`, ... are NPC sheets of their own). Scratch script `/tmp/playtest-art/audit.py`.

**86 NPCs use a hero sheet**: white_mage 20, white_wizard 10, knight 10, monk 9, black_wizard 8, thief 7, black_mage 7,
warrior 5, master 4, red_mage 3, red_wizard 2, ninja 1. Most are magic-shop keepers and healers (white / black mage),
lads and apprentices (thief), pilgrims (monk), Elfheim's people (every class, under the `#cfe8c2` elf tint), the
Crescent sages, Bikke (warrior), and Matoya's three brooms (`black_wizard` tinted `#a07a48`).

**Existing non-hero NPC sheets and their uses today** (chest 163 not counted): villager_f 45, old_man 39, villager 38,
guard 37, farmer 29, mage 23, merchant 22, burgher 22, vendor_f 9, king 9, innkeeper 8, dragon_youth 6, dragon_guard 6,
princess 4, mermaid 4, dwarf_trader 4, dwarf_miner 4, dragon_elder 4, luf_senator 3, luf_citizen_m 3, luf_citizen_f 3,
dragon_matron 3, robot_sentry 2, robot_ancient 2, dwarf_guard 2, dwarf_elder 2, dragon_sage 2, dragon_hatchling 2,
bahamut 2, sage_star 1, sage_flame 1, sage_earth 1, garland_npc 1, fairy 1, dwarf_woman 1, dwarf_smith 1,
dwarf_nerrick 1, dwarf_child 1, dr_unne 1. There is no child sheet for humans (children use villager / villager_f at
adult height), no sailor, no pirate (Bikke's crew are guards and villagers) and no elf.

The full table of the 86 with what each becomes is section 5.1.

## 3. The new sheets and the packs (PT-2, done)

### 3.1 Field-sheet format (what the importer needs)

An approved field sheet is `approved/<id>/field.png`, **144 x 288, a 3 x 3 grid of 48 x 96 cells**, rows `down`
(front), `up` (back), `left` (side); columns `stand`, `step_left`, `step_right`; the soles on **row 93** of each cell
(`bottom_row` 93, 2 rows free); binary alpha; at most 16 colours, 15-bit; a dark 1 px outline (`build_assets.field_rows`,
`approve.py`). `build_field_ai` turns each row into the 7 walk columns (`puppet.walk_row`) and mirrors `left` into
`right`. The packs ask ChatGPT for the side row **facing left** (as the game shows it), so a user sheet needs no
`flip_rows` (the Bedrock sheets drew it facing right). Sizes: hero 86-90 px drawn, adult NPCs 86-92
(burgher 89, villager_f 92, old_man 91, vendor_f 86), dwarves 65-73, children 53-55 (dwarf_child 55).

### 3.2 The reference sheet (R5)

`~/temp/ff-game/playtest/art/reference/` (built by `/tmp/playtest-art/packs.py` from `build_assets.field_rows()`, so
each row is exactly what the game draws):

- `poses_reference.png` (2676 x 1252): four varied non-hero sheets side by side, labelled neutrally "reference A (adult
  man)" = burgher, "B (adult woman)" = villager_f, "C (old man)" = old_man, "D (child)" = dwarf_child (the child
  size), so no label matches a new id and the prompts say "do not copy the reference figures"; each in all 9 frames at x4 on a flat grey, with
  the row and column labels in the margins only (no guide lines, which ChatGPT copies). The one image attached to
  every NPC prompt.
- `poses_reference_native.png`: the same four at 1x; `<id>_native_144x288.png`: each as the exact target file.
- `grid_guide.png` (for the user and the importer, not for ChatGPT): one sheet at x4 with the cell grid, the feet line
  (row 93), the adult head line (row 5) and the child head line (row 39), and the format notes.
- `ship_reference.png`: today's ship side view x3 on water, beside the airship's side, back and front views x3 (the
  example of the two views wanted); `ship_side_native_192x96.png` at 1x.

### 3.3 The sheets (21 packs)

`~/temp/ff-game/playtest/art/packs/<id>/` holds `prompt.txt` (ready to paste), `README.md` (what to attach, the file to
save as: `~/temp/<id>_field_sheet.png`, ship `~/temp/ship_views_sheet.png`) and the references; `packs/README.md` is
the index, `packs/_template/prompt_template.txt` the generic prompt (`{description}`, `{height}`, `{extra}`). Every NPC
prompt: attach the reference; one new character; exactly 144 x 288, a 3 x 3 grid of 48 x 96 cells, no lines; rows
front / back / side facing left, columns stand / left step / right step, the reference's walking poses; soles on row 93;
the height band; the same character in all nine; 16-bit SNES JRPG style matched to the reference (large head, crisp
1 px dark outline, <= 16 colours, cel shading from the top left, true single-pixel detail, no anti-aliasing);
transparent or flat #FF00FF background; no ground, shadow, text or grid lines.

| id | group | brief (the prompt has the full text) | height band (drawn px) |
|---|---|---|---|
| townsman | town | young man, dark hair, mustard shirt, leather vest, satchel | adult 84-92 |
| young_woman | town | dark braid, sky-blue dress, burgundy shawl, basket (not villager_f's blonde / pink) | adult 84-92 |
| old_woman | town | grey bun, lavender headscarf, plum dress, shawl, walking stick | old 80-88 |
| boy | town | ~10, sandy hair, freckles, red tunic, patched shorts | child 50-58 |
| girl | town | ~9, black pigtails, teal smock, red shoes | child 50-58 |
| sailor | town | striped shirt, navy cap, red neckerchief, rope coil | adult |
| sea_captain | town | tricorn, long red sea coat, grizzled beard, cutlass (Bikke, skippers) | adult |
| pirate_crew | town | red bandana, earring, black vest, orange sash (Bikke's crew; their RED / TAR / SALT tints stay, 5.4) | adult |
| labourer | town | burly, bald, brown beard, leather apron, hammer | adult |
| scholar | town | spectacles, ink-blue robe, book; not a wizard (face visible, no hat) | adult |
| healer | town | cream veil, silver circlet, sage-green robe, gold sun tabard; not the white mage | adult |
| pilgrim | town | hood back, dusty cloak, staff with bundle, grey beard | adult |
| elf_man | elf | pointed ears, silver-blond hair, jade tunic with silver | adult |
| elf_woman | elf | pointed ears, pale-gold hair, circlet, mint-and-silver gown | adult |
| elf_guard | elf | winged silver helm, verdigris scale coat, leaf spear | adult |
| elf_elder | elf | white hair and beard, circlet, deep-green robe, crystal staff | old |
| elf_mage | elf | violet hair, violet-and-silver robe, leaf-script book; no hat | adult |
| elf_child | elf | leaf crown, jade tunic | child |
| elf_prince | elf | silver-white hair, crown-circlet, deep green and silver, short cape | adult |
| broom | broom | besom broom, red cord, hops and sweeps; no face, limbs or hat | broom 56-72 |
| ship_views | vehicle | the frigate's back 3/4 (sailing up) and front 3/4 (sailing down), 240 x 128, two 120 x 128 cells | 90-100 wide, 110-118 tall |

The elves follow `docs/TOWN_THEMES.md` 3 (NPC dress: greens and silver, long sleeves, circlets; verdigris, moonstone,
violet glass). No more than one new sheet per role, so 12 townsfolk + 7 elves + the broom; one child sheet per sex,
shared by every town. A sheet the user rejects is re-rendered by the user from the same pack (the prompt may be
edited); the reassignment of a sheet waits for its approval.

## 4. The importers (PT-3, after the user's go-ahead)

### 4.1 `gen/field_user.py` (field-sheet analogue of EF-H's `monster_user.py`)

The render is the approved design; the import only cuts it faithfully. Commands, as `monster_user.py`:

    python3 -I assets-src/gen/field_user.py cut <id> [--out DIR]   # measures + review page (~/temp/ff-game/playtest/art/user/<id>/)
    python3 -I assets-src/gen/field_user.py approve <id>           # approved/<id>/field.{png,json}
    python3 -I assets-src/gen/field_user.py check [<id> ...|--all] # every approved user sheet re-imports byte for byte

Recipes in `gen/field_user.yaml`, one per id: `file: user_art/<id>/field_<date>.png` (the user's render, tracked,
never edited), `sha256` (refused on a mismatch), `band: adult | old | child | broom`, optional `side_faces: right`
(mirror the side row when ChatGPT drew it facing right), `walk: hop` (the broom, 4.3), `approved: <date>`,
`user_review: <the user's words>`.

Steps (each deterministic; no hash order; seeded k-means):
1. **Load** RGBA. Background: the render's alpha when it has one (alpha >= 128 is figure); else a flat colour flooded
   from the four corners (`PX.flood_bg`, tolerance 24; magenta through `PX.is_magenta_bg` / `magenta_bg` and
   `magenta_fringe`). A render with neither is refused with its corner colours printed.
2. **Pixel pitch.** If the render is not 144 x 288, `PX.detect_pitch` looks for drawn "big pixels"; with a confidence
   >= 0.5 it is resampled to 1 px per art pixel by `PX.clean_resample` (ChatGPT often returns 1024 x 1536 with 5-7 px
   blocks). Otherwise the render is used as is and step 5 scales it.
3. **Split.** Rows by the horizontal opaque-row projection: exactly 3 bands separated by >= 2 empty rows; in each band
   the 8-connected pieces (specks < 24 px dropped; a piece whose x-range overlaps a larger piece by >= 50 % joins it:
   a detached staff tip) sorted by x: exactly 3. Anything else is refused with the counts (the user re-renders or
   the recipe gives `cells: [[x0, y0, x1, y1] x 9]` boxes by hand).
4. **Order.** Band 1 -> `down`, 2 -> `up`, 3 -> `left`; pieces left to right -> stand, step_left, step_right.
   `side_faces: right` mirrors band 3's pieces.
5. **Scale.** One factor `s` per sheet: the median drawn height of the three `stand` pieces against the band
   (adult 84-92 target 88; old 80-88 target 84; child 50-58 target 54; broom 56-72 target 64). Inside the band
   s = 1 (no resample, EF-H's rule); outside it s = target / height, applied to all nine pieces (Box resample of
   premultiplied RGBA, then UnsharpMask(1, 60, 2), alpha >= 170: `npc_field_cut.down`'s settings). A piece wider than
   46 px after scaling is refused (the cell is 48).
6. **Place.** Each piece in its 48 x 96 cell, its lowest opaque row on row 93 (for `walk: hop`, the broom: a row's
   ground line is its stand piece's lowest row; each piece keeps its own lift above that line, so the hop frame
   stays lifted: lowest row = 93 - lift, the lift recorded per frame in the json and checked, 6.3).
   **Amendment A1 (PT-3, the first render):** when the render is on the 3 x 3 grid (144 x 288, s = 1, every
   figure inside its own cell) each figure keeps its own x inside its cell (the user's placement is the design; the
   rule above moved the boy's stand 1 px against its steps, a jitter the render did not have); the rule above (stand
   centred, steps aligned on the upper-body centroid) applies only to a resampled, scaled or off-grid render. Horizontal: the stand piece of a row
   is centred on its bbox; the two steps of that row take the stand's offset corrected by the difference of their
   upper-body centroids (the opaque px above 60 % of the height), so the head does not jitter between frames.
7. **Palette.** One palette for the whole sheet: `monster_user_palette`'s path (`PX.sheet_palette` with the detail
   mask, applied by `PX.pixelize_native`): 15-bit colours, at most 16, the darkest entry `PX.OUTLINE`. The user's
   colours are matched, not restyled (no ramp edits unless the user asks; then they are recorded `npc_field_edit`
   steps in the recipe, as DW did).
8. **Outline.** A 1 px selective outline in `PX.OUTLINE` where a figure edge has none (the `npc_field_cut` rule);
   binary alpha.
9. **Write** `approved/<id>/field.png` and `field.json`: `character`, `sheet: field`, `backend: user`, `tool`,
   `source: {file, sha256}`, `grid: [48, 96]`, `bottom_row: 93`, `rows: [down, up, left]`, `frames: [stand,
   step_left, step_right]`, `flip_rows: []`, `cut` (bg mode, pitch, s, band, colours), `walk` (broom), `approved`,
   `user_review`. `approve` refuses to overwrite an approved sheet without `retire.py` first. No PT id has an
   `approved/<id>/` directory today (checked: the crew sheet is `pirate_crew` because `approved/pirate/` is the
   pirate monster), so nothing is retired; the hero sheets stay, the party uses them. Each new id also gets a 1x
   `Look` in `characters.py` `ROSTER` (the legacy 1x atlas, as every AR / DW sheet did; `?art=legacy` and
   `assetCoverage.test.ts`), a plain palette-swap of the nearest existing Look (townsman <- villager, ...), and is
   approved, given its Look and placed in one change, so `assetCoverage.test.ts` never sees a built but unplaced
   sheet.
10. **Review page** (`cut`): the nine frames at x4 beside burgher / villager_f / dwarf_child for scale, the 7-column
   walk of each direction as `build_field_ai` will make it, a GIF per direction, and the numbers (heights, s,
   colours, empty cells). Into `~/temp/ff-game/playtest/art/user/<id>/`, never the Desktop.

`check --all` rebuilds every recipe in memory and fails on any byte difference.

**Selftest dispatch (changed files: `gen/selftest.py` about lines 260-272, `gen/selftest_roster.py` about lines
243-249).** Both style-lock loops send every `backend: user` json to `monster_user.check`. They are changed to dispatch
on the json: `sheet == "field"` -> `field_user.check(<character>)`; a `vehicle` json with `backend: user` ->
`vehicle_user.check(<frame>)` (before the `bedrock_ok` branch, which would refuse it for lacking Bedrock keys); every
other `backend: user` json -> `monster_user.check` as today.

### 4.2 `gen/vehicle_user.py` (the ship's end views)

Recipe `gen/vehicle_user.yaml` `ship_views: {file: user_art/ship_views/sheet_<date>.png, sha256, approved,
user_review}`. Steps: background as 4.1 step 1; pixel pitch as 4.1 step 2 (ChatGPT may return about 1536 px with drawn big
pixels); the wake: px of the bottom 10 % of each half whose colour is within 40 of white or of pale blue and that lie
below the hull's lowest dark outline row are dropped before the split (the prompt asks for a thin wake line; the game
draws no wake under the side view either); then exactly 2 pieces (left = back, right = front; specks < 24 dropped,
a mast tip or pennant overlapping a piece joins it); each scaled by one factor so its drawn height is 112 px when
outside 104-118; the size gate checks the height only (112 +-3 after scaling; the width is reported, never a
rejection, by the standing "resize, don't regenerate" ruling; the `vehicle_view_edit.gates` `SIZES` entry is
(measured width, 112)); the airship's end views are 89 x 114 / 89 x 112; the ship side is 134 x 94 drawn); colours snapped to `ship.png`'s colour set
(argmin, as `vehicle_view_cut`'s `snap: b_7`), binary alpha 110, a 1 px outline in ship.png's darkest colour; writes
`approved/vehicles/ship_back.{png,json}` and `ship_front.{png,json}` with the **centroid rule** anchor of
`vehicle_view_cut` (the whole-mask x centroid sits as far ahead of the foot point as ship.png's does, measured on
ship.png, so the ship's visual centre stays put when it turns) and `faces: right` (the bow leans right; mirrored for
left like the airship). `check` re-imports byte for byte. Gates reused from `vehicle_view_cut --check`'s list:
centre within 1 px at both facings, sizes within +-3 px of the target, binary alpha, ship.png's colours only, a closed
outline.

### 4.3 Pipeline changes

- **Broom walk (`walk: hop`).** `build_assets.build_field_ai` reads `meta.get("walk")`; for `hop` it passes
  `{"field": {k: {"skip": True} for k in ("down", "up", "side")}}` as the puppet cfg (`walk_row` looks up
  `field.down / up / side`; `build_field_ai` passes `"side"` for the `left` row, so a `left` key would be ignored), so `puppet.walk_row` returns
  `[stand, step_l, step_l, stand, step_r, step_r, stand]` (the existing `skip` path; no leg cut-out on a broom). Not a
  `gen/anim/broom.yaml`: that directory is the hero classes' and the kneel tools read every file in it.
- **Ship end views.** `vehicles.py` `OPTIONAL` gains `ship_back`, `ship_front` (absent files: the side view, as
  today), and so does the runtime list `OPTIONAL_VEHICLE_FRAMES` in `src/scenes/exploration/vehicleLayout.ts`
  (about line 44; `FieldVehicleSprites.ts` line 35 and `vehicleLayout.ts` line 54 load only the listed frames, so
  without it `has()` is always false). Runtime: `airshipHeading.ts` is generalised to a vehicle heading (`vehicleHeading.ts`, or a `prefix`
  argument to `headingFrame`; `TURN_MS` turn frames only where the sheet has them, so the ship has none and every
  change is instant; `has()` already falls back); `FieldVehicleSprites` keeps one heading per vehicle type for the
  ship as for the airship (D-AV10's boarding and parking rules unchanged). The ship has no Mode 7 view (only the
  airship flies), so `FlightBillboards` is unchanged except for the parked ship billboard, which reads the same
  heading through `FieldVehicleSprites`. `window.__field` reports nothing new.
- **No other runtime code.** The NPC loader takes any sprite id in `characters-ai.json`; `assetCoverage.test.ts` fails on an
  id without art.

## 5. The reassignment (PT-5, after each sheet's approval)

Only `sprite` values change, plus the tint rule (5.4); no position, dialog, flag, `wander` or id changes. The one exception is
amendment A2 (10): one new NPC, Arylon the dancer, added to Cornelia (gated by `build_map.py cornelia` and
`npm run quest -- --strict`, 7). Each row is
edited in the layout script that writes the map (header `GENERATED by`), then the script is re-run and the map
compiled. Rows are keyed by (map, npc id): `fisher` exists on three maps.

### 5.1 The 86 hero-sheet NPCs

Elfheim's 20 hero-sheet NPCs are in 5.2 with the rest of Elfheim. Here the other 66 (`KEEP` = keeps its hero sheet,
on the allowlist of 6.1 with its reason; 7 rows):

| map | npc | role (last line) | today | tint | becomes |
|---|---|---|---|---|---|
| caravan-camp | scout | Nobody walks to the waterfall. You'd need a boat light enough to carry | thief | #a0b8c8 | pilgrim |
| cavern-earth-b4 | ert_d_frozen_herald | A herald in rimed armour speaks without moving his frozen jaw. | knight | #9fb8d0 | KEEP knight: a dead knight of the king's escort in rimed armour: really a knight (spectral tint) |
| cavern-earth-b5 | ert_d_altar_shade | A pale shade of the king kneels at the altar, his hands on a dull grey | knight | #e4eef8 | king (existing; "a pale shade of the king", tint kept) |
| cornelia-house-shrine | priestess | Welcome to the wayside shrine. Say a prayer for the princess, if you w | white_mage |  | healer |
| crescent-black-magic | crescent-black-magic-keeper | The third fire, slow time, the stone breath, the warp. Strong words. T | black_mage |  | scholar |
| crescent-circle | sage_elder | Elder: You have come far to stand in our ring. The Circle sees you, an | master | #e8e0c8 | sage_star (existing, tint kept) |
| crescent-circle | sage_lukahn | I never knew what the last part meant. Looking at you, I begin to. | white_wizard | #f0f0ff | scholar (tint kept) |
| crescent-circle | sage_tide | The lake's level falls each year, and the fish grow fewer. The land be | red_wizard |  | pilgrim |
| crescent-circle | sage_reed | The roots of the trees on the western shore have gone soft as rope. Th | black_wizard |  | sage_earth (existing) |
| crescent-circle | sage_north | I watch the western sky. Each evening it is greyer. The earth's colour | white_mage | #d8d0e8 | healer (tint kept) |
| crescent-circle | sage_shore | We fast for the earth, and the earth goes on rotting. Still, it is som | monk | #b0a090 | pilgrim (tint kept) |
| crescent-circle | sage_lantern | I keep the lamp at the islet's edge for the earth. While it burns, we  | red_mage | #c8b490 | sage_flame (existing, tint kept) |
| crescent-house-astronomer | astronomer | My charts show the stars dimming at the edges of the sky, one a season | white_wizard | #d8c8f0 | scholar |
| crescent-house-healer | healer | My fee is 60 G for each of their levels. The lake towns can't afford t | white_mage | #e0e8f0 | healer |
| crescent-house-tutor | tutor | Lesson ten: the earth is sick, and the sick earth makes sick crops. My | red_mage | #c8a0a0 | townsman |
| crescent-white-magic | crescent-white-magic-keeper | The deep healing, and the words that call the fallen back. Taught here | white_mage |  | healer |
| crescent | geologist_hint | South of the mountain ring stands Gurgu, a volcano that has slept as l | black_wizard |  | scholar |
| crescent | pilgrim_a | I walked three months to sit by the Circle. They let me sit on the cau | monk | #c8b48c | pilgrim |
| crescent | pilgrim_b | I pray at the edge of the lake for the earth. The lake doesn't answer, | white_mage | #d0c8b8 | old_woman |
| crescent | old_scholar | Forty years I've sat on this bench thinking about the earth. It has ne | white_wizard |  | scholar |
| gaia-black-magic | gaia-black-magic-keeper | Storm-words and doom-words. The mountain sharpens them. Do be careful  | black_mage |  | scholar |
| gaia-house-healer | gaia_healer | Bring your fallen here, to the light. I can call them back, for a pric | white_mage |  | healer |
| gaia-house-ropemaker | gaia_rope_apprentice | I can tie forty knots. The master says thirty-nine of them are the sam | thief |  | boy |
| gaia-spring | gaia_spring_warden | I am the warden of the spring. It ran from that stone for longer than  | white_mage | #d8e8c8 | healer (tint kept) |
| gaia-white-magic | gaia-white-magic-keeper | The highest words of healing are taught only here, where the air is th | white_mage |  | healer |
| gaia | gaia_mill_lad | I'm the windmiller's lad. I oil the gears every morning in case today' | thief |  | boy |
| gaia | gaia_old_soldier | Nothing has come up the stairs to fight in a year. Not even weather. | knight |  | guard (existing) |
| gaia | gaia_wind_watcher | We say the wind is the breath of the spring's fairy. A little winged t | monk |  | old_woman |
| gaia | gaia_spring_pilgrim | I walked up from the lowlands to pray at the spring. I found a dry cha | monk | #c8d8f0 | pilgrim |
| giant-tunnel | ert_giant | A giant lies wedged in the throat of the tunnel like a stopper in a bo | monk | #8c7a62 | KEEP monk: the giant (a monk sheet tinted stone-brown as a stand-in); a giant sheet is a later pass, not a townsperson |
| giant-tunnel | ert_giant_asleep | The giant is curled up in his niche, snoring like a rockslide. A red g | monk | #8c7a62 | KEEP monk: as ert_giant |
| lufenia-black-magic | lufenia-black-magic-keeper | The makers' hardest words. Some of them unmake. Spend them only on wha | black_wizard | #dfe6f5 | luf_citizen_m (existing) |
| lufenia-house-healer | lufenia-healer-keeper | Fallen friends? Lay them here. The wind's breath can still be called b | white_mage | #dfe6f5 | luf_citizen_f (existing) |
| lufenia-house-stargazer | lufenia_stargazer | Miradh oss'en, kal vethar ilun. | white_wizard | #dfe6f5 | luf_senator (existing) |
| lufenia-white-magic | lufenia-white-magic-keeper | These are the last songs of healing our makers wrote. Learn them well; | white_wizard | #dfe6f5 | luf_citizen_f (existing) |
| lufenia | lufenia_bellwright | Ka'thera ulun, si ven doloth. | master | #dfe6f5 | luf_citizen_m (existing) |
| marsh-cave-b3 | elf_d_last_escort | A knight of the king's escort leans on the wall, his blade notched to  | knight | #8fa38a | KEEP knight: a knight of the Western Keep's escort: really a knight |
| matoya-cave | broom_1 | The broom sweeps a circle round your feet, then sweeps the circle agai | black_wizard | #a07a48 | broom |
| matoya-cave | broom_2 | Swish. Swish. The broom knocks against a jar labelled EYE OF NEWT (NOT | black_wizard | #a07a48 | broom |
| matoya-cave | broom_3 | The broom leans close, as if to whisper. The mistress hasn't seen a th | black_wizard | #a07a48 | broom |
| melmond-black-magic | melmond-black-magic-keeper | The rot has made folk curious about darker arts. Choose carefully. | black_mage |  | scholar |
| melmond-house-healer | melmond_healer | The fallen can be brought back, if you come quickly. Lay them here. | white_mage |  | healer |
| melmond-white-magic | melmond-white-magic-keeper | Healing words, for a town that needs them. Learn them well. | white_mage |  | healer |
| melmond | melmond_mill_lad | The windmill leans a hand's width further every year. The ground under | thief |  | boy |
| melmond | melmond_wayfarer | I came to pray at the earth shrine in the badlands. Its roof has falle | monk |  | pilgrim |
| onrac-black-magic | onrac-black-magic-keeper | Thunder, quake and stillness. Spells the sea itself would fear. | black_mage |  | scholar |
| onrac-house-healer | onrac_healer | Cold takes the weak and the sea takes the brave. I can call back eithe | white_mage |  | healer |
| onrac-house-healer | onrac_healer_nurse | Keep the stove fed, keep the blankets warm, and keep the sailors out o | white_wizard |  | young_woman |
| onrac-house-smoker | onrac_smoker_apprentice | I count the salt barrels. There are four. I count them again tomorrow. | thief |  | boy |
| onrac-inn | onrac_inn_skipper | Thirty years I've skippered out of Onrac. Never once past the stacks.  | warrior |  | sea_captain |
| onrac-white-magic | onrac-white-magic-keeper | Words for the deep: one to lift the dead to the surface, one to walk y | white_mage |  | healer |
| onrac | onrac_fairy_lore | There are fairies who live in springs and breathe a water that is also | monk |  | old_woman |
| onrac | onrac_net_lad | We fish the shallows only. Past the sea-stacks the water turns black a | thief |  | sailor |
| onrac | onrac_shipwright | The iron fish in the basin is mine. Twelve years riveting. She'll go d | master |  | labourer |
| past-temple-4 | past_hollow_seraph | Hollow Seraph: Every road you climbed to reach me in the sky winds dow | white_wizard | #d8d8f0 | KEEP white_wizard: a boss stand-in (the Hollow Seraph speaks before its fight); its battle art is the monster |
| past-temple-5 | past_death_eye | The eye's gaze settles on you, and you feel the last few minutes go th | black_wizard | #6a5a80 | KEEP black_wizard: a boss stand-in (Death Eye) before its fight |
| pravoka-black-magic | pravoka-black-magic-keeper | Frost for the hand, shadow for the eyes. Bikke's crew won't buy. They  | black_mage |  | scholar |
| pravoka-house-lighthouse | lighthouse_keeper | If one of yours has fallen, I can bring them round: 10 G for each of t | white_mage | #e6dcc8 | healer (tint kept) |
| pravoka-white-magic | pravoka-white-magic-keeper | Light and quiet, for those with the gift. Every sailor here learns one | white_mage |  | healer |
| pravoka | bikke | I took this harbour with eight blades, my own the ninth, and a fast hu | warrior | #a03c3c | sea_captain (red tint kept: Bikke's red coat) |
| pravoka | bikke_after | Board her from the land and she'll take you anywhere the sea goes. She | warrior | #a03c3c | sea_captain (red tint kept) |
| sage-cave | ert_sarda | Go away. I have watched too many brave fools walk into the Cavern of E | master |  | sage_earth (existing; the earth sage) |
| sage-cave | ert_sarda_pupil_a | The master speaks to the stones. Mostly they don't answer. | white_mage |  | healer |
| sage-cave | ert_sarda_pupil_b | We reached this coast before the giant blocked the tunnel. Now no one  | black_mage |  | townsman |
| sky-castle-5f | hollow_seraph | Hollow Seraph: The wind was loud. It wore the charts thin and the star | knight | #b9a46e | KEEP knight: as past_hollow_seraph (sky-castle-5f) |
| waterfall-cave | automaton | Brass shutters slide back from two lamp-eyes. A voice like a wound-dow | knight | #c8a860 | robot_ancient (existing; brass tint kept) |

### 5.2 Elfheim: every elf gets an elf sheet

All 47 NPCs of the `elfheim*` maps (the 20 hero-sheet ones among them); the three visitors keep their human / dwarf sheets.

| map | npc | today | tint | becomes |
|---|---|---|---|---|
| elfheim-armor-shop | elfheim-armor-keeper | knight | #cfe8c2 | elf_man |
| elfheim-black-magic | elfheim-black-magic-keeper | black_wizard | #cfe8c2 | elf_mage |
| elfheim-castle-chamber | elfheim_prince | knight | #cfe8c2 | elf_prince |
| elfheim-castle-chamber | elfheim_prince_awake | knight | #cfe8c2 | elf_prince |
| elfheim-castle-chamber | elfheim_nurse | white_mage | #cfe8c2 | elf_woman |
| elfheim-castle-chamber | elfheim_chamber_guard | guard | #cfe8c2 | elf_guard |
| elfheim-castle | elfheim_steward | old_man | #e4e9d6 | elf_elder |
| elfheim-castle | elfheim_hall_guard | guard | #cfe8c2 | elf_guard |
| elfheim-castle | elfheim_lady | villager_f | #cfe8c2 | elf_woman |
| elfheim-castle | elfheim_court_mage | white_wizard | #e4e9d6 | elf_mage |
| elfheim-house-bard | elfheim_bard | red_wizard | #cfe8c2 | elf_man |
| elfheim-house-bard | elfheim_bard_listener | villager_f | #cfe8c2 | elf_woman |
| elfheim-house-bard | elfheim_bard_child | villager | #cfe8c2 | elf_child |
| elfheim-house-bowyer | elfheim_bowyer | warrior | #cfe8c2 | elf_man |
| elfheim-house-bowyer | elfheim_bowyer_son | thief | #cfe8c2 | elf_child |
| elfheim-house-healer | elfheim-healer-keeper | white_mage | #cfe8c2 | elf_woman |
| elfheim-house-healer | elfheim_ward_patient | villager | #cfe8c2 | elf_man |
| elfheim-house-herbalist | elfheim_herbalist | vendor_f | #cfe8c2 | elf_woman |
| elfheim-house-herbalist | elfheim_herb_apprentice | villager | #cfe8c2 | elf_child |
| elfheim-house-scribe | elfheim_scribe | white_wizard | #e4e9d6 | elf_elder |
| elfheim-house-scribe | elfheim_archive_reader | black_mage | #cfe8c2 | elf_mage |
| elfheim-house-warden | elfheim_hedge_warden | knight | #e4e9d6 | elf_guard |
| elfheim-house-warden | elfheim_warden_wife | villager_f | #cfe8c2 | elf_woman |
| elfheim-inn | elfheim-inn-keeper | innkeeper | #cfe8c2 | elf_woman |
| elfheim-inn | elfheim_inn_guest | burgher |  | stays: burgher: a human from Pravoka waiting for a ship |
| elfheim-item-shop | elfheim-item-keeper | vendor_f | #cfe8c2 | elf_woman |
| elfheim-weapon-shop | elfheim-weapon-keeper | warrior | #cfe8c2 | elf_man |
| elfheim-white-magic | elfheim-white-magic-keeper | white_wizard | #cfe8c2 | elf_mage |
| elfheim | elfheim_gate_warden | guard | #cfe8c2 | elf_guard |
| elfheim | elfheim_gate_sentry | guard | #cfe8c2 | elf_guard |
| elfheim | elfheim_rise_guard_w | guard | #cfe8c2 | elf_guard |
| elfheim | elfheim_rise_guard_e | guard | #cfe8c2 | elf_guard |
| elfheim | elfheim_matoya_hint | old_man | #e4e9d6 | elf_elder |
| elfheim | elfheim_marsh_hint | white_mage | #cfe8c2 | elf_woman |
| elfheim | elfheim_gardener | farmer | #cfe8c2 | elf_man |
| elfheim | elfheim_hedge_trimmer | monk | #cfe8c2 | elf_man |
| elfheim | elfheim_stream_child | villager | #cfe8c2 | elf_child |
| elfheim | elfheim_fisher | villager | #e4e9d6 | elf_elder |
| elfheim | elfheim_weaver | villager_f | #cfe8c2 | elf_woman |
| elfheim | elfheim_lamplighter | villager | #cfe8c2 | elf_man |
| elfheim | elfheim_trader | merchant |  | stays: merchant: "I'm from Pravoka" |
| elfheim | elfheim_elder | old_man | #e4e9d6 | elf_elder |
| elfheim | elfheim_dwarf_peddler | dwarf_trader |  | stays: dwarf_trader: a dwarf |
| elfheim | elfheim_scout | ninja | #cfe8c2 | elf_guard |
| elfheim | elfheim_minstrel | red_mage | #cfe8c2 | elf_mage |
| elfheim | elfheim_herb_girl | villager_f | #cfe8c2 | elf_child |
| elfheim | elfheim_watcher | white_mage | #e4e9d6 | elf_woman |

### 5.3 Children, sailors, pirates and a little variety (non-hero rows)

The children drawn at adult height on villager / villager_f become `boy` / `girl`; dockhands and fishers `sailor`; Bikke's crew (guards and villagers today) `pirate_crew` (tints kept, 5.4); two widows `old_woman`; and a few adults move to `townsman` / `young_woman` so the new adult sheets are used in more than one town.

| map | npc | today | becomes |
|---|---|---|---|
| cornelia | townswoman | villager_f | young_woman |
| cornelia | gardener | villager | townsman |
| cornelia | fisher | villager | sailor |
| crescent-house-astronomer | astronomer_son | villager | boy |
| crescent-house-potter | potter_girl | villager_f | girl |
| crescent | fisher | farmer | sailor |
| crescent | pupil_a | villager | boy |
| crescent | pupil_b | villager_f | girl |
| crescent | student_a | villager | townsman |
| crescent | student_b | villager_f | young_woman |
| crescent | gardener | farmer | townsman |
| crescent | boat_girl | villager_f | girl |
| crescent | child | villager | boy |
| gaia-house-beekeeper | gaia_beekeeper_daughter | villager_f | girl |
| gaia | gaia_water_hauler | villager_f | young_woman |
| gaia | gaia_child | villager | girl |
| gaia | gaia_shepherd_boy | villager | boy |
| gaia | gaia_weaver_girl | villager_f | girl |
| gaia | gaia_court_child | villager | boy |
| lufenia | lufenia_child | villager | boy |
| melmond-house-ploughman | melmond_plough_son | villager | boy |
| melmond-house-vintner | melmond_vintner_daughter | villager_f | girl |
| melmond | melmond_oak_child | villager | girl |
| melmond | melmond_vine_dresser | villager_f | young_woman |
| melmond | melmond_shore_fisher | villager | sailor |
| melmond | melmond_stall_widow | vendor_f | old_woman |
| onrac-house-bellringer | onrac_bellringer_girl | villager_f | girl |
| onrac-house-netmender | onrac_netmender_son | villager | boy |
| onrac | onrac_bell_child | villager | boy |
| onrac | onrac_rack_wife | villager_f | young_woman |
| onrac | onrac_widow | villager_f | old_woman |
| onrac | onrac_dock_hand | farmer | sailor |
| onrac | onrac_sailor | burgher | sailor |
| pravoka-house-chandler | chandler_boy | villager | boy |
| pravoka-house-lighthouse | keeper_daughter | villager_f | girl |
| pravoka-house-lighthouse | hurt_sailor | villager | sailor |
| pravoka | pirate_gate | guard | pirate_crew |
| pravoka | pirate_quay_n | villager | pirate_crew |
| pravoka | pirate_quay_s | guard | pirate_crew |
| pravoka | pirate_den_a | villager | pirate_crew |
| pravoka | pirate_den_b | guard | pirate_crew |
| pravoka | pirate_pier | villager | pirate_crew |
| pravoka | pirate_inn | guard | pirate_crew |
| pravoka | old_sailor_hint | old_man | sailor |
| pravoka | fisher | villager | sailor |
| pravoka | dockhand_a | farmer | sailor |
| pravoka | dockhand_b | burgher | labourer |
| pravoka | girl | villager_f | girl |

### 5.4 Tints

A `tint` multiplies the sheet; the new sheets carry their own colours. Rule: **a reassigned NPC loses its tint** unless
the row above says "tint kept" (a ghost, Bikke's red, the Circle's robe casts, a brass automaton, the pale shade of
the king), and **Bikke's crew keep their tints** (RED / TAR / SALT: `tests/quest/a1/a1_t_town.test.ts` line 114
requires a `#rrggbb` tint on every `pirate_*` NPC, the tint is a positional argument of `pirate()` in
`a1/town_pravoka_people.py` lines 44-60, and three casts give one crew sheet variety). Elfheim: the elf rows lose
`ELF` / `ELDER`: the `npc()` default `tint=ELF` (`elf/town_elfheim_people.py`) becomes `None`, and the explicit
`tint=ELF` / `"tint": ELF` / `ELDER` arguments in `elf/town_elfheim_homes.py`, `elf/town_elfheim_castle.py`,
`elf/town_elfheim_rooms.py` and the Elfheim shop rows are removed (each is listed by `grep -n "ELF\b\|ELDER"
assets-src/tools/layouts/elf/town_elfheim*.py` at implementation; 6.2 fails on any left). So PT-5 changes `sprite`
values and tint arguments, nothing else. The three Elfheim visitors keep no tint (they have none
today).

### 5.5 Variety (after 5.1-5.3)

Uses per sheet over all maps after the change (chest not counted): old_man 35, guard 28, villager_f 25, farmer 24,
mage 23, merchant 22, burgher 20, healer 14, boy 14, villager 11, girl 11, elf_woman 11, king 10, sailor 10,
scholar 9, elf_man 8, elf_guard 8, innkeeper 7, pirate_crew 7, pilgrim 6, young_woman 6, townsman 5, old_woman 5,
elf_mage 5, elf_elder 5, elf_child 5, ...; hero sheets: knight 3, monk 2, white_wizard 1, black_wizard 1 (the 7 kept).
Per town (outdoor map), the most used sheet: Cornelia guard 6 of 16 (the gate and castle guards), Pravoka pirate_crew 7 of
19 (Bikke's crew), Elfheim elf_guard 5 of 19, Melmond 2 of 15, Crescent mage 3 of 19, Onrac sailor 3 of 17, Gaia boy 3
of 19, Lufenia luf_citizen_m 3 of 12. Apart from guards and pirates (a uniform is the point), no sheet has more than 3
NPCs on one outdoor town map (after round-1 the minstrel moves to `elf_mage`, so Elfheim has elf_man 3); the test of
6.3 pins it. Definitions: the **outdoor town maps** are exactly `cornelia`, `pravoka`, `elfheim`, `melmond`,
`crescent`, `onrac`, `gaia`, `lufenia`; the **uniform sheets** exempt from the cap are exactly `guard`, `elf_guard`,
`dwarf_guard`, `pirate_crew`; `chest` NPCs are not counted.

## 6. Tests (PT-3 / PT-5)

### 6.1 `tests/data/heroSpriteNpcs.test.ts` (new)

Reads every map source `assets-src/maps/*.yaml` and every compiled `assets/maps/ai/*.yaml`; the hero sheet ids are
the class `id`s of `assets/data/classes.yaml` (the party's field sheets are keyed by class id), read there, not
typed in the test. Every NPC whose sprite is
a hero sheet must be on `HERO_NPC_ALLOWLIST` (`{'<map>:<npc id>': '<reason>'}`, the 7 KEEP rows of 5.1, each reason
non-empty); the test fails on any other, and on an allowlist entry that no longer exists (so the list cannot rot).
Fails today with 86 (the red state before PT-5), passes after.

### 6.2 `tests/data/elfheimElves.test.ts` (new)

Every NPC of every `elfheim*` map other than `sprite: chest` (the vault's three chests, so 50 NPCs = 47 people + 3
chests) uses an `elf_*` sheet, except `ELFHEIM_VISITORS` (`elfheim:elfheim_trader`,
`elfheim:elfheim_dwarf_peddler`, `elfheim-inn:elfheim_inn_guest`, with reasons); no `elf_*` NPC has a tint; every
`elf_*` sheet is placed at least once; no `elf_*` sheet is used outside Elfheim's maps (they are Elfheim's people).

### 6.3 `tests/data/ptNpcArt.test.ts` (new, per sheet like `dwNpcArt.test.ts`)

For each of the 20 PT field sheets: `approved/<id>/field.json` has `backend: user`, its `source.file` exists under
`assets-src/gen/user_art/` with the recorded sha256, `grid` [48, 96], `bottom_row` 93, `rows` [down, up, left];
the png is 144 x 288, binary alpha, at most 16 opaque colours, every colour on the 15-bit grid; all nine cells
non-empty; every stand frame's lowest opaque row is 93; each frame fits its cell with >= 1 px side margin; the drawn
heights are in the sheet's band (adult 84-92, old 80-88, child 50-58, broom 56-72); the three frames of a row differ
(a walk, not a copy); `characters-ai.json` has the sheet; each PT sheet is placed at least once; the broom's
`walk: hop` reaches the atlas (its 7 columns are [stand, s_l, s_l, stand, s_r, s_r, stand]) and its hop frame
(column 2 of each row) has its lowest opaque row at most 90 (lifted >= 3 px). Plus the variety pin of 5.5: no sheet
but the four uniform ones on more than 3 non-chest NPCs of one of the eight outdoor town maps. Matoya's brooms: the three
`broom_*` NPCs use `broom`, keep `wander: true`.

### 6.4 Ship

`tests/scenes/airshipHeading.test.ts` keeps passing unchanged (the airship's behaviour is the same); a new
`tests/scenes/shipHeading.test.ts`: up shows `ship_back`, down `ship_front`, left / right the side view (mirrored
left), no turn frame, boarding keeps the parked heading (D-AV10), a sheet without the end views shows the side view
for every heading; `fieldVehicleArt.test.ts` gains the two frames (present in `vehicles.json`, anchors from the
centroid rule, binary alpha, ship.png's colours) and its `sources` `toEqual` (line 76) adds `ship_back` /
`ship_front: approved`.

### 6.5 Python

`gen/selftest_field_user.py` (run by `selftest.py`): synthetic 3 x 3 renders built in memory: alpha background,
magenta background, a 3x pitch render (resampled to 1x), a side row facing right with `side_faces: right`, an
out-of-band height (scaled to the target), a missing figure, an extra figure, a too-wide piece and a sha256
mismatch (each refused with its message); `check` re-imports byte for byte; output equal under PYTHONHASHSEED 0 / 1.
`gen/selftest_vehicle_user.py` likewise for the two-piece ship render.

## 7. Gates

- An agent before handoff: `npm run build`; `npm run test:fast`; the touched tests (`npx vitest run
  tests/data/heroSpriteNpcs.test.ts tests/data/elfheimElves.test.ts tests/data/ptNpcArt.test.ts
  tests/data/assetCoverage.test.ts tests/data/arNpcArt.test.ts tests/data/dwNpcArt.test.ts
  tests/scenes/shipHeading.test.ts tests/scenes/airshipHeading.test.ts tests/scenes/fieldVehicleArt.test.ts`);
  `python3 -I assets-src/gen/selftest.py`; `field_user.py check --all`; `vehicle_user.py check`;
  `python3 -I assets-src/build_assets.py characters field_ai vehicles` twice under PYTHONHASHSEED 0 / 1, the outputs
  byte-equal, and the other field sheets' pixels in `characters-ai.png` unchanged (each sheet's block compared before /
  after by its id's `x` / `y` in `characters-ai.json`, since new ids sort in among the old ones and move blocks); every changed layout script re-run, then `git diff --exit-code assets-src/maps` clean on a second run;
  each changed map compiled (`build_map.py <id>`; the overworld is not touched: its two NPCs keep farmer / villager);
  `npm run quest -- --strict` (maps changed; no gate, flag or position changes, so nothing moves).
- Not run by the agent: `test:full`, `--mutate`, `--from-reset`, the full determinism check (the integrator's).
- File ceilings: the touched layout scripts and `src/scenes/exploration/FieldVehicleSprites.ts` stay under their
  ceilings (`fileCeilings.test.ts`, `questCeilings.test.ts`); a sprite-string change is line-neutral.
- Browser check (dev server, `?mute=1`): the existing `?scenario=wr_ship_south` and `w1a_ship_dock` for the ship
  (sail up and down from there), and three new field scenarios in `assets/data/debug-scenarios.yaml`: `pt_elfheim`
  (Elfheim's square), `pt_matoya` (the brooms), `pt_pravoka` (the quay: crew, sailors, captain); screenshots to `~/temp/ff-game/playtest/art/browser/`.

## 8. Risks and merges

- **Parallel branch `playtest-world`** edits Pravoka's and Elfheim's layout scripts (showIf / hideIf, doors,
  entrances). PT-5 changes only `sprite` values and tint arguments (the elf `npc()` default, the explicit `ELF` / `ELDER`
  arguments in `town_elfheim_homes.py`, `_castle.py`, `_rooms.py`, `_shops.py`, and the tints of reassigned rows),
  so the merge touches different tokens; the coordinator merges `playtest-world` first and PT-5 is rebased on it,
  re-run and re-compiled (the generated yaml is never hand-merged).
- **ChatGPT layout drift** (cells not evenly spaced, an extra figure, the side row facing right, a 1024 px faux-pixel
  render): handled by 4.1 steps 2-4 and the recipe's `side_faces` / `cells`; a sheet that still fails is re-rendered
  by the user.
- **Size** never rejects a sheet (the user's standing ruling: resize, don't regenerate); design faults do.
- **Story NPCs** keep their dialogs; Bikke becomes a sea captain in his red coat, the elf prince an elf prince. The
  boss stand-ins (Hollow Seraph x2, Death Eye) and the giant keep their sheets for now (allowlist); a later pass may
  give them their own.
- **Atlas size.** `characters-ai.png` is 2688 x 9984 with 52 sheets (4 per block row, 4 x 96 x 2 px per block row);
  72 sheets make it 2688 x 13824, under the 16384 texture limit of the target GPUs but past 8192, already the case
  today. If a later pass needs more, `build_field_ai`'s `per_row` goes from 4 to 6 (4032 x 9216). Noted, not changed
  here.
- Nothing is deleted; no approved sheet is replaced (all ids are new), so `retire.py` is not needed.

## 9. Review log

- **Momus round 1 (rev 2): REJECT**, six blocking findings, all fixed in rev 3: (1) the selftest style-lock loops
  would send the new user jsons to `monster_user.check` -> the dispatch of 4.1; (2) the ship's end views would never
  load -> `vehicleLayout.ts` `OPTIONAL_VEHICLE_FRAMES` and the `sources` test line (4.3, 6.4); (3) the pirates' tints
  are required by `a1_t_town.test.ts` -> kept (5.4); (4) the variety pin failed on Elfheim's elf_man 4 -> the minstrel
  moves to `elf_mage`, the town maps and uniform sheets are listed (5.5); (5) the Elfheim test would fail on the
  vault's chests -> chests excluded (6.2); (6) the importer grounded the broom's hop -> per-frame lift kept and tested
  (4.1 step 6, 6.3). Suggestions taken: the explicit Elfheim tint arguments (5.4), the puppet `skip` keys (4.3), the
  crew id `pirate_crew` (no clash with the pirate monster), the 1x `Look`s and placing in one change (4.1 step 9), the
  atlas size risk (8), the atlas comparison by id (7), the ship importer's wake, pitch and height target (4.2), the
  browser scenario ids (7), neutral reference labels (3.2).
- **Momus round 2 (rev 3): OKAY** (4/5). Nits fixed in rev 3.1: the 5.5 counts (pirate_crew 7, elf_man 8, elf_mage 5),
  the ship's size gate on height only (4.2), the class ids in 6.1, the tint arguments in the merge note (8).
- **Amendment A1 (rev 3.2, PT-3):** on-grid renders keep their own x in the cell (4.1 step 6); sent to Momus.
- **Amendments A2-A4 (rev 3.3):** section 10; sent to Momus.

## 10. Amendments after the renders came back (PT-3, 2026-11-26)

The user rendered all 20 planned NPC sheets plus one of their own (ChatGPT named the files its own way:
`~/temp/npcs/<name>_sprite_sheet.png`, mapped to the ids by the coordinator and checked by eye: burly_craftsman ->
labourer, elf_sage -> elf_elder, elf_spell_teacher -> elf_mage, elf_townsman -> elf_man, enchanted_broom -> broom,
grandmother -> old_woman, pigtail_girl -> girl, townsfolk_boy -> boy, magic_shop_scholar -> scholar, temple_healer ->
healer, pilgrim_wayfarer -> pilgrim, pirate_deckhand -> pirate_crew, sailor_dockhand -> sailor, weathered_sea_captain ->
sea_captain, young_townsman -> townsman, young_townswoman -> young_woman, the elf ones by name). All 21 are 144 x 288,
binary alpha, 13-15 colours, every figure in its own cell (A1's on-grid path, s = 1). The ship views were not
rendered; 4.2 / 4.3's ship work waits for them.

- **A2: the dancer (`dancer`, the user's addition: "a dancer character, famously known as Arylon the dancer the
  original game").** Recipe `dancer`, band adult, `refs.pack: none` (no pack; rendered from the same references).
  Placement (PT-5): one **new** NPC in Cornelia's town square, `cornelia_dancer` (sprite `dancer`, no tint, no
  `wander`, no flags or actions), added to the `npcs` list of `layouts/cornelia.py` on a walkable cell of the square
  that the compiler's reachability and NPC-chokepoint checks pass (`build_map.py cornelia`), with a two-entry dialog:
  after `PRINCESS_RESCUED` "Arylon: The princess is home! I'll dance till my shoes wear through." and the default
  "Arylon: I'm Arylon, and I dance. The square needs a little joy while the princess is gone." (classic names and
  lines are fine in this personal game). No existing NPC is replaced: none of Cornelia's people is a dancer, and the
  town has room (16 outdoor NPCs). `cornelia.py` is at 323 of its 355-line ceiling; the entry adds about 5 lines. The
  6.3 placement check ("each PT sheet is placed at least once") then covers `dancer`; the cap of 5.5 holds (1 use).
  Test: `ptNpcArt.test.ts` adds "Cornelia has Arylon the dancer (sprite dancer, untinted, no wander)".
- **A3: Bikke's crew tints (proposal for the user; 5.4 keeps them until the user rules).** The in-game shot
  (`~/temp/ff-game/playtest/art/user/browser/pravoka.png`) shows the RED / TAR / SALT tints multiplied over the new
  `pirate_crew` sheet muddy the art (the whole figure goes brick red). If the user agrees, PT-5 drops the three tints
  (`a1/town_pravoka_people.py` `pirate()`'s tint argument becomes unused and is removed with its three constants) and
  `tests/quest/a1/a1_t_town.test.ts` line 114's `expect(p.tint).toMatch(...)` becomes
  `expect(p.sprite).toBe(p.id === 'bikke' ? 'sea_captain' : 'pirate_crew')` (the crew is told apart by its own
  sheet, which is what the tint was for); Bikke keeps his red tint only if the user wants it after seeing the shot.
  Until then 5.4 stands.
- **A4: the importer's scope (PT-3 as built).** `gen/field_user.py` (cut / approve / check), `gen/field_user_review.py`
  (review pages and the contact sheet), `gen/field_user.yaml` (21 recipes), `gen/selftest_field_user.py` (in
  `selftest.py`), the style-lock dispatch `field_user.user_check` (selftest.py and selftest_roster.py), the broom's
  `walk: hop` in `build_assets.build_field_ai`, a 1x `Look` per id in `characters.py` (the broom a small drawn prop,
  `broom_cell`), and `tests/data/ptNpcArt.test.ts` with 6.3's art checks. 6.1 / 6.2 and 6.3's placement and variety
  checks land with the reassignment (PT-5), since they fail until the NPCs move. Each `approved/<id>/field.json`
  carries `user_review: null` until the user approves the sheet; PT-5 fills it from the user's words before any NPC
  is reassigned, and `ptNpcArt.test.ts` then requires it non-null for every placed sheet. Implementation notes kept
  from Momus's A1 review: 5's scale is a Box resample (premultiplied) + UnsharpMask(1, 60, 2), alpha 170 for any
  s != 1 (`field_user.resample`), then the 1:1 quantizer; 8's selective outline is `PX.pixelize_native`'s (outline
  only around light edge px; covered by the selftest's "bare" case); an on-grid figure within 1 px of its cell side
  takes the centring rule instead of being refused.
- **A4 follow-ups (Momus, rev 3.3 OKAY):** the approved jsons record `imported` (the import date) with `approved: null`
  and `user_review: null` until the user approves each sheet in PT-5 (the recipe's `approved` / `user_review` then
  fill them); `field_user.py` is split (`field_user_split.py`: mask, resample, bands, figures, crops, placement
  helpers) so both stay under 250 lines; of 4.2 / 4.3 / 6.4 only the ship work (`vehicle_user.py`, the ship heading,
  `shipHeading.test.ts`, the `vehicleLayout.ts` frames) is outside PT-3's delivered scope, waiting for the ship render;
  A3 stays a proposal and `a1_t_town.test.ts` is untouched until the user rules.

## 11. PT-5 result (2026-11-26)

User rulings (2026-11-26, verbatim): "approve them, I don't even notice the flaws so go ahead and move them. Drop the tint
on the crew and keep Bikke's red. Add her and the lines are great." So all 21 sheets are approved as rendered
(`approved` 2026-11-26, `user_review` "approved all 21; flaws not noticeable, keep as rendered"; no patches), A3 is
adopted (Bikke's 7 crew untinted `pirate_crew`, `pirate()` lost its tint argument and RED / TAR / SALT; Bikke keeps
his red as `sea_captain`; `a1_t_town.test.ts` checks the crew's sheet and Bikke's tint instead of the crew's tints) and
A2 is in (`cornelia_dancer` at (CX + 5, 50) on the square). Rebased onto `int-pt1` (5557937d: playtest-world,
hero-facing, esc-menu-fix, cleanup-dead) before the edits.

- **The reassignment:** 161 rows of 5.1-5.3 applied in the layout scripts (130 by the id literal, 18 shop keepers
  through `keeper(r, slug, sprite, ...)`, the brooms in `a1/matoya.py`); a check over every map source compares HEAD
  and the tree: every sprite change is a table row, every row done, no other field changed, no tint left on a
  reassigned row but the 11 "tint kept" ones (5.1) and Bikke. Tints: the Elfheim `ELF` / `ELDER` constants and every
  use are gone (`npc()` defaults to no tint); the reassigned rows' explicit tints are removed in `water/caravan.py`,
  `fire/town_crescent_people.py`, `fire/town_crescent_homes.py`, `wind/town_gaia_people.py` (its `SKY`),
  `wind/lufenia_interiors.py` (the keepers take `TINT` only for sheets outside `lufenia_people.OWN`, which gains
  `boy`). 61 map sources change; the overworld does not.
- **Tests:** `tests/data/heroSpriteNpcs.test.ts` (6.1, the 7-entry allowlist; sources and compiled maps),
  `tests/data/elfheimElves.test.ts` (6.2), `ptNpcArt.test.ts` gains 6.3's placement checks (every sheet placed and
  approved, the per-town cap of 5.5, Arylon, the brooms); `corneliaLayout.test.ts`'s M8 line now expects the fisher as
  a `sailor` (5.3).
- **Compile:** the 61 maps compiled; 152 chunk PNGs of 14 maps were RGBA at `int-pt1` and come out palette-indexed
  (`build_map.save_chunk`), pixel-identical (checked), so the compile is the compiler's own output.

## 12. The ship's end views (PT-3 / PT-5 for 4.2, 4.3, 6.4; 2026-11-26)

The user rendered `ship_views` (`~/temp/frigate_sprite_sheet.png`, 240 x 128, binary alpha, 20 colours; left the back
3/4 view, right the front 3/4 view, both leaning right) and gave a blanket approval the same day ("all I've seen so far
is good and nothing is a 1-way door"), recorded as the recipe's `approved` / `user_review`.

- **A5 (the size gate):** 4.2 said "scaled to 112 when outside 104-118" and "the gate checks the height 112 +- 3",
  which disagree for a render of 115-118 px (this one is 116). The gate is the band itself: a drawn height in
  104-118 passes unscaled (the "resize, don't regenerate" rule; the airship's end views are 112 / 110 against a 94 px
  side view, the ship's 116 against 94). Momus-reviewed with the ship code.
- **Built:** `gen/vehicle_user.py` (+ `vehicle_user.yaml`, the render in `user_art/ship_views/`), writing
  `approved/vehicles/ship_back.{png,json}` (98 x 118 with the 1 px margin, anchor 0.4104) and `ship_front` (100 x 118,
  0.4178); no wake px were found to drop (the render has none); colours snapped to ship.png's 45, the outline in its
  darkest. `vehicles.py` `OPTIONAL` and `vehicleLayout.ts` `OPTIONAL_VEHICLE_FRAMES` gain both frames;
  `airshipHeading.headingFrame(h, t, has, 'ship')` is the same model for the ship (no turn frames); `FieldVehicleSprites`
  keeps a ship heading (boarding keeps the parked one, D-AV10). The style-lock dispatch routes `backend: user`
  vehicle jsons to `vehicle_user.check` before the Bedrock branch. Tests: `tests/scenes/shipHeading.test.ts`,
  `fieldVehicleArt.test.ts` (the sources line, the ridden ship's frames and mirror, the parked heading),
  `gen/selftest_vehicle_user.py` (in `selftest.py`).
- **Momus on section 12: REJECT -> fixed:** `vehicle_user.py` takes `write | check` (argparse; anything else is
  refused) and `write` refuses to replace a different approved frame without `retire.py`'s archive (7's gate is
  `vehicle_user.py check`). `headingPick` returns `Partial<Pick<VehiclePlacement, ...>>`.
