/**
 * S2 boss balance (docs/WORLD_PLAN.md 3.7; A1-T): Captain Bikke's crew, `pirate` x9 (the scripted fight at
 * Pravoka's brig pier), against a Warrior / Thief / White Mage / Black Mage party with the stage kit `w_s2` and 3
 * potions, on the real `BattleStateMachine` (400 seeds per policy, `bossWinRate`). Since PT-2
 * (docs/PLAYTEST_ELFHEIM_PLAN.md) Pravoka's shops are shut until Bikke is beaten, so `w_s2` is Cornelia's kit (`w_s1`);
 * re-measured with it: still 100.0 for every case.
 *
 * The pirates keep their tuned roster numbers (6 HP each, attack 8; enemies.yaml, A1-T anchor): the fight is the
 * classic's crowd of weak blades, a test of a party in Cornelia's gear rather than a wall. Targets: L4
 * sensible at least 95 %, careless at least 85 %. Each bound sits at least 3 points from its measured value, given in
 * the test name.
 */
import { describe, expect, it } from 'vitest';
import { bossWinRate } from '../helpers/balanceData.js';

const FIGHT = Array<string>(9).fill('pirate');
const N = 400;

describe('w_a1_t: Bikke\'s nine pirates (S2, kit w_s2)', () => {
  it('sensible Lv4 wins >= 95 % (measured EQ 100, was 100.0)', () => {
    expect(bossWinRate(FIGHT, 4, 'w_s2', 'sensible', N)).toBeGreaterThanOrEqual(0.95);
  });

  it('careless Lv4 wins >= 85 % (measured EQ 100, was 100.0)', () => {
    expect(bossWinRate(FIGHT, 4, 'w_s2', 'careless', N)).toBeGreaterThanOrEqual(0.85);
  });

  it('sensible Lv3, the band\'s low end, wins >= 95 % (measured EQ 100, was 100.0)', () => {
    expect(bossWinRate(FIGHT, 3, 'w_s2', 'sensible', N)).toBeGreaterThanOrEqual(0.95);
  });
});
