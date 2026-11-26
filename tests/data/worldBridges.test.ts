/**
 * PT-1 (docs/PLAYTEST_ELFHEIM_PLAN.md): no bridge to nowhere on the world map. On the committed world source with the
 * patches on (the north bridge built), every bridge `=` component is a straight span (a filled rectangle) that is
 * either a crossing, whose cells beyond both ends along one axis are walkable land, or a pier, whose cells beyond one
 * end are walkable land and beyond the other open Water (Cornelia's jetty, Pravoka's quay). The playtest's bridges
 * (Matoya's ford along its river, the fords into the rock east of the north bridge) were neither. The rule fails on
 * mutated grids (a bridge into a mountain, one along a river).
 */
import { describe, it, expect } from 'vitest';
import { WorldGrid, loadWorldSource, D4, type XY } from '../helpers/worldGrid.js';

type Kind = 'crossing' | 'pier' | null;

/** The 4-connected `=` components of a grid. */
export function bridges(g: WorldGrid): XY[][] {
  const seen = new Set<number>();
  const out: XY[][] = [];
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.at(x, y) !== '=' || seen.has(y * g.w + x)) continue;
      const comp: XY[] = [];
      const q: XY[] = [{ x, y }];
      seen.add(y * g.w + x);
      while (q.length) {
        const c = q.pop() as XY;
        comp.push(c);
        for (const [dx, dy] of D4) {
          const n = { x: c.x + dx, y: c.y + dy };
          if (g.at(n.x, n.y) === '=' && !seen.has(n.y * g.w + n.x)) { seen.add(n.y * g.w + n.x); q.push(n); }
        }
      }
      out.push(comp);
    }
  }
  return out;
}

/** What a bridge component is: a crossing, a pier, or neither (null). */
export function classify(g: WorldGrid, comp: XY[]): Kind {
  const xs = comp.map((c) => c.x);
  const ys = comp.map((c) => c.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  if (comp.length !== (x1 - x0 + 1) * (y1 - y0 + 1)) return null;          // not a straight span
  const land = (c: XY): boolean => g.walk(c.x, c.y) && g.at(c.x, c.y) !== '=';
  const sea = (c: XY): boolean => g.water(c.x, c.y);
  const sides: [XY[], XY[]][] = [
    [range(y0, y1).map((y) => ({ x: x0 - 1, y })), range(y0, y1).map((y) => ({ x: x1 + 1, y }))],   // east-west
    [range(x0, x1).map((x) => ({ x, y: y0 - 1 })), range(x0, x1).map((x) => ({ x, y: y1 + 1 }))],   // north-south
  ];
  let kind: Kind = null;
  for (const [a, b] of sides) {
    if (a.every(land) && b.every(land)) return 'crossing';
    if ((a.every(land) && b.every(sea)) || (b.every(land) && a.every(sea))) kind = 'pier';
  }
  return kind;
}

function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

const grid = (rows: string[]): WorldGrid => new WorldGrid(rows.map((r) => [...r]));

describe('PT-1: the world map has no bridge to nowhere', () => {
  const g = WorldGrid.of(loadWorldSource(), { bridge: true });
  const all = bridges(g);

  it('every bridge is a crossing between two walkable shores or a pier into open water', () => {
    expect(all.length).toBeGreaterThan(0);
    const bad = all.filter((c) => classify(g, c) === null).map((c) => `(${c[0].x}, ${c[0].y}) x${c.length}`);
    expect(bad).toEqual([]);
  });

  it('the north bridge, with its patch on, is a crossing', () => {
    const src = loadWorldSource();
    const patch = src.patches.find((p) => p.id === 'north_bridge');
    expect(patch).toBeDefined();
    const [x, y] = patch!.cells[0];
    const comp = all.find((c) => c.some((q) => q.x === x && q.y === y));
    expect(comp && classify(g, comp)).toBe('crossing');
  });

  it('the rule fails on a bridge into rock, one along a river and a bent span (mutated grids)', () => {
    const rock = grid(['mmmmm', '.=m..', 'mmmmm']);
    const along = grid(['.rrr.', '.==r.', '...r.']);
    const bent = grid(['.r...', '.==..', '.r=..', '.r...']);
    for (const m of [rock, along, bent]) expect(bridges(m).map((c) => classify(m, c))).toContain(null);
    const ok = grid(['.r.', '.=.', '.r.']);
    expect(bridges(ok).map((c) => classify(ok, c))).toEqual(['crossing']);
    const pier = grid(['m.m', 'm=m', 'ooo']);
    expect(bridges(pier).map((c) => classify(pier, c))).toEqual(['pier']);
  });
});

describe("PT-4: Pravoka's berth is marked (docs/PLAYTEST_ELFHEIM_PLAN.md)", () => {
  type Deco = { name?: string; x: number; y: number; parts: (string | null)[][]; block?: boolean; on_water?: boolean };
  const src = loadWorldSource() as ReturnType<typeof loadWorldSource> & { objects: Deco[] };
  const g = WorldGrid.of(src, { bridge: true });
  const dock = (src.docks ?? []).find((d) => d.id === 'a1_pravoka')!;

  it('a plank quay runs along the shore beside the dock, a pier between the arrival and the sea', () => {
    expect(g.water(dock.x, dock.y)).toBe(true);
    expect([[-1, 0], [-1, 1]].map(([dx, dy]) => g.at(dock.x + dx, dock.y + dy))).toEqual(['=', '=']);
    const comp = bridges(g).find((c) => c.some((q) => q.x === dock.x - 1 && q.y === dock.y))!;
    expect(classify(g, comp)).toBe('pier');
  });

  it('two mooring posts stand in the water either side of the berth, letting the ship through', () => {
    const posts = src.objects.filter((o) => o.name === 'pravoka_mooring');
    expect(posts.map((o) => [o.x - dock.x, o.y - dock.y]).sort()).toEqual([[0, -1], [0, 1]]);
    for (const o of posts) {
      expect(o).toMatchObject({ on_water: true, block: false, parts: [['dock_post_icon_0_0']] });
      expect(g.water(o.x, o.y)).toBe(true);
    }
  });
});
