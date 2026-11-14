/**
 * Party inventory for tracking items and quantities.
 * FF1-style: max 99 per item type.
 */
export class Inventory {
  private items = new Map<string, number>();
  static readonly MAX_QUANTITY = 99;

  /** How many more of `itemId` fit before the 99 cap. */
  space(itemId: string): number {
    return Math.max(0, Inventory.MAX_QUANTITY - this.getQuantity(itemId));
  }

  /** Whether `quantity` more of `itemId` fit (E1: a chest stays closed when they don't). */
  canAdd(itemId: string, quantity = 1): boolean {
    return quantity <= this.space(itemId);
  }

  /** Add up to the cap; returns the number actually added (0 when full). */
  add(itemId: string, quantity = 1): number {
    const added = Math.max(0, Math.min(quantity, this.space(itemId)));
    if (added > 0) this.items.set(itemId, this.getQuantity(itemId) + added);
    return added;
  }

  remove(itemId: string, quantity = 1): boolean {
    const current = this.items.get(itemId) ?? 0;
    if (current < quantity) return false;
    const newQty = current - quantity;
    if (newQty === 0) {
      this.items.delete(itemId);
    } else {
      this.items.set(itemId, newQty);
    }
    return true;
  }

  getQuantity(itemId: string): number {
    return this.items.get(itemId) ?? 0;
  }

  has(itemId: string): boolean {
    return this.items.has(itemId);
  }

  clear(): void {
    this.items.clear();
  }

  getAll(): Array<{ itemId: string; quantity: number }> {
    return Array.from(this.items.entries()).map(([itemId, quantity]) => ({ itemId, quantity }));
  }

  toJSON(): Array<{ itemId: string; quantity: number }> {
    return this.getAll();
  }

  static fromJSON(data: Array<{ itemId: string; quantity: number }>): Inventory {
    const inv = new Inventory();
    for (const { itemId, quantity } of data) {
      inv.items.set(itemId, Math.min(quantity, Inventory.MAX_QUANTITY));
    }
    return inv;
  }
}
