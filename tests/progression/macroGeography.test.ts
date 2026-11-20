/**
 * Proof (g), the macro-geography test (docs/WORLD_PLAN.md 6.1): the anchors of world-anchors.yaml at their targets
 * pass (s* = 0.735, every ratio in [0.86, 1.10]); the RED cases of step 7 fail (an anchor moved 10 cells, Onrac and
 * Gaia swapped, every anchor scaled by 1.5 about Cornelia, a detour); and the repository passes with the act-1
 * anchors placed and the rest assumed (a failure with --strict).
 */
import { describe, expect, it } from 'vitest';
import { loadQuestWorld } from '../../src/progression/questData.js';
import { createQuestContext } from '../../src/progression/questProofs.js';
import { attachLate, buildLateData, loadLateData, type GeoData } from '../../src/progression/questLateData.js';
import { anchorCells, bearing, geoCheck, proofGeo } from '../../src/progression/questGeo.js';
import { loadFixture } from '../fixtures/quest/loadFixture.js';

const geo = loadLateData().geo!;
type XY = [number, number];
const targets = (): Map<string, XY> => new Map(geo.anchors.map((a) => [a.name, [...a.target] as XY]));
const codes = (cells: Map<string, XY>): string[] => geoCheck({ geo, cells }).failures.map((f) => f.message);

describe('macroGeography: the anchors at their targets', () => {
  it('31 pairs, s* = 0.735, no failure', () => {
    const out = geoCheck({ geo, cells: targets() });
    expect(geo.pairs).toHaveLength(31);
    expect(out.failures).toEqual([]);
    expect(out.scale).toBeCloseTo(0.735, 3);
    expect(out.assumed).toEqual([]);
  });

  it('every non-exempt pair\'s ratio is in [0.86, 1.10] (2.2)', () => {
    const at = targets();
    const ref = new Map(geo.anchors.map((a) => [a.name, a.ref]));
    const s = geoCheck({ geo, cells: at }).scale;
    for (const [a, b] of geo.pairs) {
      if (geo.distanceExempt.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) continue;
      const dw = Math.hypot(at.get(a)![0] - at.get(b)![0], at.get(a)![1] - at.get(b)![1]);
      const dr = Math.hypot(ref.get(a)![0] - ref.get(b)![0], ref.get(a)![1] - ref.get(b)![1]);
      const r = dw / (s * dr);
      expect(r, `${a}-${b}`).toBeGreaterThanOrEqual(0.855); // 0.86 to two places (pravoka-matoya 0.856)
      expect(r, `${a}-${b}`).toBeLessThan(1.105); // 1.10 to two places (cornelia-crescent 1.103)
    }
  });

  it('bearings are compass degrees (north 0, east 90, y grows south)', () => {
    expect(bearing(0, -1)).toBe(0);
    expect(bearing(1, 0)).toBe(90);
    expect(bearing(0, 1)).toBe(180);
    expect(bearing(-1, 0)).toBe(270);
  });
});

describe('macroGeography: the RED fixtures of step 7', () => {
  it('an anchor moved 10 cells off its target', () => {
    const cells = targets();
    cells.set('crescent', [158, 124]);
    expect(codes(cells)).toContain('GEO place crescent at (158, 124), target (148, 124)');
  });

  it('Onrac and Gaia swapped: the bearings flip', () => {
    const cells = targets();
    const onrac = cells.get('onrac')!;
    cells.set('onrac', cells.get('gaia')!);
    cells.set('gaia', onrac);
    const msgs = codes(cells);
    expect(msgs.some((m) => /^GEO bearing cornelia-onrac \d+\.\d° > 40°$/.test(m))).toBe(true);
    expect(msgs.some((m) => /^GEO bearing cornelia-gaia /.test(m))).toBe(true);
  });

  it('every anchor scaled by 1.5 about Cornelia: the scale band and the placement catch it', () => {
    const [cx, cy] = geo.anchors.find((a) => a.name === 'cornelia')!.target;
    const cells = new Map(geo.anchors.map((a) => [a.name,
      [Math.round(cx + 1.5 * (a.target[0] - cx)), Math.round(cy + 1.5 * (a.target[1] - cy))] as XY]));
    const msgs = codes(cells);
    expect(msgs.some((m) => /^GEO scale s\*=1\.\d+ outside \[0\.60, 0\.80\]$/.test(m))).toBe(true);
    expect(msgs.some((m) => m.startsWith('GEO place onrac '))).toBe(true);
  });

  it('a distance band failure: one pair stretched while its bearing holds', () => {
    const cells = targets();
    cells.set('temple', cells.get('temple')!);
    cells.set('matoya', [56, 58]);
    expect(codes(cells).some((m) => /^GEO distance cornelia-matoya r=\d\.\d\d outside \[0\.7, 1\.3\]$/.test(m))).toBe(true);
  });

  it('a detour: the walk round a wall is more than 2.5 x the straight line', () => {
    const detourGeo: GeoData = {
      ...geo, tolerance: 99, scale: [0, 99],
      anchors: [{ name: 'cornelia', entrance: 'cornelia', region: 'a1', ref: [0, 0], target: [4, 1] },
        { name: 'pravoka', entrance: 'pravoka', region: 'a1', ref: [3, 0], target: [6, 1] }],
      pairs: [['cornelia', 'pravoka']], distanceExempt: [], detours: [{ pair: ['cornelia', 'pravoka'], mode: 'walking', factor: 2.5 }],
    };
    const late = { ...buildLateData({}), geo: detourGeo };
    const red = attachLate(createQuestContext(loadFixture('geo_detour')), late);
    expect(proofGeo(red).failures.map((f) => f.message)).toEqual(['GEO detour cornelia-pravoka 10 > 2.5 x 2.0']);
    const w = loadFixture('geo_detour');
    const map = w.maps.get('overworld')!;
    map.collision[1 * map.width + 5] = 0;
    expect(proofGeo(attachLate(createQuestContext(w), late)).failures).toEqual([]);
  });
});

describe('macroGeography: the repository', () => {
  const ctx = createQuestContext(loadQuestWorld());

  it('the world map\'s cells are world cells; Cornelia and the temple are placed at their entrances', () => {
    const map = ctx.world.maps.get('overworld')!;
    const cells = anchorCells(ctx, geo);
    for (const name of ['cornelia', 'temple']) {
      const a = geo.anchors.find((x) => x.name === name)!;
      expect(cells.get(name), name).toEqual(map.entrances![a.entrance]);
    }
  });

  it('(g) passes, the unbuilt anchors assumed; --strict fails each assumed anchor', () => {
    const r = proofGeo(ctx);
    expect(r.failures).toEqual([]);
    expect(r.line).toMatch(/^\(g\) geography: OK {2}s\*=0\.73\d \(31 pairs; \d+ assumed\)$/);
    const strict = proofGeo(createQuestContext(ctx.world, { strict: true }));
    expect(strict.failures.every((f) => f.message.startsWith('GEO assumed '))).toBe(true);
    // one strict failure per assumed anchor; 0 once every region has placed its anchors
    const assumed = Number(/; (\d+) assumed\)/.exec(r.line)?.[1] ?? '0');
    expect(strict.failures.length).toBe(assumed);
  });
});
