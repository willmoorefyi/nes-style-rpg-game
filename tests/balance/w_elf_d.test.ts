/**
 * S5 boss balance (docs/WORLD_PLAN.md 3.7; ELF-D): the Marsh Cave's guard, three piscodemons (the marsh-cave-b3
 * battle `[piscodemon x3]`), against a Warrior / Thief / White Mage / Black Mage party with the stage kit `w_s5` (the
 * B3 Elfheim tier) and 3 potions, on the real `BattleStateMachine` (400 seeds per policy, `bossWinRate`).
 *
 * The tuning is ELF-D's (enemies.yaml: only the piscodemon's `bossPhases`). With the roster's numbers (attack 30, 2
 * hits) the three fell too easily (L7 87.3 %, L9 97.8 %), and a phase after the first wound barely moved it (a
 * piscodemon often dies to its first hit). The keepers now wake roused: a phase at full HP (hpThreshold 1.0, crossed
 * at the first round start) sets attack 36. Targets: L9 sensible 75-95 %, L7 at most 60 %. Each bound sits at least 3
 * points from its measured value, given in the test name.
 */
import { describe, expect, it } from 'vitest';
import { bossWinRate } from '../helpers/balanceData.js';

const FIGHT = ['piscodemon', 'piscodemon', 'piscodemon'];
const N = 400;

describe('w_elf_d: the Marsh Cave guard (S5, kit w_s5)', () => {
  it('sensible Lv9 wins 75-95 % (measured EQ 86.25, was 83.5)', () => {
    const r = bossWinRate(FIGHT, 9, 'w_s5', 'sensible', N);
    expect(r).toBeGreaterThanOrEqual(0.75);
    expect(r).toBeLessThanOrEqual(0.95);
  });

  it('sensible Lv7 wins at most 60 % (measured EQ 56.5, was 53.5)', () => {
    expect(bossWinRate(FIGHT, 7, 'w_s5', 'sensible', N)).toBeLessThanOrEqual(0.6);
  });

  it('sensible Lv11, the band top, wins >= 90 % (measured EQ 99, was 99.8)', () => {
    expect(bossWinRate(FIGHT, 11, 'w_s5', 'sensible', N)).toBeGreaterThanOrEqual(0.9);
  });
});
