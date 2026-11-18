/**
 * S28 balance (docs/WORLD_PLAN.md 3.7; WND-D2): the Hollow Seraph of sky-castle-5f's spire with the whirlwind the wind
 * crystal coughs out (the battle `[hollow_seraph, air_elemental]`), and the rare Warmech of 4F's engine halls with the
 * whirlwind its fans draw in (the zone `wnd_d2_engine`'s 1-in-64 formation `[warmech, air_elemental]`), against the
 * upgraded Knight / Ninja / White Wizard / Black Wizard party (QUEST open question 3, from S20 on) with the stage kit
 * `w_s28` (the B7 Gaia tier) and 3 potions, on the real `BattleStateMachine` (400 seeds per policy, `bossWinRate`;
 * enemy spells and specials are not simulated, as in every balance test).
 *
 * The tuning is WND-D2's (enemies.yaml: only `bossPhases`): the seraph's roster swing (4 hits at attack 49) fell to
 * the B7 party every time (measured 100 % at L30-L34), so she wakes with 6 hits at attack 78 (a phase from full HP)
 * and the whirlwind beside her. The Warmech's roster numbers alone gave a flat level curve (L30 53.0 %, L32 62.0 %),
 * so it wakes throttled (2 hits at attack 103, from 128) and its whirlwind steepens the curve. Targets: seraph L32
 * sensible 60-80 %, L30 at most 45 %; Warmech L32 55-80 %, L30 at most 40 %. Each bound sits at least 3 points from
 * its measured value, given in the test name.
 */
import { describe, expect, it } from 'vitest';
import { bossWinRate, UPGRADED_PARTY } from '../helpers/balanceData.js';

const SERAPH = ['hollow_seraph', 'air_elemental'];
const WARMECH = ['warmech', 'air_elemental'];
const N = 400;
const opts = { comp: UPGRADED_PARTY };

describe('w_wnd_d2: the Hollow Seraph and her whirlwind (S28, kit w_s28)', () => {
  it('sensible Lv32 wins 60-80 % (measured 69.0)', () => {
    const r = bossWinRate(SERAPH, 32, 'w_s28', 'sensible', N, opts);
    expect(r).toBeGreaterThanOrEqual(0.6);
    expect(r).toBeLessThanOrEqual(0.8);
  });

  it('sensible Lv30 wins at most 45 % (measured 39.5)', () => {
    expect(bossWinRate(SERAPH, 30, 'w_s28', 'sensible', N, opts)).toBeLessThanOrEqual(0.45);
  });

  it('sensible Lv34, the band top, wins >= 85 % (measured 89.8)', () => {
    expect(bossWinRate(SERAPH, 34, 'w_s28', 'sensible', N, opts)).toBeGreaterThanOrEqual(0.85);
  });
});

describe('w_wnd_d2: the Warmech of the engine halls (S28 rare formation, kit w_s28)', () => {
  it('sensible Lv32 wins 55-80 % (measured 58.8)', () => {
    const r = bossWinRate(WARMECH, 32, 'w_s28', 'sensible', N, opts);
    expect(r).toBeGreaterThanOrEqual(0.55);
    expect(r).toBeLessThanOrEqual(0.8);
  });

  it('sensible Lv30 wins at most 40 % (measured 36.0)', () => {
    expect(bossWinRate(WARMECH, 30, 'w_s28', 'sensible', N, opts)).toBeLessThanOrEqual(0.4);
  });
});
