/**
 * The Marsh Cave's peat (docs/WORLD_PLAN.md 4.0.2, 4.2; ELF-D): every floor has peat pools (`hazards`, damage 1),
 * they cover exactly the floor's swamp cells, and from each arrival to every way on (the stairs and pit down, the
 * boss, the way back out) a peat-free path exists of at most 1.5x the shortest path. Paths are walked on the compiled
 * collision; NPC cells (chests, the bier) block.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { MapData } from '../../../src/types/index.js';
import { baseTerrain } from '../../../src/systems/fieldRules.js';
import { TerrainType } from '../../../src/types/index.js';
import { distances, key, peatCells } from './marshPaths.js';

const FLOORS = ['marsh-cave-b1', 'marsh-cave-b2', 'marsh-cave-b3'];
const load = (id: string): MapData => parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8')) as MapData;
/** The cells a floor leads on from: its transitions and its boss cell. */
const targets = (m: MapData): Array<[string, number, number]> => [
  ...m.transitions.map((t) => [`${t.targetMap}:${t.targetEntrance}`, t.x, t.y] as [string, number, number]),
  ...(m.scriptedEncounters ?? []).map((e) => ['boss', e.x, e.y] as [string, number, number])];

describe('ELF-D: the Marsh Cave peat', () => {
  for (const id of FLOORS) {
    const m = load(id);
    it(`${id}: peat pools are its hazards (damage 1), exactly its swamp cells`, () => {
      const peat = peatCells(m);
      expect(peat.size).toBeGreaterThan(0);
      expect((m.hazards ?? []).every((h) => h.damage === 1)).toBe(true);
      const swamp = new Set<string>();
      for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (baseTerrain(m, x, y) === TerrainType.Swamp) swamp.add(key(x, y));
      expect([...peat].sort()).toEqual([...swamp].sort());
    });

    it(`${id}: from each arrival a peat-free path to every way on is at most 1.5x the shortest`, () => {
      const peat = peatCells(m);
      const bad: string[] = [];
      for (const [name, at] of Object.entries(m.entrances ?? {})) {
        if (!['arrival', 'arrival_east', 'pit'].includes(name)) continue;
        const any = distances(m, at);
        const dry = distances(m, at, peat);
        for (const [to, x, y] of targets(m)) {
          const s = any.get(key(x, y));
          if (s === undefined) continue;                      // the other half of B2
          const d = dry.get(key(x, y));
          if (d === undefined || d > 1.5 * s) bad.push(`${name} -> ${to}: ${d ?? 'none'} > 1.5 x ${s}`);
        }
      }
      expect(bad).toEqual([]);
    });
  }

  it('RED: a floor whose only way on is through peat fails the rule', () => {
    const rows = ['WWWWW', 'W-w-W', 'WWWWW'];
    const m = { id: 't', width: 5, height: 3, layers: [], tilesets: [], transitions: [], npcs: [],
      collision: rows.flatMap((r) => [...r].map((c) => (c === 'W' ? 1 : c === 'w' ? 6 : 8))),
      hazards: [{ id: 'p', rects: [[2, 1, 2, 1]], damage: 1 }] } as unknown as MapData;
    expect(distances(m, [1, 1]).get('3,1')).toBe(2);
    expect(distances(m, [1, 1], peatCells(m)).get('3,1')).toBeUndefined();
  });
});
