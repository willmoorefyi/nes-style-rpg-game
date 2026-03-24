import type { Character } from '../entities/Character.js';
import type { GameFlags } from '../core/GameFlags.js';
import { STORY_FLAGS } from '../core/GameFlags.js';
import type { CharacterClassData } from '../types/index.js';

/** Base class → upgraded class mapping (FF1 class upgrades) */
export const CLASS_UPGRADES: Record<string, string> = {
  warrior: 'knight',
  thief: 'ninja',
  monk: 'master',
  white_mage: 'white_wizard',
  black_mage: 'black_wizard',
  red_mage: 'red_wizard',
};

/** Set of upgraded class IDs for quick lookup */
const UPGRADED_CLASSES = new Set(Object.values(CLASS_UPGRADES));

/** Check if a character is eligible for class upgrade */
export function canUpgrade(character: Character, flags: GameFlags): boolean {
  if (!flags.has(STORY_FLAGS.EARTH_CRYSTAL_LIT)) return false;
  const classId = character.classData.id;
  return classId in CLASS_UPGRADES && !UPGRADED_CLASSES.has(classId);
}

/** Perform a class upgrade on a single character. Returns the new class name or null if ineligible. */
export function performUpgrade(
  character: Character,
  classRegistry: Map<string, CharacterClassData>,
): string | null {
  const upgradeId = CLASS_UPGRADES[character.classData.id];
  if (!upgradeId) return null;
  const newClass = classRegistry.get(upgradeId);
  if (!newClass) return null;
  character.upgrade(newClass);
  return newClass.name;
}

/** Upgrade all eligible party members. Returns a message per upgraded character. */
export function upgradeParty(
  party: Character[],
  flags: GameFlags,
  classRegistry: Map<string, CharacterClassData>,
): string[] {
  const messages: string[] = [];
  for (const member of party) {
    if (canUpgrade(member, flags)) {
      const oldName = member.classData.name;
      const newName = performUpgrade(member, classRegistry);
      if (newName) {
        messages.push(`${member.name}'s ${oldName} became ${newName}!`);
      }
    }
  }
  return messages;
}
