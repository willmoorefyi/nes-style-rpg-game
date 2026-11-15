import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Game } from '../../src/core/Game.js';
import { FONT_SIZE, WINDOW_PADDING } from '../../src/core/LayoutConstants.js';
import { Character } from '../../src/entities/Character.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { ShopScene } from '../../src/scenes/ShopScene.js';
import { MagicShopScene } from '../../src/scenes/MagicShopScene.js';
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

  it('the quantity picker shows the total, then "Bought 2 Potions." until the next input', async () => {
    const { scene, tap, inventory } = await setup('cornelia_item');
    const price = ItemRegistry.getItem('potion')!.price;
    tap('confirm'); // Buy
    tap('confirm'); // Potion
    expect(visibleLabels(scene.container)).toContain(`Total: ${price} G`);
    tap('right');
    expect(visibleLabels(scene.container)).toContain(`Total: ${price * 2} G`);
    tap('confirm');
    expect(inventory.getQuantity('potion')).toBe(2);
    expect(scene.resultMessage).toBe('Bought 2 Potions.');
    scene.update(1); // no input: the line stays
    expect(scene.resultMessage).toBe('Bought 2 Potions.');
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

  describe('R3: the 99 cap, columns, focus and help (E1, E2, E3, E5)', () => {
    it('E1: with 99 potions, buying a Potion opens no picker, takes no gold and says so', async () => {
      const { scene, tap, party, inventory } = await setup('cornelia_item', { potion: 99 }, 500);
      tap('confirm'); // Buy
      tap('confirm'); // Potion
      expect(scene.quantityMax).toBe(0);
      expect(party.gold).toBe(500);
      expect(inventory.getQuantity('potion')).toBe(99);
      expect(scene.resultMessage).toBe("You can't carry another Potion.");
    });

    it('E1: the picker stops at the room left in the bag (95 potions, 600 G: 4)', async () => {
      const { scene, tap } = await setup('cornelia_item', { potion: 95 }, 600);
      tap('confirm');
      tap('confirm');
      expect(scene.quantityMax).toBe(4);
    });

    it('E2: every price in the weapon list ends at the same column', async () => {
      const { scene, tap } = await setup('cornelia_weapon');
      tap('confirm');
      expect(scene.itemLabels).toHaveLength(5);
      const ends = scene.itemLabels.map((l) => l.indexOf('G '));
      expect(ends[0]).toBeGreaterThan(0);
      expect(new Set(ends).size).toBe(1);
    });

    it('E2: sell rows are columns with a gap before the count', async () => {
      const { scene, tap } = await setup('cornelia_item', { wooden_shield: 2, rapier: 2 });
      tap('down');
      tap('confirm'); // Sell
      expect(scene.itemLabels.some((l) => /^Wooden Shield {2,}x2 /.test(l))).toBe(true);
    });

    it('E3: the Buy/Sell cursor greys while the list has the focus, and comes back on cancel', async () => {
      const { scene, tap } = await setup('cornelia_item');
      expect(scene.choiceActive).toBe(true);
      tap('confirm');
      expect(scene.choiceActive).toBe(false);
      tap('cancel');
      expect(scene.choiceActive).toBe(true);
    });

    it('E5: buy rows show how many the party has', async () => {
      const { scene, tap } = await setup('cornelia_item', { potion: 2 });
      tap('confirm');
      expect(scene.itemLabels[0]).toMatch(/Have {2}2$/);
    });

    it('E5: gear nobody in the party can equip is flagged in the help bar', async () => {
      const { scene, tap } = await setup('cornelia_weapon');
      tap('confirm'); // Wooden Nunchaku (Monk only)
      expect(scene.helpText).toMatch(/^No one in your party can equip this\./);
      tap('down'); // Small Knife: the thief can
      expect(scene.helpText).not.toMatch(/No one/);
    });

    it('E5: both shop scenes let the town show through', async () => {
      const { scene } = await setup('cornelia_item');
      expect(scene.transparent).toBe(true);
      const magic = new MagicShopScene({ party: { gold: 0, all: [] } } as unknown as Game, 'cornelia_white');
      expect(magic.transparent).toBe(true);
    });
  });

  describe('U9: the result line is on the help bar; the gold window shows the gold only', () => {
    it('at 99 potions, Buy > Potion puts the shared wording on the help bar', async () => {
      const { scene, tap } = await setup('cornelia_item', { potion: 99 }, 500);
      tap('confirm'); // Buy
      tap('confirm'); // Potion
      expect(scene.helpText).toBe("You can't carry another Potion.");
      expect(scene.goldLines).toEqual(['Gold: 500G']);
      tap('down');    // the next input clears it, and the help describes the item again
      expect(scene.resultMessage).toBe('');
      expect(scene.helpText).toBe(ItemRegistry.getItem('antidote')!.description);
    });

    it('"Bought 2 Potions." replaces the description on the help bar until the next input', async () => {
      const { scene, tap } = await setup('cornelia_item');
      tap('confirm');
      tap('confirm');
      tap('right');
      tap('confirm');
      expect(scene.helpText).toBe('Bought 2 Potions.');
      expect(scene.goldLines).toHaveLength(1);
      scene.update(1);
      expect(scene.helpText).toBe('Bought 2 Potions.');
    });
  });

  describe('U11: "Equip it now?" after buying gear', () => {
    /** Buy `count` of the weapon shop's Rapier (row 4) with a Lv 1, unequipped party. */
    async function buyRapiers(count: number) {
      const s = await setup('cornelia_weapon', {}, 400);
      for (const c of s.party.all) c.unequip('weapon');
      s.tap('confirm'); // Buy
      const row = ShopRegistry.getShop('cornelia_weapon')!.inventory.indexOf('rapier');
      for (let i = 0; i < row; i++) s.tap('down');
      s.tap('confirm'); // Rapier
      for (let i = 1; i < count; i++) s.tap('right');
      s.tap('confirm'); // buy
      return s;
    }

    it('buying a Rapier asks, with FGHTR and THIEF enabled and the mages greyed', async () => {
      const { scene, tap, party, inventory } = await buyRapiers(1);
      const rows = scene.equipPromptRows;
      expect(rows.map((r) => r.enabled)).toEqual([true, true, false, false, true]);
      expect(rows[0].label).toMatch(/^FGHTR {2}ATK \d+→\d+ {2}\+\d+$/);
      expect(rows[4].label).toBe('Not now');
      tap('confirm'); // FGHTR
      expect(party.get(0)!.getEquipped('weapon')?.id).toBe('rapier');
      expect(inventory.getQuantity('rapier')).toBe(0);
      expect(party.gold).toBe(390);
      expect(scene.equipPromptRows).toEqual([]);
    });

    it('the prompt sits over the comparison panel, clear of the item list and its prices (old: x 320 hid them)', async () => {
      const { scene } = await buyRapiers(1);
      const prompt = scene.equipPromptRect!;
      const list = scene.itemWindowRect;
      const panel = scene.detailWindowRect;
      expect(prompt.x).toBeGreaterThanOrEqual(list.x + list.width);
      expect(prompt.x + prompt.width).toBeLessThanOrEqual(panel.x + panel.width);
      expect(prompt.y + prompt.height).toBeLessThanOrEqual(panel.y + panel.height);
    });

    it('"Not now" leaves the Rapier in the bag', async () => {
      const { scene, tap, party, inventory } = await buyRapiers(1);
      tap('up'); // wraps to "Not now"
      tap('confirm');
      expect(scene.equipPromptRows).toEqual([]);
      expect(inventory.getQuantity('rapier')).toBe(1);
      expect(party.get(0)!.getEquipped('weapon')).toBeNull();
    });

    it('two Rapiers ask again for the second copy: FGHTR, then THIEF', async () => {
      const { scene, tap, party, inventory } = await buyRapiers(2);
      tap('confirm'); // FGHTR
      const again = scene.equipPromptRows;
      expect(again.map((r) => r.enabled)).toEqual([false, true, false, false, true]);
      expect(again[0].label).toMatch(/equipped$/);
      tap('confirm'); // the cursor starts on THIEF
      expect(party.get(1)!.getEquipped('weapon')?.id).toBe('rapier');
      expect(inventory.getQuantity('rapier')).toBe(0);
      expect(scene.equipPromptRows).toEqual([]);
    });

    /** Buy `count` of the weapon shop's `id` after `dress` has equipped the party. */
    async function buyWeapon(id: string, count: number, dress: (party: PartyManager) => void) {
      const s = await setup('cornelia_weapon', {}, 400);
      dress(s.party);
      s.tap('confirm'); // Buy
      const row = ShopRegistry.getShop('cornelia_weapon')!.inventory.indexOf(id);
      for (let i = 0; i < row; i++) s.tap('down');
      s.tap('confirm');
      for (let i = 1; i < count; i++) s.tap('right');
      s.tap('confirm');
      return s;
    }
    const wield = (party: PartyManager, ids: string[]): void => {
      party.all.forEach((c, i) => { c.unequip('weapon'); if (ids[i]) c.equip('weapon', ItemRegistry.getItem(ids[i])!); });
    };

    it('the cursor starts on the biggest gain, not on a downgrade (FGHTR with a Rapier, THIEF bare-handed)', async () => {
      const { scene, tap, party } = await buyWeapon('small_knife', 1, (p) => wield(p, ['rapier']));
      const rows = scene.equipPromptRows;
      expect(rows[0].label).toMatch(/^FGHTR {2}ATK (\d+)→(\d+) {2}-\d+$/);
      expect(rows[1].label).toMatch(/^THIEF {2}ATK \d+→\d+ {2}\+\d+$/);
      tap('confirm'); // mashing Z
      expect(party.get(0)!.getEquipped('weapon')?.id).toBe('rapier');
      expect(party.get(1)!.getEquipped('weapon')?.id).toBe('small_knife');
    });

    it('when nobody gains, the cursor starts on "Not now"', async () => {
      const { scene, tap, party, inventory } = await buyWeapon('small_knife', 1,
        (p) => wield(p, ['rapier', 'rapier', 'staff', 'staff']));
      const rows = scene.equipPromptRows;
      expect(rows.slice(0, 4).every((r) => r.enabled && /-\d+$/.test(r.label))).toBe(true);
      tap('confirm');
      expect(scene.equipPromptRows).toEqual([]);
      expect(inventory.getQuantity('small_knife')).toBe(1);
      expect(party.all.map((c) => c.getEquipped('weapon')?.id)).toEqual(['rapier', 'rapier', 'staff', 'staff']);
    });

    it('the comparison panel follows each equip while the prompt repeats', async () => {
      const { scene, tap } = await buyRapiers(2);
      expect(scene.detailLines[1].text).toMatch(/^FGHTR .*\+\d+$/);
      tap('confirm'); // FGHTR takes one; the prompt asks again for THIEF
      expect(scene.equipPromptRows).not.toEqual([]);
      expect(scene.detailLines[1].text).toMatch(/^FGHTR .*->(\d+) {2}0$/);
      expect(scene.detailLines[2].text).toMatch(/^THIEF .*\+\d+$/);
    });

    it('buying a Potion opens no prompt', async () => {
      const { scene, tap } = await setup('cornelia_item');
      tap('confirm');
      tap('confirm');
      tap('confirm');
      expect(scene.equipPromptRows).toEqual([]);
      expect(scene.resultMessage).toBe('Bought 1 Potion.');
    });
  });
});
