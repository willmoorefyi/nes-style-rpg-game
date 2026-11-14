import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { ItemData } from '../../src/types/index.js';
import { validateItemData } from '../../src/core/schemaValidation.js';

const items = parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../assets/data/items.yaml'), 'utf-8')) as ItemData[];

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

  it('consumables give their numbers: the Potion restores 30 HP, the Hi-Potion 120', () => {
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get('potion')!.description).toContain(`${byId.get('potion')!.stats.hp} HP`);
    expect(byId.get('hi_potion')!.description).toContain(`${byId.get('hi_potion')!.stats.hp} HP`);
  });
});
