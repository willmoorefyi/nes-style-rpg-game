# Momus Review — Remediation Plan v1

| Field | Detail |
|-------|--------|
| **Reviewer** | Momus (Plan Review Agent) |
| **Date** | 2026-03-22 |
| **Plan Reviewed** | remediation-plan-v1.md |
| **Verdict** | **OKAY ⭐⭐⭐⭐** |

---

## VERDICT: OKAY ⭐⭐⭐⭐

### Summary

A strong, well-structured remediation plan that covers all 24 audit issues with clear traceability, accurate file references, and mostly concrete acceptance criteria. Several line number inaccuracies and a few gaps in implementation guidance prevent a ⭐⭐⭐⭐⭐ rating, but nothing blocks execution.

---

## Core Criteria Scoring

| Criterion | Score | Notes |
|-----------|-------|-------|
| CLARITY | ✅ Pass | Specific file paths, code snippets, patterns to follow |
| VERIFICATION | ✅ Pass (minor gaps) | Most WPs have concrete acceptance criteria; a few are soft |
| CONTEXT COMPLETENESS | ⚠️ Partial | Some line numbers wrong, a few missing details |
| BIG PICTURE | ✅ Pass | Clear purpose, logical flow, parallelization guide |

---

## Strengths

1. **Full traceability**: Every one of the 24 audit issues maps to a WP. The traceability matrix is excellent.
2. **Accurate code snippets**: The plan includes actual code from the codebase (e.g., the silent catch block, the wrapText duplication) and the proposed replacements are correct.
3. **Dependency graph is sound**: The critical path (WP-01 → WP-04 → WP-08) and parallel tracks are correctly identified.
4. **Concrete acceptance criteria**: Most WPs have grep-verifiable or command-verifiable criteria (e.g., "grep -r 'catch.*{.*}' returns zero matches").
5. **Test requirements are specific**: Test cases are enumerated, not hand-waved. WP-09 is particularly thorough.
6. **Design alignment**: The plan respects the data-driven, extensible architecture from the design doc. WP-12's interface-only stubs are the right call.
7. **Effort estimates are reasonable**: The 37-52 hour range is credible for the scope.

---

## Issues Found

### CRITICAL Issues (0)

None. No blocking issues found.

### MAJOR Issues (5)

#### M1. [WP-02] Line number references are wrong

- **What's wrong**: Plan says `loadEnemyData` is at "lines 198-211" and the silent catch is at "line 211". Actual: `loadEnemyData` starts at line 202, the catch is at line 211. The method signature is at 202, not 198. The plan also says `errorDisplay` is at "line 35" (correct) and "line 48" (actual: line 54 for `uiContainer.addChild`).
- **Impact**: Developer following the plan may look at wrong lines and waste time.
- **Fix**: Update line references: `loadEnemyData` method at lines 202-215, silent catch at line 211, errorDisplay wired at line 54.

#### M2. [WP-05] TextRenderer wrapText line numbers are wrong

- **What's wrong**: Plan says `wrapText` in TextRenderer is at "lines 52-67". Actual: lines 70-84. Plan says DialogBox `wrapText` is at "lines 79-94". Actual: lines 81-95.
- **Impact**: Same as M1 — developer confusion.
- **Fix**: Update to actual line numbers: TextRenderer wrapText at lines 70-84, DialogBox wrapText at lines 81-95.

#### M3. [WP-05] TextRenderer refactoring guidance is incomplete

- **What's wrong**: The plan says to change `this.wrapText(text)` to `wrapText(text, Math.floor(this.config.width / this.config.charWidth!))`. But looking at the actual TextRenderer code, the private `wrapText` method already computes `maxChars` internally using the same formula. The plan correctly identifies this but doesn't mention that the `setText` call site (line 37) currently calls `this.wrapText(text)` with no maxChars arg — the private method reads config internally. The refactored call needs to pass the computed maxChars explicitly. This is correct in the plan but could be clearer about WHY the signature changes.
- **Impact**: Minor confusion about the refactoring mechanics.
- **Fix**: Add a note: "The private wrapText() currently reads `this.config` internally. The shared version takes `maxChars` as an explicit parameter, so callers must compute and pass it."

#### M4. [WP-11] ExplorationScene line count claim is inaccurate

- **What's wrong**: Plan says ExplorationScene is "220+ lines". Actual: 237 lines. This is minor, but the acceptance criterion says "ExplorationScene is ≤150 lines after decomposition." Given the plan extracts ~115 lines (50 from MapLoader + 25 from DialogManager + 40 from BattleTrigger), the remaining scene would be ~122 lines. This is tight but achievable. However, the plan doesn't account for the import statements that will be ADDED (3 new imports for MapLoader, DialogManager, BattleTrigger) and the constructor wiring code.
- **Impact**: The 150-line target may be barely achievable or slightly exceeded.
- **Fix**: Either relax the target to ≤160 lines, or identify additional extraction candidates (e.g., `executeTransition` could move to MapLoader).

#### M5. [WP-11] BattleScene decoupling guidance conflicts with actual code

- **What's wrong**: The plan says "Remove the direct `game.scenes.switchTo()` if any exists in BattleScene (checking: it doesn't — it uses `game.events.emit('battleEnd', ...)` which is correct)." This is accurate — BattleScene does use `game.events.emit('battleEnd', ...)` in `endBattle()`. However, the plan proposes changing the constructor to accept `BattleSceneDeps { input, events }` but doesn't address that BattleScene is 297 lines with `this.game.input` referenced in 4 places and `this.game.events` in 1 place. The plan should enumerate these call sites.
- **Impact**: Developer must grep for all `this.game.` references themselves.
- **Fix**: Add: "Replace `this.game.input` at lines ~143, ~155, ~163, ~175 (in update switch cases) and `this.game.events` at line ~262 (in endBattle). Total: 5 replacements."

---

### MINOR Issues (8)

#### m1. [WP-01] No guidance on what happens to `enter()` state for hidden scenes

- **What's wrong**: The plan says `push()` hides the current scene's container but does NOT call `exit()`. And `pop()` restores visibility but does NOT call `enter()`. This is correct design. But what about scene state that depends on being "active"? For example, ExplorationScene's `encounterSystem.start()` is called in `enter()` — if exploration is pushed-over (not exited), the encounter system's event listener remains active. The plan doesn't address whether this is desired behavior.
- **Suggestion**: Add a note: "When a scene is pushed over, its event listeners remain active. ExplorationScene.encounterSystem should be paused (stop/start) in push/pop hooks, or the scene should implement optional `onPause()`/`onResume()` methods."

#### m2. [WP-01] Missing guidance on `update()` behavior for stacked scenes

- **What's wrong**: The plan's test requirements say "Test `update()` only updates the top-of-stack scene" but the implementation details don't explicitly say to modify `update()`. The current `update()` calls `this.currentScene?.update(dt)` which would naturally only update the top scene IF `currentScene` is updated by push/pop. This works implicitly, but should be stated explicitly.
- **Suggestion**: Add to implementation details: "No change needed to `update()` — it already delegates to `currentScene`, which push/pop maintain as the top-of-stack scene."

#### m3. [WP-03] Doesn't verify downstream imports exist

- **What's wrong**: The plan includes a grep command to check for downstream imports of EquipmentSlot from Character.ts, which is good. But it doesn't note the result. I checked: no other file imports EquipmentSlot from Character.ts — Character.ts uses its own local type, and types/index.ts has the canonical one. The only consumer is Character.ts itself.
- **Suggestion**: Add: "Verified: no other files import EquipmentSlot from Character.ts. Only Character.ts itself needs updating."

#### m4. [WP-04] Cursor wrap-around behavior with scrolling is underspecified

- **What's wrong**: The acceptance criteria say "Cursor wraps around (top ↔ bottom) and scroll resets appropriately" but the implementation details don't specify the exact wrap behavior. When at item 0 and pressing up, should it jump to the last item AND scroll the window to show it? This is a UX decision that should be explicit.
- **Suggestion**: Add: "Wrap-around: pressing up at index 0 jumps to index `items.length - 1` and sets `scrollOffset = Math.max(0, items.length - maxVisible)`. Pressing down at last index jumps to 0 and sets `scrollOffset = 0`."

#### m5. [WP-06] Schema validator for EnemyData is missing `sprite` field check

- **What's wrong**: The example validator checks `id`, `name`, `stats.*`, `xpReward`, `goldReward` but not `sprite` (which is a required field on the `EnemyData` interface in types/index.ts).
- **Suggestion**: Add `if (typeof d.sprite !== 'string') errors.push('Missing or invalid "sprite" (string)');` to the validator example.

#### m6. [WP-07] No guidance on ItemData `stats` field structure for consumables

- **What's wrong**: The plan says to create items.json with consumables (Potion, Hi-Potion, etc.) conforming to `ItemData`. But `ItemData.stats` is `Partial<StatBlock> & { attack?: number; defense?: number }` — what should a consumable's stats be? Empty object `{}`? The plan doesn't specify.
- **Suggestion**: Add: "Consumables should have `stats: {}` (empty object). The healing/effect is determined by the `type: 'consumable'` field and a future effect system, not by stats."

#### m7. [WP-08] Inventory.add() stores full ItemData objects — memory concern not addressed

- **What's wrong**: The Inventory stores `ItemData` objects directly. If the same item is added from different sources (shop purchase vs chest), they'd need to be the same object reference or the Map key (item.id) handles deduplication. The plan's implementation uses `item.id` as the Map key, which is correct. But the stored `ItemData` reference comes from the first `add()` call — subsequent adds with the same ID but potentially different ItemData objects would keep the original. This is fine but worth noting.
- **Suggestion**: Add a note: "The first ItemData object stored for a given ID is retained. Subsequent adds with the same ID only increment quantity. This assumes ItemData is immutable and consistent across sources."

#### m8. [WP-09] `createMockGame` still uses `as unknown as` for sub-fields

- **What's wrong**: The plan's improved `createMockGame` types each field as `Game['fieldName']` but still uses `as unknown as Game['scenes']` etc. for each sub-object. This is better than the current `as unknown as Game` but still has the same fundamental issue — if `SceneManager` adds a required method, the mock won't fail to compile because of the `as unknown as` cast.
- **Suggestion**: Acknowledge this is an incremental improvement, not a full fix. A complete fix would require creating proper mock classes that implement the interfaces. Consider adding a TODO for that.

---

## File Reference Verification

| File Referenced | Exists? | Content Matches Plan? |
|----------------|---------|----------------------|
| `src/core/SceneManager.ts` | ✅ | ✅ Methods match (register, switchTo, update only — no push/pop) |
| `src/scenes/StatusScene.ts` | ✅ | ✅ Line 39 calls `this.game.scenes.pop()` — confirmed crash |
| `src/scenes/ExplorationScene.ts` | ✅ | ⚠️ Line numbers off by ~4-6 lines (see M1) |
| `src/entities/Character.ts` | ✅ | ✅ Line 3 has duplicate EquipmentSlot — confirmed |
| `src/types/index.ts` | ✅ | ✅ Line 108 has canonical EquipmentSlot — confirmed |
| `src/ui/Menu.ts` | ✅ | ✅ No scrolling support — confirmed |
| `src/ui/TextRenderer.ts` | ✅ | ⚠️ wrapText at line 70, not 52 (see M2) |
| `src/ui/DialogBox.ts` | ✅ | ⚠️ wrapText at line 81, not 79 (see M2) |
| `src/systems/EncounterSystem.ts` | ✅ | ✅ Math.random() at line 50 in resetCounter — confirmed |
| `src/systems/EncounterTable.ts` | ✅ | ✅ Math.random() at line 12 in selectEnemies — confirmed |
| `src/rendering/TilemapRenderer.ts` | ✅ | ✅ No dirty flag — confirmed |
| `src/scenes/BootScene.ts` | ✅ | ✅ Dead code, imported in main.ts — confirmed |
| `src/scenes/BattleScene.ts` | ✅ | ✅ Takes Game in constructor, 297 lines — confirmed |
| `src/battle/BattleCommands.ts` | ✅ | ✅ retargetIfDead and calculateRunChance are pure functions — confirmed |
| `src/core/Game.ts` | ✅ | ✅ No `inventory` field yet — confirmed |
| `tests/core/InputManager.test.ts` | ✅ | ✅ 5 occurrences of `as unknown as` — confirmed |
| `tests/scenes/ExplorationScene.test.ts` | ✅ | ✅ `as unknown as Game` — confirmed |

**All 17 file references verified. 3 have minor line number discrepancies. Zero missing files.**

---

## Dependency Ordering Assessment

The dependency graph is **correct and well-reasoned**. Specific validations:

1. **WP-01 before WP-09**: Correct. SceneManager.push/pop must exist before StatusScene can be tested.
2. **WP-06 before WP-07**: Correct. Schema validation should exist before creating data files, so they're validated on creation.
3. **WP-07 before WP-08**: Correct. Items.json needed for inventory test data.
4. **WP-09 before WP-11**: Correct. Tests must exist as a safety net before refactoring.

**One hidden dependency not called out**: WP-08 (Inventory) adds a field to Game.ts. WP-09 (Test Remediation) creates `createMockGame()` which must include the `inventory` field. If WP-09 starts before WP-08 is merged, the mock will be incomplete. The plan's execution order handles this (WP-08 at step 4, WP-09 at step 5), but the dependency should be explicit in the graph.

---

## Effort Estimate Assessment

| WP | Plan Estimate | My Assessment | Notes |
|----|---------------|---------------|-------|
| WP-01 | 3-5 hrs | 3-4 hrs | Straightforward; good code examples |
| WP-02 | 1-2 hrs | 30 min-1 hr | It's a 3-line change. Overestimated. |
| WP-03 | 30 min | 15-30 min | Accurate |
| WP-04 | 4-6 hrs | 4-6 hrs | Accurate; scrolling logic is fiddly |
| WP-05 | 1-2 hrs | 1-1.5 hrs | Accurate |
| WP-06 | 3-4 hrs | 3-5 hrs | Could be more if validators are thorough |
| WP-07 | 3-4 hrs | 2-3 hrs | Mostly data entry; overestimated |
| WP-08 | 3-5 hrs | 2-3 hrs | Clean implementation provided; mostly copy-paste |
| WP-09 | 6-8 hrs | 7-10 hrs | Underestimated. 25-30 new tests across 5 files is significant. Battle flow integration tests are complex. |
| WP-10 | 2-3 hrs | 1.5-2 hrs | Simple deletions and a dirty flag |
| WP-11 | 8-10 hrs | 10-14 hrs | Underestimated. Decomposing a 237-line god object while maintaining all tests is the hardest WP. |
| WP-12 | 2-3 hrs | 1-1.5 hrs | Interface-only files; overestimated |

**Total plan estimate**: 37-52 hrs
**My estimate**: 36-55 hrs
**Assessment**: Range is reasonable. WP-09 and WP-11 are the risk items — they could blow past estimates if test mocking gets complicated or if the decomposition reveals hidden coupling.

---

## Risk Assessment

The plan identifies no explicit risks. Here are the ones it should:

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| WP-11 decomposition breaks ExplorationScene tests | HIGH | MEDIUM | Run tests after each extraction, not just at the end |
| WP-04 scroll behavior edge cases (empty menu, 1 item, maxVisible > items.length) | MEDIUM | LOW | Add edge case tests explicitly |
| WP-09 InputManager test rewrite may reveal bugs in InputManager itself | LOW | MEDIUM | If attach()/detach() don't work in Vitest's jsdom, need workaround |
| WP-01 scene stack + WP-11 BattleScene decoupling may conflict | MEDIUM | MEDIUM | BattleTrigger (WP-11) calls `game.scenes.register` + `switchTo` — needs to work with new stack |
| WP-07 data files may not match TypeScript interfaces exactly | LOW | LOW | WP-06 validators will catch this |

---

## Design Alignment Assessment

The plan aligns well with the design document's principles:

1. **Data-driven**: WP-06 (schema validation) and WP-07 (data files) strengthen the data-driven architecture. ✅
2. **Extensible**: WP-12 (future abstractions) defines interfaces for Phases 11, 14, 15 without premature implementation. ✅
3. **FF1-faithful**: WP-08 (Inventory) with quantity tracking matches FF1's item system. WP-04 (scrolling) is needed for spell/shop menus. ✅
4. **No over-engineering**: WP-12 is interface-only. WP-10 defers bitmap font to Phase 18. ✅

**One concern**: The plan's WP-07 says to use "reasonable starting values" for class stats since the design doc defers to playtesting. This is fine, but the plan should note that these values are PLACEHOLDER and will need a tuning pass. A comment in the JSON files would help.

---

## Gaps / Blind Spots

1. **No rollback strategy**: If WP-11 (the largest WP) goes sideways mid-implementation, there's no guidance on how to revert partially-extracted code. Recommendation: implement WP-11 as 4 sub-PRs (11a, 11b, 11c, 11d) that can be independently reverted.

2. **No mention of `main.ts` changes**: WP-10 deletes BootScene, which is imported and registered in `main.ts` (lines 2 and 19). The plan says "remove any found" but should explicitly call out main.ts.

3. **WP-08 doesn't address `PartyManager` gold**: The plan says "optionally delegate gold to Inventory or keep separate" but doesn't make a decision. This should be decided in the plan, not left to the implementer.

4. **No smoke test for the full game**: After all 12 WPs, there's no integration verification step. Recommendation: add a final verification step: "Start the game (`npm run dev`), walk around, trigger a battle, open status screen, return to exploration — all without crashes."

5. **WP-09 doesn't address the other `as unknown as` patterns**: The plan fixes InputManager and ExplorationScene mocks, but there are also `as unknown as` casts in DataLoader.test.ts (2), TilemapRenderer.test.ts (2), SpriteAnimation.test.ts (1), PlaceholderTextures.test.ts (1), and MapTransition.test.ts (1). These are not addressed. The audit only flagged InputManager and ExplorationScene specifically, so this is technically out of scope — but worth noting.

---

## Final Assessment

| Criterion | Rating |
|-----------|--------|
| Completeness | 24/24 issues covered ✅ |
| Accuracy | Good, with minor line number errors ⚠️ |
| Implementation Guidance | Strong — code snippets, patterns, specific changes ✅ |
| Dependency Ordering | Correct, one hidden dependency not explicit ⚠️ |
| Acceptance Criteria | Mostly concrete and verifiable ✅ |
| Test Requirements | Thorough and specific ✅ |
| Effort Estimates | Reasonable range, WP-09/WP-11 may exceed ⚠️ |
| Risk Assessment | Missing from plan — should be added ⚠️ |
| Design Alignment | Strong ✅ |

**Overall: ⭐⭐⭐⭐ — OKAY, proceed with noted concerns.**

The plan is ready for implementation. The major issues (M1-M5) are all "fix the documentation" items, not "rethink the approach" items. An implementer can work from this plan with high confidence.
