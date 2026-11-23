import { describe, it, expect, vi } from 'vitest';
import { Texture, TextureSource, type Renderer } from 'pixi.js';
import {
  WorldAtlas, atlasSize, atlasTextureOptions, atlasUrls, patchPlacements, patchSignature, type AtlasLoader, type AtlasMeta,
} from '../../../src/scenes/exploration/mode7/WorldAtlas.js';
import type { MapData } from '../../../src/types/index.js';

/** M7-1: the far atlas loader (docs/MODE7_PLAN.md 3.1), over a stub loader and renderer: no GPU. */
const META: AtlasMeta = { version: 1, cellPx: 16, size: 3072, lowCellPx: 8, lowSize: 1536, inputs: 'x' };

function world(): MapData {
  return {
    id: 'overworld', width: 192, height: 192, layers: [], tilesets: [],
    art: { tile: 48, chunk: 16, below: ['assets/maps/ai/overworld/below_0_0.png'], above: [null],
      patches: { canal: 'assets/maps/ai/overworld/patch_canal.png', bridge: 'assets/maps/ai/overworld/patch_bridge.png' } },
    patches: [
      { id: 'canal', flag: 'CANAL_OPEN', cells: [[61, 92], [60, 93], [61, 93]], terrain: 2 },
      { id: 'bridge', flag: 'BRIDGE', cells: [[93, 90]], terrain: 9 },
    ],
  } as unknown as MapData;
}

/** WR: the wrapped 256-cell world, its meta with the POT low atlas (2048, 8 px per cell). */
const META_256: AtlasMeta = { version: 1, cellPx: 12, size: 3072, lowCellPx: 8, lowSize: 2048, inputs: 'x' };
function torus(): MapData {
  return { ...world(), width: 256, height: 256, wrap: true };
}

function stubLoader(meta: AtlasMeta = META): AtlasLoader & { loaded: string[]; unloaded: string[] } {
  const loaded: string[] = [];
  const unloaded: string[] = [];
  return {
    loaded, unloaded,
    meta: async () => meta,
    texture: async (url) => { loaded.push(url); return Texture.EMPTY; },
    unload: async (url) => { unloaded.push(url); },
  };
}

describe('M7-1: WorldAtlas', () => {
  it('finds the atlas files beside the chunks', () => {
    expect(atlasUrls(world())).toEqual({ meta: 'assets/maps/ai/overworld/mode7.json',
      full: 'assets/maps/ai/overworld/mode7.png', low: 'assets/maps/ai/overworld/mode7_low.png' });
    expect(atlasUrls({ art: undefined })).toBeNull();
  });

  it('checks the meta against the map and the profile', () => {
    expect(atlasSize(META, world(), 'full')).toEqual({ size: 3072, cellPx: 16 });
    expect(atlasSize(META, world(), 'low')).toEqual({ size: 1536, cellPx: 8 });
    expect(() => atlasSize({ ...META, version: 2 }, world(), 'full')).toThrow(/version/);
    expect(() => atlasSize(META, { width: 100, height: 100 }, 'full')).toThrow(/does not fit/);
  });

  it('WebGL2: linear mips with anisotropy; WebGL1: linear, no mips; nearest up and clamped in both', () => {
    expect(atlasTextureOptions(3072, true)).toMatchObject({ width: 3072, height: 3072, autoGenerateMipmaps: true,
      mipmapFilter: 'linear', maxAnisotropy: 4, magFilter: 'nearest', minFilter: 'linear', addressMode: 'clamp-to-edge' });
    const gl1 = atlasTextureOptions(1536, false);
    expect(gl1).toMatchObject({ autoGenerateMipmaps: false, magFilter: 'nearest', minFilter: 'linear' });
    expect(gl1.mipmapFilter).toBeUndefined();
    expect(gl1.maxAnisotropy).toBeUndefined();
    // WR (7.1): a flat map clamps, a wrapped one repeats; a power of two mips under WebGL1 too
    for (const wrap of [false, true]) {
      expect(atlasTextureOptions(3072, true, wrap).addressMode).toBe(wrap ? 'repeat' : 'clamp-to-edge');
      expect(atlasTextureOptions(1536, false, wrap)).toMatchObject({ autoGenerateMipmaps: false,
        addressMode: wrap ? 'repeat' : 'clamp-to-edge' });
    }
    expect(atlasTextureOptions(2048, false, true)).toMatchObject({ autoGenerateMipmaps: true, mipmapFilter: 'linear',
      addressMode: 'repeat' });
  });

  it('places each patch at its top-left cell, scaled 16/48 (or 8/48 on the low atlas)', () => {
    expect(patchPlacements(world(), 16)).toEqual([
      { id: 'canal', flag: 'CANAL_OPEN', x: 60 * 16, y: 92 * 16, scale: 16 / 48 },
      { id: 'bridge', flag: 'BRIDGE', x: 93 * 16, y: 90 * 16, scale: 16 / 48 },
    ]);
    expect(patchPlacements(world(), 8)[0]).toMatchObject({ x: 480, y: 736, scale: 8 / 48 });
  });

  it('the signature lists the set patches', () => {
    const p = patchPlacements(world(), 16);
    expect(patchSignature(p, () => false)).toBe('');
    expect(patchSignature(p, (f) => f === 'BRIDGE')).toBe('bridge');
    expect(patchSignature(p, () => true)).toBe('canal,bridge');
  });

  it('composes once, frees the source image, and recomposes only when a patch flag changes', async () => {
    const flags = new Set<string>();
    const loader = stubLoader();
    const drawn: number[] = [];
    const render = vi.fn((o: { container: { children: unknown[] } }) => { drawn.push(o.container.children.length); });
    const atlas = new WorldAtlas({ map: world(), profile: 'full', webgl2: true, renderer: { render } as unknown as Renderer,
      hasFlag: (f) => flags.has(f), loader });
    await atlas.load();
    expect(atlas.texture?.width).toBe(3072);
    expect(atlas.texture?.source.autoGenerateMipmaps).toBe(true);
    expect(atlas.texture?.source.style.magFilter).toBe('nearest');
    expect(atlas.cellPx).toBe(16);
    expect(render).toHaveBeenCalledTimes(1);
    expect(loader.unloaded).toEqual(['assets/maps/ai/overworld/mode7.png']);
    atlas.update();
    expect(render).toHaveBeenCalledTimes(1);
    flags.add('CANAL_OPEN');
    atlas.update();
    await atlas.restore();   // joins the running recompose
    expect(render).toHaveBeenCalledTimes(2);
    expect(drawn).toEqual([1, 2]);   // the image; then the image and the canal
    expect(loader.unloaded).toEqual(['assets/maps/ai/overworld/mode7.png', 'assets/maps/ai/overworld/mode7.png']);
    atlas.destroy();
    expect(atlas.texture).toBeNull();
  });

  it('WR: the low profile without WebGL2 on the wrapped world (2048, a power of two) repeats and builds its mips', async () => {
    const loader = stubLoader(META_256);
    const mips = vi.spyOn(TextureSource.prototype, 'updateMipmaps');
    const atlas = new WorldAtlas({ map: torus(), profile: 'low', webgl2: false,
      renderer: { render: vi.fn() } as unknown as Renderer, hasFlag: () => false, loader });
    await atlas.load();
    expect(atlas.texture?.width).toBe(2048);
    expect(atlas.texture?.source.autoGenerateMipmaps).toBe(true);
    expect(atlas.texture?.source.style.addressMode).toBe('repeat');
    expect(mips).toHaveBeenCalled();
    mips.mockRestore();
    atlas.destroy();
  });

  it('WR: a wrapped world whose low atlas is NPOT rejects under WebGL1 (the view then flies top-down)', async () => {
    const atlas = new WorldAtlas({ map: torus(), profile: 'low', webgl2: false,
      renderer: { render: vi.fn() } as unknown as Renderer, hasFlag: () => false,
      loader: stubLoader({ ...META_256, lowCellPx: 6, lowSize: 1536 }) });
    await expect(atlas.load()).rejects.toThrow('mode7.json: a wrapped map needs a power-of-two atlas under WebGL1 (1536)');
    expect(atlasSize({ ...META_256, lowCellPx: 6, lowSize: 1536 }, torus(), 'low', true)).toEqual({ size: 1536, cellPx: 6 });
  });

  it('the low profile without WebGL2 on a flat world (1536) loads mode7_low.png and builds no mips', async () => {
    const loader = stubLoader();
    const atlas = new WorldAtlas({ map: world(), profile: 'low', webgl2: false,
      renderer: { render: vi.fn() } as unknown as Renderer, hasFlag: () => false, loader });
    await atlas.load();
    expect(atlas.texture?.width).toBe(1536);
    expect(atlas.texture?.source.autoGenerateMipmaps).toBe(false);
    expect(loader.unloaded).toEqual(['assets/maps/ai/overworld/mode7_low.png']);
    atlas.destroy();
  });
});
