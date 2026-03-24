import { describe, it, expect } from 'vitest';
import { Character } from '../../src/entities/Character.js';
import type { CharacterClassData, ItemData } from '../../src/types/index.js';

const mockWarriorClass: CharacterClassData = {
  id: 'warrior',
  name: 'Warrior',
  baseStats: { hp: 35, strength: 10, agility: 5, intelligence: 1, vitality: 8, luck: 5 },
  statGrowth: { hp: 12, strength: 3, agility: 1, intelligence: 0, vitality: 2, luck: 1 },
  usableEquipment: ['sword', 'heavy_armor'],
  spellLevels: { white: 0, black: 0 },
};

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
    expect(char.stats.attack).toBe(10 + 14); // strength + weapon
    expect(char.stats.defense).toBe(15); // armor
  });

  it('enforces class equipment restrictions', () => {
    const char = new Character({ name: 'Hero', classData: mockWarriorClass });
    expect(char.canEquip(mockSword)).toBe(true);
    expect(char.canEquip(mockMageOnlyItem)).toBe(false);
    expect(char.equip('weapon', mockMageOnlyItem)).toBe(null);
  });

  it('returns previous item on equip', () => {
    const char = new Character({ name: 'Hero', classData: mockWarriorClass });
    char.equip('weapon', mockSword);
    const prev = char.equip('weapon', mockSword);
    expect(prev?.id).toBe('iron_sword');
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
    const leveledUp = char.addXp(200);
    expect(leveledUp).toBe(true);
    expect(char.level).toBe(2);
  });

  it('does not level up below threshold', () => {
    const char = new Character({ name: 'Hero', classData: mockWarriorClass });
    const leveledUp = char.addXp(50);
    expect(leveledUp).toBe(false);
    expect(char.level).toBe(1);
  });

  it('restores HP on level up', () => {
    const char = new Character({ name: 'Hero', classData: mockWarriorClass });
    char.currentHp = 10;
    char.addXp(200);
    expect(char.currentHp).toBe(char.maxHp);
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