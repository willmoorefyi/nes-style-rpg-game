/**
 * Pass W contract types (docs/WORLD_PLAN.md 5.1 W1-0a, docs/QUEST_PLAN.md 4.1 Q1-0): the map, NPC, save and quest
 * fields the world build-out adds. `types/index.ts` re-exports this module and its interfaces extend the `*Fields`
 * interfaces below, so the new fields cost index.ts no lines. W1-0a only declares them; the owners in the comments
 * implement them (W1-A vehicles and save, W1-B NPC and field rules, W1-C1 / W1-C2 the compiler, W1-H the verifier).
 */
import type { VehicleType } from './index.js';

/** A cell as [x, y]. */
export type CellXY = [number, number];

/** The four field movement modes (`MovementMode.id`). */
export const FIELD_MODES = ['walking', 'canoe', 'ship', 'airship'] as const;
export type FieldMode = (typeof FIELD_MODES)[number];

/** Every flag of the list must be set (an AND gate, GAP-3). */
export interface RequiredFlagsField {
  requiredFlags?: string[];
}

/** A terrain override while `flag` is set (GAP-2: the north bridge, the canal). Implemented by W1-B. */
export interface MapPatch {
  id: string;
  flag: string;
  /** The patched cells, each taking `terrain` (a TerrainType value). */
  cells: CellXY[];
  terrain: number;
}

/** An ocean cell where the ship may disembark onto the adjacent land cell, and stays parked (QUEST 3.3; W1-A). */
export interface Dock {
  id: string;
  x: number;
  y: number;
  /** The basin the dock lies in (`world_api.BASIN_SEEDS`: `aldi` or `ocean`). */
  basin: string;
}

/** Cells that hurt each living member by `damage` per walking step, never below 1 HP (W1-B). */
export interface Hazard {
  id: string;
  rects: [number, number, number, number][];
  damage: number;
}

/** Where the field spell EXIT (`field_exit`) leads from this map (W1-B). */
export interface MapExit {
  map: string;
  entrance: string;
}

/** A vehicle's parked position (save v2, the retry snapshot, debug scenarios; W1-A). */
export interface VehicleState {
  type: VehicleType;
  map: string;
  x: number;
  y: number;
}

/** A frame of the compiled world: the act-1 block's origin and size in world cells (GAP-17). */
export interface MapWorldFrame {
  origin: CellXY;
  size: CellXY;
}

/** `MapData.world` (GAP-17; written by W1-C2's compiler, read by W1-A's save and W1-B's debug loader). */
export interface MapWorld {
  frames: { a1?: MapWorldFrame };
}

/** The fields pass W adds to `MapData`. */
export interface MapDataQuestFields {
  docks?: Dock[];
  patches?: MapPatch[];
  hazards?: Hazard[];
  exit?: MapExit;
  world?: MapWorld;
}

/** The fields pass W adds to `MapNPC` (trades GAP-3, tint, class upgrade GAP-8, takeGold GAP-15, clinic GAP-16). */
export interface MapNPCQuestFields {
  /** Item the trade needs (`npcOutcome`). */
  requiredItem?: string;
  /** The trade takes `requiredItem` when true. */
  takeItem?: boolean;
  /** A PixiJS tint for the field sprite, "#rrggbb". */
  tint?: string;
  /** The flag `action: classUpgrade` needs (replaces the fixed EARTH_CRYSTAL_LIT rule). */
  actionFlag?: string;
  /** The trade needs at least this much gold and takes it (GAP-15). */
  takeGold?: number;
  /** `action: clinic`: gold per level of each fallen member revived (GAP-16). */
  clinicPrice?: number;
}

/** The fields pass W adds to `EncounterZone`. */
export interface EncounterZoneQuestFields {
  /** The modes the zone's table applies to; missing means walking and canoe. */
  modes?: FieldMode[];
  /** The bestiary habitat label. */
  name?: string;
}

/** The fields pass W adds to `SaveData` (version 2; W1-A). */
export interface SaveDataQuestFields {
  vehicles?: VehicleState[];
  mode?: FieldMode;
}

/** The fields pass W adds to `BakedMapArt`: patch overlay images by patch id (`patch_<pid>.png`). */
export interface BakedMapArtQuestFields {
  patches?: Record<string, string>;
}

/** Flags, items and vehicles a stage needs or grants. */
export interface QuestNeeds {
  flags: string[];
  items: string[];
  vehicles: string[];
}

/** A gate that may be removed without a verifier failure, with the reason (QUEST 2.4, WORLD 6.3). */
export interface QuestNonLoadBearing {
  map: string;
  kind: string;
  at: CellXY;
  reason: string;
  /** Matches only the element with this exact label (required for `kind: quest`, whose cell is always [0, 0]). */
  element?: string;
  /** Excuses the element only in a `--stage <stage>` run (a stage-scope blind spot the full run catches). */
  stage?: string;
}

/** Where a stage's proofs start in assume mode (QUEST 5.1). */
export interface QuestEntry {
  map: string;
  x: number;
  y: number;
  mode?: FieldMode;
  vehicles?: VehicleState[];
}

export type QuestStatus = 'pending' | 'built';

/** One stage of `assets/data/quest.yaml` (QUEST 2.4 with WORLD 3.4's `optional` and `milestones`). */
export interface QuestStage {
  id: string;
  title: string;
  tranche: string;
  after: string[];
  requires: QuestNeeds;
  grants: QuestNeeds;
  boss: string[];
  band: [number, number] | null;
  kit: string | null;
  maps: string[];
  zones: string[];
  grind: number;
  walk: string[];
  entry?: QuestEntry;
  basins: Record<string, CellXY>;
  nonLoadBearing: QuestNonLoadBearing[];
  status: QuestStatus;
  /** Not in the goal's `after` closure (S19, S31). */
  optional?: boolean;
  /** An ordered list of the stage's own flags (D-W12). */
  milestones?: string[];
}

/** One shop town of `quest.yaml` `towns:` (WORLD 3.4, 3.5). */
export interface QuestTown {
  id: string;
  owner: string;
  maps: string[];
  opensAfter: string[];
  bandStage: string;
  kit: string;
  status: QuestStatus;
}

/** The whole of `assets/data/quest.yaml`. */
export interface QuestData {
  goal: string;
  stages: QuestStage[];
  towns: QuestTown[];
}
