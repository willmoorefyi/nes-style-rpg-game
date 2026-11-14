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

/**
 * FF1 spell element rule: a weakness raises the effectivity E by half (×1.5 before the roll), a resistance
 * halves the damage after it, and an immunity or absorb takes the damage to 0. `getElementalMultiplier`
 * stays for its other callers.
 */
export function magicElementMultiplier(
  attackElement: ElementType,
  target: ElementalProfile | { weakness?: ElementType; resist?: ElementType },
): { effectivity: number; damage: number } {
  const m = getElementalMultiplier(attackElement, target);
  if (m <= 0) return { effectivity: 1, damage: 0 };
  if (m > 1) return { effectivity: 1.5, damage: 1 };
  if (m < 1) return { effectivity: 1, damage: 0.5 };
  return { effectivity: 1, damage: 1 };
}
