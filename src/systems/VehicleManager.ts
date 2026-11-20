import type { MapData, ParkedVehicle, VehicleSpawn, VehicleState, VehicleType } from '../types/index.js';
import type { GameFlags } from '../core/GameFlags.js';
import type { MovementMode } from '../entities/MovementMode.js';

/** Active vehicle on the map after flag filtering */
interface ActiveVehicle {
  type: VehicleType;
  x: number;
  y: number;
}

/** Whether a spawn's flags are set (`requiredFlag` and every one of `requiredFlags`). */
export function spawnOpen(spawn: VehicleSpawn, has: (flag: string) => boolean): boolean {
  return (!spawn.requiredFlag || has(spawn.requiredFlag)) && (spawn.requiredFlags ?? []).every(has);
}

/** Whether a parked vehicle has its cell; a spot vehicle (`at`, NW-1) gets one when its map loads. */
export function hasCell(v: ParkedVehicle): v is VehicleState {
  const c = v as Partial<VehicleState>;
  return typeof c.x === 'number' && typeof c.y === 'number';
}

/**
 * NW-1 (docs/NATURAL_WORLD_PLAN.md 5.2): the parked vehicles with every spot vehicle of `map` resolved to its spot's
 * cell (`MapData.spots`); the other maps' spot vehicles wait for theirs. An unknown spot is logged and dropped.
 */
export function resolveParked(vehicles: readonly ParkedVehicle[], map: Pick<MapData, 'id' | 'spots'>): ParkedVehicle[] {
  return vehicles.flatMap((v): ParkedVehicle[] => {
    if (hasCell(v) || v.map !== map.id) return [v];
    const s = map.spots?.[v.at];
    if (!s) {
      console.error(`Vehicle ${v.type}: map ${map.id} has no spot ${v.at}; the vehicle is dropped`);
      return [];
    }
    return [{ type: v.type, map: v.map, x: s.at[0], y: s.at[1] }];
  });
}

/** `cells` as the parked vehicles, plus the spot vehicles of `all` (other maps', not resolved yet) of the types
 *  `cells` lacks. */
export function keepSpots(all: readonly ParkedVehicle[], cells: readonly VehicleState[]): ParkedVehicle[] {
  const types = new Set(cells.map((v) => v.type));
  return [...cells, ...all.filter((v) => !hasCell(v) && !types.has(v.type))];
}

/**
 * The vehicles parked on `mapId` (docs/QUEST_PLAN.md 3.3): a vehicle with a known position (`known`: the game's
 * parked vehicles, from a save, a dock, a landing or `set_vehicle`) is where that says, on whichever map; a vehicle
 * with none stands at this map's spawn once the spawn's flags are set. `riding` (the party's vehicle) is with the
 * party, so it is parked nowhere.
 */
export function parkedVehicles(mapId: string, spawns: readonly VehicleSpawn[], known: readonly ParkedVehicle[],
  has: (flag: string) => boolean, riding: VehicleType | null = null): VehicleState[] {
  const out: VehicleState[] = [];
  const seen = new Set<VehicleType>(riding ? [riding] : []);
  for (const v of known) {
    if (seen.has(v.type)) continue;
    seen.add(v.type);
    if (v.map === mapId && hasCell(v)) out.push({ type: v.type, map: v.map, x: v.x, y: v.y });
  }
  for (const s of spawns) {
    if (seen.has(s.type) || !spawnOpen(s, has)) continue;
    seen.add(s.type);
    out.push({ type: s.type, map: mapId, x: s.x, y: s.y });
  }
  return out;
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
      .filter((s) => spawnOpen(s, (f) => this.flags.has(f)))
      .map(s => ({ type: s.type, x: s.x, y: s.y }));
  }

  /** The vehicles on the map as `parkedVehicles` places them (known positions first, then the open spawns). */
  setParked(vehicles: readonly VehicleState[]): void {
    this.vehicles = vehicles.map((v) => ({ type: v.type, x: v.x, y: v.y }));
  }

  /** Check if a vehicle can be boarded at the given position */
  checkBoarding(playerX: number, playerY: number): MovementMode | null {
    const vehicle = this.vehicles.find(v => v.x === playerX && v.y === playerY);
    if (!vehicle) return null;
    return this.movementModes.get(vehicle.type) ?? null;
  }

  /** The movement mode of a vehicle type. */
  modeOf(type: VehicleType): MovementMode | null {
    return this.movementModes.get(type) ?? null;
  }

  get activeVehicles(): ReadonlyArray<ActiveVehicle> {
    return this.vehicles;
  }
}
