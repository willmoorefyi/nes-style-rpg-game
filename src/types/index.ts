import { Container } from 'pixi.js';

export interface Scene {
  readonly container: Container;
  enter(): void | Promise<void>;
  update(dt: number): void;
  exit(): void | Promise<void>;
  onPause?(): void;
  onResume?(): void;
}

export interface AssetManifest {
  bundles: Array<{
    name: string;
    assets: Array<{ alias: string; src: string }>;
  }>;
}

// Data schema interfaces

export interface StatBlock {
  hp: number;
  strength: number;
  agility: number;
  intelligence: number;
  vitality: number;
  luck: number;
}

export interface CharacterClassData {
  id: string;
  name: string;
  baseStats: StatBlock;
  statGrowth: StatBlock;
  usableEquipment: string[];
  spellLevels: { white: number; black: number };
}

import type { ElementalProfile } from '../battle/Elements.js';

export interface EnemyData {
  id: string;
  name: string;
  stats: StatBlock & { attack: number; defense: number; magicDefense: number };
  xpReward: number;
  goldReward: number;
  sprite: string;
  weakness?: string;
  resist?: string;
  elementalProfile?: ElementalProfile;
}

export type ItemType = 'weapon' | 'armor' | 'consumable' | 'key';

export interface ItemData {
  id: string;
  name: string;
  type: ItemType;
  stats: Partial<StatBlock> & { attack?: number; defense?: number };
  price: number;
  usableBy: string[];
}

export type ShopType = 'weapon' | 'armor' | 'item' | 'magic' | 'inn';

export interface ShopData {
  id: string;
  type: ShopType;
  name: string;
  inventory: string[];
  innPrice?: number;
}

export type SpellType = 'white' | 'black';
export type SpellTargeting = 'single' | 'all' | 'self';

export interface SpellData {
  id: string;
  name: string;
  level: number;
  type: SpellType;
  effect: string;
  targeting: SpellTargeting;
  description: string;
  power?: number;
  element?: string;
}

export interface MapNPC {
  id: string;
  x: number;
  y: number;
  sprite: string;
  dialog: string[];
  shopId?: string;
}

export interface MapTransition {
  x: number;
  y: number;
  targetMap: string;
  targetX: number;
  targetY: number;
}

export interface EncounterEntry {
  enemies: string[];
  weight: number;
}

export interface EncounterRate {
  min: number;
  max: number;
}

export interface MapData {
  id: string;
  width: number;
  height: number;
  layers: number[][];
  tilesets: string[];
  collision: number[];
  npcs: MapNPC[];
  transitions: MapTransition[];
  encounterRate?: EncounterRate;
  encounters?: EncounterEntry[];
  music?: string;
  canSave?: boolean;
}
export type EquipmentSlot = 'weapon' | 'armor' | 'shield' | 'helmet';

// Save/Load types
export interface CharacterSaveData {
  name: string;
  classId: string;
  level: number;
  xp: number;
  currentHp: number;
  equipment: Record<EquipmentSlot, string | null>;
  spellCharges: number[];
  learnedSpells: Array<{ spellId: string; level: number }>;
  statusEffects?: Array<{ effect: string; duration: number }>;
}

export interface SaveData {
  version: number;
  party: { members: CharacterSaveData[]; gold: number };
  inventory: Array<{ itemId: string; quantity: number }>;
  flags: Record<string, boolean | number | string>;
  currentMap: string;
  playerPosition: { x: number; y: number };
  playTime: number;
  saveDate: string;
  slotId: number;
}

export interface SaveSlotSummary {
  slotId: number;
  exists: boolean;
  partyLeader?: string;
  level?: number;
  playTime?: number;
  saveDate?: string;
}
