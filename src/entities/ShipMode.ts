import { TerrainType } from '../types/index.js';
import type { MovementMode } from './MovementMode.js';
import { vehicleTerrainAllows } from '../systems/fieldRulesVehicles.js';

/** Ship mode: traverses water only. No encounters. */
export class ShipMode implements MovementMode {
  readonly id = 'ship';

  canMove(terrain: TerrainType): boolean {
    return vehicleTerrainAllows('ship', terrain);
  }

  getSpeedMultiplier(_terrain: TerrainType): number {
    return 1.5;
  }

  getEncounterRateMultiplier(): number {
    return 0;
  }
}
