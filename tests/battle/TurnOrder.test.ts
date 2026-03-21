import { describe, it, expect } from 'vitest';
import { sortByAgility } from '../../src/battle/TurnOrder.js';

describe('TurnOrder', () => {
  it('should sort by agility descending', () => {
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

  it('should break ties randomly', () => {
    const combatants = [
      { id: 'a', agility: 10, isEnemy: false },
      { id: 'b', agility: 10, isEnemy: true },
    ];
    // With rng returning 0.3 (< 0.5), a should come first
    const sorted1 = sortByAgility(combatants, () => 0.3);
    // With rng returning 0.7 (> 0.5), b should come first
    const sorted2 = sortByAgility(combatants, () => 0.7);
    // At least one ordering should differ
    expect(sorted1[0].id !== sorted2[0].id || sorted1.length === 1).toBe(true);
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
