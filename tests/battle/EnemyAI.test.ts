import { describe, it, expect } from 'vitest';
import { selectTarget, retargetEnemyTarget, FRONT_WEIGHTS } from '../../src/battle/EnemyAI.js';
import { mulberry32 } from '../helpers/testUtils.js';

const four = (alive = [true, true, true, true]) => alive.map((isAlive, i) => ({ id: `party_${i}`, isAlive }));

describe('EnemyAI.selectTarget (FF1 front-slot weights, BA-10)', () => {
  it('weights the slots 4/2/1/1: rolls 0.49, 0.6, 0.8 and 0.95 pick slots 0, 1, 2 and 3', () => {
    expect(FRONT_WEIGHTS).toEqual([4, 2, 1, 1]);
    expect(selectTarget(four(), () => 0.49)?.id).toBe('party_0');
    expect(selectTarget(four(), () => 0.6)?.id).toBe('party_1');
    expect(selectTarget(four(), () => 0.8)?.id).toBe('party_2');
    expect(selectTarget(four(), () => 0.95)?.id).toBe('party_3');
  });

  it('with slot 0 dead the weights are 2/1/1', () => {
    const t = four([false, true, true, true]);
    expect(selectTarget(t, () => 0.49)?.id).toBe('party_1'); // 1.96 < 2
    expect(selectTarget(t, () => 0.51)?.id).toBe('party_2'); // 2.04 in [2, 3)
    expect(selectTarget(t, () => 0.8)?.id).toBe('party_3');  // 3.2
  });

  it('over 10,000 rolls slot 0 is chosen 50 ± 2 % of the time', () => {
    const rng = mulberry32(42);
    let front = 0;
    for (let i = 0; i < 10000; i++) if (selectTarget(four(), rng)?.id === 'party_0') front++;
    expect(front / 10000).toBeGreaterThan(0.48);
    expect(front / 10000).toBeLessThan(0.52);
  });

  it('selects only living targets and returns null when none live', () => {
    expect(selectTarget([{ id: 'a', isAlive: false }, { id: 'b', isAlive: true }], () => 0)?.id).toBe('b');
    expect(selectTarget([{ id: 'a', isAlive: false }], () => 0)).toBeNull();
  });
});

describe('retargetEnemyTarget', () => {
  const slots = ['party_0', 'party_1', 'party_2', 'party_3'];

  it('keeps the original slot weights: with slot 1 dead, slot 0 has 4 of 6', () => {
    const alive = (id: string) => id !== 'party_1';
    expect(retargetEnemyTarget(slots, alive, () => 0.6)).toBe('party_0'); // 3.6 < 4
    expect(retargetEnemyTarget(slots, alive, () => 0.7)).toBe('party_2'); // 4.2 in [4, 5)
    expect(retargetEnemyTarget(slots, alive, () => 0.9)).toBe('party_3');
  });

  it('back-slot survivors keep their own weights, not the front slots’', () => {
    // only slots 2 and 3 alive: 1/1, so 0.49 → slot 2 and 0.51 → slot 3
    const alive = (id: string) => id === 'party_2' || id === 'party_3';
    expect(retargetEnemyTarget(slots, alive, () => 0.49)).toBe('party_2');
    expect(retargetEnemyTarget(slots, alive, () => 0.51)).toBe('party_3');
  });

  it('returns undefined when nobody lives', () => {
    expect(retargetEnemyTarget(slots, () => false, () => 0)).toBeUndefined();
  });
});
