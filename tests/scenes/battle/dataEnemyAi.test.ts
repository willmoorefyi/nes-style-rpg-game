/** ROSTER_PLAN 7.2 (FW-D): BattleScene.attachEnemyAi reads an enemy's data `ai` when no debug `enemyAi` is given. */
import { describe, it, expect } from 'vitest';
import { BattleScene } from '../../../src/scenes/BattleScene.js';
import { BossAI } from '../../../src/battle/BossAI.js';
import { createMockBattleSceneDeps } from '../../helpers/testUtils.js';
import { SPELLS, enemyCopy, makeParty } from '../../helpers/balanceData.js';

const scene = (enemyAi?: Record<string, { type: 'fight' | 'magic'; spellId?: string; weight: number }[]>) =>
  new BattleScene(createMockBattleSceneDeps(), { party: makeParty(10, 'start', false), enemies: [enemyCopy('lich'), enemyCopy('goblin')],
    spells: SPELLS, rng: () => 0.5, enemyAi });

describe('BattleScene: data-driven enemy ai', () => {
  it('the lich gets its data ai (not a pattern BossAI); the goblin, with no ai, keeps the default Fight', () => {
    const [lich, goblin] = scene().enemyInstances;
    expect(lich.aiBehavior).toBeDefined();
    expect(lich.aiBehavior).not.toBeInstanceOf(BossAI);
    expect(goblin.aiBehavior).toBeUndefined();
  });

  it('a debug enemyAi pattern wins over the data ai', () => {
    const [lich] = scene({ lich: [{ type: 'magic', spellId: 'ice', weight: 1 }] }).enemyInstances;
    expect(lich.aiBehavior).toBeInstanceOf(BossAI);
  });
});
