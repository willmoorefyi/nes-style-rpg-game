import { describe, it, expect, beforeEach } from 'vitest';
import { ItemRegistry } from '../ItemRegistry.js';
import type { DataLoader } from '../../core/DataLoader.js';

const mockItems = [
  { id: 'potion', name: 'Potion', type: 'consumable' as const, stats: { hp: 30 }, price: 60, usableBy: [] },
  { id: 'iron_sword', name: 'Iron Sword', type: 'weapon' as const, stats: { attack: 14 }, price: 175, usableBy: ['warrior'] },
  { id: 'lute', name: 'Lute', type: 'key' as const, stats: {}, price: 0, usableBy: [] },
];

const mockLoader = {
  loadItems: async () => mockItems,
} as unknown as DataLoader;

describe('ItemRegistry', () => {
  beforeEach(() => {
    ItemRegistry.reset();
  });

  it('initializes and retrieves items', async () => {
    await ItemRegistry.init(mockLoader);
    const potion = ItemRegistry.getItem('potion');
    expect(potion?.name).toBe('Potion');
  });

  it('returns undefined for unknown items', async () => {
    await ItemRegistry.init(mockLoader);
    expect(ItemRegistry.getItem('unknown')).toBeUndefined();
  });

  it('filters by type', async () => {
    await ItemRegistry.init(mockLoader);
    const weapons = ItemRegistry.getAllByType('weapon');
    expect(weapons).toHaveLength(1);
    expect(weapons[0].id).toBe('iron_sword');
  });
});