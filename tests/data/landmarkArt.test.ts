/**
 * LM-INT / LM4-INT: the approved Bedrock landmark sheets (assets-src/gen/approved/overworld/landmarks_lm.json and
 * landmarks_lm4.json, re-cut by assets-src/gen/landmark_cut.py from the render cache), their placement on the world
 * and town maps, and the volcano's ambient smoke on the world map.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { validateMapData } from '../../src/core/schemaValidation.js';

interface Entry { tag: string; cache_key: string; nobg_key?: string; model: string; seed: number; pass: string;
  cells: [number, number]; at: [number, number]; approved: string; cut: object; pixelize: object }
interface Sheet { tile: number; cells: (string | null)[][]; landmarks: Record<string, Entry> }

const read = (n: string) => JSON.parse(readFileSync(`assets-src/gen/approved/overworld/${n}.json`, 'utf-8')) as Sheet;
const sheet = read('landmarks_lm');
const sheet4 = read('landmarks_lm4');
const sheet5 = read('landmarks_lm5');
const ledger = readFileSync('assets-src/gen/cache/bedrock_ledger.jsonl', 'utf-8').trim().split('\n')
  .map((l) => JSON.parse(l) as { event: string; key?: string; pass?: string });
const PICKS: Record<string, string> = {
  volcano: 'volcano_ultra_b_21', buried_hull: 'buried_hull_ultra_d_42', windmill: 'windmill_ultra_a_13',
  cave_mouth: 'cave_mouth_ultra_a_12', tower: 'tower_ultra_a_3', shrine: 'shrine_ultra_a_3',
  dock_post: 'dock_post_ultra_a_3', sky_ring: 'sky_ring_ultra_b_4', ice_floe: 'ice_floe_ultra_a_1',
  waterfall: 'waterfall_ultra_b_3', tent: 'tent_ultra_a_1', dome: 'dome_ultra_a_2', tuft: 'tuft_ultra_a_2',
};
// LM4 (the user's picks, 2026-11-19): name -> [tag, cells wide, high]
const PICKS4: Record<string, [string, number, number]> = {
  town_melmond: ['town_melmond_ultra_a_1', 4, 3], town_onrac: ['town_onrac_ultra_a_2', 5, 3],
  town_pravoka: ['town_pravoka_ultra_a_3', 3, 3], town_elfheim: ['town_elfheim_ultra_a_3', 3, 3],
  town_crescent: ['town_crescent_ultra_b_4', 3, 3], town_gaia: ['town_gaia_ultra_a_3', 3, 2],
  lufenia: ['lufenia_ultra_a_3', 4, 2], brig: ['brig_ultra_b_4', 4, 3], submarine: ['submarine_ultra_b_6', 4, 2],
  fishing_boat: ['fishing_boat_ultra_a_3', 3, 2], bell_tower: ['bell_tower_ultra_a_2', 2, 3],
  lighthouse: ['lighthouse_ultra_a_3', 2, 3], mirage_tower: ['mirage_tower_ultra_a_1', 2, 3],
  standing_stones: ['standing_stones_ultra_a_1', 2, 2], hermit_hut: ['hermit_hut_ultra_a_3', 2, 2],
};

describe('the approved landmark sheet', () => {
  it('holds the user\'s picks, each from a ledgered LM / LM2 render', () => {
    expect(Object.fromEntries(Object.entries(sheet.landmarks).map(([n, e]) => [n, e.tag]))).toEqual(PICKS);
    for (const [name, e] of Object.entries(sheet.landmarks)) {
      const row = ledger.find((r) => r.event === 'request' && r.key === e.cache_key);
      expect(row, `${name}: ${e.cache_key} in the BR ledger`).toBeDefined();
      expect(['LM', 'LM2']).toContain(row!.pass);
      expect(e.pass).toBe(row!.pass);
      expect(e.approved).toBe('2026-11-19');
      if (e.nobg_key) expect(ledger.some((r) => r.key === e.nobg_key), `${name}: remove_bg key`).toBe(true);
    }
    expect(sheet.landmarks.windmill.nobg_key).toBeDefined();
    expect(sheet.landmarks.cave_mouth.nobg_key).toBeDefined();
  });

  it('LM4: holds the user\'s LM4 picks at their sizes, each from a ledgered LM4 render', () => {
    expect(Object.fromEntries(Object.entries(sheet4.landmarks).map(([n, e]) => [n, [e.tag, ...e.cells]])))
      .toEqual(PICKS4);
    for (const [name, e] of Object.entries(sheet4.landmarks)) {
      const row = ledger.find((r) => r.event === 'request' && r.key === e.cache_key);
      expect(row, `${name}: ${e.cache_key} in the BR ledger`).toBeDefined();
      expect(row!.pass).toBe('LM4');
      expect(e.pass).toBe('LM4');
      expect(e.approved).toBe('2026-11-19');
      if (e.nobg_key) expect(ledger.some((r) => r.key === e.nobg_key), `${name}: remove_bg key`).toBe(true);
    }
    expect(sheet4.landmarks.fishing_boat.nobg_key).toBeDefined();
  });

  it('names every cell <name>_icon_<r>_<c> at its landmark\'s place, 48 px, no name in both sheets', () => {
    for (const sh of [sheet, sheet4, sheet5]) {
      expect(sh.tile).toBe(48);
      for (const [name, e] of Object.entries(sh.landmarks)) {
        const [w, h] = e.cells;
        const [r0, c0] = e.at;
        for (let r = 0; r < h; r++) {
          for (let c = 0; c < w; c++) expect(sh.cells[r0 + r][c0 + c]).toBe(`${name}_icon_${r}_${c}`);
        }
      }
    }
    const named = [...sheet.cells.flat(), ...sheet4.cells.flat(), ...sheet5.cells.flat()].filter(Boolean);
    expect(new Set(named).size).toBe(named.length);
  });
});

describe('LM4-INT: the LM4 art at its sites', () => {
  type Obj = { type: string; name?: string; x: number; y: number; parts: (string | null)[][];
    walk_cells?: [number, number][]; style?: string };
  const objs = (m: string) => (parse(readFileSync(`assets-src/maps/${m}.yaml`, 'utf-8')) as { objects: Obj[] }).objects;
  const world = objs('overworld');
  const uses = (os: Obj[], lm: string) => os.filter((o) => (o.parts ?? []).flat().some((p) => p?.startsWith(`${lm}_icon_`)));
  const at = (os: Obj[], lm: string) => {
    const found = uses(os, lm);
    expect(found, lm).toHaveLength(1);
    const [w, h] = PICKS4[lm].slice(1) as [number, number];
    expect([found[0].parts[0].length, found[0].parts.length], lm).toEqual([w, h]);
    expect(found[0].style, `${lm}: no recolour style`).toBeUndefined();
    return found[0];
  };
  const door = (o: Obj) => (o.walk_cells ?? []).map(([i, j]) => [o.x + i, o.y + j]);

  it('the world icons: placed with their doors on the unchanged door cells', () => {
    expect([at(world, 'town_melmond')].map((o) => [o.x, o.y, ...door(o)])).toEqual([[38, 111, [41, 112]]]);
    expect([at(world, 'town_onrac')].map((o) => [o.x, o.y, ...door(o)])).toEqual([[26, 36, [28, 38]]]);
    expect([at(world, 'town_pravoka')].map((o) => [o.x, o.y, ...door(o)])).toEqual([[130, 98, [131, 100]]]);
    expect([at(world, 'town_elfheim')].map((o) => [o.x, o.y, ...door(o)])).toEqual([[81, 151, [82, 151]]]);
    expect([at(world, 'town_crescent')].map((o) => [o.x, o.y, ...door(o)])).toEqual([[149, 123, [149, 124]]]);
    expect([at(world, 'town_gaia')].map((o) => [o.x, o.y, ...door(o)])).toEqual([[150, 12, [150, 13]]]);
    expect([at(world, 'lufenia')].map((o) => [o.x, o.y, ...door(o)])).toEqual([[150, 44, [152, 45]]]);
    expect([at(world, 'mirage_tower')].map((o) => [o.x, o.y])).toEqual([[131, 34]]);
    expect([at(world, 'lighthouse')].map((o) => [o.x, o.y])).toEqual([[138, 98]]);
    expect([at(world, 'standing_stones')].map((o) => [o.x, o.y])).toEqual([[159, 123]]);
    expect([at(world, 'hermit_hut')].map((o) => [o.x, o.y])).toEqual([[118, 38]]);
    expect(uses(world, 'dome'), 'Lufenia\'s domes are gone').toEqual([]);
    expect(uses(world, 'town_icon'), 'no generic walled-town icon is left').toEqual([]);
  });

  it('the boats and towers in the towns; the buried hull is only FIRE\'s airship hull', () => {
    const pravoka = objs('pravoka'), onrac = objs('onrac');
    expect([at(pravoka, 'brig')].map((o) => [o.x, o.y])).toEqual([[34, 35]]);
    expect([at(pravoka, 'lighthouse')].map((o) => [o.x, o.y])).toEqual([[41, 10]]);
    expect([at(onrac, 'fishing_boat')].map((o) => [o.x, o.y])).toEqual([[14, 37]]);
    expect([at(onrac, 'submarine')].map((o) => [o.x, o.y])).toEqual([[39, 26]]);
    expect([at(onrac, 'bell_tower')].map((o) => [o.x, o.y])).toEqual([[27, 17]]);
    for (const m of ['pravoka', 'onrac']) expect(uses(objs(m), 'buried_hull'), m).toEqual([]);
    expect(uses(world, 'buried_hull').map((o) => o.name)).toEqual(['buried_hull']);
  });

  it('LM5-INT: the keep and the citadel have their own icons, doors and anchors unchanged', () => {
    expect(Object.fromEntries(Object.entries(sheet5.landmarks).map(([n, e]) => [n, [e.tag, ...e.cells]]))).toEqual({
      western_keep: ['western_keep_ultra_a_3', 2, 3], citadel: ['citadel_ultra_a_2', 3, 3] });
    for (const [name, e] of Object.entries(sheet5.landmarks)) {
      const row = ledger.find((r) => r.event === 'request' && r.key === e.cache_key);
      expect(row?.pass, `${name}: ${e.cache_key} an LM5 render`).toBe('LM5');
      expect([e.pass, e.approved]).toEqual(['LM5', '2026-11-19']);
    }
    const one = (name: string) => {
      const found = world.filter((o) => o.name === name);
      expect(found, name).toHaveLength(1);
      expect(found[0].style, `${name}: no recolour`).toBeUndefined();
      return found[0];
    };
    const keep = one('western_keep'), citadel = one('citadel');
    expect([keep.x, keep.y, keep.parts, door(keep)]).toEqual([59, 122, [
      ['western_keep_icon_0_0', 'western_keep_icon_0_1'], ['western_keep_icon_1_0', 'western_keep_icon_1_1'],
      ['western_keep_icon_2_0', 'western_keep_icon_2_1']], [[60, 124]]]);
    expect([citadel.x, citadel.y, citadel.parts.length, citadel.parts[0].length, door(citadel)])
      .toEqual([74, 25, 3, 3, [[75, 27]]]);
    const pillars = world.filter((o) => (o.parts ?? []).flat().includes('tpillar_broken_top') && o.y === 26)
      .map((o) => o.x).sort((a, b) => a - b);
    expect(pillars, 'the citadel gate\'s broken pillars').toEqual([73, 77]);
    expect(world.filter((o) => (o.parts ?? []).flat().some((p) => p?.startsWith('castle_icon_'))), 'no shared castle icon')
      .toEqual([]);
    const compiled = parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')) as {
      entrances: Record<string, [number, number]>; transitions: { x: number; y: number; targetMap: string }[] };
    expect([compiled.entrances.elf_keep, compiled.entrances.ord_citadel]).toEqual([[60, 125], [75, 28]]);
    const into = (m: string) => compiled.transitions.filter((t) => t.targetMap === m).map((t) => [t.x, t.y]);
    expect([into('western-keep-1f'), into('citadel-1f')]).toEqual([[[60, 124]], [[75, 27]]]);
  });
});

describe('LM5-INT: the fairy and the mermaids have their own field sheets', () => {
  type Npc = { id: string; sprite: string; tint?: string };
  const npcs = (m: string) => (parse(readFileSync(`assets-src/maps/${m}.yaml`, 'utf-8')) as { npcs: Npc[] }).npcs;
  const meta = (id: string) => JSON.parse(readFileSync(`assets-src/gen/approved/${id}/field.json`, 'utf-8')) as {
    backend: string; pass: string; approved: string; grid: number[]; bottom_row: number; figure_px: number[];
    sources: { cache_key: string; pass: string }[] };

  it('the approved sheets: LM5 renders re-cut offline, 48x96 cells with the feet on row 93', () => {
    for (const id of ['fairy', 'mermaid']) {
      const m = meta(id);
      expect([m.backend, m.pass, m.approved, m.grid, m.bottom_row], id).toEqual(['bedrock', 'LM5', '2026-11-19', [48, 96], 93]);
      for (const s of m.sources) {
        expect(ledger.find((r) => r.event === 'request' && r.key === s.cache_key)?.pass, `${id} ${s.cache_key}`).toBe('LM5');
      }
    }
    // the fairy at about 2/3 of a hero's 90 px; the mermaid at full size
    for (const h of meta('fairy').figure_px) {
      expect(h).toBeGreaterThanOrEqual(56);
      expect(h).toBeLessThanOrEqual(66);
    }
    for (const h of meta('mermaid').figure_px) expect(h).toBeGreaterThanOrEqual(80);
  });

  it('the spring fairy and every sea-shrine mermaid use them, untinted', () => {
    const fairy = npcs('gaia-spring').find((n) => n.id === 'gaia_fairy')!;
    expect([fairy.sprite, fairy.tint]).toEqual(['fairy', undefined]);
    const folk = npcs('sea-shrine-b1').filter((n) => n.id.startsWith('wat_d_'));
    expect(folk.map((n) => n.id)).toEqual(['wat_d_elder', 'wat_d_tide_hint', 'wat_d_storm_hint', 'wat_d_singer']);
    for (const n of folk) expect([n.sprite, n.tint], n.id).toEqual(['mermaid', undefined]);
  });
});

describe('the volcano smokes', () => {
  const src = parse(readFileSync('assets-src/maps/overworld.yaml', 'utf-8')) as {
    objects: { name?: string; x: number; y: number }[]; ambient: { kind: string; x: number; y: number }[] };
  const compiled = parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')) as Record<string, unknown>;

  it('one smoke source on the volcano icon\'s top middle cell, in the source and the compiled map', () => {
    const v = src.objects.find((o) => o.name === 'volcano')!;
    expect(src.ambient).toEqual([{ kind: 'smoke', x: v.x + 1, y: v.y, ox: 26, oy: 12 }]);
    expect(compiled.ambient).toEqual(src.ambient);
    expect(validateMapData(compiled).ambient).toHaveLength(1);
  });
});
