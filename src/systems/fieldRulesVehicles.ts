/**
 * The vehicle branches of the field rules (docs/QUEST_PLAN.md 3.3, docs/WORLD_PLAN.md 2.6; owned by W1-A):
 * - the ship sails Water only; it disembarks only from a dock, onto the adjacent land cell, and stays parked there;
 *   walking onto the parked ship boards it;
 * - the canoe is an ability: with the `canoe` item a walking step onto River or Lake switches to canoe, a canoe step
 *   onto land switches back (a spawned canoe is boarded like the ship);
 * - the airship flies over every cell of the map and lands on grass that is not a transition, gate or NPC cell
 *   (take-off and landing are confirm presses, not steps).
 * Pure TypeScript: no PixiJS, no game objects. fieldRules.ts supplies the cell reads (terrain after patches, NPCs,
 * gates, transitions), so this module imports nothing from it.
 */
import { TerrainType } from '../types/index.js';
import type { FieldMode, VehicleState, VehicleType } from '../types/index.js';

type Cell = { x: number; y: number };
export type VehicleMode = Exclude<FieldMode, 'walking'>;

/** The vehicle a field mode rides, or null on foot (the four modes are the three vehicles plus walking). */
export function vehicleOf(mode: FieldMode): VehicleType | null {
  return mode === 'walking' ? null : mode;
}

/** Whether a vehicle in `mode` may stand on terrain `t`: the ship on Water, the canoe on River and Lake, the
 *  airship anywhere. */
export function vehicleTerrainAllows(mode: VehicleMode, t: TerrainType): boolean {
  switch (mode) {
    case 'ship': return t === TerrainType.Water;
    case 'canoe': return t === TerrainType.River || t === TerrainType.Lake;
    case 'airship': return true;
  }
}

/** The terrain the airship may land on: grass or tundra, never snow (D-NW9). */
export function airshipTerrainLands(t: TerrainType): boolean {
  return t === TerrainType.Grass || t === TerrainType.Tundra;
}

/** What the vehicle rules read about a map, given by fieldRules.ts. */
export interface CellReader {
  /** The map's id (a parked vehicle is on the map whose id it names). */
  mapId: string;
  inBounds(c: Cell): boolean;
  /** Terrain after the patches whose flag is set. */
  terrain(c: Cell): TerrainType;
  /** Whether a party on foot may stand on terrain `t` (fieldRules.terrainAllows('walking', t)). */
  walkable(t: TerrainType): boolean;
  /** A present, non-wandering NPC stands on the cell. */
  staticNpc(c: Cell): boolean;
  /** The cell is a dock (MapData.docks). */
  dock(c: Cell): boolean;
  /** The cell holds a key-item gate. */
  gate(c: Cell): boolean;
  /** The cell holds a transition. */
  transition(c: Cell): boolean;
}

/** What a step reads of the party: its mode, held items and the parked vehicles. */
export interface VehicleParty {
  mode: FieldMode;
  items: ReadonlySet<string>;
  vehicles: readonly VehicleState[];
}

/** The parked vehicle (not the one ridden) that a walking step onto `c` boards: a ship or a spawned canoe. */
export function parkedAt(r: CellReader, party: VehicleParty, c: Cell): VehicleState | null {
  return party.vehicles.find((v) => v.map === r.mapId && v.x === c.x && v.y === c.y && v.type !== party.mode
    && v.type !== 'airship') ?? null;
}

/**
 * The party's mode after one step from `from` to the 4-neighbour `to`, or null when the step is refused. Gates,
 * transitions and scripted encounters are not looked at (fieldStep does that); a static NPC blocks every mode but
 * the airship.
 */
export function stepMode(r: CellReader, party: VehicleParty, from: Cell, to: Cell): FieldMode | null {
  if (!r.inBounds(to)) return null;
  if (party.mode === 'airship') return 'airship';
  if (r.staticNpc(to)) return null;
  const t = r.terrain(to);
  switch (party.mode) {
    case 'walking': {
      const parked = parkedAt(r, party, to);
      if (parked && vehicleTerrainAllows(parked.type, t)) return parked.type;
      if (r.walkable(t)) return 'walking';
      return party.items.has('canoe') && vehicleTerrainAllows('canoe', t) ? 'canoe' : null;
    }
    case 'canoe':
      if (vehicleTerrainAllows('canoe', t)) return 'canoe';
      return r.walkable(t) ? 'walking' : null;
    case 'ship':
      if (vehicleTerrainAllows('ship', t)) return 'ship';
      // disembark only from a dock, onto the adjacent land cell (the ship stays parked on the dock)
      return r.dock(from) && r.walkable(t) ? 'walking' : null;
  }
}

/** Whether the airship may land on the cell: in the map, grass after patches, and no transition, gate or NPC. */
export function vehicleCanLand(r: CellReader, c: Cell): boolean {
  return r.inBounds(c) && airshipTerrainLands(r.terrain(c)) && !r.transition(c) && !r.gate(c) && !r.staticNpc(c);
}

/**
 * The parked vehicles after a step (or a landing / take-off) that changed the mode from `before` to `after` on
 * `mapId`: a vehicle left behind is parked where the step began (the ship at its dock, a spawned canoe at the bank;
 * the canoe ability leaves nothing), and a boarded vehicle is no longer parked. Every other vehicle stays.
 */
export function vehiclesAfterStep(vehicles: readonly VehicleState[], mapId: string, before: FieldMode, after: FieldMode,
  from: Cell, to: Cell, canoeItem: boolean): VehicleState[] {
  if (before === after) return vehicles.map((v) => ({ ...v }));
  let out = vehicles.map((v) => ({ ...v }));
  const left = vehicleOf(before);
  if (left && !(left === 'canoe' && canoeItem)) {
    out = out.filter((v) => v.type !== left);
    out.push({ type: left, map: mapId, x: from.x, y: from.y });
  }
  const boarded = vehicleOf(after);
  if (boarded) out = out.filter((v) => !(v.type === boarded && v.map === mapId && v.x === to.x && v.y === to.y));
  return out;
}
