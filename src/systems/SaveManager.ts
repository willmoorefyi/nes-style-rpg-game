import type { FieldMode, SaveData, VehicleState } from '../types/index.js';
import { FIELD_MODES } from '../types/index.js';
import { PartyManager } from '../entities/PartyManager.js';
import { Inventory } from '../entities/Inventory.js';
import { GameFlags } from '../core/GameFlags.js';
import { parseBoosts, type Boosts } from '../core/Boosts.js';

const SAVE_KEY_PREFIX = 'ff1_save_';
const MAX_SLOTS = 3;
/**
 * Version 2 (pass W, W1-A) adds the party's field `mode` and the parked `vehicles`; a version-1 save loads on foot
 * with no vehicles, and its overworld position is an act-1 cell (GAP-17: `frame: 'a1'`, translated by the world's
 * `world.frames.a1.origin` on the next field enter). Old saves load through `Character.fromJSON`, which clamps
 * charges and recomputes the level (T4). Version 3 (pass CHT) adds the playthrough's `boosts`; an older save loads
 * with the default boosts (`parseBoosts`).
 */
export const SAVE_VERSION = 3;

/** The field part of a save (v2): the party's mode and the parked vehicles of every map; the boosts (v3). */
export interface SaveField {
  mode: FieldMode;
  vehicles: VehicleState[];
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
  vehicles: VehicleState[];
  boosts: Boosts;
  /** `a1`: a version-1 save on `overworld`, whose position is an act-1 cell (GAP-17). */
  frame: 'a1' | null;
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
      vehicles: (field.vehicles ?? []).map((v) => ({ ...v })),
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
      
      const data: SaveData = JSON.parse(raw);
      const v1 = data.version === 1;
      if (!v1 && data.version !== 2 && data.version !== SAVE_VERSION) {
        console.warn(`Save version mismatch: expected ${SAVE_VERSION}, got ${data.version}`);
      }
      return {
        party: PartyManager.fromJSON(data.party),
        inventory: Inventory.fromJSON(data.inventory),
        flags: GameFlags.fromJSON(data.flags),
        currentMap: data.currentMap,
        playerPosition: data.playerPosition,
        playTime: data.playTime,
        fieldMode: v1 ? 'walking' : savedMode(data.mode),
        vehicles: v1 ? [] : savedVehicles(data.vehicles),
        boosts: parseBoosts(data.boosts),   // v1 / v2: none saved, the defaults
        frame: v1 && data.currentMap === 'overworld' ? 'a1' : null,
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
