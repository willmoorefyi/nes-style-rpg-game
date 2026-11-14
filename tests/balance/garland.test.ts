/**
 * Garland balance (docs/FIX_PLAN_PENINSULA.md T4 §3, §4.5; R "Balance bounds" and decision R-1): seeded battles on
 * the real `BattleStateMachine` with the real data. Garland is tougher than FF1's (triage default B1): 240 HP, attack
 * 16, 2 hits, and 3 hits once he is at <= 25 % HP. A sensible Lv2 party with the full kit wins almost always and
 * takes at least 3 rounds; with only the 400 G kit it is a coin toss; careless Fight-only play at Lv1 nearly never
 * wins. Turn order is agility × a random factor (B7). Party: Warrior / Thief / White Mage / Black Mage. Measured
 * values (400 seeds) are in brackets; every bound is at least 3 points from them.
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

describe('Garland (240 HP, attack 16, 2 hits, 3 at <= 25 % HP; 400 seeded battles per case)', () => {
  it('a sensible Lv2 party wins 35-65 % with the 400 G kit (51 %) and >= 90 % with the full kit and 3 potions (95.75 %)', () => {
    const start = garlandWinRate(2, 'start', 'sensible', 0);
    expect(start).toBeGreaterThanOrEqual(0.35);
    expect(start).toBeLessThanOrEqual(0.65);
    expect(garlandWinRate(2, 'full', 'sensible', 3)).toBeGreaterThanOrEqual(0.9);
  });

  it('a sensible Lv3 party with the full kit and 3 potions wins >= 97 % (99.5 %)', () => {
    expect(garlandWinRate(3, 'full', 'sensible', 3)).toBeGreaterThanOrEqual(0.97);
  });

  it('a sensible Lv2 full-kit win lasts >= 3 rounds in >= 90 % of the wins (100 %, median 5)', () => {
    let wins = 0, long = 0;
    for (let s = 1; s <= N; s++) {
      const rng = mulberry32(s * 7919 + 2);
      const r = runBattle(makeParty(2, 'full', true), [enemyCopy('garland')], SPELLS, 'sensible', rng, { potions: { n: 3 } });
      if (r.outcome !== 'victory') continue;
      wins++;
      if (r.rounds >= 3) long++;
    }
    expect(long / wins).toBeGreaterThanOrEqual(0.9);
  });

  // Bounds sit near the measured rates, so a regression such as halving Garland's HP fails.
  it('careless Lv1 Fight-only play with no gear wins <= 5 % (0 %)', () => {
    expect(garlandWinRate(1, 'naked', 'careless', 0)).toBeLessThanOrEqual(0.05);
  });

  it('careless Lv1 Fight-only play with the 400 G kit wins <= 5 % (1.25 %)', () => {
    expect(garlandWinRate(1, 'start', 'careless', 0)).toBeLessThanOrEqual(0.05);
  });

  it('careless play with the 400 G kit wins 5-35 % at Lv2 (12.25 %) and 25-65 % at Lv3 (41.25 %)', () => {
    const l2 = garlandWinRate(2, 'start', 'careless', 0);
    expect(l2).toBeGreaterThanOrEqual(0.05);
    expect(l2).toBeLessThanOrEqual(0.35);
    const l3 = garlandWinRate(3, 'start', 'careless', 0);
    expect(l3).toBeGreaterThanOrEqual(0.25);
    expect(l3).toBeLessThanOrEqual(0.65);
  });

  it('sensible Lv1 play with the full kit wins 30-65 % (57.25 %)', () => {
    const rate = garlandWinRate(1, 'full', 'sensible', 0);
    expect(rate).toBeGreaterThanOrEqual(0.3);
    expect(rate).toBeLessThanOrEqual(0.65);
  });

  it('after a temple run (sensible, full kit, 3 shared potions) Lv2 wins >= 80 % (85 %) and Lv3 >= 93 % (95.75 %)', () => {
    expect(templeRunWinRate(2, 2)).toBeGreaterThanOrEqual(0.8);
    expect(templeRunWinRate(3, 3)).toBeGreaterThanOrEqual(0.93);
  });

  // §4.5 "SLEP every turn": sleep never locks him for good. Each SLEP that lands takes at most one turn (he wakes by
  // the HP rule), but a SLEP lands before each of his turns most of the time. The turn order is no longer strictly
  // by agility (B7: agility × a random factor), so he often acts before the Black Mage's SLEP of that round. The
  // check holds the fight open (nobody hurts him for 15 rounds): he never loses more turns than SLEPs landed, he acts
  // in almost every battle, and he acts in about 47 % of the rounds (measured 0.468 over 400 seeds; the bound is ±0.05).
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
      expect(r.log.filter((t) => t === 'Garland wakes up!').length, `seed ${s}`).toBe(lost); // 240 HP: always wakes
      if (turns === 0) lockedOut++;
      actedShare += turns / Math.max(1, r.rounds);
    }
    expect(lockedOut / N).toBeLessThanOrEqual(0.05);
    expect(Math.abs(actedShare / N - 0.47)).toBeLessThanOrEqual(0.05);
  });
});
