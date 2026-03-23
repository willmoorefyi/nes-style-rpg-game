import type { DataLoader } from '../core/DataLoader.js';
import type { SpellData, SpellType } from '../types/index.js';

export class SpellRegistry {
  private static spells: Map<string, SpellData> = new Map();
  private static initialized = false;

  static async init(loader: DataLoader): Promise<void> {
    if (this.initialized) return;
    const data = await loader.loadSpells('assets/data/spells.yaml');
    for (const spell of data) {
      this.spells.set(spell.id, spell);
    }
    this.initialized = true;
  }

  static getSpell(id: string): SpellData | undefined {
    return this.spells.get(id);
  }

  static getByLevel(level: number): SpellData[] {
    return Array.from(this.spells.values()).filter(s => s.level === level);
  }

  static getByType(type: SpellType): SpellData[] {
    return Array.from(this.spells.values()).filter(s => s.type === type);
  }

  static reset(): void {
    this.spells.clear();
    this.initialized = false;
  }
}
