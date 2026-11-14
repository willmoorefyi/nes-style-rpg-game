import { describe, it, expect } from 'vitest';
import { sortByAgility } from '../../src/battle/TurnOrder.js';
import { mulberry32 } from '../helpers/battlePolicies.js';

describe('TurnOrder (B7: key = agility × (1 + rng()))', () => {
  it('should sort by agility descending when the draws are equal', () => {
    const combatants = [
      { id: 'slow', agility: 5, isEnemy: false },
      { id: 'fast', agility: 15, isEnemy: true },
      { id: 'medium', agility: 10, isEnemy: false },
    ];
    const sorted = sortByAgility(combatants, () => 0.5);
    expect(sorted[0].id).toBe('fast');
    expect(sorted[1].id).toBe('medium');
    expect(sorted[2].id).toBe('slow');
  });

  it('calls the RNG exactly once per combatant per call, never inside the comparator', () => {
    for (const n of [1, 2, 5, 9]) {
      let calls = 0;
      const combatants = Array.from({ length: n }, (_, i) => ({ id: `c${i}`, agility: 10, isEnemy: i % 2 === 0 }));
      sortByAgility(combatants, () => { calls++; return 0.37; });
      expect(calls, `n = ${n}`).toBe(n);
    }
  });

  it('agility 5 acts before agility 6 in 20-35 % of 2,000 seeded rounds (old strict sort: 0 %)', () => {
    const rng = mulberry32(2024);
    let first = 0;
    for (let i = 0; i < 2000; i++) {
      const order = sortByAgility([
        { id: 'warrior', agility: 5, isEnemy: false },
        { id: 'goblin', agility: 6, isEnemy: true },
      ], rng);
      if (order[0].id === 'warrior') first++;
    }
    expect(first / 2000).toBeGreaterThanOrEqual(0.2);
    expect(first / 2000).toBeLessThanOrEqual(0.35);
  });

  it('a gap of 2x or more always holds: agility 30 goes before agility 15', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const order = sortByAgility([{ id: 'slow', agility: 15, isEnemy: true }, { id: 'fast', agility: 30, isEnemy: false }], rng);
      expect(order[0].id).toBe('fast');
    }
  });

  it('should not mutate original array', () => {
    const combatants = [
      { id: 'a', agility: 5, isEnemy: false },
      { id: 'b', agility: 10, isEnemy: true },
    ];
    const sorted = sortByAgility(combatants, () => 0.5);
    expect(combatants[0].id).toBe('a');
    expect(sorted[0].id).toBe('b');
  });
});
