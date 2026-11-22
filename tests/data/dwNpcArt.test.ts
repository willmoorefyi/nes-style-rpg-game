/**
 * Pass DW (the user's feedback of 2026-11-22: "dwarf NPCs needed for dwarf cave"): the dwarf field sheets, re-cut
 * offline by assets-src/gen/npc_field_cut.py (npc_field_dw.DW_SPEC), and where the maps place them.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { readRgbaPng } from '../helpers/pngAlpha.js';

type Npc = { id: string; sprite: string; tint?: string; wander?: boolean };
const npcs = (m: string) => (parse(readFileSync(`assets/maps/ai/${m}.yaml`, 'utf-8')) as { npcs: Npc[] }).npcs;
const meta = (id: string) => JSON.parse(readFileSync(`assets-src/gen/approved/${id}/field.json`, 'utf-8')) as {
  backend: string; pass: string; approved: string; grid: number[]; bottom_row: number; figure_px: number[];
  sources: { cache_key: string }[] };
const ledger = readFileSync('assets-src/gen/cache/bedrock_ledger.jsonl', 'utf-8').trim().split('\n')
  .map((l) => JSON.parse(l) as { event: string; key?: string; pass?: string; purpose?: string });
const atlas = JSON.parse(readFileSync('assets/sprites/characters-ai.json', 'utf-8')) as { sheets: Record<string, unknown> };

const ADULTS = ['dwarf_miner', 'dwarf_smith', 'dwarf_elder', 'dwarf_guard', 'dwarf_woman', 'dwarf_trader', 'dwarf_nerrick'];
const HERO_PX = 86;                                   // the shortest hero figure (warrior..knight: 86-90 px)

/** the 48x96 cell (row r, column c) of an approved field sheet, as its alpha mask */
function cell(id: string, r: number, c: number): boolean[] {
  const png = readRgbaPng(`assets-src/gen/approved/${id}/field.png`);
  const out: boolean[] = [];
  for (let y = 0; y < 96; y++) for (let x = 0; x < 48; x++) out.push(png.data[((r * 96 + y) * png.width + c * 48 + x) * 4 + 3] > 0);
  return out;
}

describe('DW: the dwarf field sheets', () => {
  it('are ar_dwarf renders re-cut offline: 48x96 cells, feet on row 93, in the 2x field atlas', () => {
    for (const id of [...ADULTS, 'dwarf_child']) {
      const m = meta(id);
      expect([m.backend, m.pass, m.approved, m.grid, m.bottom_row], id).toEqual(['bedrock', 'AR', '2026-11-22', [48, 96], 93]);
      for (const s of m.sources) {
        const row = ledger.find((r) => r.event === 'request' && r.key === s.cache_key);
        expect([row?.pass, row?.purpose], `${id} ${s.cache_key}`).toEqual(['AR', 'ar_dwarf']);
      }
      expect(m.figure_px, id).toHaveLength(9);
      expect(atlas.sheets[id], id).toBeDefined();
    }
  });

  it('are shorter than the heroes: the adults about 3/4 of a hero, the child smaller still', () => {
    for (const id of ADULTS) for (const h of meta(id).figure_px) {
      expect(h, id).toBeGreaterThanOrEqual(Math.round(0.72 * HERO_PX));
      expect(h, id).toBeLessThanOrEqual(Math.round(0.86 * HERO_PX));
    }
    for (const h of meta('dwarf_child').figure_px) expect(h, 'dwarf_child').toBeLessThanOrEqual(58);
  });

  it('the wandering dwarves (miner, child) step in every facing: each step frame differs from its stand', () => {
    for (const id of ['dwarf_miner', 'dwarf_child']) for (const r of [0, 1, 2]) {
      const stand = cell(id, r, 0).join();
      expect(cell(id, r, 1).join(), `${id} row ${r} step_left`).not.toEqual(stand);
      expect(cell(id, r, 2).join(), `${id} row ${r} step_right`).not.toEqual(stand);
    }
  });
});

describe('DW: where the dwarves stand', () => {
  it('every dwarf of the dwarf hall wears a dwarf sheet, untinted', () => {
    const hall = npcs('dwarf-hall');
    expect(hall.length).toBe(14);
    for (const n of hall) expect([n.id, n.sprite.startsWith('dwarf_'), n.tint], n.id).toEqual([n.id, true, undefined]);
    const want: [string, string][] = [['ert_nerrick', 'dwarf_nerrick'], ['ert_smyth', 'dwarf_smith'],
      ['ert_dwarf_elder', 'dwarf_elder'], ['ert_dwarf_scribe', 'dwarf_elder'], ['ert_dwarf_sentry', 'dwarf_guard'],
      ['ert_dwarf_lookout', 'dwarf_guard'], ['ert_dwarf_cook', 'dwarf_woman'], ['ert_dwarf_child', 'dwarf_child'],
      ['ert_dwarf_miner_a', 'dwarf_miner'], ['ert_dwarf_miner_b', 'dwarf_miner'], ['dwarf-item-keeper', 'dwarf_trader']];
    for (const [id, s] of want) expect(hall.find((x) => x.id === id)?.sprite, id).toBe(s);
    for (const n of hall.filter((x) => x.wander)) expect(['dwarf_miner', 'dwarf_child'], n.id).toContain(n.sprite);
  });

  it('the travelling dwarves of Melmond and Elfheim are dwarf traders, untinted', () => {
    for (const [m, id] of [['melmond', 'melmond_dwarf_trader'], ['elfheim', 'elfheim_dwarf_peddler']]) {
      const n = npcs(m).find((x) => x.id === id)!;
      expect([n.sprite, n.tint], id).toEqual(['dwarf_trader', undefined]);
    }
  });
});
