import { describe, it, expect } from 'vitest';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { TerrainType } from '../../src/types/index.js';
import type { MapData } from '../../src/types/index.js';
import { WalkingMode } from '../../src/entities/WalkingMode.js';
import { ShipMode } from '../../src/entities/ShipMode.js';

function createTestMap(): MapData {
  return {
    id: 'test',
    width: 4,
    height: 4,
    layers: [[1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1]],
    tilesets: ['test.png'],
    collision: [
      1, 1, 1, 1,
      1, 0, 0, 1,
      1, 0, 0, 1,
      1, 1, 1, 1,
    ],
    npcs: [],
    transitions: [],
  };
}

function createTerrainMap(): MapData {
  // 4x4 map with varied terrain
  return {
    id: 'terrain-test',
    width: 4,
    height: 4,
    layers: [[0]],
    tilesets: ['test.png'],
    collision: [
      0, 1, 2, 3,  // Grass, Wall, Water, Mountain
      4, 5, 6, 7,  // Forest, Desert, Swamp, River
      8, 9, 0, 2,  // Road, Bridge, Grass, Water
      1, 1, 1, 1,  // All walls
    ],
    npcs: [],
    transitions: [],
  };
}

describe('CollisionMap', () => {
  it('returns false for non-walkable tiles (collision=1)', () => {
    const map = new CollisionMap(createTestMap());
    expect(map.isWalkable(0, 0)).toBe(false);
    expect(map.isWalkable(3, 3)).toBe(false);
    expect(map.isWalkable(0, 1)).toBe(false);
  });

  it('returns true for walkable tiles (collision=0)', () => {
    const map = new CollisionMap(createTestMap());
    expect(map.isWalkable(1, 1)).toBe(true);
    expect(map.isWalkable(2, 1)).toBe(true);
    expect(map.isWalkable(1, 2)).toBe(true);
    expect(map.isWalkable(2, 2)).toBe(true);
  });

  it('returns false for out-of-bounds coordinates', () => {
    const map = new CollisionMap(createTestMap());
    expect(map.isWalkable(-1, 0)).toBe(false);
    expect(map.isWalkable(0, -1)).toBe(false);
    expect(map.isWalkable(4, 0)).toBe(false);
    expect(map.isWalkable(0, 4)).toBe(false);
    expect(map.isWalkable(100, 100)).toBe(false);
  });

  it('exposes map dimensions', () => {
    const map = new CollisionMap(createTestMap());
    expect(map.getWidth()).toBe(4);
    expect(map.getHeight()).toBe(4);
  });

  describe('getTerrainType', () => {
    it('returns correct terrain types from collision data', () => {
      const map = new CollisionMap(createTerrainMap());
      expect(map.getTerrainType(0, 0)).toBe(TerrainType.Grass);
      expect(map.getTerrainType(1, 0)).toBe(TerrainType.Wall);
      expect(map.getTerrainType(2, 0)).toBe(TerrainType.Water);
      expect(map.getTerrainType(3, 0)).toBe(TerrainType.Mountain);
      expect(map.getTerrainType(0, 1)).toBe(TerrainType.Forest);
      expect(map.getTerrainType(1, 1)).toBe(TerrainType.Desert);
      expect(map.getTerrainType(2, 1)).toBe(TerrainType.Swamp);
      expect(map.getTerrainType(3, 1)).toBe(TerrainType.River);
      expect(map.getTerrainType(0, 2)).toBe(TerrainType.Road);
      expect(map.getTerrainType(1, 2)).toBe(TerrainType.Bridge);
    });

    it('returns Wall for out-of-bounds coordinates', () => {
      const map = new CollisionMap(createTerrainMap());
      expect(map.getTerrainType(-1, 0)).toBe(TerrainType.Wall);
      expect(map.getTerrainType(0, -1)).toBe(TerrainType.Wall);
      expect(map.getTerrainType(4, 0)).toBe(TerrainType.Wall);
      expect(map.getTerrainType(0, 4)).toBe(TerrainType.Wall);
    });
  });

  describe('terrain-aware isWalkable', () => {
    it('walking mode can traverse land but not water', () => {
      const map = new CollisionMap(createTerrainMap());
      const walking = new WalkingMode();
      expect(map.isWalkable(0, 0, walking)).toBe(true);  // Grass
      expect(map.isWalkable(0, 1, walking)).toBe(true);  // Forest
      expect(map.isWalkable(2, 0, walking)).toBe(false);  // Water
      expect(map.isWalkable(1, 0, walking)).toBe(false);  // Wall
      expect(map.isWalkable(3, 0, walking)).toBe(false);  // Mountain
    });

    it('ship mode can traverse water but not land', () => {
      const map = new CollisionMap(createTerrainMap());
      const ship = new ShipMode();
      expect(map.isWalkable(2, 0, ship)).toBe(true);   // Water
      expect(map.isWalkable(0, 0, ship)).toBe(false);   // Grass
      expect(map.isWalkable(1, 0, ship)).toBe(false);   // Wall
    });

    it('legacy mode (no MovementMode) treats non-wall as walkable', () => {
      const map = new CollisionMap(createTerrainMap());
      expect(map.isWalkable(0, 0)).toBe(true);   // Grass
      expect(map.isWalkable(2, 0)).toBe(true);   // Water (legacy: walkable)
      expect(map.isWalkable(1, 0)).toBe(false);  // Wall
      expect(map.isWalkable(0, 1)).toBe(true);   // Forest
    });
  });
});
