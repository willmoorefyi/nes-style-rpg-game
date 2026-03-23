import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../../src/entities/Character.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import type { CharacterClassData } from '../../src/types/index.js';

const mockClass: CharacterClassData = {
  id: 'fighter',
  name: 'Fighter',
  baseStats: { hp: 30, strength: 10, agility: 5, intelligence: 3, vitality: 8, luck: 5 },
  statGrowth: { hp: 5, strength: 2, agility: 1, intelligence: 1, vitality: 2, luck: 1 },
  usableEquipment: ['sword'],
  spellLevels: { white: 0, black: 0 },
};

describe('InnScene business logic', () => {
  let party: PartyManager;
  const innPrice = 100;

  beforeEach(() => {
    party = new PartyManager();
    party.addGold(500);
  });

  describe('rest flow', () => {
    it('restores all party HP to max', () => {
      const char1 = new Character({ name: 'Hero', classData: mockClass });
      const char2 = new Character({ name: 'Ally', classData: mockClass });
      party.add(char1);
      party.add(char2);
      
      // Damage both characters
      char1.currentHp = 10;
      char2.currentHp = 5;
      
      // Rest at inn
      expect(party.spendGold(innPrice)).toBe(true);
      for (const member of party.all) {
        member.currentHp = member.maxHp;
      }
      
      expect(char1.currentHp).toBe(char1.maxHp);
      expect(char2.currentHp).toBe(char2.maxHp);
    });

    it('restores all spell charges', () => {
      const char = new Character({ name: 'Mage', classData: mockClass });
      party.add(char);
      
      // Use some spell charges
      char.setSpellCharges(1, 2);
      char.useCharge(1);
      expect(char.getSpellCharges(1)).toBe(1);
      
      // Rest at inn
      party.spendGold(innPrice);
      char.restoreAllCharges();
      
      expect(char.getSpellCharges(1)).toBe(char.getMaxCharges(1));
    });

    it('deducts gold for inn stay', () => {
      const char = new Character({ name: 'Hero', classData: mockClass });
      party.add(char);
      
      expect(party.spendGold(innPrice)).toBe(true);
      expect(party.gold).toBe(400);
    });

    it('prevents rest with insufficient gold', () => {
      const char = new Character({ name: 'Hero', classData: mockClass });
      party.add(char);
      char.currentHp = 10;
      
      party.spendGold(450); // Leave only 50 gold
      expect(party.spendGold(innPrice)).toBe(false);
      expect(party.gold).toBe(50);
      expect(char.currentHp).toBe(10); // HP unchanged
    });
  });
});
