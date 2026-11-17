/**
 * CHAOS_FORMS_PLAN 2.2 items 6-7 (R20, D-U8): the battle trigger loads the form records reachable from the formation
 * with the battle, keeps the retry snapshot on the root (Retry restarts from F1), and for the battle's lifetime turns
 * every `battle:formChange` event into the bestiary's `SEEN:<to>` flag; the subscription ends with the battle.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BattleTrigger } from '../../src/systems/BattleTrigger.js';
import { EventBus } from '../../src/core/EventBus.js';
import type { Game } from '../../src/core/Game.js';
import type { EnemyData } from '../../src/types/index.js';
import { createMockGame, testEnemy } from '../helpers/testUtils.js';

const made = vi.hoisted(() => [] as Array<{ enemies: EnemyData[]; forms?: EnemyData[]; canRun?: boolean }>);
vi.mock('../../src/scenes/BattleScene.js', () => ({
  BattleScene: class {
    constructor(_deps: unknown, config: { enemies: EnemyData[]; forms?: EnemyData[]; canRun?: boolean }) { made.push(config); }
  },
}));

const ROOT = testEnemy({ id: 'chaos', bossPhases: [{ hpThreshold: 0.7, patternId: 'p', form: 'chaos_orrery' }] });
const F2 = testEnemy({ id: 'chaos_orrery', formOf: 'chaos', bossPhases: [{ hpThreshold: 0.4, patternId: 'p', form: 'chaos_horizon' }] });
const F3 = testEnemy({ id: 'chaos_horizon', formOf: 'chaos' });

function setup() {
  const base = createMockGame();
  const game = { ...base, currentMapId: 'overworld', events: new EventBus(),
    party: { ...base.party, all: [{ name: 'Hero', currentHp: 100, maxHp: 100 }], toJSON: () => [] } };
  game.data.loadEnemies.mockResolvedValue([ROOT, F2, F3, testEnemy()]);
  return { game, trigger: new BattleTrigger(game as unknown as Game, { ensure: async () => {} }) };
}

describe('BattleTrigger and boss forms', () => {
  beforeEach(() => { made.length = 0; });

  it('passes the reachable form records with the battle; the retry snapshot keeps the root (F1)', async () => {
    const { game, trigger } = setup();
    await trigger.triggerBattle(['chaos']);
    expect(made[0].enemies.map((e) => e.id)).toEqual(['chaos']);
    expect(made[0].forms?.map((e) => e.id)).toEqual(['chaos_orrery', 'chaos_horizon']);
    game.events.emit('battle:formChange', { from: 'chaos', to: 'chaos_orrery' });
    expect((game.battleRetry as { battle: { enemyIds: string[] } } | null)?.battle.enemyIds).toEqual(['chaos']);
  });

  it('battle:formChange sets SEEN:<to>; the subscription is removed at battle end', async () => {
    const { game, trigger } = setup();
    await trigger.triggerBattle(['chaos']);
    expect(game.gameFlags.has('SEEN:chaos')).toBe(true);
    expect(game.gameFlags.has('SEEN:chaos_orrery')).toBe(false);
    game.events.emit('battle:formChange', { from: 'chaos', to: 'chaos_orrery' });
    expect(game.gameFlags.has('SEEN:chaos_orrery')).toBe(true);
    game.events.emit('battleEnd', { victory: false, xpReward: 0, goldReward: 0 });
    game.events.emit('battle:formChange', { from: 'chaos_orrery', to: 'chaos_horizon' });
    expect(game.gameFlags.has('SEEN:chaos_horizon')).toBe(false);
  });

  // CHAOS_FIX_PLAN C6-14 (D-C7-6), 5.2: Run is disabled for a form chain unless its bossConfig says otherwise
  it('canRun: false for a form chain, true for a plain battle; an explicit bossConfig.canRun: true wins', async () => {
    const { trigger } = setup();
    await trigger.triggerBattle(['chaos']);
    await trigger.triggerBattle(['goblin']);
    await trigger.triggerBattle(['chaos'], { canRun: true, isBoss: true });
    expect(made.map((c) => c.canRun)).toEqual([false, true, true]);
  });

  it('a battle with no form phases gets no form records', async () => {
    const { trigger } = setup();
    await trigger.triggerBattle(['goblin']);
    expect(made[0].forms ?? []).toEqual([]);
  });
});
