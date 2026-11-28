/**
 * Cross-record checks of the class list (docs/CLASS_BARBARIAN_PLAN.md 17): a class's `copyOf` names the classic class
 * it is an exact copy of. Only an original can be copied, a copy stays in its tier, and an upgraded copy upgrades the
 * copy of its original's base (berserker copies the knight because the barbarian copies the warrior).
 */
import type { CharacterClassData } from '../types/index.js';

export function validateClassCopies(classes: CharacterClassData[]): void {
  const byId = new Map(classes.map((c) => [c.id, c]));
  for (const c of classes) {
    if (c.copyOf === undefined) continue;
    const where = `CharacterClassData ${c.id}: copyOf ${c.copyOf}`;
    const of = byId.get(c.copyOf);
    if (!of) throw new Error(`${where} names no class`);
    if (of.id === c.id) throw new Error(`${where} names the class itself`);
    if (of.copyOf !== undefined) throw new Error(`${where} is a copy itself (only an original can be copied)`);
    if ((c.upgradeFrom === undefined) !== (of.upgradeFrom === undefined)) {
      throw new Error(`${where} is in the other tier (a base class copies a base class, an upgrade an upgrade)`);
    }
    if (c.upgradeFrom !== undefined) {
      const base = byId.get(c.upgradeFrom);
      if (base?.copyOf !== of.upgradeFrom) {
        throw new Error(`${where} does not match its base ${c.upgradeFrom} (copyOf ${base?.copyOf ?? 'none'}, `
          + `${of.id} upgrades ${of.upgradeFrom})`);
      }
    }
  }
}
