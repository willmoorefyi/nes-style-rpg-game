/**
 * Gear, magic and inn bands of pass W (docs/WORLD_PLAN.md 3.6, which replaces QUEST_PLAN 6.1; QUEST 4.4's done-when;
 * W1-F). Every shop is `<town>_<kind>` and belongs to a band town. It checks:
 * - every shop item is within its town's caps (weapon attack, body / shield / helm defence, the magic levels sold,
 *   the inn price);
 * - each band from B2 to B7 adds at least one upgrade for each base class (exempt: B8, which sells magic only);
 * - no item stronger than its band appears in an earlier shop (an item's band is the first whose cap admits it), and
 *   the found gear (`masamune`, `dragon_armor`, `excalibur`) is in no shop;
 * - the kits quest.yaml names exist; a town kit holds only gear and spells sold up to its band, learnable by the class.
 * Plus the canon key items of WORLD_PLAN 3.1.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { ITEMS, SHOPS, KITS, CLASSES, item, spell, classOf } from '../helpers/balanceData.js';
import type { ItemData } from '../../src/types/index.js';
import type { QuestData } from '../../src/types/quest.js';

type Slot = 'weapon' | 'armor' | 'shield' | 'helmet';
interface Band { id: string; towns: string[]; caps: Record<Slot, number> | null; magic: number[]; inn: number | null }

/** WORLD_PLAN 3.6 (caps: the highest stat sold; null: the band sells no gear). */
const BANDS: Band[] = [
  { id: 'B1', towns: ['cornelia'], caps: { weapon: 12, armor: 15, shield: 2, helmet: 1 }, magic: [1], inn: 30 },
  { id: 'B2', towns: ['pravoka'], caps: { weapon: 16, armor: 15, shield: 4, helmet: 3 }, magic: [2], inn: 50 },
  { id: 'B3', towns: ['elfheim', 'dwarf'], caps: { weapon: 23, armor: 24, shield: 4, helmet: 3 }, magic: [2, 3], inn: 100 },
  { id: 'B4', towns: ['melmond'], caps: { weapon: 23, armor: 34, shield: 8, helmet: 6 }, magic: [3, 4], inn: 200 },
  { id: 'B5', towns: ['crescent'], caps: { weapon: 26, armor: 34, shield: 8, helmet: 6 }, magic: [5], inn: 300 },
  { id: 'B6', towns: ['onrac'], caps: { weapon: 30, armor: 38, shield: 12, helmet: 8 }, magic: [6], inn: 500 },
  { id: 'B7', towns: ['gaia'], caps: { weapon: 34, armor: 42, shield: 14, helmet: 10 }, magic: [7], inn: 700 },
  { id: 'B8', towns: ['lufenia'], caps: null, magic: [7, 8], inn: 900 },
];
/** Bands that need not add an upgrade for every base class, with the reason. */
const UPGRADE_EXEMPT: Record<string, string> = { B1: 'the start', B8: 'magic only (3.6)' };
const FOUND = ['masamune', 'dragon_armor', 'excalibur'];
const BASE = CLASSES.filter((c) => !c.upgradeFrom).map((c) => c.id);
/** WORLD_PLAN 3.1, in stage order. */
const KEY_ITEMS = ['lute', 'crown', 'crystal_eye', 'herb', 'mystic_key', 'tnt', 'ruby', 'rod', 'canoe', 'levistone',
  'ordeal_seal', 'cube', 'fairy_bottle', 'oxyale', 'slab', 'chime', 'adamant'];

const townOf = (shopId: string): string => shopId.slice(0, shopId.lastIndexOf('_'));
const bandIndexOfTown = (town: string): number => BANDS.findIndex((b) => b.towns.includes(town));
const bandOfShop = (shopId: string): number => bandIndexOfTown(townOf(shopId));
const slotOf = (it: ItemData): Slot | null =>
  it.type === 'weapon' ? 'weapon' : it.type === 'armor' ? ((it.slot ?? 'armor') as Slot) : null;
const statOf = (it: ItemData): number => (it.type === 'weapon' ? it.stats.attack ?? 0 : it.stats.defense ?? 0);
const usable = (it: ItemData, cls: string): boolean => it.usableBy.includes(cls);
/** The gear sold in the shops of band `b`. */
const gearOfBand = (b: number): ItemData[] => SHOPS.filter((s) => bandOfShop(s.id) === b && (s.type === 'weapon' || s.type === 'armor'))
  .flatMap((s) => s.inventory.map(item));
const spellsUpTo = (b: number): Set<string> => new Set(SHOPS.filter((s) => s.type === 'magic' && bandOfShop(s.id) <= b)
  .flatMap((s) => s.inventory));
const gearUpTo = (b: number): Set<string> => new Set(BANDS.slice(0, b + 1).flatMap((_, i) => gearOfBand(i).map((x) => x.id)));

describe('WORLD_PLAN 3.6: shops by band', () => {
  it('every shop is <town>_<kind> of a band town', () => {
    for (const s of SHOPS) expect(bandOfShop(s.id), s.id).toBeGreaterThanOrEqual(0);
  });

  it('every shop item is within its town\'s caps; magic shops sell only their band\'s levels; inns charge the band price', () => {
    for (const s of SHOPS) {
      const band = BANDS[bandOfShop(s.id)];
      if (s.type === 'weapon' || s.type === 'armor') {
        expect(band.caps, `${s.id}: ${band.id} sells no gear`).not.toBeNull();
        for (const id of s.inventory) {
          const it = item(id);
          const slot = slotOf(it);
          expect(slot, `${s.id}: ${id} is not gear`).not.toBeNull();
          expect(slot === 'weapon', `${s.id}: ${id} in the wrong shop type`).toBe(s.type === 'weapon');
          expect(statOf(it), `${s.id}: ${id} (${slot})`).toBeLessThanOrEqual(band.caps![slot!]);
        }
      } else if (s.type === 'magic') {
        for (const id of s.inventory) expect(band.magic, `${s.id}: ${id} L${spell(id).level}`).toContain(spell(id).level);
      } else if (s.type === 'inn') {
        expect(s.innPrice, s.id).toBe(band.inn);
      } else {
        for (const id of s.inventory) expect(['consumable'], `${s.id}: ${id}`).toContain(item(id).type);
      }
    }
  });

  it('each band from B2 to B7 adds at least one upgrade for each base class', () => {
    for (let b = 1; b < BANDS.length; b++) {
      if (UPGRADE_EXEMPT[BANDS[b].id]) continue;
      for (const cls of BASE) {
        const best = (slot: Slot): number => Math.max(0, ...BANDS.slice(0, b).flatMap((_, i) => gearOfBand(i))
          .filter((it) => usable(it, cls) && slotOf(it) === slot).map(statOf));
        const ups = gearOfBand(b).filter((it) => usable(it, cls) && statOf(it) > best(slotOf(it)!));
        expect(ups.length, `${BANDS[b].id} has no upgrade for ${cls}`).toBeGreaterThan(0);
      }
    }
  });

  it('no item stronger than its band appears in an earlier shop; found gear is never sold; spells first sell at their band', () => {
    const gearBand = (it: ItemData): number => BANDS.findIndex((b) => b.caps !== null && statOf(it) <= b.caps[slotOf(it)!]);
    for (const s of SHOPS) {
      for (const id of s.inventory) {
        expect(FOUND, `${s.id} sells found gear ${id}`).not.toContain(id);
        if (s.type === 'weapon' || s.type === 'armor') expect(bandOfShop(s.id), `${s.id}: ${id}`).toBeGreaterThanOrEqual(gearBand(item(id)));
        if (s.type === 'magic') {
          const first = BANDS.findIndex((b) => b.magic.includes(spell(id).level));
          expect(bandOfShop(s.id), `${s.id}: ${id}`).toBeGreaterThanOrEqual(first);
        }
      }
    }
    for (const id of FOUND) expect(['weapon', 'armor']).toContain(item(id).type);
    // found gear may exceed the last caps by at most one band (3.6: masamune 56, dragon_armor 42)
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
