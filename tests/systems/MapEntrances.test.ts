import { describe, it, expect, vi } from 'vitest';
import { arrivalFor, entrancePosition, safeSpawn } from '../../src/systems/MapTransition.js';
import { MapLoader } from '../../src/systems/MapLoader.js';
import { BakedMapRenderer } from '../../src/rendering/BakedMapRenderer.js';
import { TilemapRenderer } from '../../src/rendering/TilemapRenderer.js';
import type { DataLoader } from '../../src/core/DataLoader.js';
import type { PlaceholderTextures } from '../../src/rendering/PlaceholderTextures.js';
import { Texture } from 'pixi.js';
import type { MapData } from '../../src/types/index.js';

function map(extra: Partial<MapData> = {}): MapData {
  // 3x2: top row walls, bottom row grass
  return { id: 'm', width: 3, height: 2, layers: [], tilesets: [], collision: [1, 1, 1, 0, 0, 0], npcs: [], transitions: [],
    entrances: { gate: [2, 1], door: [0, 1] }, ...extra };
}

describe('entrances', () => {
  it('resolves a named entrance and fixed coordinates', () => {
    expect(arrivalFor({ x: 0, y: 0, targetMap: 'm', targetEntrance: 'door' }, map())).toEqual({ x: 0, y: 1 });
    expect(arrivalFor({ x: 0, y: 0, targetMap: 'm', targetX: 1, targetY: 1 }, map())).toEqual({ x: 1, y: 1 });
  });

  it('throws on an unknown entrance', () => {
    expect(() => entrancePosition(map(), 'nope')).toThrow(/no entrance 'nope'/);
  });

  it('moves a blocked restore position to the first entrance, keeps a walkable one', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(safeSpawn(map(), { x: 1, y: 0 })).toEqual({ x: 2, y: 1 });
    expect(safeSpawn(map(), { x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
    expect(safeSpawn(map({ entrances: undefined }), { x: 1, y: 0 })).toEqual({ x: 1, y: 0 });
    warn.mockRestore();
  });

  it('moves a walkable restore position that no entrance can reach (an old save on a redrawn map)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 7x1: grass, grass, wall, grass, wall, grass, grass; entrances at both ends, a sealed cell in the middle
    const split = map({ width: 7, height: 1, collision: [0, 0, 1, 0, 1, 0, 0], entrances: { west: [0, 0], east: [6, 0] } });
    expect(safeSpawn(split, { x: 1, y: 0 })).toEqual({ x: 1, y: 0 });
    expect(safeSpawn(split, { x: 3, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cut off from every entrance'));
    warn.mockRestore();
  });

  it('keeps a position reachable from any entrance, not only the first (the overworld north shore)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 5x1: grass, grass, wall, grass, grass; the first entrance is on the west side, the second on the east
    const split = map({ width: 5, height: 1, collision: [0, 0, 1, 0, 0], entrances: { west: [0, 0], east: [4, 0] } });
    expect(safeSpawn(split, { x: 3, y: 0 })).toEqual({ x: 3, y: 0 });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('moves a spawn off a warp onto the doorway in front of it, so loading never fires the transition', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 3x3: a door (warp) in the middle of a wall row, grass below
    const door = map({
      width: 3, height: 3, collision: [1, 1, 1, 1, 0, 1, 0, 0, 0], entrances: { south: [0, 2] },
      transitions: [{ x: 1, y: 1, targetMap: 'inside', targetEntrance: 'door' }],
    });
    expect(safeSpawn(door, { x: 1, y: 1 })).toEqual({ x: 1, y: 2 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('on a warp'));
    // a warp with no good neighbour falls back to the first entrance
    const sealed = map({
      width: 3, height: 2, collision: [0, 1, 0, 0, 1, 0], entrances: { a: [0, 0] },
      transitions: [{ x: 2, y: 0, targetMap: 'x', targetX: 0, targetY: 0 }, { x: 2, y: 1, targetMap: 'x', targetX: 0, targetY: 0 }],
    });
    expect(safeSpawn(sealed, { x: 2, y: 0 })).toEqual({ x: 0, y: 0 });
    warn.mockRestore();
  });
});

describe('MapLoader compiled maps', () => {
  const placeholders = {
    getNPCTexture: vi.fn().mockReturnValue(Texture.WHITE),
    getNPCFrames: vi.fn().mockReturnValue(null),
  } as unknown as PlaceholderTextures;

  function loaderWith(preferCompiled: boolean) {
    const baked: MapData = { ...map(), id: 'cornelia', art: { tile: 48, chunk: 16, below: ['b.png'], above: [null] } };
    const dl = {
      loadMapManifest: vi.fn().mockResolvedValue(['cornelia']),
      loadMap: vi.fn().mockImplementation(async (path: string) => (path.includes('/ai/') ? baked : map({ id: 'legacy' }))),
    };
    const loadTextures = vi.fn().mockResolvedValue({ below: [Texture.WHITE], above: [null] });
    const ml = new MapLoader(dl as unknown as DataLoader, placeholders, { preferCompiled, loadTextures });
    return { ml, dl, loadTextures };
  }

  it('prefers the compiled map for a listed id under preview and awaits its chunks', async () => {
    const { ml, dl, loadTextures } = loaderWith(true);
    const r = await ml.loadMap('cornelia');
    expect(dl.loadMap).toHaveBeenCalledWith('assets/maps/ai/cornelia.yaml');
    expect(loadTextures).toHaveBeenCalledTimes(1);
    expect(r.tilemap).toBeInstanceOf(BakedMapRenderer);
    expect(r.tilemap.aboveContainer).toBeDefined();
  });

  it('uses the legacy map for unlisted ids and outside preview', async () => {
    const a = loaderWith(true);
    expect((await a.ml.loadMap('overworld')).tilemap).toBeInstanceOf(TilemapRenderer);
    expect(a.dl.loadMap).toHaveBeenCalledWith('assets/maps/overworld.yaml');
    const b = loaderWith(false);
    await b.ml.loadMap('cornelia');
    expect(b.dl.loadMap).toHaveBeenCalledWith('assets/maps/cornelia.yaml');
    expect(b.dl.loadMapManifest).not.toHaveBeenCalled();
  });

  it('fails loudly when a listed compiled map is broken', async () => {
    const { ml, dl } = loaderWith(true);
    dl.loadMap.mockRejectedValueOnce(new Error('MapData.art.below: expected 1 chunks, got 0'));
    await expect(ml.loadMap('cornelia')).rejects.toThrow(/expected 1 chunks/);
  });
});
