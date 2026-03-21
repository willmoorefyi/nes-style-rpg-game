import { describe, it, expect, vi } from 'vitest';
import { DataLoader } from '../../src/core/DataLoader.js';
import type { AssetLoader } from '../../src/core/AssetLoader.js';

describe('DataLoader', () => {
  const mockAssetLoader = (data: unknown): AssetLoader => ({
    load: vi.fn().mockResolvedValue(data),
  } as unknown as AssetLoader);

  it('should load and validate class data', async () => {
    const classData = [{ id: 'warrior', name: 'Warrior' }];
    const loader = new DataLoader(mockAssetLoader(classData));
    
    const result = await loader.loadClasses('classes.json');
    expect(result).toEqual(classData);
  });

  it('should throw on invalid class data', async () => {
    const loader = new DataLoader(mockAssetLoader({ invalid: true }));
    
    await expect(loader.loadClasses('classes.json')).rejects.toThrow('expected array');
  });

  it('should load enemy data', async () => {
    const enemyData = [{ id: 'goblin', name: 'Goblin' }];
    const loader = new DataLoader(mockAssetLoader(enemyData));
    
    const result = await loader.loadEnemies('enemies.json');
    expect(result).toEqual(enemyData);
  });

  it('should load item data', async () => {
    const itemData = [{ id: 'potion', name: 'Potion' }];
    const loader = new DataLoader(mockAssetLoader(itemData));
    
    const result = await loader.loadItems('items.json');
    expect(result).toEqual(itemData);
  });

  it('should load spell data', async () => {
    const spellData = [{ id: 'cure', name: 'CURE' }];
    const loader = new DataLoader(mockAssetLoader(spellData));
    
    const result = await loader.loadSpells('spells.json');
    expect(result).toEqual(spellData);
  });

  it('should load map data', async () => {
    const mapData = { id: 'town', width: 32, height: 32 };
    const loader = new DataLoader(mockAssetLoader(mapData));
    
    const result = await loader.loadMap('map.json');
    expect(result).toEqual(mapData);
  });

  it('should throw on invalid map data', async () => {
    const loader = new DataLoader(mockAssetLoader(null));
    
    await expect(loader.loadMap('map.json')).rejects.toThrow('expected object');
  });
});