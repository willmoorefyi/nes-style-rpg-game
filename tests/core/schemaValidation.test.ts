import { describe, it, expect } from 'vitest';
import { validateEnemyData, validateMapData } from '../../src/core/schemaValidation.js';

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
      width: 16,
      height: 16,
      layers: [[1, 2, 3]],
      tilesets: ['tiles.png'],
      collision: [0, 0, 1],
      npcs: [{ id: 'npc1', x: 5, y: 5, sprite: 'npc.png', dialog: ['Hello'] }],
      transitions: [{ x: 0, y: 15, targetMap: 'other', targetX: 0, targetY: 0 }],
    };

    it('should validate correct map data', () => {
      expect(validateMapData(validMap)).toEqual(validMap);
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
