import type { MenuItem } from '../../ui/Menu.js';
import type { Inventory } from '../../entities/Inventory.js';
import type { Character } from '../../entities/Character.js';
import type { ItemData } from '../../types/index.js';
import { ItemRegistry } from '../../data/ItemRegistry.js';
import { ShopRegistry } from '../../data/ShopRegistry.js';
import { slotOf } from '../../entities/EquipmentRules.js';
import { columns } from './shopLayout.js';

/** The shop's stock as `Name  price G  Have N` columns (E2, E5); items the party can't afford are disabled. */
export function buyItems(shopId: string, gold: number, inventory?: Inventory): MenuItem[] {
  const shop = ShopRegistry.getShop(shopId);
  if (!shop) return [];
  const items = shop.inventory.map((id) => ({ id, item: ItemRegistry.getItem(id) }));
  const known = items.filter((e): e is { id: string; item: ItemData } => e.item != null);
  const labels = columns(known.map(({ id, item }) => [
    item.name,
    `${item.price}G`,
    `Have ${String(inventory?.getQuantity(id) ?? 0).padStart(2)}`,
  ]), ['left', 'right', 'left']);
  const byId = new Map(known.map(({ id, item }, i) => [id, { item, label: labels[i] }]));
  return items.map(({ id }) => {
    const row = byId.get(id);
    if (!row) return { label: id, value: id, enabled: false };
    return { label: row.label, value: id, enabled: gold >= row.item.price };
  });
}

/** The party's sellable items (no key items) as `Name  xN  price G` columns, at the half-price sale value. */
export function sellItems(inventory: Inventory): MenuItem[] {
  const entries = inventory.getAll()
    .map(({ itemId, quantity }) => ({ item: ItemRegistry.getItem(itemId), itemId, quantity }))
    .filter((e): e is { item: NonNullable<typeof e.item>; itemId: string; quantity: number } =>
      e.item != null && e.item.type !== 'key');
  const labels = columns(entries.map(({ item, quantity }) => [item.name, `x${quantity}`, `${Math.floor(item.price / 2)}G`]),
    ['left', 'left', 'right']);
  return entries.map(({ itemId }, i) => ({ label: labels[i], value: itemId }));
}

/** Weapon and armour shops show the comparison panel while buying. */
export function isEquipmentShop(shopId: string): boolean {
  const type = ShopRegistry.getShop(shopId)?.type;
  return type === 'weapon' || type === 'armor';
}

/** The help bar for `item`: its description, with a warning first when it is gear nobody in `party` can equip (E5). */
export function shopHelp(item: ItemData | undefined, party: readonly Character[]): string {
  if (!item) return '';
  const description = item.description ?? '';
  if (slotOf(item) && party.length > 0 && !party.some((c) => c.canEquip(item))) {
    return `No one in your party can equip this. ${description}`.trimEnd();
  }
  return description;
}
