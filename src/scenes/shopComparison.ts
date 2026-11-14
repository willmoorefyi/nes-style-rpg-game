import type { EquipmentSlot, ItemData } from '../types/index.js';
import { partyAbsorb, partyAttack, partyHits, withEquipped, type MemberView } from '../battle/CombatStats.js';

/** One member's before/after numbers for a piece of equipment in the shop. */
export interface EquipComparison {
  label: 'ATK' | 'DEF';
  /** The battle number now: `partyAttack` for a weapon, `partyAbsorb` for armour. */
  now: number;
  /** The same number with the item equipped in `slot`. */
  next: number;
  /** `next − now`; negative when the item is worse (e.g. bare hands beat it). */
  diff: number;
  /** Hits per attack now and with the item (weapons only). */
  nowHits?: number;
  nextHits?: number;
}

/**
 * The shop's comparison, on the battle formulas (FF1 `CombatStats`), so a Monk's unarmed attack and double hits, or
 * his absorb without body armour, are compared as they really fight.
 */
export function compareEquip(c: MemberView, item: ItemData, slot: EquipmentSlot): EquipComparison {
  const after = withEquipped(c, slot, item);
  if (item.type === 'weapon') {
    const now = partyAttack(c);
    const next = partyAttack(after);
    return { label: 'ATK', now, next, diff: next - now, nowHits: partyHits(c), nextHits: partyHits(after) };
  }
  const now = partyAbsorb(c);
  const next = partyAbsorb(after);
  return { label: 'DEF', now, next, diff: next - now };
}

/** The hit count matters when it changes or is above one: " (2 hits)". */
export function hitsSuffix(cmp: EquipComparison, hits: number | undefined): string {
  if (hits === undefined) return '';
  const matters = cmp.nowHits !== cmp.nextHits || (cmp.nowHits ?? 1) > 1 || (cmp.nextHits ?? 1) > 1;
  if (!matters) return '';
  return hits === 1 ? ' (1 hit)' : ` (${hits} hits)`;
}
