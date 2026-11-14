import { describe, it, expect } from 'vitest';
import {
  validateCharacterClassData, validateEnemyData, validateItemData, validateMapData, validateSpellData,
} from '../../src/core/schemaValidation.js';

describe('schemaValidation', () => {
  describe('validateEnemyData', () => {
    const validEnemy = {
      id: 'goblin',
      name: 'Goblin',
      stats: {
        hp: 10,
        strength: 5,
        agility: 3,
        intelligence: 1,
        vitality: 4,
        luck: 2,
        attack: 8,
        defense: 2,
        magicDefense: 1,
      },
      xpReward: 10,
      goldReward: 5,
      sprite: 'goblin.png',
    };

    it('should validate correct enemy data', () => {
      expect(validateEnemyData(validEnemy)).toEqual(validEnemy);
    });

    it('should throw on missing id', () => {
      const { id, ...noId } = validEnemy;
      expect(() => validateEnemyData(noId)).toThrow('EnemyData.id: expected string, got undefined');
    });

    it('should throw on wrong type for hp', () => {
      const bad = { ...validEnemy, stats: { ...validEnemy.stats, hp: 'ten' } };
      expect(() => validateEnemyData(bad)).toThrow('EnemyData.stats.hp: expected number, got string');
    });

    it('should throw on missing stats', () => {
      const { stats, ...noStats } = validEnemy;
      expect(() => validateEnemyData(noStats)).toThrow('EnemyData.stats: expected object, got undefined');
    });

    it('should throw on null input', () => {
      expect(() => validateEnemyData(null)).toThrow('EnemyData: expected object, got null');
    });
  });

  describe('validateMapData', () => {
    const validMap = {
      id: 'test-map',
      width: 2,
      height: 2,
      layers: [[1, 2, 3]],
      tilesets: ['tiles.png'],
      collision: [0, 0, 1, 0],
      npcs: [{ id: 'npc1', x: 5, y: 5, sprite: 'npc.png', dialog: ['Hello'] }],
      transitions: [{ x: 0, y: 15, targetMap: 'other', targetX: 0, targetY: 0 }],
    };

    it('should validate correct map data', () => {
      expect(validateMapData(validMap)).toEqual(validMap);
    });

    it('accepts targetEntrance instead of coordinates, but not both', () => {
      const t = { x: 0, y: 0, targetMap: 'other', targetEntrance: 'gate' };
      expect(() => validateMapData({ ...validMap, transitions: [t] })).not.toThrow();
      expect(() => validateMapData({ ...validMap, transitions: [{ ...t, targetX: 1, targetY: 1 }] })).toThrow(/not both/);
      expect(() => validateMapData({ ...validMap, transitions: [{ ...t, targetEntrance: 3 }] })).toThrow(/targetEntrance/);
    });

    it('validates entrances as [x, y] pairs', () => {
      expect(() => validateMapData({ ...validMap, entrances: { gate: [1, 1] } })).not.toThrow();
      expect(() => validateMapData({ ...validMap, entrances: { gate: [1] } })).toThrow(/expected \[x, y\]/);
      expect(() => validateMapData({ ...validMap, entrances: { gate: ['a', 1] } })).toThrow(/gate\[0\]/);
    });

    it('validates noWander as a list of [x, y] pairs', () => {
      expect(() => validateMapData({ ...validMap, noWander: [[1, 1], [2, 1]] })).not.toThrow();
      expect(() => validateMapData({ ...validMap, noWander: { a: [1, 1] } })).toThrow(/MapData.noWander/);
      expect(() => validateMapData({ ...validMap, noWander: [[1]] })).toThrow(/noWander\[0\]: expected \[x, y\]/);
      expect(() => validateMapData({ ...validMap, noWander: [[1, 'b']] })).toThrow(/noWander\[0\]\[1\]/);
    });

    it('validates inspect cells: in bounds, with plain or conditional text', () => {
      const ok = (inspect: unknown) => expect(() => validateMapData({ ...validMap, inspect })).not.toThrow();
      const bad = (inspect: unknown, re: RegExp) => expect(() => validateMapData({ ...validMap, inspect })).toThrow(re);
      // a misspelt condition key would otherwise become an unconditional line
      bad([{ x: 1, y: 1, text: [{ requiredFlag: 'F', text: ['x'] }] }], /unknown keys requiredFlag/);
      bad([{ x: 1, y: 1, text: ['x'], requiredFlag: 'F' }], /unknown keys requiredFlag/);
      ok([{ x: 1, y: 0, text: ['Here lies Erdrick.'] }]);
      ok([{ x: 0, y: 1, text: [{ condition: 'F', text: ['Later.'] }, { text: ['Now.'] }] }]);
      bad({ x: 1, y: 0, text: ['a'] }, /MapData.inspect: expected array/);
      bad([{ x: 'a', y: 0, text: ['a'] }], /inspect\[0\].x/);
      bad([{ x: 2, y: 0, text: ['a'] }], /inspect\[0\]: cell \(2, 0\) is outside the 2x2 map/);
      bad([{ x: 0, y: -1, text: ['a'] }], /outside/);
      bad([{ x: 0, y: 0 }], /inspect\[0\].text: expected array/);
      bad([{ x: 0, y: 0, text: [] }], /at least one line/);
      bad([{ x: 0, y: 0, text: ['a', 3] }], /inspect\[0\].text\[1\]/);
      bad([{ x: 0, y: 0, text: [{ condition: 1, text: ['a'] }] }], /text\[0\].condition/);
      bad([{ x: 0, y: 0, text: [{ text: 'a' }] }], /text\[0\].text: expected array/);
    });

    it('validates baked art chunk lists against the map size', () => {
      const art = { tile: 48, chunk: 16, below: ['b.png'], above: [null] };
      expect(() => validateMapData({ ...validMap, art })).not.toThrow();
      expect(() => validateMapData({ ...validMap, art: { ...art, below: [] } })).toThrow(/expected 1 chunks, got 0/);
      expect(() => validateMapData({ ...validMap, art: { ...art, below: [null] } })).toThrow(/art.below\[0\]/);
      expect(() => validateMapData({ ...validMap, art: { ...art, chunk: 1 } })).toThrow(/expected 4 chunks/);
    });

    it('should throw on missing id', () => {
      const { id, ...noId } = validMap;
      expect(() => validateMapData(noId)).toThrow('MapData.id: expected string, got undefined');
    });

    it('should throw on wrong type for width', () => {
      const bad = { ...validMap, width: '16' };
      expect(() => validateMapData(bad)).toThrow('MapData.width: expected number, got string');
    });

    it('should throw on invalid NPC', () => {
      const bad = { ...validMap, npcs: [{ id: 123 }] };
      expect(() => validateMapData(bad)).toThrow('MapData.npcs[0].id: expected string, got number');
    });

    it('should throw on invalid transition', () => {
      const bad = { ...validMap, transitions: [{ x: 'zero' }] };
      expect(() => validateMapData(bad)).toThrow('MapData.transitions[0].x: expected number, got string');
    });

    it('should throw on null input', () => {
      expect(() => validateMapData(null)).toThrow('MapData: expected object, got null');
    });

    it('should validate empty npcs and transitions arrays', () => {
      const emptyArrays = { ...validMap, npcs: [], transitions: [] };
      expect(validateMapData(emptyArrays)).toEqual(emptyArrays);
    });
  });
});

describe('schemaValidation: optional FF1 combat fields (T4a)', () => {
  const stats = { hp: 8, strength: 0, agility: 6, intelligence: 1, vitality: 0, luck: 0, attack: 4, defense: 4, magicDefense: 16 };
  const enemy = { id: 'goblin', name: 'Goblin', stats, xpReward: 6, goldReward: 6, sprite: 'goblin' };
  const item = { id: 'rapier', name: 'Rapier', type: 'weapon', stats: { attack: 9 }, price: 10, usableBy: ['warrior'] };
  const spell = { id: 'fire', name: 'FIRE', level: 1, type: 'black', effect: 'damage', targeting: 'single', description: 'x' };
  const block = { hp: 1, strength: 1, agility: 1, intelligence: 1, vitality: 1, luck: 1 };
  const cls = { id: 'warrior', name: 'Warrior', baseStats: block, statGrowth: block, usableEquipment: [], spellLevels: { white: 0, black: 0 } };

  it('existing data without the new fields still validates', () => {
    expect(validateEnemyData(enemy)).toEqual(enemy);
    expect(validateItemData(item)).toEqual(item);
    expect(validateSpellData(spell)).toEqual(spell);
    expect(validateCharacterClassData(cls)).toEqual(cls);
  });

  it('accepts the new numbers when present', () => {
    expect(() => validateEnemyData({ ...enemy, stats: { ...stats, accuracy: 2, evade: 6, hits: 2, crit: 1 } })).not.toThrow();
    expect(() => validateItemData({ ...item, hit: 5, crit: 4, weight: 0 })).not.toThrow();
    expect(() => validateSpellData({ ...spell, accuracy: 24, price: 100 })).not.toThrow();
    expect(() => validateCharacterClassData({
      ...cls, hitPercent: { base: 10, growth: 3 }, magicDefense: { base: 15, growth: 3 }, spellCharges: [[1, [2]], [3, [3, 1]]],
    })).not.toThrow();
  });

  it('rejects non-numbers', () => {
    expect(() => validateEnemyData({ ...enemy, stats: { ...stats, evade: '6' } })).toThrow('EnemyData.stats.evade: expected number, got string');
    expect(() => validateItemData({ ...item, weight: 'heavy' })).toThrow('ItemData.weight: expected number');
    expect(() => validateSpellData({ ...spell, accuracy: null })).toThrow('SpellData.accuracy: expected number, got null');
    expect(() => validateCharacterClassData({ ...cls, hitPercent: { base: 10 } })).toThrow('CharacterClassData.hitPercent.growth');
    expect(() => validateCharacterClassData({ ...cls, spellCharges: [[1, 2]] })).toThrow('CharacterClassData.spellCharges[0][1]');
  });
});

