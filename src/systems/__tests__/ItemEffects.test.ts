import { describe, it, expect, beforeEach } from 'vitest';
import { ItemEffects } from '../ItemEffects.js';
import { ItemRegistry } from '../../data/ItemRegistry.js';
import { Character } from '../../entities/Character.js';
import { Inventory } from '../../entities/Inventory.js';
import type { CharacterClassData } from '../../types/index.js';
import type { DataLoader } from '../../core/DataLoader.js';

const mockClass: CharacterClassData = {
  id: 'warrior', name: 'Warrior',
  baseStats: { hp: 100, strength: 10, agility: 5, intelligence: 3, vitality: 8, luck: 5 },
  statGrowth: { hp: 10, strength: 2, agility: 1, intelligence: 0, vitality: 1, luck: 1 },
  usableEquipment: [], spellLevels: { white: 0, black: 0 },
};

const mockItems = [
  { id: 'potion', name: 'Potion', type: 'consumable' as const, stats: { hp: 30 }, price: 60, usableBy: [] },
  { id: 'hi_potion', name: 'Hi-Potion', type: 'consumable' as const, stats: { hp: 150 }, price: 150, usableBy: [] },
  { id: 'antidote', name: 'Antidote', type: 'consumable' as const, stats: {}, price: 75, usableBy: [] },
  { id: 'phoenix_down', name: 'Phoenix Down', type: 'consumable' as const, stats: {}, price: 500, usableBy: [] },
  { id: 'ether', name: 'Ether', type: 'consumable' as const, stats: {}, price: 100, usableBy: [] },
  { id: 'lute', name: 'Lute', type: 'key' as const, stats: {}, price: 0, usableBy: [] },
];

describe('ItemEffects', () => {
  let char: Character;
  let inv: Inventory;

  beforeEach(async () => {
    ItemRegistry.reset();
    await ItemRegistry.init({ loadItems: async () => mockItems } as Pick<DataLoader, 'loadItems'> as DataLoader);
    char = new Character({ name: 'Test', classData: mockClass });
    inv = new Inventory();
  });

  it('heals with potion', () => {
    char.currentHp = 50;
    inv.add('potion');
    const result = ItemEffects.applyItemEffect('potion', char, inv);
    expect(result.success).toBe(true);
    expect(char.currentHp).toBe(80);
    expect(inv.has('potion')).toBe(false);
  });

  it('heals with hi-potion', () => {
    char.currentHp = 10;
    inv.add('hi_potion');
    const result = ItemEffects.applyItemEffect('hi_potion', char, inv);
    expect(result.success).toBe(true);
    expect(char.currentHp).toBe(char.maxHp); // capped at max
  });

  it('revives with phoenix down', () => {
    char.currentHp = 0;
    inv.add('phoenix_down');
    const result = ItemEffects.applyItemEffect('phoenix_down', char, inv);
    expect(result.success).toBe(true);
    expect(char.currentHp).toBe(1);
  });

  it('rejects key items', () => {
    inv.add('lute');
    const result = ItemEffects.applyItemEffect('lute', char, inv);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Cannot use this item');
    expect(inv.has('lute')).toBe(true);
  });

  it('fails if item not in inventory', () => {
    char.currentHp = 50;
    const result = ItemEffects.applyItemEffect('potion', char, inv);
    expect(result.success).toBe(false);
  });

  it('restores charges with ether', () => {
    inv.add('ether');
    char.setSpellCharges(1, 2);
    const result = ItemEffects.applyItemEffect('ether', char, inv);
    expect(result.success).toBe(true);
    expect(char.getSpellCharges(1)).toBe(3);
  });
});