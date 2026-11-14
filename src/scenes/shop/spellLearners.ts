import type { SpellData } from '../../types/index.js';
import type { Character } from '../../entities/Character.js';
import { ClassRegistry } from '../../data/ClassRegistry.js';

/** "White Mage" -> "WM", "Warrior" -> "Wa": the class initials the magic shop lists. */
export function classInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return words.length > 1 ? words.map((w) => w[0].toUpperCase()).join('') : name.slice(0, 2);
}

/** The base classes (no upgrades) whose spell levels reach `spell`, as initials: "Learn: WM RM". */
export function learnersLine(spell: SpellData): string {
  const ids = ClassRegistry.getAll()
    .filter((c) => !c.upgradeFrom && c.spellLevels[spell.type] >= spell.level)
    .map((c) => classInitials(c.name));
  return `Learn: ${ids.length > 0 ? ids.join(' ') : '-'}`;
}

/** Whether `c`'s class can learn `spell` (its school's level reaches the spell's). */
export function canLearn(c: Character, spell: SpellData): boolean {
  return c.classData.spellLevels[spell.type] >= spell.level;
}
