/**
 * S6 boss balance (docs/WORLD_PLAN.md 3.7; ELF-O): Astos, the false king of the Western Keep, with his three gargoyle
 * sentinels (the western-keep-2f battle `[astos, gargoyle, gargoyle, gargoyle]`), against a Warrior / Thief / White
 * Mage / Black Mage party with the stage kit `w_s6` (the B3 Elfheim tier) and 3 potions, on the real
 * `BattleStateMachine` (400 seeds per policy, `bossWinRate`).
 *
 * The tuning is ELF-O's (enemies.yaml: only Astos's `bossPhases`): his stats are the roster's (168 HP), so alone he
 * falls in a round at any band level (measured 100 % at L3-L13 before this pass). His first wound now breaks the
 * king's shape and he claws (3 hits, attack 42), and the sentinels share the fight. Targets: L11 sensible 65-85 %,
 * L9 at most 50 %. Each bound sits at least 3 points from its measured value, given in the test name.
 */
import { describe, expect, it } from 'vitest';
import { bossWinRate } from '../helpers/balanceData.js';

const FIGHT = ['astos', 'gargoyle', 'gargoyle', 'gargoyle'];
const N = 400;

describe('w_elf_o: Astos and the sentinels (S6, kit w_s6)', () => {
  it('sensible Lv11 wins 65-85 % (measured EQ 72.75, was 78.5)', () => {
    const r = bossWinRate(FIGHT, 11, 'w_s6', 'sensible', N);
    expect(r).toBeGreaterThanOrEqual(0.65);
    expect(r).toBeLessThanOrEqual(0.85);
  });

  it('sensible Lv9 wins at most 50 % (measured EQ 39.25, was 27.3)', () => {
    expect(bossWinRate(FIGHT, 9, 'w_s6', 'sensible', N)).toBeLessThanOrEqual(0.5);
  });

  it('sensible Lv13, the band top, wins >= 85 % (measured EQ 97.25, was 95.0)', () => {
    expect(bossWinRate(FIGHT, 13, 'w_s6', 'sensible', N)).toBeGreaterThanOrEqual(0.85);
  });
});
