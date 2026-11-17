/**
 * The vehicle branches of the field rules (docs/WORLD_PLAN.md 5.1; owned by W1-A from W1-0a on). At W1-0a they keep
 * today's behaviour: a vehicle moves over the terrain its mode allows, and there is no boarding by a step, no
 * disembarking and no landing. Pure TypeScript: no PixiJS, no game objects.
 */
import { TerrainType } from '../types/index.js';
import type { FieldMode } from '../types/index.js';

/** Whether a vehicle in `mode` may move onto terrain `t` (today's ShipMode, CanoeMode and AirshipMode rules). */
export function vehicleTerrainAllows(mode: Exclude<FieldMode, 'walking'>, t: TerrainType): boolean {
  switch (mode) {
    case 'ship': return t === TerrainType.Water;
    case 'canoe': return t === TerrainType.River || t === TerrainType.Water;
    case 'airship': return true;
  }
}

/** Where the airship may land: grass only (AirshipMode.canLand; W1-A adds the cell rules of QUEST 3.3). */
export function airshipTerrainLands(t: TerrainType): boolean {
  return t === TerrainType.Grass;
}

/** The outcome of a step in a vehicle mode, before gates, transitions and encounters (see fieldStep). */
export interface VehicleMove {
  ok: boolean;
  mode: FieldMode;
}

/**
 * A step while in a vehicle: it stays in its mode when the target terrain allows the mode, and is refused
 * otherwise. A step never changes the mode at W1-0a (no disembark at a dock, no boarding a parked vehicle).
 */
export function vehicleMove(mode: Exclude<FieldMode, 'walking'>, target: TerrainType): VehicleMove {
  return { ok: vehicleTerrainAllows(mode, target), mode };
}

/**
 * Whether the airship can land on a cell. Act 1 has no landing (there is no airship yet), so this is false at
 * W1-0a; W1-A implements QUEST 3.3 (grass, not a transition, gate or NPC cell) with `airshipTerrainLands`.
 */
export function vehicleCanLand(): boolean {
  return false;
}
