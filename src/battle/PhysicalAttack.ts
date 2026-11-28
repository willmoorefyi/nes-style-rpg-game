import type { Character } from '../entities/Character.js';
import type { ItemData } from '../types/index.js';
import type { EnemyInstance } from './BattleStateMachine.js';
import { physicalAttack, type PhysicalResult } from './DamageFormula.js';
import {
  enemyAbsorb, enemyAccuracy, enemyAttack, enemyCrit, enemyEvade, enemyHits,
  partyAbsorb, partyAttack, partyCrit, partyEvade, partyHitPercent, partyHits,
} from './CombatStats.js';

/** FF1's "strong against" bonus (pass EQ 7.1): attack +4 and hit% +40 before the roll. */
export const STRONG_ATTACK = 4;
export const STRONG_HIT = 40;

/**
 * Whether a weapon is strong against an enemy (FF1): it names the enemy's family (or `all`, Excalibur), or the enemy is
 * weak to the weapon's element. Unarmed attacks are never strong.
 */
export function strongAgainst(weapon: ItemData | null, target: EnemyInstance): boolean {
  if (!weapon) return false;
  const fam = weapon.bonusVsFamily;
  if (fam === 'all' || (!!fam && fam === target.data.family)) return true;
  const el = weapon.element;
  if (!el) return false;
  const weak: readonly string[] = target.data.elementalProfile?.weaknesses ?? [];
  return target.data.weakness === el || weak.includes(el);
}

/** A party member's Fight against an enemy (FF1 formulas through `CombatStats`, plus the FF1 strong bonus). */
export function resolvePartyAttack(actor: Character, target: EnemyInstance, rng: () => number): PhysicalResult {
  const strong = strongAgainst(actor.getEquipped('weapon'), target);
  // hits come from the raised hit% (FF1: 1 + floor(hit% / 32)); a strong attack always has a weapon, so no martial x2
  const hitPercent = partyHitPercent(actor) + (strong ? STRONG_HIT : 0);
  return physicalAttack(
    { attack: partyAttack(actor) + (strong ? STRONG_ATTACK : 0), hitPercent,
      hits: strong ? 1 + Math.floor(Math.max(0, hitPercent) / 32) : partyHits(actor), crit: partyCrit(actor),
      blind: actor.statusTracker.has('blind') },
    { evade: enemyEvade(target), absorb: enemyAbsorb(target), helpless: target.status.isHelpless(),
      blind: target.status.has('blind') },
    rng,
  );
}

/** An enemy's Fight against a party member. */
export function resolveEnemyAttack(enemy: EnemyInstance, target: Character, rng: () => number): PhysicalResult {
  return physicalAttack(
    {
      attack: enemyAttack(enemy),
      hitPercent: enemyAccuracy(enemy.data),
      hits: enemyHits(enemy),
      crit: enemyCrit(enemy.data),
      blind: enemy.status.has('blind'),
    },
    { evade: partyEvade(target), absorb: partyAbsorb(target), helpless: target.statusTracker.isHelpless(),
      blind: target.statusTracker.has('blind') },
    rng,
  );
}

/** "A hits B for 18!", plus " (2 hits)" when more than one hit landed and " Critical!" on a crit. */
export function attackLine(attacker: string, target: string, result: PhysicalResult): string {
  const hits = result.hitsLanded > 1 ? ` (${result.hitsLanded} hits)` : '';
  const crit = result.critical ? ' Critical!' : '';
  return `${attacker} hits ${target} for ${result.damage}!${hits}${crit}`;
}
