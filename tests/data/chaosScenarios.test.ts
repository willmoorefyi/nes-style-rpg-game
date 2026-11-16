/**
 * The Chaos debug scenarios (docs/CHAOS_FORMS_PLAN.md 7.2 R21, 10 C4, 11.3, 12): `chaos_forms` (the whole chain from F1,
 * an endgame party), `chaos_final` (F3 alone with the poison / slow icon preset, since Chaos protects against status),
 * and `chaos_interlude_1..3` (the form before each interlude). Every one stands on the rim backdrop. No map claim.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'yaml';
import { enemyStatusOf, type DebugScenario } from '../../src/systems/DebugScenarioLoader.js';

const SCENARIOS = parse(readFileSync('assets/data/debug-scenarios.yaml', 'utf-8')) as DebugScenario[];
const byId = (id: string): DebugScenario | undefined => SCENARIOS.find((s) => s.id === id);
const RIM = 'assets/backgrounds/rim.webp';

describe('Chaos debug scenarios (R21)', () => {
  it('chaos_forms, chaos_final and chaos_interlude_1..3 exist with the enemies they need', () => {
    expect(byId('chaos_forms')?.enemies).toEqual(['chaos']);
    expect(byId('chaos_final')?.enemies).toEqual(['chaos_horizon']);
    expect(['chaos_interlude_1', 'chaos_interlude_2', 'chaos_interlude_3'].map((id) => byId(id)?.enemies))
      .toEqual([['chaos'], ['chaos_orrery'], ['chaos_horizon']]);
  });

  it('every Chaos scenario is a battle on the rim backdrop (the file exists)', () => {
    expect(existsSync(RIM)).toBe(true);
    const chaos = SCENARIOS.filter((s) => s.enemies?.some((e) => e.startsWith('chaos_') || e === 'chaos') && s.id.startsWith('chaos'));
    expect(chaos.map((s) => s.id).sort()).toEqual(['chaos_final', 'chaos_forms', 'chaos_interlude_1', 'chaos_interlude_2', 'chaos_interlude_3']);
    for (const s of chaos) {
      expect(s.background, s.id).toBe(RIM);
      expect(s.mode ?? 'battle', s.id).toBe('battle');
      expect(s.party.length, s.id).toBe(4);
    }
  });

  it('chaos_final shows the status icon row through the enemyStatus preset {0: [poison, blind]} (7.2 named slow, which is no StatusEffect)', () => {
    expect(enemyStatusOf(byId('chaos_final')!)).toEqual({ 0: ['poison', 'blind'] });
  });

  it('the chain scenarios carry an endgame party (level >= 40) so every form is reached', () => {
    for (const id of ['chaos_forms', 'chaos_interlude_1', 'chaos_interlude_2', 'chaos_interlude_3', 'chaos_final']) {
      for (const m of byId(id)!.party) expect((m as { level: number }).level, `${id} ${m.name}`).toBeGreaterThanOrEqual(40);
    }
  });
});
