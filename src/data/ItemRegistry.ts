import type { DataLoader } from '../core/DataLoader.js';
import type { ItemData, ItemType } from '../types/index.js';

export class ItemRegistry {
  private static items: Map<string, ItemData> = new Map();
  private static initialized = false;

  static async init(loader: DataLoader): Promise<void> {
    if (this.initialized) return;
    const data = await loader.loadItems('assets/data/items.yaml');
    for (const item of data) {
      this.items.set(item.id, item);
    }
    this.initialized = true;
  }

  static getItem(id: string): ItemData | undefined {
    return this.items.get(id);
  }

  static getAllByType(type: ItemType): ItemData[] {
    return Array.from(this.items.values()).filter(item => item.type === type);
  }

  static reset(): void {
    this.items.clear();
    this.initialized = false;
  }
}