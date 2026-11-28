import { Container } from 'pixi.js';
import type { BakedMapArtQuestFields, EncounterZoneQuestFields, MapDataQuestFields, MapNPCQuestFields, RequiredFlagsField,
  SaveDataQuestFields } from './quest.js';
export * from './quest.js';
import type { AmbientEffect } from './ambient.js';
export * from './ambient.js';

export interface Scene {
  readonly container: Container;
  /** When true, `SceneManager.push` leaves the scene below visible (an overlay such as the inn). */
  readonly transparent?: boolean;
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
  /** Short label for tight UI (the party-creation slot strip), e.g. WAR, WHM; missing means the full name. */
  abbr?: string;
  baseStats: StatBlock;
  statGrowth: StatBlock;
  usableEquipment: string[];
  spellLevels: { white: number; black: number };
  upgradeFrom?: string;
  /** FF1 hit%: `base + growth * (level - 1)` (plus the weapon's `hit`); missing means 0. */
  hitPercent?: ClassGrowth;
  /** Magic defence against enemy spells: `base + growth * (level - 1)`; missing means 0. */
  magicDefense?: ClassGrowth;
  /** Spell-charge step breakpoints `[[level, [l1..l8]], ...]` (read by the charge rules; missing means none). */
  spellCharges?: Array<[number, number[]]>;
  /**
   * FF1 Black Belt / Master rules: unarmed attack ⌊STR/2⌋ + 2 × level with double hits, and absorb at least the
   * level without body armour. Missing means false.
   */
  unarmedMartial?: boolean;
}

/** A per-level class number: `base + growth * (level - 1)`. */
export interface ClassGrowth {
  base: number;
  growth: number;
}

import type { ElementalProfile } from '../battle/Elements.js';
import type { EnemyRosterFields } from './enemyRoster.js';

/** Boss phase: HP-threshold behavior change */
export interface BossPhase {
  hpThreshold: number; // percentage, e.g. 0.5 = below 50% HP
  patternId: string;   // identifies which BossPattern to switch to
  message?: string;    // e.g. "Lich's form shifts!"
  /** Overrides applied once the phase is crossed (B1): hits per attack, and the attack number. */
  hits?: number;
  attack?: number;
  /** `heavy` from this phase on (ROSTER_PLAN 7.2; validated, played by the boss rigs that need it). */
  attackAnim?: 'heavy';
  /** A form phase (CHAOS_FORMS_PLAN 2.2): reaching the threshold re-points the instance to this enemy id. */
  form?: string;
  /** The transformation interlude id (battle-interludes.yaml) a form phase plays. */
  interlude?: string;
  /** A form phase only: the new form acts at once after a change reached by an action (CHAOS_FIX_PLAN 2.4 M6). */
  arrivalTurn?: true;
}

/** Enemy combat numbers (FF1). The optional ones default to accuracy 0, evade 0, hits 1, crit 1 (out of 200). */
export interface EnemyCombatStats {
  attack: number;
  /** Absorb: subtracted from each hit. */
  defense: number;
  magicDefense: number;
  /** Hit% added to the 168 base of the hit roll. */
  accuracy?: number;
  evade?: number;
  /** Hits per attack. */
  hits?: number;
  /** Critical chance out of 200. */
  crit?: number;
}

export interface EnemyData extends EnemyRosterFields {
  id: string;
  name: string;
  stats: StatBlock & EnemyCombatStats;
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
  size?: 'small' | 'large' | 'huge' | 'boss' | 'titan';
  /** How its Fight reaches the party: `melee` travels to the target (missing means melee), `ranged` attacks in place. */
  attack?: 'melee' | 'ranged';
  /** A ranged attack's effect id (`attacks` in assets/data/spell-effects.yaml). */
  attackEffect?: string;
  /** `heavy`: the raised overhead blow (Garland, the lich). */
  attackAnim?: 'heavy';
  /** A heavy attacker's tint pulse in the raised hold, "#rrggbb" (default #ffb0b0; lighter on pale art, the lich). */
  pulseTint?: string;
  /** A boss form record (CHAOS_FORMS_PLAN 2.2, 3.6): the id of the battle's first form. Such records have no `num`. */
  formOf?: string;
  /** A colossus form (ColossusView): its art id in assets/sprites/colossus.json. */
  colossus?: string;
  /** Colossus layer frames that differ from the art's rest (F4: `{core: open}`). */
  colossusVariant?: Record<string, string>;
  /** F3's slam (R9): one physical attack on `targets` (2) different living heroes; only on colossus records. */
  slam?: { targets: number };
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
  /** Weapon hit% bonus (FF1); missing means 0. */
  hit?: number;
  /** Weapon critical chance out of 200; missing means 0. */
  crit?: number;
  /** Armour weight, subtracted from evade; missing means 0. */
  weight?: number;
  /** One-line help text for menus and shops (what the item does). */
  description?: string;
  /** The plural name when the English rule gets it wrong ("Small Knives"); see `pluralName`. */
  plural?: string;
  /** Confirm question asked before a party item (Tent, Cabin) is used; missing means "Use <name>?". */
  prompt?: string;
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
  /** Added to the 148 base of the connect / status roll; missing means 24 (FF1). */
  accuracy?: number;
  /** Shop price; when missing, the per-level price table applies. */
  price?: number;
}

/** Flag-conditional dialog entry: shows text when condition flag is set (or as default if no condition) */
export interface ConditionalDialog {
  condition?: string;  // GameFlag name, or `item:<id>` (an item held; W1-B) — if set, show this dialog
  text: string[];
}

export interface MapNPC extends MapNPCQuestFields {
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
  /** Present only while this story flag is set (e.g. the princess after PRINCESS_RESCUED). */
  showIf?: string;
  /** Removed once this story flag is set (e.g. the captive princess in the temple). */
  hideIf?: string;
  /** Given once, after the NPC's dialog, the first time the player talks to them. */
  giftItem?: string;
  giftFlag?: string;
  /** Cutscene played once after talking (when `requiredFlag` is set and `onceFlag` is not; the script sets `onceFlag`). */
  cutscene?: NPCCutscene;
}

export interface NPCCutscene extends RequiredFlagsField {
  /** Id in assets/data/cutscenes.yaml. */
  id: string;
  requiredFlag?: string;
  onceFlag: string;
}

/** Whether a map NPC is present for the current story flags. */
export function npcPresent(npc: Pick<MapNPC, 'showIf' | 'hideIf'>, hasFlag: (flag: string) => boolean): boolean {
  if (npc.showIf && !hasFlag(npc.showIf)) return false;
  if (npc.hideIf && hasFlag(npc.hideIf)) return false;
  return true;
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

/** A transition lands either on fixed coordinates or on a named entrance of the target map (`MapData.entrances`). */
export type MapTransition = {
  x: number;
  y: number;
  targetMap: string;
  requiredFlag?: string;  // story flag required to use this transition
  requiredFlags?: string[];  // every one of these flags is required too
  /** Screen effect when taking this transition: a door opening, or the plain fade. */
  effect?: 'door' | 'fade';
} & ({ targetX: number; targetY: number; targetEntrance?: undefined }
  | { targetEntrance: string; targetX?: undefined; targetY?: undefined });

/** `count` enemies of one id in a formation, rolled in [min, max] (max defaults to min). */
export interface EncounterGroup {
  id: string;
  min: number;
  max?: number;
}

/** A weighted formation: a fixed `enemies` list (legacy) or rolled `groups`; at most 9 enemies in total. */
export type EncounterEntry = { weight: number } & (
  | { enemies: string[]; groups?: undefined }
  | { groups: EncounterGroup[]; enemies?: undefined });

export interface EncounterRate {
  min: number;
  max: number;
}

/** A region of a map with its own table (and optionally rate); rects are inclusive [x0, y0, x1, y1]. */
export interface EncounterZone extends EncounterZoneQuestFields {
  id: string;
  rects: [number, number, number, number][];
  encounters: EncounterEntry[];
  encounterRate?: EncounterRate;
}

/** A one-time scripted encounter placed at a specific map tile */
export interface ScriptedEncounter extends RequiredFlagsField {
  x: number;
  y: number;
  enemyIds: string[];
  flag: string;           // story flag set after victory
  requiredFlag?: string;  // optional prerequisite flag
  isBoss: boolean;
  message?: string;       // pre-battle dialog
  postVictoryCutscene?: string;  // cutscene ID to play after victory
  /** Talking to this NPC (an `npcs[].id` of the same map) starts the encounter (B1). */
  npc?: string;
}

export interface MapData extends MapDataQuestFields {
  id: string;
  /** Display name for the field HUD (no label when missing). */
  name?: string;
  width: number;
  height: number;
  layers: number[][];
  tilesets: string[];
  collision: number[];
  npcs: MapNPC[];
  transitions: MapTransition[];
  encounterRate?: EncounterRate;
  encounters?: EncounterEntry[];
  /** Regional tables: the first zone containing the player's cell overrides `encounters` (and `encounterRate`). */
  encounterZones?: EncounterZone[];
  music?: string;
  canSave?: boolean;
  /** Tents and Cabins work here (FF1: the world map only). Default false. */
  camp?: boolean;
  scriptedEncounters?: ScriptedEncounter[];
  vehicles?: VehicleSpawn[];
  keyItemGates?: KeyItemGate[];
  /** Battle stage background ids (assets/backgrounds/<id>.webp); `terrain` keys are lowercase TerrainType names;
   *  `zones` keys are `encounterZones` ids, each with its own default and terrain table. */
  battleBackgrounds?: {
    default?: string;
    terrain?: Record<string, string>;
    zones?: Record<string, { default?: string; terrain?: Record<string, string> }>;
  };
  /** Named arrival cells, e.g. `south_gate: [23, 34]` (targets of `targetEntrance`). */
  entrances?: Record<string, [number, number]>;
  /** Extra tiles wandering NPCs never step onto (single-file routes they would plug), as [x, y]. */
  noWander?: [number, number][];
  /** Cells that show text when the player faces one and presses confirm (a tomb, a sign). */
  inspect?: MapInspectCell[];
  /** Looping field effects (the volcano's smoke; types/ambient.ts). */
  ambient?: AmbientEffect[];
  /** Baked 2x art from assets-src/tools/build_map.py; when set, `layers` is empty. */
  art?: BakedMapArt;
  /** The map is a torus (pass WR: the world map; streamed baked maps only, src/systems/worldWrap.ts). */
  wrap?: boolean;
}

/** An inspectable map cell; `text` resolves like NPC dialog (plain lines, or conditional entries). */
export interface MapInspectCell {
  x: number;
  y: number;
  text: string[] | ConditionalDialog[];
}

/** Baked map chunks: `chunk` x `chunk` tiles of `tile` native px each, row-major; `above` is null where empty. */
export interface BakedMapArt extends BakedMapArtQuestFields {
  tile: number;
  chunk: number;
  below: string[];
  above: (string | null)[];
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
  Lake = 11, // 10 stays the compiler's counter value
  Taiga = 12, // NW2 (D-NW2-4; tundra before): walkable at forest's speed, no landing
  Snow = 13, // walkable, no landing
}

export type VehicleType = 'canoe' | 'ship' | 'airship';

/** Vehicle spawn point on a map */
export interface VehicleSpawn extends RequiredFlagsField {
  type: VehicleType;
  x: number;
  y: number;
  requiredFlag?: string;
}

/** Key item gate that blocks passage until the player has a required item */
export interface KeyItemGate extends RequiredFlagsField {
  id?: string; // NW-1: a name quest.yaml's nonLoadBearing `ref` can use (the bridge gates)
  x: number;
  y: number;
  /** Item that opens the gate; omit when the gate opens on a story flag (`requiredFlag`). */
  requiredItem?: string;
  /** Story flag that opens the gate (e.g. BRIDGE_BUILT). */
  requiredFlag?: string;
  flag?: string;
  /** Shown while blocked: plain text, or conditional entries resolved on the story flags (T1). */
  message: string | ConditionalDialog[];
  permanent: boolean;
}

/** FF1's weapon and four armour slots; `hands` is the glove slot (gloves, gauntlets, the ProRing; pass EQ). */
export type EquipmentSlot = 'weapon' | 'armor' | 'shield' | 'helmet' | 'hands';

// Save/Load types
export interface CharacterSaveData {
  name: string;
  classId: string;
  level: number;
  xp: number;
  currentHp: number;
  /** Every slot `toJSON` writes; a save from before pass EQ has no `hands` (it loads empty). */
  equipment: Partial<Record<EquipmentSlot, string | null>>;
  spellCharges: number[];
  learnedSpells: Array<{ spellId: string; level: number }>;
  statusEffects?: Array<{ effect: string; duration: number }>;
}

export interface SaveData extends SaveDataQuestFields {
  version: number;
  party: { members: CharacterSaveData[]; gold: number };
  inventory: Array<{ itemId: string; quantity: number }>;
  flags: Record<string, boolean | number | string>;
  currentMap: string;
  playerPosition: { x: number; y: number };
  playTime: number;
  saveDate: string;
  slotId: number;
  /** Display name of the map at save time (S5); older saves fall back to a label made from `currentMap`. */
  location?: string;
  /** The playthrough's boosts (v3, src/core/Boosts.ts); older saves have none (the defaults). */
  boosts?: import('../core/Boosts.js').Boosts;
}
