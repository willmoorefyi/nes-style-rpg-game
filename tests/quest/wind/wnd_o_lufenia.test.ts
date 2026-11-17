/**
 * WND-O: Lufenia (docs/WORLD_PLAN.md 4.7, 3.5, D-W4) on its compiled maps: every outdoor Lufenian speaks the old
 * tongue until LUFENIAN_LEARNED and plain speech after it; every keeper (the magic shops, the inn, the clinic) is
 * shown only with LUFENIAN_LEARNED; the elder gives the chime once, through `wnd_chime_given`, only once the party can
 * read Lufenian; the shops sell L8 magic and the inn costs 900 (3.6 B8).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { npcOutcome } from '../../../src/systems/fieldRules.js';
import { npcPresent, resolveNPCDialog, type MapData, type MapNPC } from '../../../src/types/index.js';

const load = (id: string): MapData => parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8')) as MapData;
const ROOMS = ['lufenia-house-stargazer', 'lufenia-house-elder', 'lufenia-house-healer', 'lufenia-white-magic',
  'lufenia-black-magic', 'lufenia-inn'];
const town = load('lufenia');
const rooms = ROOMS.map(load);
const all = [town, ...rooms].flatMap((m) => m.npcs.map((n) => ({ map: m.id, n })));
const isKeeper = (n: MapNPC): boolean => !!n.shopId || n.action === 'inn' || n.action === 'clinic';
const state = (...flags: string[]) => ({ flags: new Set(flags), items: new Set<string>(), mode: 'walking' as const, vehicles: [] });
const says = (n: MapNPC, ...flags: string[]): string[] => resolveNPCDialog(n.dialog, (f) => flags.includes(f));

describe('WND-O Lufenia: the old tongue and the language gate', () => {
  it('the town links its 3 houses, 2 magic shops and inn by their canon entrances', () => {
    expect([...new Set(town.transitions.map((t) => t.targetMap))].sort()).toEqual(['overworld', ...ROOMS].sort());
    expect(Object.keys(town.entrances!).sort()).toEqual(['black_magic', 'gate', 'house_elder', 'house_healer',
      'house_stargazer', 'inn', 'white_magic']);
  });

  it('every outdoor Lufenian speaks the old tongue first, plain speech with LUFENIAN_LEARNED', () => {
    const people = town.npcs.filter((n) => !isKeeper(n));
    expect(people.length).toBeGreaterThanOrEqual(10);
    for (const n of people) {
      const before = says(n);
      const after = says(n, 'LUFENIAN_LEARNED');
      expect(before, n.id).toHaveLength(1);
      expect(after.join(' '), n.id).not.toEqual(before.join(' '));
      expect(before[0], n.id).not.toMatch(/\b(the|and|you|is|a|of|to|we|it)\b/i);    // no plain word in the tongue
    }
  });

  it('the hints name the Mirage and the cube once the tongue is learned', () => {
    const hints = all.filter(({ n }) => n.id.endsWith('_hint')).map(({ n }) => says(n, 'LUFENIAN_LEARNED').join(' '));
    expect(hints.some((l) => l.includes('Mirage'))).toBe(true);
    expect(hints.some((l) => l.includes('cube'))).toBe(true);
  });

  it('every keeper is shown only with LUFENIAN_LEARNED (GT-30)', () => {
    const keepers = all.filter(({ n }) => isKeeper(n));
    expect(keepers.map(({ n }) => n.shopId ?? n.action).sort()).toEqual(['clinic', 'lufenia_black', 'lufenia_inn', 'lufenia_white']);
    for (const { n } of keepers) {
      expect(npcPresent(n, () => false), n.id).toBe(false);
      expect(npcPresent(n, (f) => f === 'LUFENIAN_LEARNED'), n.id).toBe(true);
    }
  });

  it('the elder gives the chime once, only with LUFENIAN_LEARNED (GT-29)', () => {
    const elder = rooms[1].npcs.find((n) => n.id === 'lufenia_elder')!;
    expect(npcOutcome(elder, state(), []).cutscene).toBeUndefined();
    expect(npcOutcome(elder, state('LUFENIAN_LEARNED'), []).cutscene).toBe('wnd_chime_given');
    expect(npcOutcome(elder, state('LUFENIAN_LEARNED', 'CHIME_GIVEN'), []).cutscene).toBeUndefined();
    const scenes = parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{ id: string; steps: Array<Record<string, string>> }>;
    const steps = scenes.find((c) => c.id === 'wnd_chime_given')!.steps;
    expect(steps.filter((s) => s.type === 'give_item').map((s) => s.item)).toEqual(['chime']);
    expect(steps.filter((s) => s.type === 'set_flag').map((s) => s.flag)).toEqual(['CHIME_GIVEN']);
  });

  it('the shops sell L8 magic, the inn costs 900 and the clinic 150 per level (3.6 B8)', () => {
    const shops = parse(readFileSync('assets/data/shops.yaml', 'utf-8')) as Array<{ id: string; inventory: string[]; innPrice?: number }>;
    const spells = parse(readFileSync('assets/data/spells.yaml', 'utf-8')) as Array<{ id: string; level: number }>;
    for (const id of ['lufenia_white', 'lufenia_black']) {
      const inv = shops.find((s) => s.id === id)!.inventory;
      expect(inv.length, id).toBeGreaterThan(0);
      expect(inv.map((s) => spells.find((x) => x.id === s)!.level), id).toEqual(inv.map(() => 8));
    }
    expect(shops.find((s) => s.id === 'lufenia_inn')!.innPrice).toBe(900);
    expect(all.find(({ n }) => n.action === 'clinic')!.n.clinicPrice).toBe(150);
  });

  it('every room exits back to its own entrance in town', () => {
    for (const m of rooms) {
      const out = m.transitions.filter((t) => t.targetMap === 'lufenia');
      expect(out.length, m.id).toBeGreaterThan(0);
      const back = (out[0] as { targetEntrance?: string }).targetEntrance!;
      expect(town.entrances![back], `${m.id} -> ${back}`).toBeDefined();
    }
  });
});
