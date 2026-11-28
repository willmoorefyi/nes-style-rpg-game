/**
 * Pass EQ D-EQ11 (docs/EQUIP_FF1_PLAN.md 6): where every kit's gear comes from.
 * - A kit row is `{ gear, found?, spells }`. `gear` is what the party buys: for each slot, the best item by rank (weapons
 *   ATK, hit, crit; armour DEF, then the lower weight; then the id) the class may use among the gear the open shops
 *   sell up to the kit's tier town. A Monk / Master takes no weapon when 2 x the band's low level >= its ATK.
 * - A stage kit's `gear` equals its tier town kit's `gear` row by row (the Monk / Master weapon judged per kit).
 * - `found` items sit in chests on the maps of the stage or of an ancestor (quest.yaml `after`, transitively), rank
 *   strictly before their slot's `gear` item, and are handed out to no more members than there are such chests, over
 *   W, T, WM, BM, Mo, RM; the promoted rows (S19 on) are a second party on their own copy of the pool.
 * - Proof (f)'s walls stay where they were: only Crescent and Gaia are walled.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { Character } from '../../src/entities/Character.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { slotOf } from '../../src/entities/EquipmentRules.js';
import type { ItemData, MapData, ShopData } from '../../src/types/index.js';
import type { QuestData } from '../../src/types/quest.js';
import { loadRealRegistries } from '../helpers/realData.js';

interface Row { gear: string[]; found?: string[]; spells: string[] }
const KITS = parse(readFileSync('assets/data/kits.yaml', 'utf-8')) as Record<string, Record<string, Row>>;
const ITEMS = new Map((parse(readFileSync('assets/data/items.yaml', 'utf-8')) as ItemData[]).map((i) => [i.id, i]));
const SHOPS = (parse(readFileSync('assets/data/shops.yaml', 'utf-8')) as ShopData[]).filter((s) => !s.closed);
const QUEST = parse(readFileSync('assets/data/quest.yaml', 'utf-8')) as QuestData;
const STAGES = new Map(QUEST.stages.map((s) => [s.id, s]));
const TOWN_BAND: Record<string, number> = { cornelia: 0, pravoka: 1, elfheim: 2, dwarf: 2, melmond: 3, crescent: 4,
  onrac: 5, gaia: 6, lufenia: 7 };
const SLOTS = ['weapon', 'armor', 'shield', 'helmet', 'hands'] as const;
const BASE = ['warrior', 'thief', 'white_mage', 'black_mage', 'monk', 'red_mage'];
const PROMO = ['knight', 'ninja', 'white_wizard', 'black_wizard', 'master', 'red_wizard'];
const PRICE_PARTY = ['warrior', 'thief', 'white_mage', 'black_mage'];

/** The tier town of a stage kit (today's aliases, plan D-EQ11). */
function tierOf(stage: number): string {
  return stage <= 2 ? 'cornelia' : stage === 3 ? 'pravoka' : stage <= 10 ? 'elfheim' : stage <= 13 ? 'melmond'
    : stage <= 17 ? 'crescent' : stage <= 22 ? 'onrac' : 'gaia';
}

const item = (id: string): ItemData => ITEMS.get(id)!;
const stat = (it: ItemData): number => (it.type === 'weapon' ? it.stats.attack ?? 0 : it.stats.defense ?? 0);
const rank = (it: ItemData): Array<number | string> => (it.type === 'weapon'
  ? [-stat(it), -(it.hit ?? 0), -(it.crit ?? 0), it.id] : [-stat(it), it.weight ?? 0, it.id]);
function before(a: ItemData, b: ItemData): boolean {
  const x = rank(a), y = rank(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i];
  return false;
}
const soldUpTo = (band: number): string[] => SHOPS.filter((s) => (s.type === 'weapon' || s.type === 'armor')
  && TOWN_BAND[s.id.slice(0, s.id.lastIndexOf('_'))] <= band).flatMap((s) => s.inventory);

function chestsByMap(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const f of readdirSync('assets/maps/ai').filter((x) => x.endsWith('.yaml') && x !== 'index.yaml')) {
    const m = parse(readFileSync(`assets/maps/ai/${f}`, 'utf-8')) as MapData;
    out.set(m.id, (m.npcs ?? []).flatMap((n) => (n.chestItem ? [n.chestItem] : [])));
  }
  return out;
}
const CHESTS = chestsByMap();
const glob = (p: string): RegExp => new RegExp(`^${p.replace(/[.]/g, '\\.').replace(/\*/g, '.*')}$`);
function ancestors(id: string): Set<string> {
  const out = new Set<string>();
  const todo = [id];
  while (todo.length) {
    const x = todo.pop()!;
    if (out.has(x)) continue;
    out.add(x);
    todo.push(...(STAGES.get(x)?.after ?? []));
  }
  return out;
}
/** The chest pool of a stage: chest items on the maps of the stage and its ancestors, with their counts. */
function pool(stage: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of ancestors(stage)) {
    const pats = (STAGES.get(a)?.maps ?? []).map(glob);
    for (const [map, items] of CHESTS) if (pats.some((r) => r.test(map))) for (const i of items) out.set(i, (out.get(i) ?? 0) + 1);
  }
  return out;
}

let chars: Map<string, Character>;
/** The best item of `slot` for `cls` among `ids`, or null; the Monk / Master weapon gives way to bare hands. */
function best(cls: string, slot: string, ids: string[], bandLow: number): string | null {
  const c = chars.get(cls)!;
  const cands = [...new Set(ids)].map(item).filter((it) => slotOf(it) === slot && c.canEquip(it)).sort((a, b) => (before(a, b) ? -1 : 1));
  if (!cands.length) return null;
  if (slot === 'weapon' && c.classData.unarmedMartial && 2 * bandLow >= stat(cands[0])) return null;
  return cands[0].id;
}

const townKits = QUEST.towns.map((t) => ({ name: t.kit!, band: TOWN_BAND[t.id], low: STAGES.get(t.bandStage)!.band![0] }));
const stageKits = QUEST.stages.filter((s) => s.kit?.startsWith('w_s')).map((s) => {
  const n = Number(s.id.slice(1));
  return { name: s.kit!, stage: s.id, n, town: tierOf(n), low: s.band![0] };
});

describe('EQ D-EQ11: kit sources', () => {
  beforeAll(async () => {
    await loadRealRegistries();
    chars = new Map([...BASE, ...PROMO].map((c) => [c, new Character({ name: c, classData: ClassRegistry.getClass(c)! })]));
  });

  it.each(townKits.map((k) => [k.name, k] as const))('%s: gear is the best sold up to its band, one per slot, nothing found', (name, k) => {
    for (const [cls, row] of Object.entries(KITS[name])) {
      const src = ClassRegistry.getClass(cls)!.copyOf ?? cls;
      if (!chars.has(src)) continue;
      const want = SLOTS.map((s) => best(src, s, soldUpTo(k.band), k.low)).filter((g): g is string => !!g);
      expect(row.gear, `${name}.${cls}`).toEqual(want);
      expect(row.found ?? [], `${name}.${cls}`).toEqual([]);
    }
  });

  it.each(stageKits.map((k) => [k.name, k] as const))('%s: gear = its tier town\'s; found from its chests, ranked, counted', (name, k) => {
    const chests = pool(k.stage);
    for (const party of [BASE, PROMO]) {
      if (party === PROMO && k.n < 19) continue;
      const left = new Map(chests);
      for (const cls of party) {
        const row = KITS[name][cls];
        expect(row, `${name}.${cls}`).toBeDefined();
        const shop = soldUpTo(TOWN_BAND[k.town]);
        const want = SLOTS.map((s) => best(cls, s, shop, k.low)).filter((g): g is string => !!g);
        expect(row.gear, `${name}.${cls} gear`).toEqual(want);
        for (const f of row.found ?? []) {
          const it = item(f);
          expect(chars.get(cls)!.canEquip(it), `${name}.${cls}: ${f}`).toBe(true);
          const own = row.gear.map(item).find((g) => slotOf(g) === slotOf(it));
          if (own) expect(before(it, own), `${name}.${cls}: ${f} does not beat ${own.id}`).toBe(true);
          expect(left.get(f) ?? 0, `${name}.${cls}: no chest left for ${f}`).toBeGreaterThan(0);
          left.set(f, (left.get(f) ?? 0) - 1);
        }
      }
    }
  });

  it('every clone row equals its copyOf source row in every kit', () => {
    for (const [name, kit] of Object.entries(KITS)) {
      for (const [cls, row] of Object.entries(kit)) {
        const src = ClassRegistry.getClass(cls)?.copyOf;
        if (src && kit[src]) expect(row, `${name}.${cls}`).toEqual(kit[src]);
      }
    }
  });

  it('only Crescent and Gaia are walled (proof (f): a town kit dearer than every kit of the stages right after it)', () => {
    const price = (kit: string): number => PRICE_PARTY.reduce((s, c) => s + KITS[kit][c].gear.reduce((t, g) => t + item(g).price, 0), 0);
    const walled = QUEST.towns.filter((t) => {
      const next = QUEST.stages.filter((s) => s.after.some((a) => t.opensAfter.includes(a)) && s.kit);
      return next.length > 0 && next.every((s) => price(t.kit!) > price(s.kit!));
    }).map((t) => t.id).sort();
    expect(walled).toEqual(['crescent', 'gaia']);
  });
});
