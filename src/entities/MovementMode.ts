/**
 * MovementMode interface for future movement system.
 * Defines contract for different movement modes (walk, vehicle, airship).
 */
export interface MovementMode {
  /** Check if movement to position is allowed */
  canMove(x: number, y: number): boolean;
  /** Get movement speed in ms per tile */
  getSpeed(): number;
  /** Get random encounter rate multiplier (0 = no encounters) */
  getEncounterRate(): number;
}
