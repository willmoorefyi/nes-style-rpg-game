/**
 * The field rules (docs/QUEST_PLAN.md 4.1, docs/WORLD_PLAN.md 1.1): the one place that says where the party may step,
 * what a gate, a transition or a scripted encounter does there, and what talking to an NPC yields. The game
 * (ExplorationScene, the movement modes behind PlayerController) and the progression verifier share it.
 * Pure TypeScript: no PixiJS, no game objects; state comes in as plain sets.
 *
 * W1-0a implements today's act-1 behaviour: walking terrain, gates with requiredFlag(s) / requiredItem, static NPCs,
 * transitions and scripted encounters. Vehicles keep today's rules (fieldRulesVehicles.ts, W1-A); patches, docks,
 * the canoe ability, item conditions and trades are W1-B's.
 */
import { npcPresent, resolveNPCDialog, TerrainType } from '../types/index.js';
import type {
  Dock, FieldMode, KeyItemGate, MapData, MapNPC, MapTransition, ScriptedEncounter, VehicleState,
} from '../types/index.js';
import { vehicleCanLand, vehicleMove, vehicleTerrainAllows } from './fieldRulesVehicles.js';

export type { FieldMode } from '../types/index.js';

export interface FieldState {
  flags: ReadonlySet<string>;
  items: ReadonlySet<string>;
  mode: FieldMode;
  vehicles: readonly VehicleState[];
}

type Cell = { x: number; y: number };

/** Every flag a `requiredFlag` / `requiredFlags` pair names is set. */
export function flagsMet(o: { requiredFlag?: string; requiredFlags?: string[] }, flags: ReadonlySet<string>): boolean {
  if (o.requiredFlag && !flags.has(o.requiredFlag)) return false;
  return (o.requiredFlags ?? []).every((f) => flags.has(f));
}

function inBounds(map: MapData, x: number, y: number): boolean {
  return x >= 0 && x < map.width && y >= 0 && y < map.height;
}

/** The compiled terrain of a cell, as CollisionMap reads it (outside the map, or an unknown value: Wall). */
export function baseTerrain(map: MapData, x: number, y: number): TerrainType {
  if (!inBounds(map, x, y)) return TerrainType.Wall;
  const v = map.collision[y * map.width + x];
  return v >= 0 && v <= 9 ? (v as TerrainType) : TerrainType.Wall;
}

/** The terrain after the map's patches whose flag is set (W1-B adds the overrides; act 1 has no patches). */
export function patchedTerrain(map: MapData, x: number, y: number, _flags: ReadonlySet<string>): TerrainType {
  return baseTerrain(map, x, y);
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

/** The gate's message as one line; a conditional message is resolved on the story flags (first match wins, T1). */
export function gateMessage(gate: KeyItemGate, flags: ReadonlySet<string>): string {
  return typeof gate.message === 'string' ? gate.message : resolveNPCDialog(gate.message, (f) => flags.has(f)).join(' ');
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
  if (!flagsMet(gate, state.flags) || !itemOk) return { open: false, setFlags: [], message: gateMessage(gate, state.flags) };
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
 *  everything on the map is open. (The canoe ability on River and Lake is W1-B's.) */
export function canEnter(map: MapData, cell: Cell, mode: FieldMode, state: FieldState): boolean {
  if (!standable(map, cell, mode, state)) return false;
  if (mode === 'airship') return true;
  const gate = gateAt(map, cell);
  return gate === null || gateCheck(gate, state).open;
}

/** Whether the airship may land on the cell (no landing at W1-0a; fieldRulesVehicles.ts). */
export function canLand(_map: MapData, _cell: Cell, state: FieldState): boolean {
  return state.mode === 'airship' && vehicleCanLand();
}

/** The dock on the cell, or null (docks are W1-A's; act 1 has none). */
export function dockFor(map: MapData, cell: Cell): Dock | null {
  return map.docks?.find((d) => d.x === cell.x && d.y === cell.y) ?? null;
}

/** Whether a transition can be taken now (requiredFlag / requiredFlags). */
export function transitionOpen(t: MapTransition, state: FieldState): boolean {
  return flagsMet(t, state.flags);
}

/** The first scripted encounter matching `where` that is still due: its flag unset (one-time), its flags met. */
export function dueEncounterWhere(encounters: readonly ScriptedEncounter[], where: (e: ScriptedEncounter) => boolean,
  state: FieldState): ScriptedEncounter | null {
  return encounters.find((e) => where(e) && !state.flags.has(e.flag) && flagsMet(e, state.flags)) ?? null;
}

/** The scripted encounter due at a cell (flag unset, requiredFlag(s) met), or null. */
export function dueEncounter(map: MapData, cell: Cell, state: FieldState): ScriptedEncounter | null {
  return dueEncounterWhere(map.scriptedEncounters ?? [], (e) => e.x === cell.x && e.y === cell.y, state);
}

export interface NpcOutcome {
  present: boolean;
  dialog: string[];
  take?: string;
  give?: string;
  setFlags: string[];
  cutscene?: string;
  /** The `flag` of the scripted encounter talking starts (`ScriptedEncounter.npc`, B1). */
  battle?: string;
  action?: string;
}

/** The cutscene an NPC plays after talking, if its flags allow it now (its `onceFlag` unset). */
export function npcCutsceneFor(npc: Pick<MapNPC, 'cutscene'>, flags: ReadonlySet<string>): string | undefined {
  const c = npc.cutscene;
  if (!c || !flagsMet(c, flags) || flags.has(c.onceFlag)) return undefined;
  return c.id;
}

/** What talking to an NPC yields now. A chest gives its item once; a gift is given once with the dialog (an NPC
 *  without dialog gives none). The game adds the bag limit (a full bag keeps the chest closed and the gift for later). */
export function npcOutcome(npc: MapNPC, state: FieldState, encounters: readonly ScriptedEncounter[]): NpcOutcome {
  const has = (f: string): boolean => state.flags.has(f);
  if (!npcPresent(npc, has)) return { present: false, dialog: [], setFlags: [] };
  const dialog = [...resolveNPCDialog(npc.dialog, has)];
  if (npc.chestItem && npc.chestFlag) {
    if (has(npc.chestFlag)) return { present: true, dialog: ['Already opened.'], setFlags: [] };
    return { present: true, dialog, give: npc.chestItem, setFlags: [npc.chestFlag] };
  }
  const out: NpcOutcome = { present: true, dialog, setFlags: [] };
  if (npc.dialog.length > 0 && npc.giftItem && npc.giftFlag && !has(npc.giftFlag)) {
    out.give = npc.giftItem;
    out.setFlags.push(npc.giftFlag);
  }
  out.cutscene = npcCutsceneFor(npc, state.flags);
  out.battle = dueEncounterWhere(encounters, (e) => e.npc === npc.id, state)?.flag;
  out.action = npc.action;
  return out;
}

export interface StepResult {
  ok: boolean;
  mode: FieldMode;
  setFlags: string[];
  message?: string;
  transition?: MapTransition;
  encounter?: ScriptedEncounter;
}

/**
 * One step from `from` to the 4-neighbour `to`: canEnter, gate messages, permanent gates' flags, the transition taken,
 * the encounter due. The single entry point the game and the verifier share. At W1-0a a step never changes the mode
 * (walking stays walking; a vehicle moves only over its own terrain, fieldRulesVehicles.ts).
 */
export function fieldStep(map: MapData, from: Cell, to: Cell, state: FieldState): StepResult {
  const refused: StepResult = { ok: false, mode: state.mode, setFlags: [] };
  if (Math.abs(to.x - from.x) + Math.abs(to.y - from.y) !== 1) return refused;
  let mode: FieldMode = 'walking';
  if (state.mode === 'walking') {
    if (!standable(map, to, 'walking', state)) return refused;
  } else {
    // the vehicle branch (fieldRulesVehicles.ts): today a vehicle only moves over its own terrain
    const mv = vehicleMove(state.mode, patchedTerrain(map, to.x, to.y, state.flags));
    if (!inBounds(map, to.x, to.y) || !mv.ok || (state.mode !== 'airship' && staticNpcAt(map, to, state))) return refused;
    mode = mv.mode;
  }
  let setFlags: string[] = [];
  const gate = state.mode === 'airship' ? null : gateAt(map, to);
  if (gate) {
    const g = gateCheck(gate, state);
    if (!g.open) return { ...refused, message: g.message };
    setFlags = g.setFlags;
  }
  const transition = map.transitions.find((t) => t.x === to.x && t.y === to.y && transitionOpen(t, state));
  if (transition) return { ok: true, mode, setFlags, transition };
  const encounter = dueEncounter(map, to, state) ?? undefined;
  return encounter ? { ok: true, mode, setFlags, encounter } : { ok: true, mode, setFlags };
}
