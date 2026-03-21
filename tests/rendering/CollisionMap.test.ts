import { describe, it, expect } from 'vitest';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import type { MapData } from '../../src/types/index.js';

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
});
