import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { ItemData } from '../../src/types/index.js';
import { validateItemData } from '../../src/core/schemaValidation.js';

const items = parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../assets/data/items.yaml'), 'utf-8')) as Array<ItemData & { element?: string }>;  // `element`: data only (weapons), not on ItemData

describe('MS-7: every item has a real description', () => {
  it('covers all 43 items', () => {
    expect(items).toHaveLength(43);
  });

  it.each(items.map((i) => [i.id, i] as const))('%s: a non-empty description that is not its name', (_id, item) => {
    expect(() => validateItemData(item)).not.toThrow();
    expect(typeof item.description).toBe('string');
    const d = (item.description ?? '').trim();
    expect(d.length).toBeGreaterThan(0);
    expect(d.toLowerCase()).not.toBe(item.name.toLowerCase());
    // one line in the help bar and two at most in the shop's detail panel
    expect(d.length).toBeLessThanOrEqual(60);
  });

  const gear = items.filter((i) => i.type === 'weapon' || i.type === 'armor');
  /** Every "<label> <n>" / "<label> +<n>" number in a description, e.g. all ATK values. */
  const numbers = (d: string, label: string): number[] =>
    [...d.matchAll(new RegExp(`\\b${label} \\+?(\\d+)`, 'g'))].map((m) => Number(m[1]));

  it.each(gear.map((i) => [i.id, i] as const))('%s: the ATK, DEF and hit numbers match its stats', (_id, item) => {
    const d = item.description ?? '';
    if (item.type === 'weapon') {
      expect(numbers(d, 'ATK')).toEqual([item.stats.attack ?? 0]);
      expect(numbers(d, 'DEF')).toEqual([]);
      // the hit bonus is listed the same way on every weapon: ", hit +N" when there is one, nothing when it is 0
      const hit = item.hit ?? 0;
      expect(numbers(d, 'hit')).toEqual(hit > 0 ? [hit] : []);
      if (hit > 0) expect(d).toContain(`ATK ${item.stats.attack}, hit +${hit}`);
      else expect(d).not.toMatch(/\bhit\b/i);
    } else {
      expect(numbers(d, 'DEF')).toEqual([item.stats.defense ?? 0]);
      expect(numbers(d, 'ATK')).toEqual([]);
      expect(numbers(d, 'hit')).toEqual([]);
    }
  });

  it.each(gear.filter((i) => i.element).map((i) => [i.id, i] as const))('%s: names its element', (_id, item) => {
    expect(item.description?.toLowerCase()).toContain(item.element!.toLowerCase());
  });

  it('the elemental swords name their element: Flame Sword fire, Ice Brand ice, Coral Sword lightning', () => {
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get('flame_sword')!.description).toMatch(/\bfire\b/i);
    expect(byId.get('ice_brand')!.description).toMatch(/\bice\b/i);
    expect(byId.get('coral_sword')!.description).toMatch(/\blightning\b/i);
  });

  it('consumables give their numbers: the Potion restores 30 HP, the Hi-Potion 120', () => {
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get('potion')!.description).toContain(`${byId.get('potion')!.stats.hp} HP`);
    expect(byId.get('hi_potion')!.description).toContain(`${byId.get('hi_potion')!.stats.hp} HP`);
  });

  it('U11: no description says "weight"; armour with weight says what it costs: "evade -N"', () => {
    for (const item of items) expect(item.description, item.id).not.toMatch(/\bweight\b/i);
    const heavy = items.filter((i) => i.type === 'armor' && (i.weight ?? 0) > 0);
    expect(heavy.length).toBeGreaterThan(0);
    for (const item of heavy) expect(item.description, item.id).toMatch(new RegExp(`\\bevade -${item.weight}\\b`));
  });
});
