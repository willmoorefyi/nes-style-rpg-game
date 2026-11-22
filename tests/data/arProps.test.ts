/**
 * AR-P2: the approved AR dungeon-prop sheet (assets-src/gen/approved/dungeon/props_ar.json, re-cut by
 * assets-src/gen/prop_cut.py from the render cache), the props placed in the dungeon sources
 * (assets-src/tools/layouts/props_ar_maps.py through common.Room.write) and their compiled flame lights.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { validateMapData } from '../../src/core/schemaValidation.js';
import type { FlameEffect } from '../../src/types/ambient.js';

interface Flame { style: string; x: number; y: number; rows: string[]; tongue: boolean; glow: number }
interface Prop { tag: string; cache_key: string; pass: string; model: string; seed: number; cells: [number, number];
  at: [number, number]; place: 'floor' | 'wall'; approved: string; flame?: Flame }
interface Sheet { tile: number; backend: string; cells: (string | null)[][]; props: Record<string, Prop> }

const sheet = JSON.parse(readFileSync('assets-src/gen/approved/dungeon/props_ar.json', 'utf-8')) as Sheet;
const ledger = readFileSync('assets-src/gen/cache/bedrock_ledger.jsonl', 'utf-8').trim().split('\n')
  .map((l) => JSON.parse(l) as { event: string; key?: string; pass?: string; purpose?: string });

// the user's rulings of 2026-11-21: AR-P's strong picks, the weak-but-usable ones, the ice block (the stoppers' art)
// and the two re-rolls (wall torch on stone, cobweb with thick threads)
const STRONG = ['portcullis_closed', 'portcullis_open', 'iron_door', 'bar_gate', 'brazier_tall', 'standing_torch',
  'candelabra', 'cauldron_brew', 'cauldron_fire', 'fiend_brazier', 'sun_brazier', 'lava_vent', 'magma_mound',
  'obsidian_spire', 'crystal_cluster', 'crystal_tall', 'mine_cart_gold', 'mine_cart_ore', 'ice_pillar', 'ice_spire',
  'ice_shards', 'frozen_knight', 'coral_pink', 'kelp', 'clam_altar', 'console', 'light_pylon', 'pipes', 'sand_urn',
  'obelisk', 'ruin_column_rune', 'sealed_coffin', 'stone_coffin', 'cage_floor', 'cage_hanging', 'bone_pile',
  'skeleton_slumped', 'mushrooms_glow', 'barrels', 'barrel_tipped', 'stalagmite'];
const WEAK = ['wall_chains', 'bog_lantern', 'fire_idol', 'robot_husk', 'skull', 'bookshelf_ruined', 'ice_block'];
const REROLLED: Record<string, string> = { wall_torch: 'torch_ultra_11', cobweb: 'web_ultra_23_k' };
// pass CD (docs/CARDIA_PLAN.md 6.1): props approved after the 2026-11-21 rulings
const LATER: Record<string, { purpose: string; approved: string }> = {
  drake_brazier: { purpose: 'ar_dragon', approved: '2026-11-22' },
};
const LIT = ['drake_brazier', 'wall_torch', 'standing_torch', 'brazier_tall', 'candelabra', 'cauldron_brew', 'cauldron_fire',
  'fiend_brazier', 'sun_brazier', 'bog_lantern', 'fire_idol', 'lava_vent', 'magma_mound', 'mushrooms_glow', 'console',
  'light_pylon'];

const DUNGEONS = ['marsh-cave-b1', 'marsh-cave-b2', 'marsh-cave-b3', 'western-keep-1f', 'western-keep-2f',
  'cavern-earth-b1', 'cavern-earth-b2', 'cavern-earth-b3', 'cavern-earth-b4', 'cavern-earth-b5', 'giant-tunnel',
  'gurgu-b1', 'gurgu-b2', 'gurgu-b3', 'gurgu-b4', 'gurgu-b5', 'ice-cavern-b1', 'ice-cavern-b2', 'ice-cavern-b3',
  'sea-shrine-b1', 'sea-shrine-b2', 'sea-shrine-b3', 'sea-shrine-b4', 'sea-shrine-b5', 'waterfall-cave',
  'sky-castle-1f', 'sky-castle-2f', 'sky-castle-3f', 'sky-castle-4f', 'sky-castle-5f', 'mirage-1f', 'mirage-2f',
  'mirage-3f', 'past-temple-1', 'past-temple-2', 'past-temple-3', 'past-temple-4', 'past-temple-5', 'past-chaos',
  'citadel-1f', 'citadel-2f', 'citadel-3f', 'cardia-deep'];

interface Obj { type: string; parts?: (string | null)[][]; x: number; y: number; on_wall?: boolean; above_rows?: number }
const source = (id: string) => parse(readFileSync(`assets-src/maps/${id}.yaml`, 'utf-8')) as {
  ground: string; objects: Obj[]; ambient?: { kind: string; prop?: string; x: number; y: number }[] };
const compiled = (id: string) => parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8')) as Record<string, unknown>;
const propOf = (o: Obj): string | null => {
  const m = /^ar_(.+)_0_0$/.exec(o.parts?.[0]?.[0] ?? '');
  return m ? m[1] : null;
};

describe('the AR dungeon-prop sheet', () => {
  it('holds exactly the usable set of the rulings, each from a ledgered AR ar_props render', () => {
    expect(Object.keys(sheet.props).sort())
      .toEqual([...STRONG, ...WEAK, ...Object.keys(REROLLED), ...Object.keys(LATER)].sort());
    expect(sheet.backend).toBe('bedrock');
    for (const [id, p] of Object.entries(sheet.props)) {
      const row = ledger.find((r) => r.event === 'request' && r.key === p.cache_key);
      expect(row, `${id}: ${p.cache_key} in the BR ledger`).toBeDefined();
      expect(row!.pass).toBe('AR');
      expect(row!.purpose).toBe(id in LATER ? LATER[id].purpose : 'ar_props');
      expect(p.pass).toBe('AR');                       // ar_dragon is a pass AR purpose too
      expect(p.approved).toBe(id in LATER ? LATER[id].approved : '2026-11-21');
    }
    for (const [id, tag] of Object.entries(REROLLED)) expect(sheet.props[id].tag).toBe(tag);
  });

  it('names its cells ar_<id>_<r>_<c> at each prop\'s place, the wall props marked', () => {
    for (const [id, p] of Object.entries(sheet.props)) {
      const [w, h] = p.cells;
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
        expect(sheet.cells[p.at[0] + r][p.at[1] + c]).toBe(`ar_${id}_${r}_${c}`);
      }
    }
    expect(Object.entries(sheet.props).filter(([, p]) => p.place === 'wall').map(([id]) => id).sort())
      .toEqual(['bar_gate', 'cobweb', 'iron_door', 'portcullis_closed', 'portcullis_open', 'wall_chains', 'wall_torch']);
  });

  it('gives every lit prop a flame mask inside its box', () => {
    expect(Object.keys(sheet.props).filter((id) => sheet.props[id].flame).sort()).toEqual([...LIT].sort());
    for (const id of LIT) {
      const { flame: f, cells: [w, h] } = sheet.props[id];
      expect(f!.rows.length).toBeGreaterThan(2);
      expect(f!.x + f!.rows[0].length).toBeLessThanOrEqual(w * 48);
      expect(f!.y + f!.rows.length).toBeLessThanOrEqual(h * 48);
      expect(f!.rows.every((r) => /^[.1-4]+$/.test(r) && r.length === f!.rows[0].length)).toBe(true);
    }
    expect(sheet.props.lava_vent.flame!.tongue).toBe(false);        // lava: a palette cycle
    expect(sheet.props.wall_torch.flame!.tongue).toBe(true);
  });
});

describe('the dressed dungeons', () => {
  it.each(DUNGEONS)('%s: AR props on fitting cells, every lit one with its flame', (id) => {
    const src = source(id);
    const rows = src.ground.replace(/\n$/, '').split('\n');
    const props = src.objects.filter((o) => propOf(o));
    expect(props.length).toBeGreaterThan(id === 'sky-castle-5f' ? 1 : 2);
    for (const o of props) {
      const pid = propOf(o)!;
      const p = sheet.props[pid];
      const [w, h] = p.cells;
      for (let i = 0; i < w; i++) {
        if (p.place === 'wall') for (let j = 0; j < h; j++) expect(rows[o.y + j][o.x + i], `${pid} on a face`).toBe('F');
        else expect('WF').not.toContain(rows[o.y + h - 1][o.x + i]);
      }
    }
    const lights = (src.ambient ?? []).filter((a) => a.kind === 'flame');
    expect(lights.map((a) => `${a.prop}@${a.x},${a.y}`).sort())
      .toEqual(props.filter((o) => LIT.includes(propOf(o)!)).map((o) => `${propOf(o)}@${o.x},${o.y}`).sort());
  });

  it.each(DUNGEONS)('%s: the compiled map validates and carries the flames with their masks', (id) => {
    const map = compiled(id);
    expect(() => validateMapData(map)).not.toThrow();
    const flames = ((map.ambient ?? []) as FlameEffect[]).filter((a) => a.kind === 'flame');
    const lit = source(id).objects.filter((o) => LIT.includes(propOf(o) ?? ''));
    expect(flames).toHaveLength(lit.length);
    for (const f of flames) {
      expect(f.mask, `${id} flame at ${f.x}, ${f.y}`).toBeDefined();
      expect(f.foot).toBeGreaterThanOrEqual(f.y);
    }
  });

  it('the Ice Cavern keeps its sheet ice clear: no prop on or beside a `+` or `%` cell', () => {
    for (const id of ['ice-cavern-b1', 'ice-cavern-b2', 'ice-cavern-b3']) {
      const src = source(id);
      const rows = src.ground.replace(/\n$/, '').split('\n');
      for (const o of src.objects.filter((x) => propOf(x))) {
        const [w, h] = sheet.props[propOf(o)!].cells;
        const y = o.y + h - 1;                                   // the foot row (the only blocking one)
        for (let i = 0; i < w; i++) {
          for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
            expect('+%', `${id} ${propOf(o)} at ${o.x + i}, ${y}`).not.toContain(rows[y + dy]?.[o.x + i + dx] ?? 'W');
          }
        }
      }
    }
  });
});
