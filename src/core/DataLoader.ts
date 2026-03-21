import type { AssetLoader } from './AssetLoader.js';
import type {
  CharacterClassData,
  EnemyData,
  ItemData,
  SpellData,
  MapData,
} from '../types/index.js';

export class DataLoader {
  constructor(private assets: AssetLoader) {}

  async loadClasses(path: string): Promise<CharacterClassData[]> {
    const data = await this.assets.load<CharacterClassData[]>(path);
    this.assertArray(data, 'CharacterClassData');
    return data;
  }

  async loadEnemies(path: string): Promise<EnemyData[]> {
    const data = await this.assets.load<EnemyData[]>(path);
    this.assertArray(data, 'EnemyData');
    return data;
  }

  async loadItems(path: string): Promise<ItemData[]> {
    const data = await this.assets.load<ItemData[]>(path);
    this.assertArray(data, 'ItemData');
    return data;
  }

  async loadSpells(path: string): Promise<SpellData[]> {
    const data = await this.assets.load<SpellData[]>(path);
    this.assertArray(data, 'SpellData');
    return data;
  }

  async loadMap(path: string): Promise<MapData> {
    const data = await this.assets.load<MapData>(path);
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid MapData: expected object');
    }
    return data;
  }

  private assertArray(data: unknown, typeName: string): void {
    if (!Array.isArray(data)) {
      throw new Error(`Invalid ${typeName}: expected array`);
    }
  }
}