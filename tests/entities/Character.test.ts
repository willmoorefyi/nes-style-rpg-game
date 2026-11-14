import { describe, it, expect } from 'vitest';
import { Character } from '../../src/entities/Character.js';
import type { CharacterClassData, ItemData } from '../../src/types/index.js';
import { testClass, testMageClass } from '../helpers/testUtils.js';

const mockWarriorClass: CharacterClassData = testClass('warrior', {
  baseStats: { hp: 35, strength: 10, agility: 5, intelligence: 1, vitality: 8, luck: 5 },
  statGrowth: { hp: 12, strength: 3, agility: 1, intelligence: 0, vitality: 2, luck: 1 },
  usableEquipment: ['sword', 'heavy_armor'],
});

const mockSword: ItemData = {
  id: 'iron_sword',
  name: 'Iron Sword',
  type: 'weapon',
  stats: { attack: 14 },
  price: 175,
  usableBy: ['warrior'],
};

const mockArmor: ItemData = {
  id: 'chain_mail',
  name: 'Chain Mail',
  type: 'armor',
  stats: { defense: 15 },
  price: 80,
  usableBy: ['warrior'],
};

const mockMageOnlyItem: ItemData = {
  id: 'staff',
  name: 'Staff',
  type: 'weapon',
  stats: { attack: 5 },
  price: 50,
  usableBy: ['black_mage'],
};

describe('Character', () => {
  it('creates character with class data', () => {
    const char = new Character({ name: 'Hero', classData: mockWarriorClass });
    expect(char.name).toBe('Hero');
    expect(char.classData.id).toBe('warrior');
    expect(char.level).toBe(1);
    expect(char.xp).toBe(0);
  });

  it('calculates base stats from class', () => {
    const char = new Character({ name: 'Hero', classData: mockWarriorClass });
    expect(char.baseStats.hp).toBe(35);
    expect(char.baseStats.strength).toBe(10);
  });

  it('applies stat growth on level up', () => {
    const char = new Character({ name: 'Hero', classData: mockWarriorClass, level: 2 });
    expect(char.baseStats.hp).toBe(35 + 12);
    expect(char.baseStats.strength).toBe(10 + 3);
  });

  it('calculates stats with equipment bonuses', () => {
    const char = new Character({ name: 'Hero', classData: mockWarriorClass });
    char.equip('weapon', mockSword);
    char.equip('armor', mockArmor);
    expect(char.stats.attack).toBe(5 + 14); // FF1 partyAttack: ⌊strength / 2⌋ + weapon
    expect(char.stats.defense).toBe(15); // armor
  });

  it('enforces class equipment restrictions', () => {
    const char = new Character({ name: 'Hero', classData: mockWarriorClass });
    expect(char.canEquip(mockSword)).toBe(true);
    expect(char.canEquip(mockMageOnlyItem)).toBe(false);
    expect(char.equip('weapon', mockMageOnlyItem)).toBe(false);
  });

  it('returns previous item on equip', () => {
    const char = new Character({ name: 'Hero', classData: mockWarriorClass });
    char.equip('weapon', mockSword);
    const prev = char.equip('weapon', mockSword);
    expect(prev && prev.id).toBe('iron_sword');
  });

  it('unequips items', () => {
    const char = new Character({ name: 'Hero', classData: mockWarriorClass });
    char.equip('weapon', mockSword);
    const removed = char.unequip('weapon');
    expect(removed?.id).toBe('iron_sword');
    expect(char.getEquipped('weapon')).toBe(null);
  });

  it('levels up when XP threshold reached', () => {
    const char = new Character({ name: 'Hero', classData: mockWarriorClass });
    expect(char.level).toBe(1);
    const leveledUp = char.addXp(40);
    expect(leveledUp).toBe(true);
    expect(char.level).toBe(2);
  });

  it('does not level up below threshold', () => {
    const char = new Character({ name: 'Hero', classData: mockWarriorClass });
    const leveledUp = char.addXp(39);
    expect(leveledUp).toBe(false);
    expect(char.level).toBe(1);
  });

  it('follows the FF1 XP table: 39 is Lv1, 40 Lv2, 196 Lv3, 547 Lv4 (EB-3)', () => {
    const at = (xp: number) => new Character({ name: 'Hero', classData: mockWarriorClass }).addXp(xp);
    const levelAt = (xp: number) => {
      const c = new Character({ name: 'Hero', classData: mockWarriorClass });
      c.addXp(xp);
      return c.level;
    };
    expect(at(39)).toBe(false);
    expect([39, 40, 195, 196, 546, 547].map(levelAt)).toEqual([1, 2, 2, 3, 3, 4]);
    const c = new Character({ name: 'Hero', classData: mockWarriorClass });
    expect(c.xpForNextLevel()).toBe(40);
    c.addXp(40);
    expect(c.xpForNextLevel()).toBe(196);
  });

  it('a level-up adds the HP gain without a full heal: a White Mage at 10/25 becomes 16/31', () => {
    const wm = new Character({
      name: 'W.MAG',
      classData: testMageClass('white_mage', {
        baseStats: { hp: 25, strength: 5, agility: 8, intelligence: 15, vitality: 3, luck: 8 },
        statGrowth: { hp: 6, strength: 1, agility: 1, intelligence: 4, vitality: 1, luck: 1 },
      }),
    });
    wm.currentHp = 10;
    expect(wm.addXp(40)).toBe(true);
    expect(wm.level).toBe(2);
    expect(wm.currentHp).toBe(16);
    expect(wm.maxHp).toBe(31);
  });

  it('a KO\'d member stays at 0 HP through a level-up', () => {
    const char = new Character({ name: 'Hero', classData: mockWarriorClass });
    char.currentHp = 0;
    char.addXp(40);
    expect(char.currentHp).toBe(0);
  });

  it('serializes to JSON', () => {
    const char = new Character({ name: 'Hero', classData: mockWarriorClass });
    char.equip('weapon', mockSword);
    const json = char.toJSON();
    expect(json.name).toBe('Hero');
    expect(json.classId).toBe('warrior');
    expect(json.equipment.weapon).toBe('iron_sword');
  });

  it('manages spell charges', () => {
    const char = new Character({ name: 'Hero', classData: mockWarriorClass });
    char.setSpellCharges(1, 3);
    expect(char.getSpellCharges(1)).toBe(3);
    expect(char.getSpellCharges(2)).toBe(0);
  });
});

describe('upgraded classes keep their base class gear', () => {
  const warrior: CharacterClassData = {
    id: 'warrior', name: 'Warrior',
    baseStats: { hp: 35, strength: 20, agility: 5, intelligence: 1, vitality: 10, luck: 5 },
    statGrowth: { hp: 13, strength: 4, agility: 1, intelligence: 0, vitality: 3, luck: 1 },
    usableEquipment: [], spellLevels: { white: 0, black: 0 },
  };
  const knight: CharacterClassData = { ...warrior, id: 'knight', name: 'Knight', upgradeFrom: 'warrior' };
  const sword = { id: 'iron_sword', name: 'Iron Sword', type: 'weapon', price: 100, attack: 20, usableBy: ['warrior'] } as unknown as ItemData;
  const staff = { id: 'staff', name: 'Staff', type: 'weapon', price: 5, attack: 6, usableBy: ['white_mage'] } as unknown as ItemData;

  it('a Knight can use a warrior-only sword, and only in the weapon slot', () => {
    const k = new Character({ name: 'KNT', classData: knight });
    expect(k.canEquip(sword)).toBe(true);
    expect(k.canEquipIn('weapon', sword)).toBe(true);
    expect(k.canEquipIn('armor', sword)).toBe(false);
    expect(k.canEquip(staff)).toBe(false);
  });
});

