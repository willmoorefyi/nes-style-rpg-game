/**
 * The no-skip mutation suite on the real world (`npm run quest -- --mutate`, docs/WORLD_PLAN.md 6.3): every element
 * is caught or reported, plain and with --strict. Heavy tier (tests/tiers.ts): each run re-proves the 192x192 world
 * once per element (about half an hour on one worker); the --strict run shares the late data, so it reuses the plain
 * run's mutated checks (Baseline.freshFor) and only its own baseline is re-proved. The gate table's rows by name, on
 * the mini world, are questMutate.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { loadQuestWorld } from '../../src/progression/questData.js';
import { createQuestContext } from '../../src/progression/questProofs.js';
import { mutationLine } from '../../src/progression/questReport.js';
import { runMutations } from '../../src/progression/questMutate.js';
import { attachLate, lateOf } from '../../src/progression/questLateData.js';

describe('questMutate: the real world (npm run quest -- --mutate)', () => {
  const real = createQuestContext(loadQuestWorld());
  const all = runMutations(real);

  it('every element is caught or reported (non-load-bearing or pending)', () => {
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
    const strict = runMutations(attachLate(createQuestContext(real.world, { strict: true }), lateOf(real)));
    expect(strict.filter((m) => !m.caught && m.nonLoadBearing === undefined).map((m) => `${m.row} ${m.element}`)).toEqual([]);
  });
});
