/**
 * Pass CD (docs/CARDIA_PLAN.md 8): saves inside the retired bahamut-cave / bahamut-lair load in Cardia Deep.
 * `relocateRetired` runs first in `SaveManager.load`, so a v4 save is revalidated (NW2, `revalidateNw2`) from Cardia
 * Deep, whose first stair leads to ord_bahamut where its airship is parked, and a v1-v3 save that owns the airship
 * still takes the D-NW8 reset to Cornelia.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { RETIRED_MAPS, relocateRetired } from '../../src/systems/retiredMaps.js';
import { SaveManager } from '../../src/systems/SaveManager.js';
import { wayOutSync } from '../../src/systems/worldRevalidate.js';
import { revalidateLoaded } from '../../src/scenes/save/loadRevalidate.js';
import { validateMapData } from '../../src/core/schemaValidation.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import type { MapData, SaveData, VehicleState } from '../../src/types/index.js';
import { spot } from '../helpers/worldSpots.js';

const store: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  },
});

const cache = new Map<string, MapData>();
function mapOf(id: string): MapData | null {
  const f = `assets/maps/ai/${id}.yaml`;
  if (!existsSync(f)) return null;
  if (!cache.has(id)) cache.set(id, validateMapData(parse(readFileSync(f, 'utf-8'))));
  return cache.get(id)!;
}
const maps = async (id: string): Promise<MapData> => {
  const m = mapOf(id);
  if (!m) throw new Error(`no map ${id}`);
  return m;
};
const FLAGS = ['BIKKE_DEFEATED', 'CANAL_OPEN', 'CANOE_GIVEN', 'AIRSHIP_RAISED'];

function save(version: number, map: string, vehicles: VehicleState[], flags = FLAGS): SaveData {
  const f = new GameFlags();
  flags.forEach((x) => f.set(x));
  const data: SaveData = {
    version, party: new PartyManager().toJSON() as SaveData['party'], inventory: new Inventory().toJSON(),
    flags: f.toJSON(), currentMap: map, playerPosition: { x: 19, y: 12 }, playTime: 5,
    saveDate: '2026-11-22T00:00:00.000Z', slotId: 0, mode: 'walking', vehicles, location: "Bahamut's Lair",
  };
  store.ff1_save_0 = JSON.stringify(data);
  return data;
}
const airship = (): VehicleState => ({ type: 'airship', map: 'overworld', ...spot(mapOf('overworld')!, 'ord_s_bahamut_airship') });

beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

describe('retiredMaps: the Bahamut maps live on in Cardia Deep', () => {
  it('every retired map\'s target is an entrance of the compiled map', () => {
    for (const [id, t] of Object.entries(RETIRED_MAPS)) {
      expect(existsSync(`assets/maps/ai/${id}.yaml`), `${id} is gone`).toBe(false);
      expect(mapOf(t.map)!.entrances![t.entrance], `${id} -> ${t.map} ${t.entrance}`).toBeDefined();
    }
  });

  it('relocateRetired moves a save on foot to the new map; any other save is untouched', () => {
    const r = relocateRetired({ ...save(5, 'bahamut-lair', []), mode: 'canoe' });
    expect([r.data.currentMap, r.data.mode, r.data.location, r.entrance]).toEqual(['cardia-deep', 'walking', 'Cardia Deep', 'court']);
    const same = save(5, 'cardia-deep', []);
    expect(relocateRetired(same)).toEqual({ data: same, entrance: null });
  });

  it.each([['bahamut-cave', 'bahamut_gate'], ['bahamut-lair', 'court']])('a v5 save in %s loads at cardia-deep %s', (id, e) => {
    save(5, id, [airship()]);
    const d = SaveManager.load(0)!;
    expect([d.currentMap, d.entrance, d.reset, d.revalidate]).toEqual(['cardia-deep', e, false, false]);
    expect(d.vehicles).toEqual([airship()]);
  });

  it('wayOutSync from cardia-deep is ord_bahamut (its first stair, plan 5.2)', () => {
    expect(wayOutSync('cardia-deep', new Set(FLAGS), mapOf)).toBe('ord_bahamut');
  });

  it('a v4 save in bahamut-lair, its airship at Bahamut\'s isle, is revalidated in cardia-deep and keeps the airship', async () => {
    save(4, 'bahamut-lair', [airship()]);
    const d = SaveManager.load(0)!;
    expect([d.currentMap, d.entrance, d.revalidate]).toEqual(['cardia-deep', 'court', true]);
    const r = await revalidateLoaded(d, maps);
    expect([r.currentMap, r.reset, r.entrance]).toEqual(['cardia-deep', false, 'court']);
    expect(r.vehicles).toEqual([airship()]);
  });

  it('a v3 save in bahamut-cave that owns the airship takes the D-NW8 reset to Cornelia, as before', () => {
    save(3, 'bahamut-cave', [airship()]);
    const d = SaveManager.load(0)!;
    expect([d.reset, d.currentMap, d.entrance]).toEqual([true, 'overworld', null]);
  });

  it('a save in cardia-deep loads as it was', () => {
    save(5, 'cardia-deep', [airship()]);
    const d = SaveManager.load(0)!;
    expect([d.currentMap, d.entrance, d.reset, d.playerPosition]).toEqual(['cardia-deep', null, false, { x: 19, y: 12 }]);
  });
});
