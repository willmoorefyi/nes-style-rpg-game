export interface Attacker {
  attack: number;
  level: number;
  hitPercent?: number;
}

export interface Defender {
  defense: number;
  evadePercent?: number;
}

export interface DamageResult {
  damage: number;
  hit: boolean;
  critical: boolean;
}

export function calculateDamage(
  attacker: Attacker,
  defender: Defender,
  rng: () => number = Math.random
): DamageResult {
  const hitChance = (attacker.hitPercent ?? 80) - (defender.evadePercent ?? 0);
  const hit = rng() * 100 < hitChance;
  if (!hit) return { damage: 0, hit: false, critical: false };

  const critical = rng() < 1 / 32;
  const variance = Math.floor(rng() * attacker.level) + 1;
  let damage = attacker.attack - defender.defense + variance;
  if (critical) damage *= 2;
  damage = Math.max(1, damage);

  return { damage, hit: true, critical };
}

import { getElementalMultiplier, type ElementType } from './Elements.js';

export interface MagicCaster {
  intelligence: number;
}

export interface MagicTarget {
  intelligence: number;
  weakness?: string;
  resist?: string;
}

export interface SpellInfo {
  power: number;
  element?: string;
  isHealing?: boolean;
}

export function calculateMagicDamage(
  caster: MagicCaster,
  target: MagicTarget,
  spell: SpellInfo,
  rng: () => number = Math.random
): number {
  const variance = 0.875 + rng() * 0.25;
  if (spell.isHealing) {
    return Math.floor(spell.power * caster.intelligence * variance / 4);
  }
  const elementMult = getElementalMultiplier(
    (spell.element || 'none') as ElementType,
    { weakness: target.weakness as ElementType | undefined, resist: target.resist as ElementType | undefined }
  );
  const intRatio = caster.intelligence / Math.max(1, target.intelligence);
  return Math.max(1, Math.floor(spell.power * intRatio * elementMult * variance));
}
