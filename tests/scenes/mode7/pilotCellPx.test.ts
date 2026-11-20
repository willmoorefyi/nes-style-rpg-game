import { describe, it, expect, vi } from 'vitest';
import { ATLAS_CELL_PX, atlasCellPx } from '../../../src/scenes/exploration/mode7/pilotGl.js';
import type { AtlasMeta } from '../../../src/scenes/exploration/mode7/WorldAtlas.js';

/** NW-5 (docs/NATURAL_WORLD_PLAN.md 6.1): the dev pilot reads its cell size from `mode7.json`, 12 px on the 256 world. */
describe('pilotGl.atlasCellPx', () => {
  const art = { below: ['assets/maps/ai/overworld/below_0_0.png'] } as never;
  const meta = (cellPx: number): AtlasMeta => ({ version: 1, cellPx, size: 256 * cellPx, lowCellPx: cellPx / 2,
    lowSize: 128 * cellPx, inputs: '' });

  it("reads mode7.json's cellPx next to the chunks", async () => {
    const load = vi.fn(async () => meta(12));
    expect(await atlasCellPx({ art }, load)).toBe(12);
    expect(load).toHaveBeenCalledWith('assets/maps/ai/overworld/mode7.json');
  });

  it('falls back to 16 px without baked art, and logs when the meta is unreadable', async () => {
    expect(await atlasCellPx({ art: undefined })).toBe(ATLAS_CELL_PX);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await atlasCellPx({ art }, async () => { throw new Error('404'); })).toBe(16);
    expect(err).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });
});
