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
