/**
 * Item 1 of docs/FEEDBACK_PLAN_2026-11-14.md (§3.1, decision FB-1): the act-1 battles pay enough gold that a party
 * reaching Lv 2 on its first try can buy a 100 G spell, even after one inn stay and one potion (90 G).
 *
 * The model is the `fieldPacing` campaign (`fieldCampaign.ts`: 200 seeded campaigns, the 400 G kit, sensible play,
 * its inn rule) with shopping disabled until the whole party is Lv 2. "Gold in hand" is the gold at the end of the
 * battle in which the last member reaches Lv 2, after that battle's reward and inn rule: what the player can spend.
 *
 * Three routes: the default schedule (fields, then the temple approach), the temple approach only, and the
 * approach's wolf-only formations (the final play test: wolves give 24 XP each, so the party hit Lv 2 in 3 battles
 * holding 126 G). The play-test fix makes act-1 gold proportionate to XP (wolf 12 -> 26 G, gr_wolf 44 -> 100 G).
 *
 * Measured (200 runs), "FB-1" = goblin 12, wolf 12, gr_imp 30, skeleton 10, gr_wolf 44; "now" = wolf 26, gr_wolf 100:
 *
 * | route          | median FB-1 / now | p10 FB-1 / now | >= 190 G FB-1 / now | median battles to Lv 2 |
 * | default        | 246 / 304         | 174 / 250      | 81.5 % / 100 %      | 5                      |
 * | approach only  | 254 / 300         | 180 / 250      | 88.5 % / 100 %      | 4                      |
 * | wolves only    | 126 / 238         | 114 / 212      | 0 % / 100 %         | 3                      |
 *
 * Every bound sits at least 3 points from the new value; the wolf route fails the FB-1 gold.
 */
import { describe, it, expect } from 'vitest';
import { campaign, median, percentile, RUNS, APPROACH_ONLY, type CampaignOptions } from './fieldCampaign.js';

const ROUTES: Array<[string, CampaignOptions['schedule'], string, number]> = [
  ['default (fields, then approach)', undefined, 'median 304, p10 250, 100 %; FB-1 246 / 174 / 81.5 %', 4],
  ['temple approach only', APPROACH_ONLY, 'median 300, p10 250, 100 %; FB-1 254 / 180 / 88.5 %', 3],
  ['wolf-only approach', [['approach_wolves', 20], ['temple', 10]], 'median 238, p10 212, 100 %; FB-1 126 / 114 / 0 %', 2],
];

describe.each(ROUTES)('Item 1: gold in hand at whole-party Lv 2, route %s (no shopping before Lv 2)', (_name, schedule, measured, minL2) => {
  const runs = Array.from({ length: RUNS }, (_, i) => campaign(i + 1, { noShopBeforeL2: true, schedule }));
  const goldAtL2 = runs.map((r) => r.goldAtL2 ?? -1);

  it(`every run reaches whole-party Lv 2, in a median of ${minL2}-10 battles (default 5, approach 4, wolves 3)`, () => {
    expect(goldAtL2.filter((g) => g < 0)).toHaveLength(0);
    const l2 = median(runs.map((r) => r.reachedAt[2]));
    expect(l2).toBeGreaterThanOrEqual(minL2);
    expect(l2).toBeLessThanOrEqual(10);
  });

  it(`median >= 220 G, p10 >= 150 G, >= 75 % of runs hold >= 190 G (${measured})`, () => {
    expect(median(goldAtL2)).toBeGreaterThanOrEqual(220);
    expect(percentile(goldAtL2, 0.1)).toBeGreaterThanOrEqual(150);
    expect(goldAtL2.filter((g) => g >= 190).length / RUNS).toBeGreaterThanOrEqual(0.75);
  });
});
