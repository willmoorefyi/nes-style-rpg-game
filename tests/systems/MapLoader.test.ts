import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapLoader } from '../../src/systems/MapLoader.js';
import type { DataLoader } from '../../src/core/DataLoader.js';
import type { PlaceholderTextures } from '../../src/rendering/PlaceholderTextures.js';
import { Texture } from 'pixi.js';

function createMockDataLoader() {
  return {
    loadMap: vi.fn().mockResolvedValue({
      id: 'test',
      width: 10,
      height: 10,
      layers: [[0]],
      tilesets: [],
      collision: new Array(100).fill(0),
      npcs: [],
      transitions: [],
    }),
  } as unknown as DataLoader;
}

function createMockPlaceholders() {
  return {
    getNPCTexture: vi.fn().mockReturnValue(Texture.WHITE),
    getPlayerTexture: vi.fn().mockReturnValue(Texture.WHITE),
  } as unknown as PlaceholderTextures;
}

describe('MapLoader', () => {
  let dataLoader: DataLoader;
  let placeholders: PlaceholderTextures;
  let loader: MapLoader;

  beforeEach(() => {
    dataLoader = createMockDataLoader();
    placeholders = createMockPlaceholders();
    loader = new MapLoader(dataLoader, placeholders);
  });

  it('loads map and returns result', async () => {
    const result = await loader.loadMap('test-map');
    expect(result.mapData).toBeDefined();
    expect(result.tilemap).toBeDefined();
    expect(result.collisionMap).toBeDefined();
    expect(result.npcs).toEqual([]);
  });

  it('calls dataLoader with correct path', async () => {
    await loader.loadMap('my-map');
    expect(dataLoader.loadMap).toHaveBeenCalledWith('assets/maps/my-map.json');
  });
});
