import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../../src/entities/Character.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { ItemRegistry } from '../../src/data/ItemRegistry.js';
import type { CharacterClassData, ItemData } from '../../src/types/index.js';
import type { DataLoader } from '../../src/core/DataLoader.js';
import type { Game } from '../../src/core/Game.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { EquipScene } from '../../src/scenes/EquipScene.js';
import { HELP_RECT, HelpWindow } from '../../src/ui/HelpWindow.js';
import { Window } from '../../src/ui/Window.js';
import { WINDOW_PADDING } from '../../src/core/LayoutConstants.js';
import { partyAttack } from '../../src/battle/CombatStats.js';
import { loadRealRegistries, tapInput, visibleLabels } from '../helpers/realData.js';

const mockWarriorClass: CharacterClassData = {
  id: 'warrior',
  name: 'Warrior',
  baseStats: { hp: 35, strength: 10, agility: 5, intelligence: 1, vitality: 8, luck: 5 },
  statGrowth: { hp: 12, strength: 3, agility: 1, intelligence: 0, vitality: 2, luck: 1 },
  usableEquipment: ['sword', 'heavy_armor'],
  spellLevels: { white: 0, black: 0 },
};

const mockMageClass: CharacterClassData = {
  id: 'black_mage',
  name: 'Black Mage',
  baseStats: { hp: 20, strength: 3, agility: 5, intelligence: 10, vitality: 3, luck: 5 },
  statGrowth: { hp: 5, strength: 1, agility: 1, intelligence: 3, vitality: 1, luck: 1 },
  usableEquipment: ['staff', 'robe'],
  spellLevels: { white: 0, black: 8 },
};

const mockSword: ItemData = {
  id: 'iron_sword',
  name: 'Iron Sword',
  type: 'weapon',
  stats: { attack: 14 },
  price: 175,
  usableBy: ['warrior'],
};

const mockStaff: ItemData = {
  id: 'staff',
  name: 'Staff',
  type: 'weapon',
  stats: { attack: 5 },
  price: 50,
  usableBy: ['black_mage'],
};

const mockArmor: ItemData = {
  id: 'chain_mail',
  name: 'Chain Mail',
  type: 'armor',
  stats: { defense: 15 },
  price: 80,
  usableBy: ['warrior'],
};

describe('EquipScene business logic', () => {
  let inventory: Inventory;

  beforeEach(async () => {
    inventory = new Inventory();
    ItemRegistry.reset();
    const mockLoader = { loadItems: async () => [mockSword, mockStaff, mockArmor] } as Pick<DataLoader, 'loadItems'>;
    await ItemRegistry.init(mockLoader as DataLoader);
  });

  describe('equip flow', () => {
    it('equipping item updates character stats', () => {
      const char = new Character({ name: 'Hero', classData: mockWarriorClass });
      const baseAttack = char.stats.attack;
      
      char.equip('weapon', mockSword);
      
      expect(char.stats.attack).toBe(baseAttack + 14);
    });

    it('equipping armor updates defense', () => {
      const char = new Character({ name: 'Hero', classData: mockWarriorClass });
      const baseDefense = char.stats.defense;
      
      char.equip('armor', mockArmor);
      
      expect(char.stats.defense).toBe(baseDefense + 15);
    });
  });

  describe('unequip flow', () => {
    it('unequipping item reverts stats', () => {
      const char = new Character({ name: 'Hero', classData: mockWarriorClass });
      const baseAttack = char.stats.attack;
      
      char.equip('weapon', mockSword);
      expect(char.stats.attack).toBe(baseAttack + 14);
      
      char.unequip('weapon');
      expect(char.stats.attack).toBe(baseAttack);
    });

    it('unequip returns the previously equipped item', () => {
      const char = new Character({ name: 'Hero', classData: mockWarriorClass });
      char.equip('weapon', mockSword);
      
      const prev = char.unequip('weapon');
      
      expect(prev).toBe(mockSword);
    });
  });

  describe('equipment compatibility', () => {
    it('only compatible equipment can be equipped', () => {
      const warrior = new Character({ name: 'Hero', classData: mockWarriorClass });
      const mage = new Character({ name: 'Mage', classData: mockMageClass });
      
      expect(warrior.canEquip(mockSword)).toBe(true);
      expect(warrior.canEquip(mockStaff)).toBe(false);
      expect(mage.canEquip(mockStaff)).toBe(true);
      expect(mage.canEquip(mockSword)).toBe(false);
    });

    it('filters compatible equipment for character class', () => {
      const warrior = new Character({ name: 'Hero', classData: mockWarriorClass });
      inventory.add('iron_sword', 1);
      inventory.add('staff', 1);
      
      const allWeapons = ItemRegistry.getAllByType('weapon');
      const compatible = allWeapons.filter(item => 
        warrior.canEquip(item) && inventory.has(item.id)
      );
      
      expect(compatible).toHaveLength(1);
      expect(compatible[0].id).toBe('iron_sword');
    });
  });
});

describe('MS-7: the Equip screen (slot labels, live preview, descriptions)', () => {
  async function open(inv: string[]) {
    await loadRealRegistries();
    const w = new Character({ name: 'FGHTR', classData: ClassRegistry.getClass('warrior')! });
    const inventory = new Inventory();
    for (const id of inv) inventory.add(id);
    const input = tapInput();
    const game = { input, inventory, party: { all: [w], get: (i: number) => (i === 0 ? w : undefined) }, scenes: { pop: () => undefined } };
    const scene = new EquipScene(game as unknown as Game);
    scene.enter();
    const tap = (a: Parameters<typeof input.tap>[0]): void => input.tap(a, () => scene.update(1));
    return { scene, tap, w };
  }

  it('slots read Weapon / Body / Shield / Helmet, not "weapon:"', async () => {
    const { scene, tap } = await open([]);
    tap('confirm'); // the member
    const labels = visibleLabels(scene.container);
    for (const l of ['Weapon: -', 'Body: -', 'Shield: -', 'Helmet: -']) expect(labels).toContain(l);
    expect(labels.some((l) => /^(weapon|armor|shield|helmet):/.test(l))).toBe(false);
  });

  it('browsing items previews ATK/DEF with the item, and the help bar describes it', async () => {
    const { scene, tap, w } = await open(['rapier', 'iron_sword']);
    const bare = partyAttack(w);
    expect(scene.statsLines).toBe(`ATK ${bare}\nDEF 0`);
    tap('confirm'); // member
    tap('confirm'); // Weapon slot
    expect(scene.statsLines).toBe(`ATK ${bare} -> ${bare}\nDEF 0 -> 0`); // (Unequip) on an empty slot
    tap('down'); // Rapier (ATK 9)
    expect(scene.statsLines).toBe(`ATK ${bare} -> ${bare + 9}  +9\nDEF 0 -> 0`);
    expect(scene.helpText).toBe(ItemRegistry.getItem('rapier')!.description);
    tap('down'); // Iron Sword (ATK 14)
    expect(scene.statsLines.split('\n')[0]).toBe(`ATK ${bare} -> ${bare + 14}  +14`);
    tap('confirm'); // equip it
    expect(w.getEquipped('weapon')?.id).toBe('iron_sword');
    expect(scene.statsLines).toBe(`ATK ${bare + 14}\nDEF 0`);
  });

  it('every window but the help bar ends above it (y 900)', async () => {
    const { scene, tap } = await open(['rapier']);
    tap('confirm');
    tap('confirm');
    const windows = scene.container.children.filter((c): c is Window => c instanceof Window);
    expect(windows.filter((w) => w instanceof HelpWindow)).toHaveLength(1);
    for (const win of windows) {
      if (win instanceof HelpWindow) { expect(win.position.y).toBe(HELP_RECT.y); continue; }
      expect(win.position.y + win.contentHeight + 2 * WINDOW_PADDING).toBeLessThanOrEqual(HELP_RECT.y);
    }
  });
});

describe('R3: Equip keeps the worn item when the bag is full, shows one focus, and reopens on member 1 (E1, E3, E9)', () => {
  async function open(inv: Record<string, number>, classes = ['warrior']) {
    await loadRealRegistries();
    const all = classes.map((cls, i) => new Character({ name: `M${i}`, classData: ClassRegistry.getClass(cls)! }));
    const inventory = new Inventory();
    for (const [id, n] of Object.entries(inv)) inventory.add(id, n);
    const input = tapInput();
    const game = { input, inventory, party: { all, get: (i: number) => all[i] }, scenes: { pop: () => undefined } };
    const scene = new EquipScene(game as unknown as Game);
    scene.enter();
    const tap = (a: Parameters<typeof input.tap>[0]): void => input.tap(a, () => scene.update(1));
    return { scene, tap, all, inventory };
  }

  it('E1: with 99 rapiers in the bag, (Unequip) leaves the worn rapier equipped and says why', async () => {
    const { scene, tap, all, inventory } = await open({ rapier: 99 });
    all[0].equip('weapon', ItemRegistry.getItem('rapier')!);
    tap('confirm'); // member
    tap('confirm'); // Weapon
    const preview = scene.statsLines;
    tap('confirm'); // (Unequip)
    expect(all[0].getEquipped('weapon')?.id).toBe('rapier');
    expect(inventory.getQuantity('rapier')).toBe(99);
    // U9: the shared wording, on the help bar; the stats window keeps its stats
    expect(scene.helpText).toBe("You can't carry another Rapier.");
    expect(scene.statsLines).toBe(preview);
  });

  it('re-equipping the worn item with 99 in the bag is a no-op (no copy is lost)', async () => {
    const { scene, tap, all, inventory } = await open({ rapier: 99 });
    all[0].equip('weapon', ItemRegistry.getItem('rapier')!);
    tap('confirm'); // member
    tap('confirm'); // Weapon
    tap('down'); // Rapier
    tap('confirm');
    expect(all[0].getEquipped('weapon')?.id).toBe('rapier');
    expect(inventory.getQuantity('rapier')).toBe(99);
    expect(scene.activeMenus).toEqual({ member: false, slot: true, item: false });
  });

  it('swapping to an item the bag holds 99 of keeps every copy (new one leaves the bag first)', async () => {
    const { tap, all, inventory } = await open({ iron_sword: 99 });
    all[0].equip('weapon', ItemRegistry.getItem('rapier')!);
    tap('confirm');
    tap('confirm');
    tap('down'); // Iron Sword
    tap('confirm');
    expect(all[0].getEquipped('weapon')?.id).toBe('iron_sword');
    expect(inventory.getQuantity('iron_sword')).toBe(98);
    expect(inventory.getQuantity('rapier')).toBe(1);
  });

  it('swapping away from a worn item the bag holds 99 of is refused and loses nothing', async () => {
    const { scene, tap, all, inventory } = await open({ rapier: 99, iron_sword: 1 });
    all[0].equip('weapon', ItemRegistry.getItem('rapier')!);
    tap('confirm');
    tap('confirm');
    // rows after (Unequip) follow registry order; move to the iron sword's row
    const order = ItemRegistry.getAllByType('weapon').filter(i => i.id === 'rapier' || i.id === 'iron_sword').map(i => i.id);
    for (let i = 0; i <= order.indexOf('iron_sword'); i++) tap('down');
    const preview = scene.statsLines;
    tap('confirm');
    expect(all[0].getEquipped('weapon')?.id).toBe('rapier');
    expect(inventory.getQuantity('rapier')).toBe(99);
    expect(inventory.getQuantity('iron_sword')).toBe(1);
    expect(scene.helpText).toBe("You can't carry another Rapier.");
    expect(scene.statsLines).toBe(preview);
  });

  it('E3: only the menu with the focus has a white cursor', async () => {
    const { scene, tap } = await open({ rapier: 1 });
    expect(scene.activeMenus).toEqual({ member: true, slot: false, item: false });
    tap('confirm');
    expect(scene.activeMenus).toEqual({ member: false, slot: true, item: false });
    tap('confirm');
    expect(scene.activeMenus).toEqual({ member: false, slot: false, item: true });
    tap('cancel');
    expect(scene.activeMenus).toEqual({ member: false, slot: true, item: false });
    tap('cancel');
    expect(scene.activeMenus).toEqual({ member: true, slot: false, item: false });
  });

  it('E3: the help bar is never empty (member phase, empty slot, (Unequip))', async () => {
    const { scene, tap, all } = await open({});
    expect(scene.helpText).toBe('Choose whose equipment to change.');
    tap('confirm');
    expect(scene.helpText).toBe('Weapon: nothing equipped.');
    tap('confirm'); // (Unequip) on an empty slot
    expect(scene.helpText).toBe('The slot is already empty.');
    tap('cancel');
    tap('cancel');
    all[0].equip('weapon', ItemRegistry.getItem('rapier')!);
    tap('confirm');
    tap('confirm');
    expect(scene.helpText).toBe('Take off the Rapier.');
  });

  it('E9: reopening shows the first member again, not the last one browsed', async () => {
    const { scene, tap, all } = await open({}, ['warrior', 'thief', 'black_mage']);
    all[0].equip('weapon', ItemRegistry.getItem('iron_sword')!);
    scene.enter();
    const first = scene.statsLines;
    tap('down');
    tap('down');
    expect(scene.statsLines).not.toBe(first);
    scene.enter();
    expect(scene.statsLines).toBe(first);
  });
});
