import type { Game } from '../../core/Game.js';
import { FIELD_MODES, type FieldMode, type VehicleSpawn, type VehicleState, type VehicleType } from '../../types/index.js';
import type { MovementMode } from '../../entities/MovementMode.js';
import type { PlayerController } from '../../entities/PlayerController.js';
import type { FieldState } from '../../systems/fieldRules.js';
import { VehicleManager } from '../../systems/VehicleManager.js';
import { CanoeMode } from '../../entities/CanoeMode.js';
import { ShipMode } from '../../entities/ShipMode.js';
import { AirshipMode } from '../../entities/AirshipMode.js';

/** The field-rule mode of a movement mode (an unknown id counts as walking, the rules' strictest). */
export function fieldModeOf(mode: MovementMode): FieldMode {
  return FIELD_MODES.find((m) => m === mode.id) ?? 'walking';
}

/**
 * The exploration scene's vehicles (docs/WORLD_PLAN.md 5.1; owned by W1-A from W1-0a on): the map's spawns after
 * their flags, boarding on confirm, and the vehicle part of the field-rule state. The VehicleManager reads the game's
 * flags, which Game.restoreState / resetState replace, so `rebind` runs on every enter.
 */
export class FieldVehicles {
  private manager: VehicleManager;
  private mapId = '';

  constructor(private readonly game: Game) {
    this.manager = this.create();
  }

  private create(): VehicleManager {
    const modes = new Map<VehicleType, MovementMode>([
      ['canoe', new CanoeMode()],
      ['ship', new ShipMode()],
      ['airship', new AirshipMode()],
    ]);
    return new VehicleManager(this.game.gameFlags, modes);
  }

  /** A fresh manager on the game's current flags (load, retry, new game). */
  rebind(): void {
    this.manager = this.create();
  }

  setSpawns(mapId: string, spawns: VehicleSpawn[]): void {
    this.mapId = mapId;
    this.manager.setSpawns(spawns);
  }

  /** Confirm while standing on a vehicle boards it (today's rule: no step onto it, no disembarking). */
  tryBoard(player: PlayerController): boolean {
    if (player.isMoving || !this.game.input.isJustPressed('confirm')) return false;
    const mode = this.manager.checkBoarding(player.gridX, player.gridY);
    if (!mode) return false;
    player.currentMode = mode;
    return true;
  }

  /** The vehicles on the current map, as the field rules see them. */
  get states(): VehicleState[] {
    return this.manager.activeVehicles.map((v) => ({ type: v.type, map: this.mapId, x: v.x, y: v.y }));
  }

  /** The field-rule state now: the game's flags and items, the party's mode and these vehicles. */
  fieldState(mode: FieldMode): FieldState {
    return fieldStateOf(this.game, mode, this.states);
  }
}

/** The field-rule state of a game: its flags and held items, `mode` and `vehicles`. */
export function fieldStateOf(game: Game, mode: FieldMode, vehicles: readonly VehicleState[] = []): FieldState {
  return {
    flags: new Set(Object.keys(game.gameFlags.getAll())),
    items: new Set(game.inventory.getAll().map((i) => i.itemId)),
    mode,
    vehicles,
  };
}
