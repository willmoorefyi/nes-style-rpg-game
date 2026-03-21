import { describe, it, expect } from 'vitest';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { Character } from '../../src/entities/Character.js';
import type { CharacterClassData } from '../../src/types/index.js';

const mockClass: CharacterClassData = {
  id: 'warrior',
  name: 'Warrior',
  baseStats: { hp: 35, strength: 10, agility: 5, intelligence: 1, vitality: 8, luck: 5 },
  statGrowth: { hp: 12, strength: 3, agility: 1, intelligence: 0, vitality: 2, luck: 1 },
  usableEquipment: ['sword'],
  spellLevels: { white: 0, black: 0 },
};

const createChar = (name: string) => new Character({ name, classData: mockClass });

describe('PartyManager', () => {
  it('starts empty', () => {
    const party = new PartyManager();
    expect(party.size).toBe(0);
  });

  it('adds members up to max size', () => {
    const party = new PartyManager();
    expect(party.add(createChar('A'))).toBe(true);
    expect(party.add(createChar('B'))).toBe(true);
    expect(party.add(createChar('C'))).toBe(true);
    expect(party.add(createChar('D'))).toBe(true);
    expect(party.size).toBe(4);
  });

  it('rejects members beyond max size', () => {
    const party = new PartyManager();
    party.add(createChar('A'));
    party.add(createChar('B'));
    party.add(createChar('C'));
    party.add(createChar('D'));
    expect(party.add(createChar('E'))).toBe(false);
    expect(party.size).toBe(4);
  });

  it('gets member by index', () => {
    const party = new PartyManager();
    party.add(createChar('Hero'));
    expect(party.get(0)?.name).toBe('Hero');
    expect(party.get(1)).toBe(null);
  });

  it('removes member by index', () => {
    const party = new PartyManager();
    party.add(createChar('A'));
    party.add(createChar('B'));
    const removed = party.remove(0);
    expect(removed?.name).toBe('A');
    expect(party.size).toBe(1);
    expect(party.get(0)?.name).toBe('B');
  });

  it('returns null for invalid remove index', () => {
    const party = new PartyManager();
    expect(party.remove(0)).toBe(null);
    expect(party.remove(-1)).toBe(null);
  });

  it('swaps members', () => {
    const party = new PartyManager();
    party.add(createChar('A'));
    party.add(createChar('B'));
    expect(party.swap(0, 1)).toBe(true);
    expect(party.get(0)?.name).toBe('B');
    expect(party.get(1)?.name).toBe('A');
  });

  it('returns false for invalid swap', () => {
    const party = new PartyManager();
    party.add(createChar('A'));
    expect(party.swap(0, 1)).toBe(false);
    expect(party.swap(-1, 0)).toBe(false);
  });

  it('provides readonly access to all members', () => {
    const party = new PartyManager();
    party.add(createChar('A'));
    party.add(createChar('B'));
    expect(party.all.length).toBe(2);
    expect(party.all[0].name).toBe('A');
  });

  it('serializes to JSON', () => {
    const party = new PartyManager();
    party.add(createChar('Hero'));
    const json = party.toJSON();
    expect(json.length).toBe(1);
    expect((json[0] as Record<string, unknown>).name).toBe('Hero');
  });
});