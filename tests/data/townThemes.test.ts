/**
 * AR-W2: the approved town themes (docs/TOWN_THEMES.md; sheets assets-src/gen/approved/town/theme_<town>.json, re-cut
 * by assets-src/gen/town_theme_cut.py from the render cache). Every theme style a town source uses has its approved
 * cells: each roof / wall style of a themed house resolves to <part>@<style> for every part the compiler pastes, each
 * themed prefab and deco to all its cells, and each theme material exists; the renders are BR-ledgered.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';

interface Source { id: string; cache_key: string; pass: string }
interface Sheet { theme: string | null; tints: string[]; roofs: string[]; cells: (string | null)[][];
  materials: Record<string, number[]>; sources: Source[] }
interface Obj { type: string; name?: string; w?: number; h?: number; roof?: string; wall?: string; storeys?: number;
  prefab?: string; parts?: string[][]; chimney?: number }

const DIR = 'assets-src/gen/approved/town';
const sheets = readdirSync(DIR).filter((f) => /^theme_.*\.json$/.test(f))
  .map((f) => JSON.parse(readFileSync(`${DIR}/${f}`, 'utf-8')) as Sheet);
const cells = new Set(sheets.flatMap((s) => s.cells.flat().filter((c): c is string => !!c)));
const styles = new Set(sheets.flatMap((s) => (s.theme ? [s.theme, ...s.tints, ...s.roofs] : [])));
const prefixes = new Set([...cells].filter((c) => /_\d+_\d+$/.test(c)).map((c) => c.replace(/_\d+_\d+$/, '')));
const ledger = new Set(readFileSync('assets-src/gen/cache/bedrock_ledger.jsonl', 'utf-8').trim().split('\n')
  .map((l) => JSON.parse(l) as { event: string; key?: string }).filter((r) => r.event === 'request').map((r) => r.key));
const TOWNS = ['cornelia', 'pravoka', 'elfheim', 'melmond', 'crescent', 'lufenia', 'onrac', 'gaia'];
const src = (id: string) => parse(readFileSync(`assets-src/maps/${id}.yaml`, 'utf-8')) as
  { objects: Obj[]; materials?: Record<string, unknown> };

const ROOF = ['ridge', 'eave'].flatMap((r) => ['l', 'm', 'r'].map((c) => `roof_${r}_${c}`));
const WALL = ['wall_up_l', 'wall_up_r', 'wall_up_window', 'wall_up_plain', 'wall_lo_l', 'wall_lo_r', 'wall_lo_plain',
  'wall_door_top', 'wall_door_bottom'];
const UP2 = ['wall_up2_l', 'wall_up2_r', 'wall_up2_window', 'wall_up2_plain'];

describe('the town themes', () => {
  it('has a sheet per themed town plus the dwarf hall, every render BR-ledgered', () => {
    expect(sheets.length).toBe(9);
    for (const s of sheets) for (const r of s.sources) expect(ledger.has(r.cache_key), r.id).toBe(true);
  });

  it.each(TOWNS)('%s: every house is themed and every theme style it uses has approved cells', (id) => {
    const houses = src(id).objects.filter((o) => o.type === 'house');
    expect(houses.length).toBeGreaterThan(0);
    for (const o of houses) {
      expect(styles.has(o.roof ?? ''), `${id} ${o.name} roof ${o.roof}`).toBe(true);
      expect(styles.has(o.wall ?? ''), `${id} ${o.name} wall ${o.wall}`).toBe(true);
      for (const p of ROOF) expect(cells.has(`${p}@${o.roof}`), `${p}@${o.roof}`).toBe(true);
      for (const p of [...WALL, ...((o.storeys ?? 1) > 1 ? UP2 : [])]) {
        expect(cells.has(`${p}@${o.wall}`), `${p}@${o.wall}`).toBe(true);
      }
    }
  });

  it.each(TOWNS)('%s: the themed prefabs and decos have all their cells', (id) => {
    const objs = src(id).objects;
    const inn = objs.find((o) => o.name === 'inn');
    expect(inn?.prefab).toMatch(/^inn_/);
    for (const o of objs.filter((x) => x.type === 'prefab')) {
      for (let r = 0; r < (o.h ?? 0); r++) for (let c = 0; c < (o.w ?? 0); c++) {
        expect(cells.has(`${o.prefab}_${r}_${c}`), `${o.prefab}_${r}_${c}`).toBe(true);
      }
    }
    const themed = objs.filter((o) => o.type === 'deco' && o.parts?.flat().some((p) => prefixes.has(p.replace(/_\d+_\d+$/, ''))));
    expect(themed.length).toBeGreaterThan(0);
    for (const o of themed) for (const p of o.parts!.flat()) expect(cells.has(p), p).toBe(true);
  });

  it('Crescent: its canals carry the stone deck, its chimneys the funnel chimney', () => {
    const s = src('crescent');
    expect(s.materials).toEqual({ bridge_v: 'cre_bridge_v' });
    expect(sheets.some((x) => 'cre_bridge_v' in x.materials)).toBe(true);
    expect(cells.has('chimney@cre_venice')).toBe(true);
  });

  it('the dwarf hall uses its own granite cells, not the generic statue, pillar and fireplace', () => {
    const d = parse(readFileSync('assets-src/maps/dwarf-hall.yaml', 'utf-8')) as
      { objects: Obj[]; materials: Record<string, { from: string }> };
    const parts = d.objects.flatMap((o) => o.parts?.flat() ?? []);
    expect(parts.filter((p) => /^(statue|pillar|fireplace)_/.test(p))).toEqual([]);
    for (const p of parts.filter((x) => x.startsWith('dwf_'))) expect(cells.has(p), p).toBe(true);
    expect(d.materials.in_wall_face.from).toBe('dwf_wall');
    expect(sheets.some((x) => 'dwf_wall' in x.materials)).toBe(true);
  });
});
