/**
 * NW-2 (docs/NATURAL_WORLD_PLAN.md 0.1.1, 3.1, 5.2, 2.6): the generated 256x256 world source,
 * `assets-src/maps/overworld.yaml` (written by `layouts/world.py`; committed source only, as every
 * `tests/nw/` test). G-NW1 and G-NW3 runs over 6 edges lie only at the composer's stamps (entrances, doors, docks,
 * patches: the exemption list of 0.1.1, measured here by distance), G-NW2's coast index is at least 30, the land is
 * D-NW12's 28,874 +- 10 %, and every spot, dock and entrance stands on a cell of its kind.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

type XY = [number, number];
interface Src {
  ground: string;
  entrances: Record<string, XY>;
  transitions: { x: number; y: number; targetMap: string }[];
  docks: { id: string; x: number; y: number; basin: string }[];
  patches: { id: string; cells: XY[] }[];
  spots: Record<string, { at: XY; kind: string }>;
  world: { basins: Record<string, XY> };
}

const src = parse(readFileSync('assets-src/maps/overworld.yaml', 'utf-8')) as Src;
const g = src.ground.replace(/\n$/, '').split('\n').map((r) => [...r]);
const N = 256;
const BLOCK = new Set(['o', 'm', 'r', '≈']);
const CLASS: Record<string, number> = { m: 2, f: 3, s: 4, w: 5, n: 6, t: 7 };
const isSea = (x: number, y: number): boolean => g[y][x] === 'o';
const stamps: XY[] = [
  ...Object.values(src.entrances), ...src.transitions.map((t): XY => [t.x, t.y]),
  ...src.docks.map((d): XY => [d.x, d.y]), ...src.patches.flatMap((p) => p.cells),
];
/** A run (cells along it) is exempt-like when every cell lies within 3 of a stamp (icons are 3x3 round a door). */
const nearStamp = (cells: XY[]): boolean =>
  cells.every(([x, y]) => stamps.some(([sx, sy]) => Math.abs(sx - x) <= 3 && Math.abs(sy - y) <= 3));

/** Maximal runs of edges between cells (a, b) along a line, with the same `side` value, longer than 6. */
function longRuns(edges: (i: number, j: number) => number, lines: number[], len: number, at: (i: number, j: number) => XY): XY[][] {
  const out: XY[][] = [];
  for (const i of lines) {
    let j = 0;
    while (j < len) {
      const s = edges(i, j);
      if (!s) { j++; continue; }
      let k = j;
      const cells: XY[] = [];
      while (k < len && edges(i, k) === s) cells.push(at(i, k++));
      if (k - j > 6) out.push(cells);
      j = k;
    }
  }
  return out;
}

describe('the NW world source (NW-2)', () => {
  it('is 256 x 256 of legend chars, with sea all round', () => {
    expect(g).toHaveLength(N);
    expect(g.every((r) => r.length === N)).toBe(true);
    expect(new Set(g.flat())).toEqual(new Set(['o', '.', 'f', 'm', 's', 'w', 't', 'n', 'r', '≈', ',', '=']));
    for (let i = 0; i < N; i++) expect([g[0][i], g[N - 1][i], g[i][0], g[i][N - 1]]).toEqual(['o', 'o', 'o', 'o']);
  });

  it('G-NW2: the coast index is at least 30; the land is 28,874 +- 10 % (D-NW12)', () => {
    let edges = 0;
    let land = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!isSea(x, y)) land++;
      if (x + 1 < N && isSea(x, y) !== isSea(x + 1, y)) edges++;
      if (y + 1 < N && isSea(x, y) !== isSea(x, y + 1)) edges++;
    }
    expect(edges / Math.sqrt(land)).toBeGreaterThanOrEqual(30);
    expect(land).toBeGreaterThanOrEqual(26_000);
    expect(land).toBeLessThanOrEqual(31_800);
  });

  it('G-NW1: every straight coast run over 6 edges lies at a stamp', () => {
    const range = [...Array(N - 1).keys()];
    const v = longRuns((x, y) => (isSea(x, y) !== isSea(x + 1, y) ? (isSea(x, y) ? 1 : 2) : 0), range, N, (x, y) => [x, y]);
    const h = longRuns((y, x) => (isSea(x, y) !== isSea(x, y + 1) ? (isSea(x, y) ? 1 : 2) : 0), range, N, (y, x) => [x, y]);
    expect([...v, ...h].filter((cells) => !nearStamp(cells))).toEqual([]);
  });

  it('G-NW3: every chunk-line run between two land classes over 6 edges lies at a stamp', () => {
    const wet = (x: number, y: number): boolean => ['o', 'r', '≈'].includes(g[y]?.[x] ?? 'o');
    const cls = (x: number, y: number): number => {
      const c = g[y][x];
      if (c === 's' && (wet(x + 1, y) || wet(x - 1, y) || wet(x, y + 1) || wet(x, y - 1))) return 8;   // beach sand
      return wet(x, y) ? 0 : CLASS[c] ?? 8;
    };
    const diff = (a: number, b: number): number => (a && b && a !== b ? 1 : 0);
    const lines = [...Array(15).keys()].map((k) => 16 * (k + 1));
    const v = longRuns((x, y) => diff(cls(x - 1, y), cls(x, y)), lines, N, (x, y) => [x, y]);
    const h = longRuns((y, x) => diff(cls(x, y - 1), cls(x, y)), lines, N, (y, x) => [x, y]);
    expect([...v, ...h].filter((cells) => !nearStamp(cells))).toEqual([]);
  });

  it('every spot, dock and entrance stands on a cell of its kind; snow is not a landing (D-NW9)', () => {
    for (const [name, s] of Object.entries(src.spots)) {
      const c = g[s.at[1]][s.at[0]];
      if (s.kind === 'land') expect(BLOCK.has(c), name).toBe(false);
      else if (s.kind === 'dock') expect(c, name).toBe('o');
      else expect(['.', 't'], name).toContain(c);
    }
    expect(Object.keys(src.spots)).toHaveLength(48);        // NW2-W: + wat_s_waterfall_airship; NW2-F: + fir_s_ice_ship, fir_s_ice_shore; CD-W: + ord_s_{north,east,stack,west}_airship
    for (const d of src.docks) expect(g[d.y][d.x], d.id).toBe('o');
    expect(src.docks.map((d) => d.id).sort()).toEqual(['a1_pravoka', 'elf_port', 'ert_dwarf', 'ert_melmond', 'fir_crescent',
      'fir_ice']);
    for (const [name, [x, y]] of Object.entries(src.entrances)) expect(BLOCK.has(g[y][x]), name).toBe(false);
    expect(src.world.basins).toEqual({ aldi: [146, 165], ocean: [2, 2] });
  });

  it('snow and taiga lie in the far north (2.4 rule 5), but for FIRE\'s cold tip beyond ice_neck (NW2: x >= 196, y <= 136)', () => {
    const tip = (x: number, y: number): boolean => x >= 196 && y <= 136;
    const rows = (ch: string): number[] => g.flatMap((r, y) => (r.some((c, x) => c === ch && !tip(x, y)) ? [y] : []));
    expect(Math.max(...rows('n'))).toBeLessThan(110);
    expect(Math.max(...rows('t'))).toBeLessThan(120);
  });
});
