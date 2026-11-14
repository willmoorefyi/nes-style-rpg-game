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

describe('MS-7: the item menu shows descriptions and the targets\' HP and status', () => {
  function open() {
    const input = tapInput();
    const war = new Character({ name: 'FGHTR', classData: ClassRegistry.getClass('warrior')! });
    war.currentHp = 7;
    war.statusTracker.apply('poison', 99);
    const mage = new Character({ name: 'W.MAG', classData: ClassRegistry.getClass('white_mage')! });
    mage.currentHp = 0;
    const party = new PartyManager();
    party.add(war);
    party.add(mage);
    const inventory = new Inventory();
    inventory.add('potion', 2);
    inventory.add('antidote', 1);
    const game = { input, party, inventory, scenes: { pop: vi.fn(), get: vi.fn() } };
    const menu = new ItemMenuScene(game as unknown as Game);
    menu.enter();
    const tap = (a: Parameters<typeof input.tap>[0]): void => input.tap(a, () => menu.update(1));
    return { menu, tap, war, mage };
  }

  it('the help bar shows the highlighted item\'s description (not its name) and follows the cursor', () => {
    const { menu, tap } = open();
    expect(menu.helpText).toBe('Restores 30 HP to one ally.');
    expect(visibleLabels(menu.container)).toContain('Restores 30 HP to one ally.');
    tap('down');
    expect(menu.helpText).toBe('Cures poison on one ally.');
  });

  it('the target list shows each member\'s HP cur/max and status', () => {
    const { menu, tap, war, mage } = open();
    tap('confirm'); // Potion -> pick a target
    const labels = visibleLabels(menu.container);
    expect(labels.some((l) => l.startsWith('FGHTR') && l.includes(`HP   7/${String(war.maxHp).padStart(3)}`) && l.includes('POISON'))).toBe(true);
    expect(labels.some((l) => l.startsWith('W.MAG') && l.includes(`HP   0/${String(mage.maxHp).padStart(3)}`) && l.endsWith('KO'))).toBe(true);
  });

  it('the result of using an item stays in the help bar', () => {
    const { menu, tap } = open();
    tap('confirm'); // Potion
    tap('confirm'); // on FGHTR
    expect(menu.helpText).toContain('FGHTR recovered');
  });
});
