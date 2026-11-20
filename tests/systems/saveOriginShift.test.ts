/**
 * Save v2 and GAP-17's save half (docs/WORLD_PLAN.md 1.5 and 5.2 W1-A; QUEST 3.3): a version-2 save stores the
 * party's field `mode` and the parked `vehicles`; a version-1 save loads on foot with no vehicles, and a version-1
 * save on `overworld` is an act-1 cell, so on entering a map with `world.frames.a1` its position is translated by
 * that origin (once). Other maps and version-2 saves are never shifted.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { SaveManager, SAVE_VERSION } from '../../src/systems/SaveManager.js';
import { restoredSpawn, shiftA1 } from '../../src/systems/MapTransition.js';
import { validateMapData } from '../../src/core/schemaValidation.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import type { MapData, VehicleState } from '../../src/types/index.js';
import { a1At, translateA1 } from '../helpers/worldFrame.js';

const store: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  },
});

/** A version-1 save as act 1 wrote it (no mode, no vehicles). */
function v1(currentMap: string, x: number, y: number): string {
  return JSON.stringify({
    version: 1, party: new PartyManager().toJSON(), inventory: new Inventory().toJSON(), flags: new GameFlags().toJSON(),
    currentMap, playerPosition: { x, y }, playTime: 5, saveDate: '2026-01-01T00:00:00.000Z', slotId: 0,
  });
}

const act1 = validateMapData(parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')));
/** The overworld as the world carries it (the act-1 block at world_api.A1_ORIGIN); the compiled map once it is. */
const world: MapData = translateA1(act1);
const SHIP: VehicleState = { type: 'ship', map: 'overworld', x: 92, y: 121 };

beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

describe('save v2: mode and vehicles', () => {
  it('saves (version 3 since pass CHT) with the mode and the parked vehicles, and loads them back', () => {
    expect(SAVE_VERSION).toBe(3);
    SaveManager.save(0, new PartyManager(), new Inventory(), new GameFlags(), 'overworld', { x: 100, y: 120 }, 9,
      'World', { mode: 'ship', vehicles: [SHIP, { type: 'airship', map: 'overworld', x: 143, y: 160 }] });
    const raw = JSON.parse(store.ff1_save_0);
    expect(raw.version).toBe(3);
    expect(raw.mode).toBe('ship');
    const loaded = SaveManager.load(0)!;
    expect(loaded.fieldMode).toBe('ship');
    expect(loaded.vehicles).toEqual([SHIP, { type: 'airship', map: 'overworld', x: 143, y: 160 }]);
    expect(loaded.frame).toBeNull();
  });

  it('a malformed vehicle or mode is logged and dropped', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const data = JSON.parse(v1('overworld', 1, 1));
    store.ff1_save_0 = JSON.stringify({ ...data, version: 2, mode: 'boat', vehicles: [SHIP, { type: 'raft', map: 'x', x: 1, y: 1 }] });
    const loaded = SaveManager.load(0)!;
    expect(loaded.fieldMode).toBe('walking');
    expect(loaded.vehicles).toEqual([SHIP]);
    expect(err).toHaveBeenCalledTimes(2);
    err.mockRestore();
  });

  it('a version-1 save loads on foot with no vehicles', () => {
    store.ff1_save_1 = v1('cornelia', 10, 12);
    const loaded = SaveManager.load(1)!;
    expect(loaded.fieldMode).toBe('walking');
    expect(loaded.vehicles).toEqual([]);
    expect(loaded.frame).toBeNull();
  });
});

describe('GAP-17: a version-1 overworld save in the world frame', () => {
  it('is marked as an act-1 cell and translated by world.frames.a1.origin on entering the world', () => {
    store.ff1_save_0 = v1('overworld', 28, 47);
    const loaded = SaveManager.load(0)!;
    expect(loaded.frame).toBe('a1');
    const g = { playerPosition: loaded.playerPosition, fieldMode: loaded.fieldMode, vehicles: loaded.vehicles,
      pendingFrame: loaded.frame };
    const pos = restoredSpawn(world, g);
    expect(pos).toEqual(a1At(world, 28, 47));
    expect(world.world?.frames.a1?.origin).toEqual([64, 64]);
    expect(pos).toEqual({ x: 92, y: 111 });
    expect(g.pendingFrame).toBeNull();
    // once: a second enter (a map change back) does not shift again
    expect(restoredSpawn(world, g)).toEqual({ x: 92, y: 111 });
  });

  it('is kept as it is on the act-1 overworld (no frame), on other maps, and for version-2 saves', () => {
    expect(shiftA1({ id: 'overworld' }, { x: 28, y: 47 })).toEqual({ x: 28, y: 47 });
    expect(shiftA1({ ...world, id: 'cornelia' }, { x: 28, y: 47 })).toEqual({ x: 28, y: 47 });
    store.ff1_save_2 = v1('cornelia', 28, 47);
    expect(SaveManager.load(2)!.frame).toBeNull();
    SaveManager.save(1, new PartyManager(), new Inventory(), new GameFlags(), 'overworld', { x: 92, y: 111 }, 1);
    const v2 = SaveManager.load(1)!;
    expect(v2.frame).toBeNull();
    const g = { playerPosition: v2.playerPosition, fieldMode: v2.fieldMode, vehicles: v2.vehicles, pendingFrame: v2.frame };
    expect(restoredSpawn(world, g)).toEqual({ x: 92, y: 111 });
  });

  it('Game.restoreState carries the frame to the next field enter (LoadScene passes the loaded save as is)', async () => {
    const { Game } = await import('../../src/core/Game.js');
    const game = new Game();
    store.ff1_save_0 = v1('overworld', 28, 47);
    game.restoreState(SaveManager.load(0)!);
    expect(game.pendingFrame).toBe('a1');
    expect(game.fieldMode).toBe('walking');
    expect(restoredSpawn(world, game)).toEqual({ x: 92, y: 111 });
    expect(game.playerPosition).toEqual({ x: 92, y: 111 });
    game.resetState();
    expect(game.pendingFrame).toBeNull();
    expect(game.vehicles).toEqual([]);
  });
});
