import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Container, Texture } from 'pixi.js';
import { TilemapRenderer } from '../../src/rendering/TilemapRenderer.js';
import { Camera } from '../../src/rendering/Camera.js';
import type { MapData } from '../../src/types/index.js';

function createMockTexture(): Texture {
  return {
    source: { width: 64, height: 64 },
    width: 64,
    height: 64,
  } as unknown as Texture;
}

function createTestMap(): MapData {
  return {
    id: 'test',
    width: 4,
    height: 4,
    layers: [
      [
        1, 2, 1, 2,
        2, 1, 2, 1,
        1, 2, 1, 2,
        2, 1, 2, 1,
      ],
    ],
    tilesets: ['test.png'],
    collision: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    npcs: [],
    transitions: [],
  };
}

describe('TilemapRenderer', () => {
  let renderer: TilemapRenderer;

  beforeEach(() => {
    renderer = new TilemapRenderer(createTestMap(), createMockTexture(), 4);
  });

  it('creates a container', () => {
    expect(renderer.container).toBeInstanceOf(Container);
  });

  it('exposes map dimensions', () => {
    expect(renderer.width).toBe(4);
    expect(renderer.height).toBe(4);
  });

  it('creates layer containers for each layer', () => {
    expect(renderer.container.children.length).toBe(1);
  });

  it('renders tiles when render() is called', () => {
    renderer.render();
    const layerContainer = renderer.container.children[0] as Container;
    // All 16 tiles should be rendered (none are 0)
    const visibleSprites = layerContainer.children.filter((c: any) => c.visible);
    expect(visibleSprites.length).toBe(16);
  });

  it('positions tiles correctly', () => {
    renderer.render();
    const layerContainer = renderer.container.children[0] as Container;
    const sprites = layerContainer.children as any[];

    // Find sprite at position (0,0) and (16,0)
    const atOrigin = sprites.find((s) => s.x === 0 && s.y === 0);
    const atSecond = sprites.find((s) => s.x === 16 && s.y === 0);

    expect(atOrigin).toBeDefined();
    expect(atSecond).toBeDefined();
  });

  it('culls tiles outside camera viewport', () => {
    // Create a larger map
    const largeMap: MapData = {
      id: 'large',
      width: 32,
      height: 32,
      layers: [Array(32 * 32).fill(1)],
      tilesets: ['test.png'],
      collision: Array(32 * 32).fill(0),
      npcs: [],
      transitions: [],
    };

    const largeRenderer = new TilemapRenderer(largeMap, createMockTexture(), 4);
    const container = new Container();
    const camera = new Camera(container);
    camera.setMapBounds(32, 32);
    largeRenderer.setCamera(camera);

    largeRenderer.render();
    const layerContainer = largeRenderer.container.children[0] as Container;
    const visibleSprites = layerContainer.children.filter((c: any) => c.visible);

    // Viewport is 256x240 = 16x15 tiles, so ~240 tiles visible (plus edge tiles)
    expect(visibleSprites.length).toBeLessThan(32 * 32);
    expect(visibleSprites.length).toBeGreaterThan(0);
  });

  it('skips empty tiles (tileId 0)', () => {
    const mapWithEmpty: MapData = {
      id: 'sparse',
      width: 2,
      height: 2,
      layers: [[1, 0, 0, 2]],
      tilesets: ['test.png'],
      collision: [0, 0, 0, 0],
      npcs: [],
      transitions: [],
    };

    const sparseRenderer = new TilemapRenderer(mapWithEmpty, createMockTexture(), 4);
    sparseRenderer.render();

    const layerContainer = sparseRenderer.container.children[0] as Container;
    const visibleSprites = layerContainer.children.filter((c: any) => c.visible);
    expect(visibleSprites.length).toBe(2); // Only tiles 1 and 2
  });
});

describe('TilemapRenderer with PlaceholderTextures', () => {
  it('renders correctly with null tileset and placeholders', () => {
    const mockPlaceholders = {
      getTileTexture: vi.fn().mockReturnValue(Texture.WHITE),
    };

    const mapData = createTestMap();
    const renderer = new TilemapRenderer(
      mapData,
      null,
      16,
      mockPlaceholders as any
    );

    renderer.render();

    // Should call getTileTexture for each visible tile
    expect(mockPlaceholders.getTileTexture).toHaveBeenCalled();
  });

  it('uses placeholder textures for each tile ID', () => {
    const textureMap = new Map<number, Texture>();
    const mockPlaceholders = {
      getTileTexture: vi.fn((id: number) => {
        if (!textureMap.has(id)) {
          textureMap.set(id, { id } as unknown as Texture);
        }
        return textureMap.get(id)!;
      }),
    };

    const mapData: MapData = {
      id: 'mixed',
      width: 2,
      height: 2,
      layers: [[1, 2, 3, 1]],
      tilesets: [],
      collision: [0, 0, 0, 0],
      npcs: [],
      transitions: [],
    };

    const renderer = new TilemapRenderer(mapData, null, 16, mockPlaceholders as any);
    renderer.render();

    // Should have requested textures for tile IDs 1, 2, and 3
    expect(mockPlaceholders.getTileTexture).toHaveBeenCalledWith(1);
    expect(mockPlaceholders.getTileTexture).toHaveBeenCalledWith(2);
    expect(mockPlaceholders.getTileTexture).toHaveBeenCalledWith(3);
  });
});
