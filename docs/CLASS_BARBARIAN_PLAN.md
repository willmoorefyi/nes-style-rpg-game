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
