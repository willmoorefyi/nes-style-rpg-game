import type { FieldMode, ParkedVehicle, SaveData, VehicleState } from '../types/index.js';
import { FIELD_MODES } from '../types/index.js';
import { PartyManager } from '../entities/PartyManager.js';
import { Inventory } from '../entities/Inventory.js';
import { GameFlags } from '../core/GameFlags.js';
import { parseBoosts, type Boosts } from '../core/Boosts.js';
import { isPreNw2, NW_SAVE_VERSION, NW2_SAVE_VERSION, resetSave } from './worldReset.js';

const SAVE_KEY_PREFIX = 'ff1_save_';
const MAX_SLOTS = 3;
/**
 * Version 2 (pass W, W1-A) adds the party's field `mode` and the parked `vehicles`; a version-1 save loads on foot
 * with no vehicles. Old saves load through `Character.fromJSON`, which clamps charges and recomputes the level (T4).
 * Version 3 (pass CHT) adds the playthrough's `boosts`; an older save loads with the default boosts (`parseBoosts`).
 * Version 4 (pass NW) is the 256x256 world: a version 1-3 save goes through `resetSave` (worldReset.ts,
 * docs/NATURAL_WORLD_PLAN.md 5.3), so a party on the world map, or one owning a ship or the airship, starts again
 * before Cornelia with its vehicles at their milestone spots.
 * Version 5 (pass NW2) is the NW2 world: a version-4 save loads as it was saved and is marked `revalidate`, so
 * `LoadScene` checks its vehicles and place on the new world (`revalidateNw2`, worldRevalidate.ts,
 * docs/NW2_EDITS_PLAN.md 12).
 */
export const SAVE_VERSION = NW2_SAVE_VERSION;
/** The versions `load` reads. */
export const ACCEPTED_VERSIONS: readonly number[] = [1, 2, 3, NW_SAVE_VERSION, NW2_SAVE_VERSION];

/** The field part of a save (v2): the party's mode and the parked vehicles of every map; the boosts (v3). */
export interface SaveField {
  mode: FieldMode;
  /** Cells only: a vehicle still at a spot (`at`, NW-1, not resolved yet) refuses the save. */
  vehicles: ParkedVehicle[];
  boosts: Boosts;
}

/** What `SaveManager.load` returns (the shape `Game.restoreState` takes). */
export interface LoadedSave {
  party: PartyManager;
  inventory: Inventory;
  flags: GameFlags;
  currentMap: string;
  playerPosition: { x: number; y: number };
  playTime: number;
  fieldMode: FieldMode;
  /** Cells, plus the reset's spot vehicles (resolved when their map loads). */
  vehicles: ParkedVehicle[];
  boosts: Boosts;
  /** A pre-NW save moved to Cornelia (worldReset.ts): the loader sets `pendingEntrance = 'cornelia'`. */
  reset: boolean;
  /** A v4 save (the first NW world): the loader revalidates it on the NW2 world before the field opens. */
  revalidate: boolean;
}

const VEHICLE_TYPES = ['canoe', 'ship', 'airship'];

/** The saved vehicles that are well formed (a bad entry is logged and dropped). */
function savedVehicles(raw: unknown): VehicleState[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    console.error('Save: vehicles is not a list; loading with no vehicles', raw);
    return [];
  }
  return raw.filter((v): v is VehicleState => {
    const ok = typeof v === 'object' && v !== null && VEHICLE_TYPES.includes(v.type) && typeof v.map === 'string'
      && Number.isInteger(v.x) && Number.isInteger(v.y);
    if (!ok) console.error('Save: dropping a malformed vehicle', v);
    return ok;
  }).map((v) => ({ type: v.type, map: v.map, x: v.x, y: v.y }));
}

/** The saved mode; a missing one (version 1) is walking, an unknown one is logged and walking. */
function savedMode(raw: unknown): FieldMode {
  if (raw === undefined) return 'walking';
  const mode = FIELD_MODES.find((m) => m === raw);
  if (!mode) console.error(`Save: unknown field mode ${String(raw)}; loading on foot`);
  return mode ?? 'walking';
}

export interface SlotSummary {
  level: number;
  playTime: number;
  partyLeader?: string;
  saveDate?: string;
  /** Where the party saved: `SaveData.location`, or a label made from the map id for older saves (S5). */
  location: string;
  members: Array<{ name: string; classId: string; level: number; currentHp: number }>;
  gold: number;
}

/** `cornelia-castle-2f` -> `Cornelia Castle 2F`: title-cased words, floor tags (`2f`, `b1`) upper-cased. */
export function mapIdLabel(mapId: string): string {
  return mapId.split('-').filter(Boolean)
    .map((w) => (/^\d+f$|^b\d$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export class SaveManager {
  static save(
    slotId: number,
    party: PartyManager,
    inventory: Inventory,
    flags: GameFlags,
    currentMap: string,
    playerPosition: { x: number; y: number },
    playTime: number,
    location?: string,
    field: Partial<SaveField> = {},
  ): boolean {
    if (slotId < 0 || slotId >= MAX_SLOTS) return false;
    const vehicles = field.vehicles ?? [];
    const loose = vehicles.find((v) => !Number.isInteger((v as VehicleState).x) || !Number.isInteger((v as VehicleState).y));
    if (loose) {   // NW-1 (docs/NATURAL_WORLD_PLAN.md 5.2): a save stores cells only
      console.error(`Save to slot ${slotId} refused: the ${loose.type} on ${loose.map} has no cell yet`, loose);
      return false;
    }

    const data: SaveData = {
      version: SAVE_VERSION,
      party: party.toJSON() as SaveData['party'],
      inventory: inventory.toJSON(),
      flags: flags.toJSON(),
      currentMap,
      playerPosition,
      playTime,
      saveDate: new Date().toISOString(),
      slotId,
      mode: field.mode ?? 'walking',
      vehicles: (vehicles as VehicleState[]).map((v) => ({ type: v.type, map: v.map, x: v.x, y: v.y })),
      boosts: parseBoosts(field.boosts),
    };
    if (location !== undefined) data.location = location;
    
    try {
      localStorage.setItem(`${SAVE_KEY_PREFIX}${slotId}`, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error(`Failed to save to slot ${slotId}:`, e);
      return false;
    }
  }

  static load(slotId: number): LoadedSave | null {
    if (slotId < 0 || slotId >= MAX_SLOTS) return null;
    
    try {
      const raw = localStorage.getItem(`${SAVE_KEY_PREFIX}${slotId}`);
      if (!raw) return null;
      
      const stored: SaveData = JSON.parse(raw);
      const v1 = stored.version === 1;
      if (!ACCEPTED_VERSIONS.includes(stored.version)) {
        console.warn(`Save version mismatch: expected ${SAVE_VERSION}, got ${stored.version}`);
      }
      const { data, vehicles, moved } = resetSave({ ...stored, vehicles: v1 ? [] : savedVehicles(stored.vehicles) });
      return {
        party: PartyManager.fromJSON(data.party),
        inventory: Inventory.fromJSON(data.inventory),
        flags: GameFlags.fromJSON(data.flags),
        currentMap: data.currentMap,
        playerPosition: data.playerPosition,
        playTime: data.playTime,
        fieldMode: v1 ? 'walking' : savedMode(data.mode),
        vehicles,
        boosts: parseBoosts(data.boosts),   // v1 / v2: none saved, the defaults
        reset: moved,
        revalidate: isPreNw2(stored),
      };
    } catch (e) {
      console.error(`Failed to load save slot ${slotId}:`, e);
      return null;
    }
  }

  static getSaveSlots(): (SlotSummary | null)[] {
    const slots: (SlotSummary | null)[] = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
      try {
        const raw = localStorage.getItem(`${SAVE_KEY_PREFIX}${i}`);
        if (!raw) {
          slots.push(null);
          continue;
        }
        const data: SaveData = JSON.parse(raw);
        const leader = data.party.members[0];
        slots.push({
          level: leader?.level ?? 1,
          playTime: data.playTime,
          partyLeader: leader?.name,
          saveDate: data.saveDate,
          location: data.location ?? mapIdLabel(data.currentMap),
          members: data.party.members.map((m) => ({ name: m.name, classId: m.classId, level: m.level, currentHp: m.currentHp })),
          gold: data.party.gold,
        });
      } catch (e) {
        console.error(`Failed to read save slot ${i}:`, e);
        slots.push(null);
      }
    }
    return slots;
  }

  static deleteSave(slotId: number): boolean {
    if (slotId < 0 || slotId >= MAX_SLOTS) return false;
    localStorage.removeItem(`${SAVE_KEY_PREFIX}${slotId}`);
    return true;
  }
}
