import { Assets, type Texture } from 'pixi.js';
import { TerrainType, type MapData } from '../types/index.js';

/** Maps with more chunks than this stream them (QUEST 4.3); a smaller map loads every chunk before its first frame. */
export const STREAM_MIN_CHUNKS = 64;
/** Resident chunk textures, both layers: a 6x5 chunk window (3x2 visible, a 1-chunk ring, 1 ahead per axis) x 2. */
export const STREAM_TEXTURE_CAP = 60;
/** A step into a view whose chunks are not loaded waits at most this many frames; then a placeholder shows. */
export const MISS_HOLD_FRAMES = 6;
/** Resident chunk textures while the Mode 7 view flies (docs/MODE7_PLAN.md 3.3): `full` and `low`. */
export const FLIGHT_TEXTURE_CAP = 36;
export const FLIGHT_TEXTURE_CAP_LOW = 16;

/** Where chunk textures come from; `unload` frees one for good (the default goes through `Assets.unload`). */
export interface ChunkSource {
  load(url: string): Promise<Texture>;
  unload(url: string): void;
}

/** Unloads still under way, so a reload of the same url waits for them (a map left and entered again). */
const unloading = new Map<string, Promise<void>>();

/** The game's chunk source: `Assets.load` with nearest scaling, `Assets.unload` to free a chunk. */
export const assetChunkSource: ChunkSource = {
  async load(url) {
    await unloading.get(url);
    const tex = await Assets.load<Texture>(url);
    tex.source.scaleMode = 'nearest';
    return tex;
  },
  unload(url) {
    const done = Assets.unload(url)
      .catch((err: unknown) => console.warn(`Map art: could not unload ${url}`, err))
      .finally(() => { if (unloading.get(url) === done) unloading.delete(url); });
    unloading.set(url, done);
  },
};

/** Whether a compiled map streams its chunks. */
export function streams(art: NonNullable<MapData['art']>): boolean {
  return art.below.length > STREAM_MIN_CHUNKS;
}

interface Resident {
  tex: Texture | null;   // null while loading
  used: number;          // the last frame it was wanted
}

/**
 * The resident chunk textures of one map: loads what is wanted (in priority order) while fewer than `cap` are
 * resident or loading, and frees the least recently wanted of the others when it needs room or a load is dropped.
 */
export class ChunkStreamer {
  private readonly resident = new Map<string, Resident>();
  private readonly failed = new Set<string>();
  private disposed = false;

  constructor(private readonly source: ChunkSource, private cap: number,
    private readonly onEvict: (url: string) => void, private readonly onLoad: (url: string) => void) {}

  /** Resident or loading textures. */
  get count(): number { return this.resident.size; }

  /** A new cap: evicts the least recently wanted textures until at most `n` are resident (3.3). */
  setCap(n: number): void {
    this.cap = n;
    const none = new Set<string>();
    while (this.resident.size > n) if (!this.evictOne(none)) break;   // each through onEvict and unload
  }

  texture(url: string): Texture | null { return this.resident.get(url)?.tex ?? null; }

  /** Load the wanted urls (highest priority first) as far as the cap allows; evict unwanted ones for room. */
  want(urls: readonly string[], frame: number): void {
    if (this.disposed) return;
    const wanted = new Set(urls);
    for (const url of urls) {
      if (this.failed.has(url)) continue;   // logged once; it stays a placeholder
      const r = this.resident.get(url);
      if (r) { r.used = frame; continue; }
      if (this.resident.size >= this.cap && !this.evictOne(wanted)) continue;
      this.resident.set(url, { tex: null, used: frame });
      this.source.load(url).then((tex) => this.loaded(url, tex),
        (err: unknown) => {
          console.error(`Map art: could not load ${url}`, err);
          this.failed.add(url);
          this.resident.delete(url);
        });
    }
  }

  /** Free every texture (the map was left). */
  dispose(): void {
    this.disposed = true;
    for (const [url, r] of [...this.resident]) {
      this.resident.delete(url);
      this.onEvict(url);
      if (r.tex) this.source.unload(url);   // a texture still loading is freed when it arrives
    }
  }

  private loaded(url: string, tex: Texture): void {
    const r = this.resident.get(url);
    if (!r || this.disposed) { this.source.unload(url); return; }   // evicted (or left) while it loaded
    r.tex = tex;
    this.onLoad(url);
  }

  /** Free the least recently wanted resident texture outside `keep`; false when there is none. */
  private evictOne(keep: ReadonlySet<string>): boolean {
    let oldest: string | null = null;
    let at = Infinity;
    for (const [url, r] of this.resident) if (!keep.has(url) && r.used < at) { oldest = url; at = r.used; }
    if (oldest === null) return false;
    const r = this.resident.get(oldest);
    this.resident.delete(oldest);
    this.onEvict(oldest);
    if (r?.tex) this.source.unload(oldest);
    return true;
  }
}

/** An inclusive chunk rectangle. */
export interface ChunkRect { c0: number; r0: number; c1: number; r1: number }

/** Chunks covering tiles [x0, x1) x [y0, y1), clipped to the map's `cols` x `rows` chunks. */
export function chunkRect(x0: number, y0: number, x1: number, y1: number, chunk: number, cols: number,
  rows: number): ChunkRect {
  return {
    c0: Math.max(0, Math.floor(x0 / chunk)), r0: Math.max(0, Math.floor(y0 / chunk)),
    c1: Math.min(cols - 1, Math.floor((x1 - 1) / chunk)), r1: Math.min(rows - 1, Math.floor((y1 - 1) / chunk)),
  };
}

/**
 * The Mode 7 near window (3.2): `n` x `n` chunks, moved in whole chunks so that cell (x, y) lies in its middle 16
 * cells (so at least `(n - 1) x chunk / 2` cells on each side: 24 for 4x4, 16 for 3x3), clamped to the map.
 */
export function flightWindow(x: number, y: number, n: number, chunk: number, cols: number, rows: number): ChunkRect {
  const margin = ((n - 1) * chunk) / 2;
  const at = (v: number, count: number): number =>
    Math.max(0, Math.min(Math.max(0, count - n), Math.floor((v - margin) / chunk)));
  const c0 = at(x, cols);
  const r0 = at(y, rows);
  return { c0, r0, c1: Math.min(cols - 1, c0 + n - 1), r1: Math.min(rows - 1, r0 + n - 1) };
}

/** The tiles a view of `view` tiles shows on an axis of `size` tiles when it centres on tile `at`, plus 1 tile. */
export function viewSpan(at: number, view: number, size: number): [number, number] {
  if (size <= view) return [0, size];
  const start = Math.max(0, Math.min(at + 0.5 - view / 2, size - view));
  return [Math.max(0, Math.floor(start) - 1), Math.min(size, Math.ceil(start + view) + 1)];
}

/** Placeholder colours by terrain (ocean blue for water). */
const TERRAIN_COLOURS: Record<number, number> = {
  [TerrainType.Grass]: 0x3f8f3a, [TerrainType.Wall]: 0x4a4a4a, [TerrainType.Water]: 0x1d4f9c,
  [TerrainType.Mountain]: 0x7a6447, [TerrainType.Forest]: 0x23602a, [TerrainType.Desert]: 0xcdb47c,
  [TerrainType.Swamp]: 0x4f5f33, [TerrainType.River]: 0x3a6fc4, [TerrainType.Road]: 0xb9a57a,
  [TerrainType.Bridge]: 0x86603a, [TerrainType.Lake]: 0x2a5fae,
};

/** The colour of a chunk's most common terrain (its flat placeholder). */
export function dominantColour(map: Pick<MapData, 'width' | 'height' | 'collision'>, col: number, row: number,
  chunk: number): number {
  const counts = new Map<number, number>();
  for (let y = row * chunk; y < Math.min(map.height, (row + 1) * chunk); y++) {
    for (let x = col * chunk; x < Math.min(map.width, (col + 1) * chunk); x++) {
      const t = map.collision[y * map.width + x] ?? TerrainType.Water;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  let best: number = TerrainType.Water;
  let n = -1;
  for (const [t, c] of counts) if (c > n) { best = t; n = c; }
  return TERRAIN_COLOURS[best] ?? TERRAIN_COLOURS[TerrainType.Water];
}
