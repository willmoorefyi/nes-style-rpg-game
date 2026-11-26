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

  // NW-5: the world is pass NW's 256x256 map; each icon keeps pass W's door cell inside it (`walk_cells`, the frozen
  // pass W source) and its door is the cell of the world's transition into its town (the doors moved with the sites)
  const compiled = parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')) as {
    entrances: Record<string, [number, number]>; transitions: { x: number; y: number; targetMap: string }[] };
  const into = (m: string) => compiled.transitions.filter((t) => t.targetMap === m).map((t) => [t.x, t.y]);
  const passW = (parse(readFileSync('tests/fixtures/passW/overworld.yaml', 'utf-8')) as { objects: Obj[] }).objects;
  const passWOne = (lm: string) => uses(passW, lm)[0];

  it('the world icons: placed with their doors on the town transitions, each door where pass W had it in the icon', () => {
    const towns: [string, string][] = [['town_melmond', 'melmond'], ['town_onrac', 'onrac'], ['town_pravoka', 'pravoka'],
      ['town_elfheim', 'elfheim'], ['town_crescent', 'crescent'], ['town_gaia', 'gaia'], ['lufenia', 'lufenia']];
    const key = (cs: number[][]) => cs.map((c) => c.join(',')).sort();
    for (const [lm, map] of towns) {
      const o = at(world, lm);
      // PT-5 (docs/PLAYTEST_ELFHEIM_PLAN.md): Elfheim's door moved to the bottom-middle cell (its art's gate) and two
      // side doors joined it, so its walk cells are the three doors, not pass W's one (the fixture stays frozen)
      if (lm === 'town_elfheim') {
        expect(key(door(o)), lm).toEqual(key(into(map)));
        expect(key(o.walk_cells!), lm).toEqual(key([[1, 2], [0, 1], [2, 1]]));
        continue;
      }
      expect(door(o), lm).toEqual(into(map));
      expect(o.walk_cells, `${lm}: the door's cell in the icon`).toEqual(passWOne(lm).walk_cells);
    }
    for (const lm of ['mirage_tower', 'lighthouse', 'standing_stones', 'hermit_hut']) at(world, lm);
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

  it('LM5-INT: the keep and the citadel have their own icons, doors and anchors', () => {
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
    expect([keep.parts, keep.walk_cells]).toEqual([[
      ['western_keep_icon_0_0', 'western_keep_icon_0_1'], ['western_keep_icon_1_0', 'western_keep_icon_1_1'],
      ['western_keep_icon_2_0', 'western_keep_icon_2_1']], [[1, 2]]]);
    expect([citadel.parts.length, citadel.parts[0].length, citadel.walk_cells]).toEqual([3, 3, [[1, 2]]]);
    const pillars = world.filter((o) => (o.parts ?? []).flat().includes('tpillar_broken_top') && o.y === citadel.y + 1)
      .map((o) => o.x - citadel.x).sort((a, b) => a - b);
    expect(pillars, 'the citadel gate\'s broken pillars, either side of its icon').toEqual([-1, 3]);
    expect(world.filter((o) => (o.parts ?? []).flat().some((p) => p?.startsWith('castle_icon_'))), 'no shared castle icon')
      .toEqual([]);
    // the anchors are the cells below the doors, the doors the transitions into the keep and the citadel
    expect([compiled.entrances.elf_keep, compiled.entrances.ord_citadel])
      .toEqual([[door(keep)[0][0], door(keep)[0][1] + 1], [door(citadel)[0][0], door(citadel)[0][1] + 1]]);
    expect([into('western-keep-1f'), into('citadel-1f')]).toEqual([door(keep), door(citadel)]);
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
