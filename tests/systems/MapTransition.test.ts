import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapTransitionSystem } from '../../src/systems/MapTransition.js';
import type { DataLoader } from '../../src/core/DataLoader.js';
import type { MapData, MapTransition } from '../../src/types/index.js';

function createMockDataLoader(): DataLoader {
  return {
    loadMap: vi.fn(),
  } as unknown as DataLoader;
}

function createMapData(id: string): MapData {
  return {
    id,
    width: 8,
    height: 8,
    layers: [[]],
    tilesets: [],
    collision: [],
    npcs: [],
    transitions: [],
  };
}

describe('MapTransitionSystem', () => {
  let dataLoader: DataLoader;
  let system: MapTransitionSystem;

  beforeEach(() => {
    dataLoader = createMockDataLoader();
    system = new MapTransitionSystem(dataLoader);
  });

  it('returns null when no transition at position', () => {
    system.setTransitions([]);
    expect(system.getTransitionAt(5, 5)).toBeNull();
  });

  it('returns transition at matching position', () => {
    const transition: MapTransition = { x: 5, y: 10, targetMap: 'town', targetX: 1, targetY: 1 };
    system.setTransitions([transition]);
    expect(system.getTransitionAt(5, 10)).toEqual(transition);
  });

  it('loads target map on executeTransition', async () => {
    const mapData = createMapData('town');
    vi.mocked(dataLoader.loadMap).mockResolvedValue(mapData);
    const transition: MapTransition = { x: 0, y: 0, targetMap: 'town', targetX: 2, targetY: 3 };
    const result = await system.executeTransition(transition);
    expect(result).toEqual({ mapData, spawnX: 2, spawnY: 3 });
  });

  it('returns null when map load fails', async () => {
    vi.mocked(dataLoader.loadMap).mockRejectedValue(new Error('not found'));
    const transition: MapTransition = { x: 0, y: 0, targetMap: 'missing', targetX: 0, targetY: 0 };
    const result = await system.executeTransition(transition);
    expect(result).toBeNull();
  });
});
