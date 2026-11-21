/**
 * NW-1 (docs/NATURAL_WORLD_PLAN.md 4.2, 2.2): the re-fitted anchors of the 256x256 world,
 * `assets/data/world-anchors.yaml` (committed source only, as every NW world test, moved from `tests/nw/` at NW-5). Act 1's four anchors are
 * today's cells + (54, 44); every other target is CORNELIA_NW (146, 155) + s* x ref at s* 0.86; the bands moved with
 * the scale; proof (g) passes at the targets, at NW-0's nudged pins, and at 20,000 random +-2 placements of the
 * non-act-1 anchors (at most 0.05 % may fail).
 */
import { describe, it, expect } from 'vitest';
import { loadLateData, type GeoData } from '../../src/progression/questLateData.js';
import { geoCheck } from '../../src/progression/questGeo.js';

type XY = [number, number];
const nw = loadLateData(process.cwd(), { anchors: 'assets/data/world-anchors.yaml' }).geo!;
const today = loadLateData(process.cwd(), { anchors: 'tests/fixtures/passW/world-anchors.yaml' }).geo!;  // pass W's, frozen at NW-5
const A1 = new Set(['cornelia', 'temple', 'matoya', 'pravoka']);
const CORNELIA_NW: XY = [146, 155];
const S_STAR = 0.86;
/** NW2-F (docs/NW2_EDITS_PLAN.md 9): the detour hops whose mode changed. */
const NW2_MODES: Record<string, string> = { 'crescent|ice': 'ship+canoe+walking', 'ice|desert': 'ship+canoe+walking' };
const cellsOf = (geo: GeoData, move: (name: string, t: XY) => XY = (_n, t) => t): Map<string, XY> =>
  new Map(geo.anchors.map((a) => [a.name, move(a.name, a.target)]));

describe('NW anchors (4.2)', () => {
  it('keeps pass W\'s anchors, refs, pairs, exemptions and detours; moves the scale bands', () => {
    // NW2 (docs/NW2_EDITS_PLAN.md 9, D-NW2-5): the dwarves' ref moved north of the canal, dwarf-melmond tightened
    // (NW2-E); the Ice Cavern's moved to the peninsula's tip, crescent-ice and ice-desert by ship and canoe (NW2-F)
    const nw2: Record<string, XY> = { dwarf: [-54, -40], ice: [79, -55] };
    expect(nw.anchors.map((a) => [a.name, a.entrance, a.ref]))
      .toEqual(today.anchors.map((a) => [a.name, a.entrance, nw2[a.name] ?? a.ref]));
    expect(nw.pairs).toEqual(today.pairs);
    expect(nw.pairs).toHaveLength(31);
    expect(nw.distanceExempt).toEqual([['cornelia', 'temple']]);
    expect(nw.detours.map((d) => [d.pair, d.mode, d.factor])).toEqual(today.detours.map((d) => [d.pair,
      NW2_MODES[d.pair.join('|')] ?? d.mode, d.pair.join('-') === 'dwarf-melmond' ? 2.5 : d.factor]));
    expect([nw.tolerance, nw.scale, nw.longPair]).toEqual([2, [0.75, 0.95], 23]);
    expect([nw.ratio, nw.bearing]).toEqual([today.ratio, today.bearing]);
  });

  it('targets: act 1 is today + (54, 44); the rest CORNELIA_NW + s* x ref', () => {
    const was = new Map(today.anchors.map((a) => [a.name, a.target]));
    for (const a of nw.anchors) {
      const want: XY = A1.has(a.name) ? [was.get(a.name)![0] + 54, was.get(a.name)![1] + 44]
        : [Math.round(CORNELIA_NW[0] + S_STAR * a.ref[0]), Math.round(CORNELIA_NW[1] + S_STAR * a.ref[1])];
      expect(a.target, a.name).toEqual(want);
    }
    expect(nw.anchors.find((a) => a.name === 'cornelia')!.target).toEqual(CORNELIA_NW);
  });

  it('proof (g) passes at the targets and at NW-0\'s pins (Melmond -2 x, Crescent +2 x)', () => {
    const at = geoCheck({ geo: nw, cells: cellsOf(nw), strict: true });
    expect(at.failures.map((f) => f.message)).toEqual([]);
    expect(at.scale).toBeGreaterThan(0.84);
    expect(at.scale).toBeLessThan(0.86);
    const nudge: Record<string, XY> = { melmond: [-2, 0], crescent: [2, 0] };
    const pins = geoCheck({ geo: nw, cells: cellsOf(nw, (n, t) => [t[0] + (nudge[n]?.[0] ?? 0), t[1] + (nudge[n]?.[1] ?? 0)]) });
    expect(pins.failures.map((f) => f.message)).toEqual([]);
  });

  it('pravoka-matoya is in its band without an exemption (r >= 0.72 at the targets)', () => {
    const at = cellsOf(nw);
    const ref = new Map(nw.anchors.map((a) => [a.name, a.ref]));
    const s = geoCheck({ geo: nw, cells: at }).scale;
    const d = (a: XY, b: XY): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const r = d(at.get('pravoka')!, at.get('matoya')!) / (s * d(ref.get('pravoka')!, ref.get('matoya')!));
    expect(r).toBeGreaterThanOrEqual(0.72);
    expect(r).toBeLessThan(0.75);
  });

  it('20,000 random +-2 placements of the non-act-1 anchors: at most 0.05 % fail', () => {
    let seed = 20000;
    const rnd = (): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const off = (): number => Math.floor(rnd() * 5) - 2;
    let bad = 0;
    for (let i = 0; i < 20000; i++) {
      const cells = cellsOf(nw, (n, t) => (A1.has(n) ? t : [t[0] + off(), t[1] + off()]));
      if (geoCheck({ geo: { ...nw, tolerance: 2 }, cells }).failures.length) bad++;
    }
    expect(bad / 20000).toBeLessThanOrEqual(0.0005);
  });
});
