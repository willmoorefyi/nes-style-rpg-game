/**
 * Pass F item 3 (docs/FEEDBACK_PLAN_2026-11-14.md §3.3): every enemy says how it attacks. `attack` is melee or ranged,
 * every ranged one names an `attackEffect` from spell-effects.yaml `attacks`, and only Garland and the lich have the
 * heavy attack (item 7). Old data: no field.
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

  it('the heavy attack is Garland and the lich only, both melee (FB-4)', () => {
    expect(enemies.filter((e) => e.attackAnim === 'heavy').map((e) => e.id).sort()).toEqual(['garland', 'lich']);
    expect(enemies.filter((e) => e.attackAnim === 'heavy').every((e) => e.attack === 'melee')).toBe(true);
  });
});
