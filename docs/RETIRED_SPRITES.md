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
