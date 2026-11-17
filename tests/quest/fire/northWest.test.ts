/**
 * FIRE's north-west row budget (docs/WORLD_PLAN.md 4.4, R23; FIR-O): on the compiled world, rows 146-147 are
 * W_south's cliffs facing the Aldi, so for x 114-141 they hold no walkable, river, lake or water cell; both cavern
 * mouths open south (the door's arrival is the cell below it, at row 148 or lower), and R-volcano meets the volcano
 * from the east on rows 150 or below.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { TerrainType } from '../../../src/types/index.js';

interface Compiled {
  width: number;
  collision: number[];
  entrances: Record<string, [number, number]>;
  transitions: Array<{ x: number; y: number; targetMap: string }>;
}
const world = parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')) as Compiled;
const at = (x: number, y: number): number => world.collision[y * world.width + x];
const SOLID = new Set<number>([TerrainType.Wall, TerrainType.Mountain]);

describe('FIRE north-west (FIR-O)', () => {
  it('rows 146-147 for x 114-141 are solid rock: no walkable, river, lake or water cell', () => {
    const bad: string[] = [];
    for (const y of [146, 147]) for (let x = 114; x <= 141; x++) if (!SOLID.has(at(x, y))) bad.push(`(${x}, ${y}) ${at(x, y)}`);
    expect(bad).toEqual([]);
  });

  it.each([['fir_volcano', 'gurgu-b1'], ['fir_ice', 'ice-cavern-b1']])('%s opens south, below the cliff rows', (anchor, map) => {
    const [ex, ey] = world.entrances[anchor];
    const door = world.transitions.find((t) => t.targetMap === map)!;
    expect(door).toBeDefined();
    expect([door.x, door.y + 1]).toEqual([ex, ey]);
    expect(door.y).toBeGreaterThanOrEqual(148);
    expect(SOLID.has(at(door.x, door.y - 1))).toBe(true);
  });

  it('R-volcano reaches the volcano from the east on rows 150 or below', () => {
    const [vx, vy] = world.entrances.fir_volcano;
    const river: Array<[number, number]> = [];
    for (let y = 140; y < 170; y++) for (let x = vx; x < vx + 30; x++) if (at(x, y) === TerrainType.River) river.push([x, y]);
    const west = river.reduce((a, b) => (b[0] < a[0] ? b : a));
    expect(west[0]).toBeGreaterThan(vx);
    expect(west[1]).toBeGreaterThanOrEqual(150);
    expect(Math.abs(west[1] - vy)).toBeLessThanOrEqual(2);
  });
});
