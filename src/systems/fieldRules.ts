/**
 * The field rules (docs/QUEST_PLAN.md 4.1-4.2, docs/WORLD_PLAN.md 1.1): the one place that says where the party may
 * step, what a gate, a patch, a hazard, a transition or a scripted encounter does there, and what talking to an NPC
 * yields (fieldRulesNpc.ts, re-exported here). The game (ExplorationScene, the movement modes behind
 * PlayerController, CollisionMap) and the progression verifier share it. Pure TypeScript: no PixiJS, no game
 * objects; state comes in as plain sets.
 *
 * W1-0a: walking terrain, gates with requiredFlag(s) / requiredItem, static NPCs, transitions, scripted encounters.
 * W1-B: patches on flags (GAP-2), item conditions, trades and takeGold (GAP-3, GAP-15), hazards. The vehicle
 * branches are W1-A's (fieldRulesVehicles.ts).
 */
import { npcPresent, resolveNPCDialog, TerrainType } from '../types/index.js';
import type {
  Dock, FieldMode, Hazard, KeyItemGate, MapData, MapNPC, MapTransition, ScriptedEncounter, VehicleState,
} from '../types/index.js';
import { stepMode, vehicleCanLand, vehicleTerrainAllows, type CellReader } from './fieldRulesVehicles.js';
import { conditionMet, dueEncounterWhere, flagsMet } from './fieldRulesNpc.js';

export type { FieldMode } from '../types/index.js';
export {
  conditionMet, dueEncounterWhere, flagsMet, npcCutsceneFor, npcOutcome, tradeTermsMet, type NpcOutcome, type NpcTake,
} from './fieldRulesNpc.js';

export interface FieldState {
  flags: ReadonlySet<string>;
  items: ReadonlySet<string>;
  mode: FieldMode;
  vehicles: readonly VehicleState[];
  /** The party's gold, for `takeGold` trades; missing means not counted here (the verifier counts it itself). */
  gold?: number;
}

type Cell = { x: number; y: number };

function inBounds(map: MapData, x: number, y: number): boolean {
  return x >= 0 && x < map.width && y >= 0 && y < map.height;
}

/** The compiled terrain of a cell, as CollisionMap reads it (outside the map, or an unknown value: Wall; the counter
 *  value 10 is Wall; 11 is Lake, the canoe's, W1-A). */
export function baseTerrain(map: MapData, x: number, y: number): TerrainType {
  if (!inBounds(map, x, y)) return TerrainType.Wall;
  const v = map.collision[y * map.width + x];
  return (v >= 0 && v <= 9) || v === TerrainType.Lake ? (v as TerrainType) : TerrainType.Wall;
}

/**
 * The terrain after the map's patches whose flag is set (GAP-2: the north bridge, the canal); the last patch in the
 * list that covers the cell wins. Outside the map it stays Wall.
 */
export function patchedTerrain(map: MapData, x: number, y: number, flags: ReadonlySet<string>): TerrainType {
  const base = baseTerrain(map, x, y);
  if (!map.patches || !inBounds(map, x, y)) return base;
  let t = base;
  for (const p of map.patches) {
    if (flags.has(p.flag) && p.cells.some(([cx, cy]) => cx === x && cy === y)) t = p.terrain as TerrainType;
  }
  return t;
}

/** The hazard covering a cell (rects inclusive, like encounter zones), or null. */
export function hazardAt(map: MapData, cell: Cell): Hazard | null {
  return map.hazards?.find((h) => h.rects.some(([x0, y0, x1, y1]) => cell.x >= x0 && cell.x <= x1
    && cell.y >= y0 && cell.y <= y1)) ?? null;
}

/** Whether a party in `mode` may stand on terrain `t` (WalkingMode on foot; the vehicle rules otherwise). */
export function terrainAllows(mode: FieldMode, t: TerrainType): boolean {
  if (mode !== 'walking') return vehicleTerrainAllows(mode, t);
  switch (t) {
    case TerrainType.Grass: case TerrainType.Forest: case TerrainType.Desert:
    case TerrainType.Swamp: case TerrainType.Road: case TerrainType.Bridge:
      return true;
    default:
      return false;
  }
}

/** A present, non-wandering NPC standing on the cell (wanderers block where they are, which only the game knows). */
export function staticNpcAt(map: MapData, cell: Cell, state: FieldState): MapNPC | null {
  return map.npcs.find((n) => !n.wander && n.x === cell.x && n.y === cell.y && npcPresent(n, (f) => state.flags.has(f)))
    ?? null;
}

export function gateAt(map: MapData, cell: Cell): KeyItemGate | null {
  return map.keyItemGates?.find((g) => g.x === cell.x && g.y === cell.y) ?? null;
}

/** The gate's message as one line; a conditional message is resolved on the story flags and the held items
 *  (`item:<id>`; first match wins, T1). */
export function gateMessage(gate: KeyItemGate, flags: ReadonlySet<string>, items: ReadonlySet<string> = new Set()): string {
  if (typeof gate.message === 'string') return gate.message;
  return resolveNPCDialog(gate.message, (c) => conditionMet(c, { flags, items })).join(' ');
}

export interface GateCheck {
  open: boolean;
  /** The flags passing it sets (a permanent gate's `flag`). */
  setFlags: string[];
  message?: string;
}

/** Whether a gate lets the party through now: an opened permanent gate stays open; else its flags and item. */
export function gateCheck(gate: KeyItemGate, state: FieldState): GateCheck {
  if (gate.permanent && gate.flag && state.flags.has(gate.flag)) return { open: true, setFlags: [] };
  const itemOk = !gate.requiredItem || state.items.has(gate.requiredItem);
  if (!flagsMet(gate, state.flags) || !itemOk) {
    return { open: false, setFlags: [], message: gateMessage(gate, state.flags, state.items) };
  }
  return { open: true, setFlags: gate.permanent && gate.flag ? [gate.flag] : [] };
}

/** Terrain (after patches) for the mode, in bounds, no static NPC; gates are not looked at. */
function standable(map: MapData, cell: Cell, mode: FieldMode, state: FieldState): boolean {
  if (!inBounds(map, cell.x, cell.y)) return false;
  if (mode === 'airship') return true;
  if (!terrainAllows(mode, patchedTerrain(map, cell.x, cell.y, state.flags))) return false;
  return staticNpcAt(map, cell, state) === null;
}

/** Terrain after patches; gates (requiredFlag(s), requiredItem); static (non-wander) NPC cells block; while flying,
 *  everything on the map is open. (The canoe ability on River and Lake is a vehicle rule, W1-A's.) */
export function canEnter(map: MapData, cell: Cell, mode: FieldMode, state: FieldState): boolean {
  if (!standable(map, cell, mode, state)) return false;
  if (mode === 'airship') return true;
  const gate = gateAt(map, cell);
  return gate === null || gateCheck(gate, state).open;
}

/** The cell reads the vehicle rules need (fieldRulesVehicles.ts, W1-A). */
export function cellReader(map: MapData, state: FieldState): CellReader {
  return {
    mapId: map.id, inBounds: (c) => inBounds(map, c.x, c.y), terrain: (c) => patchedTerrain(map, c.x, c.y, state.flags),
    walkable: (t) => terrainAllows('walking', t), staticNpc: (c) => staticNpcAt(map, c, state) !== null,
    dock: (c) => dockFor(map, c) !== null, gate: (c) => gateAt(map, c) !== null,
    transition: (c) => map.transitions.some((t) => t.x === c.x && t.y === c.y),
  };
}

/** The party's mode after a step to the 4-neighbour `to`, or null when its terrain refuses it (gates not looked at):
 *  boarding a parked ship, the canoe on and off, the ship's dock disembark (fieldRulesVehicles.stepMode). */
export function modeAfterStep(map: MapData, from: Cell, to: Cell, state: FieldState): FieldMode | null {
  return stepMode(cellReader(map, state), state, from, to);
}

/** Whether the airship may land on the cell: grass, not a transition, gate or NPC cell (fieldRulesVehicles.ts). */
export function canLand(map: MapData, cell: Cell, state: FieldState): boolean {
  return state.mode === 'airship' && vehicleCanLand(cellReader(map, state), cell);
}

/** The dock on the cell, or null (docks are W1-A's; act 1 has none). */
export function dockFor(map: MapData, cell: Cell): Dock | null {
  return map.docks?.find((d) => d.x === cell.x && d.y === cell.y) ?? null;
}

/** Whether a transition can be taken now (requiredFlag / requiredFlags). */
export function transitionOpen(t: MapTransition, state: FieldState): boolean {
  return flagsMet(t, state.flags);
}

/** The scripted encounter due at a cell (flag unset, requiredFlag(s) met), or null. */
export function dueEncounter(map: MapData, cell: Cell, state: FieldState): ScriptedEncounter | null {
  return dueEncounterWhere(map.scriptedEncounters ?? [], (e) => e.x === cell.x && e.y === cell.y, state);
}

export interface StepResult {
  ok: boolean;
  mode: FieldMode;
  setFlags: string[];
  message?: string;
  transition?: MapTransition;
  encounter?: ScriptedEncounter;
  /** HP a walking step onto a hazard cell takes from every living member, never below 1 HP (W1-B). */
  hazard?: number;
}

/**
 * One step from `from` to the 4-neighbour `to`: canEnter, gate messages, permanent gates' flags, the transition taken,
 * the encounter due, the hazard damage of a walking step. The single entry point the game and the verifier share.
 * The mode a step leads to (boarding, the canoe, a dock disembark) is fieldRulesVehicles.ts's (W1-A).
 */
export function fieldStep(map: MapData, from: Cell, to: Cell, state: FieldState): StepResult {
  const refused: StepResult = { ok: false, mode: state.mode, setFlags: [] };
  if (Math.abs(to.x - from.x) + Math.abs(to.y - from.y) !== 1) return refused;
  // terrain and mode changes (fieldRulesVehicles.stepMode, W1-A): on foot, boarding, the canoe, the ship's docks
  const mode = modeAfterStep(map, from, to, state);
  if (mode === null) return refused;
  let setFlags: string[] = [];
  const gate = state.mode === 'airship' ? null : gateAt(map, to);
  if (gate) {
    const g = gateCheck(gate, state);
    if (!g.open) return { ...refused, message: g.message };
    setFlags = g.setFlags;
  }
  const ok: StepResult = { ok: true, mode, setFlags };
  const hazard = state.mode === 'walking' ? hazardAt(map, to) : null;
  if (hazard && hazard.damage > 0) ok.hazard = hazard.damage;
  if (mode === 'airship') return ok; // transitions and scripted encounters are ignored while flying (QUEST 3.3)
  const transition = map.transitions.find((t) => t.x === to.x && t.y === to.y && transitionOpen(t, state));
  if (transition) return { ...ok, transition };
  const encounter = dueEncounter(map, to, state) ?? undefined;
  return encounter ? { ...ok, encounter } : ok;
}
