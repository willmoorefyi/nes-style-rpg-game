import type { Character } from '../entities/Character.js';
import type { EnemyInstance } from './BattleStateMachine.js';
import { physicalAttack, type PhysicalResult } from './DamageFormula.js';
import {
  enemyAbsorb, enemyAccuracy, enemyAttack, enemyCrit, enemyEvade, enemyHits,
  partyAbsorb, partyAttack, partyCrit, partyEvade, partyHitPercent, partyHits,
} from './CombatStats.js';

/** Weapon bonus against an enemy family (e.g. a Silver Sword vs undead), applied after the FF1 roll. */
const FAMILY_BONUS = 1.5;

/** A party member's Fight against an enemy (FF1 formulas through `CombatStats`). */
export function resolvePartyAttack(actor: Character, target: EnemyInstance, rng: () => number): PhysicalResult {
  const result = physicalAttack(
    { attack: partyAttack(actor), hitPercent: partyHitPercent(actor), hits: partyHits(actor), crit: partyCrit(actor),
      blind: actor.statusTracker.has('blind') },
    { evade: enemyEvade(target), absorb: enemyAbsorb(target), helpless: target.status.isHelpless(),
      blind: target.status.has('blind') },
    rng,
  );
  const weapon = actor.getEquipped('weapon');
  if (result.hit && weapon?.bonusVsFamily && weapon.bonusVsFamily === target.data.family) {
    result.damage = Math.floor(result.damage * FAMILY_BONUS);
  }
  return result;
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
