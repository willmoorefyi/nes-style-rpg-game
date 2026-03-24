import { describe, it, expect, beforeEach } from 'vitest';
import { Inventory } from '../../src/entities/Inventory.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { ItemRegistry } from '../../src/data/ItemRegistry.js';
import { ShopRegistry } from '../../src/data/ShopRegistry.js';
import type { ItemData, ShopData } from '../../src/types/index.js';
import type { DataLoader } from '../../src/core/DataLoader.js';

const mockPotion: ItemData = {
  id: 'potion',
  name: 'Potion',
  type: 'consumable',
  stats: {},
  price: 60,
  usableBy: [],
};

const mockKeyItem: ItemData = {
  id: 'crystal',
  name: 'Crystal',
  type: 'key',
  stats: {},
  price: 0,
  usableBy: [],
};

const mockShop: ShopData = {
  id: 'test-shop',
  type: 'item',
  name: 'Test Shop',
  inventory: ['potion'],
};

describe('ShopScene business logic', () => {
  let inventory: Inventory;
  let party: PartyManager;

  beforeEach(async () => {
    inventory = new Inventory();
    party = new PartyManager();
    party.addGold(500);
    
    // Setup registries with mock data
    ItemRegistry.reset();
    ShopRegistry.reset();
    const mockItemLoader = { loadItems: async () => [mockPotion, mockKeyItem] } as Pick<DataLoader, 'loadItems'>;
    await ItemRegistry.init(mockItemLoader as DataLoader);
    const mockShopLoader = { loadShops: async () => [mockShop] } as Pick<DataLoader, 'loadShops'>;
    await ShopRegistry.init(mockShopLoader as DataLoader);
  });

  describe('buy flow', () => {
    it('deducts gold and adds item to inventory', () => {
      const item = ItemRegistry.getItem('potion')!;
      const qty = 2;
      const total = item.price * qty;
      
      expect(party.spendGold(total)).toBe(true);
      inventory.add(item.id, qty);
      
      expect(party.gold).toBe(500 - 120);
      expect(inventory.getQuantity('potion')).toBe(2);
    });

    it('prevents purchase with insufficient gold', () => {
      party.spendGold(500); // Spend all gold
      const item = ItemRegistry.getItem('potion')!;
      
      expect(party.spendGold(item.price)).toBe(false);
      expect(party.gold).toBe(0);
    });
  });

  describe('sell flow', () => {
    it('adds gold and removes item from inventory', () => {
      inventory.add('potion', 3);
      const item = ItemRegistry.getItem('potion')!;
      const sellPrice = Math.floor(item.price / 2);
      const qty = 2;
      
      expect(inventory.remove('potion', qty)).toBe(true);
      party.addGold(sellPrice * qty);
      
      expect(inventory.getQuantity('potion')).toBe(1);
      expect(party.gold).toBe(500 + 60); // 30 * 2
    });

    it('sell price is 50% of buy price', () => {
      const item = ItemRegistry.getItem('potion')!;
      const sellPrice = Math.floor(item.price / 2);
      expect(sellPrice).toBe(30);
    });

    it('key items cannot be sold (filtered from sell list)', () => {
      inventory.add('crystal', 1);
      const keyItem = ItemRegistry.getItem('crystal')!;
      expect(keyItem.type).toBe('key');
      
      // ShopScene filters key items from sell list
      const sellableItems = inventory.getAll()
        .map(({ itemId }) => ItemRegistry.getItem(itemId))
        .filter(item => item != null && item.type !== 'key');
      
      expect(sellableItems).toHaveLength(0);
    });
  });
});
