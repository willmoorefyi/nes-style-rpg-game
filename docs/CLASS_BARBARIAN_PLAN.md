# New hero class pair: Barbarian -> Berserker (pass CB)

User request (2026-11-26, verbatim): "The first instance of my new heroes is ready. The class is a 'barbarian' /
'berserker' combo. For now it can be a shallow copy of the warrior / knight. The hero is in the folder ~/temp/heroes/"

The render: `~/temp/heroes/barbarian_berserker_sprite_sheet.png`, made by the user in ChatGPT from the class pack
`~/temp/ff-game/class_pack/` (prompt.txt, the monk / master reference at native 560x160). Measured (`/tmp/class-barbarian`):
560x160 RGBA, alpha only 0 / 255, 2 rows (row 1 barbarian, row 2 berserker) x 7 cells of 80x80 in the order READY,
ATTACK, CAST, HURT, DOWN, VICTORY, KNEEL; the lowest opaque row of every one of the 14 cells is 76; every cell's
figure stays inside its cell (attack's axe reaches column 0 of its own cell; no 8-connected piece crosses a cell
border); 16 colours for the whole sheet, the same 16 in both rows, darkest (24, 19, 27); every pose faces left
(checked by eye at 3x and 10x). Horned helm, fur pelt, two hand axes; the berserker adds a beard and a heavier pelt.

No AI image call of any kind in this pass. The user's pixels are used as rendered: the import only maps colours
(section 3.2); no pixel is moved, added, removed or hand-edited.

## 1. Decisions

| # | Decision |
|---|----------|
| D-CB1 | Ids `barbarian` (base) and `berserker` (`upgradeFrom: barbarian`); names "Barbarian", "Berserker"; `abbr` **BRB** / **BSK** (3 letters like all 12 others: the slot strip, save slots, magic-shop learner list and sandbox labels were laid out for 3). |
| D-CB2 | Shallow copy: barbarian's `baseStats`, `statGrowth`, `usableEquipment`, `spellLevels`, `hitPercent`, `magicDefense` equal the warrior's; berserker's equal the knight's, **including** the knight's `spellLevels { white: 3 }` and `spellCharges` (white magic L1-3; flagged to the user, 7). No new schema field (classes have no description field; the yaml entry carries a comment). |
| D-CB3 | Upgrade: `CLASS_UPGRADES.barbarian = 'berserker'`; the trigger is the same data-driven one as warrior -> knight (the upgrading NPC's `actionFlag`, `upgradeParty` over every eligible member), so no NPC or flag changes. |
| D-CB4 | Items: `- barbarian` is added after `- warrior` in every item's `usableBy` (44 items). The knight is named in no `usableBy`: a promoted class equips its base's items through `upgradeFrom` (`Character.canEquip`), so berserker needs no entry either. Shops, magic shops (`spellLearners`) and the bestiary need no change (data-driven, no class list). |
| D-CB5 | Order: barbarian after red_mage, berserker after red_wizard in classes.yaml, so party creation lists it 7th (`PartyCreationScene` filters `!upgradeFrom`: 7 x 36 px = 252 px of an 800 px window); default name `BARB` (`DEFAULT_NAMES`). |
| D-CB6 | Debug data: `kits.yaml` gets a `barbarian` row equal to the `warrior` row in every kit, and a `berserker` row equal to the `knight` row in every kit that has a `knight` row (the S19+ anchors `w_onrac` / `w_gaia`, whose knight carries `spells: [cure, cure2]`; `tests/data/gearBands.test.ts` needs an explicit row for every promoted class there); `debug-sandbox.yaml` classes `base` + barbarian, `promoted` + berserker; a new debug scenario `cb_barbarians`, written out in 2.1. |
| D-CB7 | Battle art: a new importer `gen/hero_user.py` (the battle_ai analogue of `field_user.py`), section 3. |
| D-CB8 | Kneel: the KNEEL column is the class's key (`approved/<class>/battle_kneel.png`), bridged by the existing one-source bridge (`kneel_bridge.py`) through a new hero block kind `kneel: {source: user}` (section 4). Monster rigs keep their rules (EF-H user kneels stay `source: ai`, unchanged). |
| D-CB9 | In-betweens: joints hand-marked in `gen/anim/barbarian.yaml` / `berserker.yaml`; `puppet.py` gains an **optional far-hand weapon** (`tip_f`, part `weapon_f`) for the second axe (section 5). Classes without `tip_f` build byte-identical frames. |
| D-CB10 | Field art, **temporary**: a field alias `barbarian -> warrior`, `berserker -> knight` (section 6), not a pixel copy, until the user renders a field walk sheet (the NPC pack format). 1x legacy: two new `characters.py` Looks. |

## 2. Data and code (game)

- `assets/data/classes.yaml`: the two entries (D-CB1, D-CB2, D-CB5).
- `assets/data/items.yaml`: 44 `- barbarian` lines (D-CB4). The file is hand-kept yaml (no generator).
- `src/systems/ClassUpgradeSystem.ts`: the mapping (D-CB3).
- `src/scenes/partyCreation/PartyCreationViews.ts`: `DEFAULT_NAMES.barbarian = 'BARB'`.
- `assets/data/kits.yaml`, `assets/data/debug-sandbox.yaml`, `assets/data/debug-scenarios.yaml` (D-CB6).
- 2.1 `cb_barbarians` (battle, `assets/backgrounds/grassland.webp`, items `{potion: 3}`, gold 0):
  `{class: barbarian, name: BARB, level: 10, equipment: [rapier, leather_armor, wooden_shield], hp: 20}` (weak, so it
  kneels), `{class: berserker, name: BERS, level: 30, equipment: [sun_blade, opal_armor, aegis_shield, opal_helm],
  spells: [{id: cure, level: 1}]}`, `{class: barbarian, name: BARB2, level: 10, equipment: [rapier, leather_armor,
  wooden_shield]}`, `{class: knight, name: KNT, level: 30, equipment: [sun_blade, opal_armor, aegis_shield,
  opal_helm], spells: [{id: cure, level: 1}]}` (the like-for-like control); enemies `[goblin, goblin, wolf]`. Preview: `?mute=1&scenario=cb_barbarians`
  (`&kneel=loop`, `&enemyAnim=loop`).
- Save / load: a save stores class ids and loads them through the class registry; no version change, no list to
  extend (`Character` serialises `classId`; `slotView.ts` reads it through `ClassRegistry.getClass` / `classLabel`).
  A save-round-trip test of a berserker is part of 9.
- The verifier and the curve model use fixed parties (`questLateData.PRICE_PARTY`, the balance helpers): unchanged,
  but they read classes.yaml / items.yaml, so `npm run quest -- --strict` runs as a gate.

## 3. The importer `gen/hero_user.py`

### 3.1 Inputs

- The render, tracked at `assets-src/gen/user_art/barbarian/battle_2026-11-26.png` (copied byte for byte from
  `~/temp/heroes/`), and a recipe in `assets-src/gen/hero_user.yaml`:

```yaml
barbarian_berserker:
  file: user_art/barbarian/battle_2026-11-26.png
  sha256: <sha256 of the file>
  rows: [barbarian, berserker]          # row r of the render is class rows[r]
  columns: [ready, attack, cast, hurt, down, victory, kneel]
  faces: left
  tool: ChatGPT (interactive)
  rendered: "2026-11-26"
  author: user
  refs: {pack: ~/temp/ff-game/class_pack, prompt.txt: <sha256>, class_reference_native_560x160.png: <sha256>}
  source_name: barbarian_berserker_sprite_sheet.png
  approved: "2026-11-26"
  user_review: "The first instance of my new heroes is ready ... (delivered as final; keep as rendered)"
```

### 3.2 Cut (fail closed: every refusal is a `SystemExit` naming the rule)

1. The file's sha256 equals the recipe's.
2. Size is exactly (7 x 80, len(rows) x 80); `columns` is exactly the seven names above; `faces` is `left`.
3. Binary alpha (any 0 < alpha < 255 refused).
4. Every cell's figure is inside its cell: no opaque pixel of one cell is 8-adjacent to an opaque pixel of another
   cell; every cell is non-empty.
5. Feet: the lowest opaque row of every cell is the house `bottom_row` 76 (hero battle cells, `battle.json`).
6. Palette (house rules, one palette for the sheet): the sheet's unique opaque colours must number <= 16 (more is
   refused; no k-means, so no colour is invented). Each colour c maps to `PX.snap15(c)` (15-bit), and the darkest
   (smallest channel sum) maps to `PX.OUTLINE` (6, 4, 10), as `PX.sheet_palette` does for an already-small palette.
   The one-to-one check runs on the final colours (after the darkest is replaced): two source colours with the same
   final colour are refused. The json's `cut.palette` lists every source -> final pair, so the outline swap
   (24, 19, 27) -> (6, 4, 10), the largest change the import makes, is visible (and on the review page). Nothing else:
   no resample, no move, no outline ring added (the render has its own), alpha copied.
7. Output per class (row r): `battle.png` 240x160 = cells ready, attack, cast / hurt, down, victory in the house 3x2
   layout (`puppet._cells` order), and `battle_kneel.png` 80x80 = the kneel cell.

### 3.3 Approve / check

- `hero_user.py cut <recipe> [--out DIR]`: the measures (per cell bbox, feet row, colour map) and a review page
  (x4 sheet of the 14 cells as imported) to `~/temp/ff-game/class_pack/review/import/`.
- `hero_user.py approve <recipe>`: writes `approved/<class>/battle.{png,json}` and `battle_kneel.{png,json}` for each
  row, behind `approve.overwrite_gate` (the kneel key) and the same retire rule as field_user for `battle.png` (an
  existing different file needs a byte-identical archive). `battle.json`: `character`, `sheet: battle`,
  `backend: user`, `tool: assets-src/gen/hero_user.py`, `source {file, sha256}`, `recipe`, `row`, `rendered_in`,
  `rendered`, `author`, `refs`, `grid [80, 80]`, `bottom_row 76`, `layout [3, 2]`, `poses` (the six), `faces: left`,
  `cut` (the measures, the colour map), `imported`, `approved`, `user_review`, `route`; **no** `face_fix` /
  `facing_fix`. `battle_kneel.json`: the same provenance with `sheet: battle_kneel`, `foot_row 76`.
- `hero_user.py check [<recipe> ...|--all]`: each approved file of each row re-imports byte for byte, and its json's
  `source` equals the recipe's. `check(meta)` is the per-json form used by the selftests.

### 3.4 Selftest wiring

- `field_user.user_check` (the `backend: user` dispatch of `selftest.py` / `selftest_roster.py`): a json whose `tool`
  is `assets-src/gen/hero_user.py` goes to `hero_user.check`.
- `selftest.py`'s style-lock loop sends a `battle_kneel.json` to `selftest_roster.kneel_ok` (the `backend == user`
  branch skips `KNEEL_SHEETS`). In `kneel_ok`, **before** today's `source == "ai"` refusal (selftest_roster.py:209), a
  hero key with `backend: user` is checked first: its class file must say `kneel: {source: user}`, then it passes by
  `hero_user.check`; a hero class file with `source: user` and a key without `backend: user` is refused; every other
  key goes on as today. The user `battle.json` goes through the `backend: user` branch to `field_user.user_check`.
- `selftest_kneel_ai.py` (run by `selftest.py`): `_lists` loops over every `anim/*.yaml` hero and wants a
  `kneel_ai.yaml` sprite entry; a hero whose block says `source: user` has no pass-KA request, so `_lists` skips it
  (stated in its message). `_coverage` pins the new coverage format (4): monsters `123/123 (ai a, user u, derived d,
  alias l)` summing to 123, heroes `N/N (...)` summing to N with N = the count of `anim/*.yaml` hero files (14).
- New `gen/selftest_hero_user.py` (called by `selftest.py`), on temp trees with synthetic 7x2 renders: the round
  trip (approve, then check OK), and each refusal of 3.2 (sha, size, semi-alpha, a piece across a cell border, feet
  off row 76, 17 colours, a colliding snap), a changed approved png failing `check`, `kneel_ok` refusing
  `source: ai` on a user hero key, coverage counting `user`.

## 4. Kneel `source: user` (heroes)

- `puppet_kneel.is_ai` becomes "has a drawn key": `source` in (`ai`, `user`); `kneel_source_ai.hero_frames` serves
  both (the key's tag becomes `ai` or `user`); its keys stay `source`, `bridge`, `offset`.
- `kneel_tools.py coverage` counts `user` separately: `heroes 14/14 (ai 12, user 2, derived 0, alias 0)` and
  `monsters 123/123 (ai 123, user 0, derived 0, alias 0)`, with a `user:` id list line per label.
- The D-KT4 checks (puppet_kneel `check_frames`) apply to a user key as to an AI key (band reported, not gated).
  Locks: `puppet_kneel.py lock barbarian berserker` writes `anim/<class>.lock.json`; `check` must then print OK.

## 5. Puppet in-betweens and the second axe

- `anim/barbarian.yaml`, `anim/berserker.yaml`: `robed: false`, `attack_hand: n`, joints for ready / attack / cast
  (marked on 10x gridded cells, `/tmp/class-barbarian/g_*.png`), `tip` (near axe) and `tip_f` (far axe), `tweaks`
  only after review, `kneel: {source: user}` plus `bridge` options only if the review asks.
- `puppet.py`: `PARTS["weapon_f"] = ("hand_f", "tip_f", 2.0)` (appended last to `PARTS`), drawn right after
  `farm_f` in both z orders. Threaded through: `load_cfg` converts `tip_f` to a tuple with the joints; `UPPER`
  gains `tip_f` (so `_moved`, e.g. `idle_b`, carries it); `keep_lengths` extends the far chain to `tip_f`; `review()`
  draws the `tip_f` bone and dot. `weapon_f` is taken from the in-between's `SOURCE` keyframe (no `part_src` entry;
  only `weapon` uses `wsrc`). A
  keyframe without `tip_f` never segments or draws it, so the 12 old classes are unchanged (gate: their atlas rows and
  `puppet.py review` checks byte / value equal). Targets: after `battle_targets` builds a frame, `tip_f` follows the
  far hand rigidly, rotated with the far forearm (el_f -> hand_f) of its source keyframe; a `tweaks` entry may move
  it. `tip_f` on a keyframe that a `facing_fix` figure mirror turns is refused (`ValueError`), since the mirror's n/f
  relabelling does not know it.
- `puppet.py review barbarian berserker` must print `battle OK` (ring, px ratio 0.88-1.12, height +-4, <= 2 pieces).

- Review fallback: if the image reviewer still rejects an in-between after round 3, those frames ship aliased to
  their source keyframe (the class's joint file is kept but the frame is listed in an `alias_frames` key that
  `battle_inbetweens` honours, as FW-Q does for monsters; `load_cfg` refuses any name not in `INBETWEENS`, and
  `selftest_hero_user.py` covers both the alias and the refusal), and it is reported to the user. Same for the kneel bridge
  (fallback: the bridge's `u` / `keep_*` options at their defaults, reported).

## 6. Field alias (temporary)

- `assets-src/gen/field_alias.yaml`: `barbarian: warrior`, `berserker: knight`, each with the note "temporary until
  the user renders a field walk sheet". `build_field_ai` gives an alias the target's block (`sheets[alias] =
  sheets[target]`) and records `aliases` in `characters-ai.json`; `characters-ai.png` stays byte-identical. Refused:
  an alias that has its own approved field sheet, or a target without one. The runtime is unchanged.
- 1x legacy (`?art=legacy`, assetCoverage's `characters.json` rule): two ROSTER Looks (fur-brown tunic, the plain
  `helm` gear (no horned 1x gear exists; none is added), sword as the nearest 1x weapon; berserker with a beard), so
  `characters.png` gains two blocks.

## 7. For the user to decide (reported, not done)

- Stats are an exact copy (warrior / knight); a barbarian identity (more HP / STR, less AGI, no shield, axes) is a
  data edit once ruled.
- The berserker inherits the knight's white magic L1-3; a berserker usually has none.
- The field walk sheet (3x3 of 48x96, the NPC pack) is still to render; until then the alias of section 6.
- The barbarian is shown with axes but equips the warrior's list (swords, shields too).

## 8. Gates

`python3 -I assets-src/gen/selftest.py`; `hero_user.py check --all`; `puppet.py review barbarian berserker` (and the
12 old classes unchanged); `puppet_kneel.py check` (all 14); `kneel_tools.py coverage`; `build_assets.py battle_ai
field_ai characters` twice under PYTHONHASHSEED 0 / 1 with identical outputs; the 12 old battle rows equal to
mainline's **by class**: `build_battle_ai` sorts by folder, so barbarian / berserker take rows 0-1 and every old row
moves down by 2 by design (black_mage row 0 -> 2, ..., white_wizard 11 -> 13; the png and the json `row` numbers
change); the scratch script `/tmp/class-barbarian/rowdiff.py` (outside the repo) crops each old class's cells from
mainline's `battle-characters-ai.png` (`git show mainline:...`) at mainline's `sheets[cid].row` and from the branch's
at the branch's `sheets[cid].row`, compares the pixels, and checks `cell` / `scale` / `footRow` / `poses` equal;
`characters-ai.png` byte-equal (the aliases only touch the json); `monsters-ai*` byte-equal (no monster stage run); `npm run build`; `npm run test:fast`; the touched tests;
`npm run quest -- --strict`. Review: a fresh image-only reviewer on the in-between strips / GIFs and the kneel bridge
(`~/temp/ff-game/class_pack/review/`), up to 3 rounds. Browser (`?mute=1`): `cb_barbarians` in battle with
`&kneel=loop` and `&enemyAnim=loop`, and the new-game class pick; screenshots to `~/temp/ff-game/class_pack/after/`.

Commits: only on branch `class-barbarian` (from mainline 8883fb5f), the render tracked under
`assets-src/gen/user_art/barbarian/`; never pushed. Docs: AGENTS.md gets a row for `hero_user.py` in the Art & Audio
table, the `kneel: {source: user}` kind in the kneel note, the field alias, and the class pair.

## 9. Tests

- `tests/data/barbarianClass.test.ts`: the copy rule (D-CB2 field by field), abbr length 3, the upgrade mapping and
  `upgradeParty`, every item usable by a warrior is usable by a barbarian and vice versa, berserker equips exactly the
  knight's set (`Character.canEquip`), every kit's barbarian row equals its warrior row and, where a kit has a knight
  row, its berserker row equals the knight row; party creation lists 7 base classes with barbarian 7th; a berserker
  survives a save / load round trip.
- `tests/rendering/barbarianArt.test.ts`: both classes have battle atlas rows with every pose column; each key cell of
  the atlas equals the approved cell (no mirror applied) and its lowest opaque row is 76 (x2 in the atlas); the
  approved jsons are `backend: user`, `faces: left`, no `facing_fix`; the field alias rows equal their targets'.
- Count updates: `PartyCreationScene.test.ts` (7 base), `debugSandbox.test.ts` / `sandboxModel.test.ts` (7 / 14),
  `heroSpriteNpcs.test.ts` (14), `heroFacing.test.ts` (the 12 pass-HF classes keep their rules; the user-rendered
  classes are asserted to have none), `ClassUpgradeSystem.test.ts` (the new pair).

## 10. Result (2026-11-26)

- Momus: REJECT (3 blocking: berserker kit rows, the kneel_ai selftests, the by-class row gate), REJECT (the row gate
  not yet in the file), then **OKAY** (4/5).
- Import: `hero_user.py approve barbarian_berserker`: 16 colours, mapped one-to-one (the outline (24, 19, 27) ->
  (6, 4, 10), the rest snapped to 15 bits); `check --all` OK for the 4 files.
- In-betweens: joints, `tip_f`, `part_boxes` and `tweaks` in `anim/barbarian.yaml` / `berserker.yaml` (the two files
  share their joints: the renders are on the same layout). `part_boxes` (hand-marked boxes of the axe heads) was added
  in implementation: without it the nearest-bone split broke the axe heads into pieces (round 0, by eye).
- Image review (fresh image-only reviewer each round): round 1 ITERATE (cast_gather leg seams, cast_release arm over
  the face, kneel_in2 stretched face, atk_wind2 blot) -> hip / elbow / hand tweaks, `kneel.bridge {keep_top: 0.42,
  keep_bot: 0.2}`; round 2 ITERATE (cast_rise seams) -> cast_rise = the cast body with the hands a few px low; round 3
  **APPROVE** both (notes: the wind-up and the cast raise are small motions; no `alias_frames` needed).
- Gates: `puppet.py review` 14/14 OK; `puppet_kneel.py check` 14/14 OK (locks added for the two classes; `lockdiff
  --base mainline`: 8 added, 0 changed); coverage `heroes 14/14 (ai 12, user 2, derived 0, alias 0)`, `monsters
  123/123 (ai 123, user 0, ...)`; battle_ai / field_ai / characters identical under PYTHONHASHSEED 0 / 1; rowdiff: the
  12 old rows identical by class, `characters-ai.png` byte-equal to mainline, `monsters-ai*` unchanged; `npm run
  quest -- --strict` OK.

## 11. Amendment A1 (pass CB-2: hunter -> ranger, legionnaire -> centurion): a palette per class row

The two next user renders (`~/temp/heroes/hunter_ranger_sprite_sheet.png`, `legionnaire_centurion_sprite_sheet.png`;
560x160, binary alpha, feet on row 76, every pose facing left) have **32 colours per sheet: 16 per row, no colour
shared between the rows** (the class pack's prompt asks for "at most 16 colours per row"). 3.2 step 6 refuses them.

- A recipe may say `palette: rows` (default `sheet`, today's rule, so the barbarian / berserker import is unchanged
  byte for byte). With `rows`, step 6 runs **per class row**: that row's opaque colours, <= 16, each `PX.snap15`, the
  row's darkest -> `PX.OUTLINE`, one-to-one on the final colours within the row. Each row's map recolours **only
  that row's slice** (`out[r * 80:(r + 1) * 80]`), so a source colour that appears in both rows is mapped by each row's
  own rule (e.g. a dark that is the outline in one row and a shade in the other) and needs no refusal. Final colours
  **may repeat across rows** (measured: hunter / ranger share 1, the outline; legionnaire / centurion share 6): there is
  no cross-row uniqueness check. A refusal in `rows` mode names its class row (`ranger: 17 colours ...`). Any other
  `palette` value is refused by `recipe()`.
- Measures: `info["palette"]` stays the sheet map for `sheet`; for `rows` it is `{class: [[src, dst], ...]}`, and each
  class's jsons record their own row's map in `cut.palette` (the field `puppet_kneel` already reads) and their own
  row's count in `cut.colours` (16), so a class's files carry only its own colours. The review page draws one swatch
  strip per row (its canvas grows by one strip height per row). The module docstring and the AGENTS.md row say so.
- `hero_user.py`'s interfaces (`recipe`, `cut`, `approve`, `check`, `review`, `metas`, the CLI) keep their signatures;
  only `palette()` gains an optional row selection internally. The other agent's `class-lance` branch extends the same
  file; this change is one recipe key and the palette step.
- Selftest (`selftest_hero_user.py`; `render()` gains per-row colour lists): a synthetic render with 16 disjoint
  colours per row is refused with `sheet` and imported with `rows` (each class's json lists only its row's colours,
  the darkest of each row -> PX.OUTLINE); a `rows` render whose rows share a colour that is the darkest of only one
  row maps it per row (outline in that row, its own shade in the other); a row with 17 colours is refused with `rows`
  naming the row; an unknown `palette` value is refused. **Barbarian JSON gate:** `metas()` run on the real
  barbarian_berserker `cut()` equals the four committed jsons (all keys but `imported`), and `check` re-imports the
  four pngs byte for byte.
- Everything else of the pass (classes, rigs, kneel `source: user`, field aliases, tests, gates, reviews) follows
  sections 2-9 per class pair: hunter (HNT) / ranger (RNG) copy thief / ninja (field alias thief / ninja); legionnaire
  (LGN) / centurion (CEN) copy warrior / knight (field alias warrior / knight). Each pair has its own branch from
  `class-barbarian` (bfc71d03): `class-hunter`, `class-legion`; this amendment's commit is cherry-picked onto both.

### 11.1 Legionnaire / centurion result (2026-11-27, branch class-legion)

Data-only beyond A1 (every key is 1 piece: A2 / A3 are not needed here). Rigs: the scutum rides with the torso
(`part_boxes`), the gladius is the near hand's weapon, the pilum / vine staff the cast key's; the wind-ups and
cast_gather keep the sword hand behind the shield. Image review: round 1 ITERATE (atk_mid drew the sword hand over the
shield face) -> atk_mid on the attack key; round 2 **APPROVE** both (optional notes: the pilum's cast_release reads as
more wind-back than a throw; cast_gather is near ready, so the shield swap pops at cast_rise, as the keys draw it).
## 12. Amendment A2 (hunter / ranger): the pieces cap follows the drawn key

The hunter / ranger render draws the bow string as a dotted line and the ranger's CAST as a hand of loose leaves, so
its keys are several separate pieces by design (4-connected `PX.components`, the count both checks use; no size filter):
hunter ready 6, attack 17; ranger ready 5, attack 16, cast 4. Every key of the 14 classes before it is 1 piece. Two
checks cap a generated frame at 2 pieces, which these keys break before any re-posing:

- `puppet.check` (the in-between `ok` of `puppet.py review`): `pieces <= 2` becomes `pieces <= max(2, pieces of the
  keyframe the frame is cut from)` (`SOURCE[name]`; the report gains `pieces_src`).
- `puppet_kneel.frame_checks` (the kneel K-checks): `pieces <= 2` becomes `pieces <= max(2, pieces of the frame's pixel
  source)`: ready for `kneel_in1`, the kneel key for `kneel_in2`, `kneel`, `kneel_b` (the `ring_ref` the D-KT4 rule
  already passes, else ready).

Every other check is unchanged. Since every earlier key is 1 piece, the cap stays 2 for the 12 + 2 earlier classes
(their `puppet.py review` / `puppet_kneel.py check` lines and the locks are unchanged; gate: both commands over all
classes). Measured: both kneel keys are 1 piece, hunter's hurt 3 (no check's source); today only ranger's cast
in-betweens and both `kneel_in1` frames rely on the relaxed cap. The image reviewer still judges every frame for stray
or detached bits (and a lost bow string). Selftest (`selftest_hero_user.py`):
a 1-piece key keeps the cap 2 (a 3-piece frame cut from it fails), a 5-piece key allows 5 and not 6 at equal area,
for both checks; a 1-piece kneel key over a 5-piece ready caps the key-drawn frames at 2. Momus: OKAY (4/5).

## 13. Amendment A3 (hunter / ranger): keep the drawn specks

`puppet.render` ends with `outline()`, which first drops every 4-connected piece under 12 px (stray bits of a cut).
The hunter / ranger keys draw the bow string as a dotted line of 1-3 px dots, so every in-between loses its string
(image review round 2: the string flickers off in atk_mid / atk_follow and on again in the attack key).

- A class file may say `keep_specks: true` (default false: every class before it, unchanged byte for byte). Then
  `render` passes it to `outline(img, keep_specks=True)`, which skips the speck drop only; the seam inking is unchanged.
  `load_cfg` refuses a non-boolean. Used by `anim/hunter.yaml` and `anim/ranger.yaml` only.
- The cut's own stray bits are then kept too; the image reviewer judges them (A2's pieces cap still bounds the count).
- Scope: battle in-betweens only (`puppet.render`); the kneel frames of these classes come from the bridge, not the
  rig renderer (`puppet_kneel_rot`, which keeps the default).
- Gates: after `build_assets.py battle_ai field_ai characters` under PYTHONHASHSEED 0 / 1, the 14 earlier classes'
  atlas rows unchanged by class (rowdiff), `puppet.py review` over all classes; the round-3 reviewer checks the string
  in atk_mid / atk_follow.
  Selftest (`selftest_hero_user.py`): `outline` drops a 3-px speck by default and keeps it with `keep_specks`;
  `load_cfg` refuses `keep_specks: 1`; hunter's and ranger's atk_mid / atk_follow have more opaque px with the key on
  than off (the dots kept; the outline ring joins the dots, so the piece count is no measure). Momus: OKAY (4/5).

### 13.1 Hunter / ranger result (2026-11-27)

Image review: round 1 ITERATE (atk_mid blended the ready and attack bows over the face; ranger atk_follow doubled
bow) -> atk_mid / atk_follow rebuilt on the attack key; round 2 ITERATE (the dotted string dropped as specks) -> A3
`keep_specks`; round 3 ITERATE (the string breaks in atk_wind1 / atk_wind2; atk_follow shows no release). Fallback of
section 5: `alias_frames: [atk_wind1, atk_wind2, atk_follow]` for both classes (those frames show ready, ready,
attack); every other generated frame (atk_mid, cast_gather / rise / release, idle_b, the kneel bridge) passed round 3.
For the user: the attack is a draw-and-hold until a bow-specific wind-up / release exists (e.g. drawn release frames).

## 14. Amendment A4 (cleric / paladin): a drawn hero kneel key is exempt from the contact share

`puppet_kneel.frame_checks` asks a held kneel frame (`kneel`, `kneel_b`) to cover at least half of ready's px on the
bottom two rows (K-ground contact share). The paladin's drawn KNEEL (the user's art: a knee and a toe on the ground,
the cape lifted) has 17 px there, under half of its wide-stance ready: the check fails on the user's own pixels, which
may not be edited. The monster pass already ruled this (KT3, remorazz): an AI key and its key-drawn frames are exempt
from the contact share but must still reach the feet row.

- The hero check applies the same rule: when the frame is drawn from the key (`ring_ref` given: `source: ai | user`,
  held frames `kneel`, `kneel_b`; the share never applied to `kneel_in2`), the contact share is skipped; the lowest-row-on-76 rule, K-fit, alpha,
  palette, magenta, pieces and ring stay. A derived kneel (no `source`) keeps the share. The 12 AI classes and the
  user classes before the paladin pass the share today, so their results do not change (gate: `puppet_kneel.py
  check` over all classes, locks unchanged).
- Selftest (`selftest_hero_user.py`): a held frame with a 2-px foot fails the share with `ring_ref=None` and passes
  with a ring_ref; a frame whose lowest row is not 76 fails either way. Momus: OKAY (measured: only the paladin's
  held frames fail the old share, 17 of 42 px; the other 15 classes pass it).

### 14.1 Cleric / paladin result (2026-11-27, branch class-cleric)

Exact copies of white_mage -> white_wizard (user ruling: new classes are exact copies, sprites only). A1-A3
cherry-picked; A4 new (Momus OKAY). Image review: round 1 ITERATE (blended frames: shield fragments, the wind-ups
pushing forward, the sparkle redrawn) -> every in-between on one key with a small offset; round 2 ITERATE (the separate
sparkle gains an outline ring whenever its forearm moves; a knee seam in idle_b; a detached pommel) -> cast_rise /
cast_release aliased to the cast key, hips kept, the pommel in the weapon box; round 3 ITERATE on atk_wind1 / atk_wind2
only (a forearm sliver beside the shield, the weapon over the face) -> section 5 fallback: `alias_frames: [atk_wind1,
atk_wind2, cast_rise, cast_release]`. atk_mid, atk_follow, cast_gather, idle_b and the kneel bridge passed round 3.
For the user: a party with both the white mage and the cleric needs 430 G for the two starting kits (the 400 G NG-5
bound skips that pair); the cleric shows in the magic shop's learner lists ("Learn: WHM RDM CLR").

### 14.2 Ronin / samurai result (2026-11-27, branch class-ronin)

Exact copies of thief -> ninja. A1-A4 cherry-picked (the samurai's slash streaks keep_specks; the ronin's hat in DOWN
is a key, imported as drawn). Rigs key-based from the start (the cleric lessons). Image review: round 1 samurai
**APPROVE**; ronin ITERATE (atk_wind1 / atk_wind2 drew a second katana while the ready key keeps it sheathed) -> those
two left to the ready key (`alias_frames`: the draw is one stroke); round 2 ronin **APPROVE**.

### 14.3 Shaman / druid result (2026-11-27, branch class-shaman from mainline 8f5872fd)

Exact copies of black_mage -> black_wizard (user: "For now these should come in as copies of the black mage"):
stats, spells, equipment, magic-shop learners ("Learn: BLM RDM SHM"), upgrade rule. Data-only on top of A1-A4 (no
pipeline change): `palette: rows`, keep_specks for the shaman's ice shard and the druid's floating leaves, key-based
in-betweens. Image review round 1 **APPROVE** both (optional: the staff tip dropped 1 px below the feet in idle_b /
cast_gather -> the staff hand kept still there; measured lowest row 76). The main battle page grows from 23 to 25
rows of 160 px: 2880 x 4000, 96 px under the 4096 limit, so the next 80 x 80 class pair needs a new page. NG-5: a
party with both the black mage and the shaman needs 425 G (skipped like the cleric + white mage pair; 870 parties).
Field packs: shaman (stand-in black_mage), druid (stand-in white_wizard: black_wizard's field sheet carries head_from /
row_from fixes the pack reader refuses).

## 15. Amendment A5 (shaman / druid, beastmaster / summoner): an overflow page for 80 x 80 classes

The main battle page (`battle-characters-ai.png`) holds one 160 px row per 80 x 80 class, 2880 px wide (18 poses x
80 x 2). At mainline 8f5872fd it holds 23 classes (3680 px); WebGL1's texture limit is 4096, i.e. 25 rows. With the
shaman / druid (first commit of `class-shaman`) it reaches 4000; the beastmaster / summoner (third commit) cannot fit.
Pass CL's extra pages hold only oversize sheets (a 6 x 3 block per class with `cell`, `footRow`, `body`, `grid`,
`reach`, `top`, `heads`). Commits on `class-shaman`: (1) shaman / druid on the main page (4000 / 4096); (2) this
amendment, moving the shaman / druid to the overflow page; (3) the beastmaster / summoner, appended to it.

- **Data:** `assets-src/gen/battle_pages.yaml`, key `overflow`: a list of pages, each a list of 80 x 80 class ids laid
  out like the main page (one row per class in the listed order, the 18 pose columns, the top-level `cell` /
  `footRow` / `poses`). After commit (2): `overflow: [[shaman, druid]]`; after (3): `[[shaman, druid, beastmaster,
  summoner]]`. A missing file means no overflow page (the build as on mainline).
- **Build (`build_battle_ai`):** the listed classes are removed from the 80 x 80 entries **before** the main page is
  built and before `entries[0]` (grid, poses, footRow) is read, so every other class's main-page row and the main png
  are exactly mainline's (barbarian stays `entries[0]`). The listed classes go onto `battle-characters-ai-<n>.png`,
  numbered after the oversize pages (today 1 and 2, so the overflow page is 3), json entries `{row, page,
  inbetweens}` (no `cell`, `grid`, `body`, `reach`, `top`, `heads`), appended to `sheets` after the main and oversize
  entries, the page listed in `pages` with its size. Refused (SystemExit naming the fix): a listed id with no approved
  `approved/<id>/battle.json`, an oversize (non-80 x 80) listed class, an id listed twice, any page over 4096 px on
  either side (the main page's message names `battle_pages.yaml`).
- **Readers:** an entry with `page` but no `cell` / `grid` / `footRow` falls back to the top-level values and the main
  layout (`grid` = [len(poses), 1]).
  - Python `gen/battle_atlas.py`: `cell_of`, `foot_of` and `cell_box` gain these fallbacks (they raise KeyError
    today); `puppet_kneel.old_columns` and `kneel_tools.party_diff` already go through them.
  - TS `battleAtlasPages.ts` already falls back (`cellOf`, `footRowOf`, `bodyOf`, `cellRect`); no change.
  - **Task (runtime change):** `CharacterAtlas.getBattleFrames` today adds `body` / `reach` / `top` for any `page`
    entry; it will add them only when the entry has a `body` (an oversize class), so an overflow-page class lays out,
    lunges (`heroBody` registers only classes with `art.body`) and previews (`PartyCreationScene` keys on `art.body`)
    like a main-page class.
  - All pages are already loaded at start (`loadExtraPages`).
- **Tests:**
  - `tests/rendering/CharacterAtlas.test.ts`: the paged fixture gains an overflow entry (`page` without `cell` / `grid`
    / `body`): it slices at the main layout on its page and `getBattleFrames` gives no `body` / `reach` / `top`.
  - `tests/scenes/battle/lanceScreenFit.test.ts`: "every oversize hero" filters on `body`, not `page`.
  - `tests/scenes/battle/meleeContact.test.ts` `heroAttackLeftInset`: every 80 x 80 class (main and overflow) read
    through `pageFile` / `cellRect`.
  - `tests/rendering/lanceAtlas.test.ts`: 23 main entries, `pages[0]` 2880 x 3680, the overflow page listed with
    height 160 x its classes, every page <= 4096.
  - `tests/rendering/shamanArt.test.ts` (and the beastmaster's): read the class's cells through its `page`
    (`pages[page].file`) and `cellRect`, never a hard-coded page number.
  - `tests/rendering/overflowPage.test.ts`: every class in `battle_pages.yaml` has an entry `{row, page, inbetweens}`
    on the listed page, in the listed order, its key cells equal its approved cells, and no other class is on it.
  - `selftest_hero_user.py`: the build's overflow split refuses an unknown / oversize / duplicate id and a page over
    4096; `cell_of`, `foot_of`, `cell_box` of an overflow entry give the main-layout cell on its page.
- **Gates (byte-identical claim):** after the rebuild, `assets/sprites/battle-characters-ai.png`, `-1.png` and
  `-2.png` are byte-equal to `git show 8f5872fd:assets/sprites/<file>`; `kneel_tools.py party-diff --base 8f5872fd`
  reports no change for any mainline class; the json's main-page rows equal mainline's.
- **Headroom (reported per page):** main 3680 / 4096 (416 px: 2 rows); page 1 (lance) 1728 and page 2 480 unchanged;
  page 3 320 / 4096 after (2), 640 / 4096 after (3) (3456 px: 21 more rows).
- AGENTS.md's battle_ai row names `battle_pages.yaml`.

### 15.1 Beastmaster / summoner result (2026-11-27, branch class-shaman, third commit)

Exact copies of monk -> master (user: "treat them as an alias of the monk"): stats, equipment, upgrade rule,
`unarmedMartial` included. On the overflow page with the shaman / druid (page 3: 4 rows, 2880 x 640). Rigs key-based;
keep_specks for the 1 px whip, the streaks and the spirit. Image review: round 1 ITERATE (cast_gather a copy of ready,
so the cast snapped) -> a rising gather; round 2 beastmaster **APPROVE**, summoner ITERATE (the gather split the
staff) -> the staff's middle in the torso box; round 3 summoner ITERATE (the raised hand parted from its forearm
across the staff) -> section 5 fallback `alias_frames: [cast_gather]` for the summoner.

### 15.2 Warlock / necromancer result (2026-11-27, branch class-shaman, fourth commit)

Exact copies of black_mage -> black_wizard (stats, spells and learners, equipment, upgrade rule), like the shaman /
druid. On the overflow page with the shaman / druid and the beastmaster / summoner (page 3: 6 rows, 2880 x 960, 3136
px of the 4096 cap left). Rigs key-based; keep_specks for the fel-fire wisps, the blast and the ground glow. Image
review: round 1 **APPROVE** for both classes, with no frame aliased. Report only: the warlock's kneel height is 64,
outside the 52-62 band (not a gate). NG-5: a party with two of black_mage / shaman / warlock costs 425 G, over 400 G, so
it is skipped like cleric + white mage (1485 parties are checked).

### 15.3 Ruling: balance enumerates the original classes only (2026-11-27)

User ruling (verbatim): "For our classic game we don't need all permutations since any party could previously have
duplicate players, so all these 'new' classes doesn't change anything with balance." The NG-5 starting-kit test
(`tests/data/actOneBalance.test.ts`) enumerates the parties of four different classes over the 6 original base classes
only (warrior, thief, monk, white mage, black mage, red mage: C(6, 4) = 15 parties). The skips for cleric + white mage
and for two of black mage / shaman / warlock are gone. A separate cheap test pins every other base class as an exact
copy of its original (`COPY_OF`: the rule fields, the start kit and every kit table row). The 430 G / 425 G notes in
14.1, 14.3 and 15.2 are superseded: such a party is the same as a classic party with a duplicate class. No other
balance test enumerates class combinations (`tests/balance/` runs fixed parties).

## 16. Amendment A6 (rune knight / mystic warrior): un-inked effect colours

Image review of the rune knight / mystic warrior (round 2) found two pipeline effects on the user's glow pieces, which
the render draws soft, with no dark outline (the slash arc, the rune sigils and orbs, the sigil's tether, the ground
glow):

- `puppet.outline` (every battle in-between) adds a 1 px `OUTLINE` ring outside every light (max channel >= 60) edge
  pixel. The body edge is inked in the keys, so the ring only fills seams there; a glow piece's edge is light, so each
  moved glow piece gains a dark ring. Measured on the committed atlas: in atk_mid, atk_follow, cast_rise and
  cast_release 71-124 `OUTLINE` pixels are 4-adjacent to an effect pixel, against the keys' 2-13. It flickers against
  the un-inked keys.
- `kneel_bridge.reink` (kneel_in1, kneel_in2, kneel_b) recolours every light edge pixel with the source's ink when the
  source's edge is >= 90 % dark. The rune knight's kneel key qualifies, so the ground glow's edge pixels turn dark
  (effect pixels in rows 72-76, x 0-40: 9 in kneel_in2 / kneel_b against the key's 40).

No rig setting avoids either, and `alias_frames` does not cover the kneel bridge. The scholar / sage (next pair) have
glow and spark pieces too.

- **Data:** a rig key `fx_colours: [[r, g, b], ...]` (gen/anim/<class>.yaml), opt-in: the colours of the class's
  effect pieces, as they are in `approved/<class>/battle.png`. Rune knight `[[24, 74, 123], [33, 140, 214], [123,
  214, 247]]`, mystic warrior `[[16, 74, 123], [33, 140, 222], [132, 214, 255]]` (the blue ramp: the only light
  colours on the keys' un-inked edge besides 5 px of brown).
- **Refusals:** in `puppet.load_cfg` (so `battle_inbetweens`, `puppet_kneel.kneel_frames` -> `hero_frames` and every
  check see a validated set), a ValueError naming the class for: not a list of 1-16 `[r, g, b]` integer triples in
  0-255; a duplicate; a colour that is not in `approved/<class>/battle.png` (load_cfg opens that file, only when the
  key is set); the key on a rigid or lance class (`PU.is_rigid`: pass CL's `PL.inbetweens` and `kneel_lance` would
  ignore it).
- **Change:** an edge pixel of an `fx_colours` colour is treated as already finished.
  - `puppet.outline(img, keep_specks=False, fx=None)`: the "light" pixels that seed the ring exclude `fx` colours, so no
    ring is added next to an effect pixel; a ring pixel next to both an effect pixel and a light non-effect pixel is
    still inked.
  - `puppet.render(..., fx=None)` passes it on; `battle_inbetweens` (puppet.py:458) passes the rig's set.
  - `kneel_bridge.reink(a, src, fx=None)`: edge pixels of an `fx` colour are not recoloured;
    `kneel_bridge.frames(..., fx=None)` passes it to the three `reink` calls; `kneel_source_ai.hero_frames`
    (kneel_source_ai.py:50) passes the rig's set.
  - The other callers pass nothing and are unchanged: `outline` in `rig_render.py` (monsters), `puppet_kneel_rot.py`,
    the selftests; `KB.frames` in `kneel_source_ai.bridge_frames` (monster bridge), `kneel_orbs.py`, `kneel_lance.py`.
  - Speck dropping, piece caps and every check are unchanged.
- **Known limit:** the blue ramp is also a body colour (runes on the shield and armour: 93 px inside the rune knight's
  ready key, 279 in the mystic warrior's, 0 / 2 of them on the edge). A seam that exposes such a body pixel is not
  inked. Measured with A6: the frames drawn from ready (idle_b, atk_wind1, atk_wind2, cast_gather, kneel_in1) have at
  most the ready key's count of effect-colour edge pixels (rune knight 0 / 0, mystic warrior 2 / 2).
- **Frames that change (A6 against no A6, the same rig; measured by a scratch prototype):** rune knight idle_b,
  atk_wind1, atk_wind2, atk_mid, atk_follow, cast_gather, cast_rise, cast_release 0 / 0 / 0 / 82 / 80 / 0 / 102 / 98
  px, kneel_in1 / kneel_in2 / kneel_b 0 / 33 / 33; mystic warrior 3 / 3 / 3 / 110 / 108 / 3 / 74 / 65 and 2 / 0 / 0
  (its ready key's 2 un-inked blue edge pixels; reink fires for kneel_in1, drawn from the idle).
- **Check results (expected):** `puppet.py review rune_knight mystic_warrior` prints `battle OK` for both. Without the
  ring the rune knight's cast_rise as rigged at round 2 (hand 6 px down) fails `puppet.check` (height 72 against the
  key's 77, 5 pieces against the cap of 4), so its tweak drops the hand 3 px instead (height 75, 4 pieces); fallback if
  a later change fails it again: `alias_frames: [cast_rise]`. Every other in-between of both classes passes unchanged
  (heights within the check's 4, pieces equal to the key's). Momus: OKAY 4/5 (2026-11-27).
- **Order:** implement; `build_assets.py battle_ai` (PYTHONHASHSEED 0 and 1, byte-equal); `puppet_kneel.py lock
  rune_knight mystic_warrior` (their kneel frames change: rune knight kneel_in2 / kneel_b, mystic warrior kneel_in1);
  `puppet_kneel.py check` (no ids: every rig with a kneel) passes, every other class's lock file unchanged (`git diff --stat
  assets-src/gen/anim/*.lock.json` lists only the two).
- **Scope (byte-identical claim):** with `fx` None or empty every function returns exactly what it returns today. Only
  the two rigs set the key. Gates: `battle-characters-ai.png`, `-1.png` and `-2.png` byte-equal to mainline
  19036df8; page 3's rows of the six classes already there byte-equal to mainline's; `characters-ai.*` unchanged; the
  monster atlas is not rebuilt (no monster code path changes).
- **Tests:**
  - `selftest_hero_user.py`: on a synthetic cell, `outline` with `fx` leaves an effect blob's edge un-inked, still
    inks a light body seam, and inks a ring pixel that touches both an effect pixel and a light body pixel; `outline`
    and `reink` with `fx=[]` equal `fx=None` equal today's result; `reink` with `fx` leaves an effect edge pixel and
    still recolours a light body edge pixel; the `load_cfg` refusals (bad shape, out of range, duplicate, not in the
    sheet, a rigid class).
  - `tests/rendering/runeKnightArt.test.ts` (on the committed atlas, both classes): in atk_mid, atk_follow, cast_rise
    and cast_release the number of `OUTLINE` pixels 4-adjacent to an `fx_colours` pixel is at most its source key's
    (attack / cast) + 5; kneel_in2 and kneel_b have at least the kneel key's count of `fx_colours` pixels in rows
    72-76, x 0-40; the frames drawn from ready have at most the ready key's count of effect-colour edge pixels.
- AGENTS.md: the puppet row names `fx_colours`, and the user hero sheets row lists "rune knight / mystic warrior
  (`fx_colours`, plan 16)".

### 16.1 Rune knight / mystic warrior result (2026-11-27, branch class-rune from mainline 19036df8)

User (verbatim): "I've now added the rune knight / mystic warrior. This should be imported as a copy of the red mage."
Exact copies of red_mage -> red_wizard (stats, white and black spells L1-5 / learners, equipment, upgrade rule):
`rune_knight` (Rune Knight, RKN, default name RUNE) -> `mystic_warrior` (Mystic Warrior, MYS). The render's file name
has the words the other way round (`rune_warrior_mystic_knight_sprite_sheet.png`); the ids follow the user's words, row
1 = base. On the overflow page 3 (8 rows, 2880 x 1280; 2816 px left, 17 more rows). Field alias red_mage / red_wizard
(temporary); walk-sheet pack entries (sword sheathed at the hip, shield on the arm; the mystic warrior's stand-in is
the knight, as red_wizard's field sheet has head_from / row_from fixes the pack reader refuses).

Image review: round 1 ITERATE (cast_gather / cast_rise and the mystic warrior's idle_b off the ground row by 1 px: the
tweaks' whole-figure offsets dropped, the idle breath on the upper body only); round 2 ITERATE (the glow pieces gained
an ink ring in atk_mid / atk_follow / cast_rise / cast_release; the rune knight's kneel ground glow re-inked dark) ->
amendment A6 (section 16, Momus OKAY 4/5) and `fx_colours` on both rigs, the rune knight's cast_rise hand 3 px down;
round 3 rune knight **APPROVE**, mystic warrior ITERATE (the blade parted from the gauntlet at the grip in atk_wind2 and
cast_gather) -> section 5 fallback `alias_frames: [atk_wind1, atk_wind2, cast_gather]` for the mystic warrior.

### 16.2 Scholar / sage result (2026-11-27, branch class-rune, second commit)

User (verbatim): "I've now added the 'scholar' / 'sage' character class, a shallow copy of the red mage / red wizard for
classic." Exact copies of red_mage -> red_wizard: `scholar_hero` (Scholar, SCH, default name SCHLR) -> `sage_hero`
(Sage, SAG). The `_hero` ids, as for dark_fighter_hero: `approved/scholar/` is the townsfolk scholar's field sheet and
`sage_star` / `sage_earth` / `sage_flame` / `dragon_sage` are NPC sheets; no class id equals an NPC sprite name and
their field sheets stay their own (`tests/rendering/scholarArt.test.ts`). On page 3 (10 rows, 2880 x 1600; 2496 px
left, 15 more rows). Field alias red_mage / red_wizard (temporary); walk-sheet pack entries (the book under the arm,
the sage's staff upright; the sage's stand-in is the knight, as for the mystic warrior).

`fx_colours` (A6): the scholar's orange potion sparks; the sage's potion sparks (orange, green, cream) and the rune
ring's bare gold and brown. The sage's gold and brown are its staff's colours too, so a staff seam stays un-inked (the
known limit of plan 16): 1-6 edge px in atk_wind1 / atk_wind2 against the ready key's 0; the art test allows the
sage ready + 6 (the scholar 0). Image review: round 1 ITERATE (the scholar's cast_gather hand broke under the book: the
gather raises it 1 px straight up; the sage's sparks and ring gained an ink ring: the ring colours added); round 2
scholar **APPROVE**, sage ITERATE (a shoulder seam in idle_b: the breath moves the head only); round 3 sage ITERATE
(the wrist tore in atk_mid) -> section 5 fallback `alias_frames: [atk_mid]` for the sage. Minor notes kept: the
kneel bridge slides the book on the ground 3 / 5 px between kneel_in2 and the key (a 60 ms frame).

## 17. Copy note on the class pick screen (`copyOf`, branch class-copynote)

User (verbatim): "I think at some point for the 'classic' mode we should note these characters are copies of base
classes. Can you add that to the character selection screen where appropriate?"

- **Data:** an optional `copyOf: <class id>` on every pass-CB / CL / CD-K copy class in `assets/data/classes.yaml`:
  24 classes (12 base, 12 enhanced). Base: barbarian, landsknecht, dark_fighter_hero, legionnaire -> warrior; hunter,
  ronin -> thief; beastmaster -> monk; cleric -> white_mage; shaman, warlock -> black_mage; rune_knight, scholar_hero
  -> red_mage. Enhanced: berserker, dragoon, death_knight_hero, centurion -> knight; ranger, samurai -> ninja;
  summoner -> master; paladin -> white_wizard; druid, necromancer -> black_wizard; mystic_warrior, sage_hero ->
  red_wizard. The 12 classic classes have none. `CharacterClassData.copyOf?: string` (`src/types/index.ts`, 435 ->
  437 lines, ceiling 442).
- **Validation (`src/core/schemaValidation.ts`):** `validateCharacterClassData` checks `copyOf` is a non-empty string
  when present. A new `validateClassCopies(classes)`, called by `DataLoader.loadClasses` after the per-record checks,
  throws (naming the class) when `copyOf`: names no class; names itself; names a class that has a `copyOf` (only an
  original can be copied); crosses tiers (a base copy of an upgraded class or the reverse: `upgradeFrom` present on
  one and not the other); or, for an upgraded copy, does not match its base's (`copyOf` of its `upgradeFrom` must be
  the `upgradeFrom` of its `copyOf`: berserker -> knight because barbarian -> warrior and knight upgrades warrior).
- **UI (`src/scenes/partyCreation/PartyCreationViews.ts`):** `buildClassPreview(cls, pose, anchor, copyName?)` writes
  `Plays as: <name>` (the original's `name`, the same full-name text as the panel's first line) on the panel's second
  line, which is blank today, so no line, the pose or the panel moves. `PartyCreationScene.updatePreview` passes
  `ClassRegistry.getClass(cls.copyOf)?.name` (nothing for an original; an unknown id cannot reach here, the loader
  refuses it). Only the pick screen describes a class before it is picked (the slot strip, the name and confirm steps
  show picked classes; the debug sandbox is dev-only; battle and menus are not touched).
- **Tests:**
  - `tests/core/schemaValidation.test.ts`: `copyOf` must be a string; `validateClassCopies` accepts the real classes
    and refuses each case above (unknown, self, copy of a copy, cross-tier, upgraded copy not matching its base's).
  - `tests/scenes/PartyCreationScene.test.ts` (or a new `classCopyNote.test.ts`): the preview of a copy class (e.g.
    the hunter) has the line `Plays as: Thief` as its second line; an original (the thief) has a blank second line;
    the line count and the pose's position are the same for both.
  - `tests/data/actOneBalance.test.ts`: the copy test reads `copyOf` instead of its own `COPY_OF` table: every base
    class but the 6 originals has a `copyOf`, every upgraded class but the 6 originals' upgrades has one, and every
    copy's rule fields equal its original's (both tiers), its start kit and every kit table row (base) equal its
    original's.
- **Browser check:** `?mute=1`, the pick screen on a copy class and on an original, screenshots in
  `~/temp/ff-game/class_pack/copynote/`.
- AGENTS.md: the Key Interfaces line on `CharacterClassData.abbr` also names `copyOf`.
- **Momus OKAY 4/5 (2026-11-27); notes taken:** the game has no separate "classic" mode (every new class is a copy
  today), so the note always shows; when a class stops being a copy, its `copyOf` is removed and the note goes with
  it. The enhanced classes' `copyOf` never reaches the screen (the pick screen lists base classes only); it feeds the
  validation and the balance test. `PartyCreationScene.ts` is at 250 lines: the change edits the `updatePreview` call
  line in place (line-neutral). `validateClassCopies` lives in a new `src/core/schemaValidationClasses.ts` (under
  250), so `schemaValidation.ts` gains only the one `copyOf` string check. A `tests/core/DataLoader.test.ts` case
  pins that `loadClasses` runs the cross-check (an unknown `copyOf` is refused), and `crossFileValidation.test.ts`
  checks every `copyOf` names a class. The longest note, "Plays as: Black Wizard" for a future upgraded pick, is 22
  characters; "Plays as: White Mage" (20) fits the 600 px panel at the 24 px font.

### 17.1 Arquebusier / rifleman result (2026-11-27, branch class-copynote, second commit)

User (verbatim): "another new class, this time the 'arquebusier' and the 'rifleman' - these should be copies of the
thief for now". Exact copies of thief -> ninja with `copyOf: thief` / `ninja`: `arquebusier` (ARQ, default name
ARQB) -> `rifleman` (RFL). On page 3 (12 rows, 2880 x 1920; 2176 px left, 13 more rows). Field alias thief / ninja
(temporary); walk-sheet pack entries (the gun slung on the back). `fx_colours` (A6): the muzzle flashes (and the
rifleman's tracer); the arquebusier's flash gold is its doublet trim too (a 1 px trim seam in atk_wind1, the art test
allows ready + 1). Image review: round 1 ITERATE (see-through slits between the gun arm and the body in both atk_mid:
atk_mid is the attack key 1 px back, no arm rotation); round 2 rifleman **APPROVE**, arquebusier ITERATE (a slit down
the raised forearm in cast_release: cast_release is the cast key, cast_rise drops the hand 2 px evenly); round 3
arquebusier **APPROVE** (2 px pinholes left in cast_rise, minor).

## 18. Amendment A7 (shieldmaiden / valkyrie): an airborne key pose

User: the shieldmaiden / valkyrie, copies of the warrior / knight. The valkyrie's ATTACK is an airborne diving thrust:
its lowest opaque row is 73, not the feet row 76 (every other cell of the sheet is on 76). It is kept airborne as
drawn. The importer refuses it today: `hero_user_grid.cut` raises "feet on row 73, need 76" for every cell whose body's
lowest row is not the feet row.

- **Data:** a recipe key `airborne: {<class>/<pose>: <lowest row>}` in `gen/hero_user.yaml`, like `allow_outside`:
  `shieldmaiden_valkyrie` gets `airborne: {valkyrie/attack: 73}`. The value is the cell's measured lowest opaque row,
  recorded exactly.
- **Importer (`hero_user_grid.cut`):** for a listed cell the feet gate checks the lowest body row equals the recorded
  value instead of the feet row. Refused (SystemExit naming the cell): a key whose class is not one of the recipe's
  rows or whose pose is not one of the 7 columns; a value that is not an integer in [0, foot row); a listed cell whose
  lowest row differs from the value (the render changed). Every unlisted cell keeps the feet-row gate. The cell is
  copied as drawn, in its 80 x 80 cell: nothing is shifted or re-anchored, since the atlas, the battle layout
  (`partySpritePosition`: the class's `footRow`) and the lunge place a hero by its cell, never by a frame's lowest
  pixel. So the dive is drawn 3 px above the ground, and atk_mid / atk_follow (from the attack key) stay airborne.
  The kneel bridge and its checks use ready and the kneel key only (both on 76).
- **Recorded:** the class's `battle.json` gains `airborne: {attack: 73}` (only when the recipe lists the class), so
  the importer's metas check and the art test read it.
- **Scope:** recipes without the key import exactly as today (every committed `battle.json` and atlas byte-identical
  but the new classes'; the byte gate of plan 16 against mainline 9b07bab7 and page 3's existing rows).
- **Tests:**
  - `selftest_hero_user.py`: a synthetic sheet with one cell lifted 3 px is refused without the key and accepted with
    `airborne: {<c>/attack: 73}`; refused with an unknown class, an unknown pose, a value of 76 or more or not an
    integer, and a wrong value (74); an unlisted lifted cell is still refused.
  - `tests/rendering/shieldmaidenArt.test.ts`: every key cell's lowest row is 76 but the valkyrie's attack at 73
    (from `battle.json` `airborne`); the valkyrie's atk_mid and atk_follow are airborne too (lowest row < 76), her
    atk_wind1 / atk_wind2 / idle_b are on 76.
  - The browser check shows the dive in battle (screenshot to `~/temp/ff-game/class_pack/shieldmaiden/`).
- **Momus OKAY 4/5 (2026-11-27); notes taken:** `ready` and `kneel` cannot be airborne (refused: the in-betweens of
  ready and the kneel bridge rely on them standing on the feet row). The value is an `int` (a YAML bool refused) in
  [0, the row's own foot row), measured on the body rows (as the gate measures, props excluded). `hero_user.check`
  compares the battle json's `airborne` with the recipe's (missing / stale fails), and only `battle.json` gets the
  field (not the shared base, so `battle_kneel.json` is unchanged). The atk_mid / atk_follow rows are measured after
  the build and recorded in the art test (if one lands on 76 the test pins 76; an `alias_frames` entry would be
  recorded the same way). The byte gate's base is the branch's previous commit (the arquebusier's): the main / -1 /
  -2 pages byte-equal and page 3's 12 rows already there byte-equal.

### 18.1 Shieldmaiden / valkyrie result (2026-11-27, branch class-copynote, third commit)

User (verbatim): "I've copied in another class, this time the 'Shieldmaiden' and 'vakyrie' classes - copies of the
fighter / knight." Exact copies of warrior -> knight with `copyOf`: `shieldmaiden` (SHD, default name MAIDN) ->
`valkyrie` (VAL). On page 3 (14 rows, 2880 x 2240; 1856 px left, 11 more rows). Field alias warrior / knight
(temporary); walk-sheet pack entries (the spear upright, the round shield on the arm, the valkyrie's wings folded
within 46 px). A7: the recipe's `airborne: {valkyrie/attack: 73}`; the valkyrie's battle.json records it; her attack
key, atk_mid and atk_follow end on row 73 (measured, pinned in shieldmaidenArt.test.ts); in battle the dive is drawn as
rendered (screenshot `~/temp/ff-game/class_pack/shieldmaiden/after/battle_valkyrie_dive.png`). No `fx_colours` (no
light un-inked edges). Image review: round 1 ITERATE (the shieldmaiden's atk_wind2 broke the spear shaft below the
hand: the raise is halved; the valkyrie's breath and gathers dragged the wing outline: her in-betweens are her keys,
held or shifted whole); round 2 **APPROVE** both.

### 18.2 Bard / virtuoso result (2026-11-27, branch class-copynote, fourth commit)

User (verbatim): "let's add another class - the 'bard' / 'virtuoso'. For now have them be a red mage copy". Exact
copies of red_mage -> red_wizard with `copyOf`: `bard` (BRD, default name BARD) -> `virtuoso` (VIR). No clash (no NPC
sheet or sprite of either name; the debug sandbox's unknown-id example used `bard` and now uses `no_such_class`). On
page 3 (16 rows, 2880 x 2560; 1536 px left, 9 more rows). Field alias red_mage / red_wizard (temporary); walk-sheet
pack entries (the lute slung on the back, the harp at the side; the virtuoso's stand-in is the knight). The 21st base
class overflowed the 800 px class window: the menu shows `CLASS_ROWS` = 20 rows and scrolls. `fx_colours`: the pink
notes and arcs. The instrument is held across the body by both hands, so the in-betweens are the keys held or
shifted whole. Image review: round 1 ITERATE (the head bob tore the scarf / the harp rail; a held key gained outline
specks) -> `alias_frames` for the frames that show their key (bard idle_b, cast_gather, cast_rise, cast_release;
virtuoso idle_b, cast_gather); round 2 **APPROVE** both (note: no idle breath).

### 18.3 Fencer / duelist result (2026-11-27, branch class-copynote, fifth commit)

User (verbatim): "next queue fencer / duelist - a copy of thief / ninja". Exact copies of thief -> ninja with
`copyOf`: `fencer` (FEN, default name FENC) -> `duelist` (DUE). On page 3 (18 rows, 2880 x 2880; 1216 px left, 7 more
rows). Field alias thief / ninja (temporary); walk-sheet pack entries (the rapier sheathed at the hip, the duelist's
parrying dagger at the other hip). The rapier blades are 1 px pale lines without ink, broken into segments in places:
`fx_colours` for the blade and glint colours (so the kneel bridge's reink leaves them), and every battle in-between
shows its key exactly (`alias_frames`: all eight; a shifted or re-rendered key gained 3-14 outline specks at the hair
and hilt tips), the fallback the coordinator allowed for the thin blades. The atlas records `inbetweens: false` for
both (the overflow-page test now reads it from the rig). Image review: round 1 **APPROVE** both (the kneel bridge keeps
the blades straight, unbroken and un-inked).

### 18.4 Apothecary / plague doctor result (2026-11-27, branch class-copynote, sixth commit)

User (verbatim): "I've also queued up the 'apothecary' / 'plague doctor' character class - add as a replica of the
red mage / red wizard". Exact copies of red_mage -> red_wizard with `copyOf`: `apothecary` (APO, default name APOTH)
-> `plague_doctor` (PLG). On page 3 (20 rows, 2880 x 3200; 896 px left, 5 more rows). Field alias red_mage /
red_wizard (temporary); walk-sheet pack entries (the satchel and vials at the belt; the plague doctor's cane in hand).
The in-betweens are the keys held or shifted whole; `alias_frames` for the frames whose re-render gained 1-23 outline
specks (the plague doctor all eight); `fx_colours` for the sparkles, the lantern glow and the miasma wisp's olive.
Image review: round 1 apothecary **APPROVE**, plague doctor ITERATE (the kneel bridge re-inked the wisp's olive tip:
the olive added to `fx_colours`); round 2 plague doctor **APPROVE**.
