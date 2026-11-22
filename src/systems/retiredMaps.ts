/**
 * Retired maps (pass CD, docs/CARDIA_PLAN.md 8): map ids that no longer exist, with the place a save inside one
 * loads at instead. Pure; `SaveManager.load` applies it first, before the NW reset (`resetSave`) and the NW2
 * revalidation, so both run on the relocated save. No SAVE_VERSION bump: the rule is keyed on the retired ids, which
 * no new save can hold. Vehicles are kept as saved; `playerPosition` is left alone (the entrance places the party).
 */
import type { SaveData } from '../types/index.js';

export interface RetiredTarget {
  map: string;
  entrance: string;
  location: string;
}

/** Bahamut's cave and lair became Cardia Deep, the dragon great village: the cave its Sea Gate, the lair its Court. */
export const RETIRED_MAPS: Readonly<Record<string, RetiredTarget>> = {
  'bahamut-cave': { map: 'cardia-deep', entrance: 'bahamut_gate', location: 'Cardia Deep' },
  'bahamut-lair': { map: 'cardia-deep', entrance: 'court', location: 'Cardia Deep' },
};

/** The save moved out of a retired map (on foot, at its target's entrance), or unchanged with `entrance` null. */
export function relocateRetired(data: SaveData): { data: SaveData; entrance: string | null } {
  const to = Object.prototype.hasOwnProperty.call(RETIRED_MAPS, data.currentMap) ? RETIRED_MAPS[data.currentMap] : null;
  if (!to) return { data, entrance: null };
  return { data: { ...data, currentMap: to.map, mode: 'walking', location: to.location }, entrance: to.entrance };
}
