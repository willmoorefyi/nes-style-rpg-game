/**
 * The save reset of pass NW (docs/NATURAL_WORLD_PLAN.md 5.3, D-NW8): the world map was regenerated at 256x256, so
 * a pre-NW save (version 1, 2 or 3) cannot keep its world-map cells. Pure, no I/O: `SaveManager.load` calls
 * `resetSave` and `LoadScene` sends a moved party to Cornelia's south-gate arrival (`pendingEntrance`).
 *
 * - A pre-NW save is **moved** to Cornelia, on foot, when it is on `overworld` or owns a ship or the airship
 *   (`BIKKE_DEFEATED` / `AIRSHIP_RAISED`), wherever it is (Q4a: a party in Melmond would walk out to a ship that is
 *   now elsewhere). One owning neither, inside another map, keeps its place (every such map is act 1's).
 * - In every pre-NW save the vehicles on `overworld` are dropped and `resetVehicles(flags)` added: spot vehicles,
 *   resolved to cells when the world map loads (`FieldVehicles` / `resolveParked`). The canoe is an item.
 * - Flags, party, inventory, gold, play time and boosts are kept.
 *
 * The verifier's `--from-reset` (src/progression/questReset.ts) imports `resetVehicles`, the code the game runs.
 */
import type { ParkedVehicle, SaveData, VehicleType } from '../types/index.js';

/** Saves before this version predate the NW world. */
export const NW_SAVE_VERSION = 4;
/** The world map and the entrance a moved save arrives at (Cornelia's south gate). */
export const RESET_MAP = 'overworld';
export const RESET_ENTRANCE = 'cornelia';
export const RESET_LOCATION = 'Cornelia';
/** The one line the field shows after a reset (once, through the field's DialogManager). */
export const RESET_NOTICE = 'The world has changed. You stand before Cornelia.';

/** The milestone flag that owns each parked vehicle, and its spot on the NW world (5.3's table). */
export const RESET_SPOTS: ReadonlyArray<{ flag: string; type: VehicleType; at: string }> = [
  { flag: 'BIKKE_DEFEATED', type: 'ship', at: 'a1_s_pravoka_ship' },     // the a1_pravoka dock
  { flag: 'AIRSHIP_RAISED', type: 'airship', at: 'a1_s_airship' },       // a landing on grass by Cornelia
];

type Flags = ReadonlySet<string> | ((flag: string) => boolean);

const held = (flags: Flags, f: string): boolean => (typeof flags === 'function' ? flags(f) : flags.has(f));

/** The parked vehicles a reset gives, by the milestone flags held (no stage order). */
export function resetVehicles(flags: Flags): ParkedVehicle[] {
  return RESET_SPOTS.filter((r) => held(flags, r.flag)).map((r) => ({ type: r.type, map: RESET_MAP, at: r.at }));
}

/** A save of an older version than the NW world (none: a fresh v4 save). */
export function isPreNw(data: Pick<SaveData, 'version'>): boolean {
  return !(typeof data.version === 'number' && data.version >= NW_SAVE_VERSION);
}

/** True when a pre-NW save must be moved to Cornelia (on the world map, or owning a ship or the airship). */
export function mustMove(data: Pick<SaveData, 'currentMap' | 'flags'>): boolean {
  const flags = (f: string): boolean => !!data.flags?.[f];
  return data.currentMap === RESET_MAP || RESET_SPOTS.some((r) => flags(r.flag));
}

export interface ResetResult {
  data: SaveData;
  vehicles: ParkedVehicle[];
  /** Moved to Cornelia: the loader sends the party to `RESET_ENTRANCE` and the field shows `RESET_NOTICE`. */
  moved: boolean;
}

/** The reset of one pre-NW save (the input is not changed). A v4 save comes back as it is, `moved` false. */
export function resetSave(data: SaveData): ResetResult {
  const kept = (data.vehicles ?? []).map((v) => ({ ...v }));
  if (!isPreNw(data)) return { data, vehicles: kept, moved: false };
  const flags = (f: string): boolean => !!data.flags?.[f];
  const vehicles: ParkedVehicle[] = [...kept.filter((v) => v.map !== RESET_MAP), ...resetVehicles(flags)];
  if (!mustMove(data)) return { data: { ...data, mode: 'walking' }, vehicles, moved: false };
  return {
    data: { ...data, currentMap: RESET_MAP, mode: 'walking', location: RESET_LOCATION },
    vehicles,
    moved: true,
  };
}
