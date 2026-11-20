/**
 * NW-3 (docs/NATURAL_WORLD_PLAN.md 3.6.2, 3.6.3, 3.10): act 1's pins and promises on the NW world source. The pins
 * (`layouts/a1/world_a1_pins.py`, derived by `a1/world_a1_derive.py` from today's world) keep every act-1 entrance,
 * door, gate, patch cell, spot and placed object at today's cell + (54, 44); each pin cell has its material; the
 * bridge is the only way off the peninsula; the tomb is reached only over the east footbridge; the temple before the
 * bridge, Matoya and Pravoka after it; Pravoka's channel keeps 6 Water cells per row; exactly 2 key-item gates; the
 * land beyond the bridge is larger than the peninsula (OW-15); the boulders stand on grass; and the roads are one
 * network whose every dead end is a gate, door, entrance, bridge or TOMB_END cell itself (3.10: no stub).
 * Replaces `tests/quest/a1/frozenCore.test.ts` for the NW world (moved into `tests/quest/a1/` at NW-5).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  ACT1, inAct1, key, nw, pin, reach, size, steps, today, withBridge, walkable, grid, type XY,
} from './nwA1.js';

const g = grid(nw);
const tg = grid(today);
const E = nw.entrances;
const off = withBridge(nw, false);
const on = withBridge(nw, true);
const at = ([x, y]: XY): string => g[y][x];
const patch = nw.patches.find((p) => p.id === 'north_bridge')!;
const todayPatch = today.patches.find((p) => p.id === 'north_bridge')!;
/** today's bridge cells (`=`) of the east river box (x 100-118, y 99-122): the east footbridge */
const footbridge: XY[] = [];
for (let y = 99; y <= 122; y++) for (let x = 100; x <= 118; x++) if (tg[y][x] === '=') footbridge.push(pin([x, y]));
const tombEnd = nw.road_check!.ends[0];

describe('act 1 pins (NW-3, 3.6.2)', () => {
  it('the pins file is derived from today\'s world and is current', () => {
    const out = execFileSync('python3', ['-I', 'assets-src/tools/layouts/a1/world_a1_derive.py', '--check'], { encoding: 'utf-8' });
    expect(out.trim()).toBe('world_a1_pins: OK');
  });

  it('every act-1 entrance, door, gate, patch cell, dock and spot is today\'s cell + (54, 44)', () => {
    for (const e of ACT1) expect(E[e], e).toEqual(pin(today.entrances[e]));
    const maps = new Set(['cornelia', 'temple-of-fiends', 'matoya-cave', 'pravoka']);
    const doors = (s: typeof nw) => s.transitions.filter((t) => maps.has(t.targetMap));
    expect(doors(nw)).toHaveLength(7);
    expect(doors(nw)).toEqual(doors(today).map((t) => ({ ...t, x: t.x + 54, y: t.y + 44 })));
    expect((nw.keyItemGates ?? []).map((k) => [k.x, k.y])).toEqual((today.keyItemGates ?? []).map((k) => pin([k.x, k.y])));
    expect(patch.cells).toEqual(todayPatch.cells.map(pin));
    const dock = (s: typeof nw) => s.docks.find((d) => d.id === 'a1_pravoka')!;
    expect([dock(nw).x, dock(nw).y]).toEqual(pin([dock(today).x, dock(today).y]));
    expect(nw.world.basins.aldi).toEqual(pin(today.world.basins.aldi));
    // a landing spot may be resolved to the nearest grass cell (spots.resolve): the temple's moves 1 off the road
    const spots = (s: typeof nw) => Object.entries(s.spots).filter(([k]) => k.startsWith('a1_s_'));
    expect(spots(nw).map(([k]) => k)).toEqual(spots(today).map(([k]) => k));
    for (const [k, v] of spots(today)) {
      const [x, y] = pin(v.at), [nx, ny] = nw.spots[k].at;
      const d = Math.abs(nx - x) + Math.abs(ny - y);
      if (v.kind === 'landing') expect(d, k).toBeLessThanOrEqual(2);
      else expect([nx, ny], k).toEqual([x, y]);
      if (v.kind === 'landing') expect(at([nx, ny]), k).toBe('.');
    }
  });

  it('every placed act-1 object, inspect cell and NPC is today\'s, moved by (54, 44)', () => {
    const was = (list: { x: number; y: number }[] | undefined) => new Set((list ?? []).filter((o) => inAct1([o.x, o.y])).map((o) => key(pin([o.x, o.y]))));
    for (const [name, now, then] of [['objects', nw.objects, today.objects], ['inspect', nw.inspect, today.inspect],
      ['npcs', nw.npcs, today.npcs], ['vehicles', nw.vehicles, today.vehicles]] as const) {
      const mine = (now ?? []).filter((o) => inAct1([o.x - 54, o.y - 44]));
      expect(mine.length, name).toBeGreaterThan(0);
      for (const o of mine) expect(was(then).has(key([o.x, o.y])), `${name} at (${o.x}, ${o.y})`).toBe(true);
    }
    expect((nw.npcs ?? []).map((n) => n.id).sort()).toEqual(['bridge_worker_e', 'bridge_worker_w', 'chest_tomb']);
  });

  it('every pin cell has its material', () => {
    for (const e of ACT1) expect(walkable(at(E[e])), e).toBe(true);
    patch.cells.forEach((c, i) => expect(at(c), `patch ${key(c)}`).toBe(i < 4 ? 'o' : '='));
    expect(footbridge).toHaveLength(2);
    for (const c of footbridge) expect(at(c), `footbridge ${key(c)}`).toBe('=');
    const [sx, sy] = nw.world.basins.aldi;
    for (let y = sy - 3; y < sy; y++) expect(at([sx, y]), `jetty (${sx}, ${y})`).toBe('=');
    expect(at([sx, sy])).toBe('o');
    const dock = nw.docks.find((d) => d.id === 'a1_pravoka')!;
    expect(at([dock.x, dock.y])).toBe('o');
    const boulders = (nw.objects ?? []).filter((o) => JSON.stringify(o).includes('"boulder"') && o.name !== 'cairn'
      && inAct1([o.x - 54, o.y - 44]));   // act 1's (NW-R regions place their own boulders)
    expect(boulders).toHaveLength(3);
    for (const b of boulders) expect(at([b.x, b.y]), `boulder (${b.x}, ${b.y})`).toBe('.');
    // the city's moat ponds and its stream under the town are today's cells
    for (let y = 107; y <= 110; y++) for (let x = 90; x <= 94; x++) {
      if ('≈r'.includes(tg[y][x])) expect(at(pin([x, y])), `city (${x}, ${y})`).toBe(tg[y][x]);
    }
  });
});

describe("act 1's promises (NW-3, 3.6.3)", () => {
  it('the bridge is the only way off the peninsula (barrier spine): closed with the patch off, open with it on', () => {
    expect(reach(off, E.cornelia, E.north_shore)).toBe(false);
    expect(reach(off, E.cornelia, E.a1_pravoka)).toBe(false);
    expect(reach(on, E.cornelia, E.north_shore)).toBe(true);
  });

  it('the tomb is reachable on foot before the bridge, only over the east footbridge', () => {
    expect(reach(off, E.cornelia, tombEnd)).toBe(true);
    const cut = off.map((r) => [...r]);
    for (const [x, y] of footbridge) cut[y][x] = 'r';
    expect(reach(cut, E.cornelia, tombEnd)).toBe(false);
    expect((nw.inspect ?? []).filter((i) => JSON.stringify(i.text).includes('Here lies Erdrick'))).toHaveLength(2);
  });

  it('the temple before BRIDGE_BUILT; Matoya and Pravoka after it', () => {
    expect(reach(off, E.cornelia, E.temple)).toBe(true);
    expect(reach(on, E.cornelia, E.a1_matoya)).toBe(true);
    expect(reach(on, E.cornelia, E.a1_pravoka)).toBe(true);
  });

  it("Pravoka's channel keeps at least 6 Water cells on every row y 92-110 (today's), east of x 132", () => {
    const short: string[] = [];
    for (let y = 92; y <= 110; y++) {
      const [x0, yy] = pin([132, y]);
      let n = 0;
      while (on[yy][x0 + n] === 'o') n++;
      if (n < 6) short.push(`row ${yy}: ${n}`);
    }
    expect(short).toEqual([]);
  });

  it('exactly 2 key-item gates, the bridge\'s, on the patch\'s gate cells', () => {
    const gates = nw.keyItemGates ?? [];
    expect(gates.map((k) => k.requiredFlag)).toEqual(['BRIDGE_BUILT', 'BRIDGE_BUILT']);
    expect(gates.map((k) => [k.x, k.y])).toEqual(patch.cells.slice(4));
  });

  it('OW-15: the land walkable from the north shore is larger than the peninsula', () => {
    expect(size(off, E.north_shore)).toBeGreaterThan(size(off, E.cornelia));
  });
});

describe("act 1's roads (NW-3, 3.10: Cornelia's stubs fixed)", () => {
  const road = (c: string) => c === ',' || c === ':' || c === '=';
  const marks = new Set([
    ...nw.transitions.map((t) => key([t.x, t.y])), ...Object.values(E).map(key),
    ...(nw.keyItemGates ?? []).map((k) => key([k.x, k.y])), key(tombEnd),
  ]);

  it('road_check is on with no_stubs and ends at TOMB_END (a road cell)', () => {
    expect(nw.road_check).toMatchObject({ materials: ['dirt'], no_stubs: true });
    expect(',:'.includes(at(tombEnd))).toBe(true);
  });

  it('every road tip of act 1 is a gate, door, entrance, bridge or TOMB_END cell itself', () => {
    const bad: string[] = [];
    for (let y = 100; y < 200; y++) for (let x = 110; x < 200; x++) {
      if (!road(g[y][x]) || g[y][x] === '=') continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => road(g[y + dy][x + dx])).length;
      if (n <= 1 && !marks.has(key([x, y]))) bad.push(key([x, y]));
    }
    expect(bad).toEqual([]);
  });

  it("Cornelia's four gates, the bridge foot, the temple door, the jetty and the tomb share one road network", () => {
    const s = new Set<string>();
    steps(g, E.cornelia, road).forEach((r, y) => r.forEach((v, x) => { if (v !== Infinity) s.add(key([x, y])); }));
    const doors = nw.transitions.filter((t) => t.targetMap === 'cornelia' || t.targetMap === 'temple-of-fiends');
    for (const t of doors) expect(s.has(key([t.x, t.y])) || s.has(key([t.x, t.y + 1])), `${t.targetMap} (${t.x}, ${t.y})`).toBe(true);
    expect(s.has(key(pin([93, 97]))), 'the bridge foot').toBe(true);
    expect(s.has(key(tombEnd)), 'TOMB_END').toBe(true);
    const [sx, sy] = nw.world.basins.aldi;
    expect(s.has(key([sx, sy - 1])), 'the jetty').toBe(true);
  });
});
