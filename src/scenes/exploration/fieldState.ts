import type { Game } from '../../core/Game.js';
import type { FieldMode, VehicleState } from '../../types/index.js';
import type { FieldState } from '../../systems/fieldRules.js';

/** The field-rule state of a game: its flags and held items, `mode` and `vehicles`. */
export function fieldStateOf(game: Game, mode: FieldMode, vehicles: readonly VehicleState[] = []): FieldState {
  return {
    flags: new Set(Object.keys(game.gameFlags.getAll())),
    items: new Set(game.inventory.getAll().map((i) => i.itemId)),
    mode,
    vehicles,
  };
}
