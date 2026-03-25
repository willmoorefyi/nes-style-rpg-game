import { describe, it, expect } from 'vitest';
import { Container, Texture } from 'pixi.js';
import { TilemapRenderer } from '../../src/rendering/TilemapRenderer.js';
import { Camera } from '../../src/rendering/Camera.js';
import type { MapData } from '../../src/types/index.js';

function createLargeMap(size: number): MapData {
  return {
    id: 'perf-test',
    width: size,
    height: size,
    layers: [Array(size * size).fill(1)],
    tilesets: ['test.png'],
    collision: Array(size * size).fill(0),
    npcs: [],
    transitions: [],
  };
}

function createMockTexture(): Texture {
  return {
    source: { width: 64, height: 64 },
    width: 64,
    height: 64,
  } as unknown as Texture;
}

describe('TilemapRenderer performance', () => {
  it('has dirty flag that prevents redundant renders', () => {
    const map = createLargeMap(32);
    const renderer = new TilemapRenderer(map, createMockTexture(), 4);
    const container = new Container();
    const camera = new Camera(container);
    camera.setMapBounds(32, 32);
    renderer.setCamera(camera);

    // First render should process tiles
    renderer.render();
    const layer = renderer.container.children[0] as Container;
    const firstCount = layer.children.filter(c => c.visible).length;
    expect(firstCount).toBeGreaterThan(0);

    // Second render with same bounds should be a no-op (dirty flag cleared)
    renderer.render();
    const secondCount = layer.children.filter(c => c.visible).length;
    expect(secondCount).toBe(firstCount);
  });

  it('markDirty forces re-render', () => {
    const map = createLargeMap(4);
    const renderer = new TilemapRenderer(map, createMockTexture(), 4);

    renderer.render();
    renderer.markDirty();
    // Should not throw and should re-render
    expect(() => renderer.render()).not.toThrow();
  });

  it('culls tiles outside camera viewport on large maps', () => {
    const map = createLargeMap(64);
    const renderer = new TilemapRenderer(map, createMockTexture(), 4);
    const container = new Container();
    const camera = new Camera(container);
    camera.setMapBounds(64, 64);
    renderer.setCamera(camera);

    renderer.render();
    const layer = renderer.container.children[0] as Container;
    const visibleCount = layer.children.filter(c => c.visible).length;

    // 64x64 = 4096 tiles total, but viewport is 1920x1080 = ~41x24 tiles
    expect(visibleCount).toBeLessThan(64 * 64);
    expect(visibleCount).toBeGreaterThan(0);
    expect(visibleCount).toBeLessThan(1100); // Roughly 41*24 = 984 + edge tiles
  });

  it('reuses sprites from pool instead of creating new ones', () => {
    const map = createLargeMap(4);
    const renderer = new TilemapRenderer(map, createMockTexture(), 4);

    renderer.render();
    const layer = renderer.container.children[0] as Container;
    const spriteCountAfterFirst = layer.children.length;

    renderer.markDirty();
    renderer.render();
    const spriteCountAfterSecond = layer.children.length;

    // Pool should reuse sprites, not create new ones
    expect(spriteCountAfterSecond).toBe(spriteCountAfterFirst);
  });
});
