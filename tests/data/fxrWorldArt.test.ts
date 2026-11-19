/**
 * FX-R world art (docs/PLAYTEST_RECHECK_PLAY_R.md): the straight shapes left in the west (P3-R3: the western range,
 * the isthmus coasts, the hogback north of the canal, the beach at the foot of the canal's quays) and the stamped
 * 3x3 rings round the Melmond and Onrac icons (P3-R4). Read on the generated world source.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

interface Deco { type: string; name?: string; x: number; y: number; parts: (string | null)[][]; offset?: number[]; collide?: string }
interface Patch { id: string; ground: string; art_ground?: string; cells: number[][] }
interface Source { ground: string; objects: Deco[]; patches: Patch[] }

const world = parse(readFileSync('assets-src/maps/overworld.yaml', 'utf-8')) as Source;
const rows = world.ground.trimEnd().split('\n');
const at = (x: number, y: number): string => rows[y][x];

function longestRun(values: number[]): number {
  let best = 0, run = 0;
  values.forEach((v, i) => { run = i > 0 && v === values[i - 1] ? run + 1 : 1; best = Math.max(best, run); });
  return best;
}

/** Per row y0..y1, the first land cell scanning from x0 towards x1. */
function coast(y0: number, y1: number, x0: number, x1: number): number[] {
  const out: number[] = [];
  const step = x1 >= x0 ? 1 : -1;
  for (let y = y0; y <= y1; y++) {
    let x = x0;
    while (x !== x1 && at(x, y) === 'o') x += step;
    out.push(x);
  }
  return out;
}

/** The western range on row y: the centre of the widest mountain run within x 19-32. */
function ridgeCentre(y: number): number {
  let best: [number, number] = [0, -1];
  let start = -1;
  for (let x = 19; x <= 33; x++) {
    const m = x <= 32 && at(x, y) === 'm';
    if (m && start < 0) start = x;
    if (!m && start >= 0) {
      if (x - 1 - start > best[1] - best[0]) best = [start, x - 1];
      start = -1;
    }
  }
  return (best[0] + best[1]) / 2;
}

describe('P3-R3: the west has no ruler-straight shapes', () => {
  it('the western range meanders: its centre takes many columns and no column is rock from coast to coast', () => {
    const ys = Array.from({ length: 141 - 68 + 1 }, (_, i) => 68 + i);
    const centres = ys.map(ridgeCentre);
    expect(new Set(centres.map(Math.round)).size).toBeGreaterThanOrEqual(5);
    for (let x = 21; x <= 30; x++) {
      const north = ys.filter((y) => y < 104);
      expect(north.every((y) => at(x, y) === 'm'), `column x ${x} is rock on every row y 68-103`).toBe(false);
    }
  });

  // The hogback's body (y 78-91) keeps its width: its chunk's peaks reach into A1's chunk at x 64, which EARTH may not
  // repaint. So the coast's longest straight run is that body, 12 rows (y 78-89; it was 34, y 76-109).
  it('the isthmus coasts (x 49 and x 61 before) wander, and the hogback ends in a ragged cape', () => {
    const west = coast(71, 109, 44, 56), east = coast(71, 109, 63, 55);
    expect(new Set(west).size).toBeGreaterThanOrEqual(5);
    expect(new Set(east).size).toBeGreaterThanOrEqual(4);
    expect(longestRun(west)).toBeLessThanOrEqual(12);
    const downs = coast(96, 109, 44, 56);
    expect(new Set(downs).size).toBeGreaterThanOrEqual(3);
    expect(longestRun(downs)).toBeLessThanOrEqual(4);
    const cape = Array.from({ length: 7 }, (_, i) => rows[71 + i].slice(44, 64).replace(/o/g, '').length);
    expect(new Set(cape).size, 'the cape narrows row by row (y 71-77)').toBeGreaterThanOrEqual(5);
  });

  it('the canal stays the 2-row Water patch, drawn as a stone-banked cut (no beach at the foot of its quays)', () => {
    const canal = world.patches.find((p) => p.id === 'canal')!;
    expect(canal.ground).toBe('o');
    expect(canal.art_ground).toBe('~');
    for (let x = 49; x <= 61; x++) {
      expect(at(x, 92)).toBe('.');
      expect(at(x, 94)).toBe(':');
    }
  });
});

describe('P3-R4: Melmond and Onrac are dressed by a scatter, not a stamped 3x3 ring', () => {
  it.each([['melmond', 39, 111], ['onrac', 27, 36]])('%s: mixed kinds, varied offsets, gaps in its box', (name, x0, y0) => {
    const near = world.objects.filter((o) => o.type === 'deco' && o.name !== name && o.parts.length === 1
      && o.parts[0].length === 1 && o.x >= x0 - 1 && o.x <= x0 + 3 && o.y >= y0 - 1 && o.y <= y0 + 3);
    const kinds = new Set(near.map((o) => o.parts[0][0]));
    expect(kinds.has('tree_clump') && kinds.has('boulder')).toBe(true);
    const offsets = new Set(near.map((o) => (o.offset ?? [0, 0]).join(',')));
    expect(offsets.size).toBeGreaterThanOrEqual(Math.min(near.length, 4));
    const town = world.objects.find((o) => o.name === name)!;
    const covered = new Set([...near.map((o) => `${o.x},${o.y}`), `${town.x},${town.y}`, `${town.x + 1},${town.y}`]);
    let gaps = 0;
    for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 3; x++) if (!covered.has(`${x},${y}`)) gaps++;
    expect(gaps).toBeGreaterThanOrEqual(2);
  });
});
