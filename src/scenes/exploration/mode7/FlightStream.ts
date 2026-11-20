/**
 * The flight's chunk window (docs/MODE7_PLAN.md 3.2, 3.3): pure, no PixiJS. While the Mode 7 view shows, the near
 * detail's n x n chunk window follows the ship in whole-chunk steps (`flightWindow`), and the map's streamer is told
 * to want that window (plus 1 chunk ahead) under the flight cap instead of the top-down view's chunks. When the view
 * hides, the streamer gets today's window and cap back.
 */
import type { Texture } from 'pixi.js';
import type { MapData } from '../../../types/index.js';
import type { MapRenderer } from '../../../rendering/MapRenderer.js';
import { FLIGHT_TEXTURE_CAP, FLIGHT_TEXTURE_CAP_LOW, STREAM_TEXTURE_CAP, flightWindow,
  type ChunkRect } from '../../../rendering/chunkStreaming.js';
import { D_SPLIT, D_SPLIT_LOW } from './mode7Math.js';

/** What the flight needs from the map renderer (`BakedMapRenderer`'s pass-throughs to `StreamedChunks`). */
export interface ChunkHost {
  setWindow(rect: ChunkRect | null, cap: number): void;
  onChunkLoaded(cb: (i: number) => void): () => void;
  textureOf(i: number): Texture[] | null;
  readonly residentTextures: number;
}

/** The map renderer as a chunk host, or null (a legacy tile map, a test's map without art). */
export function chunkHost(r: MapRenderer | null): ChunkHost | null {
  if (!r) return null;
  const h = r as Partial<ChunkHost>;
  return typeof h.setWindow === 'function' && typeof h.onChunkLoaded === 'function' && typeof h.textureOf === 'function'
    ? (r as unknown as ChunkHost) : null;
}

/** A profile's near detail (3.2): the window in chunks, its px per cell, the split distance and the streamer's cap. */
export interface NearProfile { n: number; cellPx: number; dSplit: number; cap: number }

export const NEAR_FULL: NearProfile = { n: 4, cellPx: 48, dSplit: D_SPLIT, cap: FLIGHT_TEXTURE_CAP };
export const NEAR_LOW: NearProfile = { n: 3, cellPx: 32, dSplit: D_SPLIT_LOW, cap: FLIGHT_TEXTURE_CAP_LOW };

export function nearProfile(profile: 'full' | 'low'): NearProfile {
  return profile === 'low' ? NEAR_LOW : NEAR_FULL;
}

/** The near window of one frame: its chunk rect and its cell square (origin and side, in cells). */
export interface NearWindow {
  rect: ChunkRect;
  x0: number;
  y0: number;
  cells: number;
  dSplit: number;
}

/** The window for the ship at cell point (px, py) on `map`. */
export function nearWindow(map: Pick<MapData, 'width' | 'height' | 'art'>, prof: NearProfile, px: number,
  py: number): NearWindow {
  const chunk = map.art?.chunk ?? 16;
  const rect = flightWindow(Math.floor(px), Math.floor(py), prof.n, chunk, Math.ceil(map.width / chunk),
    Math.ceil(map.height / chunk));
  return { rect, x0: rect.c0 * chunk, y0: rect.r0 * chunk, cells: prof.n * chunk, dSplit: prof.dSplit };
}

function same(a: ChunkRect | null, b: ChunkRect | null): boolean {
  return a === b || (!!a && !!b && a.c0 === b.c0 && a.r0 === b.r0 && a.c1 === b.c1 && a.r1 === b.r1);
}

/** Tells the host the flight window when it changes, and gives the host its own window back on `release`. */
export class FlightStream {
  private host: ChunkHost | null = null;
  private rect: ChunkRect | null = null;
  private cap = 0;

  /** The window for this frame; the host hears of it only on a change (or a new host or cap). */
  follow(host: ChunkHost | null, map: MapData, prof: NearProfile, px: number, py: number): NearWindow {
    const win = nearWindow(map, prof, px, py);
    if (host !== this.host) this.release();
    if (host && (host !== this.host || !same(win.rect, this.rect) || prof.cap !== this.cap)) {
      host.setWindow(win.rect, prof.cap);
      this.host = host;
      this.rect = win.rect;
      this.cap = prof.cap;
    }
    return win;
  }

  /** The view hid: the streamer wants the top-down view again, under today's cap. */
  release(): void {
    this.host?.setWindow(null, STREAM_TEXTURE_CAP);
    this.host = null;
    this.rect = null;
    this.cap = 0;
  }
}
