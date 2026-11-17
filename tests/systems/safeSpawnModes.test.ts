/**
 * GAP-11 (docs/QUEST_PLAN.md 1.8 and 4.2; W1-A): `safeSpawn` is mode-aware. A save made on the ship at sea, by canoe
 * on a river or in the airship over the mountains keeps its cell; on foot, land reached only by the ship (cut off
 * from every entrance) is kept when a vehicle is parked on that land's shore. `restoredSpawn` drops the party on foot
 * whenever the cell can't hold its mode.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { FieldMode, MapData, VehicleState } from '../../src/types/index.js';
import { restoredSpawn, safeSpawn } from '../../src/systems/MapTransition.js';
import { validateMapData } from '../../src/core/schemaValidation.js';

const dock = (): MapData => validateMapData(parse(readFileSync('assets/maps/test-dock.yaml', 'utf-8')));
const START = { x: 6, y: 6 };
const ISLAND_SHIP: VehicleState = { type: 'ship', map: 'test-dock', x: 14, y: 8 };

let warn: ReturnType<typeof spyWarn>;
const spyWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => {});
beforeEach(() => { warn = spyWarn(); });
afterEach(() => { warn.mockRestore(); });

describe('safeSpawn: the saved mode (GAP-11)', () => {
  const map = dock();

  it.each([
    ['ship', { x: 12, y: 4 }],      // the open sea
    ['canoe', { x: 3, y: 7 }],      // the river
    ['canoe', { x: 2, y: 2 }],      // the lake
    ['airship', { x: 0, y: 0 }],    // over the mountain border
    ['airship', { x: 16, y: 3 }],   // over a forest
  ] as [FieldMode, { x: number; y: number }][])('keeps a %s position valid in its mode %o', (mode, pos) => {
    expect(safeSpawn(map, pos, mode)).toEqual(pos);
    expect(warn).not.toHaveBeenCalled();
  });

  it('a position the mode cannot hold is checked on foot: kept on good land, else the first entrance', () => {
    expect(safeSpawn(map, { x: 5, y: 5 }, 'canoe')).toEqual({ x: 5, y: 5 });
    expect(safeSpawn(map, { x: 12, y: 4 }, 'canoe')).toEqual(START);
    expect(safeSpawn(map, { x: 3, y: 7 }, 'ship')).toEqual(START);
    expect(safeSpawn(map, { x: 40, y: 4 }, 'airship')).toEqual(START);
  });

  it('on foot, the island cut off from the entrance is kept beside a parked ship, not without it', () => {
    expect(safeSpawn(map, { x: 17, y: 9 }, 'walking', [ISLAND_SHIP])).toEqual({ x: 17, y: 9 });
    expect(warn).not.toHaveBeenCalled();
    expect(safeSpawn(map, { x: 17, y: 9 }, 'walking', [{ ...ISLAND_SHIP, map: 'elsewhere' }])).toEqual(START);
    expect(safeSpawn(map, { x: 17, y: 9 })).toEqual(START);
  });

  it('on foot, the sea is still blocked and the old act-1 rules hold', () => {
    expect(safeSpawn(map, { x: 12, y: 4 })).toEqual(START);
    expect(safeSpawn(map, { x: 4, y: 4 })).toEqual({ x: 4, y: 4 });
  });
});

describe('restoredSpawn: mode and position together', () => {
  const map = dock();
  const game = (mode: FieldMode, x: number, y: number, vehicles: VehicleState[] = []) =>
    ({ playerPosition: { x, y }, fieldMode: mode, vehicles, pendingFrame: null as 'a1' | null });

  it('keeps the ship at sea in ship mode', () => {
    const g = game('ship', 12, 4);
    expect(restoredSpawn(map, g)).toEqual({ x: 12, y: 4 });
    expect(g.fieldMode).toBe('ship');
  });

  it('a ship position on land walks: the cell is kept when it is good on foot, else the entrance', () => {
    const g = game('ship', 5, 5);
    expect(restoredSpawn(map, g)).toEqual({ x: 5, y: 5 });
    expect(g.fieldMode).toBe('walking');
    const river = game('ship', 3, 7);
    expect(restoredSpawn(map, river)).toEqual(START);
    expect(river.fieldMode).toBe('walking');
    const landed = game('airship', 5, 5);
    expect(restoredSpawn(map, landed)).toEqual({ x: 5, y: 5 });
    expect(landed.fieldMode).toBe('airship');
  });
});
