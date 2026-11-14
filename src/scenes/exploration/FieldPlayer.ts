import type { Game } from '../../core/Game.js';
import type { CollisionMap } from '../../rendering/CollisionMap.js';
import type { PlaceholderTextures } from '../../rendering/PlaceholderTextures.js';
import type { Direction } from '../../rendering/SpriteAnimation.js';
import type { MovementMode } from '../../entities/MovementMode.js';
import { PlayerController } from '../../entities/PlayerController.js';

/** The field hero and the class whose art it wears (the party leader's when it was built). */
export interface FieldPlayer {
  player: PlayerController;
  leaderClassId: string;
}

/**
 * The class id the field sprite wears: the first living member's, as in FF1 (U5); member 0's when all are down,
 * a warrior when the party is empty.
 */
export function leaderClassId(game: Pick<Game, 'party'>): string {
  const lead = game.party.all.find((m) => m.currentHp > 0) ?? game.party.get(0);
  return lead?.classData.id ?? 'warrior';
}

/** Record the hero's tile and facing on the game (save/load, and the battle snapshot for Retry / Return to Field). */
export function recordPlayer(game: Pick<Game, 'playerPosition' | 'playerFacing'>, player: PlayerController): void {
  game.playerPosition = { x: player.gridX, y: player.gridY };
  game.playerFacing = player.direction;
}

/** Turn the hero to the facing Retry / Return to Field restored, once (`pendingFacing` clears). */
export function applyPendingFacing(game: Pick<Game, 'pendingFacing'>, player: PlayerController | null | undefined): void {
  if (game.pendingFacing && player) player.face(game.pendingFacing);
  game.pendingFacing = null;
}

/** Build the field hero on (x, y) wearing the leader's art (or the placeholder sprite when the atlas is missing). */
export function createFieldPlayer(
  game: Game, placeholders: PlaceholderTextures, collisionMap: CollisionMap,
  x: number, y: number, facing?: Direction, mode?: MovementMode,
): FieldPlayer {
  const classId = leaderClassId(game);
  const art = placeholders.getPlayerArt(classId);
  const player = new PlayerController({
    startX: x, startY: y,
    texture: art?.texture ?? placeholders.getPlayerTexture(),
    animation: art?.animation,
    displayScale: art?.displayScale,
    collisionMap, input: game.input, events: game.events,
    movementMode: mode,
  });
  if (facing) player.face(facing);
  return { player, leaderClassId: classId };
}
