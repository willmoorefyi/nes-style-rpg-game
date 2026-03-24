import { describe, it, expect, vi } from 'vitest';
import { DataLoader } from '../../src/core/DataLoader.js';
import type { AssetLoader } from '../../src/core/AssetLoader.js';

describe('DataLoader', () => {
  const mockAssetLoader = (data: unknown): AssetLoader => ({
    loadYaml: vi.fn().mockResolvedValue(data),
  } as unknown as AssetLoader);

  it('should load and validate class data', async () => {
    const classData = [{
      id: 'warrior', name: 'Warrior',
      baseStats: { hp: 35, strength: 20, agility: 5, intelligence: 1, vitality: 10, luck: 5 },
      statGrowth: { hp: 6, strength: 3, agility: 1, intelligence: 0, vitality: 2, luck: 1 },
      usableEquipment: ['sword'],
      spellLevels: { white: 0, black: 0 },
    }];
    const loader = new DataLoader(mockAssetLoader(classData));
    
    const result = await loader.loadClasses('classes.yaml');
    expect(result).toEqual(classData);
  });

  it('should throw on invalid class data', async () => {
    const loader = new DataLoader(mockAssetLoader({ invalid: true }));
    
    await expect(loader.loadClasses('classes.yaml')).rejects.toThrow('expected array');
  });

  it('should load enemy data', async () => {
    const enemyData = [{
      id: 'goblin',
      name: 'Goblin',
      stats: { hp: 10, strength: 5, agility: 3, intelligence: 1, vitality: 4, luck: 2, attack: 8, defense: 2, magicDefense: 1 },
      xpReward: 10,
      goldReward: 5,
      sprite: 'goblin.png',
    }];
    const loader = new DataLoader(mockAssetLoader(enemyData));
    
    const result = await loader.loadEnemies('enemies.yaml');
    expect(result).toEqual(enemyData);
  });

  it('should throw on invalid enemy data', async () => {
    const loader = new DataLoader(mockAssetLoader([{ id: 'bad' }]));
    
    await expect(loader.loadEnemies('enemies.yaml')).rejects.toThrow('EnemyData[0]');
  });

  it('should load item data', async () => {
    const itemData = [{
      id: 'potion', name: 'Potion', type: 'consumable',
      stats: {}, price: 60, usableBy: ['warrior'],
    }];
    const loader = new DataLoader(mockAssetLoader(itemData));
    
    const result = await loader.loadItems('items.yaml');
    expect(result).toEqual(itemData);
  });

  it('should load spell data', async () => {
    const spellData = [{
      id: 'cure', name: 'CURE', level: 1, type: 'white',
      effect: 'heal', targeting: 'single', description: 'Restore HP',
    }];
    const loader = new DataLoader(mockAssetLoader(spellData));
    
    const result = await loader.loadSpells('spells.yaml');
    expect(result).toEqual(spellData);
  });

  it('should load map data', async () => {
    const mapData = {
      id: 'town',
      width: 2,
      height: 2,
      layers: [[1, 2, 3]],
      tilesets: ['tiles.png'],
      collision: [0, 0, 1, 0],
      npcs: [],
      transitions: [],
    };
    const loader = new DataLoader(mockAssetLoader(mapData));
    
    const result = await loader.loadMap('map.yaml');
    expect(result).toEqual(mapData);
  });

  it('should throw on invalid map data', async () => {
    const loader = new DataLoader(mockAssetLoader(null));
    
    await expect(loader.loadMap('map.yaml')).rejects.toThrow('expected object');
  });
});

describe('DataLoader - test-town.yaml format', () => {
  const mockAssetLoader = (data: unknown): AssetLoader => ({
    loadYaml: vi.fn().mockResolvedValue(data),
  } as unknown as AssetLoader);

  it('should parse complete MapData with all required fields', async () => {
    const testTownData = {
      id: 'test-town',
      width: 16,
      height: 16,
      layers: [Array(256).fill(2)],
      tilesets: ['tileset.png'],
      collision: Array(256).fill(0),
      npcs: [
        { id: 'villager1', x: 3, y: 3, sprite: 'npc.png', dialog: ['Hello!'] }
      ],
      transitions: [
        { x: 8, y: 15, targetMap: 'test-overworld', targetX: 10, targetY: 5 }
      ],
    };

    const loader = new DataLoader(mockAssetLoader(testTownData));
    const result = await loader.loadMap('test-town.yaml');

    expect(result.id).toBe('test-town');
    expect(result.width).toBe(16);
    expect(result.height).toBe(16);
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0]).toHaveLength(256);
    expect(result.npcs).toHaveLength(1);
    expect(result.npcs[0].dialog).toEqual(['Hello!']);
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].targetMap).toBe('test-overworld');
  });

  it('should handle map with multiple NPCs and transitions', async () => {
    const mapData = {
      id: 'multi',
      width: 8,
      height: 8,
      layers: [Array(64).fill(1)],
      tilesets: [],
      collision: Array(64).fill(0),
      npcs: [
        { id: 'npc1', x: 1, y: 1, sprite: 'a.png', dialog: ['Line 1', 'Line 2'] },
        { id: 'npc2', x: 2, y: 2, sprite: 'b.png', dialog: [] },
      ],
      transitions: [
        { x: 0, y: 7, targetMap: 'map-a', targetX: 0, targetY: 0 },
        { x: 7, y: 7, targetMap: 'map-b', targetX: 5, targetY: 5 },
      ],
    };

    const loader = new DataLoader(mockAssetLoader(mapData));
    const result = await loader.loadMap('multi.yaml');

    expect(result.npcs).toHaveLength(2);
    expect(result.transitions).toHaveLength(2);
  });
});
