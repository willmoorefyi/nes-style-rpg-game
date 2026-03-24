import type { VehicleSpawn, VehicleType } from '../types/index.js';
import type { GameFlags } from '../core/GameFlags.js';
import type { MovementMode } from '../entities/MovementMode.js';

/** Active vehicle on the map after flag filtering */
interface ActiveVehicle {
  type: VehicleType;
  x: number;
  y: number;
}

/**
 * Manages vehicle spawns for the current map.
 * Filters spawns by required story flags and checks boarding at player position.
 */
export class VehicleManager {
  private vehicles: ActiveVehicle[] = [];
  private flags: GameFlags;
  private movementModes: Map<VehicleType, MovementMode>;

  constructor(flags: GameFlags, movementModes: Map<VehicleType, MovementMode>) {
    this.flags = flags;
    this.movementModes = movementModes;
  }

  setSpawns(spawns: VehicleSpawn[]): void {
    this.vehicles = spawns
      .filter(s => !s.requiredFlag || this.flags.has(s.requiredFlag))
      .map(s => ({ type: s.type, x: s.x, y: s.y }));
  }

  /** Check if a vehicle can be boarded at the given position */
  checkBoarding(playerX: number, playerY: number): MovementMode | null {
    const vehicle = this.vehicles.find(v => v.x === playerX && v.y === playerY);
    if (!vehicle) return null;
    return this.movementModes.get(vehicle.type) ?? null;
  }

  get activeVehicles(): ReadonlyArray<ActiveVehicle> {
    return this.vehicles;
  }
}
