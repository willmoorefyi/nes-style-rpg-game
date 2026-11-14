import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ItemEffects } from '../ItemEffects.js';
import { ItemRegistry } from '../../data/ItemRegistry.js';
import { Character } from '../../entities/Character.js';
import { Inventory } from '../../entities/Inventory.js';
import type { DataLoader } from '../../core/DataLoader.js';
import { testMageClass } from '../../../tests/helpers/testUtils.js';

// a caster (Ether needs a charge table: a class without one has no charges to restore)
const mockClass = testMageClass('black_mage', {
  baseStats: { hp: 100, strength: 10, agility: 5, intelligence: 3, vitality: 8, luck: 5 },
  statGrowth: { hp: 10, strength: 2, agility: 1, intelligence: 0, vitality: 1, luck: 1 },
});

const mockItems = [
  { id: 'potion', name: 'Potion', type: 'consumable' as const, stats: { hp: 30 }, price: 60, usableBy: [] },
  { id: 'hi_potion', name: 'Hi-Potion', type: 'consumable' as const, stats: { hp: 120 }, price: 150, usableBy: [] },
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
    char.setSpellCharges(1, 1);
    const result = ItemEffects.applyItemEffect('ether', char, inv);
    expect(result.success).toBe(true);
    expect(char.getSpellCharges(1)).toBe(2);
  });
});

// MS-8 (docs/FIX_PLAN_PENINSULA.md T5a): heals come from items.yaml `stats.hp`, report the HP actually gained, and an
// Antidote on an unpoisoned member fails and stays in the inventory.
describe('ItemEffects (MS-8: data-driven heals)', () => {
  const bigClass = testMageClass('black_mage', {
    baseStats: { hp: 300, strength: 10, agility: 5, intelligence: 3, vitality: 8, luck: 5 },
  });
  let inv: Inventory;

  beforeEach(async () => {
    ItemRegistry.reset();
    await ItemRegistry.init({ loadItems: async () => mockItems } as Pick<DataLoader, 'loadItems'> as DataLoader);
    inv = new Inventory();
  });

  it('a Hi-Potion heals its stats.hp (120), not a hard-coded 150', () => {
    const char = new Character({ name: 'Big', classData: bigClass, currentHp: 10 });
    inv.add('hi_potion');
    const result = ItemEffects.applyItemEffect('hi_potion', char, inv);
    expect(result.success).toBe(true);
    expect(char.currentHp).toBe(130);
    expect(result.message).toBe('Big recovered 120 HP');
  });

  it('a Potion on a member at 20/25 HP reports "recovered 5"', () => {
    const char = new Character({ name: 'Tiny', classData: testMageClass(), currentHp: 20 });
    expect(char.maxHp).toBe(25);
    inv.add('potion');
    const result = ItemEffects.applyItemEffect('potion', char, inv);
    expect(result.success).toBe(true);
    expect(char.currentHp).toBe(25);
    expect(result.message).toBe('Tiny recovered 5 HP');
  });

  it('an Antidote on an unpoisoned member fails and is kept', () => {
    const char = new Character({ name: 'Clean', classData: bigClass });
    inv.add('antidote', 2);
    const result = ItemEffects.applyItemEffect('antidote', char, inv);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Clean is not poisoned.');
    expect(inv.getQuantity('antidote')).toBe(2);
  });

  it('an Antidote on a poisoned member cures it and is used up', () => {
    const char = new Character({ name: 'Sick', classData: bigClass });
    char.statusTracker.apply('poison');
    inv.add('antidote');
    const result = ItemEffects.applyItemEffect('antidote', char, inv);
    expect(result.success).toBe(true);
    expect(char.statusTracker.has('poison')).toBe(false);
    expect(inv.has('antidote')).toBe(false);
  });

  it('a heal item with no stats.hp logs an error and is not used', async () => {
    ItemRegistry.reset();
    await ItemRegistry.init({ loadItems: async () => [{ ...mockItems[0], stats: {} }] } as Pick<DataLoader, 'loadItems'> as DataLoader);
    const char = new Character({ name: 'Hurt', classData: bigClass, currentHp: 10 });
    inv.add('potion');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = ItemEffects.applyItemEffect('potion', char, inv);
    expect(result.success).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(inv.has('potion')).toBe(true);
    expect(char.currentHp).toBe(10);
    spy.mockRestore();
  });

  it('isReviveItem is true for Phoenix Down only', () => {
    expect(ItemEffects.isReviveItem('phoenix_down')).toBe(true);
    expect(ItemEffects.isReviveItem('potion')).toBe(false);
    expect(ItemEffects.isReviveItem('tent')).toBe(false);
  });
});