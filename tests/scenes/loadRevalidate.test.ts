/**
 * NW2-S (docs/NW2_EDITS_PLAN.md 12): `LoadScene` is the async host of the v4 save check. A v4 save waits while the
 * world map and its way out load (each map once), then the field opens with the checked save; a v5 save loads at
 * once, as before; a stranded save arrives at Cornelia with the notice; a map that cannot be read loads the save as it
 * was saved.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { LoadScene } from '../../src/scenes/LoadScene.js';
import { revalidateLoaded } from '../../src/scenes/save/loadRevalidate.js';
import { SaveManager } from '../../src/systems/SaveManager.js';
import { RESET_ENTRANCE, RESET_NOTICE } from '../../src/systems/worldReset.js';
import { validateMapData } from '../../src/core/schemaValidation.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import type { Game } from '../../src/core/Game.js';
import type { MapData, SaveData, VehicleState } from '../../src/types/index.js';
import { dock, entrance, spot } from '../helpers/worldSpots.js';

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
const requested: string[] = [];
async function maps(id: string): Promise<MapData> {
  requested.push(id);
  const f = `assets/maps/ai/${id}.yaml`;
  if (!existsSync(f)) throw new Error(`no map ${id}`);
  if (!cache.has(id)) cache.set(id, validateMapData(parse(readFileSync(f, 'utf-8'))));
  return cache.get(id)!;
}
const world = () => cache.get('overworld')!;

function stored(version: number, map: string, at: { x: number; y: number }, flags: string[], items: string[],
  vehicles: VehicleState[]): void {
  const f = new GameFlags();
  flags.forEach((x) => f.set(x));
  const inv = new Inventory();
  items.forEach((i) => inv.add(i, 1));
  const data: SaveData = {
    version, party: new PartyManager().toJSON() as SaveData['party'], inventory: inv.toJSON(), flags: f.toJSON(),
    currentMap: map, playerPosition: at, playTime: 5, saveDate: '2026-11-20T00:00:00.000Z', slotId: 0,
    mode: 'walking', vehicles,
  };
  store.ff1_save_0 = JSON.stringify(data);
}

function game() {
  const pressed = new Set<string>();
  return {
    pressed,
    scenes: { pop: vi.fn(), switchTo: vi.fn() },
    input: { isPressed: () => false, isJustPressed: (a: string) => pressed.has(a) },
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    party: new PartyManager(), restoreState: vi.fn(),
    pendingEntrance: null as string | null, pendingFacing: null as string | null, pendingNotice: null as string | null,
    battleRetry: null, pendingBattle: null,
  };
}

/** Choose slot 1 and answer Yes (from the title: the prompt starts on Yes). */
function loadSlot(g: ReturnType<typeof game>): LoadScene {
  const scene = new LoadScene(g as unknown as Game, maps);
  scene.enter();
  scene.openedFromTitle();
  const press = (a: string): void => { g.pressed.add(a); scene.update(1); g.pressed.clear(); };
  press('confirm');
  press('confirm');
  return scene;
}

const until = async (f: () => boolean): Promise<void> => {
  for (let i = 0; i < 200 && !f(); i++) await new Promise((r) => setTimeout(r, 5));
};

const CANOE = ['BIKKE_DEFEATED', 'CANAL_OPEN', 'CANOE_GIVEN'];

beforeEach(async () => {
  for (const k of Object.keys(store)) delete store[k];
  requested.length = 0;
  await maps('overworld');
  requested.length = 0;
});

describe('loadRevalidate: LoadScene checks a v4 save on the NW2 world', () => {
  it('inside ice-cavern-b2 with the ship at Crescent: the field opens in b2, the ship at the fir_ice dock', async () => {
    const b2 = await maps('ice-cavern-b2');
    requested.length = 0;
    stored(4, 'ice-cavern-b2', entrance(b2, 'arrival'), CANOE, ['canoe'],
      [{ type: 'ship', map: 'overworld', ...spot(world(), 'fir_s_crescent_ship') }]);
    const g = game();
    const scene = loadSlot(g);
    expect(scene.busy).toBe(true);
    expect(g.scenes.switchTo).not.toHaveBeenCalled();
    await until(() => !scene.busy);
    expect(requested).toEqual(['overworld', 'ice-cavern-b2', 'ice-cavern-b1']);
    expect(g.restoreState).toHaveBeenCalledTimes(1);
    const data = g.restoreState.mock.calls[0][0];
    expect(data.currentMap).toBe('ice-cavern-b2');
    expect(data.playerPosition).toEqual(entrance(b2, 'arrival'));
    expect(data.vehicles).toEqual([{ type: 'ship', map: 'overworld', ...dock(world(), 'fir_ice') }]);
    expect(g.pendingEntrance).toBeNull();
    expect(g.pendingNotice).toBeNull();
    expect(g.scenes.switchTo).toHaveBeenCalledWith('exploration');
  });

  it('a stranded v4 save arrives at Cornelia with the notice', async () => {
    stored(4, 'overworld', entrance(world(), 'fir_ice'), ['BIKKE_DEFEATED', 'CANAL_OPEN'], [],
      [{ type: 'ship', map: 'overworld', ...dock(world(), 'fir_crescent') }]);
    const g = game();
    const scene = loadSlot(g);
    await until(() => !scene.busy);
    expect(g.pendingEntrance).toBe(RESET_ENTRANCE);
    expect(g.pendingNotice).toBe(RESET_NOTICE);
    expect(g.restoreState.mock.calls[0][0].vehicles).toEqual([{ type: 'ship', map: 'overworld', at: 'a1_s_pravoka_ship' }]);
  });

  it('a v5 save loads at once, with no map read', () => {
    stored(5, 'overworld', entrance(world(), 'fir_ice'), ['BIKKE_DEFEATED'], [], []);
    const g = game();
    const scene = loadSlot(g);
    expect(scene.busy).toBe(false);
    expect(requested).toEqual([]);
    expect(g.restoreState).toHaveBeenCalledTimes(1);
    expect(g.pendingEntrance).toBeNull();
  });

  it('when the world map cannot be read the v4 save loads as it was (with a console error)', async () => {
    stored(4, 'overworld', { x: 3, y: 3 }, [], [], []);
    const data = SaveManager.load(0)!;
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = await revalidateLoaded(data, () => Promise.reject(new Error('offline')));
    expect(err).toHaveBeenCalled();
    err.mockRestore();
    expect(out).toBe(data);
  });
});
