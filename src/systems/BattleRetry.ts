import type { FieldMode, ParkedVehicle, SaveData } from '../types/index.js';
import type { EnemyAiPatterns } from '../scenes/battle/BattleSceneTypes.js';
import type { Direction } from '../rendering/SpriteAnimation.js';
import { PartyManager } from '../entities/PartyManager.js';
import { Inventory } from '../entities/Inventory.js';
import { GameFlags } from '../core/GameFlags.js';

/** Optional config for boss/scripted battles */
export interface BossBattleConfig {
  canRun: boolean;
  flag?: string;         // story flag to set on victory
  isBoss: boolean;
  postVictoryCutscene?: string;  // cutscene ID to play after victory
}

/** Everything needed to start the same battle again. */
export interface BattleRequest {
  enemyIds: string[];
  bossConfig?: BossBattleConfig;
  background?: string;
  enemyAi?: EnemyAiPatterns;
}

/** The game as it was when a battle started (JSON, so later changes don't leak in), plus the battle itself. */
export interface BattleRetrySnapshot {
  party: SaveData['party'];
  inventory: SaveData['inventory'];
  flags: SaveData['flags'];
  mapId: string;
  position: { x: number; y: number };
  /** The way the hero faced when the battle began (e.g. toward Garland); missing means the default facing. */
  facing?: Direction;
  battle: BattleRequest;
  /** The party's field mode and the parked vehicles when the battle began (GAP-12): a retry after a sea battle puts
   *  the party back on its ship. Missing (an older snapshot) means on foot with no vehicles. */
  mode?: FieldMode;
  vehicles?: ParkedVehicle[];
}

/** The parts of Game the snapshot reads and writes. */
export interface RetryState {
  party: PartyManager;
  inventory: Inventory;
  gameFlags: GameFlags;
  currentMapId: string;
  playerPosition: { x: number; y: number };
  /** The hero's facing (recorded) and the facing to apply on the next field enter (restored). */
  playerFacing?: Direction;
  pendingFacing?: Direction | null;
  playTime: number;
  pendingEntrance: string | null;
  /** The party's field mode and the parked vehicles of every map (GAP-12; missing: on foot, none). */
  fieldMode?: FieldMode;
  vehicles?: ParkedVehicle[];
  restoreState(data: {
    party: PartyManager; inventory: Inventory; flags: GameFlags;
    currentMap: string; playerPosition: { x: number; y: number }; playTime: number;
    fieldMode?: FieldMode; vehicles?: ParkedVehicle[];
  }): void;
}

/** Snapshot for Game Over > Retry; null when there is no field map to return to (e.g. debug battles). */
export function captureBattleSnapshot(game: RetryState, battle: BattleRequest): BattleRetrySnapshot | null {
  if (!game.currentMapId) return null;
  return structuredClone({
    party: game.party.toJSON() as SaveData['party'],
    inventory: game.inventory.toJSON(),
    flags: game.gameFlags.toJSON(),
    mapId: game.currentMapId,
    position: { ...game.playerPosition },
    facing: game.playerFacing,
    battle,
    mode: game.fieldMode ?? 'walking',
    vehicles: game.vehicles ?? [],
  });
}

/**
 * Put the game back as the snapshot recorded it (play time keeps running; the hero's facing is applied on the next
 * field enter; the mode and the vehicles too, GAP-12) and return the battle to start again.
 */
export function restoreBattleSnapshot(game: RetryState, snap: BattleRetrySnapshot): BattleRequest {
  const copy = structuredClone(snap);
  game.restoreState({
    party: PartyManager.fromJSON(copy.party),
    inventory: Inventory.fromJSON(copy.inventory),
    flags: GameFlags.fromJSON(copy.flags),
    currentMap: copy.mapId,
    playerPosition: copy.position,
    playTime: game.playTime,
    fieldMode: copy.mode ?? 'walking',
    vehicles: copy.vehicles ?? [],
  });
  game.pendingEntrance = null;
  game.pendingFacing = copy.facing ?? null;
  return copy.battle;
}

/** Below this share of max HP a member counts as hurt when the battle began. */
const WEAK_HP_SHARE = 0.25;

/**
 * 'weak' when the snapshot's party went into the battle with someone fallen or under 25 % HP: Game Over then
 * suggests Return to Field instead of replaying the same doomed fight (U4).
 */
export function retryAdvice(snap: BattleRetrySnapshot): 'weak' | 'ok' {
  const party = PartyManager.fromJSON(structuredClone(snap.party));
  const weak = party.all.some((m) => m.currentHp <= 0 || m.currentHp < m.maxHp * WEAK_HP_SHARE);
  return weak ? 'weak' : 'ok';
}
