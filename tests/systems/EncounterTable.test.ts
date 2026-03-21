import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const entries: EncounterEntry[] = [
      { enemies: ['goblin'], weight: 3 },
      { enemies: ['wolf'], weight: 1 },
    ];
    table.setEntries(entries);
    expect(table.selectEnemies()).toEqual(['goblin']);

    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    expect(table.selectEnemies()).toEqual(['wolf']);
    vi.restoreAllMocks();
  });
});
