import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { FieldMode, MapData } from '../../src/types/index.js';
import { terrainAllows } from '../../src/systems/fieldRules.js';
import { zoneAppliesTo } from '../../src/systems/EncounterSystem.js';

/**
 * FX-C (P2-01): outside the act-1 block no cell a party can stand on, on foot or by canoe, may fall through to the map's
 * own table (the act-1 goblin / wolf roster, 8-HP goblins at level 21-24). The canoe's Lake cells of the Water and Wind
 * regions had no canoe zone.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const map = parse(readFileSync(join(root, 'assets/maps/ai/overworld.yaml'), 'utf-8')) as MapData;
const [OX, OY] = map.world?.frames?.a1?.origin ?? [64, 64];
const [SW, SH] = map.world?.frames?.a1?.size ?? [72, 72];
const inAct1 = (x: number, y: number) => x >= OX && y >= OY && x < OX + SW && y < OY + SH;

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

  it('the cited canoe lake cells have a canoe zone', () => {
    for (const [x, y] of [[29, 4], [33, 5], [31, 6], [155, 10], [157, 10], [20, 20], [22, 21]]) {
      expect(zoneAt(x, y, 'canoe'), `(${x},${y})`).not.toBeNull();
    }
  });

  it('the river cells near (131,150) and (150,148) use a canoe zone, not the act-1 table', () => {
    for (const [x, y] of [[131, 150], [150, 148]]) {
      if (terrains(x, y).some((t) => terrainAllows('canoe', t))) expect(zoneAt(x, y, 'canoe'), `(${x},${y})`).not.toBeNull();
    }
  });
});
