import { describe, it, expect, beforeAll, vi } from 'vitest';
import { ItemMenuScene } from '../../src/scenes/ItemMenuScene.js';
import { ExplorationScene } from '../../src/scenes/ExplorationScene.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { Character } from '../../src/entities/Character.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import type { Game } from '../../src/core/Game.js';
import type { MapData } from '../../src/types/index.js';
import { createMockGame, createMapData } from '../helpers/testUtils.js';
import { loadRealRegistries, tapInput, visibleLabels } from '../helpers/realData.js';

beforeAll(loadRealRegistries);

/** The field item menu over a real exploration scene on `map`, with one hurt Warrior and a Tent. */
async function tentOn(map: MapData) {
  const base = createMockGame(map);
  const input = tapInput();
  const party = new PartyManager();
  const war = new Character({ name: 'WAR', classData: ClassRegistry.getClass('warrior')! });
  war.currentHp = 1;
  party.add(war);
  const inventory = new Inventory();
  inventory.add('tent', 1);
  const game = { ...base, input, party, inventory, scenes: { ...base.scenes, get: vi.fn() } };
  const exploration = new ExplorationScene(game as unknown as Game);
  await exploration.enter();
  game.scenes.get.mockImplementation((name: string) => (name === 'exploration' ? exploration : undefined));
  const menu = new ItemMenuScene(game as unknown as Game);
  menu.enter();
  input.tap('confirm', () => menu.update(1)); // the Tent (first and only item)
  return { war, inventory, menu };
}

describe('MS-8: Tents and Cabins only where the map allows camping', () => {
  it('a town map (no camp) refuses the Tent and keeps it', async () => {
    const { war, inventory, menu } = await tentOn(createMapData({ id: 'town' }));
    expect(inventory.getQuantity('tent')).toBe(1);
    expect(war.currentHp).toBe(1);
    expect(visibleLabels(menu.container).join(' ')).toContain("You can't camp here.");
  });

  it('a map with camp: true lets the Tent heal', async () => {
    const { war, inventory } = await tentOn(createMapData({ id: 'world', camp: true }));
    expect(inventory.getQuantity('tent')).toBe(0);
    expect(war.currentHp).toBeGreaterThan(1);
  });
});
