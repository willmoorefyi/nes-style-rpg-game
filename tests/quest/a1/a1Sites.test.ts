/**
 * NW-3 (docs/NATURAL_WORLD_PLAN.md 3.6.5): today's act-1 world tests rewritten against the NW world source
 * (committed sources only; `tests/quest/a1/a1_o_sites`, `bridgePatch`, `pravokaChannel`, `tests/data/act1Flow` and
 * `overworldLayout` keep testing today's compiled world until NW-5). Matoya and Pravoka sit at their act-1 pins within
 * 2 cells of `assets/data/world-anchors.yaml`'s targets with their doors one cell off; the brig waits at the Pravoka quay
 * for BIKKE_DEFEATED; the cairn blocks and is read from the pass; the north bridge's patch and gates (GT-2) and its
 * foreman; the quay dock in the Aldi; and from Cornelia the temple door and both bridge gates are reachable, the
 * north shore is not (act1Flow).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { grid, nw, reach, steps, walkable, withBridge, type XY } from './nwA1.js';

const g = grid(nw);
const E = nw.entrances;
const anchors = (parse(readFileSync('assets/data/world-anchors.yaml', 'utf-8')) as {
  anchors: Array<{ entrance: string; target: XY }>;
}).anchors;
const patch = nw.patches.find((p) => p.id === 'north_bridge')!;

describe('act 1 sites on the NW world (a1_o_sites)', () => {
  it.each(['a1_matoya', 'a1_pravoka'])('%s is walkable and within 2 cells of its anchor target', (name) => {
    const [x, y] = E[name];
    const [tx, ty] = anchors.find((a) => a.entrance === name)!.target;
    expect(Math.max(Math.abs(x - tx), Math.abs(y - ty))).toBeLessThanOrEqual(2);
    expect(walkable(g[y][x])).toBe(true);
  });

  it("the doors: Matoya's cave mouth and Pravoka's icon, one cell from the entrance", () => {
    for (const [map, entrance, name] of [['matoya-cave', 'arrival', 'a1_matoya'], ['pravoka', 'gate', 'a1_pravoka']]) {
      const t = nw.transitions.find((x) => x.targetMap === map)!;
      expect(t.targetEntrance).toBe(entrance);
      expect(Math.abs(t.x - E[name][0]) + Math.abs(t.y - E[name][1])).toBe(1);
    }
  });

  it('the brig waits at the Pravoka quay dock for BIKKE_DEFEATED, in the Aldi basin, beside the gate', () => {
    const dock = nw.docks.find((d) => d.id === 'a1_pravoka')!;
    expect(dock.basin).toBe('aldi');
    expect(g[dock.y][dock.x]).toBe('o');
    expect(Math.abs(E.a1_pravoka[0] - dock.x) + Math.abs(E.a1_pravoka[1] - dock.y)).toBeLessThanOrEqual(2);
    const ships = (nw.vehicles ?? []).filter((v) => v.type === 'ship');
    expect(ships).toEqual([{ type: 'ship', x: dock.x, y: dock.y, requiredFlag: 'BIKKE_DEFEATED' }]);
    const sea = steps(g, nw.world.basins.aldi, (c) => c === 'o');
    expect(sea[dock.y][dock.x], 'the quay is in the Aldi').not.toBe(Infinity);
  });

  it('the cairn on the saddle pass is an inspect cell that blocks, read from the pass below it', () => {
    const cairn = (nw.inspect ?? []).find((i) => JSON.stringify(i.text).includes('saddle'))!;
    expect(cairn).toBeDefined();
    expect(walkable(g[cairn.y][cairn.x])).toBe(false);
    expect(walkable(g[cairn.y + 1][cairn.x])).toBe(true);
  });
});

describe('the north bridge on the NW world (bridgePatch, GT-2)', () => {
  it('the patch: flag BRIDGE_BUILT, `=` on the 2 gap rows and the gate cells; the gates on its gate cells', () => {
    expect(patch).toMatchObject({ flag: 'BRIDGE_BUILT', ground: '=' });
    expect(patch.cells).toHaveLength(6);
    const gates = (nw.keyItemGates ?? []).filter((k) => k.requiredFlag === 'BRIDGE_BUILT').map((k) => [k.x, k.y]);
    expect(gates).toEqual(patch.cells.slice(4));
  });

  it('closed until BRIDGE_BUILT, then the span walks from the foot to the north shore', () => {
    const [gx, gy] = patch.cells[4];
    const foot: XY = [gx, gy + 1];
    expect(reach(withBridge(nw, false), foot, E.north_shore)).toBe(false);
    expect(steps(withBridge(nw, true), foot)[E.north_shore[1]][E.north_shore[0]]).toBe(gy + 1 - E.north_shore[1]);
  });

  it('the foreman stands by the south stub and lays the span once the lute is held', () => {
    const foreman = (nw.npcs ?? []).find((n) => n.id === 'bridge_worker_w')!;
    expect(foreman.requiredItem).toBe('lute');
    expect(foreman.cutscene).toEqual({ id: 'a1_bridge_finished', requiredFlag: 'INTRO_COMPLETE', onceFlag: 'BRIDGE_BUILT' });
    const [gx, gy] = patch.cells[4];
    expect(Math.abs(foreman.x - gx) + Math.abs(foreman.y - gy)).toBeLessThanOrEqual(2);
    expect(walkable(g[foreman.y][foreman.x])).toBe(true);
  });
});

describe('act 1 flow on the NW world (act1Flow)', () => {
  it('from the south gate the temple door and both bridge gates are reachable, the north shore is not', () => {
    const off = withBridge(nw, false);
    const temple = nw.transitions.find((t) => t.targetMap === 'temple-of-fiends')!;
    const d = steps(off, E.cornelia);
    const near = ([x, y]: XY) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => d[y + dy][x + dx] !== Infinity);
    expect(near([temple.x, temple.y]), 'the temple door').toBe(true);
    for (const k of nw.keyItemGates ?? []) expect(near([k.x, k.y]), `gate (${k.x}, ${k.y})`).toBe(true);
    expect(d[E.north_shore[1]][E.north_shore[0]]).toBe(Infinity);
  });
});
