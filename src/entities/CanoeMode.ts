import { TerrainType } from '../types/index.js';
import type { MovementMode } from './MovementMode.js';
import { vehicleTerrainAllows } from '../systems/fieldRulesVehicles.js';

/** Canoe mode: traverses rivers and water. Reduced encounters. */
export class CanoeMode implements MovementMode {
  readonly id = 'canoe';

  canMove(terrain: TerrainType): boolean {
    return vehicleTerrainAllows('canoe', terrain);
  }

  getSpeedMultiplier(_terrain: TerrainType): number {
    return 1.2;
  }

  getEncounterRateMultiplier(): number {
    return 0.5;
  }
}
