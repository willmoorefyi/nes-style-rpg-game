import type { EncounterEntry } from '../types/index.js';

export class EncounterTable {
  private entries: EncounterEntry[] = [];
  private totalWeight = 0;

  setEntries(entries: EncounterEntry[]): void {
    this.entries = entries;
    this.totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
  }

  selectEnemies(): string[] {
    if (this.entries.length === 0 || this.totalWeight === 0) return [];
    let roll = Math.random() * this.totalWeight;
    for (const entry of this.entries) {
      roll -= entry.weight;
      if (roll <= 0) return entry.enemies;
    }
    return this.entries[this.entries.length - 1].enemies;
  }

  get isEmpty(): boolean {
    return this.entries.length === 0;
  }
}
