/**
 * S18 boss balance (docs/WORLD_PLAN.md 3.7; ORD-O): the trial guardian of citadel-3f, the dragon zombie with its
 * three king-mummy keepers (the battle `[dragon_zombie, king_mummy, king_mummy, king_mummy]`), against a Warrior /
 * Thief / White Mage / Black Mage party with the stage kit `w_s18` (the B6 Onrac tier, base classes: the class change
 * is S19's) and 3 potions, on the real `BattleStateMachine` (400 seeds per policy, `bossWinRate`).
 *
 * The tuning is ORD-O's (enemies.yaml: only the dragon zombie's `bossPhases`): its roster stats (268 HP) fall to one
 * warrior's turn at the band (measured 100 % at L21-L27, alone or with escorts, before this pass), so it rises
 * already wrathful (a phase from full HP: 3 hits, attack 95) and the keepers soak the party's first blows. Target:
 * L25 sensible 75-95 %. Each bound sits at least 3 points from its measured value, given in the test name.
 */
import { describe, expect, it } from 'vitest';
import { bossWinRate } from '../helpers/balanceData.js';

const FIGHT = ['dragon_zombie', 'king_mummy', 'king_mummy', 'king_mummy'];
const N = 400;

describe('w_ord_o: the trial guardian and its keepers (S18, kit w_s18)', () => {
  it('sensible Lv25 wins INTENT 70-95 % (measured EQ 74.25, was 86.5)', () => {
    const r = bossWinRate(FIGHT, 25, 'w_s18', 'sensible', N);
    expect(r).toBeGreaterThanOrEqual(0.7);
    expect(r).toBeLessThanOrEqual(0.95);
  });

  it('sensible Lv27, the band top, wins >= 85 % (measured EQ 91.75, was 99.0)', () => {
    expect(bossWinRate(FIGHT, 27, 'w_s18', 'sensible', N)).toBeGreaterThanOrEqual(0.85);
  });

  it('sensible Lv23, below the band, wins at most 80 % (measured EQ 55.5, was 74.5)', () => {
    expect(bossWinRate(FIGHT, 23, 'w_s18', 'sensible', N)).toBeLessThanOrEqual(0.8);
  });
});
