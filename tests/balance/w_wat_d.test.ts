/**
 * S24 boss balance (docs/WORLD_PLAN.md 3.7; WAT-D): the Drowned Sovereign alone on sea-shrine-b5's throne, against the
 * upgraded party (Knight / Ninja / White Wizard / Black Wizard, `UPGRADED_PARTY`: the boss tests use it from S20 on)
 * with the stage kit `w_s24` (the B7 Gaia tier) and 3 potions, on the real `BattleStateMachine` (400 seeds,
 * `bossWinRate`).
 *
 * The tuning is WAT-D's (enemies.yaml: only the sovereign's `bossPhases`). With the roster's numbers (800 HP, attack
 * 50 on 8 hits) he fell every time at L26-L30. He now wakes at full strength: a phase at hpThreshold 1.0 (crossed at
 * the first round start) sets attack 75; the 50 % phase (the heavy attack) is unchanged. Targets: L28 sensible
 * 60-80 %, L26 at most 45 %. Each bound sits at least 3 points from its measured value, given in the test name.
 */
import { describe, expect, it } from 'vitest';
import { bossWinRate, UPGRADED_PARTY } from '../helpers/balanceData.js';

const FIGHT = ['drowned_sovereign'];
const N = 400;
const opts = { comp: UPGRADED_PARTY };

describe('w_wat_d: the Drowned Sovereign (S24, kit w_s24)', () => {
  it('sensible Lv28 wins 60-80 % (measured 71.5)', () => {
    const r = bossWinRate(FIGHT, 28, 'w_s24', 'sensible', N, opts);
    expect(r).toBeGreaterThanOrEqual(0.6);
    expect(r).toBeLessThanOrEqual(0.8);
  });

  it('sensible Lv26 wins at most 45 % (measured 38.0)', () => {
    expect(bossWinRate(FIGHT, 26, 'w_s24', 'sensible', N, opts)).toBeLessThanOrEqual(0.45);
  });

  it('sensible Lv32, above the band, wins >= 85 % (measured 91.3)', () => {
    expect(bossWinRate(FIGHT, 32, 'w_s24', 'sensible', N, opts)).toBeGreaterThanOrEqual(0.85);
  });
});
