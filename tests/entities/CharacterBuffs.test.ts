import { describe, it, expect } from 'vitest';
import { Character } from '../../src/entities/Character.js';
import type { CharacterClassData } from '../../src/types/index.js';

const mockClass: CharacterClassData = {
  id: 'warrior',
  name: 'Warrior',
  baseStats: { hp: 50, strength: 10, agility: 5, intelligence: 1, vitality: 8, luck: 5 },
  statGrowth: { hp: 5, strength: 2, agility: 1, intelligence: 0, vitality: 1, luck: 1 },
  usableEquipment: [],
  spellLevels: { white: 0, black: 0 },
};

describe('Character battle buffs', () => {
  it('applyBuff increases getBuffAmount', () => {
    const char = new Character({ name: 'Hero', classData: mockClass });
    expect(char.getBuffAmount('defense')).toBe(0);
    char.applyBuff('defense', 8);
    expect(char.getBuffAmount('defense')).toBe(8);
  });

  it('buffs stack additively', () => {
    const char = new Character({ name: 'Hero', classData: mockClass });
    char.applyBuff('attack', 14);
    char.applyBuff('attack', 14);
    expect(char.getBuffAmount('attack')).toBe(28);
  });

  it('defense buff is reflected in stats getter', () => {
    const char = new Character({ name: 'Hero', classData: mockClass });
    const baseDef = char.stats.defense;
    char.applyBuff('defense', 8);
    expect(char.stats.defense).toBe(baseDef + 8);
  });

  it('attack buff is reflected in stats getter', () => {
    const char = new Character({ name: 'Hero', classData: mockClass });
    const baseAtk = char.stats.attack;
    char.applyBuff('attack', 14);
    expect(char.stats.attack).toBe(baseAtk + 14);
  });

  it('clearBattleState removes all buffs', () => {
    const char = new Character({ name: 'Hero', classData: mockClass });
    char.applyBuff('defense', 8);
    char.applyBuff('attack', 14);
    char.addTempResist('lightning');
    char.clearBattleState();
    expect(char.getBuffAmount('defense')).toBe(0);
    expect(char.getBuffAmount('attack')).toBe(0);
    expect(char.hasTempResist('lightning')).toBe(false);
  });

  it('tempResist tracks element resistances', () => {
    const char = new Character({ name: 'Hero', classData: mockClass });
    expect(char.hasTempResist('lightning')).toBe(false);
    char.addTempResist('lightning');
    expect(char.hasTempResist('lightning')).toBe(true);
    expect(char.hasTempResist('fire')).toBe(false);
  });

  it('buffs are not included in toJSON (not persisted)', () => {
    const char = new Character({ name: 'Hero', classData: mockClass });
    char.applyBuff('defense', 8);
    char.addTempResist('lightning');
    const json = char.toJSON();
    // Buffs should not appear in serialized data
    expect(json).not.toHaveProperty('battleBuffs');
    expect(json).not.toHaveProperty('tempResist');
  });
});
