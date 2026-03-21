import { Container } from 'pixi.js';

export interface Scene {
  readonly container: Container;
  enter(): void | Promise<void>;
  update(dt: number): void;
  exit(): void | Promise<void>;
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

export interface EnemyData {
  id: string;
  name: string;
  stats: StatBlock & { attack: number; defense: number; magicDefense: number };
  xpReward: number;
  goldReward: number;
  sprite: string;
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
}

export interface MapNPC {
  id: string;
  x: number;
  y: number;
  sprite: string;
}

export interface MapTransition {
  x: number;
  y: number;
  targetMap: string;
  targetX: number;
  targetY: number;
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
}