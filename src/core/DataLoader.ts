import type { AssetLoader } from './AssetLoader.js';
import type {
  CharacterClassData,
  EnemyData,
  ItemData,
  ShopData,
  SpellData,
  MapData,
} from '../types/index.js';
import { validateClassCopies } from './schemaValidationClasses.js';
import { validateEnemyData, validateMapData, validateShopData, validateCharacterClassData, validateItemData, validateSpellData } from './schemaValidation.js';
import { validateSpellEffects, validateStatusVisuals } from './schemaValidationFx.js';
import type { SpellEffectsData, StatusVisualsData } from '../types/fxData.js';
import { validateBestiary } from './bestiaryValidation.js';

export class DataLoader {
  constructor(private assets: AssetLoader) {}

  async loadClasses(path: string): Promise<CharacterClassData[]> {
    const data = await this.assets.loadYaml<unknown[]>(path);
    this.assertArray(data, 'CharacterClassData');
    const classes = data.map((item, i) => {
      try {
        return validateCharacterClassData(item);
      } catch (e) {
        throw new Error(`CharacterClassData[${i}]: ${(e as Error).message}`);
      }
    });
    validateClassCopies(classes);   // plan 17: copyOf names an original of the same tier
    return classes;
  }

  async loadEnemies(path: string): Promise<EnemyData[]> {
    const data = await this.assets.loadYaml<unknown[]>(path);
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
    const data = await this.assets.loadYaml<unknown[]>(path);
    this.assertArray(data, 'ItemData');
    return data.map((item, i) => {
      try {
        return validateItemData(item);
      } catch (e) {
        throw new Error(`ItemData[${i}]: ${(e as Error).message}`);
      }
    });
  }

  async loadSpells(path: string): Promise<SpellData[]> {
    const data = await this.assets.loadYaml<unknown[]>(path);
    this.assertArray(data, 'SpellData');
    return data.map((item, i) => {
      try {
        return validateSpellData(item);
      } catch (e) {
        throw new Error(`SpellData[${i}]: ${(e as Error).message}`);
      }
    });
  }

  async loadMap(path: string): Promise<MapData> {
    const data = await this.assets.loadYaml<unknown>(path);
    return validateMapData(data);
  }

  /** Ids listed in a compiled-map manifest (assets/maps/ai/index.yaml). */
  async loadMapManifest(path: string): Promise<string[]> {
    const data = await this.assets.loadYaml<unknown>(path);
    if (!Array.isArray(data) || data.some((v) => typeof v !== 'string')) {
      throw new Error(`${path}: expected a list of map ids`);
    }
    return data as string[];
  }

  async loadShops(path: string): Promise<ShopData[]> {
    const data = await this.assets.loadYaml<unknown[]>(path);
    this.assertArray(data, 'ShopData');
    return data.map((item, i) => {
      try {
        return validateShopData(item);
      } catch (e) {
        throw new Error(`ShopData[${i}]: ${(e as Error).message}`);
      }
    });
  }

  /** assets/data/spell-effects.yaml: bad entries are logged and dropped (validateSpellEffects). */
  async loadSpellEffects(path: string): Promise<SpellEffectsData> {
    return validateSpellEffects(await this.assets.loadYaml<unknown>(path), path);
  }

  /** assets/data/status-visuals.yaml: bad entries are logged and dropped (validateStatusVisuals). */
  async loadStatusVisuals(path: string): Promise<StatusVisualsData> {
    return validateStatusVisuals(await this.assets.loadYaml<unknown>(path), path);
  }

  /** assets/data/bestiary.yaml: bad keys are logged and take their defaults (validateBestiary). */
  async loadBestiary(path: string): Promise<ReturnType<typeof validateBestiary>> {
    return validateBestiary(await this.assets.loadYaml<unknown>(path), path);
  }

  private assertArray(data: unknown, typeName: string): void {
    if (!Array.isArray(data)) {
      throw new Error(`Invalid ${typeName}: expected array`);
    }
  }
}
