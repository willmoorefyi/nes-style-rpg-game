/**
 * WR (docs/WORLD_WRAP_PLAN.md 6, 10): the compiled world map is a torus. It has `wrap: true`; every edge cell is
 * Water and no other terrain lies within SEAM_MARGIN of an edge (the seam is open ocean, D-WR-2); no NPC wanders
 * there (NpcWander knows no seam); the Mode 7 low atlas is the 2048² power of two; the four seam spots exist.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { validateMapData } from '../../src/core/schemaValidation.js';
import { SEAM_MARGIN } from '../../src/systems/worldWrap.js';
import { TerrainType } from '../../src/types/index.js';
import { spot } from '../helpers/worldSpots.js';

const world = validateMapData(parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')));
const meta = JSON.parse(readFileSync('assets/maps/ai/overworld/mode7.json', 'utf-8')) as Record<string, number>;

describe('WR: the wrapped world map', () => {
  it('has wrap: true, streamed whole chunks (the schema rule)', () => {
    expect(world.wrap).toBe(true);
    expect(world.width % (world.art?.chunk ?? 1)).toBe(0);
    expect(world.art!.below.length).toBeGreaterThan(64);
  });

  it(`every edge cell is Water and nothing but Water lies within SEAM_MARGIN ${SEAM_MARGIN} of an edge`, () => {
    const { width: w, height: h, collision } = world;
    const bad: string[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = Math.min(x, y, w - 1 - x, h - 1 - y);
        if (d < SEAM_MARGIN && collision[y * w + x] !== TerrainType.Water) bad.push(`${x},${y}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('has no wandering NPC (wanderers do not cross the seam)', () => {
    expect(world.npcs.filter((n) => n.wander).map((n) => n.id)).toEqual([]);
  });

  it('the Mode 7 low atlas is 2048² at 8 px per cell (a power of two: it repeats under WebGL1)', () => {
    expect([meta.lowCellPx, meta.lowSize, meta.cellPx, meta.size]).toEqual([8, 2048, 12, 3072]);
  });

  it('the four seam spots exist with their kinds', () => {
    const want: Record<string, string> = { fir_s_seam_e: 'dock', elf_s_seam_s: 'dock', wat_s_seam_nw: 'dock',
      wnd_s_seam_landing: 'landing' };
    for (const [name, kind] of Object.entries(want)) {
      expect(world.spots?.[name]?.kind, name).toBe(kind);
      const c = spot(world, name);
      const t = world.collision[c.y * world.width + c.x];
      expect(t, name).toBe(kind === 'dock' ? TerrainType.Water : TerrainType.Grass);
    }
  });
});

// WR F-WR (docs/WORLD_WRAP_PLAN.md 8.4): every seam pair's ship zones are of one class (early | early, late | late)
describe('WR F-WR: the seam zones', () => {
  const LATE = new Set(['ord_sea', 'wat_sea', 'wnd_sea']);
  const shipZone = (x: number, y: number): string | null => world.encounterZones?.find((z) => (z.modes ?? []).includes('ship')
    && z.rects.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1))?.id ?? null;

  it("every seam pair's zones are of one class", () => {
    const { width: w, height: h } = world;
    const bad: string[] = [];
    const pairs = [...Array(h).keys()].map((y) => [[0, y], [w - 1, y]]).concat([...Array(w).keys()].map((x) => [[x, 0], [x, h - 1]]));
    for (const [[ax, ay], [bx, by]] of pairs) {
      const a = shipZone(ax, ay);
      const b = shipZone(bx, by);
      if (a && b && LATE.has(a) !== LATE.has(b)) bad.push(`(${ax},${ay}) ${a} | (${bx},${by}) ${b}`);
    }
    expect(bad).toEqual([]);
  });
});
