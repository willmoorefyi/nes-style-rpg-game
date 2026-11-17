import { TerrainType } from '../types/index.js';
import type { MovementMode } from './MovementMode.js';
import { terrainAllows } from '../systems/fieldRules.js';

/** Default on-foot movement. Walkable on land terrain only. */
export class WalkingMode implements MovementMode {
  readonly id = 'walking';

  /** The field rules decide (fieldRules.terrainAllows), shared with the progression verifier. */
  canMove(terrain: TerrainType): boolean {
    return terrainAllows('walking', terrain);
  }

  getSpeedMultiplier(terrain: TerrainType): number {
    if (terrain === TerrainType.Forest) return 0.7;
    if (terrain === TerrainType.Road) return 1.3;
    return 1.0;
  }

  getEncounterRateMultiplier(): number {
    return 1.0;
  }
}
