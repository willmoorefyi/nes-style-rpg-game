/**
 * Pass AR (AR-N, AR-N2): the new NPC field sheets, re-cut offline by assets-src/gen/npc_field_cut.py
 * (npc_field_ar.AR_SPEC, the edit steps of npc_field_edit.py), and where the maps place them.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

type Npc = { id: string; sprite: string; tint?: string; wander?: boolean; action?: string; cutscene?: unknown;
  showIf?: string; hideIf?: string; chestItem?: string; requiredItem?: string; takeItem?: string; setFlag?: string };
const npcs = (m: string) => (parse(readFileSync(`assets/maps/ai/${m}.yaml`, 'utf-8')) as { npcs: Npc[] }).npcs;
const meta = (id: string) => JSON.parse(readFileSync(`assets-src/gen/approved/${id}/field.json`, 'utf-8')) as {
  backend: string; pass: string; approved: string; grid: number[]; bottom_row: number; figure_px: number[];
  sources: { cache_key: string; pass: string }[]; edits: { op: string }[]; cells: [string, number, boolean][][] };
const ledger = readFileSync('assets-src/gen/cache/bedrock_ledger.jsonl', 'utf-8').trim().split('\n')
  .map((l) => JSON.parse(l) as { event: string; key?: string; pass?: string; purpose?: string });
const atlas = JSON.parse(readFileSync('assets/sprites/characters-ai.json', 'utf-8')) as { sheets: Record<string, unknown> };

const IDS = ['luf_citizen_m', 'luf_citizen_f', 'luf_senator', 'dragon_guard', 'dragon_elder', 'dragon_youth',
  'robot_sentry', 'sage_star', 'sage_earth', 'sage_flame', 'dr_unne'];

describe('AR: the new NPC field sheets', () => {
  it('are AR renders re-cut offline: 48x96 cells, feet on row 93, hero-sized, in the 2x field atlas', () => {
    for (const id of IDS) {
      const m = meta(id);
      expect([m.backend, m.pass, m.approved, m.grid, m.bottom_row], id).toEqual(['bedrock', 'AR', '2026-11-21', [48, 96], 93]);
      for (const s of m.sources) {
        const row = ledger.find((r) => r.event === 'request' && r.key === s.cache_key);
        expect([row?.pass, row?.purpose], `${id} ${s.cache_key}`).toEqual(['AR', 'ar_npc']);
      }
      for (const h of m.figure_px) expect(h, id).toBeGreaterThanOrEqual(84);
      expect(atlas.sheets[id], id).toBeDefined();
    }
  });

  it('the ancient robot is AR-N2\'s candidate C2 (user ruling 2026-11-22): A\'s front and back, a profile side strip', () => {
    const m = meta('robot_ancient');
    expect([m.backend, m.pass, m.approved, m.grid, m.bottom_row]).toEqual(['bedrock', 'AR', '2026-11-22', [48, 96], 93]);
    for (const s of m.sources) {
      const row = ledger.find((r) => r.event === 'request' && r.key === s.cache_key);
      expect([row?.pass, row?.purpose], s.cache_key).toEqual(['AR', 'ar_npc']);
    }
    expect(m.sources.map((s) => s.cache_key)).toEqual(['b17a82a4b94a637b57ca16de', '5495bcf0e9c6bde34f0d68bd',
      'a2164dec4999f32b063f64e0']);
    expect(m.cells.map((r) => r[0][0]), 'down, up, side').toEqual(['s50_1', 'b50_2', 'd65_3']);
    for (const h of m.figure_px) expect(h).toBeGreaterThanOrEqual(84);
    expect(atlas.sheets.robot_ancient).toBeDefined();
  });

  it('carry the user\'s edit rulings of 2026-11-21', () => {
    expect(meta('dragon_youth').cells[2].map((c) => c[2]), 'the youth\'s side steps mirrored').toEqual([false, true, true]);
    expect(meta('dragon_youth').edits.map((e) => e.op)).toEqual(['erase']);
    expect(meta('robot_sentry').edits.map((e) => e.op)).toEqual(['ramp', 'fill']);
    expect(meta('dr_unne').edits.map((e) => e.op)).toEqual(['ramp', 'ramp']);
    const f = meta('luf_citizen_f').cells;
    expect([f[0][0][0], f[1][0][0], f[2][0][0]], 'A\'s down and up rows, B\'s side row').toEqual(['s55_2', 's55_2', 's55_1']);
  });
});

describe('AR: where the maps place them', () => {
  const sprite = (m: string, id: string) => npcs(m).find((n) => n.id === id);

  it('Lufenia: the citizens and the senator, untinted', () => {
    const want: [string, string, string][] = [
      ['lufenia', 'lufenia_orrery_tender', 'luf_senator'], ['lufenia', 'lufenia_archivist', 'luf_senator'],
      ['lufenia', 'lufenia_lens_grinder', 'luf_citizen_m'], ['lufenia', 'lufenia_watcher', 'luf_citizen_m'],
      ['lufenia', 'lufenia_weaver', 'luf_citizen_f'], ['lufenia', 'lufenia_gardener', 'luf_citizen_f'],
      ['lufenia-house-elder', 'lufenia_elder', 'luf_senator'], ['lufenia-house-elder', 'lufenia_attendant', 'luf_citizen_f'],
      ['lufenia-house-healer', 'lufenia_patient', 'luf_citizen_m']];
    for (const [m, id, s] of want) expect([sprite(m, id)?.sprite, sprite(m, id)?.tint], id).toEqual([s, undefined]);
  });

  it('the dragons of Bahamut\'s lair, the Circle\'s three sages and Dr. Unne', () => {
    const lair = Object.fromEntries(npcs('bahamut-lair').filter((n) => n.id.startsWith('dragon_')).map((n) => [n.id, n.sprite]));
    expect(lair).toEqual({ dragon_ember: 'dragon_guard', dragon_storm: 'dragon_guard', dragon_moss: 'dragon_elder',
      dragon_frost: 'dragon_elder', dragon_tide: 'dragon_youth', dragon_ash: 'dragon_youth' });
    const circle = npcs('crescent-circle');
    for (const [id, s] of [['sage_east', 'sage_star'], ['sage_moss', 'sage_earth'], ['sage_ash', 'sage_flame']]) {
      const n = circle.find((x) => x.id === id)!;
      expect([n.sprite, n.tint], id).toEqual([s, undefined]);
    }
    // sage_star's side frames turn the head but do not walk: it must not wander until they are regenerated
    for (const n of circle.filter((x) => x.sprite === 'sage_star')) expect(n.wander, n.id).toBeFalsy();
    expect(sprite('melmond-house-unne', 'ert_unne')?.sprite).toBe('dr_unne');
  });

  it('the sky castle\'s robot sentries are flavour only', () => {
    const sentries = ['sky-castle-1f', 'sky-castle-2f'].flatMap((m) => npcs(m).filter((n) => n.sprite === 'robot_sentry'));
    expect(sentries.map((n) => n.id)).toEqual(['wnd_sentry_hub', 'wnd_sentry_east']);
    for (const n of sentries) {
      expect([n.action, n.cutscene, n.showIf, n.hideIf, n.chestItem, n.requiredItem, n.takeItem, n.setFlag, n.wander], n.id)
        .toEqual(Array(9).fill(undefined));
    }
  });

  it('the ancient robots on 3F and 4F are flavour only, off the sentries\' floors', () => {
    const ancients = ['sky-castle-1f', 'sky-castle-2f', 'sky-castle-3f', 'sky-castle-4f', 'sky-castle-5f']
      .flatMap((m) => npcs(m).filter((n) => n.sprite === 'robot_ancient').map((n) => [m, n] as const));
    expect(ancients.map(([m, n]) => `${m}:${n.id}`)).toEqual(['sky-castle-3f:wnd_ancient_archive',
      'sky-castle-4f:wnd_ancient_stoker']);
    for (const [, n] of ancients) {
      expect([n.action, n.cutscene, n.showIf, n.hideIf, n.chestItem, n.requiredItem, n.takeItem, n.setFlag, n.wander, n.tint],
        n.id).toEqual(Array(10).fill(undefined));
    }
  });

  it('the dragon-kin guards no longer speak of wearing a man\'s shape', () => {
    const text = JSON.stringify(npcs('bahamut-lair').filter((n) => n.id.startsWith('dragon_')));
    expect(text).not.toMatch(/man's shape|in this shape|scales show/);
  });
});
