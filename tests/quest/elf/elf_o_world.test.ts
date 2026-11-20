/**
 * NW-R ELF (docs/NATURAL_WORLD_PLAN.md 3.3, 3.8, 4.3, 7): Elfland on the NW world source, the rewrite of
 * `tests/quest/elf/elf_o_world.test.ts` against the owner grid. Committed sources only (as every NW world test, moved from `tests/nw/` at NW-5):
 * `assets-src/maps/overworld.yaml`, whose `regions.elf.land` row rects are ELF's land on the owner grid (3.4), and
 * `assets/data/world-anchors.yaml`.
 * - The three ELF anchors are entrances within 2 cells of their targets; their doors lead to their maps; the
 *   `elf_port` dock is an Aldi Water cell beside land.
 * - Every walkable or canoe cell of ELF is in an ELF walking zone, and no ELF zone holds another region's cell; every
 *   ELF Water cell (inside ELF's raster, not land) is in at most one ELF ship zone, which hold Water only.
 * - The icons stand on their doors (walk cells), each door has one way out; the waystone stands by the king's road.
 * - Elfheim-keep and Elfheim-marsh walk at most 2.5x their straight line (6.1); the keep's arm walks to the dwarves.
 * - `--worst-canoe` row T2 (4.3; NW-4's finding): from the Aldi docks on foot and by canoe (River and Lake
 *   passable), no FIRE entrance and not the shore of the `fir_crescent` dock is reached.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

type XY = [number, number];
type Rect = [number, number, number, number];
interface Zone { id: string; modes?: string[]; rects: Rect[] }
interface Obj { type: string; name?: string; x: number; y: number; parts?: (string | null)[][]; walk_cells?: XY[] }
interface Src {
  ground: string;
  entrances: Record<string, XY>;
  transitions: { x: number; y: number; targetMap: string; targetEntrance?: string }[];
  objects: Obj[];
  inspect: { x: number; y: number; text: unknown }[];
  docks: { id: string; x: number; y: number; basin: string }[];
  patches: { id: string; cells: XY[] }[];
  encounterZones: Zone[];
  regions: Record<string, { raster: Rect[]; land?: Rect[] }>;
}

const src = parse(readFileSync('assets-src/maps/overworld.yaml', 'utf-8')) as Src;
const anchors = (parse(readFileSync('assets/data/world-anchors.yaml', 'utf-8')) as {
  anchors: { entrance: string; region: string; target: XY }[];
}).anchors;
const g = src.ground.replace(/\n$/, '').split('\n').map((r) => [...r]);
const N = g.length;
const inRects = (rects: Rect[], x: number, y: number): boolean =>
  rects.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d);
const land = src.regions.elf.land ?? [];
const elfZones = src.encounterZones.filter((z) => z.id.startsWith('elf_'));
const afoot = elfZones.filter((z) => !z.modes || z.modes.includes('walking'));
const ships = elfZones.filter((z) => z.modes?.includes('ship'));
/** the cells objects block (every named part but the walk cells) */
const blocked = new Set<string>();
for (const o of src.objects) {
  (o.parts ?? []).forEach((row, j) => row.forEach((p, i) => {
    if (p && !(o.walk_cells ?? []).some(([a, b]) => a === i && b === j)) blocked.add(`${o.x + i},${o.y + j}`);
  }));
}
const FOOT_BLOCK = new Set(['o', 'm', 'r', '≈']);
const walk = (x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < N && y < N && !FOOT_BLOCK.has(g[y][x]) && !blocked.has(`${x},${y}`);
const E = src.entrances;
const DIRS: XY[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function bfs(from: XY[], pass: (x: number, y: number) => boolean): Map<string, number> {
  const dist = new Map<string, number>(from.map((c) => [`${c[0]},${c[1]}`, 0]));
  const q: XY[] = [...from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of DIRS) {
      const k = `${x + dx},${y + dy}`;
      if (dist.has(k) || !pass(x + dx, y + dy)) continue;
      dist.set(k, dist.get(`${x},${y}`)! + 1);
      q.push([x + dx, y + dy]);
    }
  }
  return dist;
}

describe('NW-R ELF: Elfland on the NW world source', () => {
  it('the three ELF anchors are entrances within 2 cells of their targets, and their doors lead to their maps', () => {
    const elf = anchors.filter((a) => a.region === 'elf');
    expect(elf.map((a) => a.entrance).sort()).toEqual(['elf_elfheim', 'elf_keep', 'elf_marsh']);
    for (const a of elf) {
      const [x, y] = E[a.entrance];
      expect(Math.max(Math.abs(x - a.target[0]), Math.abs(y - a.target[1])), a.entrance).toBeLessThanOrEqual(2);
      expect(inRects(land, x, y), a.entrance).toBe(true);
    }
    const near = (e: string): string[] => src.transitions
      .filter((t) => Math.abs(t.x - E[e][0]) + Math.abs(t.y - E[e][1]) === 1).map((t) => `${t.targetMap}:${t.targetEntrance}`);
    expect(near('elf_elfheim')).toEqual(['elfheim:gate']);
    expect(near('elf_keep')).toEqual(['western-keep-1f:arrival']);
    expect(near('elf_marsh')).toEqual(['marsh-cave-b1:arrival']);
  });

  it('the elf_port dock is an Aldi Water cell beside land', () => {
    const dock = src.docks.find((d) => d.id === 'elf_port')!;
    expect(dock.basin).toBe('aldi');
    expect(g[dock.y][dock.x]).toBe('o');
    expect(DIRS.some(([dx, dy]) => walk(dock.x + dx, dock.y + dy))).toBe(true);
  });

  it('every walkable or canoe ELF cell is in an elf walking zone, and the elf zones hold only ELF cells', () => {
    expect(land.length).toBeGreaterThan(100);
    expect(elfZones.map((z) => z.id)).toEqual(['elf_keep_moor', 'elf_fen', 'elf_fields', 'elf_aldi', 'elf_sea']);
    const lost: string[] = [];
    let cells = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!inRects(land, x, y) || g[y][x] === 'o' || g[y][x] === 'm') continue;
      cells++;
      if (!afoot.some((z) => inRects(z.rects, x, y))) lost.push(`${x},${y}`);
    }
    expect(cells).toBeGreaterThan(2500);
    expect(lost).toEqual([]);
    for (const z of afoot) for (const [a, b, c, d] of z.rects) for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) {
      expect(inRects(land, x, y), `${z.id} ${x},${y}`).toBe(true);
    }
  });

  it('the elf ship zones hold Water only, each cell in one of them, and the Aldi one lies in the aldi basin', () => {
    const seen = new Map<string, number>();
    for (const z of ships) for (const [a, b, c, d] of z.rects) for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) {
      expect(g[y][x], `${z.id} ${x},${y}`).toBe('o');
      seen.set(`${x},${y}`, (seen.get(`${x},${y}`) ?? 0) + 1);
    }
    expect([...seen.values()].every((n) => n === 1)).toBe(true);
    expect(seen.size).toBeGreaterThan(1000);
    const dock = src.docks.find((d) => d.id === 'elf_port')!;
    expect(inRects(ships.find((z) => z.id === 'elf_aldi')!.rects, dock.x, dock.y)).toBe(true);
  });

  it('the icons stand on their doors and every ELF door has exactly one way out', () => {
    const icon = (name: string): Obj => src.objects.find((o) => o.name === name)!;
    for (const [name, e] of [['elfheim', 'elf_elfheim'], ['western_keep', 'elf_keep'], ['marsh_cave', 'elf_marsh']]) {
      const o = icon(name);
      const door = src.transitions.find((t) => Math.abs(t.x - E[e][0]) + Math.abs(t.y - E[e][1]) === 1)!;
      expect(o.walk_cells!.map(([i, j]) => `${o.x + i},${o.y + j}`), name).toEqual([`${door.x},${door.y}`]);
      const out = DIRS.filter(([dx, dy]) => walk(door.x + dx, door.y + dy));
      expect(out, name).toHaveLength(1);
    }
  });

  it('the waystone stands beside the king\'s road; its inspect cell is its foot', () => {
    const insp = src.inspect.find((i) => String((i.text as string[])[0]).includes('A waystone'))!;
    const w = src.objects.find((o) => o.x === insp.x && o.y === insp.y - 1)!;
    expect(w.parts).toEqual([['tpillar_broken_top'], ['tpillar_broken_bottom']]);
    expect(inRects(land, w.x, w.y)).toBe(true);
    expect([[w.x, w.y], [w.x, w.y + 1]].some(([x, y]) => DIRS.some(([dx, dy]) => g[y + dy][x + dx] === ','))).toBe(true);
  });

  it('Elfheim-keep and Elfheim-marsh walk at most 2.5x their straight line; the arm walks to the dwarves', () => {
    const d = bfs([E.elf_elfheim], walk);
    for (const k of ['elf_keep', 'elf_marsh']) {
      const [x, y] = E[k];
      const path = d.get(`${x},${y}`);
      expect(path, k).toBeDefined();
      expect(path!, k).toBeLessThanOrEqual(2.5 * Math.hypot(x - E.elf_elfheim[0], y - E.elf_elfheim[1]));
    }
    expect(bfs([E.elf_keep], walk).has(`${E.ert_dwarf[0]},${E.ert_dwarf[1]}`)).toBe(true);
  });

  it('T2 by canoe: the Aldi docks reach no FIRE entrance and not the fir_crescent dock\'s shore (4.3)', () => {
    const gate = new Set((src.patches.find((p) => p.id === 'north_bridge')?.cells ?? []).map(([x, y]) => `${x},${y}`));
    const canoe = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < N && y < N
      && (gate.has(`${x},${y}`) || (g[y][x] !== 'o' && g[y][x] !== 'm'));
    const starts = src.docks.filter((d) => d.basin === 'aldi')
      .flatMap((d) => DIRS.map(([dx, dy]): XY => [d.x + dx, d.y + dy])).filter(([x, y]) => canoe(x, y));
    const seen = bfs(starts, canoe);
    const fire = Object.entries(E).filter(([k, [x, y]]) => k.startsWith('fir_') && seen.has(`${x},${y}`));
    expect(fire).toEqual([]);
    const fc = src.docks.find((d) => d.id === 'fir_crescent')!;
    expect(DIRS.some(([dx, dy]) => seen.has(`${fc.x + dx},${fc.y + dy}`))).toBe(false);
  });
});
