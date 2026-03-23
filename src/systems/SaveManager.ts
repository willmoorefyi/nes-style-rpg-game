import type { SaveData } from '../types/index.js';
import { PartyManager } from '../entities/PartyManager.js';
import { Inventory } from '../entities/Inventory.js';
import { GameFlags } from '../core/GameFlags.js';

const SAVE_KEY_PREFIX = 'ff1_save_';
const MAX_SLOTS = 3;

export interface SlotSummary {
  level: number;
  playTime: number;
  partyLeader?: string;
  saveDate?: string;
}

export class SaveManager {
  static save(
    slotId: number,
    party: PartyManager,
    inventory: Inventory,
    flags: GameFlags,
    currentMap: string,
    playerPosition: { x: number; y: number },
    playTime: number
  ): boolean {
    if (slotId < 0 || slotId >= MAX_SLOTS) return false;
    
    const data: SaveData = {
      party: party.toJSON() as SaveData['party'],
      inventory: inventory.toJSON(),
      flags: flags.toJSON(),
      currentMap,
      playerPosition,
      playTime,
      saveDate: new Date().toISOString(),
      slotId,
    };
    
    try {
      localStorage.setItem(`${SAVE_KEY_PREFIX}${slotId}`, JSON.stringify(data));
      return true;
    } catch {
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
      return {
        party: PartyManager.fromJSON(data.party),
        inventory: Inventory.fromJSON(data.inventory),
        flags: GameFlags.fromJSON(data.flags),
        currentMap: data.currentMap,
        playerPosition: data.playerPosition,
        playTime: data.playTime,
      };
    } catch {
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
        });
      } catch {
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
