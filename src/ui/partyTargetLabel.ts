import type { Character } from '../entities/Character.js';
import { isFallen } from '../systems/FieldSpellEffects.js';

/**
 * A party target row: `NAME  HP cur/max  STATUS` (MS-7), so the player sees who needs the item or spell. Shared by
 * the field Items and Magic target lists, so both mark the fallen the same way ("KO").
 */
export function targetLabel(c: Character, nameWidth: number): string {
  const status = isFallen(c) ? 'KO' : c.statusTracker.getAll().map((s) => s.effect.toUpperCase()).join(' ');
  const hp = `HP ${String(c.currentHp).padStart(3)}/${String(c.maxHp).padStart(3)}`;
  return `${c.name.padEnd(nameWidth)}  ${hp}${status ? `  ${status}` : ''}`;
}

/** The target rows for `party`, names padded so every HP column lines up. */
export function targetRows(party: readonly Character[]): Array<{ label: string; value: string }> {
  const nameWidth = Math.max(0, ...party.map((c) => c.name.length));
  return party.map((c, i) => ({ label: targetLabel(c, nameWidth), value: String(i) }));
}
