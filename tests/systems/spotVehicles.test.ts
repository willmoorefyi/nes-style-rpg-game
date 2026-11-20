/**
 * NW-1 (docs/NATURAL_WORLD_PLAN.md 5.2): a parked vehicle may name a spot of its map (`at`) until that map loads;
 * `resolveParked` gives it its cell then, `parkedVehicles` draws only vehicles with a cell, `keepSpots` keeps the other
 * maps' spot vehicles through a step, and a save refuses a vehicle without a cell (it stores cells only). The map
 * schema takes `spots` and the composer's `world.basins` / `world.cuts`, with `world.frames` optional.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { hasCell, keepSpots, parkedVehicles, resolveParked } from '../../src/systems/VehicleManager.js';
import { SaveManager } from '../../src/systems/SaveManager.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import { validateQuestMapFields } from '../../src/core/schemaValidationQuest.js';
import type { ParkedVehicle } from '../../src/types/index.js';

const map = { id: 'overworld', spots: { a_s_quay: { at: [4, 5] as [number, number], kind: 'dock' as const } } };

afterEach(() => { vi.restoreAllMocks(); });

describe('spot vehicles (NW-1)', () => {
  it('resolveParked gives this map\'s spot vehicles their cells and leaves the others', () => {
    const list: ParkedVehicle[] = [{ type: 'ship', map: 'overworld', at: 'a_s_quay' },
      { type: 'airship', map: 'cave', at: 'c_s_x' }, { type: 'canoe', map: 'overworld', x: 1, y: 1 }];
    expect(resolveParked(list, map)).toEqual([{ type: 'ship', map: 'overworld', x: 4, y: 5 },
      { type: 'airship', map: 'cave', at: 'c_s_x' }, { type: 'canoe', map: 'overworld', x: 1, y: 1 }]);
    expect(list.map(hasCell)).toEqual([false, false, true]);
  });

  it('an unknown spot is logged and the vehicle dropped', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(resolveParked([{ type: 'ship', map: 'overworld', at: 'a_s_gone' }], map)).toEqual([]);
    expect(err).toHaveBeenCalledWith(expect.stringMatching(/no spot a_s_gone/));
  });

  it('parkedVehicles draws only vehicles with a cell, but an unresolved one still holds its type', () => {
    const spawn = [{ type: 'airship' as const, x: 9, y: 9 }];
    expect(parkedVehicles('overworld', spawn, [{ type: 'airship', map: 'cave', at: 'c_s_x' }], () => true)).toEqual([]);
    expect(parkedVehicles('overworld', spawn, [], () => true)).toEqual([{ type: 'airship', map: 'overworld', x: 9, y: 9 }]);
  });

  it('keepSpots keeps the other maps\' spot vehicles of the types the new list lacks', () => {
    const all: ParkedVehicle[] = [{ type: 'airship', map: 'cave', at: 'c_s_x' }, { type: 'ship', map: 'cave', at: 'c_s_y' }];
    expect(keepSpots(all, [{ type: 'ship', map: 'overworld', x: 1, y: 2 }]))
      .toEqual([{ type: 'ship', map: 'overworld', x: 1, y: 2 }, { type: 'airship', map: 'cave', at: 'c_s_x' }]);
  });

  it('a save refuses a vehicle that has no cell yet (cells only on disk)', () => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const save = (vehicles: ParkedVehicle[]): boolean => SaveManager.save(0, new PartyManager(), new Inventory(),
      new GameFlags(), 'overworld', { x: 1, y: 1 }, 0, undefined, { vehicles });
    expect(save([{ type: 'airship', map: 'overworld', at: 'a1_s_airship' }])).toBe(false);
    expect(store.ff1_save_0).toBeUndefined();
    expect(err).toHaveBeenCalledWith(expect.stringMatching(/refused: the airship on overworld has no cell/), expect.anything());
    expect(save([{ type: 'ship', map: 'overworld', x: 132, y: 102 }])).toBe(true);
    expect(JSON.parse(store.ff1_save_0).vehicles).toEqual([{ type: 'ship', map: 'overworld', x: 132, y: 102 }]);
    vi.unstubAllGlobals();
  });
});

describe('the map schema: spots and world (NW-1)', () => {
  it('takes spots of a known kind with a cell', () => {
    expect(() => validateQuestMapFields({ spots: { a_s_x: { at: [1, 2], kind: 'landing' } } })).not.toThrow();
    expect(() => validateQuestMapFields({ spots: { a_s_x: { at: [1, 2], kind: 'harbour' } } })).toThrow(/kind: expected one of land, dock, landing/);
    expect(() => validateQuestMapFields({ spots: { a_s_x: { at: 'here', kind: 'land' } } })).toThrow(/spots.a_s_x.at/);
    expect(() => validateQuestMapFields({ spots: [] })).toThrow(/MapData.spots: expected object/);
  });

  it('world.frames is optional; world.basins and world.cuts are cells', () => {
    expect(() => validateQuestMapFields({ world: { basins: { aldi: [92, 121] }, cuts: { W_east: [[1, 2], [3, 4]] } } })).not.toThrow();
    expect(() => validateQuestMapFields({ world: { frames: { a1: { origin: [64, 64], size: [72, 72] } } } })).not.toThrow();
    expect(() => validateQuestMapFields({ world: { basins: { aldi: 'x' } } })).toThrow(/world.basins.aldi/);
    expect(() => validateQuestMapFields({ world: { cuts: { W_east: [[1]] } } })).toThrow(/world.cuts.W_east\[0\]/);
  });
});
