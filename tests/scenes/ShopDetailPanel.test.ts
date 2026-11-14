import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Game } from '../../src/core/Game.js';
import { CHAR_WIDTH, LINE_HEIGHT, WINDOW_PADDING } from '../../src/core/LayoutConstants.js';
import { Character } from '../../src/entities/Character.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { ItemRegistry } from '../../src/data/ItemRegistry.js';
import { ShopScene } from '../../src/scenes/ShopScene.js';
import { ShopDetailPanel, DETAIL_RECT } from '../../src/scenes/shop/ShopDetailPanel.js';
import { loadRealRegistries, tapInput } from '../helpers/realData.js';

beforeAll(loadRealRegistries);

function open(shopId: string, inv: Record<string, number> = {}) {
  const input = tapInput();
  const all = ['warrior', 'thief', 'white_mage', 'black_mage'].map((cls, i) => new Character({ name: `M${i}`, classData: ClassRegistry.getClass(cls)! }));
  const inventory = new Inventory();
  for (const [id, n] of Object.entries(inv)) inventory.add(id, n);
  const game = { input, inventory, party: { all, gold: 10000 }, events: { emit: vi.fn() }, scenes: { pop: vi.fn() } };
  const scene = new ShopScene(game as unknown as Game, shopId);
  scene.enter();
  const tap = (a: Parameters<typeof input.tap>[0]): void => input.tap(a, () => scene.update(1));
  return { scene, tap };
}

describe('T6f: the shop detail panel and the help bar show item descriptions', () => {
  it('the equipment panel shows the highlighted item\'s description under the comparison lines', () => {
    const { scene, tap } = open('cornelia_weapon');
    tap('confirm'); // Buy: the Wooden Nunchaku
    const first = ItemRegistry.getItem('wooden_nunchaku')!;
    expect(scene.detailDescription).toBe(first.description);
    expect(scene.helpText).toBe(first.description);
    expect(scene.detailLines).toHaveLength(5); // unchanged: the item and one line per member
    tap('down'); // Small Knife
    expect(scene.detailLines[0].text.startsWith('Small Knife')).toBe(true);
    expect(scene.detailDescription).toBe(ItemRegistry.getItem('small_knife')!.description);
    expect(scene.helpText).toBe(ItemRegistry.getItem('small_knife')!.description);
  });

  it('the description fits inside the panel, below the last comparison line', () => {
    const panel = new ShopDetailPanel();
    const all = ['warrior', 'thief', 'white_mage', 'black_mage'].map((cls) => new Character({ name: 'FGHTR2', classData: ClassRegistry.getClass(cls)! }));
    const charsPerLine = Math.floor((DETAIL_RECT.width - 2 * WINDOW_PADDING) / CHAR_WIDTH);
    for (const item of ItemRegistry.getAllByType('weapon').concat(ItemRegistry.getAllByType('armor'))) {
      panel.show(item, all);
      const { text, y } = panel.description;
      expect(text.replace(/\n/g, ' ')).toBe(item.description); // wrapped to the panel's width
      const last = panel.lines[panel.lines.length - 1];
      expect(y).toBeGreaterThan(last.y);
      const lines = text.split('\n');
      for (const l of lines) expect(l.length).toBeLessThanOrEqual(charsPerLine);
      expect(y + lines.length * LINE_HEIGHT).toBeLessThanOrEqual(DETAIL_RECT.height - WINDOW_PADDING);
    }
  });

  it('an item shop has no panel, but the help bar describes the item; it hides with the list', () => {
    const { scene, tap } = open('cornelia_item');
    expect(scene.helpText).toBe('');
    tap('confirm'); // Buy: Potion
    expect(scene.detailVisible).toBe(false);
    expect(scene.helpText).toBe('Restores 30 HP to one ally.');
    tap('cancel');
    expect(scene.helpText).toBe('');
  });

  it('selling also shows the description', () => {
    const { scene, tap } = open('cornelia_item', { antidote: 1 });
    tap('down'); // Sell
    tap('confirm');
    expect(scene.helpText).toBe(ItemRegistry.getItem('antidote')!.description);
  });

  it('the item list ends above the help bar (y 900)', () => {
    const { scene, tap } = open('cornelia_item');
    tap('confirm');
    const r = scene.itemWindowRect;
    expect(r.y + r.height).toBeLessThanOrEqual(900);
  });

  it('ShopScene.ts and its parts are each under 250 lines', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/scenes');
    for (const f of ['ShopScene.ts', 'shop/ShopDetailPanel.ts', 'shop/shopLists.ts', 'shop/spellLearners.ts', 'MagicShopScene.ts', 'EquipScene.ts']) {
      const lines = (readFileSync(resolve(root, f), 'utf-8').match(/\n/g) ?? []).length; // as `wc -l`
      expect(lines, f).toBeLessThan(250);
    }
  });
});
