/**
 * Garland balance (docs/FIX_PLAN_PENINSULA.md T4 §3, §4.5; R decision R-1; U1 and decision U-1): seeded battles on the
 * real `BattleStateMachine` with the real data. U1 tunes him to the 400 G shop kit (no potions): 340 HP, attack 9,
 * accuracy 15, 2 hits, and 3 hits once he is at <= 25 % HP (R: 240 HP, attack 16). A full-HP Lv2 mage in cloth
 * survives one 2-hit attack; a sensible Lv2 party with the 400 G kit wins most fights, also after a temple run; at
 * Lv1 it is about one in three; careless Fight-only play with no gear never wins. Turn order is agility × a random
 * factor (B7). Party: Warrior / Thief / White Mage / Black Mage. Measured values (400 seeds; mage survival 4000
 * rolls) are in brackets, the R values before U1 as "old". Every bound is at least 3 points from its measured value;
 * the full-kit bounds (>= 95-97 % against 100 %) are ceiling-limited.
 */
import { describe, it, expect } from 'vitest';
import { runBattle, mulberry32, type Policy } from '../helpers/battlePolicies.js';
import { makeParty, makeMember, enemyCopy, rollFormation, SPELLS, START_KIT, type KitName } from '../helpers/balanceData.js';
import type { BattleStateMachine, EnemyInstance } from '../../src/battle/BattleStateMachine.js';
import { resolveEnemyAttack } from '../../src/battle/PhysicalAttack.js';
import { StatusTracker } from '../../src/battle/StatusEffects.js';

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

/** §4.3: `pre` temple battles first (no inn, potions shared), then Garland, sensible play with `kit`. */
function templeRunWinRate(level: number, pre: number, kit: KitName = 'full', potions = 3): number {
  let wins = 0;
  for (let s = 1; s <= N; s++) {
    const rng = mulberry32(s * 101 + level * 7 + pre);
    const party = makeParty(level, kit, true);
    const shared = { n: potions };
    let alive = true;
    for (let b = 0; b < pre && alive; b++) {
      alive = runBattle(party, rollFormation('temple', rng), SPELLS, 'sensible', rng, { potions: shared }).outcome === 'victory';
    }
    if (alive && runBattle(party, [enemyCopy('garland')], SPELLS, 'sensible', rng, { potions: shared }).outcome === 'victory') wins++;
  }
  return wins / N;
}

/** Share of `n` seeded Garland Fights (the real `resolveEnemyAttack` and `CombatStats`) a full-HP Lv2 `cls` survives. */
function mageSurvival(cls: 'white_mage' | 'black_mage', seed: number, n = 4000): number {
  const rng = mulberry32(seed);
  const data = enemyCopy('garland');
  const garland: EnemyInstance = {
    id: 'enemy_0', data, currentHp: data.stats.hp, status: new StatusTracker(), buffs: new Map(), displayName: 'Garland',
  };
  let alive = 0;
  for (let i = 0; i < n; i++) {
    const mage = makeMember(cls, 2, START_KIT[cls]);
    if (i === 0) expect(mage.getEquipped('armor')?.id).toBe('cloth');
    if (resolveEnemyAttack(garland, mage, rng).damage < mage.currentHp) alive++;
  }
  return alive / n;
}

describe('Garland (340 HP, attack 9, 2 hits, 3 at <= 25 % HP; 400 seeded battles per case)', () => {
  it('a full-HP Lv2 W.MAG / B.MAG in cloth survives one 2-hit attack >= 90 % of the time (95.35 % / 95.63 %; old 56.3 %)', () => {
    expect(mageSurvival('white_mage', 4242)).toBeGreaterThanOrEqual(0.9);
    expect(mageSurvival('black_mage', 4243)).toBeGreaterThanOrEqual(0.9);
  });

  it('a sensible Lv2 party wins >= 70 % with the 400 G kit and no potions (96.75 %; old 51 %), >= 97 % with the full kit and 3 potions (100 %)', () => {
    expect(garlandWinRate(2, 'start', 'sensible', 0)).toBeGreaterThanOrEqual(0.7);
    expect(garlandWinRate(2, 'full', 'sensible', 3)).toBeGreaterThanOrEqual(0.97);
  });

  it('a sensible Lv1 party with the 400 G kit wins 25-55 % (36.25 %; old 7.75 %)', () => {
    const rate = garlandWinRate(1, 'start', 'sensible', 0);
    expect(rate).toBeGreaterThanOrEqual(0.25);
    expect(rate).toBeLessThanOrEqual(0.55);
  });

  it('a sensible Lv3 party with the full kit and 3 potions wins >= 97 % (100 %; ceiling-limited, see header)', () => {
    expect(garlandWinRate(3, 'full', 'sensible', 3)).toBeGreaterThanOrEqual(0.97);
  });

  it('a sensible Lv2 full-kit win lasts >= 3 rounds in >= 90 % of the wins (100 %, median 8)', () => {
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
  it('careless Lv1 Fight-only play with no gear wins <= 10 % (0 %)', () => {
    expect(garlandWinRate(1, 'naked', 'careless', 0)).toBeLessThanOrEqual(0.1);
  });

  it('careless Lv1 Fight-only play with the 400 G kit wins <= 7 % (3 %; old 1.25 %)', () => {
    expect(garlandWinRate(1, 'start', 'careless', 0)).toBeLessThanOrEqual(0.07);
  });

  it('careless play with the 400 G kit wins 45-60 % at Lv2 (52.75 %; old 12.25 %) and 85-97 % at Lv3 (92 %; old 41.25 %)', () => {
    const l2 = garlandWinRate(2, 'start', 'careless', 0);
    expect(l2).toBeGreaterThanOrEqual(0.45);
    expect(l2).toBeLessThanOrEqual(0.6);
    const l3 = garlandWinRate(3, 'start', 'careless', 0);
    expect(l3).toBeGreaterThanOrEqual(0.85);
    expect(l3).toBeLessThanOrEqual(0.97);
  });

  it('sensible Lv1 play with the full kit and no potions wins >= 95 % (100 %; old 57.25 %)', () => {
    expect(garlandWinRate(1, 'full', 'sensible', 0)).toBeGreaterThanOrEqual(0.95);
  });

  it('after a temple run (2 battles, no inn, sensible) Lv2 with the 400 G kit and no potions wins >= 70 % (89 %; old 32 %)', () => {
    expect(templeRunWinRate(2, 2, 'start', 0)).toBeGreaterThanOrEqual(0.7);
  });

  it('after a temple run with the full kit and 3 shared potions Lv2 wins >= 95 % (100 %; old 91 %) and Lv3 >= 95 % (100 %)', () => {
    expect(templeRunWinRate(2, 2)).toBeGreaterThanOrEqual(0.95);
    expect(templeRunWinRate(3, 3)).toBeGreaterThanOrEqual(0.95);
  });

  // §4.5 "SLEP every turn": sleep never locks him for good. Each SLEP that lands takes at most one turn (he wakes by
  // the HP rule), but a SLEP lands before each of his turns most of the time. The turn order is no longer strictly
  // by agility (B7: agility × a random factor), so he often acts before the Black Mage's SLEP of that round. The
  // check holds the fight open (nobody hurts him for 15 rounds): he never loses more turns than SLEPs landed, he acts
  // in almost every battle, and he acts in about 40 % of the rounds (measured 0.402 over 400 seeds at 340 HP; R: 0.468
  // at 240 HP; the bound is ±0.05).
  it('with SLEP cast at him every round, Garland loses at most one turn per SLEP and acts in >= 95 % of battles (100 %) (EB-5)', () => {
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
      expect(r.log.filter((t) => t === 'Garland wakes up!').length, `seed ${s}`).toBe(lost); // 340 HP: always wakes
      if (turns === 0) lockedOut++;
      actedShare += turns / Math.max(1, r.rounds);
    }
    expect(lockedOut / N).toBeLessThanOrEqual(0.05);
    expect(Math.abs(actedShare / N - 0.4)).toBeLessThanOrEqual(0.05);
  });
});
