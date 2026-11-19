import type { Game } from '../../core/Game.js';
import type { MapData } from '../../types/index.js';
import type { PlayerController } from '../../entities/PlayerController.js';
import { modeAfterStep, patchedTerrain, type FieldState } from '../../systems/fieldRules.js';
import { vehicleTerrainAllows } from '../../systems/fieldRulesVehicles.js';

/** P3-11: the line when a step onto River or Lake is refused for want of a canoe (the hint NPCs say the same). */
export const NO_CANOE_HINT = 'The water runs too deep to wade. A boat light enough to carry would cross it.';

/**
 * P3-11: the line for a step the hero just pressed toward River or Lake that is refused because the party holds no
 * canoe (and none is parked there to board); null for any other press or refusal. The caller checks that the party
 * is on foot and passes the walking field state (FieldVehicles.fieldState('walking')), and shows the line.
 */
export function bankHintFor(game: Game, map: MapData, player: PlayerController, walking: FieldState): string | null {
  if (player.isMoving) return null;
  const dir = (['up', 'down', 'left', 'right'] as const).find((d) => game.input.isJustPressed(d));
  if (!dir) return null;
  const from = { x: player.gridX, y: player.gridY };
  const to = {
    x: from.x + (dir === 'left' ? -1 : dir === 'right' ? 1 : 0),
    y: from.y + (dir === 'up' ? -1 : dir === 'down' ? 1 : 0),
  };
  const flags = new Set(Object.keys(game.gameFlags.getAll()));
  if (!vehicleTerrainAllows('canoe', patchedTerrain(map, to.x, to.y, flags))) return null;
  return modeAfterStep(map, from, to, walking) === null ? NO_CANOE_HINT : null;
}
