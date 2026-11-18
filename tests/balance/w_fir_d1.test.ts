/**
 * S15 boss balance (docs/WORLD_PLAN.md 3.7; FIR-D1): the Ashen Queen of gurgu-b5's ash court with the fire lizard that
 * crawls from the altar's coals (the battle `[ashen_queen, fire_lizard]`), against a Warrior / Thief / White Mage /
 * Black Mage party with the stage kit `w_s15` (the B5 Crescent Lake tier) and 3 potions, on the real
 * `BattleStateMachine` (400 seeds per policy, `bossWinRate`; enemy spells are not simulated, as in every balance test).
 *
 * The tuning is FIR-D1's (enemies.yaml: only the queen's `bossPhases`): her roster stats (600 HP, six hits at attack
 * 40) fell to the B5 party at every band level (measured 100 % at L21-L25, alone), so she wakes already burning (a
 * phase from full HP: six hits at attack 61) and the lizard adds its two bites a turn. Target (3.7): L23 sensible
 * 60-80 %, and L21 at most 45 %. Each bound sits at least 3 points from its measured value, given in the test name.
 */
import { describe, expect, it } from 'vitest';
import { bossWinRate } from '../helpers/balanceData.js';

const FIGHT = ['ashen_queen', 'fire_lizard'];
const N = 400;

describe('w_fir_d1: the Ashen Queen and her salamander (S15, kit w_s15)', () => {
  it('sensible Lv23 wins 60-80 % (measured 64.0)', () => {
    const r = bossWinRate(FIGHT, 23, 'w_s15', 'sensible', N);
    expect(r).toBeGreaterThanOrEqual(0.6);
    expect(r).toBeLessThanOrEqual(0.8);
  });

  it('sensible Lv21, the band low, wins at most 45 % (measured 40.8)', () => {
    expect(bossWinRate(FIGHT, 21, 'w_s15', 'sensible', N)).toBeLessThanOrEqual(0.45);
  });

  it('sensible Lv24, the band top, wins >= 65 % (measured 70.0)', () => {
    expect(bossWinRate(FIGHT, 24, 'w_s15', 'sensible', N)).toBeGreaterThanOrEqual(0.65);
  });
});
