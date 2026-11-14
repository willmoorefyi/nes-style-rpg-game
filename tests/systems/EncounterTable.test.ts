import { describe, it, expect, beforeEach } from 'vitest';
import { EncounterTable, MAX_FORMATION } from '../../src/systems/EncounterTable.js';
import { MAX_LAYOUT } from '../../src/scenes/battle/EnemyLayoutAi.js';
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

/** Deterministic RNG (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('EncounterTable groups (T4c)', () => {
  it('rolls a group count in [min, max] and every count appears in 300 rolls', () => {
    const table = new EncounterTable(seeded(7));
    table.setEntries([{ groups: [{ id: 'goblin', min: 3, max: 5 }], weight: 1 }]);
    const counts = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const enemies = table.selectEnemies();
      expect(enemies.every((id) => id === 'goblin')).toBe(true);
      expect(enemies.length).toBeGreaterThanOrEqual(3);
      expect(enemies.length).toBeLessThanOrEqual(5);
      counts.add(enemies.length);
    }
    expect([...counts].sort()).toEqual([3, 4, 5]);
  });

  it('lists groups in order and treats a missing max as min', () => {
    const table = new EncounterTable(() => 0);
    table.setEntries([{ groups: [{ id: 'goblin', min: 2 }, { id: 'wolf', min: 1, max: 3 }], weight: 1 }]);
    expect(table.selectEnemies()).toEqual(['goblin', 'goblin', 'wolf']);
  });

  it('leaves a legacy enemies entry unchanged', () => {
    const table = new EncounterTable(seeded(1));
    table.setEntries([{ enemies: ['goblin', 'wolf'], weight: 1 }]);
    for (let i = 0; i < 20; i++) expect(table.selectEnemies()).toEqual(['goblin', 'wolf']);
  });

  it('caps the total at MAX_FORMATION (9), cutting from the end', () => {
    expect(MAX_FORMATION).toBe(9);
    const table = new EncounterTable(() => 0);
    table.setEntries([{ groups: [{ id: 'goblin', min: 6, max: 6 }, { id: 'wolf', min: 6, max: 6 }], weight: 1 }]);
    expect(table.selectEnemies()).toEqual([...Array(6).fill('goblin'), ...Array(3).fill('wolf')]);
  });

  it('uses the first group once when every count rolls 0', () => {
    const table = new EncounterTable(() => 0);
    table.setEntries([{ groups: [{ id: 'gr_wolf', min: 0, max: 1 }, { id: 'wolf', min: 0, max: 2 }], weight: 1 }]);
    expect(table.selectEnemies()).toEqual(['gr_wolf']);
  });

  it('keeps MAX_FORMATION equal to the layout limit', () => {
    expect(MAX_LAYOUT).toBe(MAX_FORMATION);
  });
});
