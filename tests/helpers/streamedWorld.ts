/**
 * A streamed test world and its fake chunk loads (moved from mode7Parity.test.ts in WR; docs/WORLD_WRAP_PLAN.md 10).
 * `streamedWorld()` is a 192x192 grass `overworld` in 144 chunks of 16 (more than 64, so it streams). WR's options:
 * `wrap` makes it a torus, `water` makes cells Water (collision 2) so a ship can cross the seam, and `allRows` lets
 * `fakeChunks` load chunk rows 0-4 too (by default they never load: the parity route's start lies south of them).
 */
import { vi } from 'vitest';
import { Assets, Texture } from 'pixi.js';
import type { MapData } from '../../src/types/index.js';

export interface StreamedWorldOptions {
  wrap?: boolean;
  /** Cells that are Water (collision 2); the rest stay grass. */
  water?: (x: number, y: number) => boolean;
}

export const STREAMED_SIZE = 192;

export function streamedWorld(opts: StreamedWorldOptions = {}): MapData {
  const n = STREAMED_SIZE;
  const at = (i: number): string => `assets/maps/ai/overworld/below_${Math.floor(i / 12)}_${i % 12}.png`;
  const collision = new Array(n * n).fill(0);
  if (opts.water) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (opts.water(x, y)) collision[y * n + x] = 2;
  return {
    id: 'overworld', width: n, height: n, layers: [], tilesets: [], collision, npcs: [], transitions: [],
    art: { tile: 48, chunk: 16, below: Array.from({ length: 144 }, (_, i) => at(i)), above: Array(144).fill(null) },
    ...(opts.wrap ? { wrap: true } : {}),
  };
}

/** Chunk loads resolve on `tick()` after they start; without `allRows`, those of rows 0-4 never do. */
export function fakeChunks(opts: { allRows?: boolean } = {}) {
  const original = Assets.load.bind(Assets);
  const pending: Array<{ url: string; resolve: (t: Texture) => void }> = [];
  const loads: string[] = [];
  vi.spyOn(Assets, 'unload').mockResolvedValue(undefined);
  vi.spyOn(Assets, 'load').mockImplementation(((url: string) => {
    const m = /below_(\d+)_\d+\.png$/.exec(String(url));
    if (!m) return original(url);
    loads.push(String(url));
    return new Promise<Texture>((resolve) => { if (opts.allRows || Number(m[1]) > 4) pending.push({ url, resolve }); });
  }) as typeof Assets.load);
  return { loads, tick: () => { for (const p of pending.splice(0)) p.resolve(Texture.EMPTY); } };
}
