# Retired sprites

No replaced sprite is thrown away (user, 2026-11-16; `docs/REDESIGN_PLAN.md` 5). Before the first paid request for a
redesigned id, the generator archives its current assets with `assets-src/gen/retire.py <id>` and commits them:

| What | Archive (committed) |
|---|---|
| approved sheets + json | `assets-src/gen/approved/_retired/<id>_vN/*` (byte copies) |
| rig + lock | `assets-src/gen/anim/monsters/_retired/<id>_vN.yaml`, `.lock.json` |
| monsters.yaml entry | `assets-src/gen/retired/monsters_vN.yaml` (verbatim, `id` kept, plus `retired_as: <id>_vN`; not read by the generator) |
| cache keys / raws | the archived json's `cache_key`; `cache/<key>.png` and `.json` are git-tracked (`selftest_retire.py` checks it) |

The archive is never built or checked: every build and gate globs one level deep (`approved/<id>/...`,
`anim/monsters/<id>.*`), and `selftest_retire.py` fails on any recursive glob over those trees.

**Commands** (the generator runs them, in the main checkout):
- `retire.py <id> [--as <id>_vN]`: archive (default `_v1`; a later redesign of the same id uses `_v2`; the boss
  fallback archives the new poses as `<id>_v2_partial`). Idempotent; refuses if a target exists with different bytes.
  Prints this index's row.
- `retire.py --move-rig <id>`: removes the live rig and lock, in the commit that approves the id's first new sheet.
- `retire.py --prune <id> boss_attack boss_cast boss_hurt boss_attack_raise`: removes the old poses, in the commit that
  approves a boss's new `boss_idle`. Both refuse unless byte-identical archive copies exist.
- `approve.py` refuses to overwrite `approved/<id>/monster_*.png` / `boss_*.png` unless a byte-identical copy is archived.
- Colossus forms (`docs/CHAOS_FORMS_PLAN.md` 5.5): `retire.py --colossus <form> [--as <form>_vN]` archives
  `approved/chaos_forms/<form>/*` (master, `meta.json`, variants), `gen/colossus/<form>.yaml` + `.lock.json` and the
  cache files of `meta.json`'s `cache_keys` into `approved/_retired/<form>_vN/` (form ids carry the `chaos_` prefix,
  e.g. `chaos_horizon_v1`); `colossus.py approve` refuses to overwrite a master without a byte-identical archive copy.
  No rows are planned (F1 is kept).

**Reviving a retired sprite as a new enemy:** `python3 -I assets-src/gen/retire.py --revive <id>_vN --as <new_id>`
copies the archive to `approved/<new_id>/` (json `character: <new_id>`, `revived_from: <id>_vN`, `cache_key` kept as
provenance and checked against the committed cache file), the rig (`sprite: <new_id>`) and lock to
`anim/monsters/<new_id>.*`, and the entry to `monsters.yaml` (`id: <new_id>`, `revived_from`). It refuses an id that
already exists. Then: add `<new_id>` to a group in `gen/monster_pages.py`, add the enemy to `assets/data/enemies.yaml`
and the bestiary data, and run `monster_anim.py check <new_id>` (OK with the archived lock) and the `monsters_ai` build.

## Index

One row per retired sprite (the generator adds each row, from the line `retire.py` prints).

| Retired id | Original id | Sheets | Cache keys (R-rows) | Reason | Rig / lock | Revive |
|---|---|---|---|---|---|---|
| `crazy_horse_v1` | `crazy_horse` | monster_large | monster_large `39b9a7e6c503037dd8dbe059` (R82) | pass V redesign (REDESIGN_PLAN 3: an otherworldly horse, distinct from `nightmare`; the piebald wild horse is replaced) | rig + lock (locked) | `retire.py --revive crazy_horse_v1 --as <new_id>` |
| `piscodemon_v1` | `piscodemon` | monster_small | monster_small `a6f48aea1aa31985939c381c` (R60) | pass V redesign (REDESIGN_PLAN 3: a squat young deep-sea psychic horror; the anglerfish demon is replaced) | rig + lock (locked) | `retire.py --revive piscodemon_v1 --as <new_id>` |
| `black_knight_v1` | `black_knight` | monster_small | monster_small `091ec6a36700c923e32b1d8c` (R246) | pass V redesign (REDESIGN_PLAN 3: a terrifying horned knight in jagged plate; the plain, very dark knight is replaced) | rig + lock (locked, T-K) | `retire.py --revive black_knight_v1 --as <new_id>` |
| `guardian_v1` | `guardian` | monster_large | monster_large `0683f05fb008f4c9a7c686a8` (R253, best of 3) | pass V redesign (REDESIGN_PLAN 3: a four-legged hunter-killer war machine; the bronze hound sentinel is replaced) | rig + lock (locked) | `retire.py --revive guardian_v1 --as <new_id>` |
| `vampire_v1` | `vampire` | monster_small | monster_small `fdcaf07fd5789e2d402f4f7d` (act 1, `docs/ACT1_LOG.md`) | pass V redraw (REDESIGN_PLAN 3: the same young noble vampire, clean shapes; the act-1 sheet was pixelated and noisy) | rig + lock (locked; `slash` fx) | `retire.py --revive vampire_v1 --as <new_id>` |
| `hollow_seraph_v1` | `hollow_seraph` | boss_idle, boss_attack, boss_cast, boss_hurt, boss_attack_raise | boss_idle `d0a454c671a5aa6d6415d916` (R25); boss_attack `0cede2c0d74f95ac6c94bb20` (R28); boss_cast `b1755fc7de941893455877e5` (R29/R32); boss_hurt `ae3a5b995c782c9115f90312` (R37); boss_attack_raise `d6093d88bccd3a2763233363` (R38/R41, unused by the rig, FW-R) | pass V redesign (REDESIGN_PLAN 4.1: a steampunk angel of separate hovering plates with four blade-of-light wings; the white-and-gold six-feathered-wing seraph is replaced) | rig + lock (locked; `halo` fx, `raise: false`) | `retire.py --revive hollow_seraph_v1 --as <new_id>` |
| `chaos_v1` | `chaos` | boss_idle, boss_attack, boss_cast, boss_hurt, boss_attack_raise | boss_idle `fb4bd02e837ce1d90e7822d5` (R55); boss_attack `a53174205b082f2dd9915dd2` (R58/R59); boss_cast `d1d7f2cf7f40881cd74bd566` (R67); boss_hurt `b7905062c7067cc80e157701` (R68); boss_attack_raise `4231dfbf8167a1d0e608b9a8` (R70) | pass V redesign (REDESIGN_PLAN 4.2: a robed two-armed overlord with a flame crown and four orbs; the four-armed obsidian titan with shadow-flame wings is replaced) | rig + lock (locked; heavy raise set) | `retire.py --revive chaos_v1 --as <new_id>` |
| `dragon_v1` | `dragon` | monster_large | monster_large `4647a60ad314a1ce2f3b375b` (act 1, `docs/ACT1_LOG.md`) | pass V redesign (orchestrator ruling 2026-11-16: the low, wide red dragon (idle 55 px) cannot read as a size step at the rescale factor 3; redrawn tall and upright) | rig + lock (locked) | `retire.py --revive dragon_v1 --as <new_id>` |
| `crazy_horse_v2` | `crazy_horse` | monster_large | monster_large `8bc875977bdf6a8fbe2280ad` (R290) | V8 regeneration (REDESIGN_FIX_PLAN F1, P1-1: the pass-V ash-grey horse reads as an ordinary grey horse in idle and attack; dim olive cracks, a 2 px eye, no non-equine feature) | rig + lock (locked, V5) | `retire.py --revive crazy_horse_v2 --as <new_id>` |
| `cosmic_beast_v1` | (none: experiment) | single pose (idle-like), not a sheet | Stability AI Stable Image Core on Bedrock us-west-2, seed 4242, 21:9; not in the Gemini ledger (see `meta.json`, `prompt.md`) | kept by the user (2026-11-16) for a future monster: the best render of the chaos Stability experiment, a navy armoured horned beast with orange horns, spines and a spiked tail; raw, background-removed, and pixelized scale-2 / scale-3 sprites | none (not rigged) | needs multi-pose art (attack / hurt) before it can become an enemy; then approve under a new id and rig |
| `piscodemon_v2` | `piscodemon` | monster_small | monster_small `0d4cd6b25d7cad960dbab2b9` (R291) | V8 regeneration (REDESIGN_FIX_PLAN F2, P2-1: not terrifying; the yellow eyes cut to a round pale cream eye that reads sad, a soft low-contrast teal ramp) | rig + lock (locked, V5) | `retire.py --revive piscodemon_v2 --as <new_id>` |
| `hollow_seraph_v2` | `hollow_seraph` | boss_idle, boss_attack, boss_cast, boss_hurt | boss_idle `ea9c18f6205f82d369da51b5` (R309, approved as the R313 re-cut); boss_attack `9930651761e987e3df821a78` (R316); boss_cast `386f2a6c443b7316de22b370` (R318); boss_hurt `af6d027191f2ed6c5f40fe54` (R319) | V8 regeneration (REDESIGN_FIX_PLAN F4, P2-3, user D-U1 = b: the blade wings read as cream swords with hilts and cross-guards, the solid plates do not read hollow) | rig + lock (locked, V5; `halo` fx, `raise: false`) | `retire.py --revive hollow_seraph_v2 --as <new_id>` |
| `chaos_horizon_v1` | `chaos_horizon` (colossus F3) | master.png (900x362 pixel master), glow.png, variant_crack{,_glow,_mask}.png | structure `d95ade61d71a34a63f132b44` (C4), search_replace `1411f3b8f9ac434f8e17c2d6` (C6), remove_bg `2a8b813b7505e5aadf6cfef1` (C7); ROSTER_LOG Pass C - C3 | user ruling D-U10 (2026-11-16): colossus forms are full-resolution painted art; the pixel master (halved, 17 colours, 3x nearest, halo stripped) was rejected as overly pixelated (CHAOS_FORMS_PLAN 18.0) | none (no layer yaml was written) | `retire.py --revive chaos_horizon_v1 --as <id>` |
| `chaos_orrery_v1` | `chaos_orrery` (colossus F2) | master.png (440x300 pixel master) | structure `6ec8982726b6f02c0ba81070` / `29e22d7952891fa1359044d1` (C12/C13), remove_bg `b2cff3e92335d8e1960ca49d` (C16); ROSTER_LOG Pass C - C3 | user ruling D-U10 (2026-11-16): re-made at full resolution from its own full-res finish (CHAOS_FORMS_PLAN 18.2) | none | `retire.py --revive chaos_orrery_v1 --as <id>` |
| `chaos_horizon_v2` | `chaos_horizon` (colossus F3, painted) | master.png (2700x1080 painted body), glow.png, sky_base.png, core_crack.png (the first crack patch, canvas rows ~686-1000) | conservative upscale `506909aa09af9788357c7db5` (C20), inpaint `3f10084baf950ef269124a66` (C23); ROSTER_LOG Pass C - C3' | not a rejection: archived so the crack patch could move up into the visible chest band at F3's lowered rest (-527, -60) (D-U11; the approve gate needs a byte-identical archive); master, glow and sky_base unchanged | none | `retire.py --revive chaos_horizon_v2 --as <id>` |

## Replacements (pass V, integrated at V6)

Every retired id above has its replacement approved, rigged and locked under the same id (`ROSTER_LOG.md` "Pass V");
the archive copies are untouched and never built.

| Retired id | Replacement (approved R-rows) | Rig | Display |
|---|---|---|---|
| `crazy_horse_v1` | an ash-grey otherworldly horse, bone spines, yellow-green cracks (R290) | locked (V5) | scale 2, `large` |
| `piscodemon_v1` | a hunched octopus-headed deep-sea horror, six face tentacles (R291) | locked (V5) | scale 2, small |
| `black_knight_v1` | a horned knight in jagged black plate, red visor, greatsword (R293) | locked (V5) | scale 2, small |
| `guardian_v1` | a four-legged gunmetal war machine, three red eyes, scythe arms (R295) | locked (V5) | scale 2, `large` |
| `vampire_v1` | the young noble vampire redrawn clean, red-lined cape (R296; act-1 page 0) | locked (V5), no fx part | scale 2, small |
| `hollow_seraph_v1` | hovering black-steel and brass plates, clockwork heart, gear halo, four blade wings (idle R313 = R309 re-cut, attack R316, cast R318, hurt R319; no raise, D-V9) | locked (V5), `halo` fx | scale 2, `boss` |
| `chaos_v1` | a two-armed overlord in a star-flecked void robe, flame-crown head, four Fiend orbs (idle R299, attack R300, cast R302, hurt R304, raise R306) | locked (V5) | scale 3, `boss` (D-V6 = C2) |
| `dragon_v1` | the red dragon redrawn tall and upright (R320 = R312 re-cut with `fit: headroom`) | locked (V5) | scale 3, `huge` |

## Replacements (V8 fix round, integrated at W4)

`docs/REDESIGN_FIX_PLAN.md`; the `_v2` archives above hold the pass-V looks they replace, untouched and never built.

| Retired id | Replacement (approved R-rows) | Rig | Display |
|---|---|---|---|
| `crazy_horse_v2` | an otherworldly beast with a bare horse-skull head, ribs through the ash-grey hide, bone spines, bright yellow-green cracks in every pose, smoke-column legs (R321) | locked (V8 W3, ae5a0c1) | scale 2, `large` |
| `piscodemon_v2` | the squat octopus-headed horror in dark sea green, two narrow slanted yellow-orange eyes under a heavy brow (R323) | locked (V8 W3, ff9fab6) | scale 2, small |
| `hollow_seraph_v2` | floating empty brass armour, four hilt-less blade wings of cold light, gear halo and heart (idle R324, attack R326, cast R331 = R328 re-cut with `match_height: idle`; hurt derived from the idle, `hurt_from: idle`, orchestrator ruling b) | locked (V8 W3, ab909d9), `halo` fx, `raise: false` | scale 2, `boss` |

black_knight was not regenerated (the F3 keyframe paint passed IR; no `black_knight_v2`), and chaos keeps its pass-V
art (F5 is the rig's `raise: false`; no archive).

## Kneel archives (pass KA)

`retire_kneel.py` (docs/KNEEL_AI_PLAN.md 5); never built or checked.

| Archive | Id | Content |
|---|---|---|
| `goblin_kneel_v1` | `goblin` | derived kneel (kneel, kneel_b, kneel_in1, kneel_in2), rig + lock |
| `wolf_kneel_v1` | `wolf` | derived kneel (kneel, kneel_b, kneel_in1, kneel_in2), rig + lock |
| `blue_dragon_kneel_v1` | `blue_dragon` | derived kneel (kneel, kneel_b, kneel_in1, kneel_in2), rig + lock |
| `garland_kneel_v1` | `garland` | derived kneel (kneel, kneel_b, kneel_in1, kneel_in2), rig + lock |
| `warrior_kneel_v1` | `warrior` | derived kneel (kneel, kneel_b, kneel_in1, kneel_in2), rig + lock |
| `white_mage_kneel_v1` | `white_mage` | derived kneel (kneel, kneel_b, kneel_in1, kneel_in2), rig + lock |
| `green_dragon_kneel_v1` | `green_dragon` | derived kneel (kneel, kneel_b, kneel_in1, kneel_in2), rig + lock |
