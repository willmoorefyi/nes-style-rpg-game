import type { DataLoader } from '../core/DataLoader.js';
import type { ShopData } from '../types/index.js';

export class ShopRegistry {
  private static shops: Map<string, ShopData> = new Map();
  private static initialized = false;

  static async init(loader: DataLoader): Promise<void> {
    if (this.initialized) return;
    const data = await loader.loadShops('assets/data/shops.json');
    for (const shop of data) {
      this.shops.set(shop.id, shop);
    }
    this.initialized = true;
  }

  static getShop(id: string): ShopData | undefined {
    return this.shops.get(id);
  }

  static reset(): void {
    this.shops.clear();
    this.initialized = false;
  }
}
