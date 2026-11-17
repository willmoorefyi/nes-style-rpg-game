/**
 * Story/progression flag system for tracking game state.
 *
 * Key story flags used throughout the game:
 * - GARLAND_DEFEATED   — set after defeating Garland in Temple of Fiends
 * - PRINCESS_RESCUED   — set in post-Garland cutscene
 * - INTRO_COMPLETE     — set when the party reports the rescue to the King (act1_complete cutscene); ends act 1
 * - BRIDGE_BUILT       — opens the north bridge; not set in act 1 (a later bridge-building cutscene will set it)
 * - the pass W milestones (docs/WORLD_PLAN.md 3.1), listed after the act-1 flags below
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
  INTRO_COMPLETE: 'INTRO_COMPLETE',
  BRIDGE_BUILT: 'BRIDGE_BUILT',
  BIKKE_DEFEATED: 'BIKKE_DEFEATED',
  EARTH_CAVE_COMPLETE: 'EARTH_CAVE_COMPLETE',
  EARTH_CRYSTAL_LIT: 'EARTH_CRYSTAL_LIT',
  FIRE_CRYSTAL_LIT: 'FIRE_CRYSTAL_LIT',
  WATER_CRYSTAL_LIT: 'WATER_CRYSTAL_LIT',
  WIND_CRYSTAL_LIT: 'WIND_CRYSTAL_LIT',
  // Pass W milestones (docs/WORLD_PLAN.md 3.1); only the owner of a stage sets that stage's flags.
  MARSH_GUARD_DEFEATED: 'MARSH_GUARD_DEFEATED',
  ASTOS_DEFEATED: 'ASTOS_DEFEATED',
  PRINCE_AWAKE: 'PRINCE_AWAKE',
  CANAL_OPEN: 'CANAL_OPEN',
  VAMPIRE_DEFEATED: 'VAMPIRE_DEFEATED',
  TITAN_FED: 'TITAN_FED',
  EARTH_SEAL_BROKEN: 'EARTH_SEAL_BROKEN',
  CANOE_GIVEN: 'CANOE_GIVEN',
  EVIL_EYE_DEFEATED: 'EVIL_EYE_DEFEATED',
  AIRSHIP_RAISED: 'AIRSHIP_RAISED',
  ORDEALS_GUARD_DEFEATED: 'ORDEALS_GUARD_DEFEATED',
  CLASS_UPGRADED: 'CLASS_UPGRADED',
  CUBE_GIVEN: 'CUBE_GIVEN',
  FAIRY_FREED: 'FAIRY_FREED',
  LUFENIAN_LEARNED: 'LUFENIAN_LEARNED',
  CHIME_GIVEN: 'CHIME_GIVEN',
  SKY_FORTRESS_OPEN: 'SKY_FORTRESS_OPEN',
  TIME_GATE_OPEN: 'TIME_GATE_OPEN',
  PAST_LICH_DEFEATED: 'PAST_LICH_DEFEATED',
  PAST_ASHEN_DEFEATED: 'PAST_ASHEN_DEFEATED',
  PAST_DROWNED_DEFEATED: 'PAST_DROWNED_DEFEATED',
  PAST_SERAPH_DEFEATED: 'PAST_SERAPH_DEFEATED',
  DEATH_EYE_DEFEATED: 'DEATH_EYE_DEFEATED',
  CHAOS_DEFEATED: 'CHAOS_DEFEATED',
} as const;

/** Region prefixes of local flags (WORLD 3.1): `<prefix>...` and chests `CHEST_<prefix>...`. */
export const LOCAL_FLAG_PREFIXES = ['A1_', 'ELF_', 'ERT_', 'FIR_', 'ORD_', 'WAT_', 'WND_', 'PST_'] as const;

/** A story flag, or a region-local flag (`ELF_T_...`, `CHEST_ERT_D_...`). */
export function isKnownFlag(flag: string): boolean {
  if ((Object.values(STORY_FLAGS) as string[]).includes(flag)) return true;
  const local = flag.startsWith('CHEST_') ? flag.slice('CHEST_'.length) : flag;
  return LOCAL_FLAG_PREFIXES.some((p) => local.startsWith(p) && local.length > p.length);
}
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
