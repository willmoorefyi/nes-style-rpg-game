/**
 * CHAOS_FIX_PLAN C6-12b (D-C7-18), 5.2b: the debug scenario key `enemyHp: {<index>: <fraction>}` starts an enemy at
 * `ceil(fraction * stats.hp)`, a fraction of its own pool, so the presets hold at any pool (20000 since C7 TS-BAL,
 * U-3; 6000 before). Each preset sits just above the next floor: `chaos_interlude_1` F1 at 0.705 (floor 0.70), `_2` F2 at 0.405
 * (0.40), `_3` F3 at 0.155 (the crack plays at the first round start, then 0.15), `chaos_final` F3 at 0.26 (one hit to
 * the crack floor 0.25). Validated like `enemyStatus`: an unknown index or a fraction outside (0, 1] logs
 * `console.error` and is dropped.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { DebugScenarioLoader, enemyHpOf, type DebugScenario } from '../../src/systems/DebugScenarioLoader.js';
import { BattleTrigger } from '../../src/systems/BattleTrigger.js';
import { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import { formChain } from '../../src/battle/bossForms.js';
import { EventBus } from '../../src/core/EventBus.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import type { Game } from '../../src/core/Game.js';
import type { EnemyData } from '../../src/types/index.js';
import { Character } from '../../src/entities/Character.js';
import { testClass } from '../helpers/testUtils.js';

const SCENARIOS = parse(readFileSync('assets/data/debug-scenarios.yaml', 'utf-8')) as DebugScenario[];
const ENEMIES = parse(readFileSync('assets/data/enemies.yaml', 'utf-8')) as EnemyData[];
const scenario = (id: string): DebugScenario => SCENARIOS.find((s) => s.id === id)!;
const record = (id: string): EnemyData => ENEMIES.find((e) => e.id === id)!;

const PRESETS: Array<[string, number]> = [
  ['chaos_interlude_1', 0.705], ['chaos_interlude_2', 0.405], ['chaos_interlude_3', 0.155], ['chaos_final', 0.26],
];

afterEach(() => { vi.restoreAllMocks(); });

describe('enemyHp presets (C6-12b)', () => {
  it.each(PRESETS)('%s starts its enemy at ceil(%s * its own pool)', (id, fraction) => {
    const s = scenario(id);
    expect(enemyHpOf(s)).toEqual({ 0: fraction });
    const root = record(s.enemies[0]);
    const bsm = new BattleStateMachine({ party: [new Character({ name: 'H', classData: testClass() })], enemies: [root],
      forms: formChain([root], ENEMIES), enemyHp: enemyHpOf(s) });
    expect(bsm.allEnemies[0].currentHp).toBe(Math.ceil(fraction * root.stats.hp));
  });

  it('each preset sits just above the gated floor it is meant for, at its own pool', () => {
    // _3 sits under the crack (0.25, which plays at the first round start) and just above the F4 floor (0.15)
    const meant: Record<string, number> = { chaos_interlude_1: 0.70, chaos_interlude_2: 0.40, chaos_interlude_3: 0.15, chaos_final: 0.25 };
    for (const [id, fraction] of PRESETS) {
      const root = record(scenario(id).enemies[0]);
      const gated = (root.bossPhases ?? []).filter((p) => p.form || p.interlude).map((p) => p.hpThreshold);
      expect(gated, id).toContain(meant[id]);
      const start = Math.ceil(fraction * root.stats.hp);
      expect(start, id).toBeGreaterThan(Math.ceil(meant[id] * root.stats.hp));
      expect(start, id).toBeLessThanOrEqual(Math.ceil((meant[id] + 0.01) * root.stats.hp));
    }
  });

  it('a fraction outside (0, 1] or an unknown index logs an error and is dropped', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = { id: 'x', enemies: ['chaos'], enemyHp: { 0: 1.2, 1: 0.5, 2: 0 } } as Pick<DebugScenario, 'id' | 'enemies' | 'enemyHp'>;
    expect(enemyHpOf(s)).toBeUndefined();
    expect(err).toHaveBeenCalledTimes(3);
    expect(enemyHpOf({ id: 'y', enemies: ['chaos', 'goblin'], enemyHp: { 1: 0.5, 0: 1 } })).toEqual({ 0: 1, 1: 0.5 });
    expect(enemyHpOf({ id: 'z', enemies: ['chaos'] })).toBeUndefined();
  });

  it('the loader passes the presets to the battle trigger', async () => {
    const trigger = vi.spyOn(BattleTrigger.prototype, 'triggerBattle').mockResolvedValue(undefined);
    const game = {
      party: { all: [] as unknown[], add: vi.fn(() => true), setGold: vi.fn(), distributeXp: vi.fn(), addGold: vi.fn() },
      inventory: { clear: vi.fn(), add: vi.fn() }, scenes: { switchTo: vi.fn(), pop: vi.fn(), push: vi.fn() },
      events: new EventBus(), gameFlags: new GameFlags(), resetState: vi.fn(), battleRetry: null, currentMapId: '',
      playerPosition: { x: 0, y: 0 },
    };
    await new DebugScenarioLoader(game as unknown as Game).run({ ...scenario('chaos_interlude_2'), party: [] });
    expect(trigger.mock.calls[0][5]).toEqual({ enemyHp: { 0: 0.405 } });
  });
});
