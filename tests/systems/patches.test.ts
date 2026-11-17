/**
 * Map patches (GAP-2; docs/QUEST_PLAN.md 4.2, W1-B): a patch overrides its cells' terrain while its flag is set, in
 * the field rules (canEnter, fieldStep) and in the CollisionMap the movement modes read, on live flags.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { TerrainType, type MapData } from '../../src/types/index.js';
import { canEnter, fieldStep, patchedTerrain, type FieldState } from '../../src/systems/fieldRules.js';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { WalkingMode } from '../../src/entities/WalkingMode.js';
import { validateMapData } from '../../src/core/schemaValidation.js';
import { createMapData } from '../helpers/testUtils.js';
import { a1At, translateA1 } from '../helpers/worldFrame.js';

const state = (flags: string[] = []): FieldState => ({ flags: new Set(flags), items: new Set(), mode: 'walking', vehicles: [] });

/** Grass | Water | Water | Grass, with a bridge patch over the water on BRIDGE_BUILT. */
const strait = (): MapData => createMapData({
  width: 4, height: 1,
  collision: [TerrainType.Grass, TerrainType.Water, TerrainType.Water, TerrainType.Grass],
  patches: [{ id: 'span', flag: 'BRIDGE_BUILT', cells: [[1, 0], [2, 0]], terrain: TerrainType.Bridge }],
});

describe('patches: patchedTerrain', () => {
  it('is the compiled terrain until the flag is set, then the patch terrain on its cells only', () => {
    const map = strait();
    expect(patchedTerrain(map, 1, 0, new Set())).toBe(TerrainType.Water);
    expect(patchedTerrain(map, 1, 0, new Set(['BRIDGE_BUILT']))).toBe(TerrainType.Bridge);
    expect(patchedTerrain(map, 2, 0, new Set(['BRIDGE_BUILT']))).toBe(TerrainType.Bridge);
    expect(patchedTerrain(map, 0, 0, new Set(['BRIDGE_BUILT']))).toBe(TerrainType.Grass);
    expect(patchedTerrain(map, 1, 0, new Set(['OTHER']))).toBe(TerrainType.Water);
  });

  it('outside the map stays Wall; the last patch covering a cell wins', () => {
    const map = createMapData({
      width: 2, height: 1, collision: [TerrainType.Water, TerrainType.Water],
      patches: [
        { id: 'a', flag: 'A', cells: [[0, 0], [-1, 0]], terrain: TerrainType.Bridge },
        { id: 'b', flag: 'B', cells: [[0, 0]], terrain: TerrainType.Grass },
      ],
    });
    expect(patchedTerrain(map, -1, 0, new Set(['A']))).toBe(TerrainType.Wall);
    expect(patchedTerrain(map, 0, 0, new Set(['A']))).toBe(TerrainType.Bridge);
    expect(patchedTerrain(map, 0, 0, new Set(['A', 'B']))).toBe(TerrainType.Grass);
  });

  it('a patch may also close a cell (canal walls, a collapsed span)', () => {
    const map = createMapData({ width: 1, height: 1, collision: [TerrainType.Grass],
      patches: [{ id: 'cut', flag: 'CANAL_OPEN', cells: [[0, 0]], terrain: TerrainType.Water }] });
    expect(canEnter(map, { x: 0, y: 0 }, 'walking', state())).toBe(true);
    expect(canEnter(map, { x: 0, y: 0 }, 'walking', state(['CANAL_OPEN']))).toBe(false);
    expect(canEnter(map, { x: 0, y: 0 }, 'ship', { ...state(['CANAL_OPEN']), mode: 'ship' })).toBe(true);
  });
});

describe('patches: the field step and the collision map', () => {
  it('fieldStep crosses the strait only with the flag', () => {
    const map = strait();
    expect(fieldStep(map, { x: 0, y: 0 }, { x: 1, y: 0 }, state()).ok).toBe(false);
    expect(fieldStep(map, { x: 0, y: 0 }, { x: 1, y: 0 }, state(['BRIDGE_BUILT']))).toEqual({ ok: true, mode: 'walking', setFlags: [] });
    expect(fieldStep(map, { x: 2, y: 0 }, { x: 3, y: 0 }, state(['BRIDGE_BUILT'])).ok).toBe(true);
  });

  it('CollisionMap reads the live flags it was given: the movement mode sees the patch at once', () => {
    const map = strait();
    const flags = new Set<string>();
    const col = new CollisionMap(map, (f) => flags.has(f));
    const walking = new WalkingMode();
    expect(col.getTerrainType(1, 0)).toBe(TerrainType.Water);
    expect(col.isWalkable(1, 0, walking)).toBe(false);
    flags.add('BRIDGE_BUILT');
    expect(col.getTerrainType(1, 0)).toBe(TerrainType.Bridge);
    expect(col.isWalkable(1, 0, walking)).toBe(true);
  });

  it('a CollisionMap without flags applies no patch (as before)', () => {
    expect(new CollisionMap(strait()).getTerrainType(1, 0)).toBe(TerrainType.Water);
  });
});

describe('patches: an act-1 north-bridge span in both frames', () => {
  const ow = validateMapData(parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')));
  // the act-1 cells of the gap north of the stubs (29-30, 31): what A1-O's `north_bridge` patch spans
  const withSpan = (m: MapData): MapData => ({
    ...m, patches: [{ id: 'north_bridge', flag: 'BRIDGE_BUILT', terrain: TerrainType.Bridge,
      cells: [[29, 31], [30, 31]].map(([x, y]) => { const c = a1At(m, x, y); return [c.x, c.y] as [number, number]; }) }],
  });

  it.each([['the act-1 map', ow], ['the world frame', translateA1(ow)]])('the span opens the gap on BRIDGE_BUILT (%s)', (_n, base) => {
    const map = withSpan(base as MapData);
    const gap = a1At(map, 29, 31);
    expect(canEnter(map, gap, 'walking', state())).toBe(false);
    expect(canEnter(map, gap, 'walking', state(['BRIDGE_BUILT']))).toBe(true);
    expect(fieldStep(map, a1At(map, 29, 32), gap, state(['BRIDGE_BUILT'])).ok).toBe(true);
  });
});
