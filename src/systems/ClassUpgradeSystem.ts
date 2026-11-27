import type { Character } from '../entities/Character.js';
import type { GameFlags } from '../core/GameFlags.js';
import type { CharacterClassData } from '../types/index.js';

/** Base class → upgraded class mapping (FF1 class upgrades) */
export const CLASS_UPGRADES: Record<string, string> = {
  warrior: 'knight',
  thief: 'ninja',
  monk: 'master',
  white_mage: 'white_wizard',
  black_mage: 'black_wizard',
  red_mage: 'red_wizard',
  barbarian: 'berserker', // pass CB (docs/CLASS_BARBARIAN_PLAN.md D-CB3)
  legionnaire: 'centurion', // pass CB (docs/CLASS_BARBARIAN_PLAN.md 11)
};

/** Set of upgraded class IDs for quick lookup */
const UPGRADED_CLASSES = new Set(Object.values(CLASS_UPGRADES));

/**
 * Check if a character is eligible for class upgrade: a base class, and the upgrading NPC's `actionFlag` set (GAP-8:
 * the flag is data, e.g. the Ordeal's seal; an NPC without one upgrades at once).
 */
export function canUpgrade(character: Character, flags: GameFlags, actionFlag?: string): boolean {
  if (actionFlag !== undefined && !flags.has(actionFlag)) return false;
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

/** Upgrade all eligible party members (see canUpgrade for `actionFlag`). Returns a message per upgraded character. */
export function upgradeParty(
  party: Character[],
  flags: GameFlags,
  classRegistry: Map<string, CharacterClassData>,
  actionFlag?: string,
): string[] {
  const messages: string[] = [];
  for (const member of party) {
    if (canUpgrade(member, flags, actionFlag)) {
      const oldName = member.classData.name;
      const newName = performUpgrade(member, classRegistry);
      if (newName) {
        messages.push(`${member.name}'s ${oldName} became ${newName}!`);
      }
    }
  }
  return messages;
}
