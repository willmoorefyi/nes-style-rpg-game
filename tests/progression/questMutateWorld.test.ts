/**
 * The no-skip mutation suite on the real world (`npm run quest -- --mutate`, docs/WORLD_PLAN.md 6.3): every element
 * is caught or reported, plain and with --strict. Heavy tier (tests/tiers.ts). Since TS (docs/TEST_SPEED_PLAN.md
 * 4.3) the suite comes through the mutation cache (src/progression/questMutateCache.ts):
 * - **hit** (the fingerprint of every input the verifier reads, its code, options and runtime has an entry, normally
 *   the integrator's `npm run quest -- --strict --mutate` on the same tree): both variants are re-derived by the
 *   current code from the cached raw runs and checked against the stored results; every light job and one heavy job
 *   picked by the fingerprint are re-run live and compared (about 3 min);
 * - **miss**: the suite runs live in the pool (4 workers here; about 20 min) and stores its entry.
 * Env: QUEST_MUTATE_CACHE=use (default) | refresh | off, QUEST_MUTATE_AUDIT=<n> | all (heavy jobs the hit re-runs;
 * all makes a hit a full live run), QUEST_MUTATE_JOBS=<workers>. The run's source, fingerprint, wall time and workers
 * go to the task's meta (the timing reporter's `questMutateWorld: cache hit / MISS` line). The gate table's rows by
 * name, on the mini world, are questMutate.test.ts; the pool and the cache are questMutatePool / questMutateCache.
 */
import { describe, expect, it } from 'vitest';
import { canonicalJson, sha256 } from '../../src/progression/questInputs.js';
import { mutationSuite } from '../../src/progression/questMutateCache.js';
import { mutationLine } from '../../src/progression/questReport.js';

declare module '@vitest/runner' {
  interface TaskMeta {
    /** Read by tests/timingReporter.ts (R14). */
    questMutateCache?: { source: 'hit' | 'miss' | 'off'; fp12: string; wallS: number; jobs: number };
  }
}

describe('questMutate: the real world (npm run quest -- --mutate)', async () => {
  const suite = await mutationSuite({ kind: 'repo', root: process.cwd() }, { by: 'test' });
  const all = suite.plain;
  console.log(`cache ${suite.source === 'hit' ? 'hit' : 'miss'} ${suite.fp12}: `
    + (suite.source === 'hit' ? `audited ${suite.audit.light} light + ${suite.audit.heavy} heavy jobs` : 'live run')
    + ` (${Math.round(suite.wallS)} s, ${suite.workers} workers; results sha256 plain ${sha256(canonicalJson(suite.plain)).slice(0, 12)}`
    + ` strict ${sha256(canonicalJson(suite.strict)).slice(0, 12)})`);

  it('every element is caught or reported (non-load-bearing or pending)', ({ task }) => {
    task.meta.questMutateCache = { source: suite.source, fp12: suite.fp12, wallS: Math.round(suite.wallS), jobs: suite.workers };
    const missed = all.filter((m) => !m.caught && m.nonLoadBearing === undefined);
    expect(missed.map((m) => `${m.row} ${m.element}`)).toEqual([]);
    expect(mutationLine(all)).toMatch(/^mutations: OK {2}\(/);
  });

  it('GT-1: the act-1 bridge gate cells are S0\'s non-load-bearing entries; GT-12 (the canal) is caught now that EARTH is built', () => {
    expect(all.filter((m) => m.row === 'GT-1').map((m) => m.nonLoadBearing)).toEqual([
      'redundant with north_bridge; the gap is water without the flag', 'redundant with north_bridge; the gap is water without the flag']);
    // INT-W2c: every region is built, so no row is pending any more
    expect(all.find((m) => m.row === 'GT-12')?.caught).toBe(true);
  });

  it('act 1\'s generic elements are caught: the King and the princess wait for Garland, the ship spawn needs its flag', () => {
    const caught = all.filter((m) => m.row.startsWith('G ') && m.caught).map((m) => m.element);
    expect(caught).toEqual(expect.arrayContaining([expect.stringMatching(/npc king needs PRINCESS_RESCUED/),
      expect.stringMatching(/npc princess needs PRINCESS_RESCUED/)]));
  });

  it('no row is pending any more, so --strict reports every element too (INT)', () => {
    expect(all.filter((m) => m.nonLoadBearing?.startsWith('pending')).map((m) => `${m.row} ${m.element}`)).toEqual([]);
    expect(suite.strict.filter((m) => !m.caught && m.nonLoadBearing === undefined).map((m) => `${m.row} ${m.element}`)).toEqual([]);
  });
});
