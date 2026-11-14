import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { MapData } from '../../src/types/index.js';

// IN-3 (T5c): the HUD shows a map's `name`, so every map has one. MS-8 (T5c): only the world map allows camping.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path: string) => parse(readFileSync(join(root, path), 'utf-8')) as MapData & { camp?: boolean };
const compiledIds = parse(readFileSync(join(root, 'assets/maps/ai/index.yaml'), 'utf-8')) as string[];
const legacyIds = readdirSync(join(root, 'assets/maps')).filter((f) => f.endsWith('.yaml'))
  .map((f) => f.replace(/\.yaml$/, ''));
const compiled = compiledIds.map((id) => read(`assets/maps/ai/${id}.yaml`));
const legacy = legacyIds.map((id) => read(`assets/maps/${id}.yaml`));
// The temple's source (assets-src/maps/temple-of-fiends.yaml) belongs to T5d, which adds its name; drop this entry
// once T5d is merged.
const NAMED_BY_T5D = new Set(['temple-of-fiends']);

describe('map names (IN-3)', () => {
  it('reads all the compiled and legacy maps', () => {
    expect(compiled.length).toBeGreaterThan(20);
    expect(legacyIds).toEqual(expect.arrayContaining(['cornelia', 'overworld', 'temple-of-fiends', 'test-town']));
  });

  it('every compiled map has a name', () => {
    for (const m of compiled.filter((c) => !NAMED_BY_T5D.has(c.id))) {
      expect(typeof m.name === 'string' && m.name.trim().length > 0, m.id).toBe(true);
    }
  });

  it('every legacy map has a name', () => {
    for (const m of legacy) expect(typeof m.name === 'string' && m.name.trim().length > 0, m.id).toBe(true);
  });

  it('Cornelia and the overworld have their HUD names', () => {
    for (const maps of [compiled, legacy]) {
      expect(maps.find((m) => m.id === 'cornelia')?.name).toBe('Cornelia');
      expect(maps.find((m) => m.id === 'overworld')?.name).toBe('World Map');
    }
  });
});

describe('camping (MS-8)', () => {
  it('only the overworld allows Tent and Cabin, compiled and legacy', () => {
    for (const maps of [compiled, legacy]) {
      expect(maps.filter((m) => m.camp === true).map((m) => m.id)).toEqual(['overworld']);
      expect(maps.filter((m) => m.camp !== undefined && m.camp !== true).map((m) => m.id)).toEqual([]);
    }
  });
});
