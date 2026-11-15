/** ROSTER_PLAN 7.2 (FW-D): the schema accepts the roster fields and rejects bad values (strict, like EnemyData). */
import { describe, it, expect } from 'vitest';
import { validateEnemyData } from '../../src/core/schemaValidation.js';
import { enemyCopy } from '../helpers/balanceData.js';

const base = (): Record<string, unknown> => ({ ...enemyCopy('goblin') });
const ok = (extra: Record<string, unknown>): void => { expect(() => validateEnemyData({ ...base(), ...extra })).not.toThrow(); };
const bad = (extra: Record<string, unknown>, msg: RegExp): void => {
  expect(() => validateEnemyData({ ...base(), ...extra })).toThrow(msg);
};

describe('enemy roster fields: schema', () => {
  it('accepts every field with good values, and 0 for rewards and crit (the spec keeps literal 0)', () => {
    ok({ num: 128, tuned: false, description: 'A plain line.', protect: ['status', 'poison_stone', 'death', 'earth', 'time'],
      statusWeak: ['poison_stone'], attackStatus: ['poison', 'stun', 'sleep', 'blind', 'stone', 'death'], spells: ['fir2', 'nuke', 'zap'],
      ai: { rate: 0.75, actions: [{ type: 'magic', spellId: 'fir2', weight: 1 }] }, specials: [{ id: 'gaze', rate: 1 }],
      xpReward: 0, goldReward: 0 });
    const g = enemyCopy('goblin');
    expect(() => validateEnemyData({ ...g, stats: { ...g.stats, crit: 0 } })).not.toThrow();
  });

  it('num: an integer from 1 to 128', () => {
    for (const num of [0, 129, 1.5, '7']) bad({ num }, /num/);
  });

  it('protect / statusWeak / attackStatus: known values, no duplicates', () => {
    bad({ protect: ['sleep'] }, /protect\[0\]/);
    bad({ protect: 'status' }, /protect/);
    bad({ protect: ['status', 'status'] }, /no duplicates/);
    bad({ statusWeak: ['fire'] }, /statusWeak/);
    bad({ attackStatus: ['paralysis'] }, /attackStatus/);
  });

  it('ai: {rate 0..1, actions: [{type: magic, spellId, weight > 0}]}', () => {
    bad({ ai: { rate: 1.5, actions: [{ type: 'magic', spellId: 'fire', weight: 1 }] } }, /ai\.rate/);
    bad({ ai: { rate: 0.5, actions: [] } }, /ai\.actions/);
    bad({ ai: { rate: 0.5, actions: [{ type: 'fight', weight: 1 }] } }, /type/);
    bad({ ai: { rate: 0.5, actions: [{ type: 'magic', spellId: 'fire', weight: 0 }] } }, /weight/);
    bad({ ai: { rate: 0.5, actions: [{ type: 'magic', spellId: 'fire', weight: 1 }], pattern: 'x' } }, /only rate and actions/);
  });

  it('spells are lowercase codes; specials have an id and a rate; description is printable ASCII', () => {
    bad({ spells: ['FIRE'] }, /spells\[0\]/);
    bad({ specials: [{ id: 'gaze' }] }, /specials\[0\]\.rate/);
    bad({ description: 'curly ’ quote' }, /description/);
    bad({ tuned: 'yes' }, /tuned/);
  });

  it('a rematch (rematchOf) is named "<fiend> II"', () => {
    ok({ rematchOf: 'lich', name: 'Rime Sovereign II' });
    bad({ rematchOf: 'lich', name: 'Rime Sovereign 2' }, /II/);
  });

  it('a boss phase may set attackAnim: heavy (and nothing else)', () => {
    ok({ bossPhases: [{ hpThreshold: 0.5, patternId: 'p', attackAnim: 'heavy' }] });
    bad({ bossPhases: [{ hpThreshold: 0.5, patternId: 'p', attackAnim: 'slam' }] }, /attackAnim/);
  });
});
