import { describe, it, expect } from 'vitest';
import { Character } from '../../src/entities/Character.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import type { CharacterClassData } from '../../src/types/index.js';
import {
  CLASS_UPGRADES,
  canUpgrade,
  performUpgrade,
  upgradeParty,
} from '../../src/systems/ClassUpgradeSystem.js';

// --- Test class data ---

const baseClasses: Record<string, CharacterClassData> = {
  warrior: {
    id: 'warrior', name: 'Warrior',
    baseStats: { hp: 35, strength: 20, agility: 5, intelligence: 1, vitality: 10, luck: 5 },
    statGrowth: { hp: 6, strength: 3, agility: 1, intelligence: 0, vitality: 2, luck: 1 },
    usableEquipment: ['sword', 'heavy_armor'], spellLevels: { white: 0, black: 0 },
  },
  thief: {
    id: 'thief', name: 'Thief',
    baseStats: { hp: 25, strength: 10, agility: 15, intelligence: 5, vitality: 5, luck: 15 },
    statGrowth: { hp: 4, strength: 2, agility: 3, intelligence: 0, vitality: 1, luck: 2 },
    usableEquipment: ['knife'], spellLevels: { white: 0, black: 0 },
  },
  monk: {
    id: 'monk', name: 'Monk',
    baseStats: { hp: 33, strength: 15, agility: 8, intelligence: 3, vitality: 10, luck: 5 },
    statGrowth: { hp: 5, strength: 3, agility: 2, intelligence: 0, vitality: 2, luck: 1 },
    usableEquipment: ['nunchaku'], spellLevels: { white: 0, black: 0 },
  },
  white_mage: {
    id: 'white_mage', name: 'White Mage',
    baseStats: { hp: 25, strength: 5, agility: 8, intelligence: 15, vitality: 3, luck: 8 },
    statGrowth: { hp: 3, strength: 1, agility: 1, intelligence: 3, vitality: 1, luck: 1 },
    usableEquipment: ['staff'], spellLevels: { white: 7, black: 0 },
  },
  black_mage: {
    id: 'black_mage', name: 'Black Mage',
    baseStats: { hp: 25, strength: 5, agility: 8, intelligence: 15, vitality: 3, luck: 8 },
    statGrowth: { hp: 3, strength: 1, agility: 1, intelligence: 3, vitality: 1, luck: 1 },
    usableEquipment: ['knife', 'staff'], spellLevels: { white: 0, black: 7 },
  },
  red_mage: {
    id: 'red_mage', name: 'Red Mage',
    baseStats: { hp: 30, strength: 10, agility: 10, intelligence: 10, vitality: 5, luck: 10 },
    statGrowth: { hp: 4, strength: 2, agility: 2, intelligence: 2, vitality: 1, luck: 1 },
    usableEquipment: ['sword', 'staff'], spellLevels: { white: 5, black: 5 },
  },
};

const upgradedClasses: Record<string, CharacterClassData> = {
  knight: {
    id: 'knight', name: 'Knight', upgradeFrom: 'warrior',
    baseStats: { hp: 42, strength: 24, agility: 6, intelligence: 2, vitality: 12, luck: 6 },
    statGrowth: { hp: 7, strength: 4, agility: 1, intelligence: 1, vitality: 3, luck: 1 },
    usableEquipment: ['sword', 'axe', 'hammer', 'heavy_armor', 'shield', 'knight_armor'],
    spellLevels: { white: 3, black: 0 },
  },
  ninja: {
    id: 'ninja', name: 'Ninja', upgradeFrom: 'thief',
    baseStats: { hp: 30, strength: 12, agility: 18, intelligence: 6, vitality: 6, luck: 18 },
    statGrowth: { hp: 5, strength: 3, agility: 3, intelligence: 1, vitality: 1, luck: 2 },
    usableEquipment: ['knife', 'light_sword', 'sword', 'nunchaku', 'light_armor'],
    spellLevels: { white: 0, black: 4 },
  },
  master: {
    id: 'master', name: 'Master', upgradeFrom: 'monk',
    baseStats: { hp: 40, strength: 18, agility: 10, intelligence: 4, vitality: 12, luck: 6 },
    statGrowth: { hp: 6, strength: 4, agility: 2, intelligence: 0, vitality: 3, luck: 1 },
    usableEquipment: ['nunchaku', 'light_armor'],
    spellLevels: { white: 0, black: 0 },
  },
  white_wizard: {
    id: 'white_wizard', name: 'White Wizard', upgradeFrom: 'white_mage',
    baseStats: { hp: 30, strength: 6, agility: 10, intelligence: 18, vitality: 4, luck: 10 },
    statGrowth: { hp: 4, strength: 1, agility: 1, intelligence: 4, vitality: 1, luck: 1 },
    usableEquipment: ['staff', 'hammer', 'robe'],
    spellLevels: { white: 8, black: 0 },
  },
  black_wizard: {
    id: 'black_wizard', name: 'Black Wizard', upgradeFrom: 'black_mage',
    baseStats: { hp: 30, strength: 6, agility: 10, intelligence: 18, vitality: 4, luck: 10 },
    statGrowth: { hp: 4, strength: 1, agility: 1, intelligence: 4, vitality: 1, luck: 1 },
    usableEquipment: ['knife', 'staff', 'robe'],
    spellLevels: { white: 0, black: 8 },
  },
  red_wizard: {
    id: 'red_wizard', name: 'Red Wizard', upgradeFrom: 'red_mage',
    baseStats: { hp: 36, strength: 12, agility: 12, intelligence: 12, vitality: 6, luck: 12 },
    statGrowth: { hp: 5, strength: 2, agility: 2, intelligence: 3, vitality: 1, luck: 1 },
    usableEquipment: ['sword', 'staff', 'medium_armor', 'shield'],
    spellLevels: { white: 7, black: 7 },
  },
};

/** Build a combined class registry map for testing */
function buildRegistry(): Map<string, CharacterClassData> {
  const registry = new Map<string, CharacterClassData>();
  for (const cls of [...Object.values(baseClasses), ...Object.values(upgradedClasses)]) {
    registry.set(cls.id, cls);
  }
  return registry;
}

function makeChar(classId: string, name = 'Hero'): Character {
  return new Character({ name, classData: baseClasses[classId] });
}

describe('ClassUpgradeSystem', () => {
  describe('CLASS_UPGRADES mapping', () => {
    it.each([
      ['warrior', 'knight'],
      ['thief', 'ninja'],
      ['monk', 'master'],
      ['white_mage', 'white_wizard'],
      ['black_mage', 'black_wizard'],
      ['red_mage', 'red_wizard'],
    ])('maps %s → %s', (base, upgraded) => {
      expect(CLASS_UPGRADES[base]).toBe(upgraded);
    });
  });

  describe('canUpgrade', () => {
    it('returns false without EARTH_CRYSTAL_LIT flag', () => {
      const char = makeChar('warrior');
      const flags = new GameFlags();
      expect(canUpgrade(char, flags)).toBe(false);
    });

    it('returns true with flag for base class', () => {
      const char = makeChar('warrior');
      const flags = new GameFlags();
      flags.set('EARTH_CRYSTAL_LIT');
      expect(canUpgrade(char, flags)).toBe(true);
    });

    it('returns false for already-upgraded class', () => {
      const char = new Character({ name: 'Hero', classData: upgradedClasses.knight });
      const flags = new GameFlags();
      flags.set('EARTH_CRYSTAL_LIT');
      expect(canUpgrade(char, flags)).toBe(false);
    });
  });

  describe('performUpgrade', () => {
    it('changes class and heals to full HP', () => {
      const char = makeChar('warrior');
      char.currentHp = 10; // damage the character
      const registry = buildRegistry();

      const newName = performUpgrade(char, registry);

      expect(newName).toBe('Knight');
      expect(char.classData.id).toBe('knight');
      expect(char.classData.spellLevels.white).toBe(3);
      expect(char.currentHp).toBe(char.maxHp);
    });

    it('returns null for a class with no upgrade', () => {
      const char = new Character({ name: 'Hero', classData: upgradedClasses.knight });
      const registry = buildRegistry();
      expect(performUpgrade(char, registry)).toBeNull();
    });
  });

  describe('upgradeParty', () => {
    it('upgrades all 4 eligible members and returns messages', () => {
      const party = [
        makeChar('warrior', 'Alice'),
        makeChar('thief', 'Bob'),
        makeChar('white_mage', 'Carol'),
        makeChar('black_mage', 'Dave'),
      ];
      const flags = new GameFlags();
      flags.set('EARTH_CRYSTAL_LIT');
      const registry = buildRegistry();

      const messages = upgradeParty(party, flags, registry);

      expect(messages).toHaveLength(4);
      expect(party[0].classData.id).toBe('knight');
      expect(party[1].classData.id).toBe('ninja');
      expect(party[2].classData.id).toBe('white_wizard');
      expect(party[3].classData.id).toBe('black_wizard');
    });

    it('returns empty array when flag is not set', () => {
      const party = [makeChar('warrior')];
      const flags = new GameFlags();
      const registry = buildRegistry();

      expect(upgradeParty(party, flags, registry)).toHaveLength(0);
    });

    it('skips already-upgraded members', () => {
      const party = [
        new Character({ name: 'Alice', classData: upgradedClasses.knight }),
        makeChar('thief', 'Bob'),
      ];
      const flags = new GameFlags();
      flags.set('EARTH_CRYSTAL_LIT');
      const registry = buildRegistry();

      const messages = upgradeParty(party, flags, registry);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain('Bob');
      expect(party[0].classData.id).toBe('knight'); // unchanged
      expect(party[1].classData.id).toBe('ninja');
    });
  });

  describe('Character.upgrade', () => {
    it('updates classData and serializes upgraded class ID', () => {
      const char = makeChar('warrior');
      char.upgrade(upgradedClasses.knight);

      const json = char.toJSON();
      expect(json.classId).toBe('knight');
    });

    it('heals to new maxHp on upgrade', () => {
      const char = makeChar('warrior');
      const oldMax = char.maxHp;
      char.currentHp = 1;
      char.upgrade(upgradedClasses.knight);

      expect(char.maxHp).toBeGreaterThan(oldMax);
      expect(char.currentHp).toBe(char.maxHp);
    });
  });
});
