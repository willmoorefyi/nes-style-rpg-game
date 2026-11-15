/**
 * T4d field pacing (docs/FIX_PLAN_PENINSULA.md T4 §3, §4.4, §4.5; EB-3): the seeded campaign of `fieldCampaign.ts`
 * (the 400 G kit; 20 fields, 10 temple-approach and 10 temple battles, sensible play, the inn rule, shopping at the
 * inn, at each zone boundary and after the last battle).
 *
 * Pass F item 1 (docs/FEEDBACK_PLAN_2026-11-14.md §3.1, FB-1) doubled the act-1 gold. The mean gold after 40 battles
 * was 272.9 G with the FF1 gold (old) and is 1183.5 G with the FB-1 gold (new); the bound is new ± 25 %, rounded
 * outwards (885-1480 G), and fails the old data.
 */
import { describe, it, expect } from 'vitest';
import { campaign, median, RUNS, SHOPPING, START_GOLD, START_KIT_COST } from './fieldCampaign.js';

const runs = Array.from({ length: RUNS }, (_, i) => campaign(i + 1));

describe('T4d field pacing (seeded campaign, §4.5)', () => {
  it('the whole party reaches Lv2 within battles 4-10 and Lv3 within 15-35 (median), and every run reaches Lv3', () => {
    const l2 = runs.map((r) => r.reachedAt[2] ?? Infinity);
    const l3 = runs.map((r) => r.reachedAt[3] ?? Infinity);
    expect(median(l2)).toBeGreaterThanOrEqual(4);
    expect(median(l2)).toBeLessThanOrEqual(10);
    expect(median(l3)).toBeGreaterThanOrEqual(15);
    expect(median(l3)).toBeLessThanOrEqual(35);
    expect(l3.filter((b) => b === Infinity), 'runs that never reach Lv3 in 40 battles').toHaveLength(0);
  });

  // §4.5 asks for < 0.2 wipes per run; the measured rate is 0 in all 200 runs, so the bound sits near it (at most 2
  // wipes in 200 runs) to catch a regression in enemy damage or in the inn rule.
  it('wipes at most 0.01 times per 40-battle run (§4.5: < 0.2; measured 0)', () => {
    expect(START_KIT_COST).toBeLessThanOrEqual(START_GOLD);
    expect(runs.reduce((s, r) => s + r.wipes, 0) / RUNS).toBeLessThanOrEqual(0.01);
  });

  it('leaves 885-1480 G after 40 battles on average (new 1183.5; old 272.9), with at least 7 of the 8 full-kit purchases made (8)', () => {
    const gold = runs.reduce((s, r) => s + r.gold, 0) / RUNS;
    expect(gold).toBeGreaterThanOrEqual(885);
    expect(gold).toBeLessThanOrEqual(1480);
    expect(runs.reduce((s, r) => s + r.bought, 0) / RUNS).toBeGreaterThanOrEqual(SHOPPING.length - 1);
  });
});
