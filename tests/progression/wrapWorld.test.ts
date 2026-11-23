/**
 * WR (docs/WORLD_WRAP_PLAN.md 8, 10): the verifier on wrapped maps. A ship route across the seam is shorter; the
 * components stay equal; `wrapInvariant` (proof (h)'s WRAP) is RED on land at an edge and on a bridge cell at x 0,
 * green on the real world; proof (g) stays planar.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { TerrainType, type MapData } from '../../src/types/index.js';
import { validateMapData } from '../../src/core/schemaValidation.js';
import { cellPath } from '../../src/progression/questSearch.js';
import { labelCells, wrapInvariant } from '../../src/progression/questWrap.js';
import { loadLateData } from '../../src/progression/questLateData.js';
import { geoCheck } from '../../src/progression/questGeo.js';
import type { QuestWorld } from '../../src/progression/questData.js';
import type { QuestState } from '../../src/progression/questTypes.js';
import { createMapData } from '../helpers/testUtils.js';

const W = TerrainType.Water;
const G = TerrainType.Grass;

/** A 12x6 sea with an island at x 4-7 and land columns at x 1 and x 10 (joined by the sea ring either way). */
function sea(wrap: boolean, edit: (c: number[], w: number) => void = () => {}): MapData {
  const w = 12;
  const h = 6;
  const c = Array<number>(w * h).fill(W);
  for (let y = 2; y < 4; y++) for (let x = 4; x < 8; x++) c[y * w + x] = G;
  edit(c, w);
  return createMapData({ id: 'sea', width: w, height: h, collision: c, ...(wrap ? { wrap: true } : {}) });
}

const shipState = (map: MapData): QuestState => ({
  flags: new Set(), items: new Set(), vehicles: [], gold: 0, fired: [], place: { map: map.id, x: 0, y: 0, mode: 'ship' },
});
const worldOf = (map: MapData): QuestWorld => ({ maps: new Map([[map.id, map]]) }) as Pick<QuestWorld, 'maps'> as QuestWorld;

describe('wrapWorld: the verifier on a synthetic wrapped sea', () => {
  it('a ship route across the seam is shorter than the flat one', () => {
    const run = (map: MapData): number => cellPath(worldOf(map), { map: map.id, x: 1, y: 0, mode: 'ship' },
      [{ x: 10, y: 0 }], shipState(map))!.length;
    expect(run(sea(false))).toBe(10);
    expect(run(sea(true))).toBe(4);
  });

  it('the components on the open sea are the same with and without the seam', () => {
    const map = sea(true);
    const open = Uint8Array.from(map.collision.map((t) => (t === W ? 1 : 0)));
    expect(Array.from(labelCells(map, open, true))).toEqual(Array.from(labelCells(map, open, false)));
    expect(wrapInvariant(map)).toEqual([]);
  });

  it('is RED on land touching both edges (it joins two walkers across the seam)', () => {
    const map = sea(true, (c, w) => { c[3 * w + 0] = G; c[3 * w + 11] = G; });
    const msgs = wrapInvariant(map).map((f) => f.message);
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs[0]).toMatch(/^WRAP joins walk components \d+ and \d+ at \(\d+, \d+\) \(patches shut\)$/);
  });

  it('is RED on a bridge patch cell at x 0 that joins two shores when its flag is set', () => {
    const map = sea(true, (c, w) => { c[3 * w + 1] = G; c[3 * w + 11] = G; });
    map.patches = [{ id: 'span', flag: 'SPAN', cells: [[0, 3]], terrain: TerrainType.Bridge }];
    const msgs = wrapInvariant(map).map((f) => f.message);
    expect(msgs.some((m) => m.startsWith('WRAP joins walk') && m.endsWith('(patches open)'))).toBe(true);
    expect(msgs.some((m) => m.endsWith('(patches shut)'))).toBe(false);
  });
});

describe('wrapWorld: the real world', () => {
  const ow = validateMapData(parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')));

  it('the wrap joins no component on foot, by canoe or by ship (canal and bridge shut and open)', () => {
    expect(wrapInvariant({ ...ow, wrap: true }).map((f) => f.message)).toEqual([]);
  });

  it('proof (g) is planar: the anchors at their placed entrances give the same outcome with the wrap', () => {
    const geo = loadLateData(process.cwd(), { anchors: 'assets/data/world-anchors.yaml' }).geo!;
    const cells = new Map(geo.anchors.filter((a) => ow.entrances?.[a.entrance])
      .map((a) => [a.name, ow.entrances![a.entrance] as [number, number]]));
    const out = geoCheck({ geo, cells, strict: true });
    expect(out.failures.map((f) => f.message)).toEqual([]);
  });
});
