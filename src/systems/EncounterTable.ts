import type { EncounterEntry, EncounterGroup } from '../types/index.js';

/** Most enemies in one battle (FF1). Rolled formations are cut from the end to this size. */
export const MAX_FORMATION = 9;

/** One weighted random formation from a map's (or a zone's) encounter list. */
export class EncounterTable {
  private entries: EncounterEntry[] = [];
  private totalWeight = 0;
  private rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
  }

  setEntries(entries: EncounterEntry[]): void {
    this.entries = entries;
    this.totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
  }

  selectEnemies(): string[] {
    if (this.entries.length === 0 || this.totalWeight === 0) return [];
    let roll = this.rng() * this.totalWeight;
    for (const entry of this.entries) {
      roll -= entry.weight;
      if (roll <= 0) return this.formation(entry);
    }
    return this.formation(this.entries[this.entries.length - 1]);
  }

  get isEmpty(): boolean {
    return this.entries.length === 0;
  }

  /** Legacy `enemies` lists are used as they are (capped); `groups` roll each count in [min, max]. */
  private formation(entry: EncounterEntry): string[] {
    if (entry.groups === undefined) return entry.enemies.slice(0, MAX_FORMATION);
    const out: string[] = [];
    for (const group of entry.groups) {
      const n = this.rollCount(group);
      for (let i = 0; i < n; i++) out.push(group.id);
    }
    if (out.length === 0 && entry.groups.length > 0) out.push(entry.groups[0].id);
    return out.slice(0, MAX_FORMATION);
  }

  private rollCount(group: EncounterGroup): number {
    const max = group.max ?? group.min;
    return group.min + Math.floor(this.rng() * (max - group.min + 1));
  }
}
