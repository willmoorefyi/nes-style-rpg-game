import type { MapData } from '../../src/types/index.js';

export function createMapData(overrides: Partial<MapData> = {}): MapData {
  const width = overrides.width ?? 8;
  const height = overrides.height ?? 8;
  const size = width * height;
  
  return {
    id: 'test-map',
    width,
    height,
    layers: [Array(size).fill(2)],
    tilesets: ['tileset.png'],
    collision: Array(size).fill(0),
    npcs: [],
    transitions: [],
    ...overrides,
  };
}
