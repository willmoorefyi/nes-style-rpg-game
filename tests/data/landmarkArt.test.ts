/**
 * LM-INT: the approved Bedrock landmark sheet (assets-src/gen/approved/overworld/landmarks_lm.json, re-cut by
 * assets-src/gen/landmark_cut.py from the render cache) and the volcano's ambient smoke on the world map.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { validateMapData } from '../../src/core/schemaValidation.js';

interface Entry { tag: string; cache_key: string; nobg_key?: string; model: string; seed: number; pass: string;
  cells: [number, number]; at: [number, number]; approved: string; cut: object; pixelize: object }
interface Sheet { tile: number; cells: (string | null)[][]; landmarks: Record<string, Entry> }

const sheet = JSON.parse(readFileSync('assets-src/gen/approved/overworld/landmarks_lm.json', 'utf-8')) as Sheet;
const ledger = readFileSync('assets-src/gen/cache/bedrock_ledger.jsonl', 'utf-8').trim().split('\n')
  .map((l) => JSON.parse(l) as { event: string; key?: string; pass?: string });
const PICKS: Record<string, string> = {
  volcano: 'volcano_ultra_b_21', buried_hull: 'buried_hull_ultra_d_42', windmill: 'windmill_ultra_a_13',
  cave_mouth: 'cave_mouth_ultra_a_12', tower: 'tower_ultra_a_3', shrine: 'shrine_ultra_a_3',
  dock_post: 'dock_post_ultra_a_3', sky_ring: 'sky_ring_ultra_b_4', ice_floe: 'ice_floe_ultra_a_1',
  waterfall: 'waterfall_ultra_b_3', tent: 'tent_ultra_a_1', dome: 'dome_ultra_a_2', tuft: 'tuft_ultra_a_2',
  town_melmond: 'town_melmond_ultra_a_2', town_onrac: 'town_onrac_ultra_a_2',
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

  it('names every cell <name>_icon_<r>_<c> at its landmark\'s place, 48 px', () => {
    expect(sheet.tile).toBe(48);
    for (const [name, e] of Object.entries(sheet.landmarks)) {
      const [w, h] = e.cells;
      const [r0, c0] = e.at;
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) expect(sheet.cells[r0 + r][c0 + c]).toBe(`${name}_icon_${r}_${c}`);
      }
    }
    const named = sheet.cells.flat().filter(Boolean);
    expect(new Set(named).size).toBe(named.length);
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
