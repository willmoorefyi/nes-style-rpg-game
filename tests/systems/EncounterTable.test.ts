import { describe, it, expect, beforeEach } from 'vitest';
import { EncounterTable } from '../../src/systems/EncounterTable.js';
import type { EncounterEntry } from '../../src/types/index.js';

describe('EncounterTable', () => {
  let table: EncounterTable;

  beforeEach(() => {
    table = new EncounterTable();
  });

  it('returns empty array when no entries', () => {
    expect(table.selectEnemies()).toEqual([]);
  });

  it('isEmpty returns true when no entries', () => {
    expect(table.isEmpty).toBe(true);
  });

  it('isEmpty returns false after setEntries', () => {
    table.setEntries([{ enemies: ['goblin'], weight: 1 }]);
    expect(table.isEmpty).toBe(false);
  });

  it('selects from single entry', () => {
    table.setEntries([{ enemies: ['goblin'], weight: 1 }]);
    expect(table.selectEnemies()).toEqual(['goblin']);
  });

  it('selects based on weighted random', () => {
    const entries: EncounterEntry[] = [
      { enemies: ['goblin'], weight: 1 },
      { enemies: ['wolf'], weight: 1 },
    ];
    table.setEntries(entries);

    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const enemies = table.selectEnemies();
      results.add(enemies[0]);
    }
    expect(results.has('goblin')).toBe(true);
    expect(results.has('wolf')).toBe(true);
  });

  it('respects weight distribution', () => {
    const entries: EncounterEntry[] = [
      { enemies: ['goblin'], weight: 3 },
      { enemies: ['wolf'], weight: 1 },
    ];
    // rng=0.1 -> roll=0.4, goblin (weight 3) -> roll=-2.6 <= 0, returns goblin
    const lowTable = new EncounterTable(() => 0.1);
    lowTable.setEntries(entries);
    expect(lowTable.selectEnemies()).toEqual(['goblin']);

    // rng=0.9 -> roll=3.6, goblin -> roll=0.6, wolf -> roll=-0.4 <= 0, returns wolf
    const highTable = new EncounterTable(() => 0.9);
    highTable.setEntries(entries);
    expect(highTable.selectEnemies()).toEqual(['wolf']);
  });
});
