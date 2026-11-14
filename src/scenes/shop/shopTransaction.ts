import type { ItemData } from '../../types/index.js';
import { Inventory } from '../../entities/Inventory.js';
import { cantCarryText } from '../../systems/pickupText.js';

/** The party's gold, as the shop uses it. */
export interface ShopPurse {
  readonly gold: number;
  spendGold(amount: number): boolean;
  addGold(amount: number): void;
}

export interface ShopResult {
  ok: boolean;
  message: string;
}

/** The most of an item the party can buy: limited by the 99 cap, the gold and the room left in the bag (E1). */
export function maxBuyQty(gold: number, price: number, space: number): number {
  const affordable = price > 0 ? Math.floor(gold / price) : Inventory.MAX_QUANTITY;
  return Math.max(0, Math.min(Inventory.MAX_QUANTITY, affordable, space));
}

/** The sale price: half the shop price, rounded down. */
export function sellPrice(item: ItemData): number {
  return Math.floor(item.price / 2);
}

/** Buy `qty` of `item`; nothing is paid unless every one of them fits in the bag. */
export function buy(purse: ShopPurse, inventory: Inventory, item: ItemData, qty: number): ShopResult {
  if (!inventory.canAdd(item.id, qty)) return { ok: false, message: cantCarryText(item.id) };
  if (!purse.spendGold(item.price * qty)) return { ok: false, message: 'Not enough gold.' };
  const added = inventory.add(item.id, qty);
  if (added !== qty) {
    // canAdd was checked above; logged so a future change can't lose items silently
    console.error(`shop buy: added ${added} of ${qty} ${item.id}`);
  }
  return { ok: true, message: `Bought ${qty} ${item.name}.` };
}

/** Sell `qty` of `item` at half price. */
export function sell(purse: ShopPurse, inventory: Inventory, item: ItemData, qty: number): ShopResult {
  if (!inventory.remove(item.id, qty)) return { ok: false, message: `You don't have ${qty} ${item.name}.` };
  purse.addGold(sellPrice(item) * qty);
  return { ok: true, message: `Sold ${qty} ${item.name}.` };
}
