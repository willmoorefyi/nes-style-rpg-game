/**
 * Story/progression flag system for tracking game state.
 *
 * Key story flags used throughout the game:
 * - GARLAND_DEFEATED   — set after defeating Garland in Temple of Fiends
 * - PRINCESS_RESCUED   — set in post-Garland cutscene
 * - BRIDGE_BUILT       — set in post-Garland cutscene, enables wider world access
 * - BIKKE_DEFEATED     — set after defeating pirate captain, enables ship
 * - EARTH_CAVE_COMPLETE — set after Earth Cave boss, enables canoe
 * - EARTH_CRYSTAL_LIT  — set after restoring Earth Crystal, enables class upgrades
 * - FIRE_CRYSTAL_LIT   — set after restoring Fire Crystal
 * - WATER_CRYSTAL_LIT  — set after restoring Water Crystal
 * - WIND_CRYSTAL_LIT   — set after restoring Wind Crystal
 */

/** Well-known story flag names */
export const STORY_FLAGS = {
  GARLAND_DEFEATED: 'GARLAND_DEFEATED',
  PRINCESS_RESCUED: 'PRINCESS_RESCUED',
  BRIDGE_BUILT: 'BRIDGE_BUILT',
  BIKKE_DEFEATED: 'BIKKE_DEFEATED',
  EARTH_CAVE_COMPLETE: 'EARTH_CAVE_COMPLETE',
  EARTH_CRYSTAL_LIT: 'EARTH_CRYSTAL_LIT',
  FIRE_CRYSTAL_LIT: 'FIRE_CRYSTAL_LIT',
  WATER_CRYSTAL_LIT: 'WATER_CRYSTAL_LIT',
  WIND_CRYSTAL_LIT: 'WIND_CRYSTAL_LIT',
} as const;
export class GameFlags {
  private flags = new Map<string, boolean | number | string>();

  set(key: string, value: boolean | number | string = true): void {
    this.flags.set(key, value);
  }

  get<T extends boolean | number | string>(key: string): T | undefined {
    return this.flags.get(key) as T | undefined;
  }

  has(key: string): boolean {
    return this.flags.has(key);
  }

  getAll(): Record<string, boolean | number | string> {
    return Object.fromEntries(this.flags);
  }

  toJSON(): Record<string, boolean | number | string> {
    return this.getAll();
  }

  static fromJSON(data: Record<string, boolean | number | string>): GameFlags {
    const flags = new GameFlags();
    for (const [k, v] of Object.entries(data)) flags.set(k, v);
    return flags;
  }
}
