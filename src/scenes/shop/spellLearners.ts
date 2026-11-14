import type { SpellData } from '../../types/index.js';
import type { Character } from '../../entities/Character.js';
import { ClassRegistry } from '../../data/ClassRegistry.js';

/** "White Mage" -> "WM", "Warrior" -> "Wa": the class initials the magic shop lists. */
export function classInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return words.length > 1 ? words.map((w) => w[0].toUpperCase()).join('') : name.slice(0, 2);
}

/**
 * Who can learn `spell`, as class initials in class order: the base classes whose spell levels reach it, plus the
 * classes of `party` that `canLearn` accepts, upgraded ones included ("Learn: WM RM WW" with a White Wizard along).
 */
export function learnersLine(spell: SpellData, party: readonly Character[] = []): string {
  const partyClasses = new Set(party.filter((c) => canLearn(c, spell)).map((c) => c.classData.id));
  const ids = ClassRegistry.getAll()
    .filter((c) => partyClasses.has(c.id) || (!c.upgradeFrom && c.spellLevels[spell.type] >= spell.level))
    .map((c) => classInitials(c.name));
  return `Learn: ${ids.length > 0 ? ids.join(' ') : '-'}`;
}

/** Whether `c`'s class can learn `spell` (its school's level reaches the spell's). */
export function canLearn(c: Character, spell: SpellData): boolean {
  return c.classData.spellLevels[spell.type] >= spell.level;
}
