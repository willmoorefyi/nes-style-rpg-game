/**
 * Party inventory for tracking items and quantities.
 * FF1-style: max 99 per item type.
 */
export class Inventory {
  private items = new Map<string, number>();
  private static readonly MAX_QUANTITY = 99;

  add(itemId: string, quantity = 1): void {
    const current = this.items.get(itemId) ?? 0;
    this.items.set(itemId, Math.min(current + quantity, Inventory.MAX_QUANTITY));
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

  getAll(): Array<{ itemId: string; quantity: number }> {
    return Array.from(this.items.entries()).map(([itemId, quantity]) => ({ itemId, quantity }));
  }
}
