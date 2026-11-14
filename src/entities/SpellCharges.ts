/**
 * Spell charge table per design doc §5: max charges per spell level (1-8) for a character level.
 * Interpolated linearly between the breakpoints. (T4 replaces this with FF1's per-class numbers.)
 */
const BREAKPOINTS: Array<[number, number[]]> = [
  [1,  [2, 0, 0, 0, 0, 0, 0, 0]],
  [5,  [4, 2, 1, 0, 0, 0, 0, 0]],
  [10, [5, 4, 3, 2, 1, 0, 0, 0]],
  [20, [7, 6, 5, 5, 4, 3, 2, 1]],
  [50, [9, 9, 9, 9, 9, 9, 9, 9]],
];

export const SPELL_LEVELS = 8;

/** Max charges at `spellLevel` (1-8) for a character at `charLevel`. */
export function maxChargesFor(charLevel: number, spellLevel: number): number {
  if (spellLevel < 1 || spellLevel > SPELL_LEVELS) return 0;
  const idx = spellLevel - 1;
  const first = BREAKPOINTS[0];
  const last = BREAKPOINTS[BREAKPOINTS.length - 1];
  if (charLevel <= first[0]) return first[1][idx];
  if (charLevel >= last[0]) return last[1][idx];
  for (let i = 0; i < BREAKPOINTS.length - 1; i++) {
    const [loLvl, loCharges] = BREAKPOINTS[i];
    const [hiLvl, hiCharges] = BREAKPOINTS[i + 1];
    if (charLevel >= loLvl && charLevel <= hiLvl) {
      const t = (charLevel - loLvl) / (hiLvl - loLvl);
      return Math.min(9, Math.floor(loCharges[idx] + t * (hiCharges[idx] - loCharges[idx])));
    }
  }
  return 0;
}
