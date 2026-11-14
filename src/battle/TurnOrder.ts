export interface Combatant {
  id: string;
  agility: number;
  isEnemy: boolean;
}

/**
 * Turn order (B7, decision R-2): each combatant draws one key, agility × (1 + rng()), and the round runs from the
 * highest key down. Exactly one RNG draw per combatant, in list order, and none inside the comparator. A small
 * agility edge is only a tendency (a Warrior at 5 beats a Goblin at 6 about 27 % of the time); a gap of 2x or more
 * always holds.
 */
export function sortByAgility(
  combatants: Combatant[],
  rng: () => number = Math.random
): Combatant[] {
  const keyed = combatants.map((c) => ({ c, key: c.agility * (1 + rng()) }));
  return keyed.sort((a, b) => b.key - a.key).map((k) => k.c);
}
