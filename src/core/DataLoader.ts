import type { AssetLoader } from './AssetLoader.js';
import type {
  CharacterClassData,
  EnemyData,
  ItemData,
  ShopData,
  SpellData,
  MapData,
} from '../types/index.js';
import { validateEnemyData, validateMapData, validateShopData } from './schemaValidation.js';

export class DataLoader {
  constructor(private assets: AssetLoader) {}

  async loadClasses(path: string): Promise<CharacterClassData[]> {
    const data = await this.assets.load<CharacterClassData[]>(path);
    this.assertArray(data, 'CharacterClassData');
    return data;
  }

  async loadEnemies(path: string): Promise<EnemyData[]> {
    const data = await this.assets.load<unknown[]>(path);
    this.assertArray(data, 'EnemyData');
    return data.map((item, i) => {
      try {
        return validateEnemyData(item);
      } catch (e) {
        throw new Error(`EnemyData[${i}]: ${(e as Error).message}`);
      }
    });
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
    const data = await this.assets.load<unknown>(path);
    return validateMapData(data);
  }

  async loadShops(path: string): Promise<ShopData[]> {
    const data = await this.assets.load<unknown[]>(path);
    this.assertArray(data, 'ShopData');
    return data.map((item, i) => {
      try {
        return validateShopData(item);
      } catch (e) {
        throw new Error(`ShopData[${i}]: ${(e as Error).message}`);
      }
    });
  }

  private assertArray(data: unknown, typeName: string): void {
    if (!Array.isArray(data)) {
      throw new Error(`Invalid ${typeName}: expected array`);
    }
  }
}
