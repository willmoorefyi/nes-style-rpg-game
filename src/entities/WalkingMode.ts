import { TerrainType } from '../types/index.js';
import type { MovementMode } from './MovementMode.js';

/** Default on-foot movement. Walkable on land terrain only. */
export class WalkingMode implements MovementMode {
  readonly id = 'walking';

  canMove(terrain: TerrainType): boolean {
    switch (terrain) {
      case TerrainType.Grass:
      case TerrainType.Forest:
      case TerrainType.Desert:
      case TerrainType.Swamp:
      case TerrainType.Road:
      case TerrainType.Bridge:
        return true;
      default:
        return false;
    }
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
