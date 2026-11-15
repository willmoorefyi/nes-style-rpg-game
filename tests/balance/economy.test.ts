/**
 * Item 1 of docs/FEEDBACK_PLAN_2026-11-14.md (§3.1, decision FB-1): the act-1 battles pay enough gold that a party
 * reaching Lv 2 on its first try can buy a 100 G spell, even after one inn stay and one potion (90 G).
 *
 * The model is the `fieldPacing` campaign (`fieldCampaign.ts`: 200 seeded campaigns, the 400 G kit, sensible play,
 * its inn rule) with shopping disabled until the whole party is Lv 2. "Gold in hand" is the gold at the end of the
 * battle in which the last member reaches Lv 2, after that battle's reward and inn rule: what the player can spend.
 *
 * Measured (200 runs) with the FF1 gold (goblin 6, wolf 6, gr_imp 18, skeleton 3, gr_wolf 22) as "old" and the FB-1
 * gold (12 / 12 / 30 / 10 / 44) as "new". Every bound sits at least 3 points from the new value and fails the old one.
 */
import { describe, it, expect } from 'vitest';
import { campaign, median, percentile, RUNS } from './fieldCampaign.js';

const runs = Array.from({ length: RUNS }, (_, i) => campaign(i + 1, { noShopBeforeL2: true }));
const goldAtL2 = runs.map((r) => r.goldAtL2 ?? -1);

describe('Item 1: gold in hand at whole-party Lv 2 (fieldPacing model, no shopping before Lv 2)', () => {
  it('every run reaches whole-party Lv 2, in a median of 4-10 battles (new 5; old 5: XP is unchanged)', () => {
    expect(goldAtL2.filter((g) => g < 0)).toHaveLength(0);
    const l2 = median(runs.map((r) => r.reachedAt[2]));
    expect(l2).toBeGreaterThanOrEqual(4);
    expect(l2).toBeLessThanOrEqual(10);
  });

  it('the median gold in hand is >= 220 G (new 246; old 144)', () => {
    expect(median(goldAtL2)).toBeGreaterThanOrEqual(220);
  });

  it('the p10 gold in hand is >= 150 G (new 174; old 102)', () => {
    expect(percentile(goldAtL2, 0.1)).toBeGreaterThanOrEqual(150);
  });

  it('>= 75 % of runs hold >= 190 G, a 100 G spell after one inn and one potion (new 81.5 %; old 4.5 %)', () => {
    expect(goldAtL2.filter((g) => g >= 190).length / RUNS).toBeGreaterThanOrEqual(0.75);
  });
});
