import { TerrainType } from '../types/index.js';
import type { MovementMode } from './MovementMode.js';
import { airshipTerrainLands } from '../systems/fieldRulesVehicles.js';

/** Airship mode: flies over all terrain. No encounters. Lands on grass only (fieldRules.canLand adds the cell rules). */
export class AirshipMode implements MovementMode {
  readonly id = 'airship';

  canMove(_terrain: TerrainType): boolean {
    return true; // fieldRulesVehicles.vehicleTerrainAllows('airship', t)
  }

  /** Check if the airship can land on the given terrain */
  canLand(terrain: TerrainType): boolean {
    return airshipTerrainLands(terrain);
  }

  getSpeedMultiplier(_terrain: TerrainType): number {
    return 2.0;
  }

  getEncounterRateMultiplier(): number {
    return 0;
  }
}
