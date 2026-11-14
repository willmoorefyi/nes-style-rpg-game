import type { SaveData } from '../types/index.js';
import type { EnemyAiPatterns } from '../scenes/battle/BattleSceneTypes.js';
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
  battle: BattleRequest;
}

/** The parts of Game the snapshot reads and writes. */
export interface RetryState {
  party: PartyManager;
  inventory: Inventory;
  gameFlags: GameFlags;
  currentMapId: string;
  playerPosition: { x: number; y: number };
  playTime: number;
  pendingEntrance: string | null;
  restoreState(data: {
    party: PartyManager; inventory: Inventory; flags: GameFlags;
    currentMap: string; playerPosition: { x: number; y: number }; playTime: number;
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
    battle,
  });
}

/** Put the game back as the snapshot recorded it (play time keeps running) and return the battle to start again. */
export function restoreBattleSnapshot(game: RetryState, snap: BattleRetrySnapshot): BattleRequest {
  const copy = structuredClone(snap);
  game.restoreState({
    party: PartyManager.fromJSON(copy.party),
    inventory: Inventory.fromJSON(copy.inventory),
    flags: GameFlags.fromJSON(copy.flags),
    currentMap: copy.mapId,
    playerPosition: copy.position,
    playTime: game.playTime,
  });
  game.pendingEntrance = null;
  return copy.battle;
}
