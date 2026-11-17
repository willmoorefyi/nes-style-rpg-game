/**
 * ELF-O's world region (docs/WORLD_PLAN.md 2.2, 2.6, 4.0.3, 4.2, 6.1): Elfland on the compiled 192x192 overworld.
 * The anchors sit within 2 cells of their targets; Elfheim's harbour dock lies in the Aldi beside land; every walkable
 * cell of ELF's box is in a walking zone of the region and every Water cell in exactly one of its ship zones; the arm
 * walks from the keep north to the dwarves' grass seam; the walking hops Elfheim-keep and Elfheim-marsh stay under
 * 2.5x their straight-line distance (6.1 item 6); and the Aldi side never touches the western strait (W_arm).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { MapData } from '../../../src/types/index.js';
import { TerrainType } from '../../../src/types/index.js';
import { baseTerrain, terrainAllows } from '../../../src/systems/fieldRules.js';

const world = parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')) as MapData;
const anchors = (parse(readFileSync('assets/data/world-anchors.yaml', 'utf-8')) as {
  anchors: Array<{ entrance: string; region: string; target: [number, number] }>;
}).anchors;
const ELF_RECTS: Array<[number, number, number, number]> = [[48, 112, 63, 143], [0, 144, 111, 191]];
const SEAM_N: [number, number, number, number] = [48, 110, 61, 113];
const inElf = (x: number, y: number): boolean => ELF_RECTS.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d);
const terr = (x: number, y: number): number => baseTerrain(world, x, y);
const npcCells = new Set((world.npcs ?? []).map((n) => `${n.x},${n.y}`));
const walk = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < world.width && y < world.height
  && terrainAllows('walking', terr(x, y)) && !npcCells.has(`${x},${y}`);
const ent = (k: string): [number, number] => world.entrances![k] as [number, number];

function bfs(from: [number, number]): Map<string, number> {
  const dist = new Map<string, number>([[`${from[0]},${from[1]}`, 0]]);
  const q: Array<[number, number]> = [from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`;
      if (dist.has(k) || !walk(x + dx, y + dy)) continue;
      dist.set(k, dist.get(`${x},${y}`)! + 1);
      q.push([x + dx, y + dy]);
    }
  }
  return dist;
}

describe('ELF-O: Elfland on the world map', () => {
  it('the three ELF anchors are entrances within 2 cells of their targets', () => {
    const elf = anchors.filter((a) => a.region === 'elf');
    expect(elf.map((a) => a.entrance).sort()).toEqual(['elf_elfheim', 'elf_keep', 'elf_marsh']);
    for (const a of elf) {
      const [x, y] = ent(a.entrance);
      expect(Math.max(Math.abs(x - a.target[0]), Math.abs(y - a.target[1])), a.entrance).toBeLessThanOrEqual(2);
    }
  });

  it('the elf_port dock is an aldi Water cell with land beside it, and the sites lead to their maps', () => {
    const dock = (world.docks ?? []).find((d) => d.id === 'elf_port')!;
    expect(dock.basin).toBe('aldi');
    expect(terr(dock.x, dock.y)).toBe(TerrainType.Water);
    expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => walk(dock.x + dx, dock.y + dy))).toBe(true);
    const targets = world.transitions.filter((t) => inElf(t.x, t.y)).map((t) => `${t.targetMap}:${t.targetEntrance}`).sort();
    expect(targets).toEqual(['elfheim:gate', 'marsh-cave-b1:arrival', 'western-keep-1f:arrival']);
  });

  it('every walkable ELF cell is in an elf walking zone; every ELF Water cell is in exactly one elf ship zone', () => {
    const zones = (world.encounterZones ?? []).filter((z) => z.id.startsWith('elf_'));
    const holds = (z: (typeof zones)[number], x: number, y: number): boolean =>
      z.rects.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d);
    const lostWalk: string[] = [];
    const badWater: string[] = [];
    for (let y = 112; y < 192; y++) for (let x = 0; x < 112; x++) {
      if (!inElf(x, y)) continue;
      const afoot = zones.filter((z) => !z.modes || z.modes.includes('walking'));
      if (terrainAllows('walking', terr(x, y)) && !afoot.some((z) => holds(z, x, y))) lostWalk.push(`${x},${y}`);
      if (terr(x, y) === TerrainType.Water) {
        const ships = zones.filter((z) => z.modes?.includes('ship') && holds(z, x, y));
        if (ships.length !== 1) badWater.push(`${x},${y}:${ships.length}`);
      }
    }
    expect(lostWalk).toEqual([]);
    expect(badWater).toEqual([]);
    expect(zones.map((z) => z.id)).toEqual(['elf_keep_moor', 'elf_fen', 'elf_fields', 'elf_aldi', 'elf_sea']);
  });

  it('the arm walks from the keep to the dwarves\' grass seam (seam_n)', () => {
    const d = bfs(ent('elf_keep'));
    const [x0, y0, x1] = SEAM_N;
    expect([...Array(x1 - x0 + 1).keys()].some((i) => d.has(`${x0 + i},${y0 + 3}`))).toBe(true);
  });

  it('Elfheim-keep and Elfheim-marsh walk at most 2.5x their straight line', () => {
    const d = bfs(ent('elf_elfheim'));
    for (const k of ['elf_keep', 'elf_marsh']) {
      const [x, y] = ent(k);
      const [ex, ey] = ent('elf_elfheim');
      const path = d.get(`${x},${y}`);
      expect(path, k).toBeDefined();
      expect(path!, k).toBeLessThanOrEqual(2.5 * Math.hypot(x - ex, y - ey));
    }
  });

  it('W_arm: no Water path joins the arm\'s Aldi side (63, 130) to the western strait (47, 130)', () => {
    const seen = new Set(['63,130']);
    const q: Array<[number, number]> = [[63, 130]];
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const [nx, ny] = [x + dx, y + dy];
        const k = `${nx},${ny}`;
        if (seen.has(k) || !inElf(nx, ny) && !(nx >= 46 && nx <= 65 && ny >= 110 && ny <= 145)) continue;
        if (terr(nx, ny) !== TerrainType.Water) continue;
        seen.add(k);
        q.push([nx, ny]);
      }
    }
    expect(seen.has('47,130') || seen.has('48,130')).toBe(false);
  });
});
