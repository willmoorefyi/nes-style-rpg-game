export interface AITarget {
  id: string;
  isAlive: boolean;
}

export function selectTarget(
  targets: AITarget[],
  rng: () => number = Math.random
): AITarget | null {
  const living = targets.filter(t => t.isAlive);
  if (living.length === 0) return null;
  return living[Math.floor(rng() * living.length)];
}
