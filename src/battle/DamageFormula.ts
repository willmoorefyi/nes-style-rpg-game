import { magicElementMultiplier, type ElementalProfile, type ElementRelation, type ElementType } from './Elements.js';

/** FF1 (NES) battle formulas. Every roll goes through the injected `rng` (0 ≤ rng() < 1). */

/** Base of the physical hit roll: chance = (168 + hit% − evade) / 200. */
const PHYSICAL_HIT_BASE = 168;
/** Base of the spell connect / status roll: chance = (148 + accuracy − magic defence) / 200. */
const MAGIC_HIT_BASE = 148;
/** Bonus to hit a sleeping or paralysed target. */
const HELPLESS_BONUS = 40;
/** FF1 blind (B8): a blind attacker loses 40 on the hit roll; a blind defender is hit 40 more easily. */
const BLIND_PENALTY = 40;
/** FF1: a spell's connect base rises by 40 against a weakness. */
const WEAK_CONNECT_BONUS = 40;
/** Spell accuracy when the data gives none (FF1's usual value). */
export const DEFAULT_SPELL_ACCURACY = 24;

/** Uniform integer in [lo, hi]. */
export function randInt(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** True with probability chance / 200 (a chance above 200 always succeeds). */
function roll200(rng: () => number, chance: number): boolean {
  return rng() * 200 < chance;
}

export interface PhysicalAttacker {
  /** A: each hit rolls rand(A, 2A). */
  attack: number;
  hitPercent: number;
  hits: number;
  /** Critical chance out of 200. */
  crit: number;
  /** Blind: −40 to hit (B8). */
  blind?: boolean;
}

export interface PhysicalDefender {
  evade: number;
  /** Subtracted from each hit (minimum 1 per hit). */
  absorb: number;
  /** Asleep or paralysed: +40 to hit. */
  helpless?: boolean;
  /** Blind: +40 to hit it (B8). */
  blind?: boolean;
}

export interface PhysicalResult {
  damage: number;
  hitsLanded: number;
  critical: boolean;
  /** At least one hit landed. */
  hit: boolean;
}

/**
 * FF1 physical attack. Per hit: a hit roll, then rand(A, 2A) − absorb (min 1); a crit adds another
 * rand(A, 2A) that ignores absorb.
 */
export function physicalAttack(
  attacker: PhysicalAttacker,
  defender: PhysicalDefender,
  rng: () => number = Math.random,
): PhysicalResult {
  const chance = PHYSICAL_HIT_BASE + attacker.hitPercent - defender.evade + (defender.helpless ? HELPLESS_BONUS : 0)
    - (attacker.blind ? BLIND_PENALTY : 0) + (defender.blind ? BLIND_PENALTY : 0);
  const a = Math.max(0, attacker.attack);
  let damage = 0;
  let hitsLanded = 0;
  let critical = false;
  for (let i = 0; i < Math.max(1, attacker.hits); i++) {
    if (!roll200(rng, chance)) continue;
    hitsLanded++;
    let d = Math.max(1, randInt(rng, a, 2 * a) - defender.absorb);
    if (roll200(rng, attacker.crit)) {
      d += randInt(rng, a, 2 * a);
      critical = true;
    }
    damage += d;
  }
  return { damage, hitsLanded, critical, hit: hitsLanded > 0 };
}

/**
 * True when a spell connects / a status spell lands: (base + accuracy − magic defence) / 200. The base is 148;
 * FF1 raises it to 188 against an element the target is weak to and sets it to 0 against one it resists.
 */
export function statusHits(accuracy: number, magicDefense: number, rng: () => number = Math.random,
  relation: ElementRelation = 'normal'): boolean {
  return roll200(rng, statusRoll(accuracy, magicDefense, relation));
}

/** The connect roll's chance out of 200: base + accuracy − magic defence (shared by statusHits and statusChance). */
function statusRoll(accuracy: number, magicDefense: number, relation: ElementRelation): number {
  const base = relation === 'resist' ? 0 : MAGIC_HIT_BASE + (relation === 'weak' ? WEAK_CONNECT_BONUS : 0);
  return base + accuracy - magicDefense;
}

/** The probability (0..1) that statusHits succeeds (the bestiary's "Status hit"). */
export function statusChance(accuracy: number, magicDefense: number, relation: ElementRelation = 'normal'): number {
  return Math.max(0, Math.min(1, statusRoll(accuracy, magicDefense, relation) / 200));
}

export interface MagicSpell {
  /** FF1 effectivity E. */
  power: number;
  accuracy?: number;
  element?: string;
}

export interface MagicTarget {
  magicDefense: number;
  weakness?: string;
  resist?: string;
  elementalProfile?: ElementalProfile;
}

export interface MagicResult {
  damage: number;
  /** The connect roll succeeded (damage doubled). */
  connected: boolean;
}

/**
 * FF1 spell damage: rand(E, 2E), with E × 1.5 against a weakness and the damage halved against a
 * resistance; doubled when the spell connects. The connect roll's base is 148, 188 against a weakness and 0
 * against a resistance (FF1). Caster INT is not used (as in FF1).
 */
export function magicDamage(
  spell: MagicSpell,
  target: MagicTarget,
  rng: () => number = Math.random,
): MagicResult {
  const mult = magicElementMultiplier((spell.element ?? 'none') as ElementType, target.elementalProfile ?? {
    weakness: target.weakness as ElementType | undefined,
    resist: target.resist as ElementType | undefined,
  });
  const connected = statusHits(spell.accuracy ?? DEFAULT_SPELL_ACCURACY, target.magicDefense, rng, mult.relation);
  const e = Math.floor(Math.max(0, spell.power) * mult.effectivity);
  let damage = Math.floor(randInt(rng, e, 2 * e) * mult.damage);
  if (connected) damage *= 2;
  if (mult.damage > 0) damage = Math.max(1, damage);
  return { damage, connected };
}

/** HP a heal spell restores, rand(E, 2E); battle and field CURE share this so they always agree. */
export function healAmount(spell: { power?: number }, rng: () => number = Math.random): number {
  const e = Math.max(0, spell.power ?? 16);
  return randInt(rng, e, 2 * e);
}
