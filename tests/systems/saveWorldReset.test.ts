/**
 * NW-5 (docs/NATURAL_WORLD_PLAN.md 5.3, D-NW8, Q4a): the 8 save cases of the world reset. A pre-NW save (v1-v3) on
 * the world map, or owning a ship or the airship wherever it is, loads at Cornelia on foot (`reset`, so LoadScene
 * sends it to the `cornelia` entrance) with its vehicles at their milestone spots; one owning neither inside another
 * map keeps its place; a v4 save is untouched; flags, party, items and gold are always kept.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SaveManager, SAVE_VERSION } from '../../src/systems/SaveManager.js';
import { RESET_ENTRANCE, RESET_LOCATION, resetSave } from '../../src/systems/worldReset.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import { Character } from '../../src/entities/Character.js';
import type { FieldMode, SaveData, VehicleState } from '../../src/types/index.js';
import { testClass } from '../helpers/testUtils.js';
import { loadRealRegistries } from '../helpers/realData.js';

const store: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  },
});

const cls = testClass('warrior');

function party(): PartyManager {
  const p = new PartyManager();
  p.add(new Character({ name: 'Hero', classData: cls, level: 12 }));
  p.addGold(4321);
  return p;
}

function inventory(): Inventory {
  const inv = new Inventory();
  inv.add('potion', 3);
  inv.add('canoe', 1);
  return inv;
}

interface Case { version: number; map: string; at: [number, number]; flags: string[]; mode?: FieldMode; vehicles?: VehicleState[] }

function stored(c: Case): SaveData {
  const flags = new GameFlags();
  c.flags.forEach((f) => flags.set(f));
  return {
    version: c.version, party: party().toJSON() as SaveData['party'], inventory: inventory().toJSON(),
    flags: flags.toJSON(), currentMap: c.map, playerPosition: { x: c.at[0], y: c.at[1] }, playTime: 999,
    saveDate: '2026-11-01T00:00:00.000Z', slotId: 0, location: 'Somewhere',
    ...(c.version >= 2 ? { mode: c.mode ?? 'walking', vehicles: c.vehicles ?? [] } : {}),
  };
}

function load(c: Case) {
  store.ff1_save_0 = JSON.stringify(stored(c));
  const loaded = SaveManager.load(0);
  expect(loaded).not.toBeNull();
  // case 8, in every case: flags, party, items and gold equal before and after
  expect(loaded!.flags.toJSON()).toEqual(stored(c).flags);
  expect(loaded!.party.toJSON()).toEqual(party().toJSON());
  expect(loaded!.party.gold).toBe(4321);
  expect(loaded!.inventory.toJSON()).toEqual(inventory().toJSON());
  expect(loaded!.playTime).toBe(999);
  return loaded!;
}

const ship = (map: string, x: number, y: number): VehicleState => ({ type: 'ship', map, x, y });
const SHIP_SPOT = { type: 'ship', map: 'overworld', at: 'a1_s_pravoka_ship' };
const AIRSHIP_SPOT = { type: 'airship', map: 'overworld', at: 'a1_s_airship' };

beforeAll(loadRealRegistries);
beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

describe('saveWorldReset: the 8 cases (5.3)', () => {
  it('saves are version 4', () => expect(SAVE_VERSION).toBe(4));

  it('1. a v3 save on foot on the world map, no vehicle: Cornelia', () => {
    const l = load({ version: 3, map: 'overworld', at: [92, 111], flags: ['GARLAND_DEFEATED'] });
    expect(l.reset).toBe(true);
    expect(l.currentMap).toBe('overworld');
    expect(l.fieldMode).toBe('walking');
    expect(l.vehicles).toEqual([]);
  });

  it('2. a v3 save in the ship on the Aldi: Cornelia on foot, the ship at the a1_pravoka dock', () => {
    const l = load({ version: 3, map: 'overworld', at: [100, 120], flags: ['BIKKE_DEFEATED'], mode: 'ship',
      vehicles: [ship('overworld', 100, 120)] });
    expect(l.reset).toBe(true);
    expect(l.fieldMode).toBe('walking');
    expect(l.vehicles).toEqual([SHIP_SPOT]);
  });

  it('3. a v3 save in Melmond with the ship at Melmond\'s dock: Cornelia, the ship at a1_pravoka', () => {
    const l = load({ version: 3, map: 'melmond', at: [10, 20], flags: ['BIKKE_DEFEATED', 'CANAL_OPEN'],
      vehicles: [ship('overworld', 40, 112)] });
    expect(l.reset).toBe(true);
    expect(l.currentMap).toBe('overworld');
    expect(l.vehicles).toEqual([SHIP_SPOT]);
  });

  it('4. a v3 save with the airship parked in the north: Cornelia, the airship at a1_s_airship, the ship at a1_pravoka', () => {
    const l = load({ version: 3, map: 'onrac', at: [5, 5], flags: ['BIKKE_DEFEATED', 'AIRSHIP_RAISED'],
      vehicles: [ship('overworld', 40, 112), { type: 'airship', map: 'overworld', x: 30, y: 30 }] });
    expect(l.reset).toBe(true);
    expect(l.currentMap).toBe('overworld');
    expect(l.vehicles).toEqual([SHIP_SPOT, AIRSHIP_SPOT]);
  });

  it('5. a v3 save inside the castle before the ship: the same map and position, no vehicle', () => {
    const l = load({ version: 3, map: 'cornelia-castle', at: [21, 30], flags: ['GARLAND_DEFEATED'] });
    expect(l.reset).toBe(false);
    expect(l.currentMap).toBe('cornelia-castle');
    expect(l.playerPosition).toEqual({ x: 21, y: 30 });
    expect(l.vehicles).toEqual([]);
  });

  it('6. a v1 save on the world map: Cornelia', () => {
    const l = load({ version: 1, map: 'overworld', at: [28, 47], flags: [] });
    expect(l.reset).toBe(true);
    expect(l.currentMap).toBe('overworld');
    expect(l.fieldMode).toBe('walking');
  });

  it('7. a v4 save is untouched', () => {
    const v = [ship('overworld', 150, 170), { type: 'airship' as const, map: 'overworld', x: 60, y: 40 }];
    const l = load({ version: 4, map: 'overworld', at: [60, 41], flags: ['BIKKE_DEFEATED', 'AIRSHIP_RAISED'],
      mode: 'walking', vehicles: v });
    expect(l.reset).toBe(false);
    expect(l.playerPosition).toEqual({ x: 60, y: 41 });
    expect(l.vehicles).toEqual(v);
  });

  it('resetSave is pure: the input is not changed; a moved save says Cornelia; the entrance is cornelia', () => {
    const data = stored({ version: 2, map: 'overworld', at: [1, 2], flags: ['BIKKE_DEFEATED'], vehicles: [ship('overworld', 3, 4)] });
    const copy = JSON.parse(JSON.stringify(data));
    const r = resetSave(data);
    expect(data).toEqual(copy);
    expect(r.moved).toBe(true);
    expect(r.data.location).toBe(RESET_LOCATION);
    expect(RESET_ENTRANCE).toBe('cornelia');
  });
});
