/**
 * T4d Garland balance (docs/FIX_PLAN_PENINSULA.md T4 §3, §4.5, revisions 1 and 12): seeded battles on the real
 * `BattleStateMachine` with the real data. Garland keeps FF1's stats (106 HP, attack 15, one hit), so the targets are
 * FF1's: a sensible Lv2 party wins almost always, careless Lv1 Fight-only play with no gear loses more often than not,
 * and there is no round-count target. Party: Warrior / Thief / White Mage / Black Mage.
 */
import { describe, it, expect } from 'vitest';
import { runBattle, mulberry32, type Policy } from '../helpers/battlePolicies.js';
import { makeParty, enemyCopy, rollFormation, SPELLS, type KitName } from '../helpers/balanceData.js';
import type { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';

const N = 400;

function garlandWinRate(level: number, kit: KitName, policy: Policy, potions: number): number {
  let wins = 0;
  for (let s = 1; s <= N; s++) {
    const rng = mulberry32(s * 7919 + level);
    const party = makeParty(level, kit, policy !== 'careless');
    const r = runBattle(party, [enemyCopy('garland')], SPELLS, policy, rng, { potions: { n: potions } });
    if (r.outcome === 'victory') wins++;
  }
  return wins / N;
}

/** §4.3: `pre` temple battles first (no inn, potions shared), then Garland, sensible play with the full kit. */
function templeRunWinRate(level: number, pre: number): number {
  let wins = 0;
  for (let s = 1; s <= N; s++) {
    const rng = mulberry32(s * 101 + level * 7 + pre);
    const party = makeParty(level, 'full', true);
    const potions = { n: 3 };
    let alive = true;
    for (let b = 0; b < pre && alive; b++) {
      alive = runBattle(party, rollFormation('temple', rng), SPELLS, 'sensible', rng, { potions }).outcome === 'victory';
    }
    if (alive && runBattle(party, [enemyCopy('garland')], SPELLS, 'sensible', rng, { potions }).outcome === 'victory') wins++;
  }
  return wins / N;
}

describe('T4d Garland (FF1 stats; 400 seeded battles per case)', () => {
  it('a sensible Lv2 party wins >= 95 %, with the 400 G kit and with the full kit', () => {
    expect(garlandWinRate(2, 'start', 'sensible', 0)).toBeGreaterThanOrEqual(0.95);
    expect(garlandWinRate(2, 'full', 'sensible', 3)).toBeGreaterThanOrEqual(0.95);
  });

  // Bounds sit near the measured rates (400 seeds; in brackets), so a regression such as halving Garland's HP fails
  // (that lifts the naked case to 18 % and the 400 G kit case to 100 %). Revision 1 only asks for <= 60 % naked.
  it('careless Lv1 Fight-only play with no gear wins <= 5 % (0.25 %)', () => {
    expect(garlandWinRate(1, 'naked', 'careless', 0)).toBeLessThanOrEqual(0.05);
  });

  it('careless Lv1 Fight-only play with the 400 G kit wins 90-99.5 % (98.25 %): FF1\'s Garland is easy once geared', () => {
    const rate = garlandWinRate(1, 'start', 'careless', 0);
    expect(rate).toBeGreaterThanOrEqual(0.9);
    expect(rate).toBeLessThanOrEqual(0.995);
  });

  it('sensible Lv1 play with the 400 G kit wins >= 98 % (100 %)', () => {
    expect(garlandWinRate(1, 'start', 'sensible', 0)).toBeGreaterThanOrEqual(0.98);
  });

  it('after a temple run (sensible, full kit, 3 shared potions) Lv2 wins >= 85 % and Lv3 >= 95 %', () => {
    expect(templeRunWinRate(2, 2)).toBeGreaterThanOrEqual(0.85);
    expect(templeRunWinRate(3, 3)).toBeGreaterThanOrEqual(0.95);
  });

  // §4.5 "SLEP every turn": sleep never locks him for good. Each SLEP that lands takes at most one turn (he wakes by
  // the HP rule), but a SLEP lands before each of his turns about 79 % of the time, and the turn order is by agility,
  // so a run of landed SLEPs can still hold him for a whole short fight. The check holds the fight open (nobody hurts
  // him for 15 rounds): he never loses more turns than SLEPs landed, he acts in almost every battle, and he acts in
  // about 21 % of the rounds (measured 0.214 over 400 seeds; the bound is ±0.04).
  it('with SLEP cast at him every round, Garland loses at most one turn per SLEP and acts in >= 95 % of battles (EB-5)', () => {
    let lockedOut = 0;
    let actedShare = 0;
    for (let s = 1; s <= N; s++) {
      const rng = mulberry32(s * 13 + 5);
      const party = makeParty(2, 'start', false);
      const mage = party[3];
      mage.learnSpell('slep', 1);
      // the Black Mage casts SLEP (charges refilled); the others try to flee, which this battle never allows
      const slepEveryRound = (bsm: BattleStateMachine): void => {
        mage.setSpellCharges(1, 9);
        while (bsm.state === 'command_select') {
          const actorId = bsm.currentCommandActorId!;
          bsm.submitCommand(bsm.currentCommandActor === mage ? { type: 'magic', actorId, spellId: 'slep' } : { type: 'run', actorId });
        }
      };
      const r = runBattle(party, [enemyCopy('garland')], SPELLS, 'careless', rng, { beforeCommands: slepEveryRound, maxRounds: 15 });
      const turns = r.enemyTurns.get('garland') ?? 0;
      const landed = r.log.filter((t) => t === 'Garland is affected by sleep!').length;
      const lost = r.log.filter((t) => t === 'Garland is asleep!').length;
      expect(lost, `seed ${s}`).toBeLessThanOrEqual(landed);
      expect(r.log.filter((t) => t === 'Garland wakes up!').length, `seed ${s}`).toBe(lost); // 106 HP: always wakes
      if (turns === 0) lockedOut++;
      actedShare += turns / Math.max(1, r.rounds);
    }
    expect(lockedOut / N).toBeLessThanOrEqual(0.05);
    expect(Math.abs(actedShare / N - 0.21)).toBeLessThanOrEqual(0.04);
  });
});
