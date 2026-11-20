import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { FieldMode, MapData } from '../../src/types/index.js';
import { terrainAllows } from '../../src/systems/fieldRules.js';
import { zoneAppliesTo } from '../../src/systems/EncounterSystem.js';

/**
 * FX-C (P2-01): outside act 1 no cell a party can stand on, on foot or by canoe, may fall through to the map's own
 * table (the act-1 goblin / wolf roster, 8-HP goblins at level 21-24). Pass NW (docs/NATURAL_WORLD_PLAN.md 3.3, 3.6.4,
 * NW-5): there is no act-1 frame; act 1's fields are the map default by design (the peninsula and the A1 cells no zone
 * reaches), so the only cells allowed to fall through are act 1's: its raster (`regions.a1.raster`, its owner-grid
 * chunks), less the land another region claims (`regions.<r>.land`). The composer's `coverage` check proves the same
 * cell by cell on the owner grid.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const map = parse(readFileSync(join(root, 'assets/maps/ai/overworld.yaml'), 'utf-8')) as MapData;
const src = parse(readFileSync(join(root, 'assets-src/maps/overworld.yaml'), 'utf-8')) as
  { regions: Record<string, { raster: Array<[number, number, number, number]>; land?: Array<[number, number, number, number]> }> };
const otherLand = Object.entries(src.regions).filter(([r]) => r !== 'a1').flatMap(([, v]) => v.land ?? []);
/** Act 1's chunks (its owner-grid raster, `regions.a1.raster`), less the land another region claims. */
const inAct1 = (x: number, y: number) => src.regions.a1.raster.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d)
  && !otherLand.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d);

function zoneAt(x: number, y: number, mode: FieldMode): string | null {
  const z = (map.encounterZones ?? []).find((zone) => zoneAppliesTo(zone, mode)
    && zone.rects.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1));
  return z?.id ?? null;
}

/** The terrains a cell can have: its own and each patch's (bridge, canal), every flag set. */
function terrains(x: number, y: number): number[] {
  const out = new Set<number>([map.collision[y * map.width + x]]);
  for (const p of map.patches ?? []) if (p.cells.some(([cx, cy]) => cx === x && cy === y)) out.add(p.terrain);
  return [...out];
}

describe('overworld encounter zone coverage (FX-C, P2-01)', () => {
  for (const mode of ['walking', 'canoe'] as const) {
    it(`every ${mode} cell outside act 1 is in a ${mode} zone (none falls through to the act-1 table)`, () => {
      const holes: string[] = [];
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          if (inAct1(x, y)) continue;
          if (terrains(x, y).some((t) => terrainAllows(mode, t)) && zoneAt(x, y, mode) === null) holes.push(`(${x},${y})`);
        }
      }
      expect(holes.slice(0, 10), `${holes.length} cells`).toEqual([]);
    });
  }

  it('every Lake cell of the north outside act 1 (the Water and Wind tarns, ORDEAL\'s) has a canoe zone', () => {
    const LAKE = 11;
    const missing: string[] = [];
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < map.width; x++) {
        if (!inAct1(x, y) && map.collision[y * map.width + x] === LAKE && zoneAt(x, y, 'canoe') === null) missing.push(`(${x},${y})`);
      }
    }
    expect(missing).toEqual([]);
    for (const id of ['wat_streams', 'wnd_tarns']) {
      const z = (map.encounterZones ?? []).find((zone) => zone.id === id)!;
      expect(z && zoneAppliesTo(z, 'canoe'), id).toBe(true);
    }
  });
});
