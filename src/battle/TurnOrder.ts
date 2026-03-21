export interface Combatant {
  id: string;
  agility: number;
  isEnemy: boolean;
}

export function sortByAgility(
  combatants: Combatant[],
  rng: () => number = Math.random
): Combatant[] {
  return [...combatants].sort((a, b) => {
    if (b.agility !== a.agility) return b.agility - a.agility;
    return rng() - 0.5; // Random tie-break
  });
}
