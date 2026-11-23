import { afterEach, describe, expect, it, vi } from 'vitest';
import { Container, Texture } from 'pixi.js';

// the field as the game plays it: 96 px tiles, a 20x11-tile view
vi.mock('../../src/core/LayoutConstants.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/core/LayoutConstants.js')>()), TILE_SIZE: 96,
}));

import { BakedMapRenderer } from '../../src/rendering/BakedMapRenderer.js';
import { Camera } from '../../src/rendering/Camera.js';
import { ChunkStreamer, FLIGHT_TEXTURE_CAP, FLIGHT_TEXTURE_CAP_LOW, MISS_HOLD_FRAMES, STREAM_TEXTURE_CAP, chunkRect,
  flightWindow, rectChunks, viewSpan, type ChunkSource } from '../../src/rendering/chunkStreaming.js';
import { FlightStream, NEAR_FULL, NEAR_LOW, chunkHost, nearWindow, type NearProfile } from '../../src/scenes/exploration/mode7/FlightStream.js';
import { TerrainType, type MapData } from '../../src/types/index.js';

/**
 * M7-3: the flight's stream window (docs/MODE7_PLAN.md 3.2, 3.3, D-M11): `flightWindow`, `setWindow` (the window plus
 * 1 chunk ahead, under the flight cap), `ChunkStreamer.setCap` with its trim, `onChunkLoaded`, and the flight
 * `stepHeld`, which reads the window recentring would choose for the target cell.
 */
const TILE = 96;

function world(above = false): MapData {
  const at = (i: number): string => `assets/maps/ai/overworld/${Math.floor(i / 12)}_${i % 12}`;
  return {
    id: 'overworld', width: 192, height: 192, layers: [], tilesets: [],
    collision: new Array(192 * 192).fill(TerrainType.Grass), npcs: [], transitions: [],
    art: { tile: 48, chunk: 16, below: Array.from({ length: 144 }, (_, i) => `${at(i)}_below.png`),
      above: Array.from({ length: 144 }, (_, i) => (above ? `${at(i)}_above.png` : null)) },
  };
}

/** Loads finish `latency(url)` frames after they start (`Infinity`: never). */
class FakeSource implements ChunkSource {
  frame = 0;
  resident = new Set<string>();
  maxResident = 0;
  unloaded: string[] = [];
  private pending: { url: string; due: number; resolve: (t: Texture) => void }[] = [];
  constructor(private readonly latency: (url: string) => number = () => 1) {}

  load(url: string): Promise<Texture> {
    this.resident.add(url);
    this.maxResident = Math.max(this.maxResident, this.resident.size);
    return new Promise((resolve) => this.pending.push({ url, due: this.frame + this.latency(url), resolve }));
  }

  unload(url: string): void {
    this.unloaded.push(url);
    this.resident.delete(url);
  }

  async tick(): Promise<void> {
    this.frame++;
    const due = this.pending.filter((p) => p.due <= this.frame);
    this.pending = this.pending.filter((p) => p.due > this.frame);
    for (const p of due) p.resolve(Texture.WHITE);
    if (due.length) await new Promise((r) => setTimeout(r, 0));
  }
}

/** A flight over the world: the renderer, the camera on the ship, and a frame that follows the window first. */
function flight(source: ChunkSource, prof: NearProfile, map = world()) {
  const r = new BakedMapRenderer(map, { below: [], above: [] }, { source });
  const cam = new Camera(new Container());
  cam.setMapBounds(map.width, map.height);
  const ship = { x: 100.5 * TILE, y: 120.5 * TILE };
  cam.follow(ship);
  r.setCamera(cam);
  const stream = new FlightStream();
  const host = chunkHost(r);
  const frame = (): void => {
    stream.follow(host, map, prof, ship.x / TILE, ship.y / TILE);
    cam.update();
    r.render();
  };
  return { r, ship, frame, stream, host };
}

const original = ChunkStreamer.prototype.want;

afterEach(() => { vi.restoreAllMocks(); });

describe('M7-3: flightWindow', () => {
  it('keeps the ship in the middle 16 cells, 24 or more from the edges (16 for 3x3), clamped to the map', () => {
    for (const [n, margin] of [[4, 24], [3, 16]] as const) {
      for (let x = 0; x < 192; x++) {
        const w = flightWindow(x, 100, n, 16, 12, 12);
        expect(w.c1 - w.c0 + 1).toBe(n);
        const left = x - w.c0 * 16;
        const right = (w.c1 + 1) * 16 - 1 - x;
        if (x >= margin && x < 192 - margin) {
          expect(left).toBeGreaterThanOrEqual(margin);
          expect(right).toBeGreaterThanOrEqual(margin - 1);
          expect(left).toBeLessThan(margin + 16);
        }
        expect(w.c0).toBeGreaterThanOrEqual(0);
        expect(w.c1).toBeLessThanOrEqual(11);
      }
    }
  });

  it('moves in whole chunks, once per 16 cells', () => {
    const starts = new Set<number>();
    for (let x = 40; x < 152; x++) starts.add(flightWindow(x, 100, 4, 16, 12, 12).c0);
    expect(starts.size).toBe(Math.ceil(112 / 16));
    expect(nearWindow(world(), NEAR_FULL, 100.5, 120.5)).toEqual({
      rect: { c0: 4, r0: 6, c1: 7, r1: 9 }, x0: 64, y0: 96, ix0: 64, iy0: 96, cells: 64, dSplit: 25 });
    expect(nearWindow(world(), NEAR_LOW, 100.5, 120.5).cells).toBe(48);
  });
});

describe('M7-3: ChunkStreamer.setCap', () => {
  it('trims to the new cap, least recently wanted first, through onEvict and unload; a larger cap evicts nothing', async () => {
    const src = new FakeSource(() => 0);
    const evicted: string[] = [];
    const s = new ChunkStreamer(src, STREAM_TEXTURE_CAP, (u) => evicted.push(u), () => {});
    for (let f = 0; f < 60; f++) s.want([`c${f}`], f);   // c0 is the least recently wanted
    await src.tick();
    expect(s.count).toBe(60);
    s.setCap(FLIGHT_TEXTURE_CAP);
    expect(s.count).toBe(36);
    expect(evicted).toEqual(Array.from({ length: 24 }, (_, i) => `c${i}`));
    expect(src.unloaded).toEqual(evicted);
    s.setCap(FLIGHT_TEXTURE_CAP_LOW);
    expect(s.count).toBe(16);
    expect(evicted.slice(24)).toEqual(Array.from({ length: 20 }, (_, i) => `c${24 + i}`));
    s.setCap(STREAM_TEXTURE_CAP);
    expect(s.count).toBe(16);
    expect(evicted).toHaveLength(44);
  });
});

describe('M7-3: StreamedChunks.setWindow', () => {
  for (const [name, prof, wantMax, cap] of [['full', NEAR_FULL, 25, 36], ['low', NEAR_LOW, 16, 16]] as const) {
    it(`${name}: a flight north then east wants at most ${wantMax} chunks per frame and keeps <= ${cap} resident`, async () => {
      const wants: number[] = [];
      vi.spyOn(ChunkStreamer.prototype, 'want').mockImplementation(function (this: ChunkStreamer, urls, frame) {
        wants.push(urls.length);
        original.call(this, urls, frame);
      });
      const src = new FakeSource(() => 3);
      const { r, ship, frame } = flight(src, prof);
      for (let i = 0; i < 60 * TILE / 16; i++) {   // 60 cells north, then 60 east, 1/6 cell per frame
        if (i < 30 * TILE / 16) ship.y -= 16; else ship.x += 16;
        frame();
        await src.tick();
        expect(r.residentTextures).toBeLessThanOrEqual(cap);
      }
      expect(Math.max(...wants)).toBeLessThanOrEqual(wantMax);
      expect(Math.max(...wants)).toBeGreaterThan(prof.n * prof.n);   // the 1 chunk ahead is wanted too
      expect(src.maxResident).toBeLessThanOrEqual(cap);
    });
  }

  it('setWindow(null, 60) gives the top-down view and its cap back', async () => {
    const src = new FakeSource(() => 0);
    const { r, frame } = flight(src, NEAR_FULL);
    frame();
    await src.tick();
    expect(r.residentTextures).toBe(16);   // the 4x4 window (no motion yet: nothing ahead)
    r.setWindow(null, STREAM_TEXTURE_CAP);
    const wants: number[] = [];
    vi.spyOn(ChunkStreamer.prototype, 'want').mockImplementation(function (this: ChunkStreamer, urls, f) {
      wants.push(urls.length);
      original.call(this, urls, f);
    });
    r.render();
    expect(wants).toEqual([3 * 4]);   // the top-down view's chunks (2 x 2 at (100, 120)) and their 1-chunk ring
    expect(src.unloaded).toEqual([]);
  });

  it('tells the host only when the window, the host or the cap changes', () => {
    const calls: unknown[] = [];
    const host = { setWindow: (rect: unknown, cap: number) => calls.push([rect, cap]), onChunkLoaded: () => () => {},
      textureOf: () => null, residentTextures: 0 };
    const s = new FlightStream();
    for (let y = 120.5; y > 100; y -= 0.25) s.follow(host, world(), NEAR_FULL, 100.5, y);
    expect(calls.map((c) => (c as [{ r0: number }, number])[0].r0)).toEqual([6, 5, 4]);   // one per 16 cells
    s.follow(host, world(), NEAR_LOW, 100.5, 100);
    expect(calls).toHaveLength(4);
    expect(calls[3]).toEqual([{ c0: 5, r0: 5, c1: 7, r1: 7 }, FLIGHT_TEXTURE_CAP_LOW]);
    s.release();
    expect(calls[4]).toEqual([null, STREAM_TEXTURE_CAP]);
    s.release();
    expect(calls).toHaveLength(5);
  });
});

describe('M7-3: onChunkLoaded and the flight stepHeld', () => {
  it('fires once per chunk, after all its layers', async () => {
    const src = new FakeSource((u) => (u.endsWith('_above.png') ? 2 : 1));
    const { r, frame } = flight(src, NEAR_FULL, world(true));
    const seen: number[] = [];
    r.onChunkLoaded((i) => seen.push(i));
    for (let f = 0; f < 4; f++) { frame(); await src.tick(); }
    expect(seen).toHaveLength(16);
    expect(new Set(seen).size).toBe(16);
    expect(r.textureOf(seen[0])).toHaveLength(2);
    expect(r.textureOf(0)).toBeNull();   // outside the window: never loaded
  });

  it('holds a step while a chunk of the target cell\'s window is missing, for at most MISS_HOLD_FRAMES', async () => {
    const late = (u: string): number => (u.includes('/5_') ? Infinity : 0);   // chunk row 5 never arrives
    const src = new FakeSource(late);
    const { r, ship, frame } = flight(src, NEAR_FULL);
    ship.y = 128.5 * TILE;   // window rows 6-9 (all loaded); the target (100, 127) wants rows 6-9 too
    for (let f = 0; f < 3; f++) { frame(); await src.tick(); }
    expect(r.stepHeld(100, 127)).toBe(false);
    ship.y = 127.5 * TILE;   // moving north: row 5 is the chunk ahead, wanted but missing
    frame();
    await src.tick();
    // the window for (100, 119) is rows 5-8: row 5 missing holds the step, then lets it go
    const holds: boolean[] = [];
    for (let f = 0; f < 10; f++) { holds.push(r.stepHeld(100, 119)); frame(); await src.tick(); }
    expect(holds.filter(Boolean)).toHaveLength(MISS_HOLD_FRAMES);
    expect(holds.slice(0, MISS_HOLD_FRAMES).every(Boolean)).toBe(true);
  });
});

// WR (docs/WORLD_WRAP_PLAN.md 5, 10): the chunk rects of a wrapped 256x256 world (16x16 chunks)
describe('WR: wrapped chunk rects and streaming', () => {
  function torus(): MapData {
    const at = (i: number): string => `assets/maps/ai/overworld/${Math.floor(i / 16)}_${i % 16}_below.png`;
    return { id: 'overworld', width: 256, height: 256, layers: [], tilesets: [], wrap: true,
      collision: new Array(256 * 256).fill(TerrainType.Water), npcs: [], transitions: [],
      art: { tile: 48, chunk: 16, below: Array.from({ length: 256 }, (_, i) => at(i)), above: Array(256).fill(null) } };
  }

  it('chunkRect, viewSpan and flightWindow are not clipped with wrap; flat ones are', () => {
    expect(chunkRect(-20, 0, 10, 16, 16, 16, 16, true)).toEqual({ c0: -2, r0: 0, c1: 0, r1: 0 });
    expect(chunkRect(-20, 0, 10, 16, 16, 16, 16)).toEqual({ c0: 0, r0: 0, c1: 0, r1: 0 });
    expect(viewSpan(0, 20, 256, true)).toEqual([-11, 12]);
    expect(viewSpan(0, 20, 256)).toEqual([0, 21]);
    expect(flightWindow(2, 100, 3, 16, 16, 16, true).c0).toBe(15);   // the low window: 16 cells of margin
    expect(flightWindow(2, 100, 4, 16, 16, 16, true).c0).toBe(14);   // the full one: 24
    const w = flightWindow(250, 100, 4, 16, 16, 16, true);
    expect([w.c0, w.c1]).toEqual([14, 17]);
    expect(rectChunks({ ...w, r0: 0, r1: 0 }, 16, 16).map((c) => c.i)).toEqual([14, 15, 0, 1]);
    expect(flightWindow(250, 100, 4, 16, 16, 16).c1).toBe(15);
  });

  it('rectChunks gives each canonical chunk once, at its first image', () => {
    const all = rectChunks({ c0: -1, r0: -1, c1: 16, r1: 1 }, 16, 16);
    expect(new Set(all.map((c) => c.i)).size).toBe(all.length);
    expect(all[0]).toEqual({ i: 15 * 16 + 15, col: -1, row: -1 });
    expect(all.find((c) => c.i === 0)).toEqual({ i: 0, col: 0, row: 0 });
  });

  it('with the camera at x 0 chunk 15 draws at -1 chunk; the period jump keeps the look-ahead', async () => {
    const src = new FakeSource(() => 0);
    const map = torus();
    const r = new BakedMapRenderer(map, { below: [], above: [] }, { source: src });
    const host = new Container();
    host.addChild(r.container);
    const cam = new Camera(new Container());
    cam.setMapBounds(256, 256, true);
    const hero = { x: 0.5 * TILE, y: 100.5 * TILE };
    cam.follow(hero);
    r.setCamera(cam);
    const frame = async (): Promise<void> => { cam.update(); r.render(); await src.tick(); r.render(); };
    await frame();
    const px = 16 * TILE;
    const at = (i: number): number[] => r.container.children.filter((c) => c.visible
      && c.y === Math.floor(i / 16) * px).map((c) => c.x).sort((a, b) => a - b);
    expect(at(6 * 16 + 15)).toContain(-px);
    expect(at(6 * 16)).toContain(0);
    // moving west across the seam: the hero's step-end jump moves the camera by a period, the look-ahead stays west
    const wants: string[][] = [];
    vi.spyOn(ChunkStreamer.prototype, 'want').mockImplementation(function (this: ChunkStreamer, urls, f) {
      wants.push([...urls]);
      original.call(this, urls, f);
    });
    hero.x -= TILE;           // the drawn step to x -1
    await frame();
    hero.x += 256 * TILE;     // normalised to x 255
    await frame();
    const last = wants[wants.length - 1];
    // west of the view (cols 13, 14 for the view at x 255 with the ring and 1 ahead) are wanted
    expect(last.some((u) => u.endsWith('/6_13_below.png'))).toBe(true);
    expect(r.stepHeld(254, 100)).toBe(false);
  });
});
