import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

/** M7-1 (docs/MODE7_PLAN.md 3.1, 9): the Mode 7 far atlas baked by assets-src/tools/mode7_atlas.py inside every
 *  world compile. Files only: no Python, no compile (the clean-diff and determinism checks are gate commands). */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = join(root, 'assets/maps/ai/overworld');
const WATER = 2;

interface AtlasMeta { version: number; cellPx: number; size: number; lowCellPx: number; lowSize: number; inputs: string }
interface WorldDoc { width: number; height: number; collision: number[]; art: { tile: number; below: string[] } }

const world = parse(readFileSync(join(root, 'assets/maps/ai/overworld.yaml'), 'utf-8')) as WorldDoc;
const meta = JSON.parse(readFileSync(join(dir, 'mode7.json'), 'utf-8')) as AtlasMeta;

/** Width, height, bit depth and colour type from a PNG's IHDR. */
function pngHeader(file: string): { width: number; height: number; depth: number; colour: number } {
  const b = readFileSync(join(dir, file));
  expect(b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
  expect(b.toString('latin1', 12, 16)).toBe('IHDR');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), depth: b[24], colour: b[25] };
}

describe('M7-1: the Mode 7 world atlas', () => {
  it('mode7.json inputs is the sha256 of the current chunk files, in art.below order (a stale atlas fails)', () => {
    expect(world.art.below.length).toBe((world.width / 16) * (world.height / 16));   // one per 16-cell chunk
    const h = createHash('sha256');
    for (const p of world.art.below) h.update(readFileSync(join(root, p)));
    expect(meta.inputs).toBe(h.digest('hex'));
  });

  it('mode7.json gives 12 px per cell on the 256-cell world and 8 px on the POT low atlas (NW-5; WR, WORLD_WRAP 7.1)', () => {
    expect(meta).toEqual({ version: 1, cellPx: 12, size: world.width * 12, lowCellPx: 8, lowSize: world.width * 8,
      inputs: meta.inputs });
    expect(meta.size).toBe(world.width * meta.cellPx);
    expect(meta.lowSize).toBe(world.width * meta.lowCellPx);
  });

  it('mode7.png is size x size and mode7_low.png lowSize x lowSize, 8-bit RGB, with no border (PNG headers)', () => {
    expect(pngHeader('mode7.png')).toEqual({ width: meta.size, height: meta.size, depth: 8, colour: 2 });
    expect(pngHeader('mode7_low.png')).toEqual({ width: meta.lowSize, height: meta.lowSize, depth: 8, colour: 2 });
  });

  it('every cell of the world\'s 4 edges is Water (the atlas clamps to sea off the map)', () => {
    const { width: w, height: h, collision: c } = world;
    expect(c.length).toBe(w * h);
    const bad: string[] = [];
    for (let x = 0; x < w; x++) {
      if (c[x] !== WATER) bad.push(`(${x}, 0)`);
      if (c[(h - 1) * w + x] !== WATER) bad.push(`(${x}, ${h - 1})`);
    }
    for (let y = 0; y < h; y++) {
      if (c[y * w] !== WATER) bad.push(`(0, ${y})`);
      if (c[y * w + w - 1] !== WATER) bad.push(`(${w - 1}, ${y})`);
    }
    expect(bad).toEqual([]);
  });
});
