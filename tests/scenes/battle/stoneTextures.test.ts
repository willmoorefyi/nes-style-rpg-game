/** Pass F item 5b: stone's fixed 5-bit grey mapping (no filters) and its per-texture cache. */
import { describe, it, expect } from 'vitest';
import { Texture } from 'pixi.js';
import { STONE_GREYS, StoneTextures, greyPixels, stoneGrey } from '../../../src/scenes/battle/fx/stoneTextures.js';

describe('stone grey mapping', () => {
  it('the 8 greys are the 5-bit levels 3, 7, ..., 31 expanded as snes_palette.c15', () => {
    expect(STONE_GREYS).toEqual([24, 57, 90, 123, 156, 189, 222, 255]);
  });

  it('a synthetic texture maps to exactly the recorded grey of its luma band; transparency is kept', () => {
    // one pixel per band edge (grey inputs: luma = the value), plus colours and a transparent pixel
    const inputs: [number, number, number, number][] = [];
    for (let band = 0; band < 8; band++) inputs.push([band * 32, band * 32, band * 32, 255], [band * 32 + 31, band * 32 + 31, band * 32 + 31, 255]);
    inputs.push([255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [200, 100, 50, 0]);
    const data = new Uint8ClampedArray(inputs.flat());
    greyPixels(data);
    for (let band = 0; band < 8; band++) {
      for (const k of [band * 2, band * 2 + 1]) expect([...data.slice(k * 4, k * 4 + 4)]).toEqual([STONE_GREYS[band], STONE_GREYS[band], STONE_GREYS[band], 255]);
    }
    const at = (k: number) => [...data.slice(k * 4, k * 4 + 4)];
    expect(at(16)).toEqual([90, 90, 90, 255]);     // red: luma 76.2
    expect(at(17)).toEqual([156, 156, 156, 255]);  // green: luma 149.7
    expect(at(18)).toEqual([24, 24, 24, 255]);     // blue: luma 29.1 (the darkest band, an outline stays dark)
    expect(at(19)).toEqual([200, 100, 50, 0]);     // transparent: untouched
    for (let k = 0; k < 19; k++) expect(STONE_GREYS).toContain(data[k * 4]);
    expect(stoneGrey(0, 0, 0)).toBe(24);
  });

  it('the cache returns the same grey texture on a second call and maps it back to the coloured one', () => {
    const built: Texture[] = [];
    const cache = new StoneTextures(() => { const t = new Texture(); built.push(t); return t; });
    const tex = new Texture();
    const g = cache.of(tex);
    expect(g).not.toBe(tex);
    expect(cache.of(tex)).toBe(g);
    expect(cache.of(g)).toBe(g);
    expect(built).toHaveLength(1);
    expect(cache.coloured(g)).toBe(tex);
    expect(cache.coloured(tex)).toBe(tex);
    expect(cache.isGrey(g)).toBe(true);
  });

  it('outside a browser (no canvas) the coloured texture is used as is', () => {
    const cache = new StoneTextures();
    const tex = new Texture();
    expect(cache.of(tex)).toBe(tex);
  });
});
