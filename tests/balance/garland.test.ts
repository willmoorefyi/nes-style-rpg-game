/**
 * Garland balance (docs/FIX_PLAN_PENINSULA.md T4 §3, §4.5; R-1; U1 / U-1; pass F item 2, decision FB-2 of
 * docs/FEEDBACK_PLAN_2026-11-14.md §3.2): seeded battles on the real `BattleStateMachine` with the real data.
 *
 * Pass F re-tunes him to the `lv2` kit (the 400 G kit + LIT + 2 potions, what the item-1 gold buys at Lv 2): 400 HP,
 * attack 9, accuracy 15, 2 hits, and 3 hits once he is at <= 50 % HP (U1: 340 HP, 3 hits at <= 25 %). A full-HP Lv2
 * mage in cloth still survives one 2-hit attack (attack and hits are unchanged); a sensible Lv2 party with the lv2 kit
 * wins about two in three, Lv3 is comfortable; at Lv1 he is a wall (FB-2 reverses U-1's "Lv1 about one in three").
 * Turn order is agility × a random factor (B7). Party: Warrior / Thief / White Mage / Black Mage.
 *
 * Measured values (400 seeds; mage survival 4000 rolls) are in brackets as "new" (400 HP / 0.5, item-1 gold) and
 * "old" (U1's 340 HP / 0.25). Every bound is at least 3 points from its new value; the full-kit bounds (>= 95-97 %
 * against 100 %) are ceiling-limited. The old data fails the bounds of "sensible Lv2 400 G kit", "sensible Lv1",
 * "careless Lv2 / Lv3", "temple run, 400 G kit" and every lv2 / arrive case except Lv3.
 */
import { describe, it, expect } from 'vitest';
import { runBattle, mulberry32, type Policy } from '../helpers/battlePolicies.js';
import { makeParty, makeMember, enemyCopy, rollFormation, SPELLS, START_KIT, KIT_POTIONS, type KitName } from '../helpers/balanceData.js';
import type { BattleStateMachine, EnemyInstance } from '../../src/battle/BattleStateMachine.js';
import { resolveEnemyAttack } from '../../src/battle/PhysicalAttack.js';
import { StatusTracker } from '../../src/battle/StatusEffects.js';

const N = 400;

/** Win rate over N seeds; `rounds` collects the length of every win. */
function garlandWinRate(level: number, kit: KitName, policy: Policy, potions: number, rounds?: number[]): number {
  let wins = 0;
  for (let s = 1; s <= N; s++) {
    const rng = mulberry32(s * 7919 + level);
    const party = makeParty(level, kit, policy !== 'careless');
    const r = runBattle(party, [enemyCopy('garland')], SPELLS, policy, rng, { potions: { n: potions } });
    if (r.outcome === 'victory') { wins++; rounds?.push(r.rounds); }
  }
  return wins / N;
}

/** §4.3: `pre` temple battles first (no inn, potions shared), then Garland, sensible play with `kit`. */
function templeRunWinRate(level: number, pre: number, kit: KitName = 'full', potions = KIT_POTIONS[kit]): number {
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

const median = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

describe('Garland (400 HP, attack 9, 2 hits, 3 at <= 50 % HP; 400 seeded battles per case)', () => {
  it('a full-HP Lv2 W.MAG / B.MAG in cloth survives one 2-hit attack >= 90 % of the time (new 95.35 % / 95.63 %; old the same)', () => {
    expect(mageSurvival('white_mage', 4242)).toBeGreaterThanOrEqual(0.9);
    expect(mageSurvival('black_mage', 4243)).toBeGreaterThanOrEqual(0.9);
  });

  it('a sensible Lv2 party with the lv2 kit (400 G kit + LIT + 2 potions) wins 55-75 % (new 67.75 %; old 95.75 %), in a median of <= 11 rounds (new 10, p90 12; old 8)', () => {
    const rounds: number[] = [];
    const rate = garlandWinRate(2, 'lv2', 'sensible', KIT_POTIONS.lv2, rounds);
    expect(rate).toBeGreaterThanOrEqual(0.55);
    expect(rate).toBeLessThanOrEqual(0.75);
    expect(median(rounds)).toBeLessThanOrEqual(11);
  });

  it('a sensible Lv3 party with the lv2 kit wins >= 85 % (new 95 %; old 100 %)', () => {
    expect(garlandWinRate(3, 'lv2', 'sensible', KIT_POTIONS.lv2)).toBeGreaterThanOrEqual(0.85);
  });

  it('a sensible Lv2 party wins 60-80 % with the 400 G kit and no potions (new 73 %; old 96.75 %), >= 97 % with the full kit and 3 potions (100 %; old 100 %)', () => {
    const rate = garlandWinRate(2, 'start', 'sensible', 0);
    expect(rate).toBeGreaterThanOrEqual(0.6);
    expect(rate).toBeLessThanOrEqual(0.8);
    expect(garlandWinRate(2, 'full', 'sensible', 3)).toBeGreaterThanOrEqual(0.97);
  });

  it('a sensible Lv1 party with the 400 G kit wins <= 15 % (new 7.25 %; old 36.25 %)', () => {
    expect(garlandWinRate(1, 'start', 'sensible', 0)).toBeLessThanOrEqual(0.15);
  });

  it('a sensible Lv3 party with the full kit and 3 potions wins >= 97 % (new 100 %; old 100 %; ceiling-limited, see header)', () => {
    expect(garlandWinRate(3, 'full', 'sensible', 3)).toBeGreaterThanOrEqual(0.97);
  });

  it('a sensible Lv2 full-kit win lasts >= 3 rounds in >= 90 % of the wins (new 100 %, median 10; old 100 %, median 8)', () => {
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
  it('careless Lv1 Fight-only play with no gear wins <= 10 % (new 0 %; old 0 %)', () => {
    expect(garlandWinRate(1, 'naked', 'careless', 0)).toBeLessThanOrEqual(0.1);
  });

  it('careless Lv1 Fight-only play with the 400 G kit wins <= 4 % (new 0.25 %; old 3 %)', () => {
    expect(garlandWinRate(1, 'start', 'careless', 0)).toBeLessThanOrEqual(0.04);
  });

  it('careless play with the 400 G kit wins 5-20 % at Lv2 (new 12.75 %; old 52.75 %) and 55-75 % at Lv3 (new 64 %; old 92 %)', () => {
    const l2 = garlandWinRate(2, 'start', 'careless', 0);
    expect(l2).toBeGreaterThanOrEqual(0.05);
    expect(l2).toBeLessThanOrEqual(0.2);
    const l3 = garlandWinRate(3, 'start', 'careless', 0);
    expect(l3).toBeGreaterThanOrEqual(0.55);
    expect(l3).toBeLessThanOrEqual(0.75);
  });

  it('sensible Lv1 play with the full kit and no potions wins >= 95 % (new 99.25 %; old 100 %)', () => {
    expect(garlandWinRate(1, 'full', 'sensible', 0)).toBeGreaterThanOrEqual(0.95);
  });

  it('after a temple run (2 battles, no inn, sensible) Lv2 with the 400 G kit and no potions wins 55-70 % (new 61.25 %; old 89 %)', () => {
    const rate = templeRunWinRate(2, 2, 'start', 0);
    expect(rate).toBeGreaterThanOrEqual(0.55);
    expect(rate).toBeLessThanOrEqual(0.7);
  });

  it('after a temple run (2 battles) Lv2 with the lv2 kit and its 2 potions wins 40-58 % (new 51.75 %; old 85.5 %)', () => {
    const rate = templeRunWinRate(2, 2, 'lv2');
    expect(rate).toBeGreaterThanOrEqual(0.4);
    expect(rate).toBeLessThanOrEqual(0.58);
  });

  it('with the arrival kit (lv2 + 4 caps, 2 potions) after 3 temple battles Lv2 wins 50-70 % (new 61 %; old 88 %)', () => {
    const rate = templeRunWinRate(2, 3, 'arrive');
    expect(rate).toBeGreaterThanOrEqual(0.5);
    expect(rate).toBeLessThanOrEqual(0.7);
  });

  it('after a temple run with the full kit and 3 shared potions Lv2 wins >= 95 % (new 100 %; old 100 %) and Lv3 >= 95 % (100 %)', () => {
    expect(templeRunWinRate(2, 2)).toBeGreaterThanOrEqual(0.95);
    expect(templeRunWinRate(3, 3)).toBeGreaterThanOrEqual(0.95);
  });

  // §4.5 "SLEP every turn": sleep never locks him for good. Each SLEP that lands takes at most one turn (he wakes by
  // the HP rule), but a SLEP lands before each of his turns most of the time. The turn order is no longer strictly
  // by agility (B7: agility × a random factor), so he often acts before the Black Mage's SLEP of that round. The
  // check holds the fight open (nobody hurts him for 15 rounds): he never loses more turns than SLEPs landed, he acts
  // in almost every battle, and he acts in about 40 % of the rounds (measured 0.4016 over 400 seeds at 400 HP, the
  // same as at 340 HP because nobody hurts him; R: 0.468 at 240 HP; the bound is ±0.05).
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
      expect(r.log.filter((t) => t === 'Garland wakes up!').length, `seed ${s}`).toBe(lost); // 400 HP: always wakes
      if (turns === 0) lockedOut++;
      actedShare += turns / Math.max(1, r.rounds);
    }
    expect(lockedOut / N).toBeLessThanOrEqual(0.05);
    expect(Math.abs(actedShare / N - 0.4)).toBeLessThanOrEqual(0.05);
  });
});
