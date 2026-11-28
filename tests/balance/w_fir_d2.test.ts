/**
 * S16 boss balance (docs/WORLD_PLAN.md 3.7; FIR-D2): the Ice Cavern's eye, `[evil_eye, ice_gigas, dark_wizard x2]`
 * (the ice-cavern-b3 battle), against a Warrior / Thief / White Mage / Black Mage party with the stage kit `w_s16`
 * (the B5 Crescent tier) and 3 potions, on the real `BattleStateMachine` (400 seeds per policy, `bossWinRate`).
 *
 * The tuning is FIR-D2's (enemies.yaml: only the evil_eye's `bossPhases`; the formation is the map's). With the
 * roster's numbers the eye (162 HP, agility 7) fell before it acted: 100 % at L18-L24, alone or with any escort. The
 * eye now wakes glaring (a phase at full HP, crossed at the first round start: hits 3, attack 100), and its warden and
 * two rime-seers stand in front of it (the sensible policy strikes the weakest first, so the eye gets its turns).
 * Target: L22 sensible 70-90 %. Each bound sits at least 3 points from its measured value, given in the test name.
 */
import { describe, expect, it } from 'vitest';
import { bossWinRate } from '../helpers/balanceData.js';

const FIGHT = ['evil_eye', 'ice_gigas', 'dark_wizard', 'dark_wizard'];
const N = 400;

describe('w_fir_d2: the eye of the Ice Cavern (S16, kit w_s16)', () => {
  it('sensible Lv22 wins 70-90 % (measured EQ 79.5, was 80.0)', () => {
    const r = bossWinRate(FIGHT, 22, 'w_s16', 'sensible', N);
    expect(r).toBeGreaterThanOrEqual(0.7);
    expect(r).toBeLessThanOrEqual(0.9);
  });

  it('sensible Lv20 wins at most INTENT 70 % (measured EQ 66.75, was 60.3)', () => {
    expect(bossWinRate(FIGHT, 20, 'w_s16', 'sensible', N)).toBeLessThanOrEqual(0.7);
  });

  it('sensible Lv24, the band top, wins >= 85 % (measured EQ 92.5, was 88.8)', () => {
    expect(bossWinRate(FIGHT, 24, 'w_s16', 'sensible', N)).toBeGreaterThanOrEqual(0.85);
  });
});
