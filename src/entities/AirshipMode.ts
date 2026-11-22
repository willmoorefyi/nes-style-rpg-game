import { TerrainType } from '../types/index.js';
import type { MovementMode } from './MovementMode.js';
import { airshipTerrainLands } from '../systems/fieldRulesVehicles.js';

/**
 * The airship's speed over walking (QF, playtest 2026-11-22: "the airship should fly faster"; was 2.0). Its own, fixed:
 * the Walk speed boost leaves it alone (user ruling 2026-11-22), so both views stream at one known speed.
 */
export const AIRSHIP_SPEED = 3.0;

/** Airship mode: flies over all terrain. No encounters. Lands on grass only, never taiga or snow (fieldRules.canLand adds the cell rules). */
export class AirshipMode implements MovementMode {
  readonly id = 'airship';

  canMove(_terrain: TerrainType): boolean {
    return true; // fieldRulesVehicles.vehicleTerrainAllows('airship', t)
  }

  /** Check if the airship can land on the given terrain */
  canLand(terrain: TerrainType): boolean {
    return airshipTerrainLands(terrain);
  }

  /** AIRSHIP_SPEED times walking on grass; the Walk speed boost does not apply (PlayerController.stepRate). */
  getSpeedMultiplier(_terrain: TerrainType): number {
    return AIRSHIP_SPEED;
  }

  getEncounterRateMultiplier(): number {
    return 0;
  }
}
