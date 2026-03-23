import { describe, it, expect } from 'vitest';
import { EncounterTable } from '../EncounterTable.js';
import { EncounterSystem } from '../EncounterSystem.js';
import { EventBus } from '../../core/EventBus.js';

describe('EncounterTable RNG', () => {
  it('uses injected rng for selection', () => {
    const rng = () => 0.75;
    const table = new EncounterTable(rng);
    table.setEntries([
      { enemies: ['goblin'], weight: 1 },
      { enemies: ['orc'], weight: 1 },
    ]);
    expect(table.selectEnemies()).toEqual(['orc']);
  });
});

describe('EncounterSystem RNG', () => {
  it('uses injected rng for step counter', () => {
    const rng = () => 0;
    const events = new EventBus();
    const system = new EncounterSystem(events, rng);
    system.setRate({ min: 10, max: 20 });
    expect(system.stepsRemaining).toBe(10);
  });
});
