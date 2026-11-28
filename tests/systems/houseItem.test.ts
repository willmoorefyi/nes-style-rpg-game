/**
 * Pass EQ D-EQ13: FF1's HOUSE. A camp item like the Cabin (full HP and charges for the living, consumed, world map
 * only), after which the Save screen opens.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ItemEffects } from '../../src/systems/ItemEffects.js';
import { ItemMenuScene } from '../../src/scenes/ItemMenuScene.js';
import { ExplorationScene } from '../../src/scenes/ExplorationScene.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { Character } from '../../src/entities/Character.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import type { Game } from '../../src/core/Game.js';
import type { MapData } from '../../src/types/index.js';
import { createMapData, createMockGame } from '../helpers/testUtils.js';
import { loadRealRegistries, tapInput, visibleLabels } from '../helpers/realData.js';

beforeAll(loadRealRegistries);

describe('EQ: the House', () => {
  it('is a party item that rests the living fully, leaves the fallen down and is used up', () => {
    expect(ItemEffects.isPartyItem('house')).toBe(true);
    expect(ItemEffects.offersSave('house')).toBe(true);
    expect(ItemEffects.offersSave('cabin')).toBe(false);
    const wm = new Character({ name: 'WM', classData: ClassRegistry.getClass('white_mage')!, level: 10 });
    const down = new Character({ name: 'BM', classData: ClassRegistry.getClass('black_mage')!, level: 10 });
    wm.currentHp = 1;
    wm.setSpellCharges(1, 0);
    down.currentHp = 0;
    const bag = new Inventory();
    bag.add('house', 1);
    expect(ItemEffects.applyPartyItemEffect('house', [wm, down], bag)).toEqual({ success: true, message: 'The party rests in the house.' });
    expect(wm.currentHp).toBe(wm.maxHp);
    expect(wm.getSpellCharges(1)).toBe(wm.getMaxCharges(1));
    expect(down.currentHp).toBe(0);
    expect(bag.getQuantity('house')).toBe(0);
  });

  async function houseOn(map: MapData) {
    const base = createMockGame(map);
    const input = tapInput();
    const party = new PartyManager();
    const war = new Character({ name: 'WAR', classData: ClassRegistry.getClass('warrior')! });
    war.currentHp = 1;
    party.add(war);
    const inventory = new Inventory();
    inventory.add('house', 1);
    const game = { ...base, input, party, inventory, scenes: { ...base.scenes, get: vi.fn() } };
    const exploration = new ExplorationScene(game as unknown as Game);
    await exploration.enter();
    game.scenes.get.mockImplementation((name: string) => (name === 'exploration' ? exploration : undefined));
    const menu = new ItemMenuScene(game as unknown as Game);
    menu.enter();
    const tap = (a: Parameters<typeof input.tap>[0]): void => input.tap(a, () => menu.update(1));
    tap('confirm'); // the House
    return { war, inventory, menu, tap, game };
  }

  it('on the world map: Yes rests the party, then the Save screen opens', async () => {
    const { war, inventory, tap, game } = await houseOn(createMapData({ id: 'world', camp: true }));
    tap('confirm'); // Yes
    expect(war.currentHp).toBe(war.maxHp);
    expect(inventory.getQuantity('house')).toBe(0);
    expect(game.scenes.push).toHaveBeenCalledWith('saveMenu');
  });

  it('in a town it is refused and kept, and nothing opens', async () => {
    const { inventory, menu, game } = await houseOn(createMapData({ id: 'town' }));
    expect(inventory.getQuantity('house')).toBe(1);
    expect(visibleLabels(menu.container).join(' ')).toContain("You can't camp here.");
    expect(game.scenes.push).not.toHaveBeenCalledWith('saveMenu');
  });
});
