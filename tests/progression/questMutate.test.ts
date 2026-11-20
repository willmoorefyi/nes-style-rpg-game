/**
 * The no-skip mutation suite (docs/WORLD_PLAN.md 6.3, docs/QUEST_PLAN.md 5.4): every gate-table row GT-1 to GT-37
 * (with GT-5b) on the mini world, by name, with its expected proof and message prefix; the non-load-bearing rows
 * with their reasons; and a RED run (an uncaught element without a `nonLoadBearing` entry fails). The real world
 * (`npm run quest -- --mutate`) is questMutateWorld.test.ts, in the heavy tier (tests/tiers.ts).
 */
import { describe, expect, it } from 'vitest';
import type { MutationResult } from '../../src/progression/questTypes.js';
import { createQuestContext } from '../../src/progression/questProofs.js';
import { runCoreProofs, mutationLine } from '../../src/progression/questReport.js';
import { runGateRows } from '../../src/progression/questMutate.js';
import { GATE_ROWS } from '../../src/progression/questMutateRows.js';
import { proofEarlyShops } from '../../src/progression/questShops.js';
import { proofTravel } from '../../src/progression/questTravel.js';
import { editQuest } from '../../src/progression/questMutateOps.js';
import { attachLate, buildLateData } from '../../src/progression/questLateData.js';
import { MINI_LATE, miniContext } from './miniWorld.js';

const ctx = miniContext();
const rows = runGateRows(ctx);
const byRow = (id: string): MutationResult[] => rows.filter((m) => m.row === id);
const messages = (id: string): string[] => byRow(id).flatMap((m) => m.failures.map((f) => f.message));

/** The plan's catch per row: each element of the row must be caught with a failure starting with every prefix. */
const CAUGHT: Record<string, string[]> = {
  'GT-2': ['SKIP S2 ', 'EARLY pravoka '], 'GT-3': ['SKIP S4 '], 'GT-5b': ['ORDER goal '],
  'GT-7': ['SKIP S6 '], 'GT-8': ['SKIP S7 '], 'GT-9': ['SKIP S8 '], 'GT-10': ['SKIP S9 '], 'GT-11': ['SKIP S10 '],
  'GT-12': ['SKIP S11 ', 'EARLY melmond ', 'EARLY crescent '], 'GT-13': ['SKIP S11 ', 'EARLY melmond '],
  'GT-15': ['SKIP S12 '], 'GT-17': ['SKIP S13 '], 'GT-19': ['SKIP S14 '], 'GT-20': ['EARLY crescent talkable before S13'],
  'GT-22': ['SKIP S17 '], 'GT-23': ['SKIP S18 '], 'GT-24': ['SKIP S19 '], 'GT-26': ['SKIP S23 '], 'GT-27': ['SKIP S24 '],
  'GT-28': ['SKIP S25 '], 'GT-29': ['SKIP S26 '], 'GT-30': ['EARLY lufenia '], 'GT-31': ['SKIP S27 '], 'GT-32': ['SKIP S27 '],
  'GT-34': ['MILESTONE S30 '], 'GT-35': ['SKIP S12 '], 'GT-36': ['SKIP S12 '], 'GT-37': ['SKIP S15 ', 'SKIP S16 '],
};

describe('questMutate: the mini world is clean', () => {
  it('passes (a)-(c), (e) and (h) unmutated', () => {
    for (const p of [...runCoreProofs(ctx), proofEarlyShops(ctx), proofTravel(ctx)]) expect(p.failures, p.line).toEqual([]);
  });

  it('every gate-table row is present, and every element has a result', () => {
    const ids = [...new Set(GATE_ROWS.map((r) => r.row))];
    expect(ids).toHaveLength(38);
    expect(ids).toContain('GT-5b');
    for (const id of ids) expect(byRow(id).length, id).toBeGreaterThan(0);
  });
});

describe('questMutate: each row is caught by its named proof (WORLD 6.3)', () => {
  for (const [row, prefixes] of Object.entries(CAUGHT)) {
    it(`${row} is caught: ${prefixes.join(' + ')}`, () => {
      for (const m of byRow(row)) {
        expect(m.caught, `${row} ${m.element}: ${m.failures.map((f) => f.message).join('; ')}`).toBe(true);
        for (const p of prefixes) expect(m.failures.some((f) => f.message.startsWith(p)), `${row} ${m.element} lacks ${p}`).toBe(true);
      }
    });
  }

  it('GT-4: removing the Pravoka dock strands the party in Elfland (a soft-lock or the goal unreachable)', () => {
    expect(byRow('GT-4')[0].caught).toBe(true);
    expect(messages('GT-4').some((m) => m.startsWith('SOFTLOCK ') || m.startsWith('ORDER goal '))).toBe(true);
  });

  it('GT-5b fails on (a) only (no dock-presence error)', () => {
    expect(byRow('GT-5b')[0].failures.map((f) => f.proof)).toEqual(expect.arrayContaining(['a']));
    expect(messages('GT-5b').some((m) => m.startsWith('DOCK'))).toBe(false);
  });

  it('GT-13 opens each of the five Aldi walls separately', () => {
    expect(byRow('GT-13').map((m) => m.element.split(': ')[1].split(' ')[1])).toEqual(['W_west', 'W_isthmus', 'W_arm', 'W_south', 'W_east']);
  });

  it('GT-18: withholding the seal keeps EARTH_CAVE_COMPLETE unreachable', () => {
    expect(byRow('GT-18')).toEqual([expect.objectContaining({ caught: true, failures: [] })]);
  });

  it('GT-21: each river mouth cut skips the canoe (SKIP S15 or S16); GT-25: the waterfall cut fails T6b', () => {
    expect(byRow('GT-21')).toHaveLength(2);
    for (const m of byRow('GT-21')) expect(m.caught).toBe(true);
    expect(byRow('GT-25')[0].caught).toBe(true);
    expect(messages('GT-25').some((m) => m.startsWith('SKIP S21 ') || m === 'TRAVEL T6b reaches wat_waterfall')).toBe(true);
  });

  it('GT-33: each crystal flag; EARTH_CRYSTAL_LIT is excused by S29\'s nonLoadBearing (it already gates the canoe)', () => {
    const flags = byRow('GT-33').filter((m) => m.element.includes('needs '));
    expect(flags).toHaveLength(4);
    for (const m of flags) {
      if (m.element.includes('EARTH_CRYSTAL_LIT')) expect(m.nonLoadBearing).toMatch(/gates the canoe/);
      else expect(m.failures.some((f) => f.message.startsWith('SKIP S29 ')), m.element).toBe(true);
    }
  });
});

describe('questMutate: non-load-bearing rows (GT-1, GT-5, GT-6, GT-14, GT-16, the lute of GT-33)', () => {
  it('each is caught or carries its stage\'s nonLoadBearing reason', () => {
    for (const id of ['GT-1', 'GT-5', 'GT-6', 'GT-14', 'GT-16']) {
      for (const m of byRow(id)) expect(m.caught || m.nonLoadBearing !== undefined, `${id} ${m.element}`).toBe(true);
    }
    expect(byRow('GT-1').map((m) => m.nonLoadBearing)).toEqual(expect.arrayContaining([expect.stringMatching(/holds the crossing/)]));
    expect(byRow('GT-5')[0].nonLoadBearing).toMatch(/on foot from ert_dwarf/);
    expect(byRow('GT-14')[0].nonLoadBearing).toMatch(/on foot from Elfland/);
  });

  it('RED: without its nonLoadBearing entry an uncaught gate fails the run', () => {
    const w = editQuest(ctx.world, (q) => { q.stages.find((s) => s.id === 'S4')!.nonLoadBearing = []; });
    const red = attachLate(createQuestContext(w), buildLateData(MINI_LATE));
    const r = runGateRows(red, new Set(['GT-5']));
    expect(r[0]).toMatchObject({ caught: false });
    expect(r[0].nonLoadBearing).toBeUndefined();
    expect(mutationLine(r)).toBe('mutations: FAIL  (1 of 1 elements not caught)');
  });
});
