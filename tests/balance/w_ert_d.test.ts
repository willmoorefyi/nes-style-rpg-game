/**
 * S11 and S13 boss balance (docs/WORLD_PLAN.md 3.7; ERT-D): the Vampire of the Cavern of Earth B3 with his three
 * mummies (the cavern-earth-b3 battle `[vampire, mummy, mummy, mummy]`), and the Rime Sovereign (`lich`) on the frost
 * throne of B5 with his two earth elementals (`[lich, earth_elemental, earth_elemental]`), against a Warrior / Thief /
 * White Mage / Black Mage party with the stage kits `w_s11` and `w_s13` (both the B4 Melmond tier) and 3 potions, on
 * the real `BattleStateMachine` (400 seeds per policy, `bossWinRate`).
 *
 * The tuning is ERT-D's (enemies.yaml: only the two bosses' `bossPhases`, plus the formations on the maps). Alone,
 * both tuned records fell in two or three rounds at every band level (measured 100 % at L12-L19). Now the Vampire
 * has a phase at threshold 1 (crossed at the first round: 4 hits at attack 90), the Rime Sovereign one at 0.99 (his
 * first wound cracks his skull: 4 hits at attack 90), and the guards draw the party's blows first. Targets: vampire L14 75-95 %, L12 at most 60 %; lich L17
 * 60-80 %, L15 at most 45 %. Each bound sits at least 3 points from its measured value, given in the test name.
 */
import { describe, expect, it } from 'vitest';
import { bossWinRate } from '../helpers/balanceData.js';

const VAMPIRE = ['vampire', 'mummy', 'mummy', 'mummy'];
const LICH = ['lich', 'earth_elemental', 'earth_elemental'];
const N = 400;

describe('w_ert_d: the Vampire and his mummies (S11, kit w_s11)', () => {
  it('sensible Lv14 wins 75-95 % (measured 79.3)', () => {
    const r = bossWinRate(VAMPIRE, 14, 'w_s11', 'sensible', N);
    expect(r).toBeGreaterThanOrEqual(0.75);
    expect(r).toBeLessThanOrEqual(0.95);
  });

  it('sensible Lv12 wins at most 60 % (measured 50.8)', () => {
    expect(bossWinRate(VAMPIRE, 12, 'w_s11', 'sensible', N)).toBeLessThanOrEqual(0.6);
  });

  it('sensible Lv16, the band top, wins >= 85 % (measured 90.5)', () => {
    expect(bossWinRate(VAMPIRE, 16, 'w_s11', 'sensible', N)).toBeGreaterThanOrEqual(0.85);
  });
});

describe('w_ert_d: the Rime Sovereign and the earth elementals (S13, kit w_s13)', () => {
  it('sensible Lv17 wins 60-80 % (measured 69.8)', () => {
    const r = bossWinRate(LICH, 17, 'w_s13', 'sensible', N);
    expect(r).toBeGreaterThanOrEqual(0.6);
    expect(r).toBeLessThanOrEqual(0.8);
  });

  it('sensible Lv15 wins at most 45 % (measured 14.8)', () => {
    expect(bossWinRate(LICH, 15, 'w_s13', 'sensible', N)).toBeLessThanOrEqual(0.45);
  });

  it('sensible Lv19, the band top, wins >= 85 % (measured 91.3)', () => {
    expect(bossWinRate(LICH, 19, 'w_s13', 'sensible', N)).toBeGreaterThanOrEqual(0.85);
  });
});
