import { describe, it, expect } from 'vitest';
import { Container, Sprite, Texture } from 'pixi.js';
import { BakedMapRenderer, aboveZIndex } from '../../src/rendering/BakedMapRenderer.js';
import { Camera } from '../../src/rendering/Camera.js';
import { TILE_SIZE } from '../../src/core/LayoutConstants.js';
import type { MapData } from '../../src/types/index.js';

/** 64x48 tiles in 16-tile chunks: 4 columns x 3 rows of chunks. */
function bakedMap(aboveAt: number[] = [1]): MapData {
  const n = 12;
  return {
    id: 'baked', width: 64, height: 48, layers: [], tilesets: [],
    collision: new Array(64 * 48).fill(0), npcs: [], transitions: [],
    art: {
      tile: 48, chunk: 16,
      below: Array.from({ length: n }, (_, i) => `below_${i}.png`),
      above: Array.from({ length: n }, (_, i) => (aboveAt.includes(i) ? `above_${i}.png` : null)),
    },
  };
}

function textures(map: MapData) {
  return {
    below: map.art!.below.map(() => Texture.WHITE),
    above: map.art!.above.map((p) => (p ? Texture.WHITE : null)),
  };
}

describe('BakedMapRenderer', () => {
  it('places each chunk row-major at chunk * TILE_SIZE, scaled from 48 native px to TILE_SIZE', () => {
    const map = bakedMap();
    const r = new BakedMapRenderer(map, textures(map));
    const sprites = r.container.children as Sprite[];
    expect(sprites).toHaveLength(12);
    expect(sprites[5].position.x).toBe(1 * 16 * TILE_SIZE);   // index 5 = row 1, col 1
    expect(sprites[5].position.y).toBe(1 * 16 * TILE_SIZE);
    expect(sprites[0].scale.x).toBe(TILE_SIZE / 48);
  });

  it('skips empty above chunks and draws the rest over every character', () => {
    const map = bakedMap([1, 7]);
    const r = new BakedMapRenderer(map, textures(map));
    expect(r.aboveContainer.children).toHaveLength(2);
    expect(r.aboveContainer.children[1].position.x).toBe(3 * 16 * TILE_SIZE);   // index 7 = row 1, col 3
    // a character's zIndex is its feet y; the lowest possible feet are at the map's bottom edge
    const lowestFeet = map.height * TILE_SIZE;
    expect(r.aboveContainer.zIndex).toBe(aboveZIndex(map));
    expect(r.aboveContainer.zIndex).toBeGreaterThan(lowestFeet);
    expect(r.container.zIndex).toBeLessThan(0);
  });

  it('hides chunks outside the camera view', () => {
    const map = bakedMap();
    const r = new BakedMapRenderer(map, textures(map));
    const cam = new Camera(new Container());
    cam.setMapBounds(map.width, map.height);
    cam.setPosition(0, 0);
    r.setCamera(cam);
    r.render();
    const vis = (r.container.children as Sprite[]).map((s) => s.visible);
    expect(vis[0]).toBe(true);
    expect(vis[11]).toBe(false);          // bottom-right chunk is far off screen
  });

  it('rejects a map without baked art', () => {
    const map = { ...bakedMap(), art: undefined };
    expect(() => new BakedMapRenderer(map, { below: [], above: [] })).toThrow(/no baked art/);
  });
});
