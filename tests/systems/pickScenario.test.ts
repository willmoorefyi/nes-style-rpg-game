import { describe, it, expect } from 'vitest';
import { pickScenario } from '../../src/systems/DebugScenarioLoader.js';

describe('pickScenario', () => {
  const scenarios = [{ id: 'basic_battle' }, { id: 'knight_party' }];

  it('selects the scenario named by ?scenario=', () => {
    expect(pickScenario(scenarios, '?art=ai&scenario=knight_party')?.id).toBe('knight_party');
  });

  it('falls back to the first scenario', () => {
    expect(pickScenario(scenarios, '')?.id).toBe('basic_battle');
    expect(pickScenario(scenarios, '?scenario=missing')?.id).toBe('basic_battle');
    expect(pickScenario([], '')).toBeUndefined();
  });
});
