/**
 * Pravoka's channel and range (docs/WORLD_PLAN.md 2.6 W_east, 4.1, R23; A1-O): on the world source
 * (assets-src/maps/overworld.yaml, written by layouts/world.py), Pravoka's range is an unbroken mountain wall on
 * every row y 76-141 within x 136-141 (since FX-D its crest is ragged, `a1/world_a1_ground.range_cells`), joined to
 * X_east by x 136-137, y 76-82, and between Pravoka's quay and the range there are at
 * least 6 Water cells on every row y 92-110: the brig's sea lane south out of the fjord.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const world = parse(readFileSync('assets-src/maps/overworld.yaml', 'utf-8')) as {
  ground: string; docks?: Array<{ id: string; x: number; y: number; basin: string }>;
  entrances: Record<string, [number, number]>;
};
const rows = world.ground.trimEnd().split('\n');
const at = (x: number, y: number) => rows[y][x];

describe("Pravoka's range and channel (WORLD_PLAN 4.1)", () => {
  // FX-D (G-1): the crest is ragged, no longer a ruler-straight x 138-141 strip; it stays an unbroken wall
  it('the range is an unbroken mountain wall on every row y 76-141 (x 136-141, 2+ thick), joined to X_east at x 136-137, y 76-82', () => {
    const bad: string[] = [];
    let prev: [number, number] | null = null;
    for (let y = 76; y <= 141; y++) {
      const xs = [136, 137, 138, 139, 140, 141].filter((x) => at(x, y) === 'm');
      const lo = Math.min(...xs), hi = Math.max(...xs);
      if (xs.length < 2) bad.push(`row ${y}: ${xs.length} rock cells`);
      else if (xs.length !== hi - lo + 1) bad.push(`row ${y}: a gap in x ${lo}-${hi}`);
      else if (prev && (hi < prev[0] || lo > prev[1])) bad.push(`row ${y}: not joined to row ${y - 1}`);
      if (xs.length) prev = [lo, hi];
    }
    for (let y = 76; y <= 82; y++) for (let x = 136; x <= 137; x++) if (at(x, y) !== 'm') bad.push(`(${x}, ${y})`);
    expect(bad).toEqual([]);
  });

  it('the crest is not ruler-straight: its west foot and its east face each take 2+ columns (G-1)', () => {
    const west = new Set<number>(), east = new Set<number>();
    for (let y = 83; y <= 141; y++) {
      const xs = [136, 137, 138, 139, 140, 141].filter((x) => at(x, y) === 'm');
      west.add(Math.min(...xs));
      east.add(Math.max(...xs));
    }
    expect(west.size).toBeGreaterThanOrEqual(3);
    expect(east.size).toBeGreaterThanOrEqual(2);
  });

  it('at least 6 Water cells between the quay and the range on every row y 92-110', () => {
    const short: string[] = [];
    for (let y = 92; y <= 110; y++) {
      let n = 0;
      for (let x = 137; x >= 0 && at(x, y) === 'o'; x--) n++;
      if (n < 6) short.push(`row ${y}: ${n}`);
    }
    expect(short).toEqual([]);
  });

  it('the quay dock a1_pravoka lies in the channel (x 129-135), beside the land gate, in the aldi basin', () => {
    const dock = (world.docks ?? []).find((d) => d.id === 'a1_pravoka');
    expect(dock).toBeDefined();
    expect(dock!.basin).toBe('aldi');
    expect(dock!.x).toBeGreaterThanOrEqual(129);
    expect(dock!.x).toBeLessThanOrEqual(135);
    expect(at(dock!.x, dock!.y)).toBe('o');
    const [gx, gy] = world.entrances.a1_pravoka;
    expect(Math.abs(gx - dock!.x) + Math.abs(gy - dock!.y)).toBeLessThanOrEqual(2);
  });

  it('RED: the count catches a coast pushed into the channel', () => {
    const row = rows[100].split('');
    row[132] = '.';
    let n = 0;
    for (let x = 137; x >= 0 && row[x] === 'o'; x--) n++;
    expect(n).toBeLessThan(6);
  });
});
