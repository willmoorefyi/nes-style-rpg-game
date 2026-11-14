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
  const tap = (a: Parameters<typeof input.tap>[0]): void => input.tap(a, () => menu.update(1));
  tap('confirm'); // the Tent (first and only item)
  return { war, inventory, menu, tap };
}

describe('MS-8: Tents and Cabins only where the map allows camping', () => {
  it('a town map (no camp) refuses the Tent and keeps it', async () => {
    const { war, inventory, menu } = await tentOn(createMapData({ id: 'town' }));
    expect(inventory.getQuantity('tent')).toBe(1);
    expect(war.currentHp).toBe(1);
    expect(visibleLabels(menu.container).join(' ')).toContain("You can't camp here.");
  });

  it('a map with camp: true lets the Tent heal (after Yes)', async () => {
    const { war, inventory, tap } = await tentOn(createMapData({ id: 'world', camp: true }));
    tap('confirm'); // Yes
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

  it('the result of using an item stays on the result line', () => {
    const { menu, tap } = open();
    tap('confirm'); // Potion
    tap('confirm'); // on FGHTR
    expect(menu.resultMessage).toContain('FGHTR recovers');
  });
});

describe('E6: the Tent asks first and shows what it did', () => {
  it('confirming the Tent opens a prompt and heals nobody yet', async () => {
    const { war, inventory, menu } = await tentOn(createMapData({ id: 'world', camp: true }));
    expect(menu.confirmPrompt).toContain('Rest in the Tent?');
    expect(menu.confirmPrompt).toContain('restored by half');
    expect(war.currentHp).toBe(1);
    expect(inventory.getQuantity('tent')).toBe(1);
  });

  it('No keeps the Tent', async () => {
    const { war, inventory, menu, tap } = await tentOn(createMapData({ id: 'world', camp: true }));
    tap('down');
    tap('confirm'); // No
    expect(menu.confirmPrompt).toBe('');
    expect(war.currentHp).toBe(1);
    expect(inventory.getQuantity('tent')).toBe(1);
  });

  it('Yes heals; the result stays across a cursor move and the party window shows the new HP', async () => {
    const { war, menu, tap } = await tentOn(createMapData({ id: 'world', camp: true }));
    tap('confirm'); // Yes
    expect(war.currentHp).toBeGreaterThan(1);
    expect(menu.resultMessage).toBe('The party rests in the tent.');
    tap('down');
    expect(menu.resultMessage).toBe('The party rests in the tent.');
    expect(menu.partyLabels[0]).toContain(`HP ${String(war.currentHp).padStart(3)}/`);
  });
});

describe('E7: the field item menu: two columns, the cursor keeps its place, gear is greyed', () => {
  function open(items: Record<string, number>) {
    const input = tapInput();
    const war = new Character({ name: 'FGHTR', classData: ClassRegistry.getClass('warrior')! });
    war.currentHp = 3;
    const party = new PartyManager();
    party.add(war);
    const inventory = new Inventory();
    for (const [id, n] of Object.entries(items)) inventory.add(id, n);
    const game = { input, party, inventory, scenes: { pop: vi.fn(), get: vi.fn() } };
    const menu = new ItemMenuScene(game as unknown as Game);
    menu.enter();
    const tap = (a: Parameters<typeof input.tap>[0]): void => input.tap(a, () => menu.update(1));
    return { menu, tap, war };
  }

  it('the list and the party window do not overlap, and the party window is always shown', () => {
    const { menu, war } = open({ potion: 2 });
    const a = menu.listRect;
    const b = menu.partyRect;
    expect(a.x + a.width <= b.x || b.x + b.width <= a.x).toBe(true);
    expect(menu.partyLabels).toHaveLength(1);
    expect(menu.partyLabels[0]).toContain(`HP   3/${String(war.maxHp).padStart(3)}`);
  });

  it('after using the item on row 3 the cursor stays on row 3', () => {
    const { menu, tap } = open({ antidote: 1, tent: 1, potion: 3 });
    tap('down');
    tap('down');
    expect(menu.selectedIndex).toBe(2);
    tap('confirm'); // Potion
    tap('confirm'); // on FGHTR
    expect(menu.selectedIndex).toBe(2);
  });

  it('weapons are greyed, and their help points to the Equip menu', () => {
    const { menu, tap } = open({ potion: 1, rapier: 1 });
    expect(menu.itemRows.map((r) => r.enabled)).toEqual([true, false]);
    tap('down');
    expect(menu.helpText).toBe('Equip it from the Equip menu.');
  });
});
