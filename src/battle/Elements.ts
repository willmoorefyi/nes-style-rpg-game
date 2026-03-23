export type ElementType = 'fire' | 'ice' | 'lightning' | 'earth' | 'holy' | 'dark' | 'none';

export function getElementalMultiplier(
  attackElement: ElementType,
  targetWeakness?: ElementType,
  targetResist?: ElementType
): number {
  if (attackElement === 'none') return 1.0;
  if (attackElement === targetWeakness) return 2.0;
  if (attackElement === targetResist) return 0.5;
  return 1.0;
}
