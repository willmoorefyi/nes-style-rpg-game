import { describe, it, expect, beforeEach } from 'vitest';
import { ItemEffects } from '../../src/systems/ItemEffects.js';
import { Character } from '../../src/entities/Character.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { ItemRegistry } from '../../src/data/ItemRegistry.js';
import type { CharacterClassData, ItemData } from '../../src/types/index.js';

const mageClass: CharacterClassData = {
  id: 'white_mage',
  name: 'White Mage',
  baseStats: { hp: 30, strength: 5, agility: 8, intelligence: 15, vitality: 5, luck: 5 },
  statGrowth: { hp: 3, strength: 1, agility: 1, intelligence: 3, vitality: 1, luck: 1 },
  usableEquipment: [],
  spellLevels: { white: 7, black: 0 },
};

// Seed ItemRegistry with test items
function seedRegistry(): void {
  ItemRegistry.reset();
  const items: ItemData[] = [
    { id: 'soft', name: 'Soft', type: 'consumable', stats: {}, price: 800, usableBy: [] },
    { id: 'tent', name: 'Tent', type: 'consumable', stats: {}, price: 250, usableBy: [] },
    { id: 'cabin', name: 'Cabin', type: 'consumable', stats: {}, price: 500, usableBy: [] },
    { id: 'ether', name: 'Ether', type: 'consumable', stats: {}, price: 150, usableBy: [] },
  ];
  // Access private static map via bracket notation
  for (const item of items) {
    (ItemRegistry as unknown as { items: Map<string, ItemData> }).items.set(item.id, item);
  }
}

beforeEach(() => {
  seedRegistry();
});

describe('ItemEffects — WP4', () => {
  describe('isPartyItem', () => {
    it('returns true for tent', () => {
      expect(ItemEffects.isPartyItem('tent')).toBe(true);
    });

    it('returns true for cabin', () => {
      expect(ItemEffects.isPartyItem('cabin')).toBe(true);
    });

    it('returns false for potion', () => {
      expect(ItemEffects.isPartyItem('potion')).toBe(false);
    });
  });

  describe('soft — remove stone status', () => {
    it('removes stone from petrified target', () => {
      const char = new Character({ name: 'Hero', classData: mageClass });
      char.statusTracker.apply('stone');
      const inv = new Inventory();
      inv.add('soft');
      const result = ItemEffects.applyItemEffect('soft', char, inv);
      expect(result.success).toBe(true);
      expect(result.message).toContain('no longer petrified');
      expect(char.statusTracker.has('stone')).toBe(false);
    });

    it('fails on non-petrified target', () => {
      const char = new Character({ name: 'Hero', classData: mageClass });
      const inv = new Inventory();
      inv.add('soft');
      const result = ItemEffects.applyItemEffect('soft', char, inv);
      expect(result.success).toBe(false);
      expect(result.message).toContain('not petrified');
    });
  });

  describe('tent — party-wide partial restore', () => {
    it('restores ~50% HP and half charges to all party members', () => {
      const party = [
        new Character({ name: 'A', classData: mageClass }),
        new Character({ name: 'B', classData: mageClass }),
      ];
      party[0].currentHp = 10;
      party[1].currentHp = 5;
      party[0].setSpellCharges(1, 0);
      party[1].setSpellCharges(1, 0);

      const inv = new Inventory();
      inv.add('tent');
      const result = ItemEffects.applyPartyItemEffect('tent', party, inv);
      expect(result.success).toBe(true);
      expect(result.message).toContain('tent');
      expect(party[0].currentHp).toBeGreaterThan(10);
      expect(party[1].currentHp).toBeGreaterThan(5);
      expect(inv.has('tent')).toBe(false);
    });
  });

  describe('cabin — party-wide full restore', () => {
    it('restores full HP and all charges to all party members', () => {
      const party = [
        new Character({ name: 'A', classData: mageClass }),
        new Character({ name: 'B', classData: mageClass }),
      ];
      party[0].currentHp = 1;
      party[1].currentHp = 1;
      party[0].setSpellCharges(1, 0);

      const inv = new Inventory();
      inv.add('cabin');
      const result = ItemEffects.applyPartyItemEffect('cabin', party, inv);
      expect(result.success).toBe(true);
      expect(result.message).toContain('cabin');
      expect(party[0].currentHp).toBe(party[0].maxHp);
      expect(party[1].currentHp).toBe(party[1].maxHp);
      expect(party[0].getSpellCharges(1)).toBe(party[0].getMaxCharges(1));
      expect(inv.has('cabin')).toBe(false);
    });
  });

  describe('ether — charge cap', () => {
    it('does not exceed max charges', () => {
      const char = new Character({ name: 'Hero', classData: mageClass });
      const maxCharges = char.getMaxCharges(1);
      char.setSpellCharges(1, maxCharges);
      const inv = new Inventory();
      inv.add('ether');
      const result = ItemEffects.applyItemEffect('ether', char, inv);
      expect(result.success).toBe(true);
      expect(char.getSpellCharges(1)).toBe(maxCharges);
    });
  });
});

describe('StatusTracker — stone', () => {
  it('stone causes skip turn', () => {
    const char = new Character({ name: 'Hero', classData: mageClass });
    char.statusTracker.apply('stone');
    const result = char.statusTracker.tick(char.maxHp);
    expect(result.skipTurn).toBe(true);
  });
});
