/**
 * Gear, magic and inn bands of pass W (docs/WORLD_PLAN.md 3.6, which replaces QUEST_PLAN 6.1; QUEST 4.4's done-when;
 * W1-F), as pass EQ left them (docs/EQUIP_FF1_PLAN.md D-EQ14, user ruling R1: every shop sells exactly NES FF1's
 * inventory, pinned by `ff1Shops.test.ts`). WORLD_PLAN 3.6's per-band gear caps, "every band adds an upgrade for each
 * base class" and "no item stronger than its band earlier" are retired: FF1 sells Steel Armor at Melmond, a Gold
 * Bracelet at Gaia and nothing at Onrac. It still checks:
 * - every shop is `<town>_<kind>` of a band town and every inn charges its band's price;
 * - the found gear (every gear item no open shop sells) is never sold;
 * - the kits quest.yaml names exist; a town kit's `gear` holds only gear sold up to its band and spells sold up to
 *   its band, learnable by the class.
 * Plus the canon key items of WORLD_PLAN 3.1.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { ITEMS, SHOPS, KITS, CLASSES, item, spell, classOf } from '../helpers/balanceData.js';
import type { ItemData } from '../../src/types/index.js';
import type { QuestData } from '../../src/types/quest.js';

interface Band { id: string; towns: string[]; inn: number | null }

/** WORLD_PLAN 3.6's bands, in order (the gear caps retired by pass EQ). */
const BANDS: Band[] = [
  { id: 'B1', towns: ['cornelia'], inn: 30 },
  { id: 'B2', towns: ['pravoka'], inn: 50 },
  { id: 'B3', towns: ['elfheim', 'dwarf'], inn: 100 },
  { id: 'B4', towns: ['melmond'], inn: 200 },
  { id: 'B5', towns: ['crescent'], inn: 300 },
  { id: 'B6', towns: ['onrac'], inn: 500 },
  { id: 'B7', towns: ['gaia'], inn: 700 },
  { id: 'B8', towns: ['lufenia'], inn: 900 },
];
const BASE = CLASSES.filter((c) => !c.upgradeFrom).map((c) => c.id);
/** WORLD_PLAN 3.1, in stage order. */
const KEY_ITEMS = ['lute', 'crown', 'crystal_eye', 'herb', 'mystic_key', 'tnt', 'ruby', 'rod', 'canoe', 'levistone',
  'ordeal_seal', 'cube', 'fairy_bottle', 'oxyale', 'slab', 'chime', 'adamant'];

const townOf = (shopId: string): string => shopId.slice(0, shopId.lastIndexOf('_'));
const bandIndexOfTown = (town: string): number => BANDS.findIndex((b) => b.towns.includes(town));
const bandOfShop = (shopId: string): number => bandIndexOfTown(townOf(shopId));
const isGear = (it: ItemData): boolean => it.type === 'weapon' || it.type === 'armor';
const OPEN = SHOPS.filter((s) => !s.closed);
/** Every gear item no open shop sells: found in chests (or forged). */
const FOUND = ITEMS.filter((i) => isGear(i) && !OPEN.some((s) => s.inventory.includes(i.id))).map((i) => i.id);
const spellsUpTo = (b: number): Set<string> => new Set(OPEN.filter((s) => s.type === 'magic' && bandOfShop(s.id) <= b)
  .flatMap((s) => s.inventory));
const gearUpTo = (b: number): Set<string> => new Set(OPEN.filter((s) => (s.type === 'weapon' || s.type === 'armor')
  && bandOfShop(s.id) <= b).flatMap((s) => s.inventory));

describe('WORLD_PLAN 3.6: shops by band (pass EQ: the FF1 shops)', () => {
  it('every shop is <town>_<kind> of a band town', () => {
    for (const s of SHOPS) expect(bandOfShop(s.id), s.id).toBeGreaterThanOrEqual(0);
  });

  it('gear shops sell gear of their kind, item shops consumables, inns charge the band price', () => {
    for (const s of SHOPS) {
      const band = BANDS[bandOfShop(s.id)];
      if (s.type === 'weapon' || s.type === 'armor') {
        for (const id of s.inventory) expect(item(id).type, `${s.id}: ${id}`).toBe(s.type === 'weapon' ? 'weapon' : 'armor');
      } else if (s.type === 'inn') {
        expect(s.innPrice, s.id).toBe(band.inn);
      } else if (s.type === 'item') {
        for (const id of s.inventory) expect(['consumable'], `${s.id}: ${id}`).toContain(item(id).type);
      }
    }
  });

  it('found gear is never sold; Masamune, Dragon Armor and Excalibur are among it', () => {
    for (const id of ['masamune', 'dragon_armor', 'excalibur']) expect(FOUND).toContain(id);
    for (const s of OPEN) for (const id of s.inventory) expect(FOUND, `${s.id} sells found gear ${id}`).not.toContain(id);
    // found gear may exceed the last shops by a wide margin (FF1), but Excalibur stays under the Masamune
    expect(item('excalibur').stats.attack).toBeLessThanOrEqual(item('masamune').stats.attack!);
  });
});

describe('WORLD_PLAN 3.4-3.6: the w_* kits', () => {
  const quest = parse(readFileSync('assets/data/quest.yaml', 'utf-8')) as QuestData;
  const named = [...quest.stages.map((s) => s.kit), ...quest.towns.map((t) => t.kit)].filter((k): k is string => !!k);

  it('every kit quest.yaml names is in kits.yaml, with every base class', () => {
    for (const k of named) {
      expect(KITS[k], k).toBeDefined();
      for (const cls of BASE) expect(KITS[k][cls], `${k}.${cls}`).toBeDefined();
    }
    expect(named.filter((k) => k.startsWith('w_')).length).toBeGreaterThanOrEqual(38);
  });

  it('a town kit holds only gear and spells sold up to its band, each spell learnable (3 per level at most)', () => {
    for (const t of quest.towns) {
      const b = bandIndexOfTown(t.id);
      const gear = gearUpTo(b);
      const spells = spellsUpTo(b);
      for (const [cls, k] of Object.entries(KITS[t.kit])) {
        const c = classOf(cls);
        for (const id of k.gear) expect(gear.has(id), `${t.kit}.${cls}: ${id} is not sold by ${BANDS[b].id}`).toBe(true);
        for (const id of k.found ?? []) expect(FOUND, `${t.kit}.${cls}: found ${id} is sold`).toContain(id);
        for (const id of k.spells) {
          expect(spells.has(id), `${t.kit}.${cls}: ${id} is not sold by ${BANDS[b].id}`).toBe(true);
          expect(c.spellLevels[spell(id).type], `${t.kit}.${cls}: ${id}`).toBeGreaterThanOrEqual(spell(id).level);
        }
        const perLevel = new Map<number, number>();
        for (const id of k.spells) perLevel.set(spell(id).level, (perLevel.get(spell(id).level) ?? 0) + 1);
        for (const [lv, n] of perLevel) expect(n, `${t.kit}.${cls} L${lv}`).toBeLessThanOrEqual(3);
      }
    }
  });

  it('kits from S19 on carry the upgraded classes (the balance tests use them from S20, QUEST open question 3)', () => {
    const upgraded = CLASSES.filter((c) => c.upgradeFrom).map((c) => c.id);
    for (const s of quest.stages.filter((x) => Number(x.id.slice(1)) >= 19 && x.kit)) {
      for (const cls of upgraded) expect(KITS[s.kit!][cls], `${s.kit}.${cls}`).toBeDefined();
    }
  });
});

describe('WORLD_PLAN 3.1: canon key items', () => {
  it.each(KEY_ITEMS)('%s exists with type: key', (id) => {
    expect(item(id).type).toBe('key');
    expect(item(id).price).toBe(0);
  });

  it('excalibur is found gear (a weapon, never sold) and adamant is the key item Smyth takes', () => {
    expect(item('excalibur').type).toBe('weapon');
    expect(item('adamant').type).toBe('key');
    expect(ITEMS.filter((i) => i.type === 'key').map((i) => i.id).sort()).toEqual([...KEY_ITEMS].sort());
  });
});
