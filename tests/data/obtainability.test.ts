/**
 * Pass EQ D-EQ10: no item becomes unobtainable. Every weapon, armour and consumable is sold by an open shop, held by a
 * chest or given by an NPC on a map the game loads, or given by a cutscene (Smyth forges Excalibur).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { ItemData, MapData, ShopData } from '../../src/types/index.js';

const items = parse(readFileSync('assets/data/items.yaml', 'utf-8')) as ItemData[];
const shops = parse(readFileSync('assets/data/shops.yaml', 'utf-8')) as ShopData[];
const cutscenes = parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{ id: string; steps?: Array<{ type: string; item?: string }> }>;

function mapSources(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const dir of ['assets/maps', 'assets/maps/ai']) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.yaml') && x !== 'index.yaml')) {
      const m = parse(readFileSync(join(dir, f), 'utf-8')) as MapData;
      for (const n of m.npcs ?? []) {
        for (const id of [n.chestItem, n.giftItem]) if (id) out.set(id, [...(out.get(id) ?? []), m.id]);
      }
    }
  }
  return out;
}

describe('EQ: every item can be had', () => {
  const sold = new Set(shops.filter((s) => !s.closed).flatMap((s) => s.inventory));
  const found = mapSources();
  const given = new Set(cutscenes.flatMap((c) => (c.steps ?? []).filter((s) => s.type === 'give_item' && s.item).map((s) => s.item!)));

  it.each(items.filter((i) => i.type !== 'key').map((i) => [i.id] as const))('%s is sold, found or given', (id) => {
    expect(sold.has(id) || found.has(id) || given.has(id), `${id} has no source`).toBe(true);
  });

  it('Excalibur comes only from a cutscene (the forge)', () => {
    expect(given.has('excalibur')).toBe(true);
    expect(sold.has('excalibur')).toBe(false);
  });
});
