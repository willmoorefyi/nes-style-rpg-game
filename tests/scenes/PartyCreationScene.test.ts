import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../../src/entities/Character.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import type { CharacterClassData } from '../../src/types/index.js';
import type { DataLoader } from '../../src/core/DataLoader.js';

const DEFAULT_NAMES: Record<string, string> = {
  warrior: 'FGHTR',
  thief: 'THIEF',
  monk: 'MONK',
  white_mage: 'W.MAG',
  black_mage: 'B.MAG',
  red_mage: 'R.MAG',
};

const STARTING_GOLD = 100;

const mockClasses: CharacterClassData[] = [
  {
    id: 'warrior',
    name: 'Warrior',
    baseStats: { hp: 35, strength: 20, agility: 5, intelligence: 1, vitality: 10, luck: 5 },
    statGrowth: { hp: 13, strength: 4, agility: 1, intelligence: 0, vitality: 3, luck: 1 },
    usableEquipment: ['sword', 'axe', 'hammer', 'heavy_armor', 'shield'],
    spellLevels: { white: 0, black: 0 },
  },
  {
    id: 'thief',
    name: 'Thief',
    baseStats: { hp: 25, strength: 10, agility: 15, intelligence: 5, vitality: 5, luck: 15 },
    statGrowth: { hp: 8, strength: 2, agility: 4, intelligence: 0, vitality: 1, luck: 3 },
    usableEquipment: ['knife', 'light_sword', 'light_armor'],
    spellLevels: { white: 0, black: 0 },
  },
  {
    id: 'monk',
    name: 'Monk',
    baseStats: { hp: 33, strength: 15, agility: 8, intelligence: 3, vitality: 10, luck: 5 },
    statGrowth: { hp: 12, strength: 4, agility: 2, intelligence: 0, vitality: 3, luck: 1 },
    usableEquipment: ['nunchaku', 'light_armor'],
    spellLevels: { white: 0, black: 0 },
  },
  {
    id: 'white_mage',
    name: 'White Mage',
    baseStats: { hp: 25, strength: 5, agility: 8, intelligence: 15, vitality: 3, luck: 8 },
    statGrowth: { hp: 6, strength: 1, agility: 1, intelligence: 4, vitality: 1, luck: 1 },
    usableEquipment: ['staff', 'hammer', 'robe'],
    spellLevels: { white: 7, black: 0 },
  },
  {
    id: 'black_mage',
    name: 'Black Mage',
    baseStats: { hp: 25, strength: 5, agility: 8, intelligence: 15, vitality: 3, luck: 8 },
    statGrowth: { hp: 6, strength: 1, agility: 1, intelligence: 4, vitality: 1, luck: 1 },
    usableEquipment: ['knife', 'staff', 'robe'],
    spellLevels: { white: 0, black: 7 },
  },
  {
    id: 'red_mage',
    name: 'Red Mage',
    baseStats: { hp: 30, strength: 10, agility: 10, intelligence: 10, vitality: 5, luck: 10 },
    statGrowth: { hp: 8, strength: 2, agility: 2, intelligence: 2, vitality: 2, luck: 1 },
    usableEquipment: ['sword', 'staff', 'medium_armor'],
    spellLevels: { white: 5, black: 5 },
  },
  // Upgraded class — should be filtered out
  {
    id: 'knight',
    name: 'Knight',
    upgradeFrom: 'warrior',
    baseStats: { hp: 42, strength: 24, agility: 6, intelligence: 2, vitality: 12, luck: 6 },
    statGrowth: { hp: 16, strength: 5, agility: 1, intelligence: 1, vitality: 4, luck: 1 },
    usableEquipment: ['sword', 'axe', 'hammer', 'heavy_armor', 'shield', 'knight_armor'],
    spellLevels: { white: 3, black: 0 },
  },
];

describe('PartyCreationScene business logic', () => {
  let party: PartyManager;

  beforeEach(async () => {
    party = new PartyManager();
    ClassRegistry.reset();
    const mockLoader = { loadClasses: async () => mockClasses } as Pick<DataLoader, 'loadClasses'>;
    await ClassRegistry.init(mockLoader as DataLoader);
  });

  describe('class filtering', () => {
    it('only shows 6 base classes (excludes upgraded)', () => {
      const baseClasses = ClassRegistry.getAll().filter((c) => !c.upgradeFrom);
      expect(baseClasses).toHaveLength(6);
      expect(baseClasses.map((c) => c.id)).toEqual([
        'warrior', 'thief', 'monk', 'white_mage', 'black_mage', 'red_mage',
      ]);
    });

    it('excludes classes with upgradeFrom field', () => {
      const baseClasses = ClassRegistry.getAll().filter((c) => !c.upgradeFrom);
      expect(baseClasses.find((c) => c.id === 'knight')).toBeUndefined();
    });
  });

  describe('character creation', () => {
    it('creates 4 characters with correct classes and default names', () => {
      const selections = ['warrior', 'white_mage', 'black_mage', 'thief'];
      const baseClasses = ClassRegistry.getAll().filter((c) => !c.upgradeFrom);

      for (const classId of selections) {
        const cls = baseClasses.find((c) => c.id === classId)!;
        const name = DEFAULT_NAMES[cls.id] ?? cls.name;
        const character = new Character({ name, classData: cls });
        party.add(character);
      }

      expect(party.size).toBe(4);
      expect(party.get(0)!.name).toBe('FGHTR');
      expect(party.get(0)!.classData.id).toBe('warrior');
      expect(party.get(1)!.name).toBe('W.MAG');
      expect(party.get(1)!.classData.id).toBe('white_mage');
      expect(party.get(2)!.name).toBe('B.MAG');
      expect(party.get(2)!.classData.id).toBe('black_mage');
      expect(party.get(3)!.name).toBe('THIEF');
      expect(party.get(3)!.classData.id).toBe('thief');
    });

    it('allows duplicate classes', () => {
      const cls = ClassRegistry.getClass('warrior')!;
      for (let i = 0; i < 4; i++) {
        party.add(new Character({ name: DEFAULT_NAMES[cls.id], classData: cls }));
      }
      expect(party.size).toBe(4);
      for (const member of party.all) {
        expect(member.classData.id).toBe('warrior');
        expect(member.name).toBe('FGHTR');
      }
    });

    it('characters start at level 1 with full HP', () => {
      const cls = ClassRegistry.getClass('warrior')!;
      const char = new Character({ name: 'FGHTR', classData: cls });
      expect(char.level).toBe(1);
      expect(char.currentHp).toBe(char.maxHp);
      expect(char.xp).toBe(0);
    });
  });

  describe('starting gold', () => {
    it('sets party gold to 100 after creation', () => {
      const cls = ClassRegistry.getClass('warrior')!;
      for (let i = 0; i < 4; i++) {
        party.add(new Character({ name: 'FGHTR', classData: cls }));
      }
      party.addGold(STARTING_GOLD);
      expect(party.gold).toBe(100);
    });

    it('party starts with 0 gold before creation', () => {
      expect(party.gold).toBe(0);
    });
  });

  describe('default names', () => {
    it('maps all 6 base classes to correct default names', () => {
      expect(DEFAULT_NAMES['warrior']).toBe('FGHTR');
      expect(DEFAULT_NAMES['thief']).toBe('THIEF');
      expect(DEFAULT_NAMES['monk']).toBe('MONK');
      expect(DEFAULT_NAMES['white_mage']).toBe('W.MAG');
      expect(DEFAULT_NAMES['black_mage']).toBe('B.MAG');
      expect(DEFAULT_NAMES['red_mage']).toBe('R.MAG');
    });
  });

  describe('class stats preview', () => {
    it('base classes have expected stat properties', () => {
      const baseClasses = ClassRegistry.getAll().filter((c) => !c.upgradeFrom);
      for (const cls of baseClasses) {
        expect(cls.baseStats).toHaveProperty('hp');
        expect(cls.baseStats).toHaveProperty('strength');
        expect(cls.baseStats).toHaveProperty('agility');
        expect(cls.baseStats).toHaveProperty('intelligence');
        expect(cls.baseStats).toHaveProperty('vitality');
        expect(cls.baseStats).toHaveProperty('luck');
        expect(cls.spellLevels).toHaveProperty('white');
        expect(cls.spellLevels).toHaveProperty('black');
      }
    });
  });
});
