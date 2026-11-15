/**
 * Pass F item 3 (docs/FEEDBACK_PLAN_2026-11-14.md §3.3): every enemy says how it attacks. `attack` is melee or ranged,
 * every ranged one names an `attackEffect` from spell-effects.yaml `attacks`, and only Garland and the lich have the
 * heavy attack (item 7; since pass R also the roster bosses with a raise). Old data: no field.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { EnemyData } from '../../src/types/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const enemies = parse(readFileSync(join(root, 'assets/data/enemies.yaml'), 'utf-8')) as EnemyData[];
const fx = parse(readFileSync(join(root, 'assets/data/spell-effects.yaml'), 'utf-8')) as { attacks?: Record<string, string> };

describe('enemy attack kinds', () => {
  it.each(enemies.map((e) => [e.id, e] as const))('%s has attack melee or ranged', (_, e) => {
    expect(['melee', 'ranged']).toContain(e.attack);
  });

  it('every ranged enemy has an attackEffect defined in spell-effects.yaml attacks; the dragon breathes fire', () => {
    const ranged = enemies.filter((e) => e.attack === 'ranged');
    expect(ranged.map((e) => e.id)).toContain('dragon');
    for (const e of ranged) expect(fx.attacks?.[e.attackEffect ?? ''], e.id).toBeDefined();
  });

  it('the heavy attack: Garland, the lich and the roster bosses with a raise (ROSTER_PLAN 7.2), all melee (FB-4)', () => {
    const heavy = enemies.filter((e) => e.attackAnim === 'heavy');
    expect(heavy.map((e) => e.id).sort()).toEqual(['chaos', 'garland', 'hollow_seraph', 'hollow_seraph_2', 'lich', 'lich_2']);
    expect(heavy.every((e) => e.attack === 'melee')).toBe(true);
  });

  it('the Drowned Sovereign and the Ashen Queen (and their rematches) turn heavy only in their 50 % phase', () => {
    for (const id of ['drowned_sovereign', 'drowned_sovereign_2', 'ashen_queen', 'ashen_queen_2']) {
      const e = enemies.find((x) => x.id === id)!;
      expect(e.attackAnim, id).toBeUndefined();
      expect(e.bossPhases?.map((p) => [p.hpThreshold, p.attackAnim]), id).toEqual([[0.5, 'heavy']]);
    }
  });
});
