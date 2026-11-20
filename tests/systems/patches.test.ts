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
import { gate, patchCells } from '../helpers/worldSpots.js';

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

describe('patches: the north-bridge span of the compiled world', () => {
  const ow = validateMapData(parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')));
  // the gap north of the bridge gates, by the world's own `north_bridge` patch (NW-5: by name, not by cell)
  const gap = patchCells(ow, 'north_bridge');

  it('the span opens the gap on BRIDGE_BUILT, from the gate beside it', () => {
    const g = gate(ow, 'a1_bridge_gate_w');
    const cell = gap.find((c) => Math.abs(c.x - g.x) + Math.abs(c.y - g.y) === 1)!;
    expect(cell).toBeDefined();
    expect(canEnter(ow, cell, 'walking', state())).toBe(false);
    expect(canEnter(ow, cell, 'walking', state(['BRIDGE_BUILT']))).toBe(true);
    expect(fieldStep(ow, g, cell, state(['BRIDGE_BUILT'])).ok).toBe(true);
  });
});
