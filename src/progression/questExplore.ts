/**
 * The curve model's per-cell rewards (docs/WORLD_PLAN.md 6.0 (d)), split from questCurve.ts (INT-W2c): a table's
 * expected xp and gold per fight, the table and rate in force on a cell, and one exploration of a map.
 */
import type { EncounterEntry, EncounterRate, FieldMode, MapData } from '../types/index.js';
import { baseTerrain, terrainAllows } from '../systems/fieldRules.js';
import type { LateData } from './questLateData.js';

const DEFAULT_RATE: EncounterRate = { min: 20, max: 30 };

/** Expected xp and gold of one fight from a table. */
export function tableRewards(data: LateData, table: readonly EncounterEntry[]): { xp: number; gold: number } {
  let w = 0;
  let xp = 0;
  let gold = 0;
  for (const e of table) {
    let ex = 0;
    let eg = 0;
    const add = (id: string, n: number): void => {
      const r = data.enemies.get(id);
      ex += n * (r?.xp ?? 0);
      eg += n * (r?.gold ?? 0);
    };
    if (e.groups) for (const g of e.groups) add(g.id, (g.min + (g.max ?? g.min)) / 2);
    else for (const id of e.enemies ?? []) add(id, 1);
    w += e.weight;
    xp += e.weight * ex;
    gold += e.weight * eg;
  }
  return w > 0 ? { xp: xp / w, gold: gold / w } : { xp: 0, gold: 0 };
}

/** The table and rate in force on a cell in a mode (the first zone whose rects hold it and whose modes allow it). */
export function encounterAt(map: MapData, x: number, y: number, mode: FieldMode):
  { table: readonly EncounterEntry[]; rate: EncounterRate } | null {
  for (const z of map.encounterZones ?? []) {
    if (!z.rects.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) continue;
    if (!(z.modes ?? ['walking', 'canoe']).includes(mode)) continue;
    return z.encounters.length ? { table: z.encounters, rate: z.encounterRate ?? map.encounterRate ?? DEFAULT_RATE } : null;
  }
  if (mode !== 'walking' && mode !== 'canoe') return null;
  return map.encounters?.length ? { table: map.encounters, rate: map.encounterRate ?? DEFAULT_RATE } : null;
}

/** One exploration of a map: a pass over every walkable cell with a walking encounter table (see the header). */
export function explorationRewards(data: LateData, map: MapData): { fights: number; xp: number; gold: number } {
  let fights = 0;
  let xp = 0;
  let gold = 0;
  for (const [table, n] of explorationTables(map)) {
    const r = tableRewards(data, table);
    fights += n;
    xp += n * r.xp;
    gold += n * r.gold;
  }
  return { fights, xp, gold };
}

/** The fights one exploration of a map expects, per encounter table (questCurve.test.ts rolls them). */
export function explorationTables(map: MapData): Map<readonly EncounterEntry[], number> {
  const out = new Map<readonly EncounterEntry[], number>();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (!terrainAllows('walking', baseTerrain(map, x, y))) continue;
      const enc = encounterAt(map, x, y, 'walking');
      if (enc) out.set(enc.table, (out.get(enc.table) ?? 0) + 1 / ((enc.rate.min + enc.rate.max) / 2));
    }
  }
  return out;
}
