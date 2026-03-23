import type { DataLoader } from '../core/DataLoader.js';
import type { CharacterClassData } from '../types/index.js';

export class ClassRegistry {
  private static classes: Map<string, CharacterClassData> = new Map();
  private static initialized = false;

  static async init(loader: DataLoader): Promise<void> {
    if (this.initialized) return;
    const data = await loader.loadClasses('assets/data/classes.json');
    for (const cls of data) {
      this.classes.set(cls.id, cls);
    }
    this.initialized = true;
  }

  static getClass(id: string): CharacterClassData | undefined {
    return this.classes.get(id);
  }

  static getAll(): CharacterClassData[] {
    return Array.from(this.classes.values());
  }

  static reset(): void {
    this.classes.clear();
    this.initialized = false;
  }
}
