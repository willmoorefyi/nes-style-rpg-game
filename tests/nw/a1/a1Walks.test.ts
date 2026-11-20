/**
 * NW-3 (docs/NATURAL_WORLD_PLAN.md 3.6.3, "the feel"): act 1's four walks measured by BFS on foot on today's world
 * source and on the NW world source stay within +-10 % (the user's "keep the opening"). Measured at NW-3: today
 * 22 / 23 / 59 / 39, NW 22 / 23 / 61 / 39 (NW-0's pilot: the same). The bridge walks have the bridge patch on, the
 * others have its gap rows open Water. Moves to `tests/quest/a1/a1Walks.test.ts` at NW-5 (on the compiled map).
 */
import { describe, it, expect } from 'vitest';
import { nw, steps, today, withBridge, type Src, type XY } from './nwA1.js';

function walks(s: Src): Record<string, number> {
  const E = s.entrances;
  const gate = s.patches.find((p) => p.id === 'north_bridge')!.cells[4];
  const rows: [string, XY, XY, boolean][] = [
    ['south gate -> bridge gate', E.cornelia, gate, false],
    ['Cornelia -> Temple door', E.cornelia, E.temple, false],
    ['bridge -> Pravoka gate', gate, E.a1_pravoka, true],
    ["bridge -> Matoya's door", gate, E.a1_matoya, true],
  ];
  return Object.fromEntries(rows.map(([n, a, [bx, by], on]) => [n, steps(withBridge(s, on), a)[by][bx]]));
}

const now = walks(today);
const next = walks(nw);

describe("act 1's walks (NW-3, 3.6.3)", () => {
  it("today's figures are NW-0's measure (22 / 23 / 59 / 39)", () => {
    expect(Object.values(now)).toEqual([22, 23, 59, 39]);
  });

  it.each(Object.keys(now))('%s stays within +-10 % of today', (name) => {
    expect(Number.isFinite(next[name]), name).toBe(true);
    const ratio = next[name] / now[name];
    expect(ratio, `${name}: ${next[name]} / ${now[name]}`).toBeGreaterThanOrEqual(0.9);
    expect(ratio, `${name}: ${next[name]} / ${now[name]}`).toBeLessThanOrEqual(1.1);
  });
});
