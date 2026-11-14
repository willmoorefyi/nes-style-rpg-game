export type ElementType = 'fire' | 'ice' | 'lightning' | 'earth' | 'holy' | 'dark' | 'water' | 'wind' | 'none';

export interface ElementalProfile {
  weaknesses: ElementType[];
  resistances: ElementType[];
  immunities: ElementType[];
  absorbs: ElementType[];
}

export function getElementalMultiplier(
  attackElement: ElementType,
  target: ElementalProfile | { weakness?: ElementType; resist?: ElementType }
): number {
  if (attackElement === 'none') return 1.0;

  // Handle ElementalProfile
  if ('weaknesses' in target) {
    if (target.absorbs.includes(attackElement)) return -1.0;
    if (target.immunities.includes(attackElement)) return 0.0;
    if (target.weaknesses.includes(attackElement)) return 2.0;
    if (target.resistances.includes(attackElement)) return 0.5;
    return 1.0;
  }

  // Legacy: single weakness/resist
  if (attackElement === target.weakness) return 2.0;
  if (attackElement === target.resist) return 0.5;
  return 1.0;
}

/** How a spell's element meets its target, for FF1's connect roll. */
export type ElementRelation = 'weak' | 'resist' | 'normal';

/**
 * FF1 spell element rule: a weakness raises the effectivity E by half (×1.5 before the roll), a resistance
 * halves the damage after it, and an immunity or absorb takes the damage to 0. `relation` drives the connect
 * roll (`DamageFormula.magicDamage`): a weakness adds 40 to its base of 148, a resistance sets that base to 0.
 * `getElementalMultiplier` stays for its other callers.
 */
export function magicElementMultiplier(
  attackElement: ElementType,
  target: ElementalProfile | { weakness?: ElementType; resist?: ElementType },
): { effectivity: number; damage: number; relation: ElementRelation } {
  const m = getElementalMultiplier(attackElement, target);
  if (m <= 0) return { effectivity: 1, damage: 0, relation: 'normal' };
  if (m > 1) return { effectivity: 1.5, damage: 1, relation: 'weak' };
  if (m < 1) return { effectivity: 1, damage: 0.5, relation: 'resist' };
  return { effectivity: 1, damage: 1, relation: 'normal' };
}
