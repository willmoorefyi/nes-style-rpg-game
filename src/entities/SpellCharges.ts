import type { CharacterClassData } from '../types/index.js';

/**
 * Per-class spell charges (FF1-style, fix plan T4 §1.4, NG-4). A class's `spellCharges` holds step
 * breakpoints `[[level, [l1..l8]], ...]`: each row holds from its level until the next breakpoint,
 * missing spell levels in a row are 0, and a class without the field (or below its first row) has none.
 */
export const SPELL_LEVELS = 8;
export const MAX_CHARGES = 9;

/** Max charges at `spellLevel` (1-8) for a `classData` character at `charLevel`. */
export function maxChargesFor(classData: CharacterClassData, charLevel: number, spellLevel: number): number {
  if (spellLevel < 1 || spellLevel > SPELL_LEVELS) return 0;
  let row: number[] | undefined;
  let rowLevel = -Infinity;
  for (const [level, charges] of classData.spellCharges ?? []) {
    if (level <= charLevel && level >= rowLevel) {
      row = charges;
      rowLevel = level;
    }
  }
  return Math.min(MAX_CHARGES, row?.[spellLevel - 1] ?? 0);
}
