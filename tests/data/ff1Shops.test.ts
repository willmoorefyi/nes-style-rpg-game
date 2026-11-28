/**
 * Pass EQ (docs/EQUIP_FF1_PLAN.md 5, D-EQ7, D-EQ8, R1, R4): every shop sells exactly NES FF1's inventory, in FF1's
 * order, at the NES price; the spell shops follow FF1's levels and sell each of the 64 spells exactly once; the four
 * shops FF1 lacks are closed (empty); the Bottle costs FF1's 50000.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { ItemData, MapData, ShopData } from '../../src/types/index.js';
import { CLOSED, NES_PRICE, SHOPS } from './ff1Tables.js';

const shops = parse(readFileSync('assets/data/shops.yaml', 'utf-8')) as ShopData[];
const items = new Map((parse(readFileSync('assets/data/items.yaml', 'utf-8')) as ItemData[]).map((i) => [i.id, i]));
const spells = parse(readFileSync('assets/data/spells.yaml', 'utf-8')) as Array<{ id: string }>;

describe('EQ: the FF1 shops', () => {
  it('every non-inn shop sells exactly the FF1 list, in order', () => {
    const got = Object.fromEntries(shops.filter((s) => s.type !== 'inn').map((s) => [s.id, s.inventory]));
    expect(got).toEqual(SHOPS);
  });

  it('closed is set exactly on the four shops FF1 lacks, which sell nothing (D-EQ8)', () => {
    for (const s of shops.filter((x) => x.type !== 'inn')) {
      expect(s.closed === true, s.id).toBe(CLOSED.includes(s.id));
      expect(s.inventory.length === 0, s.id).toBe(CLOSED.includes(s.id));
    }
  });

  it('every item a shop sells costs its NES price (R4)', () => {
    const sold = new Set(shops.filter((s) => s.type !== 'magic').flatMap((s) => s.inventory));
    expect([...sold].sort()).toEqual(Object.keys(NES_PRICE).sort());
    for (const id of sold) expect(items.get(id)!.price, id).toBe(NES_PRICE[id]);
  });

  it('each of the 64 spells is sold in exactly one magic shop', () => {
    const sold = shops.filter((s) => s.type === 'magic').flatMap((s) => s.inventory);
    expect(sold).toHaveLength(64);
    expect(new Set(sold).size).toBe(64);
    expect([...sold].sort()).toEqual(spells.map((s) => s.id).sort());
  });

  it('the caravan\'s Bottle costs 50000 G (R4)', () => {
    const camp = parse(readFileSync('assets/maps/ai/caravan-camp.yaml', 'utf-8')) as MapData;
    const trader = camp.npcs.find((n) => n.giftItem === 'fairy_bottle');
    expect(trader?.takeGold).toBe(50000);
  });
});
