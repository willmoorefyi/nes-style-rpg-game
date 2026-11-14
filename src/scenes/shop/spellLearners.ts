import type { SpellData } from '../../types/index.js';
import type { Character } from '../../entities/Character.js';
import { ClassRegistry } from '../../data/ClassRegistry.js';
import { classLabel } from '../../data/classLabel.js';

/**
 * Who can learn `spell`, as class abbreviations (classes.yaml `abbr`) in class order: the base classes whose spell levels reach it, plus the
 * classes of `party` that `canLearn` accepts, upgraded ones included ("Learn: WHM RDM WHW" with a White Wizard along).
 */
export function learnersLine(spell: SpellData, party: readonly Character[] = []): string {
  const partyClasses = new Set(party.filter((c) => canLearn(c, spell)).map((c) => c.classData.id));
  const ids = ClassRegistry.getAll()
    .filter((c) => partyClasses.has(c.id) || (!c.upgradeFrom && c.spellLevels[spell.type] >= spell.level))
    .map((c) => classLabel(c));
  return `Learn: ${ids.length > 0 ? ids.join(' ') : '-'}`;
}

/** Whether `c`'s class can learn `spell` (its school's level reaches the spell's). */
export function canLearn(c: Character, spell: SpellData): boolean {
  return c.classData.spellLevels[spell.type] >= spell.level;
}
