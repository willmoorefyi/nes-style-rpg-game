import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SaveManager } from '../../src/systems/SaveManager.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import { Character } from '../../src/entities/Character.js';
import type { CharacterClassData } from '../../src/types/index.js';

const mockClassData: CharacterClassData = {
  id: 'warrior',
  name: 'Warrior',
  baseStats: { hp: 35, strength: 10, agility: 5, intelligence: 3, vitality: 8, luck: 5 },
  statGrowth: { hp: 5, strength: 2, agility: 1, intelligence: 0, vitality: 1, luck: 1 },
  usableEquipment: ['sword', 'armor'],
  spellLevels: { white: 0, black: 0 },
};

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('SaveManager', () => {
  beforeEach(() => {
    localStorageMock.clear();
    // Mock ClassRegistry for fromJSON
    vi.mock('../../src/data/ClassRegistry.js', () => ({
      ClassRegistry: {
        getClass: () => mockClassData,
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves and loads game state', () => {
    const party = new PartyManager();
    party.add(new Character({ name: 'Hero', classData: mockClassData }));
    party.addGold(500);
    
    const inventory = new Inventory();
    inventory.add('potion', 5);
    
    const flags = new GameFlags();
    flags.set('bossDefeated', true);
    
    const saved = SaveManager.save(0, party, inventory, flags, 'test-town', { x: 5, y: 10 }, 3600);
    expect(saved).toBe(true);
    
    const loaded = SaveManager.load(0);
    expect(loaded).not.toBeNull();
    expect(loaded!.currentMap).toBe('test-town');
    expect(loaded!.playerPosition).toEqual({ x: 5, y: 10 });
    expect(loaded!.playTime).toBe(3600);
    expect(loaded!.party.gold).toBe(500);
    expect(loaded!.inventory.getQuantity('potion')).toBe(5);
    expect(loaded!.flags.get<boolean>('bossDefeated')).toBe(true);
  });

  it('returns null for empty slots', () => {
    expect(SaveManager.load(0)).toBeNull();
    expect(SaveManager.load(1)).toBeNull();
    expect(SaveManager.load(2)).toBeNull();
  });

  it('rejects invalid slot IDs', () => {
    const party = new PartyManager();
    const inventory = new Inventory();
    const flags = new GameFlags();
    
    expect(SaveManager.save(-1, party, inventory, flags, 'map', { x: 0, y: 0 }, 0)).toBe(false);
    expect(SaveManager.save(3, party, inventory, flags, 'map', { x: 0, y: 0 }, 0)).toBe(false);
    expect(SaveManager.load(-1)).toBeNull();
    expect(SaveManager.load(3)).toBeNull();
  });

  it('getSaveSlots returns summaries for all 3 slots', () => {
    const party = new PartyManager();
    party.add(new Character({ name: 'Hero', classData: mockClassData, level: 10 }));
    const inventory = new Inventory();
    const flags = new GameFlags();
    
    SaveManager.save(1, party, inventory, flags, 'map', { x: 0, y: 0 }, 7200);
    
    const slots = SaveManager.getSaveSlots();
    expect(slots).toHaveLength(3);
    expect(slots[0]).toBeNull();
    expect(slots[1]).not.toBeNull();
    expect(slots[1]!.level).toBe(10);
    expect(slots[1]!.playTime).toBe(7200);
    expect(slots[1]!.partyLeader).toBe('Hero');
    expect(slots[2]).toBeNull();
  });

  it('deleteSave removes save data', () => {
    const party = new PartyManager();
    const inventory = new Inventory();
    const flags = new GameFlags();
    
    SaveManager.save(0, party, inventory, flags, 'map', { x: 0, y: 0 }, 0);
    expect(SaveManager.load(0)).not.toBeNull();
    
    expect(SaveManager.deleteSave(0)).toBe(true);
    expect(SaveManager.load(0)).toBeNull();
  });

  it('handles corrupted save data gracefully', () => {
    localStorageMock.setItem('ff1_save_0', 'not valid json');
    expect(SaveManager.load(0)).toBeNull();
    
    const slots = SaveManager.getSaveSlots();
    expect(slots[0]).toBeNull();
  });
});
