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
  upgradeFrom?: string;
}

import type { ElementalProfile } from '../battle/Elements.js';

/** Boss phase: HP-threshold behavior change */
export interface BossPhase {
  hpThreshold: number; // percentage, e.g. 0.5 = below 50% HP
  patternId: string;   // identifies which BossPattern to switch to
  message?: string;    // e.g. "Lich's form shifts!"
}

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
  bossPhases?: BossPhase[];
  /** Enemy family/race for spell targeting (e.g., 'undead' for HARM) */
  family?: string;
  /** Size category for grid layout: small (1x1), large (2x2), boss (fills screen) */
  size?: 'small' | 'large' | 'boss';
}

export type ItemType = 'weapon' | 'armor' | 'consumable' | 'key';

export interface ItemData {
  id: string;
  name: string;
  type: ItemType;
  stats: Partial<StatBlock> & { attack?: number; defense?: number };
  price: number;
  usableBy: string[];
  slot?: EquipmentSlot;
  /** Extra damage multiplier vs enemies with this family (e.g., 'undead' for Silver Sword) */
  bonusVsFamily?: string;
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
export type SpellTargeting = 'single' | 'all' | 'self' | 'single_ally' | 'all_allies';

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
  /** If set, spell only affects enemies with this family (e.g., 'undead' for HARM) */
  targetFamily?: string;
}

/** Flag-conditional dialog entry: shows text when condition flag is set (or as default if no condition) */
export interface ConditionalDialog {
  condition?: string;  // GameFlag name — if set, show this dialog
  text: string[];
}

export interface MapNPC {
  id: string;
  x: number;
  y: number;
  sprite: string;
  dialog: string[] | ConditionalDialog[];
  shopId?: string;
  action?: string;
  chestItem?: string;
  chestFlag?: string;
  wander?: boolean;
}

/**
 * Resolve NPC dialog based on current game flags.
 * Supports both simple string[] (backward compatible) and ConditionalDialog[].
 * For conditional: returns first entry whose condition flag is set, or first entry with no condition as default.
 */
export function resolveNPCDialog(
  dialog: string[] | ConditionalDialog[],
  hasFlag: (flag: string) => boolean
): string[] {
  if (dialog.length === 0) return [];
  // Simple string[] — backward compatible
  if (typeof dialog[0] === 'string') return dialog as string[];
  // ConditionalDialog[] — find first matching condition, or default (no condition)
  const entries = dialog as ConditionalDialog[];
  let defaultEntry: ConditionalDialog | undefined;
  for (const entry of entries) {
    if (entry.condition && hasFlag(entry.condition)) return entry.text;
    if (!entry.condition && !defaultEntry) defaultEntry = entry;
  }
  return defaultEntry?.text ?? [];
}

export interface MapTransition {
  x: number;
  y: number;
  targetMap: string;
  targetX: number;
  targetY: number;
  requiredFlag?: string;  // story flag required to use this transition
}

export interface EncounterEntry {
  enemies: string[];
  weight: number;
}

export interface EncounterRate {
  min: number;
  max: number;
}

/** A one-time scripted encounter placed at a specific map tile */
export interface ScriptedEncounter {
  x: number;
  y: number;
  enemyIds: string[];
  flag: string;           // story flag set after victory
  requiredFlag?: string;  // optional prerequisite flag
  isBoss: boolean;
  message?: string;       // pre-battle dialog
  postVictoryCutscene?: string;  // cutscene ID to play after victory
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
  scriptedEncounters?: ScriptedEncounter[];
  vehicles?: VehicleSpawn[];
  keyItemGates?: KeyItemGate[];
}
/** Terrain types for the collision/movement system */
export enum TerrainType {
  Grass = 0,
  Wall = 1,
  Water = 2,
  Mountain = 3,
  Forest = 4,
  Desert = 5,
  Swamp = 6,
  River = 7,
  Road = 8,
  Bridge = 9,
}

export type VehicleType = 'canoe' | 'ship' | 'airship';

/** Vehicle spawn point on a map */
export interface VehicleSpawn {
  type: VehicleType;
  x: number;
  y: number;
  requiredFlag?: string;
}

/** Key item gate that blocks passage until the player has a required item */
export interface KeyItemGate {
  x: number;
  y: number;
  requiredItem: string;
  flag?: string;
  message: string;
  permanent: boolean;
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
