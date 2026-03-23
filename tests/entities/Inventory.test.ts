import { describe, it, expect, beforeEach } from 'vitest';
import { Inventory } from '../../src/entities/Inventory.js';

describe('Inventory', () => {
  let inv: Inventory;

  beforeEach(() => {
    inv = new Inventory();
  });

  describe('add', () => {
    it('adds item with default quantity 1', () => {
      inv.add('potion');
      expect(inv.getQuantity('potion')).toBe(1);
    });

    it('adds item with specified quantity', () => {
      inv.add('potion', 5);
      expect(inv.getQuantity('potion')).toBe(5);
    });

    it('stacks quantities when adding to existing', () => {
      inv.add('potion', 3);
      inv.add('potion', 2);
      expect(inv.getQuantity('potion')).toBe(5);
    });

    it('caps at 99 per item', () => {
      inv.add('potion', 99);
      inv.add('potion', 10);
      expect(inv.getQuantity('potion')).toBe(99);
    });
  });

  describe('remove', () => {
    it('removes item and returns true', () => {
      inv.add('potion', 5);
      expect(inv.remove('potion', 2)).toBe(true);
      expect(inv.getQuantity('potion')).toBe(3);
    });

    it('returns false when removing more than owned', () => {
      inv.add('potion', 2);
      expect(inv.remove('potion', 5)).toBe(false);
      expect(inv.getQuantity('potion')).toBe(2);
    });

    it('returns false for non-existent item', () => {
      expect(inv.remove('potion')).toBe(false);
    });

    it('removes item entry when quantity reaches 0', () => {
      inv.add('potion', 2);
      inv.remove('potion', 2);
      expect(inv.has('potion')).toBe(false);
    });
  });

  describe('getQuantity', () => {
    it('returns 0 for non-existent item', () => {
      expect(inv.getQuantity('unknown')).toBe(0);
    });
  });

  describe('has', () => {
    it('returns true when item exists', () => {
      inv.add('potion');
      expect(inv.has('potion')).toBe(true);
    });

    it('returns false when item does not exist', () => {
      expect(inv.has('potion')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('returns empty array when inventory is empty', () => {
      expect(inv.getAll()).toEqual([]);
    });

    it('returns all items with quantities', () => {
      inv.add('potion', 3);
      inv.add('ether', 1);
      const all = inv.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContainEqual({ itemId: 'potion', quantity: 3 });
      expect(all).toContainEqual({ itemId: 'ether', quantity: 1 });
    });
  });
});
