import { describe, expect, it, vi } from 'vitest';
import { Texture, type Container, type Renderer, type Sprite } from 'pixi.js';
import { NearDetail, clipBox, nearTextureOptions, wrapBoxes } from '../../../src/scenes/exploration/mode7/NearDetail.js';
import { GroundStrips, SEAM_ROWS } from '../../../src/scenes/exploration/mode7/GroundStrips.js';
import { NEAR_FULL, NEAR_LOW, nearWindow, type ChunkHost } from '../../../src/scenes/exploration/mode7/FlightStream.js';
import { FOG_ALPHA, FOG_ROWS, fogTexels, rgb15, SKY_HAZE } from '../../../src/scenes/exploration/mode7/FlightSky.js';
import { D_SPLIT, D_SPLIT_LOW, SCREEN_H, nearSplit, rowFits, rowTable, splitRow } from '../../../src/scenes/exploration/mode7/mode7Math.js';
import { PILOT_PRESETS, presetView } from '../../../src/scenes/exploration/mode7/pilotPresets.js';
import type { WorldAtlas } from '../../../src/scenes/exploration/mode7/WorldAtlas.js';
import type { MapData } from '../../../src/types/index.js';

/** M7-3: the near detail (docs/MODE7_PLAN.md 3.2), its strips, seam and fog (2.5), over stub renderers: no GPU. */
function world(): MapData {
  return {
    id: 'overworld', width: 192, height: 192, layers: [], tilesets: [], collision: [], npcs: [], transitions: [],
    art: { tile: 48, chunk: 16, below: Array.from({ length: 144 }, (_, i) => `b${i}.png`), above: Array(144).fill(null),
      patches: { canal: 'patch_canal.png' } },
    // a 3x2-cell patch whose box straddles the chunk border x = 80
    patches: [{ id: 'canal', flag: 'CANAL_OPEN', cells: [[79, 100], [81, 101]], terrain: 2 }],
  };
}

interface Drawn { clear: boolean; sprites: { x: number; y: number; scale: number; w: number; h: number; fx: number }[] }

function rig(loaded: Set<number>) {
  const draws: Drawn[] = [];
  const renderer = {
    render: vi.fn(({ container, clear }: { container: Container; clear: boolean }) => {
      draws.push({ clear, sprites: (container.children as Sprite[]).map((s) => ({ x: s.x, y: s.y, scale: s.scale.x,
        w: s.texture.frame.width, h: s.texture.frame.height, fx: s.texture.frame.x })) });
    }),
  } as unknown as Renderer;
  const patch = new Texture({ source: Texture.WHITE.source });
  Object.defineProperty(patch, 'width', { value: 3 * 48 });
  Object.defineProperty(patch, 'height', { value: 2 * 48 });
  const atlas = { texture: Texture.WHITE, cellPx: 16, patchTexture: (id: string) => (id === 'canal' ? patch : null) };
  let listener: ((i: number) => void) | null = null;
  const host: ChunkHost = {
    setWindow: () => {}, residentTextures: 0,
    onChunkLoaded: (cb) => { listener = cb; return () => { listener = null; }; },
    textureOf: (i) => (loaded.has(i) ? [Texture.WHITE] : null),
  };
  const flags = new Set<string>();
  const near = new NearDetail({ renderer, map: world(), atlas: atlas as unknown as WorldAtlas, prof: NEAR_FULL,
    hasFlag: (f) => flags.has(f) });
  return { near, draws, host, flags, arrive: (i: number) => listener?.(i) };
}

describe('M7-3: NearDetail', () => {
  it('a 4x4 window at 48 px per cell is 3072 px (low: 3x3 at 32 px, 1536), nearest, without mips', () => {
    const { near } = rig(new Set());
    expect([near.size, near.cellPx]).toEqual([3072, 48]);
    expect(nearTextureOptions(1536)).toMatchObject({ width: 1536, scaleMode: 'nearest', autoGenerateMipmaps: false });
    expect(NEAR_LOW.n * 16 * NEAR_LOW.cellPx).toBe(1536);
  });

  it('a recentre draws the underlay, every loaded chunk and the set patches; nothing when nothing changed', () => {
    const win = nearWindow(world(), NEAR_FULL, 80.5, 100.5);   // chunks 3-6 x 4-7, origin (48, 64)
    const loaded = new Set([4 * 12 + 3, 5 * 12 + 4, 6 * 12 + 5]);
    const { near, draws, host, flags } = rig(loaded);
    flags.add('CANAL_OPEN');
    near.update(win, host);
    expect(near.heavy).toBe(true);
    expect(draws).toHaveLength(1);
    const [d] = draws;
    expect(d.clear).toBe(true);
    // the underlay: the atlas's 64x64-cell square at 16 px, scaled x3 to 48
    expect(d.sprites[0]).toMatchObject({ x: 0, y: 0, scale: 3, w: 64 * 16, h: 64 * 16, fx: 48 * 16 });
    // the 3 loaded chunks at their squares, scale 1 (48 px art at 48 px per cell)
    expect(d.sprites.slice(1, 4).map((s) => [s.x, s.y, s.scale])).toEqual([[0, 0, 1], [768, 768, 1], [1536, 1536, 1]]);
    // the patch, whole: its box (79, 100)-(82, 102) from the origin
    expect(d.sprites[4]).toMatchObject({ x: (79 - 48) * 48, y: (100 - 64) * 48, w: 144, h: 96 });
    near.update(win, host);
    expect(near.heavy).toBe(false);
    expect(draws).toHaveLength(1);
  });

  it('a late chunk of the window draws its square only, with the patch clipped to it; one outside is ignored', () => {
    const win = nearWindow(world(), NEAR_FULL, 80.5, 100.5);
    const loaded = new Set<number>();
    const { near, draws, host, flags, arrive } = rig(loaded);
    flags.add('CANAL_OPEN');
    near.update(win, host);
    const i = 6 * 12 + 5;   // chunk (col 5, row 6): cells 80-95 x 96-111, holds the patch's right 2 columns
    loaded.add(i);
    arrive(i);
    arrive(0);              // not in the window
    near.update(win, host);
    expect(draws).toHaveLength(2);
    expect(near.lateDraws).toBe(1);
    const d = draws[1];
    expect(d.clear).toBe(false);
    expect(d.sprites).toHaveLength(2);
    expect(d.sprites[0]).toMatchObject({ x: (80 - 48) * 48, y: (96 - 64) * 48 });
    expect(d.sprites[1]).toMatchObject({ x: (80 - 48) * 48, y: (100 - 64) * 48, w: 96, h: 96, fx: 48 });
  });

  it('a window move, a patch flag change and a new host each redraw the whole window', () => {
    const { near, draws, host, flags } = rig(new Set());
    near.update(nearWindow(world(), NEAR_FULL, 80.5, 100.5), host);
    near.update(nearWindow(world(), NEAR_FULL, 80.5, 80.5), host);   // north across the recentre line
    flags.add('CANAL_OPEN');
    near.update(nearWindow(world(), NEAR_FULL, 80.5, 80.5), host);
    near.update(nearWindow(world(), NEAR_FULL, 80.5, 80.5), { ...host });
    expect(draws.map((d) => d.clear)).toEqual([true, true, true, true]);
    expect(near.recentres).toBe(4);
  });

  it('clipBox', () => {
    expect(clipBox({ x0: 0, y0: 0, x1: 4, y1: 4 }, { x0: 2, y0: 3, x1: 9, y1: 9 })).toEqual({ x0: 2, y0: 3, x1: 4, y1: 4 });
    expect(clipBox({ x0: 0, y0: 0, x1: 2, y1: 2 }, { x0: 2, y0: 0, x1: 4, y1: 2 })).toBeNull();
  });
});

describe('M7-3: the near / far split and the seam (2.5)', () => {
  const view = presetView(PILOT_PRESETS[0], 100.5, 120.5);

  it('with the ship in its window, every near row fits it: the split stays at D_SPLIT (low: D_SPLIT_LOW)', () => {
    const table = rowTable(view);
    for (const prof of [NEAR_FULL, NEAR_LOW]) {
      const w = nearWindow(world(), prof, view.px, view.py);
      const split = nearSplit(view, table, prof.dSplit, w.x0, w.y0, w.cells);
      expect(split).toBe(splitRow(view, prof.dSplit));
      for (let r = split - SEAM_ROWS; r < SCREEN_H; r++) expect(rowFits(view, table, r, w.x0, w.y0, w.cells)).toBe(true);
    }
    expect(splitRow(view, D_SPLIT)).toBeLessThan(splitRow(view, D_SPLIT_LOW));
  });

  it('a window that does not reach a row moves the split below it', () => {
    const table = rowTable(view);
    const w = nearWindow(world(), NEAR_FULL, view.px, view.py);
    const split = nearSplit(view, table, D_SPLIT, w.x0 + 20, w.y0, w.cells);   // shifted 20 cells east
    expect(split).toBeGreaterThan(splitRow(view, D_SPLIT));
    expect(rowFits(view, table, split, w.x0 + 20, w.y0, w.cells)).toBe(true);
    expect(rowFits(view, table, split - 1, w.x0 + 20, w.y0, w.cells)).toBe(false);
  });

  it('GroundStrips: far rows from the split down and near rows above it draw nothing; 8 seam rows at alpha 1/9..8/9', () => {
    const strips = new GroundStrips(Texture.WHITE, 192, 192, Texture.WHITE);
    const w = nearWindow(world(), NEAR_FULL, view.px, view.py);
    strips.update(view, w);
    const split = splitRow(view, D_SPLIT);
    expect(strips.split).toBe(split);
    const [far, ...rest] = strips.view.children as unknown as { alpha: number; visible: boolean;
      geometry: { getBuffer(n: string): { data: Float32Array } } }[];
    const near = rest[rest.length - 1];
    const seams = rest.slice(0, -1);
    const pos = (m: typeof far): Float32Array => m.geometry.getBuffer('aPosition').data;
    const uv = (m: typeof far): Float32Array => m.geometry.getBuffer('aUV').data;
    const height = (p: Float32Array, r: number): number => p[r * 8 + 5] - p[r * 8 + 1];
    expect(height(pos(far), split - 1)).toBe(1);
    expect(height(pos(far), split)).toBe(0);
    expect(height(pos(near), split - 1)).toBe(0);
    expect(height(pos(near), split)).toBe(1);
    const nearUv = uv(near).slice(split * 8);
    expect(Math.min(...nearUv)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...nearUv)).toBeLessThanOrEqual(1);
    expect(seams.map((s) => s.alpha)).toEqual(Array.from({ length: SEAM_ROWS }, (_, k) => (k + 1) / (SEAM_ROWS + 1)));
    expect(seams.every((s) => s.visible)).toBe(true);
    expect(pos(seams[SEAM_ROWS - 1])[1]).toBe(split - 1);   // the most opaque row is next to the near mesh
    strips.update(view, null);                                 // no near window: the far mesh draws every row
    expect(strips.split).toBe(SCREEN_H);
    expect(height(pos(far), SCREEN_H - 1)).toBe(1);
    expect(seams.every((s) => !s.visible)).toBe(true);
    strips.destroy();
  });
});

describe('M7-3: the fog (2.5)', () => {
  it('is the haze at alpha 0.6 fading to 0 over 120 rows, premultiplied', () => {
    const t = fogTexels();
    const haze = rgb15(SKY_HAZE);
    expect(Array.from(t.slice(0, 4))).toEqual([Math.round(((haze >> 16) & 255) * FOG_ALPHA),
      Math.round(((haze >> 8) & 255) * FOG_ALPHA), Math.round((haze & 255) * FOG_ALPHA), Math.round(255 * FOG_ALPHA)]);
    expect(Array.from(t.slice(-4))).toEqual([0, 0, 0, 0]);
    for (let i = 1; i < 256; i++) expect(t[i * 4 + 3]).toBeLessThanOrEqual(t[(i - 1) * 4 + 3]);
    expect(FOG_ROWS).toBe(120);
  });
});

// WR (docs/WORLD_WRAP_PLAN.md 7.3): the near window across the seam
describe('WR: NearDetail on a wrapped world', () => {
  const torus = (): MapData => ({ ...world(), wrap: true, patches: [{ id: 'canal', flag: 'CANAL_OPEN',
    cells: [[1, 1], [2, 1]], terrain: 2 }] });

  it('wrapBoxes splits a box at the corner into 4 canonical pieces at their unwrapped places', () => {
    const parts = wrapBoxes({ x0: 176, y0: 176, x1: 240, y1: 240 }, 192, 192);
    expect(parts).toEqual([
      { src: { x0: 176, y0: 176, x1: 192, y1: 192 }, at: { x: 176, y: 176 } },
      { src: { x0: 0, y0: 176, x1: 48, y1: 192 }, at: { x: 192, y: 176 } },
      { src: { x0: 176, y0: 0, x1: 192, y1: 48 }, at: { x: 176, y: 192 } },
      { src: { x0: 0, y0: 0, x1: 48, y1: 48 }, at: { x: 192, y: 192 } },
    ]);
    expect(wrapBoxes({ x0: 16, y0: 32, x1: 80, y1: 96 }, 192, 192)).toEqual([
      { src: { x0: 16, y0: 32, x1: 80, y1: 96 }, at: { x: 16, y: 32 } }]);
  });

  it('a window at the corner draws 4 underlay pieces, the wrapped chunks and the patch at its image', () => {
    const map = torus();
    const win = nearWindow(map, NEAR_FULL, 0.5, 0.5);   // c0 = r0 = 10 (canonical), c1 = r1 = 13
    expect(win.rect).toEqual({ c0: 10, r0: 10, c1: 13, r1: 13 });
    expect([win.x0, win.ix0]).toEqual([160, -32]);
    const { draws, host, flags } = rig(new Set([0, 11 * 12 + 11]));
    const near = new NearDetail({ renderer: (rigRenderer(draws)), map, atlas: rigAtlas(), prof: NEAR_FULL,
      hasFlag: (f) => flags.has(f) });
    flags.add('CANAL_OPEN');
    near.update(win, host);
    const d = draws[draws.length - 1];
    // underlay pieces: [160, 192) x2 then [0, 32) x2, at the square's local px (cell - 160) x 48
    expect(d.sprites.slice(0, 4).map((s) => [s.x, s.y, s.w, s.h])).toEqual([
      [0, 0, 32 * 16, 32 * 16], [32 * 48, 0, 32 * 16, 32 * 16], [0, 32 * 48, 32 * 16, 32 * 16], [32 * 48, 32 * 48, 32 * 16, 32 * 16]]);
    // chunk (11, 11) at its own square; chunk 0 at unwrapped col 12, row 12 (past the seam)
    expect(d.sprites.slice(4, 6).map((s) => [s.x, s.y])).toEqual([[768, 768], [1536, 1536]]);
    // the patch at (1, 1) draws at its image (193, 193)
    expect(d.sprites[6]).toMatchObject({ x: (193 - 160) * 48, y: (193 - 160) * 48 });
  });

  it('a late chunk 11 draws into its square of a window at c0 11 that passes the seam', () => {
    const map = torus();
    const win = nearWindow(map, NEAR_FULL, 190.5, 100.5);   // cols 10..13: chunk cols 10, 11, 0, 1
    const loaded = new Set<number>();
    const { draws, host, arrive } = rig(loaded);
    const near = new NearDetail({ renderer: rigRenderer(draws), map, atlas: rigAtlas(), prof: NEAR_FULL, hasFlag: () => false });
    near.update(win, host);
    const before = draws.length;
    const late = win.rect.r0 * 12 + 0;   // chunk col 0 of the first window row: unwrapped col 12
    loaded.add(late);
    arrive(late);
    near.update(win, host);
    expect(draws.length).toBe(before + 1);
    expect(draws[draws.length - 1].sprites[0]).toMatchObject({ x: (12 * 16 - win.x0) * 48, y: 0 });
  });
});

function rigRenderer(draws: Drawn[]): Renderer {
  return {
    render: ({ container, clear }: { container: Container; clear: boolean }) => {
      draws.push({ clear, sprites: (container.children as Sprite[]).map((s) => ({ x: s.x, y: s.y, scale: s.scale.x,
        w: s.texture.frame.width, h: s.texture.frame.height, fx: s.texture.frame.x })) });
    },
  } as unknown as Renderer;
}

function rigAtlas(): WorldAtlas {
  const patch = new Texture({ source: Texture.WHITE.source });
  Object.defineProperty(patch, 'width', { value: 2 * 48 });
  Object.defineProperty(patch, 'height', { value: 48 });
  const far = new Texture({ source: Texture.WHITE.source });
  return { texture: far, cellPx: 16, patchTexture: (id: string) => (id === 'canal' ? patch : null) } as unknown as WorldAtlas;
}
