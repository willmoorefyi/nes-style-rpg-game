import type { SaveData } from '../types/index.js';
import { PartyManager } from '../entities/PartyManager.js';
import { Inventory } from '../entities/Inventory.js';
import { GameFlags } from '../core/GameFlags.js';

const SAVE_KEY_PREFIX = 'ff1_save_';
const MAX_SLOTS = 3;
/** Unchanged by T4: old saves load through `Character.fromJSON`, which clamps charges and recomputes the level. */
export const SAVE_VERSION = 1;

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
    location?: string
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

  static load(slotId: number): {
    party: PartyManager;
    inventory: Inventory;
    flags: GameFlags;
    currentMap: string;
    playerPosition: { x: number; y: number };
    playTime: number;
  } | null {
    if (slotId < 0 || slotId >= MAX_SLOTS) return null;
    
    try {
      const raw = localStorage.getItem(`${SAVE_KEY_PREFIX}${slotId}`);
      if (!raw) return null;
      
      const data: SaveData = JSON.parse(raw);
      if (data.version !== SAVE_VERSION) {
        console.warn(`Save version mismatch: expected ${SAVE_VERSION}, got ${data.version}`);
      }
      return {
        party: PartyManager.fromJSON(data.party),
        inventory: Inventory.fromJSON(data.inventory),
        flags: GameFlags.fromJSON(data.flags),
        currentMap: data.currentMap,
        playerPosition: data.playerPosition,
        playTime: data.playTime,
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
