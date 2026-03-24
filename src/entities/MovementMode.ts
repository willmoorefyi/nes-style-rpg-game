/**
 * MovementMode interface for the movement system.
 * Defines contract for different movement modes (walk, vehicle, airship).
 */
import { TerrainType } from '../types/index.js';

export interface MovementMode {
  /** Unique identifier for this mode */
  readonly id: string;
  /** Check if movement onto the given terrain type is allowed */
  canMove(terrain: TerrainType): boolean;
  /** Get movement speed multiplier for the given terrain (1.0 = normal) */
  getSpeedMultiplier(terrain: TerrainType): number;
  /** Get random encounter rate multiplier (0 = no encounters, 1 = normal) */
  getEncounterRateMultiplier(): number;
}
