/**
 * `DebugScenario.frame: a1` (GAP-18; docs/WORLD_PLAN.md 1.5, W1-B): a raw act-1 spawn is moved by the loaded map's
 * `world.frames.a1.origin` when it has one, and kept on the act-1 map.
 */
import { describe, it, expect, vi } from 'vitest';
import { DebugScenarioLoader, a1Origin, scenarioSpawn, type DebugScenario } from '../../src/systems/DebugScenarioLoader.js';
import type { Game } from '../../src/core/Game.js';
import type { MapData } from '../../src/types/index.js';
import { createMapData } from '../helpers/testUtils.js';

const world = createMapData({ id: 'overworld', width: 192, height: 192,
  world: { frames: { a1: { origin: [64, 64], size: [72, 72] } } } });
const act1 = createMapData({ id: 'overworld', width: 72, height: 72 });

const temple: DebugScenario = {
  id: 'r_ow_temple', name: 't', mode: 'field', map: 'overworld', spawn: [15, 42], frame: 'a1',
  party: [], items: {}, gold: 0, enemies: [],
};

function fakeGame(map: MapData) {
  return {
    party: { all: [] as unknown[], remove: vi.fn(), add: vi.fn(), setGold: vi.fn() },
    inventory: { clear: vi.fn(), add: vi.fn() },
    scenes: { switchTo: vi.fn() },
    resetState: vi.fn(),
    data: { loadMap: vi.fn().mockResolvedValue(map), loadMapManifest: vi.fn().mockResolvedValue(['overworld']) },
    currentMapId: '',
    pendingEntrance: null as string | null,
    playerPosition: { x: 0, y: 0 },
  };
}

describe('debugFrame: scenarioSpawn', () => {
  it('moves an a1 spawn by the world origin and keeps it on the act-1 map', () => {
    expect(a1Origin(world)).toEqual([64, 64]);
    expect(a1Origin(act1)).toEqual([0, 0]);
    expect(scenarioSpawn(temple, world)).toEqual([79, 106]);
    expect(scenarioSpawn(temple, act1)).toEqual([15, 42]);
  });

  it('a spawn without a frame is a cell of the map itself', () => {
    expect(scenarioSpawn({ ...temple, frame: undefined }, world)).toEqual([15, 42]);
  });
});

describe('debugFrame: the loader', () => {
  it.each([[world, { x: 79, y: 106 }], [act1, { x: 15, y: 42 }]])('places the party in the loaded map\'s frame', async (map, at) => {
    const game = fakeGame(map);
    await new DebugScenarioLoader(game as unknown as Game).run(temple);
    expect(game.currentMapId).toBe('overworld');
    expect(game.playerPosition).toEqual(at);
    expect(game.scenes.switchTo).toHaveBeenCalledWith('exploration');
  });

  it('a map that fails to load keeps the raw cell (and logs)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const game = fakeGame(act1);
    game.data.loadMap.mockRejectedValue(new Error('404'));
    await new DebugScenarioLoader(game as unknown as Game).run(temple);
    expect(game.playerPosition).toEqual({ x: 15, y: 42 });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('a scenario without a frame never loads the map', async () => {
    const game = fakeGame(world);
    await new DebugScenarioLoader(game as unknown as Game).run({ ...temple, frame: undefined });
    expect(game.data.loadMap).not.toHaveBeenCalled();
    expect(game.playerPosition).toEqual({ x: 15, y: 42 });
  });
});
