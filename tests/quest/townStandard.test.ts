/**
 * The town standard (docs/WORLD_PLAN.md 4.0.1, 6.6, G15): each built town against its row of townTargets.ts, the
 * columns counted as 4.0.1 says, with a table of target and actual. A town whose map is still a stub is pending (a
 * failure with QUEST_STRICT=1).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { TOWN_TARGETS, type TownTarget } from './townTargets.js';
import { compiledMap, isBuilt, sourceText, STRICT } from './questMaps.js';

interface TownNpc {
  id: string;
  shopId?: string;
  action?: string;
  dialog?: unknown;
}
interface TownMap {
  id: string;
  npcs: TownNpc[];
  transitions: Array<{ targetMap: string }>;
}
interface Shop { id: string; type?: string; innPrice?: number }

export interface TownCount {
  houses: number;
  interiors: number;
  outdoorNpcs: number;
  interiorNpcs: number;
  hints: number;
  hintKeywords: string[];
  reactive: number;
  shops: string[];
  inn: number | null;
  clinic: boolean;
}

const keeper = (n: TownNpc): boolean => !!n.shopId || n.action === 'inn' || n.action === 'clinic';

function lines(d: unknown): string[] {
  if (typeof d === 'string') return [d];
  if (Array.isArray(d)) return d.flatMap(lines);
  if (d && typeof d === 'object') return lines((d as { text?: unknown }).text);
  return [];
}

const conditions = (d: unknown): string[] => (Array.isArray(d)
  ? d.flatMap((e) => (e && typeof e === 'object' && typeof (e as { condition?: unknown }).condition === 'string' ? [(e as { condition: string }).condition] : []))
  : []);

/** Counts one town's columns (4.0.1) from its compiled maps, its source text and the shop records. */
export function countTown(t: TownTarget, maps: (id: string) => TownMap | null, source: string, shops: Shop[]): TownCount {
  const town = maps(t.map)!;
  const linked = [...new Set(town.transitions.map((x) => x.targetMap))].map((id) => maps(id)).filter((m): m is TownMap => !!m);
  const houses = linked.filter((m) => m.id.startsWith(`${t.map}-house-`));
  const all = [town, ...linked].flatMap((m) => m.npcs);
  const hints = all.filter((n) => n.id.endsWith('_hint'));
  const text = hints.flatMap((n) => lines(n.dialog)).join('\n');
  const innShop = all.map((n) => shops.find((s) => s.id === n.shopId)).find((s) => s?.type === 'inn');
  const src = (parse(source) as { objects?: Array<{ type?: string }> }) ?? {};
  return {
    houses: (src.objects ?? []).filter((o) => o.type === 'house').length,
    interiors: houses.length,
    outdoorNpcs: town.npcs.filter((n) => !keeper(n)).length,
    interiorNpcs: houses.reduce((s, m) => s + m.npcs.length, 0),
    hints: hints.length,
    hintKeywords: t.hints.keywords.filter((k) => text.includes(k)),
    reactive: all.filter((n) => conditions(n.dialog).includes(t.reactive.flag)).length,
    shops: [...new Set(all.flatMap((n) => (n.shopId && shops.find((s) => s.id === n.shopId)?.type !== 'inn' ? [n.shopId] : [])))].sort(),
    inn: innShop?.innPrice ?? null,
    clinic: all.some((n) => n.action === 'clinic'),
  };
}

/** The columns that miss their target. */
export function townErrors(t: TownTarget, c: TownCount, maps: (id: string) => TownMap | null): string[] {
  const out: string[] = [];
  const min = (name: string, got: number, want: number | null): void => {
    if (want !== null && got < want) out.push(`${t.id} ${name} ${got} < ${want}`);
  };
  min('houses', c.houses, t.houses);
  min('interiors', c.interiors, t.interiors);
  min('outdoorNpcs', c.outdoorNpcs, t.outdoorNpcs);
  min('interiorNpcs', c.interiorNpcs, t.interiorNpcs);
  min('hints', c.hints, t.hints.count);
  for (const k of t.hints.keywords) if (!c.hintKeywords.includes(k)) out.push(`${t.id} no hint names ${k}`);
  min(`reactive (${t.reactive.flag})`, c.reactive, t.reactive.min);
  for (const s of t.shops) if (!c.shops.includes(s)) out.push(`${t.id} no keeper sells ${s}`);
  if (t.inn !== null && c.inn !== t.inn) out.push(`${t.id} inn ${c.inn ?? 'none'} != ${t.inn}`);
  if (t.clinic && !c.clinic) out.push(`${t.id} has no clinic`);
  for (const id of t.requiredInteriors ?? []) if (!maps(id)) out.push(`${t.id} lacks ${id}`);
  return out;
}

const compiled = (id: string): TownMap | null => {
  const m = compiledMap(id);
  return m ? { id: m.id, npcs: m.npcs ?? [], transitions: m.transitions ?? [] } : null;
};

describe('townStandard: the counting rule', () => {
  const t = TOWN_TARGETS.find((x) => x.id === 'lufenia')!;
  const npc = (id: string, extra: Partial<TownNpc> = {}): TownNpc => ({ id, dialog: ['...'], ...extra });
  const town = (outdoor: number): Record<string, TownMap> => ({
    lufenia: { id: 'lufenia', transitions: ['lufenia-house-a', 'lufenia-house-b', 'lufenia-house-c', 'lufenia-white-magic', 'lufenia-black-magic', 'lufenia-inn']
      .map((targetMap) => ({ targetMap })),
    npcs: [...Array.from({ length: outdoor }, (_, i) => npc(`p${i}`, { dialog: [{ condition: 'LUFENIAN_LEARNED', text: ['Hello.'] }, { text: ['Zzk.'] }] })),
      npc('a_hint', { dialog: ['The Mirage stands east.'] }), npc('b_hint', { dialog: ['A cube opens it.'] }),
      npc('healer', { action: 'clinic' })] },
    'lufenia-house-a': { id: 'lufenia-house-a', npcs: [npc('h1'), npc('h2')], transitions: [] },
    'lufenia-house-b': { id: 'lufenia-house-b', npcs: [npc('h3'), npc('h4')], transitions: [] },
    'lufenia-house-c': { id: 'lufenia-house-c', npcs: [npc('h5')], transitions: [] },
    'lufenia-white-magic': { id: 'lufenia-white-magic', npcs: [npc('k1', { shopId: 'lufenia_white' })], transitions: [] },
    'lufenia-black-magic': { id: 'lufenia-black-magic', npcs: [npc('k2', { shopId: 'lufenia_black' })], transitions: [] },
    'lufenia-inn': { id: 'lufenia-inn', npcs: [npc('k3', { shopId: 'lufenia_inn' })], transitions: [] },
  });
  const shops: Shop[] = [{ id: 'lufenia_white' }, { id: 'lufenia_black' }, { id: 'lufenia_inn', type: 'inn', innPrice: 900 }];
  const source = 'objects:\n' + Array.from({ length: 4 }, () => '  - {type: house}').join('\n');

  it('a town at its targets passes', () => {
    const maps = town(8);
    const c = countTown(t, (id) => maps[id] ?? null, source, shops);
    expect(c).toMatchObject({ houses: 4, interiors: 3, outdoorNpcs: 10, interiorNpcs: 5, hints: 2, reactive: 8, inn: 900, clinic: true });
    expect(townErrors(t, c, (id) => maps[id] ?? null)).toEqual([]);
  });

  it('RED: too few people, too few reactive lines, a missing hint keyword, no inn', () => {
    const maps = town(3);
    maps.lufenia.npcs = maps.lufenia.npcs.filter((n) => n.id !== 'b_hint');
    const c = countTown(t, (id) => maps[id] ?? null, source, shops.slice(0, 2));
    expect(townErrors(t, c, (id) => maps[id] ?? null)).toEqual(['lufenia outdoorNpcs 4 < 10', 'lufenia hints 1 < 2',
      'lufenia no hint names cube', 'lufenia reactive (LUFENIAN_LEARNED) 3 < 6', 'lufenia inn none != 900']);
  });
});

describe('townStandard: the eight towns (target / actual)', () => {
  const shops = parse(readFileSync('assets/data/shops.yaml', 'utf-8')) as Shop[];
  for (const t of TOWN_TARGETS) {
    const built = isBuilt(t.map) && compiled(t.map) !== null;
    it.skipIf(!built && !STRICT)(`${t.id} meets its row${built ? '' : ' (pending: stub)'}`, () => {
      expect(built, `${t.map} is not built`).toBe(true);
      const c = countTown(t, compiled, sourceText(t.map) ?? '', shops);
      console.log(`${t.id}: houses ${c.houses}/${t.houses} interiors ${c.interiors}/${t.interiors} outdoor ${c.outdoorNpcs}/${t.outdoorNpcs} `
        + `interior ${c.interiorNpcs}/${t.interiorNpcs ?? '-'} hints ${c.hints}/${t.hints.count} reactive ${c.reactive}/${t.reactive.min} `
        + `shops ${c.shops.length}/${t.shops.length} inn ${c.inn ?? '-'}/${t.inn ?? '-'} clinic ${c.clinic}/${t.clinic}`);
      expect(townErrors(t, c, compiled)).toEqual([]);
    });
  }

  it('the targets cover the eight towns of quest.yaml', () => {
    const quest = parse(readFileSync('assets/data/quest.yaml', 'utf-8')) as { towns: Array<{ id: string }> };
    expect(TOWN_TARGETS.map((t) => t.id).sort()).toEqual(quest.towns.map((t) => t.id).sort());
  });
});
