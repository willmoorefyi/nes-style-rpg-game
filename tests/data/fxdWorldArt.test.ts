/**
 * FX-D world art (docs/PLAYTEST_FIX_PLAN.md): the coasts that read as rectangles from the air (G-1), the canal as a
 * dug cut with quays and lock gates (P1-1-10 / G-2), the ice-cavern-b3 niche chest's floor (P3-04, PLAY-2) and the
 * Melmond and Onrac town icons (P3-13, PLAY-2). Read on the generated sources (assets-src/maps/*.yaml, written by
 * the layout scripts).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

interface Deco { type: string; name?: string; x: number; y: number; parts: (string | null)[][]; walk_cells?: number[][] }
interface Patch { id: string; flag: string; ground: string; cells: number[][]; objects?: Deco[] }
interface Source { ground: string; objects: Deco[]; patches: Patch[]; entrances: Record<string, [number, number]> }

const world = parse(readFileSync('assets-src/maps/overworld.yaml', 'utf-8')) as Source;
const rows = world.ground.trimEnd().split('\n');
const at = (x: number, y: number): string => rows[y][x];
const land = (ch: string): boolean => ch !== 'o';

/** The longest run of equal values in a list (a coast that keeps one column, or one row, that long is straight). */
function longestRun(values: number[]): number {
  let best = 0, run = 0;
  values.forEach((v, i) => { run = i > 0 && v === values[i - 1] ? run + 1 : 1; best = Math.max(best, run); });
  return best;
}

/** Per row y0..y1, the first land cell scanning from x0 towards x1 (step +-1). */
function coast(y0: number, y1: number, x0: number, x1: number): number[] {
  const out: number[] = [];
  const step = x1 >= x0 ? 1 : -1;
  for (let y = y0; y <= y1; y++) {
    let x = x0;
    while (x !== x1 && !land(at(x, y))) x += step;
    out.push(x);
  }
  return out;
}

describe('G-1: coasts no longer read as rectangles', () => {
  // [name, coast columns, at least this many distinct columns]; every coast holds one column for at most 11 rows
  // (Crescent's harbour quay, x 147, y 119-129). Measured at FX-D (before -> after): longest run / distinct columns
  // Crescent west 17 / 3 -> 11 / 7, Crescent east 43 / 2 -> 10 / 10, south lands east 17 / 2 -> 5 / 5, western
  // continent west 9 / 7 -> 9 / 11 and east 14 / 5 -> 6 / 10, north-western continent west 6 / 5 -> 8 / 8.
  const cases: Array<[string, number[], number]> = [
    ['Crescent west coast (y 67-137)', coast(67, 137, 144, 170), 6],
    ['Crescent east coast (y 67-137)', coast(67, 137, 191, 170), 8],
    ['the south lands\' east coast (y 150-182)', coast(150, 182, 191, 165), 4],
    ['the western continent\'s west coast (y 72-134)', coast(72, 134, 2, 22), 9],
    ['the western continent\'s east coast (y 72-104)', coast(72, 104, 47, 30), 8],
    ['the north-western continent\'s west coast (y 6-52)', coast(6, 52, 2, 14), 7],
  ];
  it.each(cases)('%s wanders (distinct columns, no long straight run)', (_name, xs, least) => {
    expect(new Set(xs).size).toBeGreaterThanOrEqual(least);
    expect(longestRun(xs)).toBeLessThanOrEqual(11);
  });

  it('the two southern deserts are not boxes: their facing edges wander, and no straight column parts them', () => {
    const ashEast: number[] = [], duneWest: number[] = [];
    for (let y = 156; y <= 176; y++) {
      let x = 131;
      while (x > 116 && at(x, y) !== 's') x--;
      ashEast.push(x);
      x = 132;
      while (x < 160 && at(x, y) !== 's') x++;
      duneWest.push(x);
    }
    expect(new Set(ashEast).size).toBeGreaterThanOrEqual(4);
    expect(new Set(duneWest).size).toBeGreaterThanOrEqual(4);
    expect(longestRun(ashEast)).toBeLessThanOrEqual(8);
    expect(longestRun(duneWest)).toBeLessThanOrEqual(8);
    for (let x = 128; x <= 140; x++) {
      const col = Array.from({ length: 21 }, (_, i) => at(x, 156 + i));
      expect(new Set(col).size, `column x ${x} is one material over y 156-176`).toBeGreaterThan(1);
    }
  });
});

describe('P1-1-10 / G-2: the canal is a dug cut', () => {
  const canal = world.patches.find((p) => p.id === 'canal')!;
  const xs = canal.cells.map((c) => c[0]), ys = canal.cells.map((c) => c[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];

  it('keeps its patch: CANAL_OPEN turns the 2-row saddle x 49-61, y 92-93 to Water', () => {
    expect(canal).toMatchObject({ flag: 'CANAL_OPEN', ground: 'o' });
    expect([x0, x1, y0, y1]).toEqual([49, 61, 92, 93]);
  });

  it('runs between stone quays: the rows above and below the cut are cobble', () => {
    for (let x = x0 + 1; x <= x1; x++) expect(at(x, y0 - 1), `north quay (${x}, ${y0 - 1})`).toBe(':');
    for (let x = x0; x <= x1; x++) expect(at(x, y1 + 1), `south quay (${x}, ${y1 + 1})`).toBe(':');
  });

  it('has a lock gate at each mouth: the patch draws a culvert arch over both rows at x 49 and x 61', () => {
    const gates = (canal.objects ?? []).filter((o) => o.parts.flat().every((p) => p === 'culvert'));
    expect(gates.map((g) => [g.x, g.y]).sort((a, b) => a[0] - b[0])).toEqual([[x0, y0], [x1, y0]]);
    for (const g of gates) expect(g.parts).toEqual([['culvert'], ['culvert']]);
  });
});

describe('P3-04: the ice-cavern-b3 niche chest stands on frost floor', () => {
  it('(38, 8) is frost floor like the vault beside it, not packed snow', () => {
    const b3 = parse(readFileSync('assets-src/maps/ice-cavern-b3.yaml', 'utf-8')) as Source & { npcs: Array<{ id: string; x: number; y: number }> };
    const g = b3.ground.trimEnd().split('\n');
    const chest = b3.npcs.find((n) => n.id.endsWith('b3_niche'))!;
    expect([chest.x, chest.y]).toEqual([38, 8]);
    expect(g[8][38]).toBe('-');
    expect(g[8][37]).toBe('-');
  });
});

describe('P3-13: Melmond and Onrac read as towns on the world map', () => {
  const icon = (name: string): Deco => world.objects.find((o) => o.name === name)!;
  const TOWN = ['town_icon_1_0', 'town_icon_1_1'];   // the sheet's drawn row (its top row is empty art)

  it.each([['melmond', 'ert_melmond'], ['onrac', 'wat_onrac']])('%s uses the walled-town icon, its door beside %s', (name, anchor) => {
    const d = icon(name);
    expect(d, name).toBeDefined();
    for (const p of TOWN) expect(d.parts.flat()).toContain(p);
    expect(d.parts.flat()).not.toContain('wall_door_bottom');
    const [dx, dy] = d.walk_cells![0];
    const [gx, gy] = world.entrances[anchor];
    expect(Math.abs(d.x + dx - gx) + Math.abs(d.y + dy - gy)).toBe(1);
  });
});
