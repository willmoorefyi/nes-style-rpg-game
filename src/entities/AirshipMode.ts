import { TerrainType } from '../types/index.js';
import type { MovementMode } from './MovementMode.js';

/** Airship mode: flies over all terrain. No encounters. Can only land on grass. */
export class AirshipMode implements MovementMode {
  readonly id = 'airship';

  canMove(_terrain: TerrainType): boolean {
    return true;
  }

  /** Check if the airship can land on the given terrain */
  canLand(terrain: TerrainType): boolean {
    return terrain === TerrainType.Grass;
  }

  getSpeedMultiplier(_terrain: TerrainType): number {
    return 2.0;
  }

  getEncounterRateMultiplier(): number {
    return 0;
  }
}
