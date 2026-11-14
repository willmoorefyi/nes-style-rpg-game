import type { EquipmentSlot, ItemData } from '../types/index.js';

/**
 * The one equipment slot an item fits: its explicit `slot`, else weapons go in `weapon` and other
 * armour (no slot given) is body armour. Consumables and key items fit no slot.
 */
export function slotOf(item: ItemData): EquipmentSlot | null {
  if (item.type !== 'weapon' && item.type !== 'armor') return null;
  return item.slot ?? (item.type === 'weapon' ? 'weapon' : 'armor');
}
