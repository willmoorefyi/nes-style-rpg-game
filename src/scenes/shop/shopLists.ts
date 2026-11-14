import type { MenuItem } from '../../ui/Menu.js';
import type { Inventory } from '../../entities/Inventory.js';
import { ItemRegistry } from '../../data/ItemRegistry.js';
import { ShopRegistry } from '../../data/ShopRegistry.js';

/** The shop's stock with prices; items the party can't afford are disabled. */
export function buyItems(shopId: string, gold: number): MenuItem[] {
  const shop = ShopRegistry.getShop(shopId);
  if (!shop) return [];
  return shop.inventory.map((id) => {
    const item = ItemRegistry.getItem(id);
    if (!item) return { label: id, value: id, enabled: false };
    return { label: `${item.name.padEnd(12)}${String(item.price).padStart(5)}G`, value: id, enabled: gold >= item.price };
  });
}

/** The party's sellable items (no key items) with counts and the half-price sale value. */
export function sellItems(inventory: Inventory): MenuItem[] {
  const entries = inventory.getAll()
    .map(({ itemId, quantity }) => ({ item: ItemRegistry.getItem(itemId), itemId, quantity }))
    .filter((e): e is { item: NonNullable<typeof e.item>; itemId: string; quantity: number } =>
      e.item != null && e.item.type !== 'key');
  const maxLen = Math.max(12, ...entries.map((e) => e.item.name.length));
  return entries.map(({ item, itemId, quantity }) => {
    const sellPrice = Math.floor(item.price / 2);
    return { label: `${item.name.padEnd(maxLen)}x${quantity} ${String(sellPrice).padStart(4)}G`, value: itemId };
  });
}

/** Weapon and armour shops show the comparison panel while buying. */
export function isEquipmentShop(shopId: string): boolean {
  const type = ShopRegistry.getShop(shopId)?.type;
  return type === 'weapon' || type === 'armor';
}
