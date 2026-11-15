/**
 * Pass F file-size ceilings (docs/FEEDBACK_PLAN_2026-11-14.md, "File-size ceilings"; F0 tests): the monitored battle
 * files stay under their ceilings, and F0's new source files under 250 lines.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const lines = (path: string): number => readFileSync(path, 'utf-8').split('\n').length - 1;

const CEILINGS: [string, number][] = [
  ['src/scenes/BattleScene.ts', 594],
  ['src/battle/BattleStateMachine.ts', 592],
  ['src/scenes/battle/BattleAnimationController.ts', 308],
  ['src/scenes/battle/BattleDisplayManager.ts', 249],
  ['src/scenes/battle/EnemyPoseController.ts', 249],
];

const NEW_FILES = [
  'src/core/Settings.ts', 'src/core/schemaValidationFx.ts', 'src/types/fxData.ts',
  'src/scenes/battle/battleTiming.ts', 'src/scenes/battle/BattleLayers.ts', 'src/scenes/battle/BattleEnemyList.ts',
  'src/scenes/battle/actorTint.ts', 'src/scenes/battle/battleDevClock.ts', 'src/scenes/battle/presentedState.ts',
  'src/scenes/battle/fx/index.ts', 'src/scenes/ConfigScene.ts', 'src/scenes/debugSandbox/DebugSandboxScene.ts',
];

describe('file-size ceilings', () => {
  it.each(CEILINGS)('%s has at most %i lines', (path, max) => {
    expect(lines(path)).toBeLessThanOrEqual(max);
  });

  it.each(NEW_FILES)('%s is under 250 lines', (path) => {
    expect(lines(path)).toBeLessThan(250);
  });

  it('the dev clock stays under 80 lines', () => {
    expect(lines('src/scenes/battle/battleDevClock.ts')).toBeLessThan(80);
  });
});
