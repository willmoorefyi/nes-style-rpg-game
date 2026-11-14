import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Game } from '../../src/core/Game.js';
import { FONT_SIZE, WINDOW_PADDING } from '../../src/core/LayoutConstants.js';
import { Character } from '../../src/entities/Character.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { ShopScene } from '../../src/scenes/ShopScene.js';
import { loadRealRegistries, tapInput, visibleLabels } from '../helpers/realData.js';
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

describe('MS-5: shop layout, quantity total, result line and cursor', () => {
  // Real data for these cases (the business-logic cases above reset the registries to mocks).
  const setup = async (shopId: string, inv: Record<string, number> = {}, gold = 10000) => {
    await loadRealRegistries();
    const input = tapInput();
    const party = new PartyManager();
    for (const [name, cls] of [['FGHTR', 'warrior'], ['THIEF', 'thief'], ['W.MAG', 'white_mage'], ['B.MAG', 'black_mage']]) {
      party.add(new Character({ name, classData: ClassRegistry.getClass(cls)! }));
    }
    party.addGold(gold);
    const inventory = new Inventory();
    for (const [id, n] of Object.entries(inv)) inventory.add(id, n);
    const game = { input, inventory, party, events: { emit: vi.fn() }, scenes: { pop: vi.fn() } };
    const scene = new ShopScene(game as unknown as Game, shopId);
    scene.enter();
    const tap = (a: Parameters<typeof input.tap>[0]): void => input.tap(a, () => scene.update(1));
    return { scene, tap, party, inventory };
  };

  it('the item list ends before the comparison panel, and every comparison line fits the panel', async () => {
    const { scene, tap } = await setup('cornelia_weapon');
    tap('confirm'); // Buy
    scene.update(1); // draws the panel
    expect(scene.detailVisible).toBe(true);
    const list = scene.itemWindowRect;
    const panel = scene.detailWindowRect;
    expect(list.x + list.width).toBeLessThanOrEqual(panel.x);
    const lines = scene.detailLines;
    expect(lines).toHaveLength(5); // the item, then one line per member
    const contentBottom = panel.height - WINDOW_PADDING;
    for (const l of lines) expect(l.y + FONT_SIZE).toBeLessThanOrEqual(contentBottom);
    // closing the list gives it the full width back
    tap('cancel');
    expect(scene.itemWindowRect.width).toBeGreaterThan(panel.x);
  });

  it('the quantity picker shows the total, then "Bought 2 Potion." until the next input', async () => {
    const { scene, tap, inventory } = await setup('cornelia_item');
    const price = ItemRegistry.getItem('potion')!.price;
    tap('confirm'); // Buy
    tap('confirm'); // Potion
    expect(visibleLabels(scene.container)).toContain(`Total: ${price} G`);
    tap('right');
    expect(visibleLabels(scene.container)).toContain(`Total: ${price * 2} G`);
    tap('confirm');
    expect(inventory.getQuantity('potion')).toBe(2);
    expect(scene.resultMessage).toBe('Bought 2 Potion.');
    scene.update(1); // no input: the line stays
    expect(scene.resultMessage).toBe('Bought 2 Potion.');
    tap('down');
    expect(scene.resultMessage).toBe('');
  });

  it('after a sale the cursor stays on the same row and "Sold" shows', async () => {
    const { scene, tap, inventory } = await setup('cornelia_item', { potion: 3, antidote: 2, tent: 1 });
    tap('down'); // Sell
    tap('confirm');
    tap('down'); // the middle row: Antidote
    expect(scene.itemIndex).toBe(1);
    tap('confirm'); // picker
    tap('confirm'); // sell 1
    expect(inventory.getQuantity('antidote')).toBe(1);
    expect(scene.itemIndex).toBe(1);
    expect(scene.resultMessage).toBe('Sold 1 Antidote.');
  });
});
