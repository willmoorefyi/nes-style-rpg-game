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
  /**
   * Optional cell rule that replaces `canMove` when present (CollisionMap.isWalkable): the field's bound modes
   * (FieldVehicles, W1-A) ask the field rules, which also board a parked ship, launch the canoe or disembark at a dock.
   */
  canMoveAt?(x: number, y: number, terrain: TerrainType): boolean;
  /** Get movement speed multiplier for the given terrain (1.0 = normal) */
  getSpeedMultiplier(terrain: TerrainType): number;
  /** Get random encounter rate multiplier (0 = no encounters, 1 = normal) */
  getEncounterRateMultiplier(): number;
}
