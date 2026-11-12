# AI sprite rollout (after the knight style lock)

Follows `docs/ART_2X_PLAN.md` Phase 5. The approved knight is the locked house style. This plan covers the other
11 classes and the town NPCs at two images per class and one per NPC.

## What is locked

| Item | Where | Guard |
|---|---|---|
| Knight costume prompt, gear, seed 1234, identity refs | `assets-src/gen/characters.yaml` (`locked: true`) | `check_budget` refuses any uncached knight request, even with `--retry` |
| Knight approved sheets + cache entries | `assets-src/gen/approved/knight/`, `assets-src/gen/cache/{fa13beb4,8524f095,e52a5b8f}…` | committed; `selftest.py` re-plans all three and checks the keys still match |
| Geometry, poses, prompt wording | `spec.py`, `generate.py` | same selftest (any drift changes a key and fails) |
| House style | `spec.HOUSE_REFS`: knight `battle.png` / `field.png` | sent with every rollout request, never with the knight's own |

Unlocking the knight (removing `locked: true`) needs the user's approval.

## Requests per character

| Character type | Sheets | Inputs sent to Gemini |
|---|---|---|
| Class | 1. `battle` (3x2, 80x80 cells) | pose guide, style reference, **knight battle sheet** (house style) |
| | 2. `field` (3x3, down/up/left; right = mirror) | pose guide, style reference, **knight field sheet**, **own approved battle sheet** (identity) |
| NPC | `field` only (`sheets: [field]`) | pose guide, style reference, **knight field sheet** |

The guards run in code:

- A class's field request is refused until `approved/<id>/battle.png` exists.
- A battle request for an NPC is refused.
- Robed characters (`robed: true`) get a robe-shaped guide.
- The budget guard is unchanged: `--backend` is required, `--paid`, `--max-paid 1`, ledger, and `--retry` only after approval.

## Order and checkpoints

Each checkpoint is one paid image followed by user review, as before (`--max-paid 1`). The pilots cover the shapes
that differ most from the knight, so problems with the house style show up early.

| # | Checkpoint | Images | Why here |
|---|---|---|---|
| 1 | warrior battle | 1 | Closest to the knight: tests the house-style reference alone |
| 2 | white_mage battle | 1 | First robed guide |
| 3 | black_mage battle | 1 | Shadowed face with glowing eyes, wide hat (silhouette risk) |
| 4 | monk battle | 1 | Bare fists, no weapon, darker skin |
| 5 | warrior field | 1 | First field sheet with house style + own identity |
| 6 | white_mage, black_mage, monk field | 3 | Robed and bare-fisted walk cycles |
| 7 | thief, red_mage (battle, then field) | 4 | Remaining base classes; a full base party is then playable in preview |
| 8 | ninja, master, white_wizard, black_wizard, red_wizard (battle, then field) | 10 | Upgraded classes |
| 9 | NPCs used by maps: villager, merchant, innkeeper, guard, mage, old_man | 6 | Field only |
| 10 | villager_f, king (optional, not yet used by any map) | 2 | Field only |

Totals: 22 class images, 6 NPC images, plus 2 optional, for 28–30 images. Checkpoints 1–5 are one image each.
From checkpoint 6 on, the user may let one checkpoint cover a whole row (`--max-paid N`, reviewed together). Without
that approval the rows run one image at a time.

**Retries:** one retry per sheet, only after the user approves it (`--retry`), and only after an offline fix has been
tried (repixelize, pose or guide tweaks, prompt wording for that character only). Two failed attempts on the same
sheet stop the rollout so the approach can be discussed.

## Per-checkpoint procedure

1. `generate.py <id> --backend gemini --sheets <sheet> --dry-run`. Check the prompt and the `_input*.png` images.
   Exactly 1 paid request should be shown.
2. `generate.py <id> --backend gemini --sheets <sheet> --paid`, then review `out/gemini/<id>/1234/review.png`.
   Check the raw render, in-game 2x, 4x zoom, and the Pixel Remaster size reference.
3. Acceptance, checked side by side with the knight:
   - same figure height (battle 68–76 rows, field 82–92) and feet row
   - outline present and at most 14 colours
   - facing correct (a mirror is acceptable for a wrong-facing side row: `flip_rows`)
   - walk frames visibly differ
   - costume matches the prompt
   - no stray props
4. On approval, copy the sheet, json, raw and prompt into `approved/<id>/`. Commit the cache entry and add its key to
   `.gitignore`'s exceptions. Rebuild with `build_assets.py battle_ai field_ai`.
5. Verify silently in the browser (`?mute=1&art=ai&scenario=…`; add a party scenario for new classes). Close the
   page and stop the dev server afterwards.
6. Run `selftest.py`, `npm run build` and `npm test`, then commit when the user asks.

## Risks specific to the rollout

| Risk | Mitigation |
|---|---|
| Gemini copies the knight's costume from the house-style image | The prompt says "DIFFERENT character, do NOT copy its costume, colours, hair or face"; pilot 1 checks this first |
| Robes hide the legs, so walk frames look identical | The robe guide shows the hem swinging; walk-frame difference is part of acceptance; fallback is a hem-only swing (offline tweak) |
| Shadowed faces (black mage/wizard) lose their eyes in the palette snap | The ink rule keeps saturated colours; check eye pixels in the 4x zoom |
| Third-party style reference (`refs/style_reference.jpg`) is git-ignored | Required to re-plan keys. Kept outside git on purpose; once 3–4 pilots are approved, consider dropping it for later requests (house style alone) |
| NPCs without a battle sheet drift in identity between future sheets | NPCs only ever have one sheet; nothing else needs to match |

## Out of scope

The treasure chest stays a legacy prop until Phase 6, along with monsters, tiles and backdrops. Switching preview
art to default is also out of scope.
