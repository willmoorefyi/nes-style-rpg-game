import type { CharacterClassData, EquipmentSlot, ItemData } from '../types/index.js';
import type { Character } from './Character.js';
import type { Inventory } from './Inventory.js';
import { cantCarryText } from '../systems/pickupText.js';

/**
 * The one equipment slot an item fits: its explicit `slot`, else weapons go in `weapon` and other
 * armour (no slot given) is body armour. Consumables and key items fit no slot.
 */
export function slotOf(item: ItemData): EquipmentSlot | null {
  if (item.type !== 'weapon' && item.type !== 'armor') return null;
  return item.slot ?? (item.type === 'weapon' ? 'weapon' : 'armor');
}

/** The class id an item's `usableBy` is read for: a copy class equips as its classic source (pass EQ D-EQ4). */
export function equipClassOf(c: Pick<CharacterClassData, 'id' | 'copyOf'>): string {
  return c.copyOf ?? c.id;
}

/** Shown when an item doesn't fit the member or the slot. */
export const CANT_EQUIP_TEXT = "Can't equip that there.";

export type EquipResult = { ok: true } | { ok: false; message: string };

type EquipMember = Pick<Character, 'name' | 'canEquipIn' | 'getEquipped' | 'equip' | 'unequip'>;
type Bag = Pick<Inventory, 'canAdd' | 'add' | 'remove'>;

/**
 * Put `item` from the bag into `member`'s `slot` (`null` unequips), the worn item going back to the bag (U9).
 * Checked before anything moves, so a refusal never costs the member what they wore:
 * - an item that doesn't fit the member or the slot: "Can't equip that there.";
 * - the item already worn: nothing changes (no copy cycles through a full bag);
 * - the bag already holds 99 of the worn item: `cantCarryText(worn)`.
 * The new item leaves the bag before the worn one enters, so a full bag never loses a copy.
 */
export function equipFromBag(member: EquipMember, slot: EquipmentSlot, item: ItemData | null, bag: Bag): EquipResult {
  if (item && !member.canEquipIn(slot, item)) return { ok: false, message: CANT_EQUIP_TEXT };
  const worn = member.getEquipped(slot);
  if (worn && item && worn.id === item.id) return { ok: true };
  if (worn && !bag.canAdd(worn.id)) return { ok: false, message: cantCarryText(worn.id) };
  if (item && !bag.remove(item.id)) {
    console.error(`equipFromBag: ${item.id} is not in the bag`);
    return { ok: false, message: CANT_EQUIP_TEXT };
  }
  const prev = member.unequip(slot);
  if (item && member.equip(slot, item) === false) {
    console.error(`equipFromBag: ${member.name} refused ${item.id}`);
    bag.add(item.id);
  }
  if (prev && bag.add(prev.id) < 1) console.error(`equipFromBag: no room for ${prev.id}`);
  return { ok: true };
}
